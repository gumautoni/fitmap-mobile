import json
import logging
import re
from collections.abc import Iterator
from datetime import datetime, timedelta
from uuid import UUID

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from fitmap.api import system
from fitmap.config import Settings
from fitmap.main import create_app

LOGGER_NAME = "fitmap.http"
REQUEST_ID_HEADER = "X-Request-ID"


@pytest.fixture(autouse=True)
def capture_http_logs(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger=LOGGER_NAME)


@pytest.fixture
def application(test_settings: Settings) -> FastAPI:
    app = create_app(test_settings)

    @app.get("/obs-probe/items/{item_id}")
    def read_item(item_id: str) -> dict[str, str]:
        assert item_id
        return {"status": "ok"}

    @app.post("/obs-probe/items/{item_id}")
    async def create_item(item_id: str, request: Request) -> dict[str, str]:
        assert item_id
        await request.body()
        return {"status": "ok"}

    @app.get("/obs-probe/number/{value}")
    def read_number(value: int) -> int:
        return value

    @app.get("/obs-probe/failure")
    def fail() -> None:
        raise RuntimeError("synthetic-private-error-marker")

    return app


@pytest.fixture
def obs_client(application: FastAPI) -> Iterator[TestClient]:
    with TestClient(application, raise_server_exceptions=False) as client:
        yield client


def request_id(value: str | None) -> str:
    assert value is not None
    assert re.fullmatch(r"[0-9a-f]{32}", value)
    assert UUID(hex=value).version == 4
    return value


def events(caplog: pytest.LogCaptureFixture) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []

    for record in caplog.records:
        if record.name == LOGGER_NAME:
            payload: dict[str, object] = json.loads(record.getMessage())
            assert record.exc_info is None
            assert record.stack_info is None
            result.append(payload)

    return result


def single_event(caplog: pytest.LogCaptureFixture) -> dict[str, object]:
    result = events(caplog)
    assert len(result) == 1
    return result[0]


def test_successful_request_has_structured_event(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    identifier = request_id(response.headers.get(REQUEST_ID_HEADER))
    event = single_event(caplog)

    assert set(event) == {
        "timestamp",
        "level",
        "event",
        "request_id",
        "method",
        "route",
        "status_code",
        "duration_ms",
    }

    assert event["event"] == "http_request"
    assert event["level"] == "INFO"
    assert event["request_id"] == identifier
    assert event["method"] == "GET"
    assert event["route"] == "/health"
    assert event["status_code"] == 200

    duration = event["duration_ms"]
    assert isinstance(duration, (int, float))
    assert duration >= 0

    timestamp = event["timestamp"]
    assert isinstance(timestamp, str)
    assert datetime.fromisoformat(timestamp).utcoffset() == timedelta(0)


def test_each_request_has_unique_identifier(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    first = obs_client.get("/health")
    second = obs_client.get("/health")

    first_id = request_id(first.headers.get(REQUEST_ID_HEADER))
    second_id = request_id(second.headers.get(REQUEST_ID_HEADER))

    assert first_id != second_id
    assert [event["request_id"] for event in events(caplog)] == [
        first_id,
        second_id,
    ]


@pytest.mark.parametrize(
    "incoming",
    [
        "synthetic-client-identifier",
        "a" * 32,
        "b" * 512,
    ],
)
def test_client_request_id_is_not_trusted(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
    incoming: str,
) -> None:
    response = obs_client.get(
        "/health",
        headers={REQUEST_ID_HEADER: incoming},
    )

    identifier = request_id(response.headers.get(REQUEST_ID_HEADER))

    assert identifier != incoming
    assert incoming not in json.dumps(single_event(caplog))


def test_private_request_data_is_not_logged(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.post(
        "/obs-probe/items/private-item-marker",
        params={"email": "private-query-marker"},
        headers={
            "Authorization": "Bearer private-token-marker",
            "Cookie": "session=private-cookie-marker",
            "User-Agent": "private-agent-marker",
        },
        json={"password": "private-body-marker"},
    )

    assert response.status_code == 200

    event = single_event(caplog)

    assert event["route"] == "/obs-probe/items/{item_id}"
    assert event["method"] == "POST"

    serialized = json.dumps(event)

    for marker in (
        "private-item-marker",
        "private-query-marker",
        "private-token-marker",
        "private-cookie-marker",
        "private-agent-marker",
        "private-body-marker",
    ):
        assert marker not in serialized


def test_unknown_route_does_not_log_raw_path(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.get("/private-unknown-path-marker")

    assert response.status_code == 404

    event = single_event(caplog)

    assert event["route"] == "unmatched"
    assert event["status_code"] == 404
    assert "private-unknown-path-marker" not in json.dumps(event)


def test_validation_error_contract_is_preserved(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.get("/obs-probe/number/private-invalid-value")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"

    event = single_event(caplog)

    assert event["route"] == "/obs-probe/number/{value}"
    assert event["status_code"] == 422
    assert "private-invalid-value" not in json.dumps(event)


def test_authentication_no_store_is_preserved(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.post("/api/v1/auth/login", json={})

    assert response.status_code == 422
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["error"]["code"] == "request_validation_error"

    identifier = request_id(response.headers.get(REQUEST_ID_HEADER))

    assert single_event(caplog)["request_id"] == identifier


def test_readiness_failure_has_safe_error_event(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unavailable() -> None:
        raise SQLAlchemyError("synthetic-private-database-marker")

    monkeypatch.setattr(system, "check_database_connection", unavailable)

    response = obs_client.get("/ready")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "database_unavailable"

    event = single_event(caplog)

    assert event["route"] == "/ready"
    assert event["status_code"] == 503
    assert event["level"] == "ERROR"
    assert "synthetic-private-database-marker" not in json.dumps(event)


def test_unhandled_failure_has_safe_response_and_log(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.get("/obs-probe/failure")

    assert response.status_code == 500
    assert response.text == "Internal Server Error"

    identifier = request_id(response.headers.get(REQUEST_ID_HEADER))
    event = single_event(caplog)

    assert event["request_id"] == identifier
    assert event["route"] == "/obs-probe/failure"
    assert event["status_code"] == 500
    assert event["level"] == "ERROR"
    assert "synthetic-private-error-marker" not in json.dumps(event)


def test_unhandled_exception_is_not_silently_swallowed(
    application: FastAPI,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with (
        TestClient(application) as client,
        pytest.raises(RuntimeError, match="synthetic-private-error-marker"),
    ):
        client.get("/obs-probe/failure")

    assert single_event(caplog)["status_code"] == 500


def test_redirect_is_logged_once(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.get("/health/", follow_redirects=False)

    assert response.status_code == 307

    identifier = request_id(response.headers.get(REQUEST_ID_HEADER))

    event = single_event(caplog)
    assert event["status_code"] == 307
    assert event["request_id"] == identifier


def test_unrecognized_method_is_not_logged_verbatim(
    obs_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    response = obs_client.request("OBS-PROBE", "/health")

    assert response.status_code == 405

    event = single_event(caplog)

    assert event["method"] == "OTHER"
    assert event["status_code"] == 405
