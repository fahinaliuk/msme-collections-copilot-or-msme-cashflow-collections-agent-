"""Initial MVP schema

Revision ID: 001
Revises:
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are created via SQLAlchemy create_all on startup for MVP simplicity.
    # Run `alembic upgrade head` after setting DATABASE_URL_SYNC when using PostgreSQL.
    pass


def downgrade() -> None:
    pass
