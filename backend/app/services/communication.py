"""Communication timeline service."""

from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.communication_log import CommunicationLog


async def list_timeline(
    db: AsyncSession,
    user_id: uuid.UUID,
    customer_name: str,
    limit: int = 50,
) -> List[CommunicationLog]:
    result = await db.execute(
        select(CommunicationLog)
        .where(CommunicationLog.user_id == user_id, CommunicationLog.customer_name == customer_name)
        .order_by(CommunicationLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def add_timeline_entry(
    db: AsyncSession,
    user_id: uuid.UUID,
    customer_name: str,
    event_type: str,
    description: Optional[str] = None,
    metadata_json: Optional[str] = None,
) -> CommunicationLog:
    entry = CommunicationLog(
        user_id=user_id,
        customer_name=customer_name,
        event_type=event_type,
        description=description,
        metadata_json=metadata_json,
    )
    db.add(entry)
    await db.flush()
    return entry