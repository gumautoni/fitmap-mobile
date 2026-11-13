import type { GymCoordinates, GymSearchResult } from "../services/gyms";
import { getGymDistanceKm, hasValidGymCoordinates } from "./gymResultFilters";

export type GymResultSort = "provider" | "distance" | "name";

export const DEFAULT_GYM_RESULT_SORT: GymResultSort = "provider";

function normalizeGymName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sortByName(gyms: readonly GymSearchResult[]): GymSearchResult[] {
  return gyms
    .map((gym, index) => ({
      gym,
      index,
      nameKey: normalizeGymName(gym.name),
    }))
    .sort((left, right) => {
      if (left.nameKey < right.nameKey) {
        return -1;
      }

      if (left.nameKey > right.nameKey) {
        return 1;
      }

      return left.index - right.index;
    })
    .map(({ gym }) => gym);
}

function sortByDistance(
  gyms: readonly GymSearchResult[],
  userCoordinates: GymCoordinates,
): GymSearchResult[] {
  return gyms
    .map((gym, index) => ({
      gym,
      index,
      distanceKm: getGymDistanceKm(userCoordinates, gym.coordinates),
    }))
    .sort((left, right) => {
      if (left.distanceKm === null) {
        return right.distanceKm === null ? left.index - right.index : 1;
      }

      if (right.distanceKm === null) {
        return -1;
      }

      return left.distanceKm - right.distanceKm || left.index - right.index;
    })
    .map(({ gym }) => gym);
}

export function sortGymResults(
  gyms: readonly GymSearchResult[],
  sort: GymResultSort,
  userCoordinates: GymCoordinates | null,
): GymSearchResult[] {
  switch (sort) {
    case "name":
      return sortByName(gyms);

    case "distance":
      return hasValidGymCoordinates(userCoordinates)
        ? sortByDistance(gyms, userCoordinates)
        : [...gyms];

    case "provider":
      return [...gyms];
  }
}
