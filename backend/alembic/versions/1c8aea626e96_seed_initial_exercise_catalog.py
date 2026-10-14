"""seed initial exercise catalog

Revision ID: 1c8aea626e96
Revises: c06fe97957ba
Create Date: 2026-10-14

"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision: str = "1c8aea626e96"
down_revision: str | Sequence[str] | None = "c06fe97957ba"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATALOG_EXERCISES = (
    (
        UUID("00000000-0000-4000-8000-000000000001"),
        "Barbell Bench Press",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000002"),
        "Incline Dumbbell Press",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000003"),
        "Push-up",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000004"),
        "Lat Pulldown",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000005"),
        "Seated Cable Row",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000006"),
        "Barbell Row",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000007"),
        "Back Squat",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000008"),
        "Leg Press",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000009"),
        "Romanian Deadlift",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000010"),
        "Leg Extension",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000011"),
        "Leg Curl",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000012"),
        "Standing Calf Raise",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000013"),
        "Overhead Press",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000014"),
        "Dumbbell Lateral Raise",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000015"),
        "Barbell Biceps Curl",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000016"),
        "Dumbbell Biceps Curl",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000017"),
        "Cable Triceps Pushdown",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000018"),
        "Overhead Triceps Extension",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000019"),
        "Plank",
    ),
    (
        UUID("00000000-0000-4000-8000-000000000020"),
        "Crunch",
    ),
)

exercise_table = sa.table(
    "exercises",
    sa.column(
        "id",
        sa.Uuid(),
    ),
    sa.column(
        "owner_user_id",
        sa.Uuid(),
    ),
    sa.column(
        "name",
        sa.String(length=120),
    ),
    sa.column(
        "is_archived",
        sa.Boolean(),
    ),
)


def upgrade() -> None:
    op.bulk_insert(
        exercise_table,
        [
            {
                "id": exercise_id,
                "owner_user_id": None,
                "name": exercise_name,
                "is_archived": False,
            }
            for exercise_id, exercise_name in CATALOG_EXERCISES
        ],
    )


def downgrade() -> None:
    connection = op.get_bind()

    connection.execute(
        exercise_table.delete().where(
            exercise_table.c.id.in_(
                [exercise_id for exercise_id, _exercise_name in CATALOG_EXERCISES]
            )
        )
    )

    connection.execute(sa.text("SET CONSTRAINTS workout_exercises_exercise_id_fkey IMMEDIATE"))
