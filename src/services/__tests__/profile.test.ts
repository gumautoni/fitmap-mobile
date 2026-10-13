import { apiClient } from "../apiClient";
import { getProfile, updateProfile } from "../profile";

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPatch = apiClient.patch as jest.Mock;

describe("profile service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPatch.mockReset();
  });

  it("loads the authenticated user profile and normalizes the response", async () => {
    mockedGet.mockResolvedValue({
      id: "user-123",
      name: "FitMap User",
      email: "user@example.com",
      created_at: "2026-10-13T12:00:00Z",
      fitness_goal: "muscle_gain",
      experience_level: "intermediate",
      weekly_workout_goal: 4,
      preferred_workout_duration_minutes: 60,
      measurement_system: "metric",
    });

    const result = await getProfile("current-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/profile", {
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });

    expect(result).toEqual({
      id: "user-123",
      name: "FitMap User",
      email: "user@example.com",
      createdAt: "2026-10-13T12:00:00Z",
      fitnessGoal: "muscle_gain",
      experienceLevel: "intermediate",
      weeklyWorkoutGoal: 4,
      preferredWorkoutDurationMinutes: 60,
      measurementSystem: "metric",
    });
  });

  it("normalizes an incomplete fitness profile without inventing defaults", async () => {
    mockedGet.mockResolvedValue({
      id: "user-123",
      name: "New User",
      email: "new@example.com",
      created_at: "2026-10-13T12:00:00Z",
      fitness_goal: null,
      experience_level: null,
      weekly_workout_goal: null,
      preferred_workout_duration_minutes: null,
      measurement_system: null,
    });

    const result = await getProfile("current-access-token");

    expect(result).toEqual({
      id: "user-123",
      name: "New User",
      email: "new@example.com",
      createdAt: "2026-10-13T12:00:00Z",
      fitnessGoal: null,
      experienceLevel: null,
      weeklyWorkoutGoal: null,
      preferredWorkoutDurationMinutes: null,
      measurementSystem: null,
    });
  });

  it("updates profile fields using the backend API contract", async () => {
    mockedPatch.mockResolvedValue({
      id: "user-123",
      name: "Updated User",
      email: "user@example.com",
      created_at: "2026-10-13T12:00:00Z",
      fitness_goal: "strength",
      experience_level: "advanced",
      weekly_workout_goal: 5,
      preferred_workout_duration_minutes: 75,
      measurement_system: "imperial",
    });

    const result = await updateProfile("current-access-token", {
      name: "Updated User",
      fitnessGoal: "strength",
      experienceLevel: "advanced",
      weeklyWorkoutGoal: 5,
      preferredWorkoutDurationMinutes: 75,
      measurementSystem: "imperial",
    });

    expect(mockedPatch).toHaveBeenCalledWith(
      "/profile",
      {
        name: "Updated User",
        fitness_goal: "strength",
        experience_level: "advanced",
        weekly_workout_goal: 5,
        preferred_workout_duration_minutes: 75,
        measurement_system: "imperial",
      },
      {
        headers: {
          Authorization: "Bearer current-access-token",
        },
      },
    );

    expect(result).toEqual({
      id: "user-123",
      name: "Updated User",
      email: "user@example.com",
      createdAt: "2026-10-13T12:00:00Z",
      fitnessGoal: "strength",
      experienceLevel: "advanced",
      weeklyWorkoutGoal: 5,
      preferredWorkoutDurationMinutes: 75,
      measurementSystem: "imperial",
    });
  });

  it("preserves partial updates and explicit null values", async () => {
    mockedPatch.mockResolvedValue({
      id: "user-123",
      name: "FitMap User",
      email: "user@example.com",
      created_at: "2026-10-13T12:00:00Z",
      fitness_goal: null,
      experience_level: "intermediate",
      weekly_workout_goal: 3,
      preferred_workout_duration_minutes: 60,
      measurement_system: "metric",
    });

    await updateProfile("current-access-token", {
      fitnessGoal: null,
      weeklyWorkoutGoal: 3,
    });

    expect(mockedPatch).toHaveBeenCalledWith(
      "/profile",
      {
        fitness_goal: null,
        weekly_workout_goal: 3,
      },
      {
        headers: {
          Authorization: "Bearer current-access-token",
        },
      },
    );
  });
});
