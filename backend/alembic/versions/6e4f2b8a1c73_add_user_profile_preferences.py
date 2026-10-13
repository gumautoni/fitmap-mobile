"""add user profile preferences

Revision ID: 6e4f2b8a1c73
Revises: df10be737988
Create Date: 2026-10-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6e4f2b8a1c73"
down_revision: str | Sequence[str] | None = "df10be737988"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
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
            "fitness_goal",
            sa.String(length=32),
            nullable=True,
        ),
        sa.Column(
            "experience_level",
            sa.String(length=20),
            nullable=True,
        ),
        sa.Column(
            "weekly_workout_goal",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "preferred_workout_duration_minutes",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "measurement_system",
            sa.String(length=10),
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
                "fitness_goal IS NULL OR "
                "fitness_goal IN ("
                "'muscle_gain', "
                "'strength', "
                "'general_fitness', "
                "'endurance', "
                "'fat_loss'"
                ")"
            ),
            name="ck_user_profiles_fitness_goal",
        ),
        sa.CheckConstraint(
            (
                "experience_level IS NULL OR "
                "experience_level IN ("
                "'beginner', "
                "'intermediate', "
                "'advanced'"
                ")"
            ),
            name="ck_user_profiles_experience_level",
        ),
        sa.CheckConstraint(
            (
                "weekly_workout_goal IS NULL OR "
                "(weekly_workout_goal >= 1 AND weekly_workout_goal <= 7)"
            ),
            name="ck_user_profiles_weekly_workout_goal",
        ),
        sa.CheckConstraint(
            (
                "preferred_workout_duration_minutes IS NULL OR "
                "("
                "preferred_workout_duration_minutes >= 15 AND "
                "preferred_workout_duration_minutes <= 180"
                ")"
            ),
            name="ck_user_profiles_workout_duration",
        ),
        sa.CheckConstraint(
            ("measurement_system IS NULL OR measurement_system IN ('metric', 'imperial')"),
            name="ck_user_profiles_measurement_system",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            name="uq_user_profiles_user_id",
        ),
    )

    op.create_index(
        op.f("ix_user_profiles_user_id"),
        "user_profiles",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_profiles_user_id"),
        table_name="user_profiles",
    )
    op.drop_table("user_profiles")
