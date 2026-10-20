import { apiClient } from "./apiClient";

export interface GymCoordinates {
  latitude: number;
  longitude: number;
}

interface GymApiSearchResult {
  provider_name: string;
  external_id: string;
  name: string;
  coordinates: GymCoordinates | null;
  address: string | null;
}

interface GymApiDetails extends GymApiSearchResult {
  phone: string | null;
  website: string | null;
  opening_hours: string[] | null;
  image_urls: string[];
  amenities: string[];
}

interface FavoriteGymApiResponse {
  id: string;
  gym_id: string;
  provider_name: string;
  external_id: string;
  name: string;
  coordinates: GymCoordinates | null;
  address: string | null;
  favorited_at: string;
}

export interface GymSearchResult {
  id: string;
  name: string;
  coordinates: GymCoordinates | null;
  address: string | null;
}

export interface GymDetails extends GymSearchResult {
  phone: string | null;
  website: string | null;
  openingHours: string[] | null;
  imageUrls: string[];
  amenities: string[];
}

export interface FavoriteGym {
  id: string;
  gymId: string;
  providerName: string;
  externalId: string;
  name: string;
  coordinates: GymCoordinates | null;
  address: string | null;
  favoritedAt: string;
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeGymSearchResult(result: GymApiSearchResult): GymSearchResult {
  return {
    id: result.external_id,
    name: result.name,
    coordinates: result.coordinates,
    address: result.address,
  };
}

function normalizeGymDetails(result: GymApiDetails): GymDetails {
  return {
    id: result.external_id,
    name: result.name,
    coordinates: result.coordinates,
    address: result.address,
    phone: result.phone,
    website: result.website,
    openingHours: result.opening_hours,
    imageUrls: result.image_urls,
    amenities: result.amenities,
  };
}

function normalizeFavoriteGym(result: FavoriteGymApiResponse): FavoriteGym {
  return {
    id: result.id,
    gymId: result.gym_id,
    providerName: result.provider_name,
    externalId: result.external_id,
    name: result.name,
    coordinates: result.coordinates,
    address: result.address,
    favoritedAt: result.favorited_at,
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

export async function getGymDetails(gymId: string): Promise<GymDetails> {
  const encodedGymId = encodeURIComponent(gymId);

  const result = await apiClient.get<GymApiDetails>(`/gyms/${encodedGymId}`);

  return normalizeGymDetails(result);
}

export async function getFavoriteGyms(
  accessToken: string,
): Promise<FavoriteGym[]> {
  const results = await apiClient.get<FavoriteGymApiResponse[]>(
    "/gyms/favorites",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return results.map(normalizeFavoriteGym);
}

export async function addFavoriteGym(
  accessToken: string,
  externalGymId: string,
): Promise<FavoriteGym> {
  const encodedGymId = encodeURIComponent(externalGymId);

  const result = await apiClient.post<FavoriteGymApiResponse>(
    `/gyms/${encodedGymId}/favorite`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeFavoriteGym(result);
}

export async function removeFavoriteGym(
  accessToken: string,
  gymId: string,
): Promise<void> {
  const encodedGymId = encodeURIComponent(gymId);

  await apiClient.delete<void>(`/gyms/favorites/${encodedGymId}`, {
    headers: buildAuthorizationHeaders(accessToken),
  });
}
