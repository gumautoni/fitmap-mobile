from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, insert, select

from fitmap.gyms.models import Gym
from fitmap.gyms.review_models import GymReview
from fitmap.identity.models import User

API_PREFIX = "/api/v1"


@dataclass(frozen=True)
class AuthenticatedTestUser:
    user_id: UUID
    headers: dict[str, str]


@pytest.fixture
def gym_id(
    database_engine: Engine,
) -> Iterator[UUID]:
    value = uuid4()

    with database_engine.begin() as connection:
        connection.execute(
            insert(Gym).values(
                id=value,
                name="Gym Review HTTP Test",
                address="Rua de Teste, 100",
            )
        )

    try:
        yield value
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(Gym).where(Gym.id == value))


@pytest.fixture
def created_emails(
    database_engine: Engine,
    gym_id: UUID,
) -> Iterator[list[str]]:
    emails: list[str] = []

    try:
        yield emails
    finally:
        if emails:
            with database_engine.begin() as connection:
                connection.execute(delete(User).where(User.email.in_(emails)))


def register_user(
    *,
    client: TestClient,
    created_emails: list[str],
) -> AuthenticatedTestUser:
    email = f"gym-review-http-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "name": "Gym Review HTTP User",
            "email": email,
            "password": "123456789012345",
        },
    )

    assert response.status_code == 201

    payload = response.json()

    return AuthenticatedTestUser(
        user_id=UUID(payload["user"]["id"]),
        headers={"Authorization": (f"Bearer {payload['tokens']['access_token']}")},
    )


def create_review(
    *,
    client: TestClient,
    gym_id: UUID,
    identity: AuthenticatedTestUser,
    rating: int = 5,
    comment: str | None = "Boa academia.",
) -> dict[str, Any]:
    response = client.post(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=identity.headers,
        json={
            "rating": rating,
            "comment": comment,
        },
    )

    assert response.status_code == 201, response.text

    return cast(dict[str, Any], response.json())


def test_authenticated_user_creates_and_lists_review(
    client: TestClient,
    database_engine: Engine,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    url = f"{API_PREFIX}/gyms/{gym_id}/reviews"

    empty_response = client.get(
        url,
        headers=identity.headers,
    )

    assert empty_response.status_code == 200
    assert empty_response.json()["reviews"] == []
    assert empty_response.json()["summary"]["review_count"] == 0

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
    )

    assert review["rating"] == 5
    assert review["gym_id"] == str(gym_id)
    assert review["comment"] == "Boa academia."
    assert "user_id" not in review

    listing = client.get(
        url,
        headers=identity.headers,
    )

    assert listing.status_code == 200

    data = listing.json()

    assert len(data["reviews"]) == 1
    assert data["reviews"][0]["id"] == review["id"]
    assert data["summary"]["review_count"] == 1
    assert data["summary"]["average_rating"] == "5.00"

    with database_engine.connect() as connection:
        persisted_owner = connection.scalar(
            select(GymReview.user_id).where(GymReview.id == UUID(review["id"]))
        )

    assert persisted_owner == identity.user_id


