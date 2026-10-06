from time import monotonic


class LocationPlaceIdCache:
    def __init__(
        self,
        *,
        ttl_seconds: float = 300.0,
    ) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[str, float]] = {}

    def get(self, query: str) -> str | None:
        key = self._normalize_key(query)
        entry = self._entries.get(key)

        if entry is None:
            return None

        place_id, expires_at = entry

        if monotonic() >= expires_at:
            del self._entries[key]
            return None

        return place_id

    def set(
        self,
        query: str,
        place_id: str,
    ) -> None:
        key = self._normalize_key(query)

        self._entries[key] = (
            place_id,
            monotonic() + self._ttl_seconds,
        )

    @staticmethod
    def _normalize_key(query: str) -> str:
        return query.strip().casefold()
