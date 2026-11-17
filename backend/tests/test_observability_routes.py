import json
import logging
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from fitmap.config import Settings
from fitmap.main import create_app


def logged_route(caplog: pytest.LogCaptureFixture) -> str:
    records = [record for record in caplog.records if record.name == "fitmap.http"]

    assert len(records) == 1

    route = json.loads(records[0].getMessage())["route"]
    assert isinstance(route, str)
    return route


def test_nested_auth_route_preserves_full_prefix(
    test_settings: Settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="fitmap.http")

    with TestClient(create_app(test_settings)) as client:
        response = client.post("/api/v1/auth/login", json={})

    assert response.status_code == 422
    assert logged_route(caplog) == "/api/v1/auth/login"


def test_nested_parameterized_route_preserves_privacy(
    test_settings: Settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="fitmap.http")
    photo_id = str(uuid4())

    with TestClient(create_app(test_settings)) as client:
        response = client.get(f"/api/v1/progress/photos/{photo_id}/content")

    assert response.status_code == 401

    assert logged_route(caplog) == ("/api/v1/progress/photos/{progress_photo_id}/content")

    assert photo_id not in caplog.text


def test_alternative_api_prefix_is_preserved(
    test_settings: Settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="fitmap.http")

    settings = test_settings.model_copy(update={"api_v1_prefix": "/custom/v2"})

    with TestClient(create_app(settings)) as client:
        response = client.post("/custom/v2/auth/login", json={})

    assert response.status_code == 422
    assert logged_route(caplog) == "/custom/v2/auth/login"


def test_direct_route_prefix_is_not_duplicated(
    test_settings: Settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="fitmap.http")

    app = create_app(test_settings)

    @app.get("/api/v1/obs-probe/{item_id}")
    def read_item(item_id: str) -> dict[str, str]:
        assert item_id
        return {"status": "ok"}

    with TestClient(app) as client:
        response = client.get("/api/v1/obs-probe/private-item-marker")

    assert response.status_code == 200
    assert logged_route(caplog) == "/api/v1/obs-probe/{item_id}"
    assert "private-item-marker" not in caplog.text
