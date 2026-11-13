import type { GymCoordinates, GymSearchResult } from "../../services/gyms";
import {
  DEFAULT_GYM_RESULT_FILTERS,
  filterGymResults,
  getGymDistanceKm,
  type GymResultFilters,
} from "../gymResultFilters";

const origin: GymCoordinates = {
  latitude: 0,
  longitude: 0,
};

const gyms: GymSearchResult[] = [
  {
    id: "aurora",
    providerName: "geoapify",
    name: "Academia Aurora",
    address: "Rua das Flores",
    coordinates: {
      latitude: 0.005,
      longitude: 0,
    },
  },
  {
    id: "atlas",
    providerName: "tomtom",
    name: "Atlas Fitness",
    address: "Rua Central",
    coordinates: {
      latitude: 0.02,
      longitude: 0,
    },
  },
  {
    id: "energia",
    providerName: "geoapify",
    name: "Academia Energia",
    address: null,
    coordinates: {
      latitude: 0.04,
      longitude: 0,
    },
  },
  {
    id: "acai",
    providerName: "tomtom",
    name: "A\u00e7a\u00ed Fitness",
    address: null,
    coordinates: {
      latitude: 0.06,
      longitude: 0,
    },
  },
  {
    id: "unknown",
    providerName: "geoapify",
    name: "Academia Sem Localizacao",
    address: null,
    coordinates: null,
  },
];

function applyFilters(
  filters: Partial<GymResultFilters>,
  userCoordinates: GymCoordinates | null = origin,
  results: readonly GymSearchResult[] = gyms,
): GymSearchResult[] {
  return filterGymResults(
    results,
    {
      ...DEFAULT_GYM_RESULT_FILTERS,
      ...filters,
    },
    userCoordinates,
  );
}

function ids(results: GymSearchResult[]): string[] {
  return results.map((gym) => gym.id);
}

