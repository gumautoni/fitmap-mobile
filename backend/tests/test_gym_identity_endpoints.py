from collections.abc import Iterator
from dataclasses import dataclass
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.api.gyms import get_gym_provider
from fitmap.gyms.models import (
    FavoriteGym,
    Gym,
    GymExternalReference,
)
from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProviderError,
    GymSearchResult,
)
from fitmap.identity.models import User

API_PREFIX = "/api/v1"


@dataclass(frozen=True)
class RegisteredUser:
    user_id: UUID
    headers: dict[str, str]


class StubGymProvider:
    def __init__(self) -> None:
        self.details: dict[str, GymDetails] = {}
        self.should_fail = False

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]:
        return []

    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]:
        return []

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None:
        if self.should_fail:
            raise GymProviderError("Test provider unavailable.")

        return self.details.get(external_id)


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture
def created_external_ids() -> Iterator[list[str]]:
    external_ids: list[str] = []
    yield external_ids


@pytest.fixture(autouse=True)
def cleanup_identity_records(
    database_engine: Engine,
    created_emails: list[str],
    created_external_ids: list[str],
) -> Iterator[None]:
    yield

    with database_engine.begin() as connection:
        if created_emails:
            connection.execute(delete(User).where(User.email.in_(created_emails)))

        if created_external_ids:
            gym_ids = select(GymExternalReference.gym_id).where(
                GymExternalReference.provider_name == "geoapify",
                GymExternalReference.external_id.in_(created_external_ids),
            )

            connection.execute(delete(Gym).where(Gym.id.in_(gym_ids)))


@pytest.fixture
def gym_provider(
    client: TestClient,
) -> Iterator[StubGymProvider]:
    provider = StubGymProvider()
    application = cast(FastAPI, client.app)

    def override_gym_provider() -> StubGymProvider:
        return provider

    application.dependency_overrides[get_gym_provider] = override_gym_provider

    try:
        yield provider
    finally:
        application.dependency_overrides.pop(
            get_gym_provider,
            None,
        )


def register_user(
    *,
    client: TestClient,
    created_emails: list[str],
) -> RegisteredUser:
    email = f"identity-test-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "name": "Gym Identity Test User",
            "email": email,
            "password": "Aa1!bcde",
        },
    )

    assert response.status_code == 201

    payload = response.json()

    return RegisteredUser(
        user_id=UUID(payload["user"]["id"]),
        headers={"Authorization": ("Bearer " + payload["tokens"]["access_token"])},
    )


def add_provider_gym(
    *,
    gym_provider: StubGymProvider,
    created_external_ids: list[str],
    external_id: str | None = None,
) -> str:
    gym_external_id = external_id or (f"identity-gym-{uuid4()}")

    created_external_ids.append(gym_external_id)

    gym_provider.details[gym_external_id] = GymDetails(
        provider_name="geoapify",
        external_id=gym_external_id,
        name="Identity Test Gym",
        coordinates=Coordinates(
            latitude=-22.4700,
            longitude=-43.8250,
        ),
        address="Rua de Teste, 100",
    )

    return gym_external_id


def resolve_identity(
    *,
    client: TestClient,
    external_id: str,
    user: RegisteredUser,
) -> dict[str, str]:
    response = client.post(
        f"{API_PREFIX}/gyms/{external_id}/identity",
        headers=user.headers,
    )

    assert response.status_code == 200, response.text

    payload = response.json()

    assert payload["provider_name"] == "geoapify"
    assert payload["external_id"] == external_id
    assert UUID(payload["gym_id"])

    return cast(dict[str, str], payload)


def test_identity_requires_authentication(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_external_ids: list[str],
) -> None:
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    response = client.post(f"{API_PREFIX}/gyms/{external_id}/identity")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == ("invalid_access_token")


