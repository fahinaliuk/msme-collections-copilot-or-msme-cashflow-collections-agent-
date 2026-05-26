"""Dispute management API routes."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas import DisputeCreate, DisputeOut, DisputeUpdate
from backend.app.services.disputes import (
    create_dispute,
    get_dispute,
    list_disputes,
    update_dispute_status,
)
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/disputes", tags=["Disputes"])


@router.post("", response_model=DisputeOut, status_code=status.HTTP_201_CREATED)
async def create_dispute_endpoint(
    data: DisputeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dispute = await create_dispute(db, current_user.id, data)
    return DisputeOut.model_validate(dispute)


@router.get("", response_model=List[DisputeOut])
async def list_disputes_endpoint(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    disputes = await list_disputes(db, current_user.id, status=status_filter, customer_name=customer_name)
    return [DisputeOut.model_validate(d) for d in disputes]


@router.get("/{dispute_id}", response_model=DisputeOut)
async def get_dispute_endpoint(
    dispute_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dispute = await get_dispute(db, current_user.id, dispute_id)
    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found.")
    return DisputeOut.model_validate(dispute)


@router.patch("/{dispute_id}", response_model=DisputeOut)
async def update_dispute_endpoint(
    dispute_id: uuid.UUID,
    data: DisputeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dispute = await update_dispute_status(db, current_user.id, dispute_id, data)
    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found.")
    return DisputeOut.model_validate(dispute)