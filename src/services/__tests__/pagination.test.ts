import { apiClient } from "../apiClient";
import * as progress from "../progress";
import * as trainingSessions from "../trainingSessions";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn(),
  UploadType: {
    MULTIPART: 1,
  },
}));

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface PageOptions {
  limit?: number;
  cursor?: string | null;
}

interface HistoryPageOptions extends PageOptions {
  completedFrom?: string;
  completedBefore?: string;
}

type HistoryPageMethod = (
  accessToken: string,
  options?: HistoryPageOptions,
) => Promise<Page<trainingSessions.WorkoutHistoryItem>>;

type PhotoPageMethod = (
  accessToken: string,
  options?: PageOptions,
) => Promise<Page<progress.ProgressPhoto>>;

function requireHistoryPage(): HistoryPageMethod {
  const service = trainingSessions as typeof trainingSessions & {
    getWorkoutHistoryPage?: HistoryPageMethod;
  };

  if (typeof service.getWorkoutHistoryPage !== "function") {
    throw new Error("PERF03_MOBILE_METHOD_MISSING: getWorkoutHistoryPage");
  }

  return service.getWorkoutHistoryPage;
}

function requirePhotoPage(): PhotoPageMethod {
  const service = progress as typeof progress & {
    getProgressPhotosPage?: PhotoPageMethod;
  };

  if (typeof service.getProgressPhotosPage !== "function") {
    throw new Error("PERF03_MOBILE_METHOD_MISSING: getProgressPhotosPage");
  }

  return service.getProgressPhotosPage;
}

const mockedGet = apiClient.get as jest.Mock;

const accessToken = "pagination-access-token";

const headers = {
  Authorization: `Bearer ${accessToken}`,
};

const historyId = "31cc02aa-26ac-4417-9eb7-3d86e8c9e50a";
const photoId = "4c14a144-c92c-4a9f-9cd2-0d6801ae5130";

const historyResponse = {
  id: historyId,
  source_workout_id: null,
  workout_name: "Treino A",
  notes: "Treino concluído.",
  started_at: "2026-11-16T12:00:00Z",
  completed_at: "2026-11-16T13:00:00Z",
  created_at: "2026-11-16T12:00:00Z",
  updated_at: "2026-11-16T13:00:00Z",
};

const normalizedHistory = {
  id: historyId,
  sourceWorkoutId: null,
  workoutName: "Treino A",
  notes: "Treino concluído.",
  startedAt: "2026-11-16T12:00:00Z",
  completedAt: "2026-11-16T13:00:00Z",
  createdAt: "2026-11-16T12:00:00Z",
  updatedAt: "2026-11-16T13:00:00Z",
};

const photoResponse = {
  id: photoId,
  workout_session_id: historyId,
  media_type: "image/jpeg",
  recorded_at: "2026-11-16T13:00:00Z",
  created_at: "2026-11-16T13:01:00Z",
};

const normalizedPhoto = {
  id: photoId,
  workoutSessionId: historyId,
  mediaType: "image/jpeg",
  recordedAt: "2026-11-16T13:00:00Z",
  createdAt: "2026-11-16T13:01:00Z",
};

describe("PERF-03 paginated mobile services", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("loads and normalizes the first history page", async () => {
    const getPage = requireHistoryPage();

    mockedGet.mockResolvedValue({
      items: [historyResponse],
      next_cursor: historyId,
    });

    const result = await getPage(accessToken);

    expect(mockedGet).toHaveBeenCalledWith("/training/history/page?limit=50", {
      headers,
    });

    expect(result).toEqual({
      items: [normalizedHistory],
      nextCursor: historyId,
    });
  });

  it("encodes history cursor and temporal bounds", async () => {
    const getPage = requireHistoryPage();

    const completedFrom = "2026-11-01T00:00:00+03:00";
    const completedBefore = "2026-12-01T00:00:00+03:00";

    mockedGet.mockResolvedValue({
      items: [historyResponse],
      next_cursor: null,
    });

    const result = await getPage(accessToken, {
      limit: 20,
      cursor: historyId,
      completedFrom,
      completedBefore,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      "/training/history/page?limit=20" +
        `&cursor=${historyId}` +
        `&completed_from=${encodeURIComponent(completedFrom)}` +
        `&completed_before=${encodeURIComponent(completedBefore)}`,
      { headers },
    );

    expect(result).toEqual({
      items: [normalizedHistory],
      nextCursor: null,
    });
  });

  it("supports an independent history date bound", async () => {
    const getPage = requireHistoryPage();

    const completedFrom = "2026-11-01T03:00:00Z";

    mockedGet.mockResolvedValue({
      items: [],
      next_cursor: null,
    });

    await getPage(accessToken, {
      cursor: null,
      completedFrom,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      "/training/history/page?limit=50" +
        `&completed_from=${encodeURIComponent(completedFrom)}`,
      { headers },
    );
  });

  it("preserves an empty terminal history page", async () => {
    const getPage = requireHistoryPage();

    mockedGet.mockResolvedValue({
      items: [],
      next_cursor: null,
    });

    await expect(getPage(accessToken)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("propagates history request errors", async () => {
    const getPage = requireHistoryPage();

    const failure = new Error("History request failed.");

    mockedGet.mockRejectedValue(failure);

    await expect(getPage(accessToken)).rejects.toBe(failure);
  });

  it("loads and normalizes the first photo page", async () => {
    const getPage = requirePhotoPage();

    mockedGet.mockResolvedValue({
      items: [photoResponse],
      next_cursor: photoId,
    });

    const result = await getPage(accessToken);

    expect(mockedGet).toHaveBeenCalledWith("/progress/photos/page?limit=50", {
      headers,
    });

    expect(result).toEqual({
      items: [normalizedPhoto],
      nextCursor: photoId,
    });
  });

  it("requests the next photo page using the cursor", async () => {
    const getPage = requirePhotoPage();

    mockedGet.mockResolvedValue({
      items: [photoResponse],
      next_cursor: null,
    });

    const result = await getPage(accessToken, {
      limit: 10,
      cursor: photoId,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      `/progress/photos/page?limit=10&cursor=${photoId}`,
      { headers },
    );

    expect(result).toEqual({
      items: [normalizedPhoto],
      nextCursor: null,
    });
  });

  it("omits a null photo cursor", async () => {
    const getPage = requirePhotoPage();

    mockedGet.mockResolvedValue({
      items: [],
      next_cursor: null,
    });

    await getPage(accessToken, {
      limit: 100,
      cursor: null,
    });

    expect(mockedGet).toHaveBeenCalledWith("/progress/photos/page?limit=100", {
      headers,
    });
  });

  it("preserves an empty terminal photo page", async () => {
    const getPage = requirePhotoPage();

    mockedGet.mockResolvedValue({
      items: [],
      next_cursor: null,
    });

    await expect(getPage(accessToken)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("propagates photo request errors", async () => {
    const getPage = requirePhotoPage();

    const failure = new Error("Photo request failed.");

    mockedGet.mockRejectedValue(failure);

    await expect(getPage(accessToken)).rejects.toBe(failure);
  });
});
