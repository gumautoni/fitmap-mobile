import { apiClient } from "./apiClient";
import type { LoadUnit } from "./training";

export type WorkoutSessionStatus = "active" | "completed" | "cancelled";

export interface SetExecution {
  id: string;
  position: number;
  repetitions: number;
  load: string | null;
  loadUnit: LoadUnit | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseExecution {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  position: number;
  plannedSets: number | null;
  plannedRepetitions: number | null;
  plannedLoad: string | null;
  plannedLoadUnit: LoadUnit | null;
  plannedNotes: string | null;
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  sets: SetExecution[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSession {
  id: string;
  sourceWorkoutId: string | null;
  workoutName: string;
  status: WorkoutSessionStatus;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  exercises: ExerciseExecution[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutHistoryItem {
  id: string;
  sourceWorkoutId: string | null;
  workoutName: string;
  notes: string | null;
  startedAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkoutSessionInput {
  notes: string | null;
}

export interface UpdateExerciseExecutionInput {
  notes?: string | null;
  completed?: boolean;
}

export interface CreateSetExecutionInput {
  repetitions: number;
  load?: string | null;
  loadUnit?: LoadUnit | null;
}

export interface UpdateSetExecutionInput {
  repetitions?: number;
  load?: string | null;
  loadUnit?: LoadUnit | null;
}

interface SetExecutionApiResponse {
  id: string;
  position: number;
  repetitions: number;
  load: string | null;
  load_unit: LoadUnit | null;
  created_at: string;
  updated_at: string;
}

interface ExerciseExecutionApiResponse {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  position: number;
  planned_sets: number | null;
  planned_repetitions: number | null;
  planned_load: string | null;
  planned_load_unit: LoadUnit | null;
  planned_notes: string | null;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sets: SetExecutionApiResponse[];
  created_at: string;
  updated_at: string;
}

interface WorkoutSessionApiResponse {
  id: string;
  source_workout_id: string | null;
  workout_name: string;
  status: WorkoutSessionStatus;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  exercises: ExerciseExecutionApiResponse[];
  created_at: string;
  updated_at: string;
}

interface WorkoutHistoryApiResponse {
  id: string;
  source_workout_id: string | null;
  workout_name: string;
  notes: string | null;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

interface UpdateWorkoutSessionPayload {
  notes: string | null;
}

interface UpdateExerciseExecutionPayload {
  notes?: string | null;
  completed?: boolean;
}

interface CreateSetExecutionPayload {
  repetitions: number;
  load?: string | null;
  load_unit?: LoadUnit | null;
}

interface UpdateSetExecutionPayload {
  repetitions?: number;
  load?: string | null;
  load_unit?: LoadUnit | null;
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeSetExecution(
  setExecution: SetExecutionApiResponse,
): SetExecution {
  return {
    id: setExecution.id,
    position: setExecution.position,
    repetitions: setExecution.repetitions,
    load: setExecution.load,
    loadUnit: setExecution.load_unit,
    createdAt: setExecution.created_at,
    updatedAt: setExecution.updated_at,
  };
}

function normalizeExerciseExecution(
  exerciseExecution: ExerciseExecutionApiResponse,
): ExerciseExecution {
  return {
    id: exerciseExecution.id,
    exerciseId: exerciseExecution.exercise_id,
    exerciseName: exerciseExecution.exercise_name,
    position: exerciseExecution.position,
    plannedSets: exerciseExecution.planned_sets,
    plannedRepetitions: exerciseExecution.planned_repetitions,
    plannedLoad: exerciseExecution.planned_load,
    plannedLoadUnit: exerciseExecution.planned_load_unit,
    plannedNotes: exerciseExecution.planned_notes,
    notes: exerciseExecution.notes,
    isCompleted: exerciseExecution.is_completed,
    completedAt: exerciseExecution.completed_at,
    sets: exerciseExecution.sets.map(normalizeSetExecution),
    createdAt: exerciseExecution.created_at,
    updatedAt: exerciseExecution.updated_at,
  };
}

function normalizeWorkoutSession(
  workoutSession: WorkoutSessionApiResponse,
): WorkoutSession {
  return {
    id: workoutSession.id,
    sourceWorkoutId: workoutSession.source_workout_id,
    workoutName: workoutSession.workout_name,
    status: workoutSession.status,
    notes: workoutSession.notes,
    startedAt: workoutSession.started_at,
    completedAt: workoutSession.completed_at,
    cancelledAt: workoutSession.cancelled_at,
    exercises: workoutSession.exercises.map(normalizeExerciseExecution),
    createdAt: workoutSession.created_at,
    updatedAt: workoutSession.updated_at,
  };
}

function normalizeWorkoutHistoryItem(
  workoutSession: WorkoutHistoryApiResponse,
): WorkoutHistoryItem {
  return {
    id: workoutSession.id,
    sourceWorkoutId: workoutSession.source_workout_id,
    workoutName: workoutSession.workout_name,
    notes: workoutSession.notes,
    startedAt: workoutSession.started_at,
    completedAt: workoutSession.completed_at,
    createdAt: workoutSession.created_at,
    updatedAt: workoutSession.updated_at,
  };
}

function buildExerciseExecutionPayload(
  input: UpdateExerciseExecutionInput,
): UpdateExerciseExecutionPayload {
  const payload: UpdateExerciseExecutionPayload = {};

  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }

  if (input.completed !== undefined) {
    payload.completed = input.completed;
  }

  return payload;
}

function buildCreateSetExecutionPayload(
  input: CreateSetExecutionInput,
): CreateSetExecutionPayload {
  const payload: CreateSetExecutionPayload = {
    repetitions: input.repetitions,
  };

  if (input.load !== undefined) {
    payload.load = input.load;
  }

  if (input.loadUnit !== undefined) {
    payload.load_unit = input.loadUnit;
  }

  return payload;
}

function buildUpdateSetExecutionPayload(
  input: UpdateSetExecutionInput,
): UpdateSetExecutionPayload {
  const payload: UpdateSetExecutionPayload = {};

  if (input.repetitions !== undefined) {
    payload.repetitions = input.repetitions;
  }

  if (input.load !== undefined) {
    payload.load = input.load;
  }

  if (input.loadUnit !== undefined) {
    payload.load_unit = input.loadUnit;
  }

  return payload;
}

export async function startWorkoutSession(
  accessToken: string,
  workoutId: string,
): Promise<WorkoutSession> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.post<WorkoutSessionApiResponse>(
    `/training/workouts/${encodedWorkoutId}/sessions`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function getActiveWorkoutSession(
  accessToken: string,
): Promise<WorkoutSession | null> {
  const response = await apiClient.get<WorkoutSessionApiResponse | null>(
    "/training/sessions/active",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  if (response === null) {
    return null;
  }

  return normalizeWorkoutSession(response);
}

export async function getWorkoutSession(
  accessToken: string,
  workoutSessionId: string,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);

  const response = await apiClient.get<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}`,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function updateWorkoutSession(
  accessToken: string,
  workoutSessionId: string,
  input: UpdateWorkoutSessionInput,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);

  const payload: UpdateWorkoutSessionPayload = {
    notes: input.notes,
  };

  const response = await apiClient.patch<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}`,
    payload,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function finishWorkoutSession(
  accessToken: string,
  workoutSessionId: string,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);

  const response = await apiClient.post<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}/finish`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function cancelWorkoutSession(
  accessToken: string,
  workoutSessionId: string,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);

  const response = await apiClient.post<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}/cancel`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function updateExerciseExecution(
  accessToken: string,
  workoutSessionId: string,
  exerciseExecutionId: string,
  input: UpdateExerciseExecutionInput,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);
  const encodedExerciseExecutionId = encodeURIComponent(exerciseExecutionId);

  const response = await apiClient.patch<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}/exercises/${encodedExerciseExecutionId}`,
    buildExerciseExecutionPayload(input),
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function addSetExecution(
  accessToken: string,
  workoutSessionId: string,
  exerciseExecutionId: string,
  input: CreateSetExecutionInput,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);
  const encodedExerciseExecutionId = encodeURIComponent(exerciseExecutionId);

  const response = await apiClient.post<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}/exercises/${encodedExerciseExecutionId}/sets`,
    buildCreateSetExecutionPayload(input),
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function updateSetExecution(
  accessToken: string,
  workoutSessionId: string,
  exerciseExecutionId: string,
  setExecutionId: string,
  input: UpdateSetExecutionInput,
): Promise<WorkoutSession> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);
  const encodedExerciseExecutionId = encodeURIComponent(exerciseExecutionId);
  const encodedSetExecutionId = encodeURIComponent(setExecutionId);

  const response = await apiClient.patch<WorkoutSessionApiResponse>(
    `/training/sessions/${encodedWorkoutSessionId}/exercises/${encodedExerciseExecutionId}/sets/${encodedSetExecutionId}`,
    buildUpdateSetExecutionPayload(input),
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkoutSession(response);
}

export async function removeSetExecution(
  accessToken: string,
  workoutSessionId: string,
  exerciseExecutionId: string,
  setExecutionId: string,
): Promise<void> {
  const encodedWorkoutSessionId = encodeURIComponent(workoutSessionId);
  const encodedExerciseExecutionId = encodeURIComponent(exerciseExecutionId);
  const encodedSetExecutionId = encodeURIComponent(setExecutionId);

  await apiClient.delete<null>(
    `/training/sessions/${encodedWorkoutSessionId}/exercises/${encodedExerciseExecutionId}/sets/${encodedSetExecutionId}`,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );
}

export async function getWorkoutHistory(
  accessToken: string,
): Promise<WorkoutHistoryItem[]> {
  const response = await apiClient.get<WorkoutHistoryApiResponse[]>(
    "/training/history",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return response.map(normalizeWorkoutHistoryItem);
}
