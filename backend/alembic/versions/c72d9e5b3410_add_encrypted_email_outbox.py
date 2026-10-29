"""add encrypted email outbox

Revision ID: c72d9e5b3410
Revises: b62c5d13e904
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c72d9e5b3410"
down_revision: str | Sequence[str] | None = "b62c5d13e904"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "email_outbox_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("encrypted_payload", sa.LargeBinary(), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "purpose IN ('email_verification', 'password_recovery')", name="ck_email_outbox_purpose"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'accepted', 'failed', 'expired')",
            name="ck_email_outbox_status",
        ),
        sa.CheckConstraint("attempt_count >= 0", name="ck_email_outbox_attempt_count"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_email_outbox_messages_user_id", "email_outbox_messages", ["user_id"])
    op.create_index(
        "ix_email_outbox_messages_status_expires_at",
        "email_outbox_messages",
        ["status", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_email_outbox_messages_status_expires_at", table_name="email_outbox_messages")
    op.drop_index("ix_email_outbox_messages_user_id", table_name="email_outbox_messages")
    op.drop_table("email_outbox_messages")
