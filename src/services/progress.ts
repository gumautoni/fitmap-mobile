import { File, UploadType } from "expo-file-system";

import { environment } from "../config/environment";
import { ApiClientError, apiClient } from "./apiClient";

const PHOTO_UPLOAD_TIMEOUT_MS = 30_000;

export type LoadUnit = "kg" | "lb";

export interface BasicProgressStatistics {
  completedWorkouts: number;
  completedWorkoutsLast7Days: number;
  completedWorkoutsLast30Days: number;
  trainingDaysLast30Days: number;
  totalPerformedSets: number;
}

export interface ExerciseLoadMaximum {
  loadUnit: LoadUnit;
  maxLoad: string;
}

export interface ExercisePerformancePoint {
  workoutSessionId: string;
  completedAt: string;
  performedSets: number;
  totalRepetitions: number;
  maxLoads: ExerciseLoadMaximum[];
}

export interface ExercisePerformance {
  exerciseId: string;
  exerciseName: string;
  points: ExercisePerformancePoint[];
}

export interface ProgressPhoto {
  id: string;
  workoutSessionId: string | null;
  mediaType: string;
  recordedAt: string;
  createdAt: string;
}

export interface UploadProgressPhotoInput {
  uri: string;
  mediaType: string;
  fileName?: string | null;
  recordedAt: string;
  workoutSessionId?: string | null;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface BasicProgressStatisticsResponse {
  completed_workouts: number;
  completed_workouts_last_7_days: number;
  completed_workouts_last_30_days: number;
  training_days_last_30_days: number;
  total_performed_sets: number;
}

interface ExerciseLoadMaximumResponse {
  load_unit: LoadUnit;
  max_load: string;
}

interface ExercisePerformancePointResponse {
  workout_session_id: string;
  completed_at: string;
  performed_sets: number;
  total_repetitions: number;
  max_loads: ExerciseLoadMaximumResponse[];
}

interface ExercisePerformanceResponse {
  exercise_id: string;
  exercise_name: string;
  points: ExercisePerformancePointResponse[];
}

interface ProgressPhotoResponse {
  id: string;
  workout_session_id: string | null;
  media_type: string;
  recorded_at: string;
  created_at: string;
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeStatistics(
  statistics: BasicProgressStatisticsResponse,
): BasicProgressStatistics {
  return {
    completedWorkouts: statistics.completed_workouts,
    completedWorkoutsLast7Days: statistics.completed_workouts_last_7_days,
    completedWorkoutsLast30Days: statistics.completed_workouts_last_30_days,
    trainingDaysLast30Days: statistics.training_days_last_30_days,
    totalPerformedSets: statistics.total_performed_sets,
  };
}

function normalizePerformance(
  performance: ExercisePerformanceResponse,
): ExercisePerformance {
  return {
    exerciseId: performance.exercise_id,
    exerciseName: performance.exercise_name,
    points: performance.points.map((point) => ({
      workoutSessionId: point.workout_session_id,
      completedAt: point.completed_at,
      performedSets: point.performed_sets,
      totalRepetitions: point.total_repetitions,
      maxLoads: point.max_loads.map((load) => ({
        loadUnit: load.load_unit,
        maxLoad: load.max_load,
      })),
    })),
  };
}

function normalizeProgressPhoto(photo: ProgressPhotoResponse): ProgressPhoto {
  return {
    id: photo.id,
    workoutSessionId: photo.workout_session_id,
    mediaType: photo.media_type,
    recordedAt: photo.recorded_at,
    createdAt: photo.created_at,
  };
}

function parseUploadBody(body: string): unknown {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function getUploadErrorDetails(payload: unknown): {
  code: string | null;
  message: string;
} {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const { error } = payload as ApiErrorBody;

    if (error && typeof error === "object") {
      return {
        code: typeof error.code === "string" ? error.code : null,
        message:
          typeof error.message === "string"
            ? error.message
            : "The request could not be completed.",
      };
    }
  }

  return {
    code: null,
    message: "The request could not be completed.",
  };
}

export async function getProgressStatistics(
  accessToken: string,
): Promise<BasicProgressStatistics> {
  const response = await apiClient.get<BasicProgressStatisticsResponse>(
    "/progress/statistics",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeStatistics(response);
}

export async function getExercisePerformance(
  accessToken: string,
): Promise<ExercisePerformance[]> {
  const response = await apiClient.get<ExercisePerformanceResponse[]>(
    "/progress/exercises/performance",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return response.map(normalizePerformance);
}

export async function getProgressPhotos(
  accessToken: string,
): Promise<ProgressPhoto[]> {
  const response = await apiClient.get<ProgressPhotoResponse[]>(
    "/progress/photos",
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return response.map(normalizeProgressPhoto);
}

export async function uploadProgressPhoto(
  accessToken: string,
  input: UploadProgressPhotoInput,
): Promise<ProgressPhoto> {
  const file = new File(input.uri);

  const parameters: Record<string, string> = {
    recorded_at: input.recordedAt,
  };

  if (input.workoutSessionId) {
    parameters.workout_session_id = input.workoutSessionId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    PHOTO_UPLOAD_TIMEOUT_MS,
  );

  try {
    const result = await file.upload(`${environment.apiUrl}/progress/photos`, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "photo",
      mimeType: input.mediaType,
      parameters,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    const payload = parseUploadBody(result.body);

    if (result.status < 200 || result.status >= 300) {
      const error = getUploadErrorDetails(payload);

      throw new ApiClientError(error.message, result.status, error.code);
    }

    return normalizeProgressPhoto(payload as ProgressPhotoResponse);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The request timed out.");
    }

    throw new Error("The backend could not be reached.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getProgressPhotoSource(
  accessToken: string,
  progressPhotoId: string,
): {
  uri: string;
  headers: {
    Authorization: string;
  };
} {
  return {
    uri: `${environment.apiUrl}/progress/photos/${progressPhotoId}/content`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}
