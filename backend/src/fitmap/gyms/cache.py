from time import monotonic

from fitmap.gyms.providers import Coordinates


class LocationPlaceIdCache:
    def __init__(
        self,
        *,
        ttl_seconds: float = 300.0,
    ) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[str, Coordinates | None, float]] = {}

    def get(self, query: str) -> str | None:
        location = self.get_location(query)
        return location[0] if location is not None else None

    def get_location(
        self,
        query: str,
    ) -> tuple[str, Coordinates | None] | None:
        key = self._normalize_key(query)
        entry = self._entries.get(key)

        if entry is None:
            return None

        place_id, coordinates, expires_at = entry

        if monotonic() >= expires_at:
            del self._entries[key]
            return None

        return place_id, coordinates

    def set(self, query: str, place_id: str) -> None:
        self.set_location(query, place_id, coordinates=None)

    def set_location(
        self,
        query: str,
        place_id: str,
        *,
        coordinates: Coordinates | None,
    ) -> None:
        key = self._normalize_key(query)

        self._entries[key] = (
            place_id,
            coordinates,
            monotonic() + self._ttl_seconds,
        )

    @staticmethod
    def _normalize_key(query: str) -> str:
        return query.strip().casefold()
