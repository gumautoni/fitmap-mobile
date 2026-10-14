"""adjust exercise reference delete behavior

Revision ID: c06fe97957ba
Revises: d7badfa3c3fc
Create Date: 2026-10-13

"""

from collections.abc import Sequence

from alembic import op

revision: str = "c06fe97957ba"
down_revision: str | Sequence[str] | None = "d7badfa3c3fc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "workout_exercises_exercise_id_fkey",
        "workout_exercises",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "workout_exercises_exercise_id_fkey",
        "workout_exercises",
        "exercises",
        ["exercise_id"],
        ["id"],
        deferrable=True,
        initially="DEFERRED",
    )


def downgrade() -> None:
    op.drop_constraint(
        "workout_exercises_exercise_id_fkey",
        "workout_exercises",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "workout_exercises_exercise_id_fkey",
        "workout_exercises",
        "exercises",
        ["exercise_id"],
        ["id"],
        ondelete="RESTRICT",
    )
