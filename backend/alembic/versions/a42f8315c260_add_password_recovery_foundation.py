"""add password recovery foundation

Revision ID: a42f8315c260
Revises: 3a467e3941e2
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a42f8315c260"
down_revision: str | Sequence[str] | None = "3a467e3941e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing users are deliberately unverified until an explicit verification flow exists.
    op.add_column(
        "users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_table(
        "password_recovery_challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
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
            name="ck_password_recovery_attempt_count",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_password_recovery_challenges_user_id",
        "password_recovery_challenges",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_password_recovery_challenges_user_id",
        table_name="password_recovery_challenges",
    )
    op.drop_table("password_recovery_challenges")
    op.drop_column("users", "email_verified_at")
