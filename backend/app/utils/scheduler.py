"""BizPilot Autonomous Scheduler — daily cron for autopilot collections.

Uses APScheduler to run a daily job at 09:00 AM IST that:
1. Queries all invoices with outstanding_balance > 0 belonging to
   users who have is_autopilot_enabled == True.
2. For invoices > 45 days overdue, calculates MSMED Section 16
   compound interest penalties via the legal_agent utility.
3. Generates a WhatsApp reminder (using the existing template service)
   enriched with the legal notice text.
4. Dispatches the message through the WhatsApp gateway.
5. Logs each action as DISPATCHED (or FAILED) in collection_actions.
"""

import logging
from datetime import date, datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.database import async_session_factory
from backend.app.models.collection_action import AutopilotStatus, CollectionAction, SentVia
from backend.app.models.invoice import Invoice
from backend.app.models.user import User
from backend.app.services.reminders import generate_whatsapp_messages
from backend.app.utils.legal_agent import calculate_msmed_penalty
from backend.app.utils.whatsapp_gateway import dispatch_whatsapp_message

logger = logging.getLogger("bizpilot.scheduler")

# ---------------------------------------------------------------------------
# Scheduler instance (module-level singleton)
# ---------------------------------------------------------------------------
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def autopilot_collections_job() -> None:
    """Core daily job: process overdue invoices for autopilot-enabled users."""
    logger.info("⏰ Autopilot collections job started")

    async with async_session_factory() as session:
        # 1. Query all autopilot-enabled users
        user_result = await session.execute(
            select(User).where(
                User.is_autopilot_enabled == True,  # noqa: E712
                User.is_active == True,  # noqa: E712
            )
        )
        autopilot_users = user_result.scalars().all()

        if not autopilot_users:
            logger.info("No autopilot-enabled users found. Skipping.")
            return

        logger.info("Found %d autopilot-enabled user(s)", len(autopilot_users))
        today = date.today()
        total_dispatched = 0
        total_failed = 0

        for user in autopilot_users:
            # 2. Query overdue invoices for this user
            inv_result = await session.execute(
                select(Invoice).where(
                    Invoice.user_id == user.id,
                    Invoice.outstanding_amount > 0,
                )
            )
            invoices = inv_result.scalars().all()

            if not invoices:
                logger.debug("User %s has no outstanding invoices.", user.email)
                continue

            # Group invoices by customer_name
            customer_invoices: dict[str, list] = {}
            for inv in invoices:
                customer_invoices.setdefault(inv.customer_name, []).append(inv)

            for customer_name, inv_list in customer_invoices.items():
                total_outstanding = sum(inv.outstanding_amount for inv in inv_list)
                max_days_overdue = max(inv.days_overdue for inv in inv_list)
                oldest_due = min(inv.due_date for inv in inv_list)

                # Only process if at least one invoice is overdue
                if max_days_overdue <= 0:
                    continue

                # 3. Determine tone based on severity
                if max_days_overdue <= 15:
                    tone = "polite"
                elif max_days_overdue <= 45:
                    tone = "firm"
                else:
                    tone = "urgent"

                # 4. Check for MSMED penalty eligibility (> 45 days)
                legal_text = ""
                if max_days_overdue > 45:
                    penalty_result = await calculate_msmed_penalty(
                        principal=total_outstanding,
                        due_date=oldest_due,
                        as_of=today,
                    )
                    if penalty_result["applies"]:
                        legal_text = penalty_result["legal_text"]
                        logger.info(
                            "MSMED penalty for %s (user=%s): ₹%.2f interest on ₹%.2f",
                            customer_name,
                            user.email,
                            penalty_result["penalty_amount"],
                            total_outstanding,
                        )

                # 5. Generate WhatsApp message using the LLM template service
                messages = generate_whatsapp_messages(
                    customer_name=customer_name,
                    total_overdue_amount=total_outstanding,
                    max_days_overdue=max_days_overdue,
                    number_of_invoices=len(inv_list),
                    oldest_due_date=oldest_due.isoformat(),
                    business_name=user.business_name or "Our Business",
                    tone=tone,
                )

                # Append legal notice if applicable
                final_message = messages[0]
                if legal_text:
                    final_message = f"{final_message}\n\n{legal_text}"

                # 6. Dispatch via WhatsApp gateway
                phone_number = inv_list[0].customer_phone or ""
                dispatch_status = AutopilotStatus.PENDING

                if phone_number:
                    try:
                        result = await dispatch_whatsapp_message(
                            phone_number=phone_number,
                            message=final_message,
                        )
                        dispatch_status = (
                            AutopilotStatus.DISPATCHED
                            if result.success
                            else AutopilotStatus.FAILED
                        )
                    except Exception as exc:
                        logger.exception(
                            "WhatsApp dispatch failed for %s: %s",
                            customer_name,
                            exc,
                        )
                        dispatch_status = AutopilotStatus.FAILED
                else:
                    logger.warning(
                        "No phone number for customer %s — logging as PENDING",
                        customer_name,
                    )
                    dispatch_status = AutopilotStatus.PENDING

                from backend.app.services.communication import add_timeline_entry

                # 7. Log the collection action
                action = CollectionAction(
                    user_id=user.id,
                    customer_name=customer_name,
                    action_type="reminder",
                    tone=tone,
                    message_text=final_message,
                    overdue_amount=total_outstanding,
                    days_overdue=max_days_overdue,
                    was_sent=(dispatch_status == AutopilotStatus.DISPATCHED),
                    autopilot_status=dispatch_status,
                    sent_via=SentVia.AUTOMATED_API,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(action)

                # 8. Log the event to the Customer Timeline
                event_type = "whatsapp_sent_autopilot" if dispatch_status == AutopilotStatus.DISPATCHED else "whatsapp_failed_autopilot"
                await add_timeline_entry(
                    session,
                    user.id,
                    customer_name,
                    event_type=event_type,
                    description=f"Autopilot reminder {dispatch_status.value} — {tone} tone, ₹{total_outstanding:,.2f}"
                )

                if dispatch_status == AutopilotStatus.DISPATCHED:
                    total_dispatched += 1
                else:
                    total_failed += 1

                logger.info(
                    "Action logged: customer=%s status=%s tone=%s amount=₹%.2f",
                    customer_name,
                    dispatch_status.value,
                    tone,
                    total_outstanding,
                )

        await session.commit()
        logger.info(
            "✅ Autopilot job complete — dispatched=%d, failed=%d",
            total_dispatched,
            total_failed,
        )


def start_scheduler() -> None:
    """Register the daily autopilot job and start the scheduler."""
    scheduler.add_job(
        autopilot_collections_job,
        trigger=CronTrigger(hour=9, minute=0),  # 09:00 AM IST daily
        id="autopilot_collections",
        name="BizPilot Daily Autopilot Collections",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("🚀 BizPilot scheduler started — daily job at 09:00 AM IST")


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🛑 BizPilot scheduler stopped")
