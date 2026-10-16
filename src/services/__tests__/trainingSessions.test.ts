import { apiClient } from "../apiClient";
import {
  addSetExecution,
  cancelWorkoutSession,
  finishWorkoutSession,
  getActiveWorkoutSession,
  getWorkoutHistory,
  getWorkoutSession,
  removeSetExecution,
  startWorkoutSession,
  updateExerciseExecution,
  updateSetExecution,
  updateWorkoutSession,
} from "../trainingSessions";

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
const mockedPatch = apiClient.patch as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

const accessToken = "current-access-token";

const workoutSessionResponse = {
  id: "session-123",
  source_workout_id: "workout-123",
  workout_name: "Push Day",
  status: "active",
  notes: null,
  started_at: "2026-10-16T18:00:00Z",
  completed_at: null,
  cancelled_at: null,
  exercises: [
    {
      id: "execution-123",
      exercise_id: "exercise-123",
      exercise_name: "Barbell Bench Press",
      position: 1,
      planned_sets: 4,
      planned_repetitions: 10,
      planned_load: "60.00",
      planned_load_unit: "kg",
      planned_notes: "Controlled eccentric.",
      notes: null,
      is_completed: false,
      completed_at: null,
      sets: [
        {
          id: "set-123",
          position: 1,
          repetitions: 9,
          load: "62.50",
          load_unit: "kg",
          created_at: "2026-10-16T18:05:00Z",
          updated_at: "2026-10-16T18:05:00Z",
        },
      ],
      created_at: "2026-10-16T18:00:00Z",
      updated_at: "2026-10-16T18:05:00Z",
    },
  ],
  created_at: "2026-10-16T18:00:00Z",
  updated_at: "2026-10-16T18:05:00Z",
};

