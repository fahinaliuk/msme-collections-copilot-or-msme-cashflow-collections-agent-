"""Collection action model — tracks follow-ups and WhatsApp messages."""

import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class AutopilotStatus(str, enum.Enum):
    """Dispatch state for autonomous (autopilot) actions."""
    PENDING = "PENDING"
    DISPATCHED = "DISPATCHED"
    FAILED = "FAILED"


class SentVia(str, enum.Enum):
    """Channel through which a collection message was delivered."""
    MANUAL_COPY = "MANUAL_COPY"
    AUTOMATED_API = "AUTOMATED_API"


class CollectionAction(Base):
    __tablename__ = "collection_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # reminder | escalation | follow_up | payment_confirmed
    tone: Mapped[str] = mapped_column(String(50), default="polite")  # polite | firm | urgent
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    overdue_amount: Mapped[float] = mapped_column(Float, default=0.0)
    days_overdue: Mapped[int] = mapped_column(default=0)
    was_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # --- BizPilot autonomous state columns ---
    autopilot_status: Mapped[Optional[str]] = mapped_column(
        Enum(AutopilotStatus, name="autopilot_status_enum", create_constraint=True),
        nullable=True,
        default=None,
        doc="Dispatch state for actions triggered by the autonomous scheduler.",
    )
    sent_via: Mapped[Optional[str]] = mapped_column(
        Enum(SentVia, name="sent_via_enum", create_constraint=True),
        nullable=True,
        default=None,
        doc="Delivery channel — MANUAL_COPY (user copied text) or AUTOMATED_API (sent by scheduler).",
    )

    # Relationships
    user = relationship("User", back_populates="collection_actions")