describe("filterGymResults", () => {
  it("preserves all results without active filters", () => {
    expect(applyFilters({})).toEqual(gyms);
  });

  it("returns a new array without mutating the source", () => {
    const snapshot = [...gyms];
    const results = applyFilters({});

    expect(results).not.toBe(gyms);
    expect(gyms).toEqual(snapshot);
  });

  it("filters gyms by partial name", () => {
    expect(ids(applyFilters({ nameQuery: "Aurora" }))).toEqual(["aurora"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(ids(applyFilters({ nameQuery: "  ATLAS  " }))).toEqual(["atlas"]);
  });

  it("matches accented names using unaccented queries", () => {
    expect(ids(applyFilters({ nameQuery: "ACAI" }))).toEqual(["acai"]);
  });

  it("matches unaccented names using accented queries", () => {
    expect(ids(applyFilters({ nameQuery: "\u00c1tl\u00e1s" }))).toEqual([
      "atlas",
    ]);
  });

  it("treats whitespace-only queries as inactive", () => {
    expect(applyFilters({ nameQuery: "   " })).toEqual(gyms);
  });

  it("returns no results for an unmatched name", () => {
    expect(applyFilters({ nameQuery: "Inexistente" })).toEqual([]);
  });

  it("filters gyms within one kilometer", () => {
    expect(ids(applyFilters({ maxDistanceKm: 1 }))).toEqual(["aurora"]);
  });

  it("filters gyms within three kilometers", () => {
    expect(ids(applyFilters({ maxDistanceKm: 3 }))).toEqual([
      "aurora",
      "atlas",
    ]);
  });

  it("filters gyms within five kilometers", () => {
    expect(ids(applyFilters({ maxDistanceKm: 5 }))).toEqual([
      "aurora",
      "atlas",
      "energia",
    ]);
  });

  it("combines name and distance filters", () => {
    expect(
      ids(
        applyFilters({
          nameQuery: "Academia",
          maxDistanceKm: 5,
        }),
      ),
    ).toEqual(["aurora", "energia"]);
  });

  it("does not apply distance filtering without user coordinates", () => {
    expect(applyFilters({ maxDistanceKm: 1 }, null)).toEqual(gyms);
  });

  it("preserves name filtering without user coordinates", () => {
    expect(
      ids(
        applyFilters(
          {
            nameQuery: "Atlas",
            maxDistanceKm: 1,
          },
          null,
        ),
      ),
    ).toEqual(["atlas"]);
  });

  it("preserves gyms with unknown coordinates without distance filtering", () => {
    expect(ids(applyFilters({ nameQuery: "Sem Localizacao" }))).toEqual([
      "unknown",
    ]);
  });

  it("excludes unknown coordinates when distance filtering is active", () => {
    expect(
      ids(
        applyFilters({
          nameQuery: "Sem Localizacao",
          maxDistanceKm: 5,
        }),
      ),
    ).toEqual([]);
  });

  it("does not interpret invalid gym coordinates as zero distance", () => {
    const invalidGyms: GymSearchResult[] = [
      {
        ...gyms[0],
        coordinates: {
          latitude: Number.NaN,
          longitude: 0,
        },
      },
      {
        ...gyms[1],
        coordinates: {
          latitude: 91,
          longitude: 0,
        },
      },
      {
        ...gyms[2],
        coordinates: {
          latitude: 0,
          longitude: Infinity,
        },
      },
    ];

    expect(applyFilters({ maxDistanceKm: 5 }, origin, invalidGyms)).toEqual([]);
  });

  it("does not apply distance filtering with invalid origin coordinates", () => {
    expect(
      applyFilters(
        { maxDistanceKm: 1 },
        {
          latitude: Number.NaN,
          longitude: 0,
        },
      ),
    ).toEqual(gyms);
  });

  it("preserves the original result order", () => {
    const reversed = [...gyms].reverse();

    expect(ids(applyFilters({ maxDistanceKm: 5 }, origin, reversed))).toEqual([
      "energia",
      "atlas",
      "aurora",
    ]);
  });

  it("preserves separate gyms with the same external ID", () => {
    const sameExternalId: GymSearchResult[] = [
      {
        ...gyms[0],
        id: "shared",
        providerName: "geoapify",
      },
      {
        ...gyms[0],
        id: "shared",
        providerName: "tomtom",
      },
    ];

    expect(
      applyFilters(
        {
          nameQuery: "Aurora",
          maxDistanceKm: 1,
        },
        origin,
        sameExternalId,
      ),
    ).toEqual(sameExternalId);
  });

  it("filters an immutable source without mutating gym objects", () => {
    const immutable = Object.freeze(
      gyms.map((gym) => Object.freeze({ ...gym })),
    );

    const results = applyFilters({ nameQuery: "Aurora" }, origin, immutable);

    expect(results).toEqual([immutable[0]]);
    expect(results[0]).toBe(immutable[0]);
    expect(immutable).toHaveLength(5);
  });

  it("returns an empty array for empty input", () => {
    expect(
      applyFilters(
        {
          nameQuery: "Aurora",
          maxDistanceKm: 1,
        },
        origin,
        [],
      ),
    ).toEqual([]);
  });
});

describe("getGymDistanceKm", () => {
  it("calculates a known distance in kilometers", () => {
    expect(
      getGymDistanceKm(origin, {
        latitude: 0.01,
        longitude: 0,
      }),
    ).toBeCloseTo(1.11195, 4);
  });

  it("preserves a legitimate zero distance", () => {
    expect(getGymDistanceKm(origin, origin)).toBe(0);
  });

  it("returns null without an origin", () => {
    expect(getGymDistanceKm(null, origin)).toBeNull();
  });

  it("returns null without a destination", () => {
    expect(getGymDistanceKm(origin, null)).toBeNull();
  });

  it.each([
    { latitude: Number.NaN, longitude: 0 },
    { latitude: Infinity, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: -91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: 0, longitude: -181 },
    { latitude: 0, longitude: -Infinity },
  ])("returns null for invalid coordinates: %j", (invalid) => {
    expect(getGymDistanceKm(origin, invalid)).toBeNull();

    expect(getGymDistanceKm(invalid, origin)).toBeNull();
  });

  it("accepts valid coordinate boundaries", () => {
    const distance = getGymDistanceKm(
      { latitude: 90, longitude: 180 },
      { latitude: -90, longitude: -180 },
    );

    expect(distance).not.toBeNull();
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(20000);
  });

  it("includes gyms exactly at the distance boundary", () => {
    const boundaryGym: GymSearchResult = {
      ...gyms[0],
      coordinates: {
        latitude: 0,
        longitude: 180 / (Math.PI * 6371),
      },
    };

    expect(applyFilters({ maxDistanceKm: 1 }, origin, [boundaryGym])).toEqual([
      boundaryGym,
    ]);
  });
});
