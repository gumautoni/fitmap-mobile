import asyncio

import httpx2
import pytest

from fitmap.gyms.geoapify import GeoapifyGymProvider, GeoapifyProviderError


def test_search_nearby_converts_invalid_json_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            request=request,
            content=b"invalid-json",
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
                match=r"Geoapify Places API returned invalid response data\.",
            ):
                await provider.search_nearby(
                    latitude=-22.4708,
                    longitude=-43.8258,
                    radius_meters=5000,
                )

    asyncio.run(run_search())


def test_search_text_converts_invalid_geocoding_payload_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/v1/geocode/search"

        return httpx2.Response(
            200,
            request=request,
            json={
                "results": "invalid",
            },
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
                match=(r"Geoapify Geocoding API returned invalid response data\."),
            ):
                await provider.search_text(
                    query="Barra do Piraí, RJ",
                )

    asyncio.run(run_search())


def test_get_details_converts_invalid_coordinates_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "feature_type": "details",
                            "name": "Academia Inválida",
                            "lat": 999,
                            "lon": -43.8258,
                        }
                    }
                ]
            },
        )

    async def run_details() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            with pytest.raises(
                GeoapifyProviderError,
                match=(r"Geoapify Place Details API returned invalid response data\."),
            ):
                await provider.get_details(
                    external_id="geoapify-place-invalid",
                )

    asyncio.run(run_details())
