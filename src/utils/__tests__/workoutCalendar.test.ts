import type { WorkoutHistoryItem } from "../../services/trainingSessions";
import {
  getMonthActivitySummary,
  getMonthDates,
  getWeekDates,
  groupCompletedSessions,
  localDateKey,
} from "../workoutCalendar";

function makeSession(id: string, completedAt: string): WorkoutHistoryItem {
  return {
    id,
    sourceWorkoutId: "workout-1",
    workoutName: "Treino A",
    notes: null,
    startedAt: completedAt,
    completedAt,
    createdAt: completedAt,
    updatedAt: completedAt,
  };
}

describe("workout calendar dates", () => {
  it("uses the local date rather than the UTC date", () => {
    const localDate = new Date(2026, 10, 3, 23, 45);

    expect(localDateKey(new Date(localDate.toISOString()))).toBe("2026-11-03");
  });

  it("builds a Monday-to-Sunday week", () => {
    const dates = getWeekDates(new Date(2026, 10, 3));

    expect(dates.map(localDateKey)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("builds November 2026 correctly", () => {
    const dates = getMonthDates(new Date(2026, 10, 1));

    expect(dates.length).toBe(42);

    expect(dates.slice(0, 6)).toEqual([null, null, null, null, null, null]);

    expect(localDateKey(dates[6]!)).toBe("2026-11-01");
    expect(localDateKey(dates[35]!)).toBe("2026-11-30");
  });

  it("handles leap years", () => {
    const dates = getMonthDates(new Date(2024, 1, 1));

    const validDates = dates.filter((date) => date !== null);

    expect(validDates.length).toBe(29);
    expect(localDateKey(validDates[28])).toBe("2024-02-29");
  });

  it("groups sessions on the same local day", () => {
    const first = new Date(2026, 10, 3, 9, 0).toISOString();
    const second = new Date(2026, 10, 3, 20, 0).toISOString();

    const result = groupCompletedSessions([
      makeSession("one", first),
      makeSession("two", second),
    ]);

    expect(result["2026-11-03"].map((item) => item.id)).toEqual(["one", "two"]);
  });

  it("counts active days separately from completed sessions", () => {
    const grouped = groupCompletedSessions([
      makeSession("one", new Date(2026, 10, 3, 9).toISOString()),
      makeSession("two", new Date(2026, 10, 3, 20).toISOString()),
      makeSession("three", new Date(2026, 10, 9, 8).toISOString()),
      makeSession("october", new Date(2026, 9, 31, 18).toISOString()),
    ]);

    expect(getMonthActivitySummary(grouped, new Date(2026, 10, 1))).toEqual({
      activeDays: 2,
      completedSessions: 3,
    });

    expect(getMonthActivitySummary(grouped, new Date(2026, 9, 1))).toEqual({
      activeDays: 1,
      completedSessions: 1,
    });
  });

  it("shows zero activity for months without completed sessions", () => {
    expect(getMonthActivitySummary({}, new Date(2026, 10, 1))).toEqual({
      activeDays: 0,
      completedSessions: 0,
    });
  });

  it("ignores invalid dates", () => {
    const result = groupCompletedSessions([
      makeSession("invalid", "not-a-date"),
    ]);

    expect(result).toEqual({});
  });
});
