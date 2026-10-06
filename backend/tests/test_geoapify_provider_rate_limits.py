import asyncio

import httpx2
import pytest

from fitmap.gyms.geoapify import GeoapifyGymProvider, GeoapifyProviderError


def test_search_nearby_does_not_retry_rate_limit_response() -> None:
    request_count = 0

    def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal request_count
        request_count += 1

        return httpx2.Response(
            429,
            request=request,
            headers={
                "Retry-After": "10",
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
                match=r"Geoapify Places API request failed\.",
            ):
                await provider.search_nearby(
                    latitude=-22.4708,
                    longitude=-43.8258,
                    radius_meters=5000,
                )

    asyncio.run(run_search())

    assert request_count == 1


def test_search_text_does_not_retry_geocoding_rate_limit_response() -> None:
    request_count = 0

    def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal request_count
        request_count += 1

        assert request.url.path == "/v1/geocode/search"

        return httpx2.Response(
            429,
            request=request,
            headers={
                "Retry-After": "10",
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
                match=r"Geoapify Geocoding API request failed\.",
            ):
                await provider.search_text(
                    query="Barra do Piraí, RJ",
                )

    asyncio.run(run_search())

    assert request_count == 1
