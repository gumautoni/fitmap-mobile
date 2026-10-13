import { apiClient } from "./apiClient";

export type FitnessGoal =
  "muscle_gain" | "strength" | "general_fitness" | "endurance" | "fat_loss";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type MeasurementSystem = "metric" | "imperial";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  fitnessGoal: FitnessGoal | null;
  experienceLevel: ExperienceLevel | null;
  weeklyWorkoutGoal: number | null;
  preferredWorkoutDurationMinutes: number | null;
  measurementSystem: MeasurementSystem | null;
}

export interface UpdateProfileInput {
  name?: string;
  fitnessGoal?: FitnessGoal | null;
  experienceLevel?: ExperienceLevel | null;
  weeklyWorkoutGoal?: number | null;
  preferredWorkoutDurationMinutes?: number | null;
  measurementSystem?: MeasurementSystem | null;
}

interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  created_at: string;
  fitness_goal: FitnessGoal | null;
  experience_level: ExperienceLevel | null;
  weekly_workout_goal: number | null;
  preferred_workout_duration_minutes: number | null;
  measurement_system: MeasurementSystem | null;
}

interface ProfileUpdatePayload {
  name?: string;
  fitness_goal?: FitnessGoal | null;
  experience_level?: ExperienceLevel | null;
  weekly_workout_goal?: number | null;
  preferred_workout_duration_minutes?: number | null;
  measurement_system?: MeasurementSystem | null;
}

function normalizeProfile(profile: ProfileResponse): UserProfile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    createdAt: profile.created_at,
    fitnessGoal: profile.fitness_goal,
    experienceLevel: profile.experience_level,
    weeklyWorkoutGoal: profile.weekly_workout_goal,
    preferredWorkoutDurationMinutes: profile.preferred_workout_duration_minutes,
    measurementSystem: profile.measurement_system,
  };
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function buildProfileUpdatePayload(
  input: UpdateProfileInput,
): ProfileUpdatePayload {
  const payload: ProfileUpdatePayload = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }

  if (input.fitnessGoal !== undefined) {
    payload.fitness_goal = input.fitnessGoal;
  }

  if (input.experienceLevel !== undefined) {
    payload.experience_level = input.experienceLevel;
  }

  if (input.weeklyWorkoutGoal !== undefined) {
    payload.weekly_workout_goal = input.weeklyWorkoutGoal;
  }

  if (input.preferredWorkoutDurationMinutes !== undefined) {
    payload.preferred_workout_duration_minutes =
      input.preferredWorkoutDurationMinutes;
  }

  if (input.measurementSystem !== undefined) {
    payload.measurement_system = input.measurementSystem;
  }

  return payload;
}

export async function getProfile(accessToken: string): Promise<UserProfile> {
  const response = await apiClient.get<ProfileResponse>("/profile", {
    headers: buildAuthorizationHeaders(accessToken),
  });

  return normalizeProfile(response);
}

export async function updateProfile(
  accessToken: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const response = await apiClient.patch<ProfileResponse>(
    "/profile",
    buildProfileUpdatePayload(input),
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeProfile(response);
}
