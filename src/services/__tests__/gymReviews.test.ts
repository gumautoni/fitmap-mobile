import { apiClient } from "../apiClient";
import {
  createGymReview,
  getGymReviews,
  getMyGymReview,
  removeGymReview,
  reportGymReview,
  resolveGymIdentity,
  updateGymReview,
} from "../gymReviews";

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedPatch = apiClient.patch as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

const accessToken = "test-access-token";

const authorizationOptions = {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
};

const apiReview = {
  id: "review-123",
  gym_id: "gym-123",
  rating: 5,
  comment: "Excelente academia.",
  created_at: "2026-10-26T10:00:00Z",
  updated_at: "2026-10-26T10:00:00Z",
};

const mobileReview = {
  id: "review-123",
  gymId: "gym-123",
  rating: 5,
  comment: "Excelente academia.",
  createdAt: "2026-10-26T10:00:00Z",
  updatedAt: "2026-10-26T10:00:00Z",
};

describe("gym reviews service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedPatch.mockReset();
    mockedDelete.mockReset();
  });

  it("resolves the persistent FitMap gym identity", async () => {
    mockedPost.mockResolvedValue({
      gym_id: "internal-gym-123",
      provider_name: "geoapify",
      external_id: "external/gym 123",
    });

    const result = await resolveGymIdentity(accessToken, "external/gym 123");

    expect(mockedPost).toHaveBeenCalledWith(
      "/gyms/external%2Fgym%20123/identity",
      undefined,
      authorizationOptions,
    );

    expect(result).toEqual({
      gymId: "internal-gym-123",
      providerName: "geoapify",
      externalId: "external/gym 123",
    });
  });

  it("loads gym reviews and normalizes the rating summary", async () => {
    mockedGet.mockResolvedValue({
      summary: {
        gym_id: "gym-123",
        average_rating: "4.50",
        review_count: 2,
      },
      reviews: [
        apiReview,
        {
          ...apiReview,
          id: "review-456",
          rating: 4,
          comment: null,
        },
      ],
    });

    const result = await getGymReviews(accessToken, "gym/123");

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/gym%2F123/reviews",
      authorizationOptions,
    );

    expect(result).toEqual({
      summary: {
        gymId: "gym-123",
        averageRating: "4.50",
        reviewCount: 2,
      },
      reviews: [
        mobileReview,
        {
          ...mobileReview,
          id: "review-456",
          rating: 4,
          comment: null,
        },
      ],
    });
  });

  it("preserves an empty review list and missing average", async () => {
    mockedGet.mockResolvedValue({
      summary: {
        gym_id: "gym-123",
        average_rating: null,
        review_count: 0,
      },
      reviews: [],
    });

    const result = await getGymReviews(accessToken, "gym-123");

    expect(result).toEqual({
      summary: {
        gymId: "gym-123",
        averageRating: null,
        reviewCount: 0,
      },
      reviews: [],
    });
  });

  it("returns null when the user has no active review", async () => {
    mockedGet.mockResolvedValue(null);

    const result = await getMyGymReview(accessToken, "gym-123");

    expect(mockedGet).toHaveBeenCalledWith(
      "/gyms/gym-123/reviews/mine",
      authorizationOptions,
    );

    expect(result).toBeNull();
  });

  it("loads and normalizes the authenticated user's review", async () => {
    mockedGet.mockResolvedValue(apiReview);

    const result = await getMyGymReview(accessToken, "gym-123");

    expect(result).toEqual(mobileReview);
  });

  it("creates a gym review with authenticated ownership", async () => {
    mockedPost.mockResolvedValue(apiReview);

    const input = {
      rating: 5,
      comment: "Excelente academia.",
    };

    const result = await createGymReview(accessToken, "gym-123", input);

    expect(mockedPost).toHaveBeenCalledWith(
      "/gyms/gym-123/reviews",
      input,
      authorizationOptions,
    );

    expect(result).toEqual(mobileReview);
  });

  it("keeps an explicitly null comment in the creation payload", async () => {
    mockedPost.mockResolvedValue({
      ...apiReview,
      comment: null,
    });

    const input = {
      rating: 4,
      comment: null,
    };

    const result = await createGymReview(accessToken, "gym-123", input);

    expect(mockedPost).toHaveBeenCalledWith(
      "/gyms/gym-123/reviews",
      input,
      authorizationOptions,
    );

    expect(result.comment).toBeNull();
  });

  it("updates an existing review using its review id", async () => {
    mockedPatch.mockResolvedValue({
      ...apiReview,
      rating: 3,
      comment: null,
    });

    const input = {
      rating: 3,
      comment: null,
    };

    const result = await updateGymReview(accessToken, "review/id 123", input);

    expect(mockedPatch).toHaveBeenCalledWith(
      "/gyms/reviews/review%2Fid%20123",
      input,
      authorizationOptions,
    );

    expect(result).toEqual({
      ...mobileReview,
      rating: 3,
      comment: null,
    });
  });

  it("removes a review through the authenticated endpoint", async () => {
    mockedDelete.mockResolvedValue(null);

    const result = await removeGymReview(accessToken, "review-123");

    expect(mockedDelete).toHaveBeenCalledWith(
      "/gyms/reviews/review-123",
      authorizationOptions,
    );

    expect(result).toBeUndefined();
  });

  it("reports another user's written review", async () => {
    mockedPost.mockResolvedValue({
      id: "report-123",
      review_id: "review-123",
      reason: "misleading",
      created_at: "2026-10-26T11:00:00Z",
    });

    const input = {
      reason: "misleading" as const,
      details: "Informações incorretas.",
    };

    const result = await reportGymReview(accessToken, "review-123", input);

    expect(mockedPost).toHaveBeenCalledWith(
      "/gyms/reviews/review-123/reports",
      input,
      authorizationOptions,
    );

    expect(result).toEqual({
      id: "report-123",
      reviewId: "review-123",
      reason: "misleading",
      createdAt: "2026-10-26T11:00:00Z",
    });
  });

  it("propagates backend errors without hiding their details", async () => {
    const backendError = new Error("Test backend failure");

    mockedGet.mockRejectedValue(backendError);

    await expect(getGymReviews(accessToken, "gym-123")).rejects.toBe(
      backendError,
    );
  });
});
