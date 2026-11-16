from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal, TypedDict, cast
from uuid import UUID, uuid4

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.progress.models import ProgressPhoto
from fitmap.training.models import WorkoutSession

Collection = Literal["history", "photos"]

COLLECTIONS: tuple[Collection, ...] = (
    "history",
    "photos",
)

HISTORY_PATH = "/api/v1/training/history"
PHOTOS_PATH = "/api/v1/progress/photos"

BASE_DATE = datetime(2026, 10, 10, 12, tzinfo=UTC)

RECORD_COUNT = 55


class RegistrationUser(TypedDict):
    id: str


class RegistrationTokens(TypedDict):
    access_token: str


class RegistrationPayload(TypedDict):
    user: RegistrationUser
    tokens: RegistrationTokens


class PagePayload(TypedDict):
    items: list[dict[str, object]]
    next_cursor: str | None


@dataclass(frozen=True)
class PaginationUser:
    id: UUID
    headers: dict[str, str]


@dataclass(frozen=True)
class Dataset:
    owner: PaginationUser
    other: PaginationUser
    history_ids: list[str]
    photo_ids: list[str]
    foreign_history_id: str
    foreign_photo_id: str
    date_range_ids: list[str]


def collection_path(
    collection: Collection,
) -> str:
    if collection == "history":
        return HISTORY_PATH

    return PHOTOS_PATH


def collection_ids(
    dataset: Dataset,
    collection: Collection,
) -> list[str]:
    if collection == "history":
        return dataset.history_ids

    return dataset.photo_ids


@pytest.fixture
def created_emails(
    database_engine: Engine,
) -> Iterator[list[str]]:
    emails: list[str] = []

    try:
        yield emails
    finally:
        if emails:
            with database_engine.begin() as connection:
                connection.execute(delete(User).where(User.email.in_(emails)))


def register_user(
    client: TestClient,
    created_emails: list[str],
) -> PaginationUser:
    email = f"perf03-{uuid4()}@example.com"

    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Pagination Test User",
            "email": email,
            "password": "Aa1!bcde",
        },
    )

    assert response.status_code == 201

    payload = cast(
        RegistrationPayload,
        response.json(),
    )

    token = payload["tokens"]["access_token"]

    return PaginationUser(
        id=UUID(payload["user"]["id"]),
        headers={
            "Authorization": f"Bearer {token}",
        },
    )


def create_history_record(
    *,
    user_id: UUID,
    completed_at: datetime,
    started_at: datetime,
    name: str,
) -> WorkoutSession:
    return WorkoutSession(
        id=uuid4(),
        user_id=user_id,
        workout_name=name,
        status="completed",
        started_at=started_at,
        completed_at=completed_at,
    )


def create_photo_record(
    *,
    user_id: UUID,
    recorded_at: datetime,
) -> ProgressPhoto:
    return ProgressPhoto(
        id=uuid4(),
        user_id=user_id,
        storage_key=f"perf03/{user_id}/{uuid4()}.jpg",
        media_type="image/jpeg",
        recorded_at=recorded_at,
    )


