import type { GymCoordinates, GymSearchResult } from "../../services/gyms";
import {
  DEFAULT_GYM_RESULT_SORT,
  sortGymResults,
  type GymResultSort,
} from "../gymResultSorting";
import {
  DEFAULT_GYM_RESULT_FILTERS,
  filterGymResults,
} from "../gymResultFilters";

const origin: GymCoordinates = {
  latitude: 0,
  longitude: 0,
};

const gyms: GymSearchResult[] = [
  {
    id: "far",
    providerName: "geoapify",
    name: "Zulu Gym",
    address: null,
    coordinates: {
      latitude: 0.04,
      longitude: 0,
    },
  },
  {
    id: "unknown",
    providerName: "tomtom",
    name: "Beta Gym",
    address: null,
    coordinates: null,
  },
  {
    id: "middle",
    providerName: "geoapify",
    name: "Atlas Fitness",
    address: "Rua Central",
    coordinates: {
      latitude: 0.02,
      longitude: 0,
    },
  },
  {
    id: "near",
    providerName: "tomtom",
    name: "Academia Aurora",
    address: "Rua das Flores",
    coordinates: {
      latitude: 0.005,
      longitude: 0,
    },
  },
  {
    id: "acai",
    providerName: "geoapify",
    name: "A\u00e7a\u00ed Fitness",
    address: null,
    coordinates: {
      latitude: 0.01,
      longitude: 0,
    },
  },
];

const sortModes: GymResultSort[] = ["provider", "distance", "name"];

function ids(results: readonly GymSearchResult[]): string[] {
  return results.map((gym) => gym.id);
}

