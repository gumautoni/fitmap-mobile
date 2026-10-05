from fitmap.gyms.cache import LocationPlaceIdCache


def test_location_place_id_cache_returns_stored_value() -> None:
    cache = LocationPlaceIdCache(
        ttl_seconds=300.0,
    )

    cache.set(
        "Barra do Piraí, RJ",
        "place-123",
    )

    assert cache.get("Barra do Piraí, RJ") == "place-123"


def test_location_place_id_cache_normalizes_query_key() -> None:
    cache = LocationPlaceIdCache(
        ttl_seconds=300.0,
    )

    cache.set(
        "Barra do Piraí, RJ",
        "place-123",
    )

    assert cache.get("  barra DO piraí, rj  ") == "place-123"


def test_location_place_id_cache_returns_none_for_unknown_query() -> None:
    cache = LocationPlaceIdCache(
        ttl_seconds=300.0,
    )

    assert cache.get("Volta Redonda, RJ") is None


def test_location_place_id_cache_expires_immediately_with_zero_ttl() -> None:
    cache = LocationPlaceIdCache(
        ttl_seconds=0.0,
    )

    cache.set(
        "Barra do Piraí, RJ",
        "place-123",
    )

    assert cache.get("Barra do Piraí, RJ") is None
