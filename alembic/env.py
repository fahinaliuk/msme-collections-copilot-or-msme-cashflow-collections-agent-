"""Alembic migration environment (sync engine for DDL)."""

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from backend.app.config import settings
from backend.app.database import Base

# Register MVP models on Base.metadata
import backend.app.models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_sync_url() -> str:
    """Derive a synchronous database URL for Alembic migrations."""
    raw_url = os.getenv("DATABASE_URL_SYNC") or settings.DATABASE_URL
    
    # SQLAlchemy 1.4+ requires postgresql:// instead of postgres://
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)
        
    # Strip async drivers to ensure synchronous connection for Alembic
    sync_url = raw_url.replace("+aiosqlite", "").replace("+asyncpg", "")
    return sync_url

config.set_main_option("sqlalchemy.url", get_sync_url())


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
