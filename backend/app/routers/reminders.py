"""WhatsApp reminder generation, collection action logging, and communication timeline."""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database import get_db
from backend.app.models.collection_action import CollectionAction
from backend.app.models.dispute import Dispute
from backend.app.models.invoice import Invoice
from backend.app.models.promise_to_pay import PromiseToPay
from backend.app.models.user import User
from backend.app.schemas import (
    CommunicationLogOut,
    LogActionRequest,
    ReminderGenerateRequest,
    ReminderGenerateResponse,
)
from backend.app.services.communication import add_timeline_entry, list_timeline
from backend.app.services.reminders import generate_whatsapp_messages
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/collections", tags=["Reminders & Follow-Ups"])


@router.post("/reminders/generate", response_model=ReminderGenerateResponse)
async def generate_payment_reminder(
    req: ReminderGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate ready-to-copy WhatsApp payment reminders for a customer."""
    inv_result = await db.execute(
        select(Invoice).where(
            Invoice.user_id == current_user.id,
            Invoice.customer_name == req.customer_name,
            Invoice.outstanding_amount > 0,
        )
    )
    invoices = list(inv_result.scalars().all())

    if not invoices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No outstanding invoices found for customer '{req.customer_name}'.",
        )

    total_overdue = sum(inv.outstanding_amount for inv in invoices)
    max_days = max(inv.days_overdue for inv in invoices)
    oldest_due = min(inv.due_date for inv in invoices).isoformat()
    business_name = current_user.business_name or "Our Business"

    # Fetch dispute and promise context for this customer
    dispute_result = await db.execute(
        select(Dispute).where(
            Dispute.user_id == current_user.id,
            Dispute.customer_name == req.customer_name,
            Dispute.status.in_(["open", "under_review"]),
        )
    )
    open_dispute_count = len(dispute_result.scalars().all())

    promise_result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.user_id == current_user.id,
            PromiseToPay.customer_name == req.customer_name,
            PromiseToPay.status == "broken",
        )
    )
    broken_promise_count = len(promise_result.scalars().all())

    messages = generate_whatsapp_messages(
        customer_name=req.customer_name,
        total_overdue_amount=total_overdue,
        max_days_overdue=max_days,
        number_of_invoices=len(invoices),
        oldest_due_date=oldest_due,
        business_name=business_name,
        tone=req.tone,
        open_dispute_count=open_dispute_count,
        broken_promise_count=broken_promise_count,
    )

    # Log timeline event
    await add_timeline_entry(
        db, current_user.id, req.customer_name,
        event_type="whatsapp_draft_generated",
        description=f"WhatsApp reminder draft generated ({req.tone} tone, {len(invoices)} invoice(s), ₹{total_overdue:,.2f})",
    )

    return ReminderGenerateResponse(
        customer_name=req.customer_name,
        tone=req.tone,
        messages=messages,
    )


@router.get("/customers/{customer_name}/timeline", response_model=List[CommunicationLogOut])
async def get_customer_timeline(
    customer_name: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch the communication timeline for a customer."""
    entries = await list_timeline(db, current_user.id, customer_name, limit=limit)
    return [CommunicationLogOut.model_validate(e) for e in entries]


@router.post("/actions", status_code=status.HTTP_201_CREATED)
async def log_collections_action(
    req: LogActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a collection follow-up for audit history."""
    action = CollectionAction(
        user_id=current_user.id,
        customer_name=req.customer_name,
        action_type=req.action_type,
        tone=req.tone,
        message_text=req.message_text,
        overdue_amount=req.overdue_amount,
        days_overdue=req.days_overdue,
        was_sent=req.was_sent,
        created_at=datetime.now(timezone.utc),
    )
    db.add(action)

    # Log timeline event
    event_type = "whatsapp_sent_manual" if req.was_sent else "whatsapp_copied"
    await add_timeline_entry(
        db, current_user.id, req.customer_name,
        event_type=event_type,
        description=f"{req.action_type.replace('_', ' ').title()} — {req.tone} tone, ₹{req.overdue_amount:,.2f}",
    )

    return {"status": "success", "message": "Collection action recorded."}
