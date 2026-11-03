"""add durable authentication rate limit buckets

Revision ID: e94a7f6c21d8
Revises: d83e4f7b91c2
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e94a7f6c21d8"
down_revision: str | Sequence[str] | None = "d83e4f7b91c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auth_rate_limit_buckets",
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("request_count >= 1", name="ck_auth_rate_limit_count_positive"),
        sa.PrimaryKeyConstraint("key_hash"),
    )


def downgrade() -> None:
    op.drop_table("auth_rate_limit_buckets")
