"""add email outbox delivery leases

Revision ID: d83e4f7b91c2
Revises: c72d9e5b3410
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d83e4f7b91c2"
down_revision: str | Sequence[str] | None = "c72d9e5b3410"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("email_outbox_messages", sa.Column("lease_token", sa.Uuid(), nullable=True))
    op.add_column(
        "email_outbox_messages",
        sa.Column("leased_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "email_outbox_messages",
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_email_outbox_messages_due",
        "email_outbox_messages",
        ["status", "next_attempt_at", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_email_outbox_messages_due", table_name="email_outbox_messages")
    op.drop_column("email_outbox_messages", "next_attempt_at")
    op.drop_column("email_outbox_messages", "leased_until")
    op.drop_column("email_outbox_messages", "lease_token")
