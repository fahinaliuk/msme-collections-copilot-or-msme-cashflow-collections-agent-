"""Add BizPilot autopilot columns to users and collection_actions.

Revision ID: 002
Revises: 001
Create Date: 2026-05-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum values for the new columns
autopilot_status_enum = sa.Enum("PENDING", "DISPATCHED", "FAILED", name="autopilot_status_enum")
sent_via_enum = sa.Enum("MANUAL_COPY", "AUTOMATED_API", name="sent_via_enum")


def upgrade() -> None:
    # --- users table: add autopilot toggle ---
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("is_autopilot_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0"))
        )

    # --- collection_actions table: add autonomous tracking columns ---
    with op.batch_alter_table("collection_actions") as batch_op:
        batch_op.add_column(
            sa.Column("autopilot_status", autopilot_status_enum, nullable=True)
        )
        batch_op.add_column(
            sa.Column("sent_via", sent_via_enum, nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("collection_actions") as batch_op:
        batch_op.drop_column("sent_via")
        batch_op.drop_column("autopilot_status")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("is_autopilot_enabled")

    # Clean up enum types (PostgreSQL only; no-op on SQLite)
    autopilot_status_enum.drop(op.get_bind(), checkfirst=True)
    sent_via_enum.drop(op.get_bind(), checkfirst=True)
