import { apiClient } from "../apiClient";
import {
  getExercisePerformance,
  getProgressPhotos,
  getProgressPhotoSource,
  getProgressStatistics,
} from "../progress";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

describe("progress service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("loads and normalizes basic progress statistics", async () => {
    mockedGet.mockResolvedValue({
      completed_workouts: 12,
      completed_workouts_last_7_days: 3,
      completed_workouts_last_30_days: 9,
      training_days_last_30_days: 8,
      total_performed_sets: 84,
    });

    const result = await getProgressStatistics("current-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/progress/statistics", {
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });

    expect(result).toEqual({
      completedWorkouts: 12,
      completedWorkoutsLast7Days: 3,
      completedWorkoutsLast30Days: 9,
      trainingDaysLast30Days: 8,
      totalPerformedSets: 84,
    });
  });

  it("loads and normalizes exercise performance history", async () => {
    mockedGet.mockResolvedValue([
      {
        exercise_id: "exercise-123",
        exercise_name: "Supino reto",
        points: [
          {
            workout_session_id: "session-1",
            completed_at: "2026-10-10T18:00:00Z",
            performed_sets: 3,
            total_repetitions: 30,
            max_loads: [
              {
                load_unit: "kg",
                max_load: "40.00",
              },
            ],
          },
          {
            workout_session_id: "session-2",
            completed_at: "2026-10-17T18:00:00Z",
            performed_sets: 3,
            total_repetitions: 24,
            max_loads: [
              {
                load_unit: "kg",
                max_load: "45.00",
              },
            ],
          },
        ],
      },
    ]);

    const result = await getExercisePerformance("current-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/progress/exercises/performance", {
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });

    expect(result).toEqual([
      {
        exerciseId: "exercise-123",
        exerciseName: "Supino reto",
        points: [
          {
            workoutSessionId: "session-1",
            completedAt: "2026-10-10T18:00:00Z",
            performedSets: 3,
            totalRepetitions: 30,
            maxLoads: [
              {
                loadUnit: "kg",
                maxLoad: "40.00",
              },
            ],
          },
          {
            workoutSessionId: "session-2",
            completedAt: "2026-10-17T18:00:00Z",
            performedSets: 3,
            totalRepetitions: 24,
            maxLoads: [
              {
                loadUnit: "kg",
                maxLoad: "45.00",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("loads progress photo metadata without exposing storage keys", async () => {
    mockedGet.mockResolvedValue([
      {
        id: "photo-123",
        workout_session_id: null,
        media_type: "image/jpeg",
        recorded_at: "2026-10-17T18:00:00Z",
        created_at: "2026-10-17T18:01:00Z",
      },
    ]);

    const result = await getProgressPhotos("current-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/progress/photos", {
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });

    expect(result).toEqual([
      {
        id: "photo-123",
        workoutSessionId: null,
        mediaType: "image/jpeg",
        recordedAt: "2026-10-17T18:00:00Z",
        createdAt: "2026-10-17T18:01:00Z",
      },
    ]);
  });

  it("builds an authenticated private progress photo source", () => {
    const source = getProgressPhotoSource("current-access-token", "photo-123");

    expect(source).toEqual({
      uri: "http://test-api/api/v1/progress/photos/photo-123/content",
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });
  });
});
