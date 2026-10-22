"""add body metric records

Revision ID: cd135c0e218f
Revises: 24f94d668735
Create Date: 2026-10-21 15:48:51.237592

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "cd135c0e218f"
down_revision: str | Sequence[str] | None = "24f94d668735"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "body_metric_records",
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
            "metric_type",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "value",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
        ),
        sa.Column(
            "unit",
            sa.String(length=4),
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
            (
                "(metric_type = 'weight' AND unit IN ('kg', 'lb')) OR "
                "(metric_type IN ('waist', 'chest', 'arm', 'thigh', 'hip') "
                "AND unit IN ('cm', 'in'))"
            ),
            name="ck_body_metric_records_type_unit",
        ),
        sa.CheckConstraint(
            "metric_type IN ('weight', 'waist', 'chest', 'arm', 'thigh', 'hip')",
            name="ck_body_metric_records_type",
        ),
        sa.CheckConstraint(
            "value > 0",
            name="ck_body_metric_records_value_positive",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_body_metric_records_user_id"),
        "body_metric_records",
        ["user_id"],
        unique=False,
    )

    op.create_index(
        "ix_body_metric_records_user_type_recorded_at",
        "body_metric_records",
        ["user_id", "metric_type", "recorded_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_body_metric_records_user_type_recorded_at",
        table_name="body_metric_records",
    )

    op.drop_index(
        op.f("ix_body_metric_records_user_id"),
        table_name="body_metric_records",
    )

    op.drop_table("body_metric_records")
