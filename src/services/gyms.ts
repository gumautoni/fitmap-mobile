import { apiClient } from "./apiClient";

interface GymApiCoordinates {
  latitude: number;
  longitude: number;
}

interface GymApiSearchResult {
  provider_name: string;
  external_id: string;
  name: string;
  coordinates: GymApiCoordinates | null;
  address: string | null;
}

export interface GymSearchResult {
  id: string;
  name: string;
  coordinates: GymApiCoordinates | null;
  address: string | null;
}

function normalizeGymSearchResult(result: GymApiSearchResult): GymSearchResult {
  return {
    id: result.external_id,
    name: result.name,
    coordinates: result.coordinates,
    address: result.address,
  };
}

export async function searchGymsByLocation(
  query: string,
): Promise<GymSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(normalizedQuery);

  const results = await apiClient.get<GymApiSearchResult[]>(
    `/gyms/search?query=${encodedQuery}`,
  );

  return results.map(normalizeGymSearchResult);
}

export async function searchNearbyGyms(
  latitude: number,
  longitude: number,
  radiusMeters = 5_000,
): Promise<GymSearchResult[]> {
  const results = await apiClient.get<GymApiSearchResult[]>(
    `/gyms/nearby?latitude=${latitude}&longitude=${longitude}&radius_meters=${radiusMeters}`,
  );

  return results.map(normalizeGymSearchResult);
}
