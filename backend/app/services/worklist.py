"""Next-best-action worklist engine — deterministic recommendation service.

Evaluates each customer profile against invoices, disputes, and promises
to produce a priority-sorted list of recommended collection actions.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.customer_profile import CustomerProfile
from backend.app.models.dispute import Dispute
from backend.app.models.invoice import Invoice
from backend.app.models.promise_to_pay import PromiseToPay
from backend.app.schemas.schemas import WorklistItemOut

# ---------------------------------------------------------------------------
# Action type constants
# ---------------------------------------------------------------------------
ACTION_TYPES = [
    "send_polite_whatsapp",
    "send_firm_whatsapp",
    "call_customer",
    "escalate_to_owner",
    "follow_up_on_promise",
    "resolve_dispute",
    "wait_until_due_date",
    "verify_invoice_data",
]

# Large amount threshold (INR)
LARGE_AMOUNT_THRESHOLD = 50_000.0

# Promise follow-up window (days before promised_date)
PROMISE_FOLLOWUP_WINDOW_DAYS = 3


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_invoice_summaries(invoices: List[Invoice]) -> List[dict]:
    """Compact invoice dicts for the affected_invoices field."""
    return [
        {
            "invoice_id": inv.invoice_id,
            "outstanding_amount": inv.outstanding_amount,
            "days_overdue": inv.days_overdue,
            "due_date": inv.due_date.isoformat(),
        }
        for inv in invoices
    ]


def _recommend_for_customer(
    profile: CustomerProfile,
    invoices: List[Invoice],
    open_disputes: List[Dispute],
    pending_promises: List[PromiseToPay],
    broken_promises: List[PromiseToPay],
    today: date,
) -> Optional[WorklistItemOut]:
    """Apply the rule hierarchy and return the single highest-priority action."""

    customer_id = str(profile.id)
    customer_name = profile.customer_name
    risk_tier = profile.risk_tier
    total_outstanding = profile.total_outstanding
    max_days_overdue = profile.max_days_overdue

    overdue_invoices = [
        inv for inv in invoices
        if inv.outstanding_amount > 0 and inv.due_date < today
    ]
    not_due_invoices = [
        inv for inv in invoices
        if inv.outstanding_amount > 0 and inv.due_date >= today
    ]
    all_outstanding = [inv for inv in invoices if inv.outstanding_amount > 0]

    # Fallback: nothing outstanding at all
    if not all_outstanding:
        return None

    broken_count = len(broken_promises)
    has_open_dispute = len(open_disputes) > 0

    # --- Rule 0: Low-confidence invoices → verify_invoice_data ---
    low_conf_invoices = [
        inv for inv in all_outstanding
        if inv.confidence_score < 0.75
    ]
    if low_conf_invoices:
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="verify_invoice_data",
            reason=f"{len(low_conf_invoices)} invoice(s) have low extraction confidence — verify data before collection.",
            urgency_score=88,
            affected_invoices=_build_invoice_summaries(low_conf_invoices[:5]),
            suggested_channel="internal",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=has_open_dispute,
            broken_promise=broken_count > 0,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 1: Open dispute → resolve_dispute ---
    if has_open_dispute:
        dispute_invoices = list({d.invoice_id for d in open_disputes if d.invoice_id})
        affected = [inv for inv in all_outstanding if inv.invoice_id in dispute_invoices] or all_outstanding[:3]
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="resolve_dispute",
            reason=f"{len(open_disputes)} open dispute(s) require resolution before further collection.",
            urgency_score=90,
            affected_invoices=_build_invoice_summaries(affected),
            suggested_channel="phone",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=True,
            broken_promise=broken_count > 0,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 2: Pending promise near due date (≤3 days) → follow_up_on_promise ---
    near_promises = [
        p for p in pending_promises
        if (p.promised_date - today).days <= PROMISE_FOLLOWUP_WINDOW_DAYS
    ]
    if near_promises:
        promise_invoice_ids = list({p.invoice_id for p in near_promises if p.invoice_id})
        affected = [inv for inv in all_outstanding if inv.invoice_id in promise_invoice_ids] or all_outstanding[:3]
        nearest_date = min(p.promised_date for p in near_promises)
        days_until = (nearest_date - today).days
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="follow_up_on_promise",
            reason=f"Promise to pay due in {days_until} day(s) — follow up to ensure payment.",
            urgency_score=85,
            affected_invoices=_build_invoice_summaries(affected),
            suggested_channel="whatsapp",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=broken_count > 0,
            pending_promise=True,
        )

    # --- Rule 3: Overdue >60 days OR ≥2 broken promises → escalate_to_owner ---
    if max_days_overdue > 60 or broken_count >= 2:
        reason_parts = []
        if max_days_overdue > 60:
            reason_parts.append(f"{max_days_overdue} days overdue")
        if broken_count >= 2:
            reason_parts.append(f"{broken_count} broken promises")
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="escalate_to_owner",
            reason=f"Escalation required — {', '.join(reason_parts)}.",
            urgency_score=95,
            affected_invoices=_build_invoice_summaries(overdue_invoices[:5]),
            suggested_channel="phone",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=broken_count > 0,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 4: Broken promise (single) → call_customer ---
    if broken_count > 0:
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="call_customer",
            reason=f"Broken promise — {broken_count} unfulfilled commitment(s). Call to renegotiate.",
            urgency_score=80,
            affected_invoices=_build_invoice_summaries(overdue_invoices[:5]),
            suggested_channel="phone",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=True,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 5: Overdue >30 days + large amount → call_customer ---
    if max_days_overdue > 30 and total_outstanding >= LARGE_AMOUNT_THRESHOLD:
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="call_customer",
            reason=f"₹{total_outstanding:,.0f} outstanding for {max_days_overdue} days — phone call recommended.",
            urgency_score=75,
            affected_invoices=_build_invoice_summaries(overdue_invoices[:5]),
            suggested_channel="phone",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=False,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 6: Overdue 8–30 days → send_firm_whatsapp ---
    if 8 <= max_days_overdue <= 30:
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="send_firm_whatsapp",
            reason=f"{max_days_overdue} days overdue — firm reminder recommended.",
            urgency_score=60,
            affected_invoices=_build_invoice_summaries(overdue_invoices[:5]),
            suggested_channel="whatsapp",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=False,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 7: Overdue 1–7 days → send_polite_whatsapp ---
    if 1 <= max_days_overdue <= 7:
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="send_polite_whatsapp",
            reason=f"{max_days_overdue} day(s) overdue — polite WhatsApp nudge.",
            urgency_score=40,
            affected_invoices=_build_invoice_summaries(overdue_invoices[:5]),
            suggested_channel="whatsapp",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=False,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 8: Missing phone data → verify_invoice_data ---
    if not profile.customer_phone and total_outstanding > 0:
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="verify_invoice_data",
            reason="No phone number on file — verify contact details before outreach.",
            urgency_score=50,
            affected_invoices=_build_invoice_summaries(all_outstanding[:3]),
            suggested_channel="internal",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=max_days_overdue,
            open_dispute=False,
            broken_promise=False,
            pending_promise=len(pending_promises) > 0,
        )

    # --- Rule 9: Not yet due → wait_until_due_date ---
    if not_due_invoices:
        nearest_due = min(inv.due_date for inv in not_due_invoices)
        days_until = (nearest_due - today).days
        return WorklistItemOut(
            customer_id=customer_id,
            customer_name=customer_name,
            recommended_action="wait_until_due_date",
            reason=f"Earliest invoice due in {days_until} day(s). No action needed yet.",
            urgency_score=10,
            affected_invoices=_build_invoice_summaries(not_due_invoices[:3]),
            suggested_channel="none",
            risk_tier=risk_tier,
            total_outstanding=total_outstanding,
            max_days_overdue=0,
            open_dispute=False,
            broken_promise=False,
            pending_promise=len(pending_promises) > 0,
        )

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_worklist(
    db: AsyncSession,
    user_id: uuid.UUID,
    action_type: Optional[str] = None,
    min_urgency: Optional[int] = None,
    risk_tier: Optional[str] = None,
    limit: int = 50,
) -> List[WorklistItemOut]:
    """Build today's worklist for the authenticated user.

    Queries all customer profiles and their related data, applies deterministic
    rules, filters, and returns the sorted recommendations.
    """
    today = date.today()

    # Fetch all customer profiles
    cp_result = await db.execute(
        select(CustomerProfile)
        .where(CustomerProfile.user_id == user_id)
        .order_by(CustomerProfile.risk_score.desc())
    )
    profiles = list(cp_result.scalars().all())

    if not profiles:
        return []

    # Batch-fetch invoices
    inv_result = await db.execute(
        select(Invoice).where(Invoice.user_id == user_id)
    )
    all_invoices = list(inv_result.scalars().all())
    invoices_by_customer: Dict[str, List[Invoice]] = {}
    for inv in all_invoices:
        invoices_by_customer.setdefault(inv.customer_name, []).append(inv)

    # Batch-fetch open disputes
    disp_result = await db.execute(
        select(Dispute).where(
            Dispute.user_id == user_id,
            Dispute.status.in_(["open", "under_review"]),
        )
    )
    disputes_by_customer: Dict[str, List[Dispute]] = {}
    for d in disp_result.scalars().all():
        disputes_by_customer.setdefault(d.customer_name, []).append(d)

    # Batch-fetch pending promises
    pending_result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.user_id == user_id,
            PromiseToPay.status == "pending",
        )
    )
    pending_by_customer: Dict[str, List[PromiseToPay]] = {}
    for p in pending_result.scalars().all():
        pending_by_customer.setdefault(p.customer_name, []).append(p)

    # Batch-fetch broken promises
    broken_result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.user_id == user_id,
            PromiseToPay.status == "broken",
        )
    )
    broken_by_customer: Dict[str, List[PromiseToPay]] = {}
    for p in broken_result.scalars().all():
        broken_by_customer.setdefault(p.customer_name, []).append(p)

    # Generate recommendations
    items: List[WorklistItemOut] = []
    for profile in profiles:
        name = profile.customer_name
        recommendation = _recommend_for_customer(
            profile=profile,
            invoices=invoices_by_customer.get(name, []),
            open_disputes=disputes_by_customer.get(name, []),
            pending_promises=pending_by_customer.get(name, []),
            broken_promises=broken_by_customer.get(name, []),
            today=today,
        )
        if recommendation is None:
            continue

        # Apply filters
        if action_type and recommendation.recommended_action != action_type:
            continue
        if min_urgency is not None and recommendation.urgency_score < min_urgency:
            continue
        if risk_tier and recommendation.risk_tier != risk_tier:
            continue

        items.append(recommendation)

    # Sort by urgency descending, then by total outstanding descending
    items.sort(key=lambda x: (x.urgency_score, x.total_outstanding), reverse=True)

    return items[:limit]
