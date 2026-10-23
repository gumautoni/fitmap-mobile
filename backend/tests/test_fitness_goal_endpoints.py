from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select, update
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.progress.goal_models import FitnessGoal

GOALS_URL = "/api/v1/progress/goals"
METRICS_URL = "/api/v1/progress/body-metrics"


class TokenPayload(TypedDict):
    access_token: str


class AuthPayload(TypedDict):
    tokens: TokenPayload


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture(autouse=True)
def cleanup_fitness_goal_endpoint_records(
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
    email = f"fitness-goal-api-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Fitness Goal API User",
            "email": email,
            "password": "123456789012345",
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


def create_goal(
    *,
    client: TestClient,
    headers: dict[str, str],
    metric_type: str = "weight",
    target_value: str = "75.00",
    unit: str = "kg",
) -> dict[str, object]:
    response = client.post(
        GOALS_URL,
        headers=headers,
        json={
            "metric_type": metric_type,
            "target_value": target_value,
            "unit": unit,
        },
    )

    assert response.status_code == 201

    return cast(dict[str, object], response.json())


def create_measurement(
    *,
    client: TestClient,
    headers: dict[str, str],
    value: str,
    recorded_at: datetime,
    metric_type: str = "weight",
    unit: str = "kg",
) -> None:
    response = client.post(
        METRICS_URL,
        headers=headers,
        json={
            "metric_type": metric_type,
            "value": value,
            "unit": unit,
            "recorded_at": recorded_at.isoformat(),
        },
    )

    assert response.status_code == 201


def test_create_goal_requires_authentication(
    client: TestClient,
) -> None:
    response = client.post(
        GOALS_URL,
        json={
            "metric_type": "weight",
            "target_value": "75.00",
            "unit": "kg",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == ("invalid_access_token")


def test_list_goals_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(GOALS_URL)

    assert response.status_code == 401


def test_goal_progress_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(f"{GOALS_URL}/{uuid4()}/progress")

    assert response.status_code == 401


def test_invalid_token_is_rejected(
    client: TestClient,
) -> None:
    response = client.get(
        GOALS_URL,
        headers={
            "Authorization": "Bearer invalid-token",
        },
    )

    assert response.status_code == 401


def test_new_user_has_empty_goal_list(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        GOALS_URL,
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_goal_persists_data(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    headers = authorization_headers(authentication)

    goal = create_goal(
        client=client,
        headers=headers,
    )

    assert UUID(str(goal["id"]))
    assert goal["metric_type"] == "weight"
    assert goal["target_value"] == "75.00"
    assert goal["unit"] == "kg"
    assert goal["created_at"]
    assert goal["updated_at"]
    assert "user_id" not in goal

    list_response = client.get(
        GOALS_URL,
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == [goal]

    # Session retorna a entidade ORM completa.
    with Session(database_engine) as session:
        persisted = session.scalar(
            select(FitnessGoal).where(
                FitnessGoal.id == UUID(str(goal["id"])),
            )
        )

        assert persisted is not None
        assert persisted.metric_type == "weight"
        assert persisted.unit == "kg"


def test_multiple_goals_are_preserved(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    headers = authorization_headers(authentication)

    first = create_goal(
        client=client,
        headers=headers,
        target_value="80.00",
    )

    second = create_goal(
        client=client,
        headers=headers,
        target_value="75.00",
    )

    response = client.get(
        GOALS_URL,
        headers=headers,
    )

    assert response.status_code == 200
    assert len(response.json()) == 2

    assert {goal["id"] for goal in response.json()} == {
        first["id"],
        second["id"],
    }


def test_filter_goals_by_metric_type(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    headers = authorization_headers(authentication)

    weight = create_goal(
        client=client,
        headers=headers,
    )

    create_goal(
        client=client,
        headers=headers,
        metric_type="waist",
        target_value="85.00",
        unit="cm",
    )

    response = client.get(
        GOALS_URL,
        headers=headers,
        params={"metric_type": "weight"},
    )

    assert response.status_code == 200
    assert response.json() == [weight]


def test_invalid_metric_filter_is_rejected(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        GOALS_URL,
        headers=authorization_headers(authentication),
        params={"metric_type": "unsupported"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {
            "metric_type": "weight",
            "target_value": "0",
            "unit": "kg",
        },
        {
            "metric_type": "weight",
            "target_value": "-1",
            "unit": "kg",
        },
        {
            "metric_type": "weight",
            "target_value": "75.123",
            "unit": "kg",
        },
        {
            "metric_type": "weight",
            "target_value": "75.00",
            "unit": "cm",
        },
        {
            "metric_type": "waist",
            "target_value": "85.00",
            "unit": "kg",
        },
        {
            "metric_type": "unsupported",
            "target_value": "75.00",
            "unit": "kg",
        },
        {
            "metric_type": "weight",
            "target_value": "75.00",
            "unit": "kg",
            "user_id": str(uuid4()),
        },
        {
            "metric_type": "weight",
            "unit": "kg",
        },
    ],
)
def test_invalid_goal_payload_is_rejected(
    client: TestClient,
    created_emails: list[str],
    payload: dict[str, object],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    headers = authorization_headers(authentication)

    response = client.post(
        GOALS_URL,
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == ("request_validation_error")

    list_response = client.get(
        GOALS_URL,
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_users_cannot_list_each_others_goals(
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

    goal = create_goal(
        client=client,
        headers=first_headers,
    )

    first_response = client.get(
        GOALS_URL,
        headers=first_headers,
    )

    second_response = client.get(
        GOALS_URL,
        headers=second_headers,
    )

    assert first_response.status_code == 200
    assert first_response.json() == [goal]
    assert second_response.status_code == 200
    assert second_response.json() == []


def test_user_cannot_read_another_users_goal_progress(
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

    goal = create_goal(
        client=client,
        headers=authorization_headers(first_user),
    )

    response = client.get(
        f"{GOALS_URL}/{goal['id']}/progress",
        headers=authorization_headers(second_user),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == ("fitness_goal_not_found")


def test_unknown_goal_returns_404(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        f"{GOALS_URL}/{uuid4()}/progress",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == ("fitness_goal_not_found")


def test_invalid_goal_uuid_is_rejected(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        f"{GOALS_URL}/invalid-uuid/progress",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 422


def test_goal_without_metrics_has_insufficient_data(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    headers = authorization_headers(authentication)

    goal = create_goal(
        client=client,
        headers=headers,
    )

    response = client.get(
        f"{GOALS_URL}/{goal['id']}/progress",
        headers=headers,
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["goal"] == goal
    assert payload["status"] == "insufficient_data"
    assert payload["baseline_value"] is None
    assert payload["current_value"] is None
    assert payload["progress_percent"] is None


def test_goal_progress_uses_saved_body_metrics(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    headers = authorization_headers(authentication)

    goal = create_goal(
        client=client,
        headers=headers,
    )

    goal_id = UUID(str(goal["id"]))
    now = datetime.now(UTC)

    # Datas controladas para a referencia inicial da meta.
    with database_engine.begin() as connection:
        connection.execute(
            update(FitnessGoal)
            .where(FitnessGoal.id == goal_id)
            .values(
                created_at=now - timedelta(days=7),
            )
        )

    create_measurement(
        client=client,
        headers=headers,
        value="80.00",
        recorded_at=now - timedelta(days=10),
    )

    create_measurement(
        client=client,
        headers=headers,
        value="78.00",
        recorded_at=now - timedelta(days=1),
    )

    response = client.get(
        f"{GOALS_URL}/{goal_id}/progress",
        headers=headers,
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["goal"]["id"] == str(goal_id)
    assert payload["status"] == "in_progress"
    assert payload["baseline_value"] == "80.00"
    assert payload["current_value"] == "78.00"
    assert payload["progress_percent"] == "40.00"


def test_goal_progress_does_not_use_other_users_metrics(
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

    goal = create_goal(
        client=client,
        headers=first_headers,
    )

    create_measurement(
        client=client,
        headers=second_headers,
        value="75.00",
        recorded_at=datetime.now(UTC) - timedelta(days=1),
    )

    response = client.get(
        f"{GOALS_URL}/{goal['id']}/progress",
        headers=first_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "insufficient_data"
    assert response.json()["progress_percent"] is None