@pytest.fixture
def dataset(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> Dataset:
    owner = register_user(
        client,
        created_emails,
    )

    other = register_user(
        client,
        created_emails,
    )

    history_order: list[tuple[datetime, datetime, UUID]] = []

    photo_order: list[tuple[datetime, UUID]] = []

    with Session(database_engine) as session:
        for index in range(RECORD_COUNT):
            completed_at = BASE_DATE + timedelta(days=index // 3)

            started_at = completed_at - timedelta(minutes=30 + index % 2)

            workout = create_history_record(
                user_id=owner.id,
                completed_at=completed_at,
                started_at=started_at,
                name=f"Treino {index}",
            )

            photo = create_photo_record(
                user_id=owner.id,
                recorded_at=completed_at,
            )

            history_order.append(
                (
                    completed_at,
                    started_at,
                    workout.id,
                )
            )

            photo_order.append((completed_at, photo.id))

            session.add_all([workout, photo])

        foreign_workout = create_history_record(
            user_id=other.id,
            completed_at=BASE_DATE,
            started_at=BASE_DATE - timedelta(hours=1),
            name="Foreign workout",
        )

        foreign_photo = create_photo_record(
            user_id=other.id,
            recorded_at=BASE_DATE,
        )

        foreign_history_id = str(foreign_workout.id)

        foreign_photo_id = str(foreign_photo.id)

        session.add_all(
            [
                foreign_workout,
                foreign_photo,
                WorkoutSession(
                    id=uuid4(),
                    user_id=owner.id,
                    workout_name="Active workout",
                    status="active",
                    started_at=BASE_DATE,
                ),
                WorkoutSession(
                    id=uuid4(),
                    user_id=owner.id,
                    workout_name="Cancelled workout",
                    status="cancelled",
                    started_at=BASE_DATE,
                    cancelled_at=BASE_DATE + timedelta(minutes=5),
                ),
            ]
        )

        session.commit()

    ordered_history = sorted(
        history_order,
        reverse=True,
    )

    ordered_photos = sorted(
        photo_order,
        reverse=True,
    )

    range_start = BASE_DATE + timedelta(days=1)
    range_end = BASE_DATE + timedelta(days=2)

    return Dataset(
        owner=owner,
        other=other,
        history_ids=[str(item[2]) for item in ordered_history],
        photo_ids=[str(item[1]) for item in ordered_photos],
        foreign_history_id=foreign_history_id,
        foreign_photo_id=foreign_photo_id,
        date_range_ids=[
            str(item[2]) for item in ordered_history if range_start <= item[0] < range_end
        ],
    )


def assert_page_status(
    response: httpx2.Response,
    expected: int,
) -> None:
    assert response.status_code != 404, (
        f"PERF03_ENDPOINT_MISSING: expected {expected}, observed 404"
    )

    assert response.status_code == expected


def read_page(
    response: httpx2.Response,
) -> PagePayload:
    assert_page_status(
        response,
        200,
    )

    payload = cast(
        PagePayload,
        response.json(),
    )

    assert set(payload) == {
        "items",
        "next_cursor",
    }

    assert isinstance(
        payload["items"],
        list,
    )

    return payload


def read_legacy(
    client: TestClient,
    dataset: Dataset,
    collection: Collection,
) -> list[dict[str, object]]:
    response = client.get(
        collection_path(collection),
        headers=dataset.owner.headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)

    return cast(
        list[dict[str, object]],
        response.json(),
    )


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
def test_legacy_contract_unchanged(
    client: TestClient,
    dataset: Dataset,
    collection: Collection,
) -> None:
    items = read_legacy(
        client,
        dataset,
        collection,
    )

    assert len(items) == RECORD_COUNT

    assert [item["id"] for item in items] == collection_ids(
        dataset,
        collection,
    )

    assert all("storage_key" not in item for item in items)


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
def test_paginated_traversal_matches_legacy(
    client: TestClient,
    dataset: Dataset,
    collection: Collection,
) -> None:
    path = collection_path(collection) + "/page"

    legacy = read_legacy(
        client,
        dataset,
        collection,
    )

    collected: list[dict[str, object]] = []

    cursor: str | None = None

    for _ in range(10):
        params = {"limit": "7"}

        if cursor is not None:
            params["cursor"] = cursor

        page = read_page(
            client.get(
                path,
                headers=dataset.owner.headers,
                params=params,
            )
        )

        items = page["items"]

        assert 1 <= len(items) <= 7

        collected.extend(items)

        cursor = page["next_cursor"]

        if cursor is None:
            break

        assert cursor == items[-1]["id"]

    assert cursor is None
    assert collected == legacy

    ids = [item["id"] for item in collected]

    assert len(ids) == RECORD_COUNT
    assert len(set(ids)) == RECORD_COUNT

    assert all("storage_key" not in item for item in collected)


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
def test_default_and_maximum_page_size(
    client: TestClient,
    dataset: Dataset,
    collection: Collection,
) -> None:
    path = collection_path(collection) + "/page"

    expected_ids = collection_ids(
        dataset,
        collection,
    )

    default_page = read_page(
        client.get(
            path,
            headers=dataset.owner.headers,
        )
    )

    assert len(default_page["items"]) == 50

    assert [item["id"] for item in default_page["items"]] == expected_ids[:50]

    assert default_page["next_cursor"] == expected_ids[49]

    maximum_page = read_page(
        client.get(
            path,
            headers=dataset.owner.headers,
            params={"limit": "100"},
        )
    )

    assert len(maximum_page["items"]) == RECORD_COUNT
    assert maximum_page["next_cursor"] is None


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
@pytest.mark.parametrize(
    "limit",
    ("0", "101", "invalid"),
)
def test_invalid_page_limit(
    client: TestClient,
    dataset: Dataset,
    collection: Collection,
    limit: str,
) -> None:
    response = client.get(
        collection_path(collection) + "/page",
        headers=dataset.owner.headers,
        params={"limit": limit},
    )

    assert_page_status(
        response,
        422,
    )

    assert response.json()["error"]["code"] == "request_validation_error"


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
def test_pagination_requires_authentication(
    client: TestClient,
    collection: Collection,
) -> None:
    response = client.get(collection_path(collection) + "/page")

    assert_page_status(
        response,
        401,
    )


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
def test_empty_collection_has_no_cursor(
    client: TestClient,
    created_emails: list[str],
    collection: Collection,
) -> None:
    user = register_user(
        client,
        created_emails,
    )

    page = read_page(
        client.get(
            collection_path(collection) + "/page",
            headers=user.headers,
        )
    )

    assert page == {
        "items": [],
        "next_cursor": None,
    }


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
@pytest.mark.parametrize(
    "cursor_kind",
    (
        "malformed",
        "unknown",
        "foreign",
        "wrong_collection",
    ),
)
def test_invalid_cursor_is_rejected(
    client: TestClient,
    dataset: Dataset,
    collection: Collection,
    cursor_kind: str,
) -> None:
    expected_code = "invalid_pagination_cursor"

    if cursor_kind == "malformed":
        cursor = "not-a-uuid"
        expected_code = "request_validation_error"

    elif cursor_kind == "unknown":
        cursor = str(uuid4())

    elif cursor_kind == "foreign":
        cursor = dataset.foreign_history_id if collection == "history" else dataset.foreign_photo_id

    else:
        cursor = dataset.photo_ids[0] if collection == "history" else dataset.history_ids[0]

    response = client.get(
        collection_path(collection) + "/page",
        headers=dataset.owner.headers,
        params={
            "limit": "7",
            "cursor": cursor,
        },
    )

    assert_page_status(
        response,
        422,
    )

    assert response.json()["error"]["code"] == expected_code


@pytest.mark.parametrize(
    "collection",
    COLLECTIONS,
)
def test_newer_insert_does_not_shift_next_page(
    client: TestClient,
    dataset: Dataset,
    database_engine: Engine,
    collection: Collection,
) -> None:
    path = collection_path(collection) + "/page"

    expected_ids = collection_ids(
        dataset,
        collection,
    )

    first = read_page(
        client.get(
            path,
            headers=dataset.owner.headers,
            params={"limit": "7"},
        )
    )

    cursor = first["next_cursor"]

    assert cursor is not None
    assert cursor == expected_ids[6]

    newer = BASE_DATE + timedelta(days=30)

    with Session(database_engine) as session:
        if collection == "history":
            session.add(
                create_history_record(
                    user_id=dataset.owner.id,
                    completed_at=newer,
                    started_at=newer - timedelta(minutes=30),
                    name="Newer workout",
                )
            )

        else:
            session.add(
                create_photo_record(
                    user_id=dataset.owner.id,
                    recorded_at=newer,
                )
            )

        session.commit()

    second = read_page(
        client.get(
            path,
            headers=dataset.owner.headers,
            params={
                "limit": "7",
                "cursor": cursor,
            },
        )
    )

    assert [item["id"] for item in second["items"]] == expected_ids[7:14]

    assert second["next_cursor"] == expected_ids[13]


def test_history_date_range_is_half_open(
    client: TestClient,
    dataset: Dataset,
) -> None:
    path = HISTORY_PATH + "/page"

    params = {
        "limit": "2",
        "completed_from": ("2026-10-11T09:00:00-03:00"),
        "completed_before": ("2026-10-12T09:00:00-03:00"),
    }

    first = read_page(
        client.get(
            path,
            headers=dataset.owner.headers,
            params=params,
        )
    )

    assert [item["id"] for item in first["items"]] == dataset.date_range_ids[:2]

    cursor = first["next_cursor"]

    assert cursor is not None

    second = read_page(
        client.get(
            path,
            headers=dataset.owner.headers,
            params={
                **params,
                "cursor": cursor,
            },
        )
    )

    assert [item["id"] for item in second["items"]] == dataset.date_range_ids[2:]

    assert second["next_cursor"] is None


@pytest.mark.parametrize(
    ("completed_from", "completed_before"),
    (
        (
            "2026-10-11T12:00:00",
            "2026-10-12T12:00:00Z",
        ),
        (
            "2026-10-12T12:00:00Z",
            "2026-10-11T12:00:00Z",
        ),
        (
            "2026-10-11T12:00:00Z",
            "2026-10-11T12:00:00Z",
        ),
    ),
)
def test_invalid_history_date_range(
    client: TestClient,
    dataset: Dataset,
    completed_from: str,
    completed_before: str,
) -> None:
    response = client.get(
        HISTORY_PATH + "/page",
        headers=dataset.owner.headers,
        params={
            "completed_from": completed_from,
            "completed_before": completed_before,
        },
    )

    assert_page_status(
        response,
        422,
    )

    assert response.json()["error"]["code"] == "request_validation_error"


def test_history_cursor_outside_date_range(
    client: TestClient,
    dataset: Dataset,
) -> None:
    response = client.get(
        HISTORY_PATH + "/page",
        headers=dataset.owner.headers,
        params={
            "cursor": dataset.history_ids[0],
            "completed_from": ("2026-10-10T12:00:00Z"),
            "completed_before": ("2026-10-11T12:00:00Z"),
        },
    )

    assert_page_status(
        response,
        422,
    )

    assert response.json()["error"]["code"] == "invalid_pagination_cursor"
