import type { GymCoordinates, GymSearchResult } from "../services/gyms";
import { calculateDistanceKm } from "./distance";

export type GymDistanceFilter = 1 | 3 | 5 | null;

export interface GymResultFilters {
  nameQuery: string;
  maxDistanceKm: GymDistanceFilter;
}

export const DEFAULT_GYM_RESULT_FILTERS: GymResultFilters = {
  nameQuery: "",
  maxDistanceKm: null,
};

const DISTANCE_COMPARISON_TOLERANCE_KM = 1e-9;

function normalizeGymName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function hasValidGymCoordinates(
  coordinates: GymCoordinates | null,
): coordinates is GymCoordinates {
  if (coordinates === null) {
    return false;
  }

  const { latitude, longitude } = coordinates;

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getGymDistanceKm(
  origin: GymCoordinates | null,
  destination: GymCoordinates | null,
): number | null {
  if (!hasValidGymCoordinates(origin) || !hasValidGymCoordinates(destination)) {
    return null;
  }

  const distance = calculateDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

export function filterGymResults(
  gyms: readonly GymSearchResult[],
  filters: GymResultFilters,
  userCoordinates: GymCoordinates | null,
): GymSearchResult[] {
  const normalizedQuery = normalizeGymName(filters.nameQuery);

  const maxDistanceKm = hasValidGymCoordinates(userCoordinates)
    ? filters.maxDistanceKm
    : null;

  return gyms.filter((gym) => {
    if (
      normalizedQuery &&
      !normalizeGymName(gym.name).includes(normalizedQuery)
    ) {
      return false;
    }

    if (maxDistanceKm === null) {
      return true;
    }

    const distanceKm = getGymDistanceKm(userCoordinates, gym.coordinates);

    return (
      distanceKm !== null &&
      distanceKm <= maxDistanceKm + DISTANCE_COMPARISON_TOLERANCE_KM
    );
  });
}