describe("training sessions service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedPatch.mockReset();
    mockedDelete.mockReset();
  });

  it("starts and normalizes a workout session", async () => {
    mockedPost.mockResolvedValue(workoutSessionResponse);

    const result = await startWorkoutSession(accessToken, "workout-123");

    expect(mockedPost).toHaveBeenCalledWith(
      "/training/workouts/workout-123/sessions",
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(result).toEqual({
      id: "session-123",
      sourceWorkoutId: "workout-123",
      workoutName: "Push Day",
      status: "active",
      notes: null,
      startedAt: "2026-10-16T18:00:00Z",
      completedAt: null,
      cancelledAt: null,
      exercises: [
        {
          id: "execution-123",
          exerciseId: "exercise-123",
          exerciseName: "Barbell Bench Press",
          position: 1,
          plannedSets: 4,
          plannedRepetitions: 10,
          plannedLoad: "60.00",
          plannedLoadUnit: "kg",
          plannedNotes: "Controlled eccentric.",
          notes: null,
          isCompleted: false,
          completedAt: null,
          sets: [
            {
              id: "set-123",
              position: 1,
              repetitions: 9,
              load: "62.50",
              loadUnit: "kg",
              createdAt: "2026-10-16T18:05:00Z",
              updatedAt: "2026-10-16T18:05:00Z",
            },
          ],
          createdAt: "2026-10-16T18:00:00Z",
          updatedAt: "2026-10-16T18:05:00Z",
        },
      ],
      createdAt: "2026-10-16T18:00:00Z",
      updatedAt: "2026-10-16T18:05:00Z",
    });
  });

  it("returns null when there is no active workout session", async () => {
    mockedGet.mockResolvedValue(null);

    const result = await getActiveWorkoutSession(accessToken);

    expect(mockedGet).toHaveBeenCalledWith("/training/sessions/active", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(result).toBeNull();
  });

  it("loads and normalizes an existing workout session", async () => {
    mockedGet.mockResolvedValue(workoutSessionResponse);

    const result = await getWorkoutSession(accessToken, "session-123");

    expect(mockedGet).toHaveBeenCalledWith("/training/sessions/session-123", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(result.id).toBe("session-123");
    expect(result.exercises[0].sets[0].loadUnit).toBe("kg");
  });

  it("updates session notes through the authenticated API", async () => {
    mockedPatch.mockResolvedValue({
      ...workoutSessionResponse,
      notes: "Strong workout.",
    });

    const result = await updateWorkoutSession(accessToken, "session-123", {
      notes: "Strong workout.",
    });

    expect(mockedPatch).toHaveBeenCalledWith(
      "/training/sessions/session-123",
      {
        notes: "Strong workout.",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(result.notes).toBe("Strong workout.");
  });

  it("preserves explicit null when clearing exercise notes", async () => {
    mockedPatch.mockResolvedValue(workoutSessionResponse);

    await updateExerciseExecution(accessToken, "session-123", "execution-123", {
      notes: null,
      completed: true,
    });

    expect(mockedPatch).toHaveBeenCalledWith(
      "/training/sessions/session-123/exercises/execution-123",
      {
        notes: null,
        completed: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("records actual set performance using backend field names", async () => {
    mockedPost.mockResolvedValue(workoutSessionResponse);

    await addSetExecution(accessToken, "session-123", "execution-123", {
      repetitions: 9,
      load: "62.50",
      loadUnit: "kg",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/training/sessions/session-123/exercises/execution-123/sets",
      {
        repetitions: 9,
        load: "62.50",
        load_unit: "kg",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("can record a set without load", async () => {
    mockedPost.mockResolvedValue(workoutSessionResponse);

    await addSetExecution(accessToken, "session-123", "execution-123", {
      repetitions: 12,
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/training/sessions/session-123/exercises/execution-123/sets",
      {
        repetitions: 12,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("preserves explicit null values while updating a set", async () => {
    mockedPatch.mockResolvedValue({
      ...workoutSessionResponse,
      exercises: [
        {
          ...workoutSessionResponse.exercises[0],
          sets: [
            {
              ...workoutSessionResponse.exercises[0].sets[0],
              load: null,
              load_unit: null,
            },
          ],
        },
      ],
    });

    await updateSetExecution(
      accessToken,
      "session-123",
      "execution-123",
      "set-123",
      {
        repetitions: 12,
        load: null,
        loadUnit: null,
      },
    );

    expect(mockedPatch).toHaveBeenCalledWith(
      "/training/sessions/session-123/exercises/execution-123/sets/set-123",
      {
        repetitions: 12,
        load: null,
        load_unit: null,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("removes a recorded set through the authenticated API", async () => {
    mockedDelete.mockResolvedValue(null);

    await removeSetExecution(
      accessToken,
      "session-123",
      "execution-123",
      "set-123",
    );

    expect(mockedDelete).toHaveBeenCalledWith(
      "/training/sessions/session-123/exercises/execution-123/sets/set-123",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("finishes and cancels workout sessions through lifecycle endpoints", async () => {
    mockedPost.mockResolvedValue(workoutSessionResponse);

    await finishWorkoutSession(accessToken, "session-123");

    await cancelWorkoutSession(accessToken, "session-456");

    expect(mockedPost).toHaveBeenNthCalledWith(
      1,
      "/training/sessions/session-123/finish",
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect(mockedPost).toHaveBeenNthCalledWith(
      2,
      "/training/sessions/session-456/cancel",
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });

  it("loads and normalizes completed workout history", async () => {
    mockedGet.mockResolvedValue([
      {
        id: "session-123",
        source_workout_id: "workout-123",
        workout_name: "Push Day",
        notes: "Strong workout.",
        started_at: "2026-10-16T18:00:00Z",
        completed_at: "2026-10-16T19:00:00Z",
        created_at: "2026-10-16T18:00:00Z",
        updated_at: "2026-10-16T19:00:00Z",
      },
    ]);

    const result = await getWorkoutHistory(accessToken);

    expect(mockedGet).toHaveBeenCalledWith("/training/history", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(result).toEqual([
      {
        id: "session-123",
        sourceWorkoutId: "workout-123",
        workoutName: "Push Day",
        notes: "Strong workout.",
        startedAt: "2026-10-16T18:00:00Z",
        completedAt: "2026-10-16T19:00:00Z",
        createdAt: "2026-10-16T18:00:00Z",
        updatedAt: "2026-10-16T19:00:00Z",
      },
    ]);
  });

  it("encodes route identifiers before building request paths", async () => {
    mockedGet.mockResolvedValue(workoutSessionResponse);

    await getWorkoutSession(accessToken, "session/with space");

    expect(mockedGet).toHaveBeenCalledWith(
      "/training/sessions/session%2Fwith%20space",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  });
});
