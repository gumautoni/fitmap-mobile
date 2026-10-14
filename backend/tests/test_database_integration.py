from pathlib import Path
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, select, text

from fitmap.training.models import Exercise

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

EXPECTED_INITIAL_EXERCISE_CATALOG = {
    UUID("00000000-0000-4000-8000-000000000001"): "Barbell Bench Press",
    UUID("00000000-0000-4000-8000-000000000002"): "Incline Dumbbell Press",
    UUID("00000000-0000-4000-8000-000000000003"): "Push-up",
    UUID("00000000-0000-4000-8000-000000000004"): "Lat Pulldown",
    UUID("00000000-0000-4000-8000-000000000005"): "Seated Cable Row",
    UUID("00000000-0000-4000-8000-000000000006"): "Barbell Row",
    UUID("00000000-0000-4000-8000-000000000007"): "Back Squat",
    UUID("00000000-0000-4000-8000-000000000008"): "Leg Press",
    UUID("00000000-0000-4000-8000-000000000009"): "Romanian Deadlift",
    UUID("00000000-0000-4000-8000-000000000010"): "Leg Extension",
    UUID("00000000-0000-4000-8000-000000000011"): "Leg Curl",
    UUID("00000000-0000-4000-8000-000000000012"): "Standing Calf Raise",
    UUID("00000000-0000-4000-8000-000000000013"): "Overhead Press",
    UUID("00000000-0000-4000-8000-000000000014"): "Dumbbell Lateral Raise",
    UUID("00000000-0000-4000-8000-000000000015"): "Barbell Biceps Curl",
    UUID("00000000-0000-4000-8000-000000000016"): "Dumbbell Biceps Curl",
    UUID("00000000-0000-4000-8000-000000000017"): "Cable Triceps Pushdown",
    UUID("00000000-0000-4000-8000-000000000018"): "Overhead Triceps Extension",
    UUID("00000000-0000-4000-8000-000000000019"): "Plank",
    UUID("00000000-0000-4000-8000-000000000020"): "Crunch",
}

pytestmark = pytest.mark.integration


def build_alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option(
        "script_location",
        str(BACKEND_DIR / "alembic"),
    )
    return config


def test_postgresql_connection_uses_isolated_test_database(
    database_engine: Engine,
) -> None:
    with database_engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT current_database()"),
        ).scalar_one()

    assert database_name == "fitmap_test"


def test_initial_exercise_catalog_is_seeded(
    database_engine: Engine,
) -> None:
    with database_engine.connect() as connection:
        rows = connection.execute(
            select(
                Exercise.id,
                Exercise.name,
                Exercise.owner_user_id,
                Exercise.is_archived,
            ).where(
                Exercise.id.in_(EXPECTED_INITIAL_EXERCISE_CATALOG),
            )
        ).all()

    assert len(rows) == len(EXPECTED_INITIAL_EXERCISE_CATALOG)

    persisted_catalog = {row.id: row.name for row in rows}

    assert persisted_catalog == EXPECTED_INITIAL_EXERCISE_CATALOG
    assert all(row.owner_user_id is None for row in rows)
    assert all(row.is_archived is False for row in rows)


def test_alembic_upgrade_and_downgrade_work_against_postgresql(
    database_engine: Engine,
) -> None:
    alembic_config = build_alembic_config()
    script_directory = ScriptDirectory.from_config(alembic_config)
    expected_head_revision = script_directory.get_current_head()

    assert expected_head_revision is not None

    command.downgrade(alembic_config, "base")

    try:
        command.upgrade(alembic_config, "head")

        with database_engine.connect() as connection:
            current_revision = connection.execute(
                text("SELECT version_num FROM alembic_version"),
            ).scalar_one()

        assert current_revision == expected_head_revision

        command.downgrade(alembic_config, "base")

        with database_engine.connect() as connection:
            current_revision = connection.execute(
                text("SELECT version_num FROM alembic_version"),
            ).scalar_one_or_none()

        assert current_revision is None
    finally:
        command.upgrade(alembic_config, "head")
