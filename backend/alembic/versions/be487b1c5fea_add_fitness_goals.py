"""add fitness goals

Revision ID: be487b1c5fea
Revises: cd135c0e218f
Create Date: 2026-10-21 17:20:44.414339

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "be487b1c5fea"
down_revision: str | Sequence[str] | None = "cd135c0e218f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fitness_goals",
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
            "target_value",
            sa.Numeric(
                precision=10,
                scale=2,
            ),
            nullable=False,
        ),
        sa.Column(
            "unit",
            sa.String(length=4),
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
                "(metric_type IN ("
                "'waist', 'chest', 'arm', 'thigh', 'hip'"
                ") AND unit IN ('cm', 'in'))"
            ),
            name="ck_fitness_goals_metric_unit",
        ),
        sa.CheckConstraint(
            "metric_type IN ('weight', 'waist', 'chest', 'arm', 'thigh', 'hip')",
            name="ck_fitness_goals_metric_type",
        ),
        sa.CheckConstraint(
            "target_value > 0",
            name="ck_fitness_goals_target_value_positive",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_fitness_goals_user_id"),
        "fitness_goals",
        ["user_id"],
        unique=False,
    )

    op.create_index(
        "ix_fitness_goals_user_metric_type",
        "fitness_goals",
        ["user_id", "metric_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_fitness_goals_user_metric_type",
        table_name="fitness_goals",
    )

    op.drop_index(
        op.f("ix_fitness_goals_user_id"),
        table_name="fitness_goals",
    )

    op.drop_table("fitness_goals")
