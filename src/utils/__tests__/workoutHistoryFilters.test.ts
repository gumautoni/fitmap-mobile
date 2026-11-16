import type { WorkoutHistoryItem } from "../../services/trainingSessions";
import {
  DEFAULT_WORKOUT_HISTORY_FILTERS,
  filterWorkoutHistory,
  type WorkoutHistoryFilters,
} from "../workoutHistoryFilters";

const today = new Date(2026, 10, 15, 12);

function dateAtOffset(
  offset: number,
  hour = 12,
  minute = 0,
  second = 0,
  millisecond = 0,
  reference = today,
): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + offset,
    hour,
    minute,
    second,
    millisecond,
  );
}

function makeSession(
  id: string,
  workoutName: string,
  completedAt: Date | string,
): WorkoutHistoryItem {
  const timestamp =
    completedAt instanceof Date ? completedAt.toISOString() : completedAt;

  return {
    id,
    sourceWorkoutId: "source-" + id,
    workoutName,
    notes: null,
    startedAt: timestamp,
    completedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const history: WorkoutHistoryItem[] = [
  makeSession("today", "Treino A - Peito e tr\u00edceps", dateAtOffset(0)),
  makeSession("recent", "Treino B - Costas e b\u00edceps", dateAtOffset(-3)),
  makeSession("seven", "Treino C - Pernas", dateAtOffset(-6)),
  makeSession("older", "Treino A - Peito e tr\u00edceps", dateAtOffset(-15)),
  makeSession("ninety", "Treino C - Pernas", dateAtOffset(-38)),
  makeSession("oldest", "Treino D - Ombros", dateAtOffset(-100)),
];

function applyFilters(
  filters: Partial<WorkoutHistoryFilters> = {},
  items: readonly WorkoutHistoryItem[] = history,
  reference = today,
): WorkoutHistoryItem[] {
  return filterWorkoutHistory(
    items,
    {
      ...DEFAULT_WORKOUT_HISTORY_FILTERS,
      ...filters,
    },
    reference,
  );
}

function ids(items: readonly WorkoutHistoryItem[]): string[] {
  return items.map((item) => item.id);
}

describe("filterWorkoutHistory", () => {
  it("preserves all sessions without active filters", () => {
    expect(applyFilters()).toEqual(history);
  });

  it("returns a new array without mutating the input", () => {
    const frozen = Object.freeze(
      history.map((item) => Object.freeze({ ...item })),
    );

    const result = applyFilters({}, frozen);

    expect(result).not.toBe(frozen);
    expect(result).toEqual(history);
    expect(frozen).toEqual(history);
  });

  it("returns an empty array for empty history", () => {
    expect(applyFilters({}, [])).toEqual([]);
  });

  it("treats surrounding whitespace as an inactive name query", () => {
    expect(applyFilters({ nameQuery: "  \t  " })).toEqual(history);
  });

  it("matches partial workout names", () => {
    expect(ids(applyFilters({ nameQuery: "Peito" }))).toEqual([
      "today",
      "older",
    ]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(ids(applyFilters({ nameQuery: "  COSTAS  " }))).toEqual(["recent"]);
  });

  it("matches accented names with unaccented queries", () => {
    expect(ids(applyFilters({ nameQuery: "TRICEPS" }))).toEqual([
      "today",
      "older",
    ]);
  });

  it("matches unaccented names with accented queries", () => {
    const items = [
      makeSession("plain", "Treino de Biceps", today),
      makeSession("other", "Treino de Pernas", today),
    ];

    expect(ids(applyFilters({ nameQuery: "b\u00edceps" }, items))).toEqual([
      "plain",
    ]);
  });

  it("supports decomposed Unicode accents", () => {
    expect(ids(applyFilters({ nameQuery: "tri\u0301ceps" }))).toEqual([
      "today",
      "older",
    ]);
  });

  it("returns no sessions when the name does not match", () => {
    expect(applyFilters({ nameQuery: "Abdominal" })).toEqual([]);
  });

  it("filters by the historical workout name snapshot only", () => {
    const item = {
      ...makeSession("snapshot", "Treino original", today),
      notes: "Peito",
      sourceWorkoutId: "peito",
    };

    expect(applyFilters({ nameQuery: "Peito" }, [item])).toEqual([]);

    expect(applyFilters({ nameQuery: "original" }, [item])).toEqual([item]);
  });

  it("preserves distinct sessions with the same workout name", () => {
    expect(ids(applyFilters({ nameQuery: "Treino A" }))).toEqual([
      "today",
      "older",
    ]);
  });

  it("preserves source order instead of sorting filtered sessions", () => {
    const items = [history[3], history[0], history[1]];

    expect(ids(applyFilters({ nameQuery: "Treino A" }, items))).toEqual([
      "older",
      "today",
    ]);
  });

  it("combines period and name filters using AND", () => {
    expect(
      ids(
        applyFilters({
          nameQuery: "peito",
          periodDays: 7,
        }),
      ),
    ).toEqual(["today"]);
  });

  it("returns no matches when combined criteria are incompatible", () => {
    expect(
      applyFilters({
        nameQuery: "Ombros",
        periodDays: 30,
      }),
    ).toEqual([]);
  });

  it("filters the last seven calendar days", () => {
    expect(ids(applyFilters({ periodDays: 7 }))).toEqual([
      "today",
      "recent",
      "seven",
    ]);
  });

  it("filters the last thirty calendar days", () => {
    expect(ids(applyFilters({ periodDays: 30 }))).toEqual([
      "today",
      "recent",
      "seven",
      "older",
    ]);
  });

  it("filters the last ninety calendar days", () => {
    expect(ids(applyFilters({ periodDays: 90 }))).toEqual([
      "today",
      "recent",
      "seven",
      "older",
      "ninety",
    ]);
  });

  it.each([7, 30, 90] as const)(
    "uses inclusive local calendar boundaries for %i days",
    (periodDays) => {
      const items = [
        makeSession("tomorrow", "Treino", dateAtOffset(1, 0)),
        makeSession("today-end", "Treino", dateAtOffset(0, 23, 59, 59, 999)),
        makeSession("today-start", "Treino", dateAtOffset(0, 0)),
        makeSession("first-day", "Treino", dateAtOffset(-(periodDays - 1), 0)),
        makeSession(
          "before-period",
          "Treino",
          dateAtOffset(-periodDays, 23, 59, 59, 999),
        ),
      ];

      expect(ids(applyFilters({ periodDays }, items))).toEqual([
        "today-end",
        "today-start",
        "first-day",
      ]);
    },
  );

  it("uses completion date instead of start or creation date", () => {
    const recentCompletion = {
      ...makeSession("recent-completion", "Treino", today),
      startedAt: dateAtOffset(-8).toISOString(),
      createdAt: dateAtOffset(-8).toISOString(),
    };

    const oldCompletion = {
      ...makeSession("old-completion", "Treino", dateAtOffset(-8)),
      updatedAt: today.toISOString(),
    };

    expect(
      ids(applyFilters({ periodDays: 7 }, [recentCompletion, oldCompletion])),
    ).toEqual(["recent-completion"]);
  });

  it("handles a period crossing a month boundary", () => {
    const reference = new Date(2026, 10, 3, 12);

    const items = [
      makeSession("november", "Treino", new Date(2026, 10, 2)),
      makeSession("october", "Treino", new Date(2026, 9, 31)),
      makeSession("outside", "Treino", new Date(2026, 9, 20)),
    ];

    expect(ids(applyFilters({ periodDays: 7 }, items, reference))).toEqual([
      "november",
      "october",
    ]);
  });

  it("handles a period crossing a year boundary", () => {
    const reference = new Date(2026, 0, 3, 12);

    const items = [
      makeSession("new-year", "Treino", new Date(2026, 0, 1)),
      makeSession("previous-year", "Treino", new Date(2025, 11, 28)),
      makeSession("outside", "Treino", new Date(2025, 11, 27)),
    ];

    expect(ids(applyFilters({ periodDays: 7 }, items, reference))).toEqual([
      "new-year",
      "previous-year",
    ]);
  });

  it("handles February 29 in leap years", () => {
    const reference = new Date(2024, 2, 1, 12);

    const items = [
      makeSession("leap-day", "Treino", new Date(2024, 1, 29)),
      makeSession("first-day", "Treino", new Date(2024, 1, 24)),
      makeSession("outside", "Treino", new Date(2024, 1, 23)),
    ];

    expect(ids(applyFilters({ periodDays: 7 }, items, reference))).toEqual([
      "leap-day",
      "first-day",
    ]);
  });

  it("uses calendar boundaries instead of fixed elapsed hours", () => {
    const reference = new Date(2026, 2, 10, 18);

    const items = [
      makeSession("first-day", "Treino", new Date(2026, 2, 4, 0)),
      makeSession("outside", "Treino", new Date(2026, 2, 3, 23, 59, 59, 999)),
    ];

    expect(ids(applyFilters({ periodDays: 7 }, items, reference))).toEqual([
      "first-day",
    ]);
  });

  it("excludes invalid completion dates from an active period", () => {
    const items = [
      makeSession("invalid", "Treino", "not-a-date"),
      makeSession("valid", "Treino", today),
    ];

    expect(ids(applyFilters({ periodDays: 7 }, items))).toEqual(["valid"]);
  });

  it("preserves invalid completion dates without a period filter", () => {
    const item = makeSession("invalid", "Treino A", "not-a-date");

    expect(applyFilters({ nameQuery: "Treino A" }, [item])).toEqual([item]);
  });

  it("returns no period matches for an invalid reference date", () => {
    expect(
      applyFilters({ periodDays: 7 }, history, new Date(Number.NaN)),
    ).toEqual([]);
  });

  it("does not require a valid reference date without a period filter", () => {
    expect(applyFilters({}, history, new Date(Number.NaN))).toEqual(history);
  });

  it("does not mutate sessions, filters or reference date", () => {
    const items = Object.freeze(
      history.map((item) => Object.freeze({ ...item })),
    );

    const filters: WorkoutHistoryFilters = Object.freeze({
      nameQuery: "Peito",
      periodDays: 30,
    });

    const reference = new Date(today.getTime());
    const originalTime = reference.getTime();

    const result = filterWorkoutHistory(items, filters, reference);

    expect(ids(result)).toEqual(["today", "older"]);
    expect(result[0]).toBe(items[0]);
    expect(items).toEqual(history);
    expect(filters).toEqual({
      nameQuery: "Peito",
      periodDays: 30,
    });
    expect(reference.getTime()).toBe(originalTime);
  });

  it("restores all sessions when filters are cleared", () => {
    expect(ids(applyFilters({ nameQuery: "Peito", periodDays: 7 }))).toEqual([
      "today",
    ]);

    expect(applyFilters(DEFAULT_WORKOUT_HISTORY_FILTERS)).toEqual(history);
  });
});
