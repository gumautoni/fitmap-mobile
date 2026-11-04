import type { WorkoutHistoryItem } from "../services/trainingSessions";

export function localDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getWeekDates(today: Date): Date[] {
  const mondayOffset = (today.getDay() + 6) % 7;

  return Array.from({ length: 7 }, (_, index) => {
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - mondayOffset + index,
    );
  });
}

export function getMonthDates(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDay = new Date(year, monthIndex, 1);
  const offset = (firstDay.getDay() + 6) % 7;

  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((offset + totalDays) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - offset + 1;

    if (dayNumber < 1 || dayNumber > totalDays) {
      return null;
    }

    return new Date(year, monthIndex, dayNumber);
  });
}

export function groupCompletedSessions(
  history: WorkoutHistoryItem[],
): Record<string, WorkoutHistoryItem[]> {
  const grouped: Record<string, WorkoutHistoryItem[]> = {};

  for (const item of history) {
    const key = localDateKey(new Date(item.completedAt));

    if (!key) {
      continue;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(item);
  }

  return grouped;
}

export function getMonthActivitySummary(
  grouped: Record<string, WorkoutHistoryItem[]>,
  month: Date,
): { activeDays: number; completedSessions: number } {
  const year = month.getFullYear();
  const monthNumber = String(month.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}-${monthNumber}-`;

  let activeDays = 0;
  let completedSessions = 0;

  for (const [dateKey, sessions] of Object.entries(grouped)) {
    if (!dateKey.startsWith(prefix) || sessions.length === 0) {
      continue;
    }

    activeDays += 1;
    completedSessions += sessions.length;
  }

  return { activeDays, completedSessions };
}
