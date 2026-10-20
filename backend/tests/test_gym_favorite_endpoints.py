from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.api.gyms import get_gym_provider
from fitmap.gyms.models import FavoriteGym, Gym, GymExternalReference
from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProviderError,
    GymSearchResult,
)
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
            raise GymProviderError("Provider unavailable.")

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
def cleanup_favorite_endpoint_records(
    database_engine: Engine,
    created_emails: list[str],
    created_external_ids: list[str],
) -> Iterator[None]:
    yield

    with database_engine.begin() as connection:
        if created_emails:
            connection.execute(
                delete(User).where(
                    User.email.in_(created_emails),
                )
            )

        if created_external_ids:
            gym_ids = select(GymExternalReference.gym_id).where(
                GymExternalReference.external_id.in_(
                    created_external_ids,
                )
            )

            connection.execute(
                delete(Gym).where(
                    Gym.id.in_(gym_ids),
                )
            )


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
    name: str = "Favorite API User",
) -> AuthPayload:
    email = f"favorite-api-{uuid4()}@example.com"
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


def add_provider_gym(
    *,
    provider: StubGymProvider,
    created_external_ids: list[str],
    external_id: str,
    name: str = "Favorite API Gym",
) -> None:
    created_external_ids.append(external_id)

    provider.details[external_id] = GymDetails(
        provider_name="geoapify",
        external_id=external_id,
        name=name,
        coordinates=Coordinates(
            latitude=-22.4700,
            longitude=-43.8250,
        ),
        address="Rua de Teste, 100",
        phone=None,
        website=None,
        opening_hours=None,
        image_urls=[],
        amenities=[],
    )


def test_favorite_list_requires_authentication(
    client: TestClient,
    gym_provider: StubGymProvider,
) -> None:
    response = client.get(
        "/api/v1/gyms/favorites",
    )

    assert response.status_code == 401


