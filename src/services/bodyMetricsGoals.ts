import { apiClient } from "./apiClient";

export type BodyMetricType =
  "weight" | "waist" | "chest" | "arm" | "thigh" | "hip";

export type BodyMetricUnit = "kg" | "lb" | "cm" | "in";

export type FitnessGoalProgressStatus =
  "insufficient_data" | "not_calculable" | "in_progress" | "achieved";

export interface BodyMetric {
  id: string;
  metricType: BodyMetricType;
  value: string;
  unit: BodyMetricUnit;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBodyMetricInput {
  metricType: BodyMetricType;
  value: string;
  unit: BodyMetricUnit;
  recordedAt: string;
}

export interface FitnessGoal {
  id: string;
  metricType: BodyMetricType;
  targetValue: string;
  unit: BodyMetricUnit;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFitnessGoalInput {
  metricType: BodyMetricType;
  targetValue: string;
  unit: BodyMetricUnit;
}

export interface FitnessGoalProgress {
  goal: FitnessGoal;
  status: FitnessGoalProgressStatus;
  baselineValue: string | null;
  currentValue: string | null;
  progressPercent: string | null;
}

interface BodyMetricResponse {
  id: string;
  metric_type: BodyMetricType;
  value: string;
  unit: BodyMetricUnit;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

interface FitnessGoalResponse {
  id: string;
  metric_type: BodyMetricType;
  target_value: string;
  unit: BodyMetricUnit;
  created_at: string;
  updated_at: string;
}

interface FitnessGoalProgressResponse {
  goal: FitnessGoalResponse;
  status: FitnessGoalProgressStatus;
  baseline_value: string | null;
  current_value: string | null;
  progress_percent: string | null;
}

function authorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeBodyMetric(response: BodyMetricResponse): BodyMetric {
  return {
    id: response.id,
    metricType: response.metric_type,
    value: response.value,
    unit: response.unit,
    recordedAt: response.recorded_at,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function normalizeFitnessGoal(response: FitnessGoalResponse): FitnessGoal {
  return {
    id: response.id,
    metricType: response.metric_type,
    targetValue: response.target_value,
    unit: response.unit,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function normalizeFitnessGoalProgress(
  response: FitnessGoalProgressResponse,
): FitnessGoalProgress {
  return {
    goal: normalizeFitnessGoal(response.goal),
    status: response.status,
    baselineValue: response.baseline_value,
    currentValue: response.current_value,
    progressPercent: response.progress_percent,
  };
}

function withMetricTypeFilter(
  path: string,
  metricType?: BodyMetricType,
): string {
  if (!metricType) {
    return path;
  }

  return `${path}?metric_type=${encodeURIComponent(metricType)}`;
}

export async function createBodyMetric(
  accessToken: string,
  input: CreateBodyMetricInput,
): Promise<BodyMetric> {
  const response = await apiClient.post<BodyMetricResponse>(
    "/progress/body-metrics",
    {
      metric_type: input.metricType,
      value: input.value,
      unit: input.unit,
      recorded_at: input.recordedAt,
    },
    {
      headers: authorizationHeaders(accessToken),
    },
  );

  return normalizeBodyMetric(response);
}

export async function getBodyMetrics(
  accessToken: string,
  metricType?: BodyMetricType,
): Promise<BodyMetric[]> {
  const response = await apiClient.get<BodyMetricResponse[]>(
    withMetricTypeFilter("/progress/body-metrics", metricType),
    {
      headers: authorizationHeaders(accessToken),
    },
  );

  return response.map(normalizeBodyMetric);
}

export async function createFitnessGoal(
  accessToken: string,
  input: CreateFitnessGoalInput,
): Promise<FitnessGoal> {
  const response = await apiClient.post<FitnessGoalResponse>(
    "/progress/goals",
    {
      metric_type: input.metricType,
      target_value: input.targetValue,
      unit: input.unit,
    },
    {
      headers: authorizationHeaders(accessToken),
    },
  );

  return normalizeFitnessGoal(response);
}

export async function getFitnessGoals(
  accessToken: string,
  metricType?: BodyMetricType,
): Promise<FitnessGoal[]> {
  const response = await apiClient.get<FitnessGoalResponse[]>(
    withMetricTypeFilter("/progress/goals", metricType),
    {
      headers: authorizationHeaders(accessToken),
    },
  );

  return response.map(normalizeFitnessGoal);
}

export async function getFitnessGoalProgress(
  accessToken: string,
  goalId: string,
): Promise<FitnessGoalProgress> {
  const response = await apiClient.get<FitnessGoalProgressResponse>(
    `/progress/goals/${encodeURIComponent(goalId)}/progress`,
    {
      headers: authorizationHeaders(accessToken),
    },
  );

  return normalizeFitnessGoalProgress(response);
}
