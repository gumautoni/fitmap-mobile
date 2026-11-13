from collections.abc import Iterator, Sequence
from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.api.progress import get_private_object_storage
from fitmap.identity.models import User
from fitmap.media.storage import ObjectNotFoundError, ObjectStorageError, StoredMedia
from fitmap.progress.models import ProgressPhoto


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
            "password": "Aa1!bcde",
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


def test_progress_photo_flush_failure_removes_stored_object(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)
    original_flush = Session.flush

    def fail_photo_flush(
        self: Session,
        objects: Sequence[object] | None = None,
    ) -> None:
        if any(isinstance(instance, ProgressPhoto) for instance in self.new):
            raise RuntimeError("Simulated progress photo flush failure")

        original_flush(self, objects=objects)

    with monkeypatch.context() as patch:
        patch.setattr(Session, "flush", fail_photo_flush)

        with pytest.raises(
            RuntimeError,
            match="Simulated progress photo flush failure",
        ):
            client.post(
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

    list_response = client.get(
        "/api/v1/progress/photos",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert private_storage.objects == {}


def test_progress_photo_post_commit_failure_preserves_stored_object(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)
    original_refresh = Session.refresh

    def fail_post_commit_photo_refresh(
        self: Session,
        instance: object,
    ) -> None:
        if isinstance(instance, ProgressPhoto) and not self.in_transaction():
            raise RuntimeError("Simulated post-commit refresh failure")

        original_refresh(self, instance)

    with monkeypatch.context() as patch:
        patch.setattr(
            Session,
            "refresh",
            fail_post_commit_photo_refresh,
        )

        try:
            response = client.post(
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
            assert response.status_code == 201
        except RuntimeError as exc:
            assert str(exc) == "Simulated post-commit refresh failure"

    list_response = client.get(
        "/api/v1/progress/photos",
        headers=headers,
    )

    assert list_response.status_code == 200

    photos = list_response.json()

    assert len(photos) == 1

    photo_id = photos[0]["id"]

    content_response = client.get(
        f"/api/v1/progress/photos/{photo_id}/content",
        headers=headers,
    )

    assert content_response.status_code == 200
    assert content_response.content == b"\xff\xd8\xffimage-data"
    assert len(private_storage.objects) == 1


@pytest.mark.parametrize(
    "cleanup_fails",
    [False, True],
    ids=["cleanup-succeeds", "cleanup-fails"],
)
def test_progress_photo_storage_failure_compensation(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    cleanup_fails: bool,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)

    original_put = private_storage.put_object

    def store_then_fail(
        *,
        key: str,
        data: bytes,
        media_type: str,
    ) -> None:
        original_put(
            key=key,
            data=data,
            media_type=media_type,
        )
        raise ObjectStorageError("Simulated storage failure")

    def fail_cleanup(*, key: str) -> None:
        raise ObjectStorageError("Simulated cleanup failure")

    with monkeypatch.context() as patch:
        patch.setattr(
            private_storage,
            "put_object",
            store_then_fail,
        )

        if cleanup_fails:
            patch.setattr(
                private_storage,
                "delete_object",
                fail_cleanup,
            )

        response = client.post(
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

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "media_storage_unavailable"

    list_response = client.get(
        "/api/v1/progress/photos",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []

    if cleanup_fails:
        assert len(private_storage.objects) == 1
        assert "Unable to clean up uncommitted progress photo." in caplog.text
    else:
        assert private_storage.objects == {}


@pytest.mark.parametrize(
    "failure_mode",
    [
        "rejected",
        "uncertain-before-commit",
        "uncertain-after-commit",
    ],
)
def test_progress_photo_commit_failure_consistency(
    client: TestClient,
    created_emails: list[str],
    private_storage: InMemoryPrivateObjectStorage,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    failure_mode: str,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)
    original_commit = Session.commit

    def fail_photo_commit(self: Session) -> None:
        has_photo = any(
            isinstance(instance, ProgressPhoto) for instance in self.identity_map.values()
        )

        if not has_photo:
            original_commit(self)
            return

        if failure_mode == "rejected":
            raise IntegrityError(
                "COMMIT",
                None,
                RuntimeError("Simulated integrity rejection"),
            )

        if failure_mode == "uncertain-after-commit":
            original_commit(self)

        raise RuntimeError("Simulated uncertain commit outcome")

    expected_error = IntegrityError if failure_mode == "rejected" else RuntimeError

    with monkeypatch.context() as patch:
        patch.setattr(
            Session,
            "commit",
            fail_photo_commit,
        )

        with pytest.raises(expected_error):
            client.post(
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

    list_response = client.get(
        "/api/v1/progress/photos",
        headers=headers,
    )

    assert list_response.status_code == 200

    photos = list_response.json()

    if failure_mode == "rejected":
        assert photos == []
        assert private_storage.objects == {}
        return

    assert len(private_storage.objects) == 1
    assert "Progress photo commit outcome uncertain; retaining media." in caplog.text

    if failure_mode == "uncertain-before-commit":
        assert photos == []
        return

    assert len(photos) == 1

    photo_id = photos[0]["id"]

    content_response = client.get(
        f"/api/v1/progress/photos/{photo_id}/content",
        headers=headers,
    )

    assert content_response.status_code == 200
    assert content_response.content == b"\xff\xd8\xffimage-data"
