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

EXPECTED_PORTUGUESE_EXERCISE_CATALOG = {
    UUID("00000000-0000-4000-8000-000000000001"): "Supino reto com barra",
    UUID("00000000-0000-4000-8000-000000000002"): "Supino inclinado com halteres",
    UUID("00000000-0000-4000-8000-000000000003"): "Flex\u00e3o de bra\u00e7os",
    UUID("00000000-0000-4000-8000-000000000004"): "Puxada frontal na polia alta",
    UUID("00000000-0000-4000-8000-000000000005"): "Remada sentada na polia baixa",
    UUID("00000000-0000-4000-8000-000000000006"): "Remada curvada com barra",
    UUID("00000000-0000-4000-8000-000000000007"): "Agachamento livre com barra",
    UUID("00000000-0000-4000-8000-000000000008"): "Leg press",
    UUID("00000000-0000-4000-8000-000000000009"): "Levantamento terra romeno",
    UUID("00000000-0000-4000-8000-000000000010"): "Cadeira extensora",
    UUID("00000000-0000-4000-8000-000000000011"): "Flexora de pernas na m\u00e1quina",
    UUID("00000000-0000-4000-8000-000000000012"): "Eleva\u00e7\u00e3o de panturrilhas em p\u00e9",
    UUID("00000000-0000-4000-8000-000000000013"): "Desenvolvimento de ombros",
    UUID("00000000-0000-4000-8000-000000000014"): "Eleva\u00e7\u00e3o lateral com halteres",
    UUID("00000000-0000-4000-8000-000000000015"): "Rosca direta com barra",
    UUID("00000000-0000-4000-8000-000000000016"): "Rosca b\u00edceps com halteres",
    UUID("00000000-0000-4000-8000-000000000017"): "Tr\u00edceps na polia alta",
    UUID(
        "00000000-0000-4000-8000-000000000018"
    ): "Extens\u00e3o de tr\u00edceps acima da cabe\u00e7a",
    UUID("00000000-0000-4000-8000-000000000019"): "Prancha isom\u00e9trica",
    UUID("00000000-0000-4000-8000-000000000020"): "Abdominal curto",
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


def test_original_catalog_ids_have_portuguese_names(
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
                Exercise.id.in_(EXPECTED_PORTUGUESE_EXERCISE_CATALOG),
            )
        ).all()

    assert len(rows) == len(EXPECTED_PORTUGUESE_EXERCISE_CATALOG)

    persisted_catalog = {row.id: row.name for row in rows}

    assert persisted_catalog == EXPECTED_PORTUGUESE_EXERCISE_CATALOG
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
