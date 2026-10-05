import asyncio

import httpx2
import pytest

from fitmap.gyms.geoapify import GeoapifyGymProvider, GeoapifyProviderError


def test_search_nearby_normalizes_geoapify_results() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.params["categories"] == "sport.fitness.gym"
        assert request.url.params["filter"] == "circle:-43.8258,-22.4708,5000"
        assert request.url.params["bias"] == "proximity:-43.8258,-22.4708"
        assert request.url.params["limit"] == "20"
        assert request.url.params["lang"] == "pt"
        assert request.url.params["apiKey"] == "test-api-key"

        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "place_id": "geoapify-place-123",
                            "name": "Academia Teste",
                            "formatted": "Rua Teste, 123",
                            "lat": -22.4708,
                            "lon": -43.8258,
                        }
                    }
                ]
            },
        )

    async def run_search() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_nearby(
                latitude=-22.4708,
                longitude=-43.8258,
                radius_meters=5000,
            )

        assert len(results) == 1

        result = results[0]

        assert result.provider_name == "geoapify"
        assert result.external_id == "geoapify-place-123"
        assert result.name == "Academia Teste"
        assert result.address == "Rua Teste, 123"
        assert result.coordinates is not None
        assert result.coordinates.latitude == -22.4708
        assert result.coordinates.longitude == -43.8258

    asyncio.run(run_search())


def test_search_nearby_skips_result_without_name() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "place_id": "geoapify-place-without-name",
                            "formatted": None,
                            "lat": -22.4708,
                            "lon": -43.8258,
                        }
                    }
                ]
            },
        )

    async def run_search() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_nearby(
                latitude=-22.4708,
                longitude=-43.8258,
                radius_meters=5000,
            )

        assert results == []

    asyncio.run(run_search())


def test_search_nearby_converts_http_failure_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            503,
            request=request,
        )

    async def run_search() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(
                GeoapifyProviderError,
                match=r"Geoapify Places API request failed\.",
            ):
                await provider.search_nearby(
                    latitude=-22.4708,
                    longitude=-43.8258,
                    radius_meters=5000,
                )

    asyncio.run(run_search())


def test_search_nearby_converts_timeout_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectTimeout(
            "Geoapify timeout",
            request=request,
        )

    async def run_search() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(
                GeoapifyProviderError,
                match=r"Geoapify Places API request failed\.",
            ):
                await provider.search_nearby(
                    latitude=-22.4708,
                    longitude=-43.8258,
                    radius_meters=5000,
                )

    asyncio.run(run_search())
