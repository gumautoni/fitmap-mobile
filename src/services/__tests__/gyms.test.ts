import { apiClient } from "../apiClient";
import {
  addFavoriteGym,
  getFavoriteGyms,
  getGymDetails,
  removeFavoriteGym,
  searchGymsByLocation,
  searchNearbyGyms,
} from "../gyms";

jest.mock("../apiClient", () => ({
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
});
