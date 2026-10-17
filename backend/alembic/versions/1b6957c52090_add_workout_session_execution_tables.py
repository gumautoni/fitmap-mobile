"""add workout session execution tables

Revision ID: 1b6957c52090
Revises: 1c8aea626e96
Create Date: 2026-10-16 13:23:18.131752

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1b6957c52090"
down_revision: str | Sequence[str] | None = "1c8aea626e96"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workout_sessions",
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
            "source_workout_id",
            sa.Uuid(),
            nullable=True,
        ),
        sa.Column(
            "workout_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "cancelled_at",
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
            (
                "(status = 'active' AND "
                "completed_at IS NULL AND "
                "cancelled_at IS NULL) OR "
                "(status = 'completed' AND "
                "completed_at IS NOT NULL AND "
                "cancelled_at IS NULL) OR "
                "(status = 'cancelled' AND "
                "completed_at IS NULL AND "
                "cancelled_at IS NOT NULL)"
            ),
            name="ck_workout_sessions_lifecycle_timestamps",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'cancelled')",
            name="ck_workout_sessions_status",
        ),
        sa.CheckConstraint(
            "length(trim(workout_name)) > 0",
            name="ck_workout_sessions_workout_name_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["source_workout_id"],
            ["workouts.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_workout_sessions_source_workout_id"),
        "workout_sessions",
        ["source_workout_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workout_sessions_user_id"),
        "workout_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "uq_workout_sessions_user_active",
        "workout_sessions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "exercise_executions",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "workout_session_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            sa.Uuid(),
            nullable=True,
        ),
        sa.Column(
            "exercise_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "planned_sets",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "planned_repetitions",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "planned_load",
            sa.Numeric(
                precision=8,
                scale=2,
            ),
            nullable=True,
        ),
        sa.Column(
            "planned_load_unit",
            sa.String(length=4),
            nullable=True,
        ),
        sa.Column(
            "planned_notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "is_completed",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "completed_at",
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
            (
                "(planned_load IS NULL AND "
                "planned_load_unit IS NULL) OR "
                "(planned_load IS NOT NULL AND "
                "planned_load_unit IN ('kg', 'lb'))"
            ),
            name="ck_exercise_executions_planned_load_unit",
        ),
        sa.CheckConstraint(
            "length(trim(exercise_name)) > 0",
            name="ck_exercise_executions_exercise_name_not_blank",
        ),
        sa.CheckConstraint(
            "planned_load IS NULL OR planned_load >= 0",
            name="ck_exercise_executions_planned_load_non_negative",
        ),
        sa.CheckConstraint(
            "planned_repetitions IS NULL OR planned_repetitions >= 1",
            name="ck_exercise_executions_planned_repetitions_positive",
        ),
        sa.CheckConstraint(
            "planned_sets IS NULL OR planned_sets >= 1",
            name="ck_exercise_executions_planned_sets_positive",
        ),
        sa.CheckConstraint(
            "position >= 1",
            name="ck_exercise_executions_position_positive",
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workout_session_id"],
            ["workout_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workout_session_id",
            "position",
            name="uq_exercise_executions_session_position",
        ),
    )
    op.create_index(
        op.f("ix_exercise_executions_exercise_id"),
        "exercise_executions",
        ["exercise_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_exercise_executions_workout_session_id"),
        "exercise_executions",
        ["workout_session_id"],
        unique=False,
    )

    op.create_table(
        "set_executions",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "exercise_execution_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "repetitions",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "load",
            sa.Numeric(
                precision=8,
                scale=2,
            ),
            nullable=True,
        ),
        sa.Column(
            "load_unit",
            sa.String(length=4),
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
                "(load IS NULL AND load_unit IS NULL) OR "
                "(load IS NOT NULL AND "
                "load_unit IN ('kg', 'lb'))"
            ),
            name="ck_set_executions_load_unit",
        ),
        sa.CheckConstraint(
            "load IS NULL OR load >= 0",
            name="ck_set_executions_load_non_negative",
        ),
        sa.CheckConstraint(
            "position >= 1",
            name="ck_set_executions_position_positive",
        ),
        sa.CheckConstraint(
            "repetitions >= 1",
            name="ck_set_executions_repetitions_positive",
        ),
        sa.ForeignKeyConstraint(
            ["exercise_execution_id"],
            ["exercise_executions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "exercise_execution_id",
            "position",
            name="uq_set_executions_exercise_position",
        ),
    )
    op.create_index(
        op.f("ix_set_executions_exercise_execution_id"),
        "set_executions",
        ["exercise_execution_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_set_executions_exercise_execution_id"),
        table_name="set_executions",
    )
    op.drop_table("set_executions")

    op.drop_index(
        op.f("ix_exercise_executions_workout_session_id"),
        table_name="exercise_executions",
    )
    op.drop_index(
        op.f("ix_exercise_executions_exercise_id"),
        table_name="exercise_executions",
    )
    op.drop_table("exercise_executions")

    op.drop_index(
        "uq_workout_sessions_user_active",
        table_name="workout_sessions",
        postgresql_where=sa.text("status = 'active'"),
    )
    op.drop_index(
        op.f("ix_workout_sessions_user_id"),
        table_name="workout_sessions",
    )
    op.drop_index(
        op.f("ix_workout_sessions_source_workout_id"),
        table_name="workout_sessions",
    )
    op.drop_table("workout_sessions")
