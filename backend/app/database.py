"""Async SQLAlchemy engine, session factory, and base model.

Supports both SQLite (local dev) and PostgreSQL (production) with
connection pooling for PostgreSQL.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    **settings.db_pool_kwargs,
    echo=settings.DEBUG,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


async def init_db() -> None:
    """Create database tables for all registered MVP models."""
    # Import models so they register with Base.metadata before create_all.
    import backend.app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """Yield an async DB session; commits on success, rolls back on error."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()