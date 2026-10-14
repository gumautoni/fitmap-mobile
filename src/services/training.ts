import { apiClient } from "./apiClient";

export type ExerciseOrigin = "catalog" | "custom";
export type LoadUnit = "kg" | "lb";

export interface TrainingExercise {
  id: string;
  name: string;
  origin: ExerciseOrigin;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSummary {
  id: string;
  name: string;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  position: number;
  targetSets: number | null;
  targetRepetitions: number | null;
  targetLoad: string | null;
  targetLoadUnit: LoadUnit | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workout extends WorkoutSummary {
  exercises: WorkoutExercise[];
}

export interface AddWorkoutExerciseInput {
  exerciseId: string;
  targetSets?: number | null;
  targetRepetitions?: number | null;
  targetLoad?: string | null;
  targetLoadUnit?: LoadUnit | null;
  notes?: string | null;
}

export interface UpdateWorkoutExerciseInput {
  targetSets?: number | null;
  targetRepetitions?: number | null;
  targetLoad?: string | null;
  targetLoadUnit?: LoadUnit | null;
  notes?: string | null;
}

interface ExerciseApiResponse {
  id: string;
  name: string;
  origin: ExerciseOrigin;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkoutSummaryApiResponse {
  id: string;
  name: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkoutExerciseApiResponse {
  id: string;
  exercise_id: string;
  exercise_name: string;
  position: number;
  target_sets: number | null;
  target_repetitions: number | null;
  target_load: string | null;
  target_load_unit: LoadUnit | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkoutApiResponse extends WorkoutSummaryApiResponse {
  exercises: WorkoutExerciseApiResponse[];
}

interface AddWorkoutExercisePayload {
  exercise_id: string;
  target_sets?: number | null;
  target_repetitions?: number | null;
  target_load?: string | null;
  target_load_unit?: LoadUnit | null;
  notes?: string | null;
}

interface UpdateWorkoutExercisePayload {
  target_sets?: number | null;
  target_repetitions?: number | null;
  target_load?: string | null;
  target_load_unit?: LoadUnit | null;
  notes?: string | null;
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeExercise(exercise: ExerciseApiResponse): TrainingExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    origin: exercise.origin,
    isArchived: exercise.is_archived,
    createdAt: exercise.created_at,
    updatedAt: exercise.updated_at,
  };
}

function normalizeWorkoutSummary(
  workout: WorkoutSummaryApiResponse,
): WorkoutSummary {
  return {
    id: workout.id,
    name: workout.name,
    isArchived: workout.is_archived,
    archivedAt: workout.archived_at,
    createdAt: workout.created_at,
    updatedAt: workout.updated_at,
  };
}

function normalizeWorkoutExercise(
  workoutExercise: WorkoutExerciseApiResponse,
): WorkoutExercise {
  return {
    id: workoutExercise.id,
    exerciseId: workoutExercise.exercise_id,
    exerciseName: workoutExercise.exercise_name,
    position: workoutExercise.position,
    targetSets: workoutExercise.target_sets,
    targetRepetitions: workoutExercise.target_repetitions,
    targetLoad: workoutExercise.target_load,
    targetLoadUnit: workoutExercise.target_load_unit,
    notes: workoutExercise.notes,
    createdAt: workoutExercise.created_at,
    updatedAt: workoutExercise.updated_at,
  };
}

function normalizeWorkout(workout: WorkoutApiResponse): Workout {
  return {
    ...normalizeWorkoutSummary(workout),
    exercises: workout.exercises.map(normalizeWorkoutExercise),
  };
}

function buildAddWorkoutExercisePayload(
  input: AddWorkoutExerciseInput,
): AddWorkoutExercisePayload {
  const payload: AddWorkoutExercisePayload = {
    exercise_id: input.exerciseId,
  };

  if (input.targetSets !== undefined) {
    payload.target_sets = input.targetSets;
  }

  if (input.targetRepetitions !== undefined) {
    payload.target_repetitions = input.targetRepetitions;
  }

  if (input.targetLoad !== undefined) {
    payload.target_load = input.targetLoad;
  }

  if (input.targetLoadUnit !== undefined) {
    payload.target_load_unit = input.targetLoadUnit;
  }

  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }

  return payload;
}

function buildUpdateWorkoutExercisePayload(
  input: UpdateWorkoutExerciseInput,
): UpdateWorkoutExercisePayload {
  const payload: UpdateWorkoutExercisePayload = {};

  if (input.targetSets !== undefined) {
    payload.target_sets = input.targetSets;
  }

  if (input.targetRepetitions !== undefined) {
    payload.target_repetitions = input.targetRepetitions;
  }

  if (input.targetLoad !== undefined) {
    payload.target_load = input.targetLoad;
  }

  if (input.targetLoadUnit !== undefined) {
    payload.target_load_unit = input.targetLoadUnit;
  }

  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }

  return payload;
}

export async function getAvailableExercises(
  accessToken: string,
): Promise<TrainingExercise[]> {
  const response = await apiClient.get<ExerciseApiResponse[]>(
    "/training/exercises",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return response.map(normalizeExercise);
}

export async function createCustomExercise(
  accessToken: string,
  name: string,
): Promise<TrainingExercise> {
  const response = await apiClient.post<ExerciseApiResponse>(
    "/training/exercises",
    {
      name,
    },
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeExercise(response);
}

export async function getWorkouts(
  accessToken: string,
  includeArchived = false,
): Promise<WorkoutSummary[]> {
  const path = includeArchived
    ? "/training/workouts?include_archived=true"
    : "/training/workouts";

  const response = await apiClient.get<WorkoutSummaryApiResponse[]>(path, {
    headers: buildAuthorizationHeaders(accessToken),
  });

  return response.map(normalizeWorkoutSummary);
}

export async function createWorkout(
  accessToken: string,
  name: string,
): Promise<Workout> {
  const response = await apiClient.post<WorkoutApiResponse>(
    "/training/workouts",
    {
      name,
    },
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function getWorkout(
  accessToken: string,
  workoutId: string,
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.get<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}`,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function renameWorkout(
  accessToken: string,
  workoutId: string,
  name: string,
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.patch<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}`,
    {
      name,
    },
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function archiveWorkout(
  accessToken: string,
  workoutId: string,
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.post<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}/archive`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function restoreWorkout(
  accessToken: string,
  workoutId: string,
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.post<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}/restore`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function addExerciseToWorkout(
  accessToken: string,
  workoutId: string,
  input: AddWorkoutExerciseInput,
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.post<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}/exercises`,
    buildAddWorkoutExercisePayload(input),
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function updateWorkoutExercise(
  accessToken: string,
  workoutId: string,
  workoutExerciseId: string,
  input: UpdateWorkoutExerciseInput,
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);
  const encodedWorkoutExerciseId = encodeURIComponent(workoutExerciseId);

  const response = await apiClient.patch<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}/exercises/${encodedWorkoutExerciseId}`,
    buildUpdateWorkoutExercisePayload(input),
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}

export async function removeWorkoutExercise(
  accessToken: string,
  workoutId: string,
  workoutExerciseId: string,
): Promise<void> {
  const encodedWorkoutId = encodeURIComponent(workoutId);
  const encodedWorkoutExerciseId = encodeURIComponent(workoutExerciseId);

  await apiClient.delete<null>(
    `/training/workouts/${encodedWorkoutId}/exercises/${encodedWorkoutExerciseId}`,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );
}

export async function reorderWorkoutExercises(
  accessToken: string,
  workoutId: string,
  workoutExerciseIds: string[],
): Promise<Workout> {
  const encodedWorkoutId = encodeURIComponent(workoutId);

  const response = await apiClient.put<WorkoutApiResponse>(
    `/training/workouts/${encodedWorkoutId}/exercises/reorder`,
    {
      workout_exercise_ids: workoutExerciseIds,
    },
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeWorkout(response);
}
