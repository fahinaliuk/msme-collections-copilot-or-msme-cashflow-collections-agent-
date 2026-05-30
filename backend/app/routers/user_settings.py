"""User settings API — autopilot toggle and preference management."""

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["User Settings"])


class AutopilotSettingsUpdate(BaseModel):
    """Request body for toggling autopilot mode."""
    is_autopilot_enabled: bool


class UserSettingsOut(BaseModel):
    """Current user settings response."""
    is_autopilot_enabled: bool

    model_config = {"from_attributes": True}


@router.options("/settings")
async def settings_options():
    """Allow CORS preflight to complete."""
    return Response(status_code=200)


@router.patch("/settings", response_model=UserSettingsOut)
async def update_user_settings(
    payload: AutopilotSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle autopilot mode for the authenticated user.

    When `is_autopilot_enabled` is set to True, the BizPilot scheduler
    will automatically process this user's overdue invoices daily at 9 AM,
    generate WhatsApp reminders (with MSMED legal notices where applicable),
    and dispatch them through the configured gateway.
    """
    current_user.is_autopilot_enabled = payload.is_autopilot_enabled
    db.add(current_user)

    return UserSettingsOut(is_autopilot_enabled=current_user.is_autopilot_enabled)


@router.get("/settings", response_model=UserSettingsOut)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
):
    """Retrieve the current autopilot settings for the authenticated user."""
    return UserSettingsOut(is_autopilot_enabled=current_user.is_autopilot_enabled)
