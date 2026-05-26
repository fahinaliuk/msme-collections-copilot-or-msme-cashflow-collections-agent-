"""Promise-to-pay business logic."""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.communication_log import CommunicationLog
from backend.app.models.promise_to_pay import PromiseToPay
from backend.app.schemas import PromiseToPayCreate, PromiseToPayUpdate


async def create_promise(
    db: AsyncSession, user_id: uuid.UUID, data: PromiseToPayCreate
) -> PromiseToPay:
    promise = PromiseToPay(
        user_id=user_id,
        customer_name=data.customer_name,
        invoice_id=data.invoice_id,
        promised_amount=data.promised_amount,
        promised_date=data.promised_date,
        status="pending",
        notes=data.notes,
    )
    db.add(promise)
    await db.flush()

    # Log timeline event
    db.add(
        CommunicationLog(
            user_id=user_id,
            customer_name=data.customer_name,
            event_type="promise_to_pay_created",
            description=(
                f"Promised ₹{data.promised_amount:,.2f} by "
                f"{data.promised_date.isoformat()}"
                + (f" on invoice {data.invoice_id}" if data.invoice_id else "")
            ),
            metadata_json=json.dumps({"promise_id": str(promise.id), "amount": data.promised_amount}),
        )
    )

    return promise


async def update_promise_status(
    db: AsyncSession, user_id: uuid.UUID, promise_id: uuid.UUID, data: PromiseToPayUpdate
) -> Optional[PromiseToPay]:
    result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.id == promise_id, PromiseToPay.user_id == user_id
        )
    )
    promise = result.scalars().first()
    if not promise:
        return None

    old_status = promise.status
    promise.status = data.status
    if data.notes is not None:
        promise.notes = data.notes

    # Log broken promise timeline event
    if data.status == "broken" and old_status != "broken":
        db.add(
            CommunicationLog(
                user_id=user_id,
                customer_name=promise.customer_name,
                event_type="promise_to_pay_broken",
                description=(
                    f"Promise of ₹{promise.promised_amount:,.2f} by "
                    f"{promise.promised_date.isoformat()} broken."
                ),
                metadata_json=json.dumps({"promise_id": str(promise.id), "old_status": old_status}),
            )
        )

    return promise


async def list_promises(
    db: AsyncSession,
    user_id: uuid.UUID,
    status: Optional[str] = None,
    customer_name: Optional[str] = None,
) -> List[PromiseToPay]:
    q = select(PromiseToPay).where(PromiseToPay.user_id == user_id)
    if status:
        q = q.where(PromiseToPay.status == status)
    if customer_name:
        q = q.where(PromiseToPay.customer_name == customer_name)
    q = q.order_by(PromiseToPay.created_at.desc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_promise(
    db: AsyncSession, user_id: uuid.UUID, promise_id: uuid.UUID
) -> Optional[PromiseToPay]:
    result = await db.execute(
        select(PromiseToPay).where(
            PromiseToPay.id == promise_id, PromiseToPay.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_open_promise_count(
    db: AsyncSession, user_id: uuid.UUID, customer_name: Optional[str] = None
) -> int:
    q = select(PromiseToPay).where(
        PromiseToPay.user_id == user_id, PromiseToPay.status == "pending"
    )
    if customer_name:
        q = q.where(PromiseToPay.customer_name == customer_name)
    result = await db.execute(q)
    return len(result.scalars().all())


async def get_broken_promise_count(
    db: AsyncSession, user_id: uuid.UUID, customer_name: Optional[str] = None
) -> int:
    q = select(PromiseToPay).where(
        PromiseToPay.user_id == user_id, PromiseToPay.status == "broken"
    )
    if customer_name:
        q = q.where(PromiseToPay.customer_name == customer_name)
    result = await db.execute(q)
    return len(result.scalars().all())