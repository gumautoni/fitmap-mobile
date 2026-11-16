from types import SimpleNamespace

import httpx2
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from fitmap.api import gyms as gyms_api
from fitmap.config import Settings
from fitmap.gyms import cache as cache_module
from fitmap.gyms.cache import LocationPlaceIdCache
from fitmap.gyms.config import (
    GymProviderSettings,
    TomTomProviderSettings,
)
from fitmap.gyms.providers import Coordinates
from fitmap.main import create_app

SEARCH_PATH = "/api/v1/gyms/search"
NEARBY_PATH = "/api/v1/gyms/nearby"
CACHE_TTL_SECONDS = 300.0
CACHE_MAX_ENTRIES = 256


class ManualClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class ProviderHarness:
    def __init__(self) -> None:
        self.geocoding_queries: list[str] = []
        self.places_filters: list[str] = []
        self.tomtom_requests = 0
        self.clients_created = 0
        self.geocoding_status = 200
        self.tomtom_status = 200
        self.empty_location = False
        self.vary_places = False
        self.tomtom_enabled = False

    def create_client(self) -> httpx2.AsyncClient:
        self.clients_created += 1

        return httpx2.AsyncClient(
            transport=httpx2.MockTransport(self.handle),
        )

    def handle(
        self,
        request: httpx2.Request,
    ) -> httpx2.Response:
        path = request.url.path

        if request.url.host == "api.geoapify.com" and path == "/v1/geocode/search":
            assert request.method == "GET"

            query = request.url.params["text"]

            self.geocoding_queries.append(query)

            if self.geocoding_status != 200:
                return httpx2.Response(
                    self.geocoding_status,
                    request=request,
                    json={},
                )

            if self.empty_location:
                return httpx2.Response(
                    200,
                    request=request,
                    json={"results": []},
                )

            return httpx2.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "place_id": f"location-{query.strip().casefold()}",
                            "lat": -22.47,
                            "lon": -43.82,
                        }
                    ]
                },
            )

        if request.url.host == "api.geoapify.com" and path == "/v2/places":
            assert request.method == "GET"

            location_filter = request.url.params["filter"]

            self.places_filters.append(location_filter)

            if self.vary_places:
                external_id = f"gym-{len(self.places_filters)}"
            elif location_filter.startswith("circle:"):
                external_id = "gym-nearby"
            else:
                assert location_filter.startswith("place:")

                place_id = location_filter.removeprefix("place:")

                external_id = f"gym-{place_id}"

            return httpx2.Response(
                200,
                request=request,
                json={
                    "features": [
                        {
                            "properties": {
                                "place_id": external_id,
                                "name": "Synthetic Fitness Center",
                                "formatted": "Synthetic address",
                                "lat": -22.47,
                                "lon": -43.82,
                            }
                        }
                    ]
                },
            )

        if request.url.host == "api.tomtom.com" and path == "/maps/orbis/places/discover":
            assert request.method == "POST"

            self.tomtom_requests += 1

            if self.tomtom_status != 200:
                return httpx2.Response(
                    self.tomtom_status,
                    request=request,
                    json={},
                )

            return httpx2.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "id": "tomtom-gym-123",
                            "type": "poi",
                            "title": "Synthetic TomTom Gym",
                            "position": {
                                "coordinates": [-43.82, -22.47],
                            },
                            "poiTypes": [
                                {"id": "fitness_center"},
                            ],
                        }
                    ]
                },
            )

        raise AssertionError(f"Unexpected external request: {path}")


@pytest.fixture
def provider_harness(
    monkeypatch: pytest.MonkeyPatch,
) -> ProviderHarness:
    harness = ProviderHarness()

    # Replace only the API module's client constructor.
    # The actual provider implementations still execute.
    monkeypatch.setattr(
        gyms_api,
        "httpx2",
        SimpleNamespace(
            AsyncClient=harness.create_client,
        ),
    )

    def geoapify_settings() -> GymProviderSettings:
        return GymProviderSettings(
            api_key=SecretStr("test-api-key"),
            timeout_seconds=5.0,
        )

    def tomtom_settings() -> TomTomProviderSettings:
        return TomTomProviderSettings(
            api_key=(SecretStr("test-tomtom-key") if harness.tomtom_enabled else None),
            timeout_seconds=10.0,
        )

    monkeypatch.setattr(
        gyms_api,
        "get_gym_provider_settings",
        geoapify_settings,
    )

    monkeypatch.setattr(
        gyms_api,
        "get_tomtom_provider_settings",
        tomtom_settings,
    )

    return harness


