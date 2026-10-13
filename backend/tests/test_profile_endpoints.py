from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.identity.models import User, UserProfile


class TokenPayload(TypedDict):
    access_token: str
    access_token_expires_at: str
    refresh_token: str
    refresh_token_expires_at: str
    token_type: str


class UserPayload(TypedDict):
    id: str
    name: str
    email: str
    created_at: str


class AuthPayload(TypedDict):
    user: UserPayload
    tokens: TokenPayload


class ProfilePayload(TypedDict):
    id: str
    name: str
    email: str
    created_at: str
    fitness_goal: str | None
    experience_level: str | None
    weekly_workout_goal: int | None
    preferred_workout_duration_minutes: int | None
    measurement_system: str | None


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture(autouse=True)
def cleanup_created_users(
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
    name: str = "FitMap User",
) -> AuthPayload:
    email = f"user-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "123456789012345",
        },
    )

    assert response.status_code == 201

    return cast(
        AuthPayload,
        response.json(),
    )


def authorization_headers(
    authentication: AuthPayload,
) -> dict[str, str]:
    return {
        "Authorization": (f"Bearer {authentication['tokens']['access_token']}"),
    }


def test_get_profile_returns_authenticated_users_profile(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    profile = cast(
        ProfilePayload,
        response.json(),
    )

    assert profile == {
        "id": authentication["user"]["id"],
        "name": authentication["user"]["name"],
        "email": authentication["user"]["email"],
        "created_at": authentication["user"]["created_at"],
        "fitness_goal": None,
        "experience_level": None,
        "weekly_workout_goal": None,
        "preferred_workout_duration_minutes": None,
        "measurement_system": None,
    }


def test_get_profile_rejects_unauthenticated_request(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/profile",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_update_profile_normalizes_and_persists_name(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "name": "  Gustavo    Mautoni  ",
        },
    )

    assert response.status_code == 200

    profile = cast(
        ProfilePayload,
        response.json(),
    )

    assert profile["id"] == authentication["user"]["id"]
    assert profile["name"] == "Gustavo Mautoni"
    assert profile["email"] == authentication["user"]["email"]
    assert profile["fitness_goal"] is None
    assert profile["experience_level"] is None
    assert profile["weekly_workout_goal"] is None
    assert profile["preferred_workout_duration_minutes"] is None
    assert profile["measurement_system"] is None

    with database_engine.connect() as connection:
        persisted_name = connection.scalar(
            select(User.name).where(
                User.email == authentication["user"]["email"],
            )
        )

    assert persisted_name == "Gustavo Mautoni"


def test_update_profile_persists_fitness_preferences(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "fitness_goal": "muscle_gain",
            "experience_level": "intermediate",
            "weekly_workout_goal": 4,
            "preferred_workout_duration_minutes": 60,
            "measurement_system": "metric",
        },
    )

    assert response.status_code == 200

    profile = cast(
        ProfilePayload,
        response.json(),
    )

    assert profile["fitness_goal"] == "muscle_gain"
    assert profile["experience_level"] == "intermediate"
    assert profile["weekly_workout_goal"] == 4
    assert profile["preferred_workout_duration_minutes"] == 60
    assert profile["measurement_system"] == "metric"

    with database_engine.connect() as connection:
        persisted_profile = connection.execute(
            select(
                UserProfile.fitness_goal,
                UserProfile.experience_level,
                UserProfile.weekly_workout_goal,
                UserProfile.preferred_workout_duration_minutes,
                UserProfile.measurement_system,
            ).where(
                UserProfile.user_id == UUID(authentication["user"]["id"]),
            )
        ).one()

    assert persisted_profile.fitness_goal == "muscle_gain"
    assert persisted_profile.experience_level == "intermediate"
    assert persisted_profile.weekly_workout_goal == 4
    assert persisted_profile.preferred_workout_duration_minutes == 60
    assert persisted_profile.measurement_system == "metric"


def test_update_profile_only_changes_requested_fields(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    initial_response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "fitness_goal": "strength",
            "experience_level": "advanced",
            "weekly_workout_goal": 5,
            "preferred_workout_duration_minutes": 75,
            "measurement_system": "metric",
        },
    )

    assert initial_response.status_code == 200

    partial_response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "weekly_workout_goal": 3,
        },
    )

    assert partial_response.status_code == 200

    profile = cast(
        ProfilePayload,
        partial_response.json(),
    )

    assert profile["fitness_goal"] == "strength"
    assert profile["experience_level"] == "advanced"
    assert profile["weekly_workout_goal"] == 3
    assert profile["preferred_workout_duration_minutes"] == 75
    assert profile["measurement_system"] == "metric"