def test_authenticated_user_can_add_and_list_favorite_gym(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    created_external_ids: list[str],
    gym_provider: StubGymProvider,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)
    external_id = f"gym-{uuid4()}"

    add_provider_gym(
        provider=gym_provider,
        created_external_ids=created_external_ids,
        external_id=external_id,
    )

    create_response = client.post(
        f"/api/v1/gyms/{external_id}/favorite",
        headers=headers,
    )

    assert create_response.status_code == 201

    favorite = create_response.json()

    assert UUID(favorite["id"])
    assert UUID(favorite["gym_id"])
    assert favorite["provider_name"] == "geoapify"
    assert favorite["external_id"] == external_id
    assert favorite["name"] == "Favorite API Gym"
    assert favorite["address"] == "Rua de Teste, 100"
    assert favorite["coordinates"] == {
        "latitude": -22.4700,
        "longitude": -43.8250,
    }

    list_response = client.get(
        "/api/v1/gyms/favorites",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == [favorite]

    with database_engine.connect() as connection:
        persisted_user_id = connection.scalar(
            select(FavoriteGym.user_id).where(
                FavoriteGym.id == UUID(favorite["id"]),
            )
        )

    assert persisted_user_id == UUID(
        authentication["user"]["id"],
    )


def test_user_cannot_add_duplicate_favorite(
    client: TestClient,
    created_emails: list[str],
    created_external_ids: list[str],
    gym_provider: StubGymProvider,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)
    external_id = f"duplicate-{uuid4()}"

    add_provider_gym(
        provider=gym_provider,
        created_external_ids=created_external_ids,
        external_id=external_id,
    )

    first_response = client.post(
        f"/api/v1/gyms/{external_id}/favorite",
        headers=headers,
    )

    assert first_response.status_code == 201

    duplicate_response = client.post(
        f"/api/v1/gyms/{external_id}/favorite",
        headers=headers,
    )

    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {
        "error": {
            "code": "favorite_gym_already_exists",
            "message": "Gym is already in favorites.",
        }
    }


def test_favorites_are_isolated_between_users(
    client: TestClient,
    created_emails: list[str],
    created_external_ids: list[str],
    gym_provider: StubGymProvider,
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
        name="First Favorite User",
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Second Favorite User",
    )
    external_id = f"isolated-{uuid4()}"

    add_provider_gym(
        provider=gym_provider,
        created_external_ids=created_external_ids,
        external_id=external_id,
    )

    create_response = client.post(
        f"/api/v1/gyms/{external_id}/favorite",
        headers=authorization_headers(first_user),
    )

    assert create_response.status_code == 201

    second_list_response = client.get(
        "/api/v1/gyms/favorites",
        headers=authorization_headers(second_user),
    )

    assert second_list_response.status_code == 200
    assert second_list_response.json() == []


def test_user_can_remove_own_favorite_without_deleting_gym(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    created_external_ids: list[str],
    gym_provider: StubGymProvider,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    headers = authorization_headers(authentication)
    external_id = f"remove-{uuid4()}"

    add_provider_gym(
        provider=gym_provider,
        created_external_ids=created_external_ids,
        external_id=external_id,
    )

    create_response = client.post(
        f"/api/v1/gyms/{external_id}/favorite",
        headers=headers,
    )

    assert create_response.status_code == 201

    favorite = create_response.json()
    gym_id = UUID(favorite["gym_id"])

    delete_response = client.delete(
        f"/api/v1/gyms/favorites/{gym_id}",
        headers=headers,
    )

    assert delete_response.status_code == 204
    assert delete_response.content == b""

    list_response = client.get(
        "/api/v1/gyms/favorites",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []

    with database_engine.connect() as connection:
        persisted_gym_id = connection.scalar(
            select(Gym.id).where(
                Gym.id == gym_id,
            )
        )
        persisted_reference_id = connection.scalar(
            select(GymExternalReference.id).where(
                GymExternalReference.gym_id == gym_id,
            )
        )

    assert persisted_gym_id == gym_id
    assert persisted_reference_id is not None


def test_user_cannot_remove_another_users_favorite(
    client: TestClient,
    created_emails: list[str],
    created_external_ids: list[str],
    gym_provider: StubGymProvider,
) -> None:
    owner = register_user(
        client=client,
        created_emails=created_emails,
        name="Favorite Owner",
    )
    other_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Other Favorite User",
    )
    external_id = f"ownership-{uuid4()}"

    add_provider_gym(
        provider=gym_provider,
        created_external_ids=created_external_ids,
        external_id=external_id,
    )

    create_response = client.post(
        f"/api/v1/gyms/{external_id}/favorite",
        headers=authorization_headers(owner),
    )

    assert create_response.status_code == 201

    gym_id = create_response.json()["gym_id"]

    delete_response = client.delete(
        f"/api/v1/gyms/favorites/{gym_id}",
        headers=authorization_headers(other_user),
    )

    assert delete_response.status_code == 404
    assert delete_response.json() == {
        "error": {
            "code": "favorite_gym_not_found",
            "message": "Favorite gym was not found.",
        }
    }

    owner_list_response = client.get(
        "/api/v1/gyms/favorites",
        headers=authorization_headers(owner),
    )

    assert owner_list_response.status_code == 200
    assert len(owner_list_response.json()) == 1


def test_favorite_creation_rejects_unknown_external_gym(
    client: TestClient,
    created_emails: list[str],
    gym_provider: StubGymProvider,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        f"/api/v1/gyms/missing-{uuid4()}/favorite",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "gym_not_found",
            "message": "Gym details were not found.",
        }
    }


def test_favorite_creation_handles_provider_failure(
    client: TestClient,
    created_emails: list[str],
    gym_provider: StubGymProvider,
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    gym_provider.should_fail = True

    response = client.post(
        f"/api/v1/gyms/provider-failure-{uuid4()}/favorite",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "gym_provider_unavailable",
            "message": "Gym provider is unavailable.",
        }
    }
