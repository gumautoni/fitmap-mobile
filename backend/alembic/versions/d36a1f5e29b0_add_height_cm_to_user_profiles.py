"""Add optional height to user profiles.

Revision ID: d36a1f5e29b0
Revises: c32e5a8b7f91
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d36a1f5e29b0"
down_revision: str | Sequence[str] | None = "c32e5a8b7f91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column(
            "height_cm",
            sa.Numeric(precision=5, scale=2),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "ck_user_profiles_height_cm",
        "user_profiles",
        "height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_profiles_height_cm",
        "user_profiles",
        type_="check",
    )

    op.drop_column("user_profiles", "height_cm")
