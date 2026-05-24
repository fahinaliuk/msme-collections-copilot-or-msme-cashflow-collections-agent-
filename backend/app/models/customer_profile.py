"""Customer profile model — tracks behavior, risk, and history."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=True)
    total_invoices: Mapped[int] = mapped_column(Integer, default=0)
    total_overdue_count: Mapped[int] = mapped_column(Integer, default=0)
    total_outstanding: Mapped[float] = mapped_column(Float, default=0.0)
    max_days_overdue: Mapped[int] = mapped_column(Integer, default=0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)  # computed risk score
    risk_tier: Mapped[str] = mapped_column(String(20), default="low")  # low | medium | high | critical
    payment_reliability: Mapped[str] = mapped_column(String(20), default="unknown")  # reliable | average | unreliable
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    last_invoice_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="customer_profiles")