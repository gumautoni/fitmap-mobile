from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from fitmap.api.gyms import (
    get_gym_provider,
    get_tomtom_provider,
)
from fitmap.config import Settings
from fitmap.gyms.models import Gym, GymExternalReference
from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProviderError,
    GymSearchResult,
)
from fitmap.identity.models import User
from fitmap.main import create_app

API_PREFIX = "/api/v1"


class StubProvider:
    def __init__(self, name: str) -> None:
        self.name = name
        self.results: list[GymSearchResult] = []
        self.details: dict[str, GymDetails] = {}
        self.nearby_calls = 0
        self.details_calls = 0
        self.should_fail = False

    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]:
        return []

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]:
        self.nearby_calls += 1

        if self.should_fail:
            raise GymProviderError("Simulated provider failure.")

        return self.results

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None:
        self.details_calls += 1

        if self.should_fail:
            raise GymProviderError("Simulated provider failure.")

        return self.details.get(external_id)


def create_test_app(
    settings: Settings,
    geoapify: StubProvider,
    tomtom: StubProvider | None,
) -> FastAPI:
    app = create_app(settings)
    app.dependency_overrides[get_gym_provider] = lambda: geoapify
    app.dependency_overrides[get_tomtom_provider] = lambda: tomtom
    return app


def make_gym(
    *,
    provider_name: str,
    external_id: str,
) -> GymDetails:
    return GymDetails(
        provider_name=provider_name,
        external_id=external_id,
        name=f"Academia {provider_name}",
        coordinates=Coordinates(
            latitude=-22.47034,
            longitude=-43.82633,
        ),
        address="Barra do Pira?, RJ",
    )