def test_update_profile_allows_clearing_optional_preference(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    initial_response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "fitness_goal": "endurance",
            "experience_level": "beginner",
            "weekly_workout_goal": 3,
            "preferred_workout_duration_minutes": 45,
            "measurement_system": "imperial",
        },
    )

    assert initial_response.status_code == 200

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "fitness_goal": None,
        },
    )

    assert response.status_code == 200

    profile = cast(
        ProfilePayload,
        response.json(),
    )

    assert profile["fitness_goal"] is None
    assert profile["experience_level"] == "beginner"
    assert profile["weekly_workout_goal"] == 3
    assert profile["preferred_workout_duration_minutes"] == 45
    assert profile["measurement_system"] == "imperial"

    with database_engine.connect() as connection:
        persisted_goal = connection.scalar(
            select(UserProfile.fitness_goal).where(
                UserProfile.user_id == UUID(authentication["user"]["id"]),
            )
        )

    assert persisted_goal is None


def test_update_profile_only_changes_authenticated_user(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
        name="First User",
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Second User",
    )

    first_response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(first_user),
        json={
            "name": "Updated First User",
            "fitness_goal": "muscle_gain",
            "experience_level": "intermediate",
            "weekly_workout_goal": 4,
            "preferred_workout_duration_minutes": 60,
            "measurement_system": "metric",
        },
    )

    assert first_response.status_code == 200

    with database_engine.connect() as connection:
        first_name = connection.scalar(
            select(User.name).where(
                User.email == first_user["user"]["email"],
            )
        )
        second_name = connection.scalar(
            select(User.name).where(
                User.email == second_user["user"]["email"],
            )
        )

        second_profile = connection.scalar(
            select(UserProfile).where(
                UserProfile.user_id == UUID(second_user["user"]["id"]),
            )
        )

    assert first_name == "Updated First User"
    assert second_name == "Second User"
    assert second_profile is None

    second_profile_response = client.get(
        "/api/v1/profile",
        headers=authorization_headers(second_user),
    )

    assert second_profile_response.status_code == 200

    second_profile_payload = cast(
        ProfilePayload,
        second_profile_response.json(),
    )

    assert second_profile_payload["name"] == "Second User"
    assert second_profile_payload["fitness_goal"] is None
    assert second_profile_payload["experience_level"] is None
    assert second_profile_payload["weekly_workout_goal"] is None
    assert second_profile_payload["preferred_workout_duration_minutes"] is None
    assert second_profile_payload["measurement_system"] is None


def test_update_profile_rejects_unsupported_fields(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    original_email = authentication["user"]["email"]

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "name": "Changed Name",
            "email": f"changed-{uuid4()}@example.com",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }

    with database_engine.connect() as connection:
        persisted_user = connection.execute(
            select(
                User.name,
                User.email,
            ).where(
                User.email == original_email,
            )
        ).one()

    assert persisted_user.name == "FitMap User"
    assert persisted_user.email == original_email


def test_update_profile_rejects_blank_name(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "name": "   ",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }

    with database_engine.connect() as connection:
        persisted_name = connection.scalar(
            select(User.name).where(
                User.email == authentication["user"]["email"],
            )
        )

    assert persisted_name == "FitMap User"


def test_update_profile_rejects_null_name(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "name": None,
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }

    with database_engine.connect() as connection:
        persisted_name = connection.scalar(
            select(User.name).where(
                User.email == authentication["user"]["email"],
            )
        )

    assert persisted_name == "FitMap User"


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("fitness_goal", "invalid_goal"),
        ("experience_level", "expert"),
        ("weekly_workout_goal", 0),
        ("weekly_workout_goal", 8),
        ("preferred_workout_duration_minutes", 14),
        ("preferred_workout_duration_minutes", 181),
        ("measurement_system", "unknown"),
    ],
)
def test_update_profile_rejects_invalid_preferences(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    field_name: str,
    invalid_value: str | int,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            field_name: invalid_value,
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }

    with database_engine.connect() as connection:
        persisted_profile = connection.scalar(
            select(UserProfile).where(
                UserProfile.user_id == UUID(authentication["user"]["id"]),
            )
        )

    assert persisted_profile is None


def test_update_profile_accepts_boundary_values(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    minimum_response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "weekly_workout_goal": 1,
            "preferred_workout_duration_minutes": 15,
        },
    )

    assert minimum_response.status_code == 200

    minimum_profile = cast(
        ProfilePayload,
        minimum_response.json(),
    )

    assert minimum_profile["weekly_workout_goal"] == 1
    assert minimum_profile["preferred_workout_duration_minutes"] == 15

    maximum_response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(authentication),
        json={
            "weekly_workout_goal": 7,
            "preferred_workout_duration_minutes": 180,
        },
    )

    assert maximum_response.status_code == 200

    maximum_profile = cast(
        ProfilePayload,
        maximum_response.json(),
    )

    assert maximum_profile["weekly_workout_goal"] == 7
    assert maximum_profile["preferred_workout_duration_minutes"] == 180


def test_update_profile_rejects_unauthenticated_request(
    client: TestClient,
) -> None:
    response = client.patch(
        "/api/v1/profile",
        json={
            "fitness_goal": "muscle_gain",
        },
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }
