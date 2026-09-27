import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_returns_ready_when_database_is_available(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "fitmap.api.system.check_database_connection",
        lambda: None,
    )

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readiness_returns_503_when_database_is_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def raise_database_error() -> None:
        raise SQLAlchemyError("test database unavailable")

    monkeypatch.setattr(
        "fitmap.api.system.check_database_connection",
        raise_database_error,
    )

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "database_unavailable",
            "message": "Database is unavailable.",
        }
    }


def test_unknown_route_uses_api_error_contract(
    client: TestClient,
) -> None:
    response = client.get("/route-that-does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "http_404",
            "message": "Not Found",
        }
    }