def test_default_nearby_preserves_geoapify(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")

    gym = make_gym(
        provider_name="geoapify",
        external_id="existing-gym",
    )

    geoapify.results = [gym]

    app = create_test_app(test_settings, geoapify, tomtom)

    with TestClient(app) as client:
        response = client.get(
            f"{API_PREFIX}/gyms/nearby",
            params={
                "latitude": -22.47034,
                "longitude": -43.82633,
            },
        )

    assert response.status_code == 200
    assert response.json()[0]["provider_name"] == "geoapify"
    assert response.json()[0]["external_id"] == "existing-gym"
    assert geoapify.nearby_calls == 1
    assert tomtom.nearby_calls == 0


def test_explicit_tomtom_nearby_uses_tomtom(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")

    gym = make_gym(
        provider_name="tomtom",
        external_id="tomtom-gym-1",
    )

    tomtom.results = [gym]

    app = create_test_app(test_settings, geoapify, tomtom)

    with TestClient(app) as client:
        response = client.get(
            f"{API_PREFIX}/gyms/nearby",
            params={
                "latitude": -22.47034,
                "longitude": -43.82633,
                "provider_name": "tomtom",
            },
        )

    assert response.status_code == 200
    assert response.json()[0]["provider_name"] == "tomtom"
    assert response.json()[0]["external_id"] == "tomtom-gym-1"
    assert geoapify.nearby_calls == 0
    assert tomtom.nearby_calls == 1


def test_details_route_preserves_provider_identity(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")

    shared_id = "same-external-id"

    geoapify.details[shared_id] = make_gym(
        provider_name="geoapify",
        external_id=shared_id,
    )

    tomtom.details[shared_id] = make_gym(
        provider_name="tomtom",
        external_id=shared_id,
    )

    app = create_test_app(test_settings, geoapify, tomtom)

    with TestClient(app) as client:
        legacy = client.get(
            f"{API_PREFIX}/gyms/{shared_id}",
        )

        explicit = client.get(
            f"{API_PREFIX}/gyms/{shared_id}",
            params={"provider_name": "tomtom"},
        )

    assert legacy.status_code == 200
    assert explicit.status_code == 200
    assert legacy.json()["provider_name"] == "geoapify"
    assert explicit.json()["provider_name"] == "tomtom"
    assert geoapify.details_calls == 1
    assert tomtom.details_calls == 1


def test_unconfigured_tomtom_returns_controlled_error(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")

    app = create_test_app(test_settings, geoapify, None)

    with TestClient(app) as client:
        nearby = client.get(
            f"{API_PREFIX}/gyms/nearby",
            params={
                "latitude": -22.47034,
                "longitude": -43.82633,
                "provider_name": "tomtom",
            },
        )

        details = client.get(
            f"{API_PREFIX}/gyms/tomtom-123",
            params={"provider_name": "tomtom"},
        )

    assert nearby.status_code == 503
    assert details.status_code == 503
    assert nearby.json()["error"]["code"] == "gym_provider_unavailable"
    assert details.json()["error"]["code"] == "gym_provider_unavailable"


def test_unknown_provider_name_is_rejected(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")

    app = create_test_app(test_settings, geoapify, tomtom)

    with TestClient(app) as client:
        response = client.get(
            f"{API_PREFIX}/gyms/nearby",
            params={
                "latitude": -22.47034,
                "longitude": -43.82633,
                "provider_name": "unknown",
            },
        )

    assert response.status_code == 422
    assert geoapify.nearby_calls == 0
    assert tomtom.nearby_calls == 0


def test_tomtom_failure_maps_to_controlled_error(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")
    tomtom.should_fail = True

    app = create_test_app(test_settings, geoapify, tomtom)

    with TestClient(app) as client:
        response = client.get(
            f"{API_PREFIX}/gyms/nearby",
            params={
                "latitude": -22.47034,
                "longitude": -43.82633,
                "provider_name": "tomtom",
            },
        )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "gym_provider_unavailable"
    assert geoapify.nearby_calls == 0


def test_provider_identity_mismatch_is_rejected(
    test_settings: Settings,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")

    tomtom.details["expected-id"] = make_gym(
        provider_name="geoapify",
        external_id="expected-id",
    )

    app = create_test_app(test_settings, geoapify, tomtom)

    with TestClient(app) as client:
        response = client.get(
            f"{API_PREFIX}/gyms/expected-id",
            params={"provider_name": "tomtom"},
        )

    assert response.status_code == 502


def test_tomtom_identity_favorites_and_reviews(
    test_settings: Settings,
    database_engine: Engine,
) -> None:
    geoapify = StubProvider("geoapify")
    tomtom = StubProvider("tomtom")

    external_id = f"tomtom-route-{uuid4()}"
    email = f"tomtom-route-{uuid4()}@example.com"

    tomtom.details[external_id] = make_gym(
        provider_name="tomtom",
        external_id=external_id,
    )

    app = create_test_app(test_settings, geoapify, tomtom)

    try:
        with TestClient(app) as client:
            registration = client.post(
                f"{API_PREFIX}/auth/register",
                json={
                    "name": "TomTom Route Test",
                    "email": email,
                    "password": "Aa1!bcde",
                },
            )

            assert registration.status_code == 201

            access_token = registration.json()["tokens"]["access_token"]

            headers = {
                "Authorization": f"Bearer {access_token}",
            }

            identity = client.post(
                f"{API_PREFIX}/gyms/{external_id}/identity",
                params={"provider_name": "tomtom"},
                headers=headers,
            )

            assert identity.status_code == 200
            assert identity.json()["provider_name"] == "tomtom"
            assert identity.json()["external_id"] == external_id

            gym_id = identity.json()["gym_id"]
            assert UUID(gym_id)

            favorite = client.post(
                f"{API_PREFIX}/gyms/{external_id}/favorite",
                params={"provider_name": "tomtom"},
                headers=headers,
            )

            assert favorite.status_code == 201
            assert favorite.json()["gym_id"] == gym_id
            assert favorite.json()["provider_name"] == "tomtom"
            assert favorite.json()["external_id"] == external_id

            listing = client.get(
                f"{API_PREFIX}/gyms/favorites",
                headers=headers,
            )

            assert listing.status_code == 200
            assert any(item["gym_id"] == gym_id for item in listing.json())

            review = client.post(
                f"{API_PREFIX}/gyms/{gym_id}/reviews",
                headers=headers,
                json={
                    "rating": 5,
                    "comment": "Academia testada.",
                },
            )

            assert review.status_code == 201
            assert review.json()["gym_id"] == gym_id

            duplicated = client.post(
                f"{API_PREFIX}/gyms/{external_id}/favorite",
                params={"provider_name": "tomtom"},
                headers=headers,
            )

            assert duplicated.status_code == 409
            assert duplicated.json()["error"]["code"] == ("favorite_gym_already_exists")

    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email == email))

            gym_ids = select(GymExternalReference.gym_id).where(
                GymExternalReference.provider_name == "tomtom",
                GymExternalReference.external_id == external_id,
            )

            connection.execute(delete(Gym).where(Gym.id.in_(gym_ids)))
