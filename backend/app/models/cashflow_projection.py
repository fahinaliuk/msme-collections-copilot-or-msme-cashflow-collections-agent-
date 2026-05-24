"""Cashflow projection model — stores forecast results."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class CashflowProjection(Base):
    __tablename__ = "cashflow_projections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    projection_date: Mapped[date] = mapped_column(Date, nullable=False)
    inflows: Mapped[float] = mapped_column(Float, default=0.0)
    outflows: Mapped[float] = mapped_column(Float, default=0.0)
    end_of_day_balance: Mapped[float] = mapped_column(Float, default=0.0)
    is_risk_day: Mapped[bool] = mapped_column(default=False)
    risk_reason: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="cashflow_projections")