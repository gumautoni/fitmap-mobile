from fitmap.gyms.geoapify import GeoapifyGymProvider
from fitmap.gyms.providers import GymDetails, GymProviderError, GymSearchResult
from fitmap.gyms.tomtom import TomTomGymProvider

_TEXT_SEARCH_RADIUS_METERS = 10_000


class FallbackGymSearchProvider:
    def __init__(
        self,
        *,
        geoapify: GeoapifyGymProvider,
        tomtom: TomTomGymProvider | None,
    ) -> None:
        self._geoapify = geoapify
        self._tomtom = tomtom

    async def search_text(
        self,
        *,
        query: str,
    ) -> list[GymSearchResult]:
        geoapify_results, location = await self._geoapify.search_text_with_location(query=query)

        if location is None or self._tomtom is None:
            return geoapify_results

        try:
            tomtom_results = await self._tomtom.search_nearby(
                latitude=location.latitude,
                longitude=location.longitude,
                radius_meters=_TEXT_SEARCH_RADIUS_METERS,
            )
        except GymProviderError:
            if geoapify_results:
                return geoapify_results
            raise

        return tomtom_results or geoapify_results

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> list[GymSearchResult]:
        return await self._geoapify.search_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_meters=radius_meters,
        )

    async def get_details(
        self,
        *,
        external_id: str,
    ) -> GymDetails | None:
        return await self._geoapify.get_details(
            external_id=external_id,
        )
