from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.identity.models import User


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
        UserPayload,
        response.json(),
    )

    assert profile["id"] == authentication["user"]["id"]
    assert profile["name"] == authentication["user"]["name"]
    assert profile["email"] == authentication["user"]["email"]
    assert profile["created_at"] == authentication["user"]["created_at"]


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
        UserPayload,
        response.json(),
    )

    assert profile["id"] == authentication["user"]["id"]
    assert profile["name"] == "Gustavo Mautoni"
    assert profile["email"] == authentication["user"]["email"]

    with database_engine.connect() as connection:
        persisted_name = connection.scalar(
            select(User.name).where(
                User.email == authentication["user"]["email"],
            )
        )

    assert persisted_name == "Gustavo Mautoni"


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

    response = client.patch(
        "/api/v1/profile",
        headers=authorization_headers(first_user),
        json={
            "name": "Updated First User",
        },
    )

    assert response.status_code == 200

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

    assert first_name == "Updated First User"
    assert second_name == "Second User"

    second_profile_response = client.get(
        "/api/v1/profile",
        headers=authorization_headers(second_user),
    )

    assert second_profile_response.status_code == 200
    assert second_profile_response.json()["name"] == "Second User"


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


def test_update_profile_rejects_unauthenticated_request(
    client: TestClient,
) -> None:
    response = client.patch(
        "/api/v1/profile",
        json={
            "name": "Unauthorized User",
        },
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }
