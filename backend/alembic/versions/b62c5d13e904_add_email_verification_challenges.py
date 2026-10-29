"""add email verification challenges

Revision ID: b62c5d13e904
Revises: a42f8315c260
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b62c5d13e904"
down_revision: str | Sequence[str] | None = "a42f8315c260"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "email_verification_challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("email_at_issue", sa.String(length=320), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "attempt_count >= 0 AND attempt_count <= 5",
            name="ck_email_verification_attempt_count",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_email_verification_challenges_user_id", "email_verification_challenges", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_verification_challenges_user_id", table_name="email_verification_challenges"
    )
    op.drop_table("email_verification_challenges")
