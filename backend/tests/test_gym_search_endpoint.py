from fastapi import FastAPI
from fastapi.testclient import TestClient

from fitmap.api.gyms import get_gym_provider
from fitmap.config import Settings
from fitmap.gyms.providers import (
    Coordinates,
    GymDetails,
    GymProvider,
    GymProviderError,
    GymSearchResult,
)
from fitmap.main import create_app


class StubGymProvider:
    def __init__(
        self,
        *,
        search_results: list[GymSearchResult] | None = None,
    ) -> None:
        self.search_results = search_results or []
        self.last_text_query: str | None = None
        self.last_nearby_search: tuple[float, float, int] | None = None

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]:
        self.last_nearby_search = (
            latitude,
            longitude,
            radius_meters,
        )
        return self.search_results

    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]:
        self.last_text_query = query
        return self.search_results

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None:
        return None


class FailingGymProvider(StubGymProvider):
    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]:
        raise GymProviderError("Provider unavailable.")

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]:
        raise GymProviderError("Provider unavailable.")


def create_test_application(
    *,
    settings: Settings,
    provider: GymProvider,
) -> FastAPI:
    application = create_app(settings)
    application.dependency_overrides[get_gym_provider] = lambda: provider

    return application


def test_search_gyms_returns_normalized_results(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider(
        search_results=[
            GymSearchResult(
                provider_name="geoapify",
                external_id="gym-123",
                name="Academia Central",
                coordinates=Coordinates(
                    latitude=-22.4708,
                    longitude=-43.8250,
                ),
                address="Barra do Piraí, RJ, Brasil",
            )
        ]
    )

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/search",
            params={"query": "Barra do Piraí"},
        )

    assert response.status_code == 200
    assert response.json() == [
        {
            "provider_name": "geoapify",
            "external_id": "gym-123",
            "name": "Academia Central",
            "coordinates": {
                "latitude": -22.4708,
                "longitude": -43.825,
            },
            "address": "Barra do Piraí, RJ, Brasil",
        }
    ]
    assert provider.last_text_query == "Barra do Piraí"


def test_search_gyms_trims_location_query(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/search",
            params={"query": "  Barra do Piraí  "},
        )

    assert response.status_code == 200
    assert response.json() == []
    assert provider.last_text_query == "Barra do Piraí"


def test_search_gyms_rejects_blank_location_query(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/search",
            params={"query": "   "},
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }
    assert provider.last_text_query is None


def test_search_gyms_returns_empty_list_when_no_gyms_are_found(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/search",
            params={"query": "Local sem academias"},
        )

    assert response.status_code == 200
    assert response.json() == []


def test_search_gyms_returns_controlled_error_when_provider_fails(
    test_settings: Settings,
) -> None:
    provider = FailingGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/search",
            params={"query": "Barra do Piraí"},
        )

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "gym_provider_unavailable",
            "message": "Gym provider is unavailable.",
        }
    }


def test_search_nearby_gyms_returns_normalized_results(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider(
        search_results=[
            GymSearchResult(
                provider_name="geoapify",
                external_id="gym-nearby-123",
                name="Academia Próxima",
                coordinates=Coordinates(
                    latitude=-22.4710,
                    longitude=-43.8240,
                ),
                address="Barra do Piraí, RJ, Brasil",
            )
        ]
    )

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/nearby",
            params={
                "latitude": -22.4708,
                "longitude": -43.8250,
            },
        )

    assert response.status_code == 200
    assert response.json() == [
        {
            "provider_name": "geoapify",
            "external_id": "gym-nearby-123",
            "name": "Academia Próxima",
            "coordinates": {
                "latitude": -22.471,
                "longitude": -43.824,
            },
            "address": "Barra do Piraí, RJ, Brasil",
        }
    ]
    assert provider.last_nearby_search == (
        -22.4708,
        -43.825,
        5000,
    )


def test_search_nearby_gyms_accepts_custom_radius(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/nearby",
            params={
                "latitude": -22.4708,
                "longitude": -43.8250,
                "radius_meters": 10000,
            },
        )

    assert response.status_code == 200
    assert response.json() == []
    assert provider.last_nearby_search == (
        -22.4708,
        -43.825,
        10000,
    )


def test_search_nearby_gyms_rejects_invalid_coordinates(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/nearby",
            params={
                "latitude": 91,
                "longitude": -43.8250,
            },
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }
    assert provider.last_nearby_search is None


def test_search_nearby_gyms_rejects_invalid_radius(
    test_settings: Settings,
) -> None:
    provider = StubGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/nearby",
            params={
                "latitude": -22.4708,
                "longitude": -43.8250,
                "radius_meters": 50,
            },
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }
    assert provider.last_nearby_search is None


def test_search_nearby_gyms_returns_controlled_error_when_provider_fails(
    test_settings: Settings,
) -> None:
    provider = FailingGymProvider()

    application = create_test_application(
        settings=test_settings,
        provider=provider,
    )

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/nearby",
            params={
                "latitude": -22.4708,
                "longitude": -43.8250,
            },
        )

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "gym_provider_unavailable",
            "message": "Gym provider is unavailable.",
        }
    }