def test_user_can_view_own_review(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    url = f"{API_PREFIX}/gyms/{gym_id}/reviews/mine"

    empty = client.get(
        url,
        headers=identity.headers,
    )

    assert empty.status_code == 200
    assert empty.json() is None

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
    )

    response = client.get(
        url,
        headers=identity.headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == review["id"]


def test_user_cannot_create_duplicate_active_review(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
    )

    duplicate = client.post(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=identity.headers,
        json={"rating": 3},
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == ("gym_review_already_exists")


def test_multiple_users_share_public_rating_aggregate(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    first = register_user(
        client=client,
        created_emails=created_emails,
    )
    second = register_user(
        client=client,
        created_emails=created_emails,
    )

    create_review(
        client=client,
        gym_id=gym_id,
        identity=first,
        rating=5,
    )

    create_review(
        client=client,
        gym_id=gym_id,
        identity=second,
        rating=4,
    )

    response = client.get(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=second.headers,
    )

    assert response.status_code == 200
    assert len(response.json()["reviews"]) == 2
    assert response.json()["summary"]["review_count"] == 2
    assert response.json()["summary"]["average_rating"] == "4.50"


def test_user_can_edit_own_review(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
    )

    response = client.patch(
        f"{API_PREFIX}/gyms/reviews/{review['id']}",
        headers=identity.headers,
        json={
            "rating": 3,
            "comment": "  Avaliacao atualizada.  ",
        },
    )

    assert response.status_code == 200
    assert response.json()["rating"] == 3
    assert response.json()["comment"] == "Avaliacao atualizada."

    summary = client.get(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=identity.headers,
    )

    assert summary.json()["summary"]["average_rating"] == "3.00"


def test_other_user_cannot_edit_or_remove_review(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    owner = register_user(
        client=client,
        created_emails=created_emails,
    )
    other = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=owner,
    )

    review_url = f"{API_PREFIX}/gyms/reviews/{review['id']}"

    update = client.patch(
        review_url,
        headers=other.headers,
        json={"rating": 1},
    )

    removal = client.delete(
        review_url,
        headers=other.headers,
    )

    assert update.status_code == 404
    assert removal.status_code == 404

    assert update.json()["error"]["code"] == ("gym_review_not_found")

    listing = client.get(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=owner.headers,
    )

    assert listing.json()["reviews"][0]["rating"] == 5


def test_soft_delete_hides_review_and_allows_replacement(
    client: TestClient,
    database_engine: Engine,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
    )

    review_url = f"{API_PREFIX}/gyms/reviews/{review['id']}"

    removal = client.delete(
        review_url,
        headers=identity.headers,
    )

    assert removal.status_code == 204
    assert removal.content == b""

    with database_engine.connect() as connection:
        removed_at = connection.scalar(
            select(GymReview.removed_at).where(GymReview.id == UUID(review["id"]))
        )

    assert removed_at is not None

    listing = client.get(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=identity.headers,
    )

    assert listing.status_code == 200
    assert listing.json()["reviews"] == []
    assert listing.json()["summary"]["review_count"] == 0
    assert listing.json()["summary"]["average_rating"] is None

    replacement = create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
        rating=4,
    )

    assert replacement["id"] != review["id"]


def test_user_can_report_another_users_written_review(
    client: TestClient,
    database_engine: Engine,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    author = register_user(
        client=client,
        created_emails=created_emails,
    )
    reporter = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=author,
    )

    report_url = f"{API_PREFIX}/gyms/reviews/{review['id']}/reports"

    response = client.post(
        report_url,
        headers=reporter.headers,
        json={
            "reason": "misleading",
            "details": "Informacao incorreta.",
        },
    )

    assert response.status_code == 201

    report = response.json()

    assert report["review_id"] == review["id"]
    assert report["reason"] == "misleading"
    assert "reporter_user_id" not in report

    duplicate = client.post(
        report_url,
        headers=reporter.headers,
        json={"reason": "spam"},
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == ("gym_review_already_reported")

    own_report = client.post(
        report_url,
        headers=author.headers,
        json={"reason": "spam"},
    )

    assert own_report.status_code == 403
    assert own_report.json()["error"]["code"] == ("gym_review_self_report_forbidden")


def test_rating_without_comment_cannot_be_reported(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    author = register_user(
        client=client,
        created_emails=created_emails,
    )
    reporter = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=author,
        comment=None,
    )

    response = client.post(
        f"{API_PREFIX}/gyms/reviews/{review['id']}/reports",
        headers=reporter.headers,
        json={"reason": "spam"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == ("gym_review_not_reportable")


def test_nonexistent_gym_returns_404(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    missing_id = uuid4()

    for method, suffix in [
        ("GET", ""),
        ("GET", "/mine"),
    ]:
        response = client.request(
            method,
            f"{API_PREFIX}/gyms/{missing_id}/reviews{suffix}",
            headers=identity.headers,
        )

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "gym_not_found"

    create_response = client.post(
        f"{API_PREFIX}/gyms/{missing_id}/reviews",
        headers=identity.headers,
        json={"rating": 5},
    )

    assert create_response.status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": "5"},
        {"rating": 3.5},
        {"rating": 5, "comment": "   "},
        {"rating": 5, "user_id": str(uuid4())},
    ],
)
def test_invalid_review_payload_returns_422(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
    payload: dict[str, object],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=identity.headers,
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == ("request_validation_error")


def test_invalid_review_update_returns_422(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    identity = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=identity,
    )

    response = client.patch(
        f"{API_PREFIX}/gyms/reviews/{review['id']}",
        headers=identity.headers,
        json={},
    )

    assert response.status_code == 422


def test_report_of_removed_review_returns_404(
    client: TestClient,
    gym_id: UUID,
    created_emails: list[str],
) -> None:
    author = register_user(
        client=client,
        created_emails=created_emails,
    )
    reporter = register_user(
        client=client,
        created_emails=created_emails,
    )

    review = create_review(
        client=client,
        gym_id=gym_id,
        identity=author,
    )

    removal = client.delete(
        f"{API_PREFIX}/gyms/reviews/{review['id']}",
        headers=author.headers,
    )

    assert removal.status_code == 204

    report = client.post(
        f"{API_PREFIX}/gyms/reviews/{review['id']}/reports",
        headers=reporter.headers,
        json={"reason": "spam"},
    )

    assert report.status_code == 404
    assert report.json()["error"]["code"] == ("gym_review_not_found")
