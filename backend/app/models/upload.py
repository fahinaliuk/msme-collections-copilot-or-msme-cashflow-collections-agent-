"""Upload model — tracks every file ingestion."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # csv | xlsx | pdf | docx | txt | pasted_text
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    classification: Mapped[str] = mapped_column(String(50), nullable=True)  # structured | semi-structured | unstructured
    extraction_method: Mapped[str] = mapped_column(String(50), nullable=True)  # deterministic | llm | hybrid
    invoice_count: Mapped[int] = mapped_column(Integer, default=0)
    total_overdue_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total_overdue_customers: Mapped[int] = mapped_column(Integer, default=0)
    extraction_warnings: Mapped[str] = mapped_column(Text, nullable=True)  # JSON list of warnings
    raw_text: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="uploads")
    invoices = relationship("Invoice", back_populates="upload", cascade="all, delete-orphan")