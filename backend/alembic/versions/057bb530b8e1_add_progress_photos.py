"""add progress photos

Revision ID: 057bb530b8e1
Revises: 1b6957c52090
Create Date: 2026-10-17 20:14:44.230774

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "057bb530b8e1"
down_revision: str | Sequence[str] | None = "1b6957c52090"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "progress_photos",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "workout_session_id",
            sa.Uuid(),
            nullable=True,
        ),
        sa.Column(
            "storage_key",
            sa.String(length=512),
            nullable=False,
        ),
        sa.Column(
            "media_type",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(media_type)) > 0",
            name="ck_progress_photos_media_type_not_blank",
        ),
        sa.CheckConstraint(
            "length(trim(storage_key)) > 0",
            name="ck_progress_photos_storage_key_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workout_session_id"],
            ["workout_sessions.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "storage_key",
            name="uq_progress_photos_storage_key",
        ),
    )
    op.create_index(
        op.f("ix_progress_photos_user_id"),
        "progress_photos",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_progress_photos_workout_session_id"),
        "progress_photos",
        ["workout_session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_progress_photos_workout_session_id"),
        table_name="progress_photos",
    )
    op.drop_index(
        op.f("ix_progress_photos_user_id"),
        table_name="progress_photos",
    )
    op.drop_table("progress_photos")
