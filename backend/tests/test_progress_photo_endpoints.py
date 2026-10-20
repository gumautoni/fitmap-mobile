from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete

from fitmap.api.progress import get_private_object_storage
from fitmap.identity.models import User
from fitmap.media.storage import ObjectNotFoundError, StoredMedia


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


class InMemoryPrivateObjectStorage:
    def __init__(self) -> None:
        self.objects: dict[str, StoredMedia] = {}

    def put_object(
        self,
        *,
        key: str,
        data: bytes,
        media_type: str,
    ) -> None:
        self.objects[key] = StoredMedia(
            data=data,
            media_type=media_type,
        )

    def get_object(
        self,
        *,
        key: str,
    ) -> StoredMedia:
        media = self.objects.get(key)

        if media is None:
            raise ObjectNotFoundError("Private media was not found.")

        return media

    def delete_object(
        self,
        *,
        key: str,
    ) -> None:
        self.objects.pop(key, None)


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture(autouse=True)
def cleanup_progress_photo_endpoint_records(
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


@pytest.fixture
def private_storage(
    client: TestClient,
) -> Iterator[InMemoryPrivateObjectStorage]:
    storage = InMemoryPrivateObjectStorage()
    application = cast(FastAPI, client.app)

    def override_private_object_storage() -> InMemoryPrivateObjectStorage:
        return storage

    application.dependency_overrides[get_private_object_storage] = override_private_object_storage

    try:
        yield storage
    finally:
        application.dependency_overrides.pop(
            get_private_object_storage,
            None,
        )


def register_user(
    *,
    client: TestClient,
    created_emails: list[str],
    name: str = "Progress Photo API User",
) -> AuthPayload:
    email = f"progress-photo-api-{uuid4()}@example.com"
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
        "Authorization": f"Bearer {authentication['tokens']['access_token']}",
    }


def test_progress_photo_upload_requires_authentication(
    client: TestClient,
    private_storage: InMemoryPrivateObjectStorage,
) -> None:
    response = client.post(
        "/api/v1/progress/photos",
        data={
            "recorded_at": "2026-10-17T18:00:00Z",
        },
        files={
            "photo": (
                "progress.jpg",
                b"\xff\xd8\xffimage-data",
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 401
    assert private_storage.objects == {}


def test_user_can_upload_list_and_view_own_progress_photo(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    upload_response = client.post(
        "/api/v1/progress/photos",
        headers=headers,
        data={
            "recorded_at": "2026-10-17T18:00:00Z",
        },
        files={
            "photo": (
                "progress.jpg",
                b"\xff\xd8\xffimage-data",
                "image/jpeg",
            )
        },
    )

    assert upload_response.status_code == 201

    uploaded_photo = upload_response.json()

    assert uploaded_photo["workout_session_id"] is None
    assert uploaded_photo["media_type"] == "image/jpeg"
    assert "storage_key" not in uploaded_photo

    progress_photo_id = uploaded_photo["id"]

    list_response = client.get(
        "/api/v1/progress/photos",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == [uploaded_photo]

    content_response = client.get(
        f"/api/v1/progress/photos/{progress_photo_id}/content",
        headers=headers,
    )

    assert content_response.status_code == 200
    assert content_response.content == b"\xff\xd8\xffimage-data"
    assert content_response.headers["content-type"] == "image/jpeg"
    assert content_response.headers["cache-control"] == "private, no-store"
    assert len(private_storage.objects) == 1


def test_progress_photos_are_isolated_between_users(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
        name="First Progress Photo User",
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Second Progress Photo User",
    )

    upload_response = client.post(
        "/api/v1/progress/photos",
        headers=authorization_headers(first_user),
        data={
            "recorded_at": "2026-10-17T18:00:00Z",
        },
        files={
            "photo": (
                "progress.png",
                b"\x89PNG\r\n\x1a\nimage-data",
                "image/png",
            )
        },
    )

    assert upload_response.status_code == 201

    progress_photo_id = upload_response.json()["id"]
    second_user_headers = authorization_headers(second_user)

    list_response = client.get(
        "/api/v1/progress/photos",
        headers=second_user_headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []

    content_response = client.get(
        f"/api/v1/progress/photos/{progress_photo_id}/content",
        headers=second_user_headers,
    )

    assert content_response.status_code == 404
    assert content_response.json() == {
        "error": {
            "code": "progress_photo_not_found",
            "message": "Progress photo was not found.",
        }
    }


def test_invalid_progress_photo_is_not_stored(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        "/api/v1/progress/photos",
        headers=authorization_headers(authentication),
        data={
            "recorded_at": "2026-10-17T18:00:00Z",
        },
        files={
            "photo": (
                "progress.jpg",
                b"not-a-jpeg",
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "invalid_progress_photo",
            "message": "Image content does not match its media type.",
        }
    }
    assert private_storage.objects == {}
