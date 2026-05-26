"""Promise-to-pay API routes."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas import PromiseToPayCreate, PromiseToPayOut, PromiseToPayUpdate
from backend.app.services.promises import (
    create_promise,
    get_promise,
    list_promises,
    update_promise_status,
)
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/promises", tags=["Promises to Pay"])


@router.post("", response_model=PromiseToPayOut, status_code=status.HTTP_201_CREATED)
async def create_promise_endpoint(
    data: PromiseToPayCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    promise = await create_promise(db, current_user.id, data)
    return PromiseToPayOut.model_validate(promise)


@router.get("", response_model=List[PromiseToPayOut])
async def list_promises_endpoint(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    promises = await list_promises(db, current_user.id, status=status_filter, customer_name=customer_name)
    return [PromiseToPayOut.model_validate(p) for p in promises]


@router.get("/{promise_id}", response_model=PromiseToPayOut)
async def get_promise_endpoint(
    promise_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    promise = await get_promise(db, current_user.id, promise_id)
    if not promise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promise not found.")
    return PromiseToPayOut.model_validate(promise)


@router.patch("/{promise_id}", response_model=PromiseToPayOut)
async def update_promise_endpoint(
    promise_id: uuid.UUID,
    data: PromiseToPayUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    promise = await update_promise_status(db, current_user.id, promise_id, data)
    if not promise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promise not found.")
    return PromiseToPayOut.model_validate(promise)