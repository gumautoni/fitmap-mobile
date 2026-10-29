from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.config import Settings
from fitmap.identity.models import (
    AuthRefreshToken,
    AuthSession,
    User,
)
from fitmap.identity.security import (
    decode_access_token,
    hash_refresh_token,
)


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


def _register_user(
    *,
    client: TestClient,
    created_emails: list[str],
) -> AuthPayload:
    email = f"user-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "FitMap User",
            "email": email,
            "password": "Aa1!bcde",
        },
    )

    assert response.status_code == 201

    return cast(
        AuthPayload,
        response.json(),
    )


def test_me_returns_authenticated_user(
    client: TestClient,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": (f"Bearer {registered['tokens']['access_token']}")},
    )

    assert response.status_code == 200

    current_user = cast(
        UserPayload,
        response.json(),
    )

    assert current_user["id"] == registered["user"]["id"]
    assert current_user["name"] == "FitMap User"
    assert current_user["email"] == registered["user"]["email"]


def test_me_rejects_request_without_access_token(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/auth/me",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_me_rejects_invalid_access_token(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": "Bearer invalid-access-token",
        },
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_logout_revokes_session_and_refresh_token_persistently(
    client: TestClient,
    database_engine: Engine,
    test_settings: Settings,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    access_token = registered["tokens"]["access_token"]
    refresh_token = registered["tokens"]["refresh_token"]

    claims = decode_access_token(
        access_token,
        test_settings,
    )

    response = client.post(
        "/api/v1/auth/logout",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert response.status_code == 204
    assert response.content == b""

    with database_engine.connect() as connection:
        session_revoked_at = connection.scalar(
            select(AuthSession.revoked_at).where(
                AuthSession.id == claims.session_id,
            )
        )

        refresh_revoked_at = connection.scalar(
            select(AuthRefreshToken.revoked_at).where(
                AuthRefreshToken.token_hash == hash_refresh_token(refresh_token),
            )
        )

    assert session_revoked_at is not None
    assert refresh_revoked_at is not None


def test_logout_immediately_invalidates_access_and_refresh_tokens(
    client: TestClient,
    created_emails: list[str],
) -> None:
    registered = _register_user(
        client=client,
        created_emails=created_emails,
    )

    access_token = registered["tokens"]["access_token"]
    refresh_token = registered["tokens"]["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert logout_response.status_code == 204

    me_response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert me_response.status_code == 401
    assert me_response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert refresh_response.status_code == 401
    assert refresh_response.json() == {
        "error": {
            "code": "invalid_refresh_token",
            "message": "Invalid refresh token.",
        }
    }
