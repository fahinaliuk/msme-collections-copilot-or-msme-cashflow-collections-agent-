"""Customer profile aggregation and collections priority scoring."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.customer_profile import CustomerProfile
from backend.app.models.invoice import Invoice


def _risk_tier(priority_score: float) -> str:
    if priority_score > 500_000:
        return "critical"
    if priority_score > 100_000:
        return "high"
    if priority_score > 25_000:
        return "medium"
    return "low"


def _payment_reliability(overdue_count: int, max_days_overdue: int) -> str:
    if overdue_count > 2 or max_days_overdue > 60:
        return "unreliable"
    if overdue_count > 0 or max_days_overdue > 15:
        return "average"
    return "reliable"


async def refresh_customer_profiles(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Recompute all customer profiles for a user from saved invoices."""
    today = date.today()
    result = await db.execute(select(Invoice).where(Invoice.user_id == user_id))
    invoices = list(result.scalars().all())

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
        # priority_score = sum(outstanding × overdue_days) per invoice
        priority_score = sum(
            i.outstanding_amount * max((today - i.due_date).days, 0) for i in overdue_invoices
        )

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
        profile.risk_tier = _risk_tier(priority_score)
        profile.payment_reliability = _payment_reliability(overdue_cnt, max_overdue)
        profile.last_invoice_date = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)

    # Remove profiles for customers no longer present
    for name, profile in existing_profiles.items():
        if name not in seen_names:
            await db.delete(profile)
