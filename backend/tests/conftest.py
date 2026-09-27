import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, create_engine

os.environ["FITMAP_ENVIRONMENT"] = "test"
os.environ["FITMAP_DB_HOST"] = "127.0.0.1"
os.environ["FITMAP_DB_PORT"] = "5434"
os.environ["FITMAP_DB_NAME"] = "fitmap_test"
os.environ["FITMAP_DB_USER"] = "fitmap_test"
os.environ["FITMAP_DB_PASSWORD"] = "fitmap_test_password"

from fitmap.config import Settings
from fitmap.main import create_app
from fitmap.persistence.database import build_database_url


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        environment="test",
        db_host="127.0.0.1",
        db_port=5434,
        db_name="fitmap_test",
        db_user="fitmap_test",
        db_password=SecretStr("fitmap_test_password"),
    )


@pytest.fixture
def client(test_settings: Settings) -> Iterator[TestClient]:
    application = create_app(test_settings)

    with TestClient(application) as test_client:
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
