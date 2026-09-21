import type { GeocodedPlace } from "../types/location";

interface NominatimPlace {
  lat?: string;
  lon?: string;
  display_name?: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 12_000,
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchLocation(searchText: string): Promise<NominatimPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(
    searchText,
  )}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FitMap/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível localizar a região informada.");
  }

  const data: unknown = await response.json();

  return Array.isArray(data) ? (data as NominatimPlace[]) : [];
}

export async function geocodeRegion(query: string): Promise<GeocodedPlace> {
  const formattedQuery = query.trim();

  if (!formattedQuery) {
    throw new Error("Digite uma cidade, bairro ou região para buscar.");
  }

  try {
    let data = await searchLocation(formattedQuery);

    if (!data.length) {
      data = await searchLocation(`${formattedQuery}, Brasil`);
    }

    if (!data.length) {
      throw new Error(
        "Região não encontrada. Tente digitar uma cidade ou bairro próximo.",
      );
    }

    const place = data[0];

    const latitude = Number(place.lat);
    const longitude = Number(place.lon);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error(
        "A região foi encontrada, mas as coordenadas são inválidas.",
      );
    }

    return {
      latitude,
      longitude,
      name: place.display_name || formattedQuery,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "A busca demorou muito. Verifique sua internet e tente novamente.",
      );
    }

    if (error instanceof Error) {
      throw new Error(
        error.message || "Não foi possível localizar a região informada.",
      );
    }

    throw new Error("Não foi possível localizar a região informada.");
  }
}