describe("sortGymResults", () => {
  it("preserves provider order by default", () => {
    expect(DEFAULT_GYM_RESULT_SORT).toBe("provider");

    expect(sortGymResults(gyms, DEFAULT_GYM_RESULT_SORT, origin)).toEqual(gyms);
  });

  it("returns a new array for every sorting mode", () => {
    for (const mode of sortModes) {
      expect(sortGymResults(gyms, mode, origin)).not.toBe(gyms);
    }
  });

  it("sorts gyms by ascending distance", () => {
    expect(ids(sortGymResults(gyms, "distance", origin))).toEqual([
      "near",
      "acai",
      "middle",
      "far",
      "unknown",
    ]);
  });

  it("places a gym at zero distance first", () => {
    const sameLocation: GymSearchResult = {
      ...gyms[0],
      id: "zero",
      coordinates: origin,
    };

    expect(
      ids(sortGymResults([...gyms, sameLocation], "distance", origin)),
    ).toEqual(["zero", "near", "acai", "middle", "far", "unknown"]);
  });

  it("places unknown distances last in their original order", () => {
    const unknownSecond: GymSearchResult = {
      ...gyms[1],
      id: "unknown-second",
    };

    const results = [gyms[1], gyms[0], unknownSecond, gyms[3]];

    expect(ids(sortGymResults(results, "distance", origin))).toEqual([
      "near",
      "far",
      "unknown",
      "unknown-second",
    ]);
  });

  it("does not treat invalid coordinates as zero distance", () => {
    const invalid: GymSearchResult[] = [
      {
        ...gyms[0],
        id: "nan",
        coordinates: {
          latitude: Number.NaN,
          longitude: 0,
        },
      },
      {
        ...gyms[1],
        id: "out-of-range",
        coordinates: {
          latitude: 91,
          longitude: 0,
        },
      },
      {
        ...gyms[2],
        id: "infinite",
        coordinates: {
          latitude: 0,
          longitude: Infinity,
        },
      },
    ];

    const results = [invalid[0], gyms[0], invalid[1], gyms[3], invalid[2]];

    expect(ids(sortGymResults(results, "distance", origin))).toEqual([
      "near",
      "far",
      "nan",
      "out-of-range",
      "infinite",
    ]);
  });

  it("preserves provider order for equal distances", () => {
    const tieB: GymSearchResult = {
      ...gyms[2],
      id: "tie-b",
    };

    const tieA: GymSearchResult = {
      ...gyms[2],
      id: "tie-a",
      coordinates: {
        latitude: -0.02,
        longitude: 0,
      },
    };

    const results = [gyms[0], tieB, tieA, gyms[3]];

    expect(ids(sortGymResults(results, "distance", origin))).toEqual([
      "near",
      "tie-b",
      "tie-a",
      "far",
    ]);
  });

  it("preserves provider order without device coordinates", () => {
    expect(sortGymResults(gyms, "distance", null)).toEqual(gyms);
  });

  it("preserves provider order with invalid device coordinates", () => {
    const invalidOrigins: GymCoordinates[] = [
      {
        latitude: Number.NaN,
        longitude: 0,
      },
      {
        latitude: 91,
        longitude: 0,
      },
      {
        latitude: 0,
        longitude: Infinity,
      },
    ];

    for (const invalidOrigin of invalidOrigins) {
      expect(sortGymResults(gyms, "distance", invalidOrigin)).toEqual(gyms);
    }
  });

  it("preserves original order when all distances are unknown", () => {
    const results = gyms.map((gym) => ({
      ...gym,
      coordinates: null,
    }));

    expect(sortGymResults(results, "distance", origin)).toEqual(results);
  });

  it("sorts alphabetically without device coordinates", () => {
    expect(ids(sortGymResults(gyms, "name", null))).toEqual([
      "near",
      "acai",
      "middle",
      "unknown",
      "far",
    ]);
  });

  it("sorts alphabetically independently of device coordinates", () => {
    expect(ids(sortGymResults(gyms, "name", origin))).toEqual([
      "near",
      "acai",
      "middle",
      "unknown",
      "far",
    ]);
  });

  it("ignores accents case and surrounding whitespace in name ordering", () => {
    const results: GymSearchResult[] = [
      {
        ...gyms[0],
        id: "zulu",
        name: "Zulu",
      },
      {
        ...gyms[1],
        id: "accented",
        name: "  \u00c1TLAS  ",
      },
      {
        ...gyms[2],
        id: "unaccented",
        name: "atlas",
      },
      {
        ...gyms[3],
        id: "beta",
        name: "Beta",
      },
    ];

    expect(ids(sortGymResults(results, "name", null))).toEqual([
      "accented",
      "unaccented",
      "beta",
      "zulu",
    ]);
  });

  it("preserves separate providers and stable name ties", () => {
    const first: GymSearchResult = {
      ...gyms[2],
      id: "shared",
      providerName: "tomtom",
    };

    const second: GymSearchResult = {
      ...gyms[2],
      id: "shared",
      providerName: "geoapify",
    };

    const results = sortGymResults([gyms[0], first, second], "name", null);

    expect(results).toEqual([first, second, gyms[0]]);

    expect(results[0]).toBe(first);
    expect(results[1]).toBe(second);
  });

  it("includes gyms without coordinates in alphabetical ordering", () => {
    expect(
      ids(sortGymResults([gyms[0], gyms[1], gyms[3]], "name", null)),
    ).toEqual(["near", "unknown", "far"]);
  });

  it("sorts only results matching combined name and distance filters", () => {
    const filtered = filterGymResults(
      gyms,
      {
        ...DEFAULT_GYM_RESULT_FILTERS,
        nameQuery: "Fitness",
        maxDistanceKm: 3,
      },
      origin,
    );

    expect(ids(filtered)).toEqual(["middle", "acai"]);

    expect(ids(sortGymResults(filtered, "distance", origin))).toEqual([
      "acai",
      "middle",
    ]);
  });

  it("combines alphabetical ordering with active filters", () => {
    const filtered = filterGymResults(
      gyms,
      {
        ...DEFAULT_GYM_RESULT_FILTERS,
        nameQuery: "a",
        maxDistanceKm: 5,
      },
      origin,
    );

    expect(ids(filtered)).toEqual(["middle", "near", "acai"]);

    expect(ids(sortGymResults(filtered, "name", origin))).toEqual([
      "near",
      "acai",
      "middle",
    ]);
  });

  it("sorts immutable input without mutating or cloning gym objects", () => {
    const immutable = Object.freeze(
      gyms.map((gym) => Object.freeze({ ...gym })),
    );

    const snapshot = [...immutable];

    const ordered = sortGymResults(immutable, "distance", origin);

    expect(ordered[0]).toBe(immutable[3]);
    expect(ordered[1]).toBe(immutable[4]);
    expect(immutable).toEqual(snapshot);
    expect(ordered).not.toBe(immutable);
  });

  it("returns empty results for every sorting mode", () => {
    for (const mode of sortModes) {
      expect(sortGymResults([], mode, origin)).toEqual([]);
    }
  });

  it("preserves a single result for every sorting mode", () => {
    for (const mode of sortModes) {
      const results = sortGymResults([gyms[0]], mode, origin);

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(gyms[0]);
    }
  });
});
