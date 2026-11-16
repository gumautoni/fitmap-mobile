"""Add compound indexes for paginated history and progress photos.

Revision ID: f03a7b2c9d81
Revises: d36a1f5e29b0
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f03a7b2c9d81"
down_revision: str | Sequence[str] | None = "d36a1f5e29b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_workout_sessions_user_completed_order",
        "workout_sessions",
        [
            "user_id",
            sa.text("completed_at DESC"),
            sa.text("started_at DESC"),
            sa.text("id DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("status = 'completed' AND completed_at IS NOT NULL"),
    )

    op.create_index(
        "ix_progress_photos_user_recorded_order",
        "progress_photos",
        [
            "user_id",
            sa.text("recorded_at DESC"),
            sa.text("id DESC"),
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_progress_photos_user_recorded_order",
        table_name="progress_photos",
    )

    op.drop_index(
        "ix_workout_sessions_user_completed_order",
        table_name="workout_sessions",
    )
