import type { Gym } from "../types/gym";
import { calculateDistanceKm } from "../utils/distance";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
] as const;

interface OverpassTags {
  [key: string]: string | undefined;
}

interface OverpassElement {
  id: number | string;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: OverpassTags;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function generatePriceLevel(name = ""): number {
  const values = [79.9, 99.9, 119.9, 149.9];
  const index = name.length % values.length;

  return values[index];
}

function buildAddress(tags: OverpassTags = {}): string {
  const street = tags["addr:street"] || "";
  const number = tags["addr:housenumber"] || "";
  const neighborhood = tags["addr:suburb"] || tags["addr:neighbourhood"] || "";
  const city =
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";

  const parts = [street, number, neighborhood, city].filter(Boolean);

  return parts.length ? parts.join(", ") : "Endereço não informado";
}

function normalizeGym(
  element: OverpassElement,
  originLatitude: number,
  originLongitude: number,
): Gym | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;

  if (lat == null || lon == null) {
    return null;
  }

  const tags = element.tags ?? {};
  const name = tags.name || "Academia sem nome";

  return {
    id: String(element.id),
    name,
    latitude: Number(lat),
    longitude: Number(lon),
    address: buildAddress(tags),
    distanceKm: calculateDistanceKm(
      originLatitude,
      originLongitude,
      Number(lat),
      Number(lon),
    ),
    monthlyPrice: generatePriceLevel(name),
    phone: tags.phone || tags["contact:phone"] || "Não informado",
    website: tags.website || tags["contact:website"] || "",
    source: "openstreetmap",
  };
}

function removeDuplicates(gyms: Gym[]): Gym[] {
  const uniqueMap = new Map<string, Gym>();

  for (const gym of gyms) {
    const key = `${gym.name}-${gym.latitude.toFixed(5)}-${gym.longitude.toFixed(5)}`;

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, gym);
    }
  }

  return Array.from(uniqueMap.values());
}

function buildOverpassQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): string {
  return `
    [out:json][timeout:20];
    (
      node["leisure"="fitness_centre"](around:${radiusMeters},${latitude},${longitude});
      way["leisure"="fitness_centre"](around:${radiusMeters},${latitude},${longitude});
      relation["leisure"="fitness_centre"](around:${radiusMeters},${latitude},${longitude});

      node["amenity"="gym"](around:${radiusMeters},${latitude},${longitude});
      way["amenity"="gym"](around:${radiusMeters},${latitude},${longitude});
      relation["amenity"="gym"](around:${radiusMeters},${latitude},${longitude});

      node["sport"="fitness"](around:${radiusMeters},${latitude},${longitude});
      way["sport"="fitness"](around:${radiusMeters},${latitude},${longitude});
      relation["sport"="fitness"](around:${radiusMeters},${latitude},${longitude});
    );
    out center tags;
  `;
}

function buildFallbackGyms(latitude: number, longitude: number): Gym[] {
  const fallbackData: Omit<Gym, "distanceKm">[] = [
    {
      id: "demo-1",
      name: "FitMap Academia Centro",
      latitude: latitude + 0.006,
      longitude: longitude + 0.004,
      address: "Resultado demonstrativo próximo à sua localização",
      monthlyPrice: 99.9,
      phone: "Não informado",
      website: "",
      source: "demo",
    },
    {
      id: "demo-2",
      name: "Espaço Fitness FitMap",
      latitude: latitude - 0.005,
      longitude: longitude + 0.006,
      address: "Resultado demonstrativo próximo à sua localização",
      monthlyPrice: 119.9,
      phone: "Não informado",
      website: "",
      source: "demo",
    },
    {
      id: "demo-3",
      name: "Academia Saúde e Movimento",
      latitude: latitude + 0.009,
      longitude: longitude - 0.005,
      address: "Resultado demonstrativo próximo à sua localização",
      monthlyPrice: 79.9,
      phone: "Não informado",
      website: "",
      source: "demo",
    },
  ];

  return fallbackData
    .map((gym) => ({
      ...gym,
      distanceKm: calculateDistanceKm(
        latitude,
        longitude,
        gym.latitude,
        gym.longitude,
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function fetchNearbyGyms(
  latitude: number,
  longitude: number,
  radiusMeters = 5_000,
): Promise<Gym[]> {
  const radiusOptions = Array.from(
    new Set([radiusMeters, 10_000, 15_000, 25_000]),
  ).sort((a, b) => a - b);

  for (const currentRadius of radiusOptions) {
    const query = buildOverpassQuery(latitude, longitude, currentRadius);

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=UTF-8",
          },
          body: query,
        });

        if (!response.ok) {
          continue;
        }

        const payload: unknown = await response.json();

        if (typeof payload !== "object" || payload === null) {
          continue;
        }

        const data = payload as OverpassResponse;
        const elements = Array.isArray(data.elements) ? data.elements : [];

        const gyms = elements
          .map((element) => normalizeGym(element, latitude, longitude))
          .filter((gym): gym is Gym => gym !== null);

        const uniqueGyms = removeDuplicates(gyms);

        uniqueGyms.sort((a, b) => a.distanceKm - b.distanceKm);

        if (uniqueGyms.length > 0) {
          return uniqueGyms;
        }
      } catch (error: unknown) {
        console.log(
          "Erro ao buscar academias:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return buildFallbackGyms(latitude, longitude);
}
