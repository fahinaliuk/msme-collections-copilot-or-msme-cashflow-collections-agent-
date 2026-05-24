"""SQLite persistence for saved invoice analyses."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

DATABASE_PATH = Path(__file__).resolve().parent.parent / "msme_agent.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for ORM models."""


class AnalysisUpload(Base):
    """One saved CSV analysis run."""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_overdue_amount: Mapped[float] = mapped_column(Float, nullable=False)
    total_overdue_customers: Mapped[int] = mapped_column(Integer, nullable=False)

    customers: Mapped[list["CustomerOverdueRecord"]] = relationship(
        back_populates="upload",
        cascade="all, delete-orphan",
    )


class CustomerOverdueRecord(Base):
    """Customer-level overdue summary for a saved upload."""

    __tablename__ = "customer_overdues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    upload_id: Mapped[int] = mapped_column(
        ForeignKey("uploads.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_overdue_amount: Mapped[float] = mapped_column(Float, nullable=False)
    max_days_overdue: Mapped[int] = mapped_column(Integer, nullable=False)
    priority_score: Mapped[float] = mapped_column(Float, nullable=False)

    upload: Mapped[AnalysisUpload] = relationship(back_populates="customers")


def init_db() -> None:
    """Create SQLite tables if they do not exist yet."""

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a SQLAlchemy session."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
