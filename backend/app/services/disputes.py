"""Dispute management business logic."""

from __future__ import annotations

import json
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.communication_log import CommunicationLog
from backend.app.models.dispute import Dispute
from backend.app.schemas import DisputeCreate, DisputeUpdate


async def create_dispute(
    db: AsyncSession, user_id: uuid.UUID, data: DisputeCreate
) -> Dispute:
    dispute = Dispute(
        user_id=user_id,
        customer_name=data.customer_name,
        invoice_id=data.invoice_id,
        reason=data.reason,
        description=data.description,
        disputed_amount=data.disputed_amount,
        status="open",
    )
    db.add(dispute)
    await db.flush()

    # Log timeline event
    db.add(
        CommunicationLog(
            user_id=user_id,
            customer_name=data.customer_name,
            event_type="dispute_opened",
            description=(
                f"Dispute opened — {data.reason.replace('_', ' ')}"
                + (f" on invoice {data.invoice_id}" if data.invoice_id else "")
                + (f" for ₹{data.disputed_amount:,.2f}" if data.disputed_amount > 0 else "")
            ),
            metadata_json=json.dumps({"dispute_id": str(dispute.id), "reason": data.reason}),
        )
    )

    return dispute


async def update_dispute_status(
    db: AsyncSession, user_id: uuid.UUID, dispute_id: uuid.UUID, data: DisputeUpdate
) -> Optional[Dispute]:
    result = await db.execute(
        select(Dispute).where(
            Dispute.id == dispute_id, Dispute.user_id == user_id
        )
    )
    dispute = result.scalars().first()
    if not dispute:
        return None

    old_status = dispute.status
    dispute.status = data.status
    if data.resolution_notes is not None:
        dispute.resolution_notes = data.resolution_notes

    # Log resolved timeline event
    if data.status == "resolved" and old_status != "resolved":
        db.add(
            CommunicationLog(
                user_id=user_id,
                customer_name=dispute.customer_name,
                event_type="dispute_resolved",
                description=(
                    f"Dispute resolved — {dispute.reason.replace('_', ' ')}"
                    + (f" on invoice {dispute.invoice_id}" if dispute.invoice_id else "")
                ),
                metadata_json=json.dumps({"dispute_id": str(dispute.id), "resolution": data.resolution_notes or ""}),
            )
        )

    return dispute


async def list_disputes(
    db: AsyncSession,
    user_id: uuid.UUID,
    status: Optional[str] = None,
    customer_name: Optional[str] = None,
) -> List[Dispute]:
    q = select(Dispute).where(Dispute.user_id == user_id)
    if status:
        q = q.where(Dispute.status == status)
    if customer_name:
        q = q.where(Dispute.customer_name == customer_name)
    q = q.order_by(Dispute.created_at.desc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_dispute(
    db: AsyncSession, user_id: uuid.UUID, dispute_id: uuid.UUID
) -> Optional[Dispute]:
    result = await db.execute(
        select(Dispute).where(
            Dispute.id == dispute_id, Dispute.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_open_dispute_count(
    db: AsyncSession, user_id: uuid.UUID, customer_name: Optional[str] = None
) -> int:
    q = select(Dispute).where(
        Dispute.user_id == user_id,
        Dispute.status.in_(["open", "under_review"]),
    )
    if customer_name:
        q = q.where(Dispute.customer_name == customer_name)
    result = await db.execute(q)
    return len(result.scalars().all())