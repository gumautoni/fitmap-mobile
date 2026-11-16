from collections import OrderedDict
from threading import Lock
from time import monotonic

from fitmap.gyms.providers import Coordinates

_MAX_ENTRIES = 256


class LocationPlaceIdCache:
    def __init__(
        self,
        *,
        ttl_seconds: float = 300.0,
    ) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: OrderedDict[
            str,
            tuple[str, Coordinates | None, float],
        ] = OrderedDict()
        self._lock = Lock()

    def get(self, query: str) -> str | None:
        location = self.get_location(query)
        return location[0] if location is not None else None

    def get_location(
        self,
        query: str,
    ) -> tuple[str, Coordinates | None] | None:
        key = self._normalize_key(query)

        with self._lock:
            entry = self._entries.get(key)

            if entry is None:
                return None

            place_id, coordinates, expires_at = entry

            if monotonic() >= expires_at:
                del self._entries[key]
                return None

            self._entries.move_to_end(key)

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

        with self._lock:
            self._entries[key] = (
                place_id,
                coordinates,
                monotonic() + self._ttl_seconds,
            )

            self._entries.move_to_end(key)

            if len(self._entries) > _MAX_ENTRIES:
                self._entries.popitem(last=False)

    @staticmethod
    def _normalize_key(query: str) -> str:
        return query.strip().casefold()
