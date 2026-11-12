from collections.abc import Iterator
from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete

from fitmap.identity.models import User


@pytest.fixture
def created_emails() -> list[str]:
    return []


@pytest.fixture(autouse=True)
def cleanup_bmi_users(
    database_engine: Engine,
    created_emails: list[str],
) -> Iterator[None]:
    yield

    if created_emails:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email.in_(created_emails)))


def register_user(*, client: TestClient, created_emails: list[str]) -> dict[str, str]:
    email = f"bmi-api-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "BMI Test User",
            "email": email,
            "password": "Aa1!bcde",
        },
    )

    assert response.status_code == 201

    payload = cast(dict[str, object], response.json())
    tokens = cast(dict[str, str], payload["tokens"])

    return {"Authorization": f"Bearer {tokens['access_token']}"}


def update_height(*, client: TestClient, headers: dict[str, str], height: str | None) -> None:
    response = client.patch(
        "/api/v1/profile",
        headers=headers,
        json={"height_cm": height},
    )
    assert response.status_code == 200


def create_metric(
    *,
    client: TestClient,
    headers: dict[str, str],
    value: str,
    recorded_at: str = "2026-11-09T10:00:00Z",
    metric_type: str = "weight",
    unit: str = "kg",
) -> None:
    response = client.post(
        "/api/v1/progress/body-metrics",
        headers=headers,
        json={
            "metric_type": metric_type,
            "value": value,
            "unit": unit,
            "recorded_at": recorded_at,
        },
    )

    assert response.status_code == 201


def test_bmi_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/progress/bmi")
    assert response.status_code == 401


def test_bmi_empty_snapshot_and_private_cache(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.json() == {
        "height_cm": None,
        "weight_kg": None,
        "bmi": None,
        "weight_recorded_at": None,
    }


def test_bmi_without_weight(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    update_height(client=client, headers=headers, height="175.00")

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "height_cm": "175.00",
        "weight_kg": None,
        "bmi": None,
        "weight_recorded_at": None,
    }


def test_bmi_without_height_preserves_weight(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    create_metric(client=client, headers=headers, value="80.00")

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["height_cm"] is None
    assert data["weight_kg"] == "80.00"
    assert data["bmi"] is None
    assert datetime.fromisoformat(data["weight_recorded_at"]) == datetime(
        2026, 11, 9, 10, tzinfo=UTC
    )


def test_bmi_calculates_metric_weight(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    update_height(client=client, headers=headers, height="175.00")
    create_metric(client=client, headers=headers, value="70.00")

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    assert response.json()["height_cm"] == "175.00"
    assert response.json()["weight_kg"] == "70.00"
    assert response.json()["bmi"] == "22.9"


def test_bmi_converts_pounds_to_kilograms(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    update_height(client=client, headers=headers, height="180.00")
    create_metric(
        client=client,
        headers=headers,
        value="200.00",
        unit="lb",
    )

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    assert response.json()["weight_kg"] == "90.72"
    assert response.json()["bmi"] == "28.0"


def test_bmi_selects_latest_past_weight(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    update_height(client=client, headers=headers, height="170.00")

    create_metric(
        client=client,
        headers=headers,
        value="85.00",
        recorded_at="2026-11-09T10:00:00Z",
    )
    create_metric(
        client=client,
        headers=headers,
        value="80.00",
        recorded_at="2026-10-01T10:00:00Z",
    )
    create_metric(
        client=client,
        headers=headers,
        value="100.00",
        recorded_at="2099-01-01T10:00:00Z",
    )
    create_metric(
        client=client,
        headers=headers,
        value="90.00",
        recorded_at="2026-11-10T10:00:00Z",
        metric_type="waist",
        unit="cm",
    )

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    assert response.json()["weight_kg"] == "85.00"
    assert response.json()["bmi"] == "29.4"
    assert datetime.fromisoformat(response.json()["weight_recorded_at"]) == datetime(
        2026, 11, 9, 10, tzinfo=UTC
    )


def test_bmi_ignores_future_only_weight(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    update_height(client=client, headers=headers, height="170.00")
    create_metric(
        client=client,
        headers=headers,
        value="75.00",
        recorded_at="2099-01-01T10:00:00Z",
    )

    response = client.get("/api/v1/progress/bmi", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "height_cm": "170.00",
        "weight_kg": None,
        "bmi": None,
        "weight_recorded_at": None,
    }


def test_bmi_recalculates_when_height_changes(
    client: TestClient,
    created_emails: list[str],
) -> None:
    headers = register_user(client=client, created_emails=created_emails)
    create_metric(client=client, headers=headers, value="80.00")
    update_height(client=client, headers=headers, height="180.00")

    initial = client.get("/api/v1/progress/bmi", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["bmi"] == "24.7"

    update_height(client=client, headers=headers, height="160.00")
    updated = client.get("/api/v1/progress/bmi", headers=headers)
    assert updated.status_code == 200
    assert updated.json()["bmi"] == "31.3"

    update_height(client=client, headers=headers, height=None)
    cleared = client.get("/api/v1/progress/bmi", headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["height_cm"] is None
    assert cleared.json()["weight_kg"] == "80.00"
    assert cleared.json()["bmi"] is None


def test_bmi_isolated_between_users(
    client: TestClient,
    created_emails: list[str],
) -> None:
    first = register_user(client=client, created_emails=created_emails)
    second = register_user(client=client, created_emails=created_emails)

    update_height(client=client, headers=first, height="180.00")
    create_metric(client=client, headers=first, value="80.00")
    update_height(client=client, headers=second, height="170.00")

    first_response = client.get("/api/v1/progress/bmi", headers=first)
    second_response = client.get("/api/v1/progress/bmi", headers=second)

    assert first_response.status_code == 200
    assert first_response.json()["bmi"] == "24.7"

    assert second_response.status_code == 200
    assert second_response.json() == {
        "height_cm": "170.00",
        "weight_kg": None,
        "bmi": None,
        "weight_recorded_at": None,
    }
