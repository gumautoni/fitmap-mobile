from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


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
