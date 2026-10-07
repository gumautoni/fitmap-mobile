import asyncio

import httpx2
import pytest

from fitmap.gyms.geoapify import GeoapifyGymProvider, GeoapifyProviderError


def test_search_nearby_normalizes_geoapify_results() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.params["categories"] == "sport.fitness.fitness_centre,sport.fitness.gym"
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


def test_search_text_geocodes_location_and_normalizes_gym_results() -> None:
    request_paths: list[str] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        request_paths.append(request.url.path)

        if request.url.path == "/v1/geocode/search":
            assert request.url.params["text"] == "Barra do Piraí, RJ"
            assert request.url.params["type"] == "locality"
            assert request.url.params["format"] == "json"
            assert request.url.params["limit"] == "1"
            assert request.url.params["lang"] == "pt"
            assert request.url.params["apiKey"] == "test-api-key"

            return httpx2.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "place_id": "location-place-123",
                        }
                    ]
                },
            )

        assert request.url.path == "/v2/places"
        assert request.url.params["categories"] == "sport.fitness.fitness_centre,sport.fitness.gym"
        assert request.url.params["filter"] == "place:location-place-123"
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
                            "place_id": "gym-place-123",
                            "name": "Academia Barra Fitness",
                            "formatted": "Barra do Piraí, RJ",
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

            results = await provider.search_text(
                query="  Barra do Piraí, RJ  ",
            )

        assert request_paths == [
            "/v1/geocode/search",
            "/v2/places",
        ]
        assert len(results) == 1

        result = results[0]

        assert result.provider_name == "geoapify"
        assert result.external_id == "gym-place-123"
        assert result.name == "Academia Barra Fitness"
        assert result.address == "Barra do Piraí, RJ"
        assert result.coordinates is not None
        assert result.coordinates.latitude == -22.4708
        assert result.coordinates.longitude == -43.8258

    asyncio.run(run_search())


def test_search_text_returns_empty_for_blank_query_without_request() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        pytest.fail(f"Unexpected external request: {request.url}")

    async def run_search() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_text(
                query="   ",
            )

        assert results == []

    asyncio.run(run_search())


def test_search_text_returns_empty_when_location_is_not_found() -> None:
    request_count = 0

    def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal request_count
        request_count += 1

        assert request.url.path == "/v1/geocode/search"

        return httpx2.Response(
            200,
            request=request,
            json={
                "results": [],
            },
        )

    async def run_search() -> None:
        transport = httpx2.MockTransport(handler)

        async with httpx2.AsyncClient(transport=transport) as client:
            provider = GeoapifyGymProvider(
                api_key="test-api-key",
                client=client,
            )

            results = await provider.search_text(
                query="Local inexistente",
            )

        assert results == []
        assert request_count == 1

    asyncio.run(run_search())


def test_search_text_converts_geocoding_failure_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/v1/geocode/search"

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
                match=r"Geoapify Geocoding API request failed\.",
            ):
                await provider.search_text(
                    query="Barra do Piraí, RJ",
                )

    asyncio.run(run_search())


def test_search_text_converts_places_failure_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path == "/v1/geocode/search":
            return httpx2.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "place_id": "location-place-123",
                        }
                    ]
                },
            )

        assert request.url.path == "/v2/places"

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
                await provider.search_text(
                    query="Barra do Piraí, RJ",
                )

    asyncio.run(run_search())


def test_get_details_normalizes_geoapify_details() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/v2/place-details"
        assert request.url.params["id"] == "geoapify-place-123"
        assert request.url.params["lang"] == "pt"
        assert request.url.params["apiKey"] == "test-api-key"

        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "feature_type": "details",
                            "name": "Academia Teste",
                            "formatted": "Rua Teste, 123",
                            "lat": -22.4708,
                            "lon": -43.8258,
                            "website": "https://academiateste.example",
                            "opening_hours": "Mo-Fr 06:00-22:00",
                            "contact": {
                                "phone": "+55 24 99999-9999",
                            },
                            "wiki_and_media": {
                                "image": "https://example.com/gym.jpg",
                            },
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

            details = await provider.get_details(
                external_id="geoapify-place-123",
            )

        assert details is not None
        assert details.provider_name == "geoapify"
        assert details.external_id == "geoapify-place-123"
        assert details.name == "Academia Teste"
        assert details.address == "Rua Teste, 123"
        assert details.coordinates is not None
        assert details.coordinates.latitude == -22.4708
        assert details.coordinates.longitude == -43.8258
        assert details.phone == "+55 24 99999-9999"
        assert details.website == "https://academiateste.example"
        assert details.opening_hours == ["Mo-Fr 06:00-22:00"]
        assert details.image_urls == ["https://example.com/gym.jpg"]
        assert details.amenities == []

    asyncio.run(run_details())


def test_get_details_preserves_unavailable_optional_data() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "feature_type": "details",
                            "name": "Academia Sem Dados Extras",
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

            details = await provider.get_details(
                external_id="geoapify-place-456",
            )

        assert details is not None
        assert details.external_id == "geoapify-place-456"
        assert details.name == "Academia Sem Dados Extras"
        assert details.address is None
        assert details.coordinates is None
        assert details.phone is None
        assert details.website is None
        assert details.opening_hours is None
        assert details.image_urls == []
        assert details.amenities == []

    asyncio.run(run_details())


def test_get_details_returns_none_without_details_feature() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            request=request,
            json={
                "features": [
                    {
                        "properties": {
                            "feature_type": "radius_500",
                            "name": "Ponto Próximo",
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

            details = await provider.get_details(
                external_id="geoapify-place-789",
            )

        assert details is None

    asyncio.run(run_details())


def test_get_details_converts_http_failure_to_provider_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            503,
            request=request,
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
                match=r"Geoapify Place Details API request failed\.",
            ):
                await provider.get_details(
                    external_id="geoapify-place-123",
                )

    asyncio.run(run_details())
