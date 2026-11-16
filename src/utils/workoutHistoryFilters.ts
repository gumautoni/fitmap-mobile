import type { WorkoutHistoryItem } from "../services/trainingSessions";

export type WorkoutHistoryPeriod = 7 | 30 | 90 | null;

export interface WorkoutHistoryFilters {
  nameQuery: string;
  periodDays: WorkoutHistoryPeriod;
}

export const DEFAULT_WORKOUT_HISTORY_FILTERS: WorkoutHistoryFilters = {
  nameQuery: "",
  periodDays: null,
};

function normalizeWorkoutName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

interface HistoryPeriodBounds {
  startInclusive: number;
  endExclusive: number;
}

function getPeriodBounds(
  today: Date,
  periodDays: Exclude<WorkoutHistoryPeriod, null>,
): HistoryPeriodBounds | null {
  if (!Number.isFinite(today.getTime())) {
    return null;
  }

  const start = new Date(today.getTime());

  start.setDate(start.getDate() - (periodDays - 1));
  start.setHours(0, 0, 0, 0);

  const end = new Date(today.getTime());

  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);

  const startInclusive = start.getTime();
  const endExclusive = end.getTime();

  if (!Number.isFinite(startInclusive) || !Number.isFinite(endExclusive)) {
    return null;
  }

  return {
    startInclusive,
    endExclusive,
  };
}

export function filterWorkoutHistory(
  history: readonly WorkoutHistoryItem[],
  filters: WorkoutHistoryFilters,
  today: Date,
): WorkoutHistoryItem[] {
  const normalizedQuery = normalizeWorkoutName(filters.nameQuery);

  const bounds =
    filters.periodDays === null
      ? null
      : getPeriodBounds(today, filters.periodDays);

  if (filters.periodDays !== null && bounds === null) {
    return [];
  }

  return history.filter((item) => {
    if (
      normalizedQuery &&
      !normalizeWorkoutName(item.workoutName).includes(normalizedQuery)
    ) {
      return false;
    }

    if (bounds === null) {
      return true;
    }

    const completedAt = new Date(item.completedAt).getTime();

    return (
      Number.isFinite(completedAt) &&
      completedAt >= bounds.startInclusive &&
      completedAt < bounds.endExclusive
    );
  });
}
