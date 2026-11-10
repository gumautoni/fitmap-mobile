import asyncio

import httpx2
import pytest
from fastapi.testclient import TestClient

from fitmap.api.gyms import get_location_autocomplete
from fitmap.config import Settings
from fitmap.gyms.location_autocomplete import (
    GeoapifyLocationAutocomplete,
    LocationSuggestion,
)
from fitmap.gyms.providers import Coordinates, GymProviderError
from fitmap.main import create_app


def test_geoapify_autocomplete_filters_and_normalizes_results() -> None:
    calls = 0

    def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal calls
        calls += 1

        assert request.url.path == "/v1/geocode/autocomplete"
        assert request.url.params["text"] == "Volta Red"
        assert request.url.params["type"] == "locality"
        assert request.url.params["filter"] == "countrycode:br"
        assert request.url.params["format"] == "json"
        assert request.url.params["limit"] == "5"
        assert request.url.params["lang"] == "pt"
        assert request.url.params["apiKey"] == "test-key"

        return httpx2.Response(
            200,
            json={
                "results": [
                    {
                        "result_type": "city",
                        "country_code": "br",
                        "formatted": "Volta Redonda, Rio de Janeiro, Brasil",
                        "lat": -22.52,
                        "lon": -44.1,
                    },
                    {
                        "result_type": "city",
                        "country_code": "BR",
                        "formatted": "Volta Redonda, Rio de Janeiro, Brasil",
                        "lat": -22.52,
                        "lon": -44.1,
                    },
                    {
                        "result_type": "suburb",
                        "country_code": "br",
                        "formatted": "Vila Santa, Volta Redonda, Brasil",
                        "lat": -22.51,
                        "lon": -44.09,
                    },
                    {
                        "result_type": "postcode",
                        "country_code": "br",
                        "formatted": "27200-000, Brasil",
                    },
                    {
                        "result_type": "city",
                        "country_code": "us",
                        "formatted": "Volta Redonda, EUA",
                    },
                    {
                        "result_type": "district",
                        "country_code": "br",
                        "formatted": "   ",
                    },
                ]
            },
        )

    async def execute() -> list[LocationSuggestion]:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = GeoapifyLocationAutocomplete(
                api_key="test-key",
                client=client,
            )
            return await provider.suggest(query="  Volta Red  ")

    result = asyncio.run(execute())

    assert calls == 1
    assert [item.model_dump() for item in result] == [
        {
            "label": "Volta Redonda, Rio de Janeiro, Brasil",
            "query": "Volta Redonda, Rio de Janeiro, Brasil",
            "coordinates": {
                "latitude": -22.52,
                "longitude": -44.1,
            },
        },
        {
            "label": "Vila Santa, Volta Redonda, Brasil",
            "query": "Vila Santa, Volta Redonda, Brasil",
            "coordinates": {
                "latitude": -22.51,
                "longitude": -44.09,
            },
        },
    ]


def test_autocomplete_short_query_makes_no_request() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        pytest.fail(f"Unexpected request: {request.url.path}")

    async def execute() -> list[LocationSuggestion]:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = GeoapifyLocationAutocomplete(
                api_key="test-key",
                client=client,
            )
            return await provider.suggest(query=" A ")

    assert asyncio.run(execute()) == []


@pytest.mark.parametrize(
    "status,body",
    [
        (503, {}),
        (200, {"results": "invalid"}),
    ],
)
def test_autocomplete_handles_provider_failures(
    status: int,
    body: dict[str, object],
) -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(status, json=body)

    async def execute() -> None:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = GeoapifyLocationAutocomplete(
                api_key="test-key",
                client=client,
            )
            with pytest.raises(GymProviderError):
                await provider.suggest(query="Volta")

    asyncio.run(execute())


class StubLocationAutocomplete:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.last_query: str | None = None

    async def suggest(
        self,
        *,
        query: str,
    ) -> list[LocationSuggestion]:
        self.last_query = query

        if self.fail:
            raise GymProviderError("upstream unavailable")

        return [
            LocationSuggestion(
                label="Volta Redonda, Rio de Janeiro, Brasil",
                query="Volta Redonda, Rio de Janeiro, Brasil",
                coordinates=Coordinates(
                    latitude=-22.52,
                    longitude=-44.1,
                ),
            )
        ]


def test_autocomplete_endpoint_returns_suggestions(
    test_settings: Settings,
) -> None:
    provider = StubLocationAutocomplete()
    application = create_app(test_settings)
    application.dependency_overrides[get_location_autocomplete] = lambda: provider

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/locations/suggest",
            params={"query": "  Volta Red  "},
        )

    assert response.status_code == 200
    assert response.json() == [
        {
            "label": "Volta Redonda, Rio de Janeiro, Brasil",
            "query": "Volta Redonda, Rio de Janeiro, Brasil",
            "coordinates": {
                "latitude": -22.52,
                "longitude": -44.1,
            },
        }
    ]
    assert provider.last_query == "Volta Red"


@pytest.mark.parametrize("query", ["A", "  "])
def test_autocomplete_endpoint_rejects_short_query(
    test_settings: Settings,
    query: str,
) -> None:
    provider = StubLocationAutocomplete()
    application = create_app(test_settings)
    application.dependency_overrides[get_location_autocomplete] = lambda: provider

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/locations/suggest",
            params={"query": query},
        )

    assert response.status_code == 422
    assert provider.last_query is None


def test_autocomplete_endpoint_handles_upstream_failure(
    test_settings: Settings,
) -> None:
    provider = StubLocationAutocomplete(fail=True)
    application = create_app(test_settings)
    application.dependency_overrides[get_location_autocomplete] = lambda: provider

    with TestClient(application) as client:
        response = client.get(
            "/api/v1/gyms/locations/suggest",
            params={"query": "Volta"},
        )

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "location_suggestions_unavailable",
            "message": "Location suggestions are unavailable.",
        }
    }


def test_autocomplete_ignores_locations_without_coordinates() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            json={
                "results": [
                    {
                        "result_type": "city",
                        "country_code": "br",
                        "formatted": "Cidade sem coordenadas, Brasil",
                    },
                    {
                        "result_type": "suburb",
                        "country_code": "br",
                        "formatted": "Bairro com latitude apenas, Brasil",
                        "lat": -22.51,
                    },
                    {
                        "result_type": "suburb",
                        "country_code": "br",
                        "formatted": "Centro, Volta Redonda, RJ, Brasil",
                        "lat": -22.512419,
                        "lon": -44.0905846,
                    },
                ]
            },
        )

    async def execute() -> list[LocationSuggestion]:
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as client:
            provider = GeoapifyLocationAutocomplete(
                api_key="test-key",
                client=client,
            )
            return await provider.suggest(query="Centro, Volta Redonda")

    results = asyncio.run(execute())

    assert [item.model_dump() for item in results] == [
        {
            "label": "Centro, Volta Redonda, RJ, Brasil",
            "query": "Centro, Volta Redonda, RJ, Brasil",
            "coordinates": {
                "latitude": -22.512419,
                "longitude": -44.0905846,
            },
        }
    ]
