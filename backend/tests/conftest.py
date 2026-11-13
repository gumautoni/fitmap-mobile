import os
from collections.abc import Iterator
from pathlib import Path
from secrets import token_urlsafe

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, create_engine, delete, select

os.environ["FITMAP_ENVIRONMENT"] = "test"
os.environ["FITMAP_DB_HOST"] = "127.0.0.1"
os.environ["FITMAP_DB_PORT"] = "5434"
os.environ["FITMAP_DB_NAME"] = "fitmap_test"
os.environ["FITMAP_DB_USER"] = "fitmap_test"
os.environ["FITMAP_DB_PASSWORD"] = "fitmap_test_password"
os.environ["FITMAP_AUTH_JWT_SECRET"] = "fitmap-test-only-jwt-secret-not-for-production-use"
os.environ["FITMAP_AUTH_RATE_LIMIT_SECRET"] = token_urlsafe(48)

from fitmap.config import Settings
from fitmap.main import create_app
from fitmap.persistence.database import build_database_url
from fitmap.security.rate_limit_models import AuthRateLimitBucket

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def build_alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    # Preserve pytest and application logging during migrations.
    config.attributes["configure_logging"] = False
    config.set_main_option(
        "script_location",
        str(BACKEND_DIR / "alembic"),
    )
    return config


@pytest.fixture(scope="session", autouse=True)
def migrate_test_database() -> None:
    command.upgrade(build_alembic_config(), "head")


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        environment="test",
        db_host="127.0.0.1",
        db_port=5434,
        db_name="fitmap_test",
        db_user="fitmap_test",
        db_password=SecretStr("fitmap_test_password"),
        auth_jwt_secret=SecretStr(
            "fitmap-test-only-jwt-secret-not-for-production-use",
        ),
        auth_rate_limit_secret=SecretStr(token_urlsafe(48)),
    )


@pytest.fixture
def cleanup_auth_rate_limit_buckets(
    database_engine: Engine,
) -> Iterator[None]:
    with database_engine.connect() as connection:
        existing_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())

    yield

    with database_engine.begin() as connection:
        current_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())
        new_keys = current_keys - existing_keys

        if new_keys:
            connection.execute(
                delete(AuthRateLimitBucket).where(AuthRateLimitBucket.key_hash.in_(new_keys))
            )


@pytest.fixture
def client(
    test_settings: Settings,
    cleanup_auth_rate_limit_buckets: None,
) -> Iterator[TestClient]:
    application = create_app(test_settings)

    with TestClient(
        application,
        client=("198.51.100.10", 50000),
    ) as test_client:
        yield test_client


@pytest.fixture
def database_engine(test_settings: Settings) -> Iterator[Engine]:
    engine = create_engine(
        build_database_url(test_settings),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 3},
    )

    try:
        yield engine
    finally:
        engine.dispose()
