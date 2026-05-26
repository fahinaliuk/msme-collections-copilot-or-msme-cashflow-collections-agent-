"""Dashboard aggregates and prioritisation metrics."""

from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database import get_db
from backend.app.models.customer_profile import CustomerProfile
from backend.app.models.dispute import Dispute
from backend.app.models.invoice import Invoice
from backend.app.models.promise_to_pay import PromiseToPay
from backend.app.models.user import User
from backend.app.schemas import (
    AgingBucket,
    CollectionsSummaryPoint,
    CustomerPriorityItem,
    DashboardSummaryResponse,
    HighRiskAccount,
    KPICards,
    OverdueTrendPoint,
)
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve comprehensive collections dashboard aggregates for the authenticated user."""
    today = date.today()

    # 1. Fetch all invoices for user isolation
    inv_result = await db.execute(
        select(Invoice).where(Invoice.user_id == current_user.id)
    )
    all_invoices = list(inv_result.scalars().all())

    # 2. Compute KPIs
    total_receivables = sum(max(i.invoice_amount - i.amount_paid, 0.0) for i in all_invoices)
    collected_amount = sum(float(i.amount_paid or 0.0) for i in all_invoices)
    
    overdue_invoices = [
        i for i in all_invoices 
        if i.outstanding_amount > 0 and i.due_date < today
    ]
    overdue_invoices_amount = sum(i.outstanding_amount for i in overdue_invoices)
    overdue_invoices_count = len(overdue_invoices)
    
    overdue_percentage = (
        (overdue_invoices_amount / total_receivables * 100)
        if total_receivables > 0
        else 0.0
    )

    kpi_cards = KPICards(
        total_receivables=total_receivables,
        overdue_invoices_amount=overdue_invoices_amount,
        overdue_invoices_count=overdue_invoices_count,
        collected_amount=collected_amount,
        overdue_percentage=overdue_percentage,
    )

    # 3. Compute Aging Buckets
    aging_0_30 = {"amt": 0.0, "cnt": 0}
    aging_31_60 = {"amt": 0.0, "cnt": 0}
    aging_61_90 = {"amt": 0.0, "cnt": 0}
    aging_90_plus = {"amt": 0.0, "cnt": 0}

    for i in overdue_invoices:
        days = i.days_overdue
        if days <= 30:
            aging_0_30["amt"] += i.outstanding_amount
            aging_0_30["cnt"] += 1
        elif days <= 60:
            aging_31_60["amt"] += i.outstanding_amount
            aging_31_60["cnt"] += 1
        elif days <= 90:
            aging_61_90["amt"] += i.outstanding_amount
            aging_61_90["cnt"] += 1
        else:
            aging_90_plus["amt"] += i.outstanding_amount
            aging_90_plus["cnt"] += 1

    aging_buckets = [
        AgingBucket(bucket="0-30 days", amount=aging_0_30["amt"], count=aging_0_30["cnt"]),
        AgingBucket(bucket="31-60 days", amount=aging_31_60["amt"], count=aging_31_60["cnt"]),
        AgingBucket(bucket="61-90 days", amount=aging_61_90["amt"], count=aging_61_90["cnt"]),
        AgingBucket(bucket="90+ days", amount=aging_90_plus["amt"], count=aging_90_plus["cnt"]),
    ]

    # 4. Compute Overdue Trends (outstanding amounts for last 7 dates)
    overdue_trends = []
    for d_offset in range(6, -1, -1):
        check_date = today - timedelta(days=d_offset)
        amt_on_date = sum(
            max(i.invoice_amount - i.amount_paid, 0.0) 
            for i in all_invoices 
            if i.due_date < check_date and i.invoice_date <= check_date and (i.invoice_amount - i.amount_paid) > 0
        )
        overdue_trends.append(OverdueTrendPoint(date=check_date, amount=amt_on_date))

    # 5. Compute Collections Summary Point (aggregates by month)
    collections_summary = []
    # Fetch data grouped by month
    months_set = set()
    for i in all_invoices:
        months_set.add(i.invoice_date.strftime("%Y-%b"))
        months_set.add(i.due_date.strftime("%Y-%b"))
        
    sorted_months = sorted(list(months_set))[-4:]  # last 4 months
    for month_str in sorted_months:
        collected = sum(
            float(i.amount_paid) 
            for i in all_invoices 
            if i.invoice_date.strftime("%Y-%b") == month_str
        )
        outstanding = sum(
            max(i.invoice_amount - i.amount_paid, 0.0) 
            for i in all_invoices 
            if i.due_date.strftime("%Y-%b") == month_str
        )
        collections_summary.append(
            CollectionsSummaryPoint(month=month_str, collected=collected, outstanding=outstanding)
        )
        
    if not collections_summary:
        collections_summary = [CollectionsSummaryPoint(month=today.strftime("%b"), collected=collected_amount, outstanding=total_receivables)]

    # 6. Fetch Customer Profiles for risk tracking
    cp_result = await db.execute(
        select(CustomerProfile)
        .where(CustomerProfile.user_id == current_user.id)
        .order_by(CustomerProfile.risk_score.desc())
    )
    profiles = list(cp_result.scalars().all())

    top_priorities = []
    high_risk_accounts = []

    for p in profiles:
        item = CustomerPriorityItem(
            customer_name=p.customer_name,
            customer_phone=p.customer_phone,
            total_outstanding=p.total_outstanding,
            max_overdue_days=p.max_days_overdue,
            invoice_count=p.total_invoices,
            priority_score=p.risk_score,
            risk_tier=p.risk_tier,
        )
        top_priorities.append(item)
        
        if p.risk_tier in ("high", "critical") and p.total_outstanding > 0:
            high_risk_accounts.append(
                HighRiskAccount(
                    customer_name=p.customer_name,
                    total_outstanding=p.total_outstanding,
                    priority_score=p.risk_score,
                    risk_tier=p.risk_tier,
                )
            )

    # 7. Recent invoices
    recent_invoices = [
        {
            "invoice_id": i.invoice_id,
            "customer_name": i.customer_name,
            "due_date": i.due_date.isoformat(),
            "invoice_amount": i.invoice_amount,
            "outstanding_amount": i.outstanding_amount,
            "status": i.status,
        }
        for i in sorted(all_invoices, key=lambda x: x.created_at, reverse=True)[:5]
    ]

    # 8. Broken promises and open disputes counts
    bp_result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.user_id == current_user.id,
            PromiseToPay.status == "broken",
        )
    )
    broken_promises_count = len(bp_result.scalars().all())

    od_result = await db.execute(
        select(Dispute).where(
            Dispute.user_id == current_user.id,
            Dispute.status.in_(["open", "under_review"]),
        )
    )
    open_disputes_count = len(od_result.scalars().all())

    return DashboardSummaryResponse(
        kpis=kpi_cards,
        aging_buckets=aging_buckets,
        overdue_trends=overdue_trends,
        collections_summary=collections_summary,
        top_priorities=top_priorities,
        high_risk_accounts=high_risk_accounts,
        recent_invoices=recent_invoices,
        broken_promises_count=broken_promises_count,
        open_disputes_count=open_disputes_count,
    )


@router.get("/customers", response_model=List[CustomerPriorityItem])
async def get_all_priority_customers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the sorted customer prioritisation dashboard grid, ranking profiles by their outstanding impact."""
    cp_result = await db.execute(
        select(CustomerProfile)
        .where(CustomerProfile.user_id == current_user.id)
        .order_by(CustomerProfile.risk_score.desc())
    )
    profiles = cp_result.scalars().all()

    # Pre-fetch all disputes and broken promises for this user
    dispute_result = await db.execute(
        select(Dispute).where(
            Dispute.user_id == current_user.id,
            Dispute.status.in_(["open", "under_review"]),
        )
    )
    open_disputes: dict[str, int] = {}
    for d in dispute_result.scalars().all():
        open_disputes[d.customer_name] = open_disputes.get(d.customer_name, 0) + 1

    promise_result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.user_id == current_user.id,
            PromiseToPay.status == "broken",
        )
    )
    broken_promises: dict[str, int] = {}
    for p in promise_result.scalars().all():
        broken_promises[p.customer_name] = broken_promises.get(p.customer_name, 0) + 1

    return [
        CustomerPriorityItem(
            customer_name=p.customer_name,
            customer_phone=p.customer_phone,
            total_outstanding=p.total_outstanding,
            max_overdue_days=p.max_days_overdue,
            invoice_count=p.total_invoices,
            priority_score=p.risk_score,
            risk_tier=p.risk_tier,
            open_disputes_count=open_disputes.get(p.customer_name, 0),
            broken_promises_count=broken_promises.get(p.customer_name, 0),
        )
        for p in profiles
    ]
