"""Worklist API routes — next-best-action worklist, call logging, and note addition."""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas.schemas import (
    AddNoteRequest,
    CommunicationLogOut,
    LogCallRequest,
    WorklistItemOut,
)
from backend.app.services.communication import add_timeline_entry
from backend.app.services.worklist import generate_worklist
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/worklist", tags=["Worklist"])


@router.get("", response_model=List[WorklistItemOut])
async def get_worklist(
    action_type: Optional[str] = Query(None, description="Filter by recommended action type"),
    min_urgency: Optional[int] = Query(None, ge=1, le=100, description="Minimum urgency score"),
    risk_tier: Optional[str] = Query(None, description="Filter by risk tier (low|medium|high|critical)"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch today's next-best-action worklist for the authenticated user.

    Returns a priority-sorted list of recommended collection actions based on
    invoices, disputes, promises, and customer profiles.
    """
    items = await generate_worklist(
        db,
        current_user.id,
        action_type=action_type,
        min_urgency=min_urgency,
        risk_tier=risk_tier,
        limit=limit,
    )
    return items


@router.post("/log-call", response_model=CommunicationLogOut, status_code=status.HTTP_201_CREATED)
async def log_call(
    req: LogCallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a phone call with a customer and write a timeline event."""
    metadata = {}
    if req.phone_number:
        metadata["phone_number"] = req.phone_number
    if req.duration_seconds is not None:
        metadata["duration_seconds"] = req.duration_seconds
    if req.notes:
        metadata["notes"] = req.notes

    entry = await add_timeline_entry(
        db,
        user_id=current_user.id,
        customer_name=req.customer_name,
        event_type="call_logged",
        description=req.description,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    return CommunicationLogOut.model_validate(entry)


@router.post("/add-note", response_model=CommunicationLogOut, status_code=status.HTTP_201_CREATED)
async def add_note(
    req: AddNoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a freeform note to a customer's communication timeline."""
    entry = await add_timeline_entry(
        db,
        user_id=current_user.id,
        customer_name=req.customer_name,
        event_type="note_added",
        description=f"{req.title} — {req.description}",
        metadata_json=json.dumps({"title": req.title}),
    )
    return CommunicationLogOut.model_validate(entry)
