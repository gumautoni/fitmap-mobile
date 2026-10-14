"""add workout planning tables

Revision ID: d7badfa3c3fc
Revises: 6e4f2b8a1c73
Create Date: 2026-10-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d7badfa3c3fc"
down_revision: str | Sequence[str] | None = "6e4f2b8a1c73"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exercises",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "owner_user_id",
            sa.Uuid(),
            nullable=True,
        ),
        sa.Column(
            "name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default="false",
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
            "length(trim(name)) > 0",
            name="ck_exercises_name_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_exercises_owner_user_id"),
        "exercises",
        ["owner_user_id"],
        unique=False,
    )

    op.create_table(
        "workouts",
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
            "name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
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
            "length(trim(name)) > 0",
            name="ck_workouts_name_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_workouts_user_id"),
        "workouts",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "workout_exercises",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "workout_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "target_sets",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "target_repetitions",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "target_load",
            sa.Numeric(
                precision=8,
                scale=2,
            ),
            nullable=True,
        ),
        sa.Column(
            "target_load_unit",
            sa.String(length=4),
            nullable=True,
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
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
                "(target_load IS NULL AND target_load_unit IS NULL) OR "
                "("
                "target_load IS NOT NULL AND "
                "target_load_unit IN ('kg', 'lb')"
                ")"
            ),
            name="ck_workout_exercises_target_load_unit",
        ),
        sa.CheckConstraint(
            "position >= 1",
            name="ck_workout_exercises_position_positive",
        ),
        sa.CheckConstraint(
            "target_load IS NULL OR target_load >= 0",
            name="ck_workout_exercises_target_load_non_negative",
        ),
        sa.CheckConstraint(
            "target_repetitions IS NULL OR target_repetitions >= 1",
            name="ck_workout_exercises_target_repetitions_positive",
        ),
        sa.CheckConstraint(
            "target_sets IS NULL OR target_sets >= 1",
            name="ck_workout_exercises_target_sets_positive",
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workout_id"],
            ["workouts.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workout_id",
            "position",
            name="uq_workout_exercises_workout_position",
        ),
    )

    op.create_index(
        op.f("ix_workout_exercises_exercise_id"),
        "workout_exercises",
        ["exercise_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_workout_exercises_workout_id"),
        "workout_exercises",
        ["workout_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_workout_exercises_workout_id"),
        table_name="workout_exercises",
    )
    op.drop_index(
        op.f("ix_workout_exercises_exercise_id"),
        table_name="workout_exercises",
    )
    op.drop_table("workout_exercises")

    op.drop_index(
        op.f("ix_workouts_user_id"),
        table_name="workouts",
    )
    op.drop_table("workouts")

    op.drop_index(
        op.f("ix_exercises_owner_user_id"),
        table_name="exercises",
    )
    op.drop_table("exercises")