def test_identity_creates_persistent_gym_and_reference(
    client: TestClient,
    database_engine: Engine,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    result = resolve_identity(
        client=client,
        external_id=external_id,
        user=user,
    )

    gym_id = UUID(result["gym_id"])

    with database_engine.connect() as connection:
        gym = connection.execute(
            select(
                Gym.id,
                Gym.name,
                Gym.address,
            ).where(Gym.id == gym_id)
        ).one()

        references = connection.execute(
            select(
                GymExternalReference.gym_id,
                GymExternalReference.external_id,
            ).where(
                GymExternalReference.provider_name == "geoapify",
                GymExternalReference.external_id == external_id,
            )
        ).all()

        favorites = connection.scalars(
            select(FavoriteGym.id).where(
                FavoriteGym.gym_id == gym_id,
                FavoriteGym.user_id == user.user_id,
            )
        ).all()

    assert gym.id == gym_id
    assert gym.name == "Identity Test Gym"
    assert gym.address == "Rua de Teste, 100"
    assert len(references) == 1
    assert references[0].gym_id == gym_id
    assert references[0].external_id == external_id
    assert favorites == []


def test_repeated_identity_request_reuses_same_gym(
    client: TestClient,
    database_engine: Engine,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    first = resolve_identity(
        client=client,
        external_id=external_id,
        user=user,
    )
    second = resolve_identity(
        client=client,
        external_id=external_id,
        user=user,
    )

    assert first["gym_id"] == second["gym_id"]

    with database_engine.connect() as connection:
        references = connection.scalars(
            select(GymExternalReference.id).where(
                GymExternalReference.provider_name == "geoapify",
                GymExternalReference.external_id == external_id,
            )
        ).all()

    assert len(references) == 1


def test_different_users_share_same_gym_identity(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
    )
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    first = resolve_identity(
        client=client,
        external_id=external_id,
        user=first_user,
    )
    second = resolve_identity(
        client=client,
        external_id=external_id,
        user=second_user,
    )

    assert first["gym_id"] == second["gym_id"]


def test_identity_reuses_previously_favorited_gym(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    favorite_response = client.post(
        f"{API_PREFIX}/gyms/{external_id}/favorite",
        headers=user.headers,
    )

    assert favorite_response.status_code == 201

    favorite_gym_id = favorite_response.json()["gym_id"]

    identity = resolve_identity(
        client=client,
        external_id=external_id,
        user=user,
    )

    assert identity["gym_id"] == favorite_gym_id


def test_favorite_reuses_previously_resolved_identity(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    identity = resolve_identity(
        client=client,
        external_id=external_id,
        user=user,
    )

    favorite_response = client.post(
        f"{API_PREFIX}/gyms/{external_id}/favorite",
        headers=user.headers,
    )

    assert favorite_response.status_code == 201
    assert favorite_response.json()["gym_id"] == identity["gym_id"]


def test_gym_can_be_reviewed_without_being_favorite(
    client: TestClient,
    database_engine: Engine,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )
    external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    identity = resolve_identity(
        client=client,
        external_id=external_id,
        user=user,
    )

    gym_id = UUID(identity["gym_id"])

    review_response = client.post(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=user.headers,
        json={
            "rating": 5,
            "comment": "Muito boa academia.",
        },
    )

    assert review_response.status_code == 201
    assert review_response.json()["gym_id"] == str(gym_id)

    listing = client.get(
        f"{API_PREFIX}/gyms/{gym_id}/reviews",
        headers=user.headers,
    )

    assert listing.status_code == 200
    assert listing.json()["summary"]["review_count"] == 1
    assert listing.json()["summary"]["average_rating"] == "5.00"

    with database_engine.connect() as connection:
        favorites = connection.scalars(
            select(FavoriteGym.id).where(
                FavoriteGym.gym_id == gym_id,
                FavoriteGym.user_id == user.user_id,
            )
        ).all()

    assert favorites == []


def test_unknown_external_gym_returns_404(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_emails: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        (f"{API_PREFIX}/gyms/missing-{uuid4()}/identity"),
        headers=user.headers,
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == ("gym_not_found")


def test_provider_failure_returns_502(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_emails: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )

    gym_provider.should_fail = True

    response = client.post(
        (f"{API_PREFIX}/gyms/provider-failure-{uuid4()}/identity"),
        headers=user.headers,
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == ("gym_provider_unavailable")


def test_distinct_external_ids_have_distinct_identities(
    client: TestClient,
    gym_provider: StubGymProvider,
    created_emails: list[str],
    created_external_ids: list[str],
) -> None:
    user = register_user(
        client=client,
        created_emails=created_emails,
    )

    first_external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    second_external_id = add_provider_gym(
        gym_provider=gym_provider,
        created_external_ids=created_external_ids,
    )

    first = resolve_identity(
        client=client,
        external_id=first_external_id,
        user=user,
    )

    second = resolve_identity(
        client=client,
        external_id=second_external_id,
        user=user,
    )

    assert first["gym_id"] != second["gym_id"]