@pytest.fixture
def manual_clock(
    monkeypatch: pytest.MonkeyPatch,
) -> ManualClock:
    clock = ManualClock()

    monkeypatch.setattr(
        cache_module,
        "monotonic",
        clock,
    )

    return clock


def assert_search(
    client: TestClient,
    query: str,
    *,
    expected_id: str,
    expected_provider: str = "geoapify",
) -> None:
    response = client.get(
        SEARCH_PATH,
        params={"query": query},
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 1
    assert payload[0]["external_id"] == expected_id
    assert payload[0]["provider_name"] == expected_provider


def assert_geocoding_budget(
    harness: ProviderHarness,
    expected: int,
) -> None:
    actual = len(harness.geocoding_queries)

    assert actual == expected, (
        f"PERF02_CACHE_REUSE: expected {expected} geocoding calls, observed {actual}"
    )


def test_reuses_location_across_five_http_requests(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    application = create_app(test_settings)

    queries = (
        "Alpha",
        "  alpha  ",
        "ALPHA",
        "aLpHa",
        " Alpha ",
    )

    with TestClient(application) as client:
        for query in queries:
            assert_search(
                client,
                query,
                expected_id="gym-location-alpha",
            )

    assert provider_harness.places_filters == ["place:location-alpha"] * 5

    assert_geocoding_budget(
        provider_harness,
        expected=1,
    )


def test_caches_distinct_locations_independently(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    application = create_app(test_settings)

    with TestClient(application) as client:
        for query, expected_id in (
            ("Alpha", "gym-location-alpha"),
            ("Beta", "gym-location-beta"),
            ("ALPHA", "gym-location-alpha"),
            ("BETA", "gym-location-beta"),
        ):
            assert_search(
                client,
                query,
                expected_id=expected_id,
            )

    assert provider_harness.places_filters == [
        "place:location-alpha",
        "place:location-beta",
        "place:location-alpha",
        "place:location-beta",
    ]

    assert_geocoding_budget(
        provider_harness,
        expected=2,
    )


def test_shared_cache_expires_at_ttl_boundary(
    provider_harness: ProviderHarness,
    manual_clock: ManualClock,
    test_settings: Settings,
) -> None:
    application = create_app(test_settings)

    with TestClient(application) as client:
        assert_search(
            client,
            "Alpha",
            expected_id="gym-location-alpha",
        )

        manual_clock.advance(CACHE_TTL_SECONDS - 1)

        assert_search(
            client,
            "ALPHA",
            expected_id="gym-location-alpha",
        )

        assert_geocoding_budget(
            provider_harness,
            expected=1,
        )

        manual_clock.advance(1)

        assert_search(
            client,
            "alpha",
            expected_id="gym-location-alpha",
        )

    assert_geocoding_budget(
        provider_harness,
        expected=2,
    )

    assert len(provider_harness.places_filters) == 3


def test_cache_isolated_between_application_instances(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    first_app = create_app(test_settings)
    second_app = create_app(test_settings)

    with TestClient(first_app) as client:
        assert_search(
            client,
            "Alpha",
            expected_id="gym-location-alpha",
        )

    with TestClient(second_app) as client:
        assert_search(
            client,
            "Alpha",
            expected_id="gym-location-alpha",
        )

    assert_geocoding_budget(
        provider_harness,
        expected=2,
    )

    assert len(provider_harness.places_filters) == 2


def test_missing_location_is_not_cached(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    application = create_app(test_settings)

    with TestClient(application) as client:
        provider_harness.empty_location = True

        first = client.get(
            SEARCH_PATH,
            params={"query": "Alpha"},
        )

        assert first.status_code == 200
        assert first.json() == []

        provider_harness.empty_location = False

        assert_search(
            client,
            "Alpha",
            expected_id="gym-location-alpha",
        )

    assert_geocoding_budget(
        provider_harness,
        expected=2,
    )

    assert len(provider_harness.places_filters) == 1


def test_geocoding_error_is_not_cached(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    application = create_app(test_settings)

    with TestClient(application) as client:
        provider_harness.geocoding_status = 503

        first = client.get(
            SEARCH_PATH,
            params={"query": "Alpha"},
        )

        assert first.status_code == 502

        provider_harness.geocoding_status = 200

        assert_search(
            client,
            "Alpha",
            expected_id="gym-location-alpha",
        )

    assert_geocoding_budget(
        provider_harness,
        expected=2,
    )

    assert len(provider_harness.places_filters) == 1


def test_places_results_remain_fresh_on_cache_hit(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    provider_harness.vary_places = True

    application = create_app(test_settings)

    with TestClient(application) as client:
        assert_search(
            client,
            "Alpha",
            expected_id="gym-1",
        )

        assert_search(
            client,
            "ALPHA",
            expected_id="gym-2",
        )

    assert len(provider_harness.places_filters) == 2

    assert_geocoding_budget(
        provider_harness,
        expected=1,
    )


def test_shared_location_preserves_tomtom_fallback(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    provider_harness.tomtom_enabled = True

    application = create_app(test_settings)

    with TestClient(application) as client:
        assert_search(
            client,
            "Alpha",
            expected_id="tomtom-gym-123",
            expected_provider="tomtom",
        )

        provider_harness.tomtom_status = 503

        assert_search(
            client,
            "ALPHA",
            expected_id="gym-location-alpha",
        )

        provider_harness.tomtom_status = 200

        assert_search(
            client,
            "alpha",
            expected_id="tomtom-gym-123",
            expected_provider="tomtom",
        )

    assert provider_harness.tomtom_requests == 3
    assert len(provider_harness.places_filters) == 3

    assert_geocoding_budget(
        provider_harness,
        expected=1,
    )


def test_nearby_search_remains_uncached(
    provider_harness: ProviderHarness,
    test_settings: Settings,
) -> None:
    application = create_app(test_settings)

    with TestClient(application) as client:
        for _ in range(2):
            response = client.get(
                NEARBY_PATH,
                params={
                    "latitude": -22.47,
                    "longitude": -43.82,
                    "radius_meters": 5000,
                    "provider_name": "geoapify",
                },
            )

            assert response.status_code == 200
            assert len(response.json()) == 1
            assert response.json()[0]["external_id"] == "gym-nearby"

    assert provider_harness.geocoding_queries == []
    assert provider_harness.places_filters == ["circle:-43.82,-22.47,5000"] * 2


def test_cache_capacity_evicts_least_recently_used(
    manual_clock: ManualClock,
) -> None:
    cache = LocationPlaceIdCache()

    for index in range(CACHE_MAX_ENTRIES):
        cache.set(
            f"location-{index}",
            f"place-{index}",
        )

    # Reading the first entry makes it recently used.
    assert cache.get("location-0") == "place-0"

    cache.set(
        f"location-{CACHE_MAX_ENTRIES}",
        f"place-{CACHE_MAX_ENTRIES}",
    )

    assert cache.get("location-0") == "place-0"

    assert cache.get("location-1") is None, (
        "PERF02_CACHE_CAPACITY: least recently used entry was not evicted"
    )

    assert cache.get("location-2") == "place-2"

    assert cache.get(f"location-{CACHE_MAX_ENTRIES}") == f"place-{CACHE_MAX_ENTRIES}"


def test_cache_read_does_not_extend_original_ttl(
    manual_clock: ManualClock,
) -> None:
    cache = LocationPlaceIdCache(
        ttl_seconds=CACHE_TTL_SECONDS,
    )

    coordinates = Coordinates(
        latitude=-22.47,
        longitude=-43.82,
    )

    cache.set_location(
        "Alpha",
        "place-alpha",
        coordinates=coordinates,
    )

    manual_clock.advance(CACHE_TTL_SECONDS - 1)

    assert cache.get_location("ALPHA") == (
        "place-alpha",
        coordinates,
    )

    manual_clock.advance(1)

    assert cache.get_location("Alpha") is None
    assert cache.get("Alpha") is None
