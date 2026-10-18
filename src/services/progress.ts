import { environment } from "../config/environment";
import { apiClient } from "./apiClient";

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
