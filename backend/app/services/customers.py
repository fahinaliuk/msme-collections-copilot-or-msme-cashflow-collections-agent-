"""Customer profile aggregation and collections priority scoring.

Incorporates invoice data, open disputes, and broken promises
into risk tier and payment reliability computation.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.customer_profile import CustomerProfile
from backend.app.models.dispute import Dispute
from backend.app.models.invoice import Invoice
from backend.app.models.promise_to_pay import PromiseToPay


def _risk_tier(priority_score: float, has_open_disputes: bool) -> str:
    # Open disputes bump risk up one tier
    base = "low"
    if priority_score > 500_000:
        base = "critical"
    elif priority_score > 100_000:
        base = "high"
    elif priority_score > 25_000:
        base = "medium"

    if has_open_disputes and base == "medium":
        return "high"
    if has_open_disputes and base == "high":
        return "critical"
    return base


def _payment_reliability(
    overdue_count: int,
    max_days_overdue: int,
    broken_promise_count: int,
) -> str:
    # Broken promises reduce reliability tier
    if overdue_count > 2 or max_days_overdue > 60 or broken_promise_count >= 2:
        return "unreliable"
    if overdue_count > 0 or max_days_overdue > 15 or broken_promise_count > 0:
        return "average"
    return "reliable"


async def refresh_customer_profiles(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Recompute all customer profiles for a user from saved invoices, disputes, and promises."""
    today = date.today()
    result = await db.execute(select(Invoice).where(Invoice.user_id == user_id))
    invoices = list(result.scalars().all())

    # Fetch disputes per customer
    dispute_result = await db.execute(
        select(Dispute).where(Dispute.user_id == user_id)
    )
    all_disputes = list(dispute_result.scalars().all())
    disputes_by_customer: dict[str, list[Dispute]] = {}
    for d in all_disputes:
        disputes_by_customer.setdefault(d.customer_name, []).append(d)

    # Fetch broken promises per customer
    promise_result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.user_id == user_id,
            PromiseToPay.status == "broken",
        )
    )
    all_broken_promises = list(promise_result.scalars().all())
    broken_by_customer: dict[str, list[PromiseToPay]] = {}
    for p in all_broken_promises:
        broken_by_customer.setdefault(p.customer_name, []).append(p)

    by_customer: dict[str, list[Invoice]] = {}
    for inv in invoices:
        by_customer.setdefault(inv.customer_name, []).append(inv)

    existing_result = await db.execute(
        select(CustomerProfile).where(CustomerProfile.user_id == user_id)
    )
    existing_profiles = {p.customer_name: p for p in existing_result.scalars().all()}

    seen_names: set[str] = set()
    for customer_name, cust_invoices in by_customer.items():
        seen_names.add(customer_name)
        total_out = sum(max(i.outstanding_amount, 0.0) for i in cust_invoices)
        overdue_invoices = [
            i for i in cust_invoices if i.outstanding_amount > 0 and i.due_date < today
        ]
        overdue_cnt = len(overdue_invoices)
        max_overdue = max(
            [0] + [(today - i.due_date).days for i in overdue_invoices],
        )
        priority_score = sum(
            i.outstanding_amount * max((today - i.due_date).days, 0) for i in overdue_invoices
        )

        customer_disputes = disputes_by_customer.get(customer_name, [])
        has_open = any(d.status in ("open", "under_review") for d in customer_disputes)
        broken_count = len(broken_by_customer.get(customer_name, []))

        phone = next((i.customer_phone for i in cust_invoices if i.customer_phone), None)
        profile = existing_profiles.get(customer_name)
        if not profile:
            profile = CustomerProfile(user_id=user_id, customer_name=customer_name)
            db.add(profile)

        profile.customer_phone = phone
        profile.total_invoices = len(cust_invoices)
        profile.total_outstanding = total_out
        profile.total_overdue_count = overdue_cnt
        profile.max_days_overdue = max_overdue
        profile.risk_score = priority_score
        profile.risk_tier = _risk_tier(priority_score, has_open)
        profile.payment_reliability = _payment_reliability(overdue_cnt, max_overdue, broken_count)
        profile.last_invoice_date = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)

    for name, profile in existing_profiles.items():
        if name not in seen_names:
            await db.delete(profile)
