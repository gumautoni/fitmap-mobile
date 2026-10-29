from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete

from fitmap.identity.models import User


class TokenPayload(TypedDict):
    access_token: str


class AuthPayload(TypedDict):
    tokens: TokenPayload


@pytest.fixture
def created_emails() -> list[str]:
    return []


@pytest.fixture(autouse=True)
def cleanup_body_metric_endpoint_records(
    database_engine: Engine,
    created_emails: list[str],
) -> Iterator[None]:
    yield

    if not created_emails:
        return

    with database_engine.begin() as connection:
        connection.execute(
            delete(User).where(
                User.email.in_(created_emails),
            )
        )


def register_user(
    *,
    client: TestClient,
    created_emails: list[str],
) -> AuthPayload:
    email = f"body-metric-api-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Body Metrics API User",
            "email": email,
            "password": "Aa1!bcde",
        },
    )

    assert response.status_code == 201

    return cast(AuthPayload, response.json())


def authorization_headers(
    authentication: AuthPayload,
) -> dict[str, str]:
    return {
        "Authorization": (f"Bearer {authentication['tokens']['access_token']}"),
    }


def build_metric_payload(
    *,
    metric_type: str = "weight",
    value: str = "78.50",
    unit: str = "kg",
    recorded_at: str = "2026-10-21T10:00:00Z",
) -> dict[str, str]:
    return {
        "metric_type": metric_type,
        "value": value,
        "unit": unit,
        "recorded_at": recorded_at,
    }


def test_create_body_metric_requires_authentication(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/progress/body-metrics",
        json=build_metric_payload(),
    )

    assert response.status_code == 401


def test_list_body_metrics_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/progress/body-metrics",
    )

    assert response.status_code == 401


def test_new_user_has_empty_body_metric_history(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/progress/body-metrics",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_user_can_create_and_list_body_metric(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    create_response = client.post(
        "/api/v1/progress/body-metrics",
        headers=headers,
        json=build_metric_payload(),
    )

    assert create_response.status_code == 201

    created_record = cast(
        dict[str, object],
        create_response.json(),
    )

    assert isinstance(created_record["id"], str)
    assert created_record["metric_type"] == "weight"
    assert created_record["value"] == "78.50"
    assert created_record["unit"] == "kg"
    assert "created_at" in created_record
    assert "updated_at" in created_record
    assert "user_id" not in created_record

    list_response = client.get(
        "/api/v1/progress/body-metrics",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == [created_record]


def test_body_metric_history_is_sorted_newest_first(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    measurements = [
        ("80.00", "2026-10-01T10:00:00Z"),
        ("78.50", "2026-10-21T10:00:00Z"),
        ("79.20", "2026-10-10T10:00:00Z"),
    ]

    for value, recorded_at in measurements:
        response = client.post(
            "/api/v1/progress/body-metrics",
            headers=headers,
            json=build_metric_payload(
                value=value,
                recorded_at=recorded_at,
            ),
        )

        assert response.status_code == 201

    response = client.get(
        "/api/v1/progress/body-metrics",
        headers=headers,
    )

    assert response.status_code == 200

    history = cast(
        list[dict[str, object]],
        response.json(),
    )

    assert [record["value"] for record in history] == [
        "78.50",
        "79.20",
        "80.00",
    ]


def test_body_metric_history_supports_type_filter(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    weight_response = client.post(
        "/api/v1/progress/body-metrics",
        headers=headers,
        json=build_metric_payload(),
    )

    waist_response = client.post(
        "/api/v1/progress/body-metrics",
        headers=headers,
        json=build_metric_payload(
            metric_type="waist",
            value="85.30",
            unit="cm",
        ),
    )

    assert weight_response.status_code == 201
    assert waist_response.status_code == 201

    response = client.get(
        "/api/v1/progress/body-metrics",
        headers=headers,
        params={"metric_type": "waist"},
    )

    assert response.status_code == 200

    history = cast(
        list[dict[str, object]],
        response.json(),
    )

    assert len(history) == 1
    assert history[0]["metric_type"] == "waist"
    assert history[0]["value"] == "85.30"
    assert history[0]["unit"] == "cm"


def test_body_metrics_are_isolated_between_users(
    client: TestClient,
    created_emails: list[str],
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
    )

    first_headers = authorization_headers(first_user)
    second_headers = authorization_headers(second_user)

    create_response = client.post(
        "/api/v1/progress/body-metrics",
        headers=first_headers,
        json=build_metric_payload(),
    )

    assert create_response.status_code == 201

    second_history = client.get(
        "/api/v1/progress/body-metrics",
        headers=second_headers,
    )

    assert second_history.status_code == 200
    assert second_history.json() == []

    first_history = client.get(
        "/api/v1/progress/body-metrics",
        headers=first_headers,
    )

    assert first_history.status_code == 200
    assert len(first_history.json()) == 1


@pytest.mark.parametrize(
    ("metric_type", "value", "unit"),
    [
        ("weight", "78.50", "cm"),
        ("waist", "85.30", "kg"),
        ("weight", "0", "kg"),
        ("weight", "-1", "kg"),
        ("weight", "12.345", "kg"),
        ("unsupported", "50.00", "cm"),
    ],
)
def test_invalid_body_metric_is_rejected(
    client: TestClient,
    created_emails: list[str],
    metric_type: str,
    value: str,
    unit: str,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    response = client.post(
        "/api/v1/progress/body-metrics",
        headers=headers,
        json=build_metric_payload(
            metric_type=metric_type,
            value=value,
            unit=unit,
        ),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == ("request_validation_error")

    history_response = client.get(
        "/api/v1/progress/body-metrics",
        headers=headers,
    )

    assert history_response.status_code == 200
    assert history_response.json() == []


def test_client_cannot_supply_another_user_id(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    payload = {
        **build_metric_payload(),
        "user_id": str(uuid4()),
    }

    response = client.post(
        "/api/v1/progress/body-metrics",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422

    history_response = client.get(
        "/api/v1/progress/body-metrics",
        headers=headers,
    )

    assert history_response.status_code == 200
    assert history_response.json() == []


def test_body_metric_requires_timezone_aware_date(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        "/api/v1/progress/body-metrics",
        headers=authorization_headers(authentication),
        json=build_metric_payload(
            recorded_at="2026-10-21T10:00:00",
        ),
    )

    assert response.status_code == 422


def test_body_metric_filter_rejects_unsupported_type(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/progress/body-metrics",
        headers=authorization_headers(authentication),
        params={"metric_type": "unsupported"},
    )

    assert response.status_code == 422
