import { apiClient } from "../apiClient";
import {
  addExerciseToWorkout,
  archiveWorkout,
  createCustomExercise,
  createWorkout,
  getAvailableExercises,
  getWorkout,
  getWorkouts,
  removeWorkoutExercise,
  renameWorkout,
  reorderWorkoutExercises,
  restoreWorkout,
  updateWorkoutExercise,
} from "../training";

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedPut = apiClient.put as jest.Mock;
const mockedPatch = apiClient.patch as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

const accessToken = "current-access-token";

const workoutResponse = {
  id: "workout-123",
  name: "Push Day",
  is_archived: false,
  archived_at: null,
  created_at: "2026-10-14T12:00:00Z",
  updated_at: "2026-10-14T12:00:00Z",
  exercises: [
    {
      id: "workout-exercise-123",
      exercise_id: "exercise-123",
      exercise_name: "Barbell Bench Press",
      position: 1,
      target_sets: 4,
      target_repetitions: 8,
      target_load: "60.00",
      target_load_unit: "kg",
      notes: "Controlled movement",
      created_at: "2026-10-14T12:00:00Z",
      updated_at: "2026-10-14T12:00:00Z",
    },
  ],
};

describe("training service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedPut.mockReset();
    mockedPatch.mockReset();
    mockedDelete.mockReset();
  });

  it("loads and normalizes available exercises", async () => {
    mockedGet.mockResolvedValue([
      {
        id: "exercise-123",
        name: "Barbell Bench Press",
        origin: "catalog",
        is_archived: false,
        created_at: "2026-10-14T12:00:00Z",
        updated_at: "2026-10-14T12:00:00Z",
      },
      {
        id: "exercise-456",
        name: "My Custom Exercise",
        origin: "custom",
        is_archived: false,
        created_at: "2026-10-14T12:05:00Z",
        updated_at: "2026-10-14T12:05:00Z",
      },
    ]);

    const result = await getAvailableExercises(accessToken);

    expect(mockedGet).toHaveBeenCalledWith("/training/exercises", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(result).toEqual([
      {
        id: "exercise-123",
        name: "Barbell Bench Press",
        origin: "catalog",
        isArchived: false,
        createdAt: "2026-10-14T12:00:00Z",
        updatedAt: "2026-10-14T12:00:00Z",
      },
      {
        id: "exercise-456",
        name: "My Custom Exercise",
        origin: "custom",
        isArchived: false,
        createdAt: "2026-10-14T12:05:00Z",
        updatedAt: "2026-10-14T12:05:00Z",
      },
    ]);
  });

  it("creates a private custom exercise through the authenticated API", async () => {
    mockedPost.mockResolvedValue({
      id: "exercise-456",
      name: "My Custom Exercise",
      origin: "custom",
      is_archived: false,
      created_at: "2026-10-14T12:05:00Z",
      updated_at: "2026-10-14T12:05:00Z",
    });

    const result = await createCustomExercise(
      accessToken,
      "My Custom Exercise",
    );

    expect(mockedPost).toHaveBeenCalledWith(
      "/training/exercises",
      {
        name: "My Custom Exercise",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(result.origin).toBe("custom");
    expect(result.isArchived).toBe(false);
  });

  it("loads active workouts by default", async () => {
    mockedGet.mockResolvedValue([
      {
        id: "workout-123",
        name: "Push Day",
        is_archived: false,
        archived_at: null,
        created_at: "2026-10-14T12:00:00Z",
        updated_at: "2026-10-14T12:00:00Z",
      },
    ]);

    const result = await getWorkouts(accessToken);

    expect(mockedGet).toHaveBeenCalledWith("/training/workouts", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(result).toEqual([
      {
        id: "workout-123",
        name: "Push Day",
        isArchived: false,
        archivedAt: null,
        createdAt: "2026-10-14T12:00:00Z",
        updatedAt: "2026-10-14T12:00:00Z",
      },
    ]);
  });

  it("can request archived workouts explicitly", async () => {
    mockedGet.mockResolvedValue([]);

    await getWorkouts(accessToken, true);

    expect(mockedGet).toHaveBeenCalledWith(
      "/training/workouts?include_archived=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("creates and normalizes a workout", async () => {
    mockedPost.mockResolvedValue({
      ...workoutResponse,
      exercises: [],
    });

    const result = await createWorkout(accessToken, "Push Day");

    expect(mockedPost).toHaveBeenCalledWith(
      "/training/workouts",
      {
        name: "Push Day",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(result.name).toBe("Push Day");
    expect(result.exercises).toEqual([]);
  });

  it("loads a workout with normalized planned exercise data", async () => {
    mockedGet.mockResolvedValue(workoutResponse);

    const result = await getWorkout(accessToken, "workout-123");

    expect(mockedGet).toHaveBeenCalledWith("/training/workouts/workout-123", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(result.exercises).toEqual([
      {
        id: "workout-exercise-123",
        exerciseId: "exercise-123",
        exerciseName: "Barbell Bench Press",
        position: 1,
        targetSets: 4,
        targetRepetitions: 8,
        targetLoad: "60.00",
        targetLoadUnit: "kg",
        notes: "Controlled movement",
        createdAt: "2026-10-14T12:00:00Z",
        updatedAt: "2026-10-14T12:00:00Z",
      },
    ]);
  });

  it("renames, archives and restores workouts through authenticated endpoints", async () => {
    mockedPatch.mockResolvedValue(workoutResponse);
    mockedPost.mockResolvedValue(workoutResponse);

    await renameWorkout(accessToken, "workout-123", "Updated Push Day");
    await archiveWorkout(accessToken, "workout-123");
    await restoreWorkout(accessToken, "workout-123");

    expect(mockedPatch).toHaveBeenCalledWith(
      "/training/workouts/workout-123",
      {
        name: "Updated Push Day",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(mockedPost).toHaveBeenNthCalledWith(
      1,
      "/training/workouts/workout-123/archive",
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(mockedPost).toHaveBeenNthCalledWith(
      2,
      "/training/workouts/workout-123/restore",
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("adds a planned exercise using the backend field contract", async () => {
    mockedPost.mockResolvedValue(workoutResponse);

    const result = await addExerciseToWorkout(accessToken, "workout-123", {
      exerciseId: "exercise-123",
      targetSets: 4,
      targetRepetitions: 8,
      targetLoad: "60.00",
      targetLoadUnit: "kg",
      notes: "Controlled movement",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/training/workouts/workout-123/exercises",
      {
        exercise_id: "exercise-123",
        target_sets: 4,
        target_repetitions: 8,
        target_load: "60.00",
        target_load_unit: "kg",
        notes: "Controlled movement",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(result.exercises[0].targetLoad).toBe("60.00");
  });

  it("preserves explicit null values during planned exercise updates", async () => {
    mockedPatch.mockResolvedValue({
      ...workoutResponse,
      exercises: [
        {
          ...workoutResponse.exercises[0],
          target_load: null,
          target_load_unit: null,
          notes: null,
        },
      ],
    });

    await updateWorkoutExercise(
      accessToken,
      "workout-123",
      "workout-exercise-123",
      {
        targetLoad: null,
        targetLoadUnit: null,
        notes: null,
      },
    );

    expect(mockedPatch).toHaveBeenCalledWith(
      "/training/workouts/workout-123/exercises/workout-exercise-123",
      {
        target_load: null,
        target_load_unit: null,
        notes: null,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("removes a workout exercise through the authenticated API", async () => {
    mockedDelete.mockResolvedValue(null);

    await removeWorkoutExercise(
      accessToken,
      "workout-123",
      "workout-exercise-123",
    );

    expect(mockedDelete).toHaveBeenCalledWith(
      "/training/workouts/workout-123/exercises/workout-exercise-123",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("reorders workout exercises using persisted workout exercise ids", async () => {
    mockedPut.mockResolvedValue(workoutResponse);

    await reorderWorkoutExercises(accessToken, "workout-123", [
      "workout-exercise-789",
      "workout-exercise-456",
      "workout-exercise-123",
    ]);

    expect(mockedPut).toHaveBeenCalledWith(
      "/training/workouts/workout-123/exercises/reorder",
      {
        workout_exercise_ids: [
          "workout-exercise-789",
          "workout-exercise-456",
          "workout-exercise-123",
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });
});
