import { ApiClientError, apiClient } from "../apiClient";
import {
  addFavoriteGym,
  getFavoriteGyms,
  getGymDetails,
  removeFavoriteGym,
  searchGymsByLocation,
  searchNearbyGyms,
  searchNearbyGymsWithFallback,
  suggestGymLocations,
} from "../gyms";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

jest.mock("../apiClient", () => ({
  ...jest.requireActual<typeof import("../apiClient")>("../apiClient"),
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

describe("gyms service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedDelete.mockReset();
  });

  it("does not request suggestions for invalid query lengths", async () => {
    expect(await suggestGymLocations(" ")).toEqual([]);
    expect(await suggestGymLocations(" A ")).toEqual([]);
    expect(await suggestGymLocations("X".repeat(101))).toEqual([]);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("encodes the query and preserves location coordinates", async () => {
    const suggestions = [
      {
        label: "Centro, Volta Redonda, RJ, Brasil",
        query: "Centro, Volta Redonda, RJ, Brasil",
        coordinates: {
          latitude: -22.512419,
          longitude: -44.0905846,
        },
      },
    ];

    mockedGet.mockResolvedValue(suggestions);

    const results = await suggestGymLocations(" Centro, Volta Redonda ");

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/locations/suggest?query=Centro%2C%20Volta%20Redonda",
    );

    expect(results).toEqual(suggestions);
    expect(results[0].coordinates).toEqual({
      latitude: -22.512419,
      longitude: -44.0905846,
    });
  });

  it("propagates errors from the suggestions endpoint", async () => {
    const error = new ApiClientError(
      "Location suggestions are unavailable.",
      502,
      "location_suggestions_unavailable",
    );

    mockedGet.mockRejectedValue(error);

    await expect(suggestGymLocations("Volta Red")).rejects.toBe(error);
  });

  it("returns an empty list for an empty textual query without calling the backend", async () => {
    const results = await searchGymsByLocation("   ");

    expect(results).toEqual([]);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("encodes a textual query and normalizes gym search results", async () => {
    mockedGet.mockResolvedValue([
      {
        provider_name: "geoapify",
        external_id: "gym-123",
        name: "Academia Central",
        coordinates: {
          latitude: -22.4708,
          longitude: -43.825,
        },
        address: "Rua Principal, 123",
      },
    ]);

    const results = await searchGymsByLocation("Rio de Janeiro");

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/search?query=Rio%20de%20Janeiro",
    );

    expect(results).toEqual([
      {
        id: "gym-123",
        providerName: "geoapify",
        name: "Academia Central",
        coordinates: {
          latitude: -22.4708,
          longitude: -43.825,
        },
        address: "Rua Principal, 123",
      },
    ]);
  });

  it("requests nearby gyms with the default radius and normalizes results", async () => {
    mockedGet.mockResolvedValue([
      {
        provider_name: "geoapify",
        external_id: "nearby-123",
        name: "Academia Próxima",
        coordinates: {
          latitude: -23.0121669,
          longitude: -43.3101781,
        },
        address: "Barra da Tijuca, Rio de Janeiro",
      },
    ]);

    const results = await searchNearbyGyms(-23.0121669, -43.3101781);

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/nearby?latitude=-23.0121669&longitude=-43.3101781&radius_meters=5000",
    );

    expect(results).toEqual([
      {
        id: "nearby-123",
        providerName: "geoapify",
        name: "Academia Próxima",
        coordinates: {
          latitude: -23.0121669,
          longitude: -43.3101781,
        },
        address: "Barra da Tijuca, Rio de Janeiro",
      },
    ]);
  });

  it("uses the requested radius for nearby gym discovery", async () => {
    mockedGet.mockResolvedValue([]);

    await searchNearbyGyms(-23.0121669, -43.3101781, 10_000);

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/nearby?latitude=-23.0121669&longitude=-43.3101781&radius_meters=10000",
    );
  });

  it("loads gym details and converts the API contract to the mobile model", async () => {
    mockedGet.mockResolvedValue({
      provider_name: "geoapify",
      external_id: "gym/details 123",
      name: "Bodytech",
      coordinates: {
        latitude: -23.0121669,
        longitude: -43.3101781,
      },
      address: "Avenida Érico Veríssimo 400",
      phone: "+55 21 2493-8454",
      website: "https://www.bodytech.com.br",
      opening_hours: ["Mo-Fr 06:00-23:00; Sa 08:00-20:00"],
      image_urls: [],
      amenities: [],
    });

    const result = await getGymDetails("gym/details 123");

    expect(mockedGet).toHaveBeenCalledWith("/gyms/gym%2Fdetails%20123");

    expect(result).toEqual({
      id: "gym/details 123",
      providerName: "geoapify",
      name: "Bodytech",
      coordinates: {
        latitude: -23.0121669,
        longitude: -43.3101781,
      },
      address: "Avenida Érico Veríssimo 400",
      phone: "+55 21 2493-8454",
      website: "https://www.bodytech.com.br",
      openingHours: ["Mo-Fr 06:00-23:00; Sa 08:00-20:00"],
      imageUrls: [],
      amenities: [],
    });
  });

  it("preserves unavailable gym information as null or empty data", async () => {
    mockedGet.mockResolvedValue({
      provider_name: "geoapify",
      external_id: "gym-with-limited-data",
      name: "Academia sem dados adicionais",
      coordinates: null,
      address: null,
      phone: null,
      website: null,
      opening_hours: null,
      image_urls: [],
      amenities: [],
    });

    const result = await getGymDetails("gym-with-limited-data");

    expect(result).toEqual({
      id: "gym-with-limited-data",
      providerName: "geoapify",
      name: "Academia sem dados adicionais",
      coordinates: null,
      address: null,
      phone: null,
      website: null,
      openingHours: null,
      imageUrls: [],
      amenities: [],
    });
  });

  it("loads authenticated favorite gyms and normalizes stable gym identity", async () => {
    mockedGet.mockResolvedValue([
      {
        id: "favorite-123",
        gym_id: "fitmap-gym-123",
        provider_name: "geoapify",
        external_id: "provider-gym-123",
        name: "Academia Favorita",
        coordinates: {
          latitude: -22.4708,
          longitude: -43.825,
        },
        address: "Rua Favorita, 100",
        favorited_at: "2026-10-20T18:00:00Z",
      },
    ]);

    const result = await getFavoriteGyms("access-token");

    expect(mockedGet).toHaveBeenCalledWith("/gyms/favorites", {
      headers: {
        Authorization: "Bearer access-token",
      },
    });

    expect(result).toEqual([
      {
        id: "favorite-123",
        gymId: "fitmap-gym-123",
        providerName: "geoapify",
        externalId: "provider-gym-123",
        name: "Academia Favorita",
        coordinates: {
          latitude: -22.4708,
          longitude: -43.825,
        },
        address: "Rua Favorita, 100",
        favoritedAt: "2026-10-20T18:00:00Z",
      },
    ]);
  });

  it("adds a favorite using the external gym id and preserves internal identity", async () => {
    mockedPost.mockResolvedValue({
      id: "favorite-456",
      gym_id: "fitmap-gym-456",
      provider_name: "geoapify",
      external_id: "provider/gym 456",
      name: "Academia Nova",
      coordinates: null,
      address: null,
      favorited_at: "2026-10-20T18:30:00Z",
    });

    const result = await addFavoriteGym("access-token", "provider/gym 456");

    expect(mockedPost).toHaveBeenCalledWith(
      "/gyms/provider%2Fgym%20456/favorite",
      undefined,
      {
        headers: {
          Authorization: "Bearer access-token",
        },
      },
    );

    expect(result).toEqual({
      id: "favorite-456",
      gymId: "fitmap-gym-456",
      providerName: "geoapify",
      externalId: "provider/gym 456",
      name: "Academia Nova",
      coordinates: null,
      address: null,
      favoritedAt: "2026-10-20T18:30:00Z",
    });
  });

  it("removes a favorite using the stable internal FitMap gym id", async () => {
    mockedDelete.mockResolvedValue(undefined);

    await removeFavoriteGym("access-token", "fitmap/gym 789");

    expect(mockedDelete).toHaveBeenCalledWith(
      "/gyms/favorites/fitmap%2Fgym%20789",
      {
        headers: {
          Authorization: "Bearer access-token",
        },
      },
    );
  });

  it("preserves TomTom identity in nearby results", async () => {
    mockedGet.mockResolvedValue([
      {
        provider_name: "tomtom",
        external_id: "tomtom-123",
        name: "Academia TomTom",
        coordinates: { latitude: -22.47, longitude: -43.82 },
        address: "Barra do Pira?",
      },
    ]);

    const results = await searchNearbyGyms(-22.47, -43.82, 10_000, "tomtom");

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/nearby?latitude=-22.47&longitude=-43.82&radius_meters=10000&provider_name=tomtom",
    );

    expect(results).toEqual([
      {
        id: "tomtom-123",
        providerName: "tomtom",
        name: "Academia TomTom",
        coordinates: { latitude: -22.47, longitude: -43.82 },
        address: "Barra do Pira?",
      },
    ]);
  });

  it("requests TomTom details with explicit provider", async () => {
    mockedGet.mockResolvedValue({
      provider_name: "tomtom",
      external_id: "tomtom/123",
      name: "Academia TomTom",
      coordinates: null,
      address: null,
      phone: null,
      website: null,
      opening_hours: null,
      image_urls: [],
      amenities: [],
    });

    const result = await getGymDetails("tomtom/123", "tomtom");

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/tomtom%2F123?provider_name=tomtom",
    );
    expect(result.id).toBe("tomtom/123");
    expect(result.providerName).toBe("tomtom");
  });

  it("adds a TomTom favorite with provider identity", async () => {
    mockedPost.mockResolvedValue({
      id: "favorite-tomtom",
      gym_id: "internal-tomtom",
      provider_name: "tomtom",
      external_id: "tomtom/123",
      name: "Academia TomTom",
      coordinates: null,
      address: null,
      favorited_at: "2026-11-06T12:00:00Z",
    });

    const result = await addFavoriteGym("access-token", "tomtom/123", "tomtom");

    expect(mockedPost).toHaveBeenCalledWith(
      "/gyms/tomtom%2F123/favorite?provider_name=tomtom",
      undefined,
      {
        headers: { Authorization: "Bearer access-token" },
      },
    );
    expect(result.providerName).toBe("tomtom");
    expect(result.gymId).toBe("internal-tomtom");
  });

  const tomtomNearbyUrl =
    "/gyms/nearby?latitude=-22.47&longitude=-43.82&radius_meters=5000&provider_name=tomtom";

  const geoapifyNearbyUrl =
    "/gyms/nearby?latitude=-22.47&longitude=-43.82&radius_meters=5000";

  const tomtomGym = {
    provider_name: "tomtom",
    external_id: "tomtom-123",
    name: "Academia TomTom",
    coordinates: { latitude: -22.47, longitude: -43.82 },
    address: "Barra do Piraí",
  };

  const geoapifyGym = {
    provider_name: "geoapify",
    external_id: "geoapify-123",
    name: "Academia Geoapify",
    coordinates: { latitude: -22.47, longitude: -43.82 },
    address: "Barra do Piraí",
  };

  it("prioritizes TomTom when nearby results are available", async () => {
    mockedGet.mockResolvedValueOnce([tomtomGym]);

    const results = await searchNearbyGymsWithFallback(-22.47, -43.82);

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith(tomtomNearbyUrl);
    expect(results).toEqual([
      {
        id: "tomtom-123",
        providerName: "tomtom",
        name: "Academia TomTom",
        coordinates: { latitude: -22.47, longitude: -43.82 },
        address: "Barra do Piraí",
      },
    ]);
  });

  it("falls back to Geoapify when TomTom returns no gyms", async () => {
    mockedGet.mockResolvedValueOnce([]).mockResolvedValueOnce([geoapifyGym]);

    const results = await searchNearbyGymsWithFallback(-22.47, -43.82);

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(mockedGet).toHaveBeenNthCalledWith(1, tomtomNearbyUrl);
    expect(mockedGet).toHaveBeenNthCalledWith(2, geoapifyNearbyUrl);
    expect(results[0].providerName).toBe("geoapify");
  });

  it.each([502, 503])(
    "falls back when TomTom returns provider error %i",
    async (status) => {
      mockedGet
        .mockRejectedValueOnce(
          new ApiClientError(
            "Provider unavailable",
            status,
            "gym_provider_unavailable",
          ),
        )
        .mockResolvedValueOnce([geoapifyGym]);

      const results = await searchNearbyGymsWithFallback(-22.47, -43.82);

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet).toHaveBeenNthCalledWith(1, tomtomNearbyUrl);
      expect(mockedGet).toHaveBeenNthCalledWith(2, geoapifyNearbyUrl);
      expect(results[0].providerName).toBe("geoapify");
    },
  );

  it("falls back when the TomTom request times out", async () => {
    mockedGet
      .mockRejectedValueOnce(new Error("The request timed out."))
      .mockResolvedValueOnce([geoapifyGym]);

    const results = await searchNearbyGymsWithFallback(-22.47, -43.82);

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(results[0].providerName).toBe("geoapify");
  });

  it("does not hide unexpected validation errors", async () => {
    mockedGet.mockRejectedValueOnce(
      new ApiClientError("Invalid request", 422, "request_validation_error"),
    );

    await expect(
      searchNearbyGymsWithFallback(-22.47, -43.82),
    ).rejects.toMatchObject({
      status: 422,
      code: "request_validation_error",
    });

    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("propagates errors when Geoapify fallback also fails", async () => {
    const fallbackError = new ApiClientError(
      "Geoapify unavailable",
      502,
      "gym_provider_unavailable",
    );

    mockedGet
      .mockRejectedValueOnce(
        new ApiClientError(
          "TomTom unavailable",
          503,
          "gym_provider_unavailable",
        ),
      )
      .mockRejectedValueOnce(fallbackError);

    await expect(searchNearbyGymsWithFallback(-22.47, -43.82)).rejects.toBe(
      fallbackError,
    );

    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});
