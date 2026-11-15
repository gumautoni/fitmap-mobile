import {
  getWorkoutNoteDraft,
  hasUnsavedWorkoutNotes,
  isWorkoutNoteDirty,
  normalizeWorkoutNote,
  reconcileWorkoutNoteDrafts,
  setWorkoutNoteDraft,
  type WorkoutNoteDrafts,
  type WorkoutNoteSource,
  type WorkoutNoteTarget,
} from "../workoutNoteDrafts";

const sessionTarget = { kind: "session" } as const;

const firstTarget = {
  kind: "exercise",
  exerciseId: "exercise-1",
} as const;

const secondTarget = {
  kind: "exercise",
  exerciseId: "exercise-2",
} as const;

const unknownTarget = {
  kind: "exercise",
  exerciseId: "unknown",
} as const;

const session: WorkoutNoteSource = {
  id: "session-1",
  notes: "Saved session note",
  exercises: [
    {
      id: "exercise-1",
      notes: "Saved exercise note",
    },
    {
      id: "exercise-2",
      notes: null,
    },
  ],
};

function emptyDrafts(): WorkoutNoteDrafts {
  return reconcileWorkoutNoteDrafts(null, session);
}

function edit(
  drafts: WorkoutNoteDrafts | null,
  target: WorkoutNoteTarget,
  value: string,
): WorkoutNoteDrafts {
  return setWorkoutNoteDraft(drafts, session, target, value);
}

describe("normalizeWorkoutNote", () => {
  it("preserves ordinary text", () => {
    expect(normalizeWorkoutNote("Good workout")).toBe("Good workout");
  });

  it("trims boundaries while preserving internal whitespace", () => {
    expect(normalizeWorkoutNote("  First line\nSecond  line  ")).toBe(
      "First line\nSecond  line",
    );
  });

  it("normalizes an empty note to null", () => {
    expect(normalizeWorkoutNote("")).toBeNull();
  });

  it("normalizes whitespace-only notes to null", () => {
    expect(normalizeWorkoutNote(" \n\t ")).toBeNull();
  });
});

describe("workout note drafts", () => {
  it("reads persisted session and exercise notes", () => {
    const drafts = emptyDrafts();

    expect(getWorkoutNoteDraft(drafts, session, sessionTarget)).toBe(
      "Saved session note",
    );

    expect(getWorkoutNoteDraft(drafts, session, firstTarget)).toBe(
      "Saved exercise note",
    );
  });

  it("uses an empty string when no note is stored", () => {
    expect(getWorkoutNoteDraft(emptyDrafts(), session, secondTarget)).toBe("");

    const withoutSessionNote = { ...session, notes: null };

    expect(getWorkoutNoteDraft(null, withoutSessionNote, sessionTarget)).toBe(
      "",
    );
  });

  it("preserves raw session text while typing", () => {
    const drafts = edit(emptyDrafts(), sessionTarget, "  New session note ");

    expect(getWorkoutNoteDraft(drafts, session, sessionTarget)).toBe(
      "  New session note ",
    );

    expect(isWorkoutNoteDirty(drafts, session, sessionTarget)).toBe(true);

    expect(hasUnsavedWorkoutNotes(drafts, session)).toBe(true);
  });

  it("maintains independent drafts for different exercises", () => {
    const first = edit(emptyDrafts(), firstTarget, "First draft");

    const second = edit(first, secondTarget, "Second draft");

    expect(getWorkoutNoteDraft(second, session, firstTarget)).toBe(
      "First draft",
    );

    expect(getWorkoutNoteDraft(second, session, secondTarget)).toBe(
      "Second draft",
    );

    expect(getWorkoutNoteDraft(second, session, sessionTarget)).toBe(
      session.notes,
    );

    expect(hasUnsavedWorkoutNotes(second, session)).toBe(true);
  });

  it("treats clearing a persisted note as an unsaved change", () => {
    const drafts = edit(emptyDrafts(), firstTarget, "");

    expect(getWorkoutNoteDraft(drafts, session, firstTarget)).toBe("");

    expect(isWorkoutNoteDirty(drafts, session, firstTarget)).toBe(true);
  });

  it("preserves equivalent raw text without marking it dirty", () => {
    const value = "  Saved session note  ";

    const drafts = edit(emptyDrafts(), sessionTarget, value);

    expect(getWorkoutNoteDraft(drafts, session, sessionTarget)).toBe(value);

    expect(isWorkoutNoteDirty(drafts, session, sessionTarget)).toBe(false);

    expect(hasUnsavedWorkoutNotes(drafts, session)).toBe(false);
  });

  it("preserves unsaved notes during unrelated session refreshes", () => {
    let drafts = edit(emptyDrafts(), sessionTarget, "Session draft");

    drafts = edit(drafts, firstTarget, "Exercise draft");

    const refreshed: WorkoutNoteSource = {
      ...session,
      exercises: [
        session.exercises[0],
        {
          ...session.exercises[1],
          notes: "Updated on server",
        },
      ],
    };

    const reconciled = reconcileWorkoutNoteDrafts(drafts, refreshed);

    expect(getWorkoutNoteDraft(reconciled, refreshed, sessionTarget)).toBe(
      "Session draft",
    );

    expect(getWorkoutNoteDraft(reconciled, refreshed, firstTarget)).toBe(
      "Exercise draft",
    );

    expect(getWorkoutNoteDraft(reconciled, refreshed, secondTarget)).toBe(
      "Updated on server",
    );
  });

  it("uses refreshed server values for untouched fields", () => {
    const refreshed: WorkoutNoteSource = {
      ...session,
      notes: "Server session update",
      exercises: [
        {
          ...session.exercises[0],
          notes: "Server exercise update",
        },
      ],
    };

    const drafts = reconcileWorkoutNoteDrafts(emptyDrafts(), refreshed);

    expect(getWorkoutNoteDraft(drafts, refreshed, sessionTarget)).toBe(
      "Server session update",
    );

    expect(getWorkoutNoteDraft(drafts, refreshed, firstTarget)).toBe(
      "Server exercise update",
    );
  });

  it("acknowledges only the successfully saved session note", () => {
    let drafts = edit(emptyDrafts(), sessionTarget, "  New saved note  ");

    drafts = edit(drafts, firstTarget, "Unsaved exercise");

    const saved = {
      ...session,
      notes: "New saved note",
    };

    const next = reconcileWorkoutNoteDrafts(drafts, saved, sessionTarget);

    expect(next.sessionNote).toBeUndefined();

    expect(getWorkoutNoteDraft(next, saved, sessionTarget)).toBe(
      "New saved note",
    );

    expect(getWorkoutNoteDraft(next, saved, firstTarget)).toBe(
      "Unsaved exercise",
    );

    expect(isWorkoutNoteDirty(next, saved, sessionTarget)).toBe(false);

    expect(hasUnsavedWorkoutNotes(next, saved)).toBe(true);
  });

  it("acknowledges a cleared exercise note without losing other drafts", () => {
    let drafts = edit(emptyDrafts(), firstTarget, "  ");

    drafts = edit(drafts, sessionTarget, "Unsaved session");

    const saved: WorkoutNoteSource = {
      ...session,
      exercises: [
        { ...session.exercises[0], notes: null },
        session.exercises[1],
      ],
    };

    const next = reconcileWorkoutNoteDrafts(drafts, saved, firstTarget);

    expect(next.exerciseNotes["exercise-1"]).toBeUndefined();

    expect(getWorkoutNoteDraft(next, saved, firstTarget)).toBe("");

    expect(getWorkoutNoteDraft(next, saved, sessionTarget)).toBe(
      "Unsaved session",
    );

    expect(isWorkoutNoteDirty(next, saved, firstTarget)).toBe(false);
  });

  it("retains the draft when the server response does not confirm its value", () => {
    const drafts = edit(emptyDrafts(), firstTarget, "Expected saved value");

    const next = reconcileWorkoutNoteDrafts(drafts, session, firstTarget);

    expect(getWorkoutNoteDraft(next, session, firstTarget)).toBe(
      "Expected saved value",
    );

    expect(isWorkoutNoteDirty(next, session, firstTarget)).toBe(true);
  });

  it("prunes removed exercise drafts while retaining valid drafts", () => {
    let drafts = edit(emptyDrafts(), firstTarget, "Removed draft");

    drafts = edit(drafts, secondTarget, "Remaining draft");

    const refreshed: WorkoutNoteSource = {
      ...session,
      exercises: [session.exercises[1]],
    };

    const next = reconcileWorkoutNoteDrafts(drafts, refreshed);

    expect(next.exerciseNotes["exercise-1"]).toBeUndefined();

    expect(getWorkoutNoteDraft(next, refreshed, secondTarget)).toBe(
      "Remaining draft",
    );

    expect(hasUnsavedWorkoutNotes(next, refreshed)).toBe(true);
  });

  it("resets drafts when a different session is loaded", () => {
    let drafts = edit(emptyDrafts(), sessionTarget, "Old draft");

    drafts = edit(drafts, firstTarget, "Old exercise draft");

    const anotherSession = {
      ...session,
      id: "session-2",
      notes: "Another session",
    };

    const next = reconcileWorkoutNoteDrafts(drafts, anotherSession);

    expect(next.sessionId).toBe("session-2");
    expect(next.sessionNote).toBeUndefined();
    expect(next.exerciseNotes).toEqual({});

    expect(getWorkoutNoteDraft(next, anotherSession, sessionTarget)).toBe(
      "Another session",
    );

    expect(hasUnsavedWorkoutNotes(next, anotherSession)).toBe(false);
  });

  it("ignores drafts belonging to a different session", () => {
    const stale: WorkoutNoteDrafts = {
      sessionId: "old-session",
      sessionNote: "Stale session note",
      exerciseNotes: {
        "exercise-1": "Stale exercise note",
      },
    };

    expect(getWorkoutNoteDraft(stale, session, sessionTarget)).toBe(
      session.notes,
    );

    expect(getWorkoutNoteDraft(stale, session, firstTarget)).toBe(
      session.exercises[0].notes,
    );

    expect(hasUnsavedWorkoutNotes(stale, session)).toBe(false);
  });

  it("ignores unknown exercise targets", () => {
    const drafts = edit(emptyDrafts(), unknownTarget, "Unknown draft");

    expect(drafts.exerciseNotes).toEqual({});

    expect(getWorkoutNoteDraft(drafts, session, unknownTarget)).toBe("");

    expect(isWorkoutNoteDirty(drafts, session, unknownTarget)).toBe(false);
  });

  it("updates immutable draft state without mutating previous state", () => {
    const original: WorkoutNoteDrafts = Object.freeze({
      sessionId: session.id,
      exerciseNotes: Object.freeze({
        "exercise-1": "Previous draft",
      }),
    });

    const updated = edit(original, firstTarget, "Updated draft");

    expect(original.exerciseNotes["exercise-1"]).toBe("Previous draft");

    expect(getWorkoutNoteDraft(updated, session, firstTarget)).toBe(
      "Updated draft",
    );

    expect(updated).not.toBe(original);
    expect(updated.exerciseNotes).not.toBe(original.exerciseNotes);
  });

  it("reports no unsaved notes for untouched session data", () => {
    const drafts = emptyDrafts();

    expect(hasUnsavedWorkoutNotes(drafts, session)).toBe(false);

    expect(isWorkoutNoteDirty(drafts, session, sessionTarget)).toBe(false);
  });

  it("does not mark an unchanged persisted value as dirty", () => {
    const drafts = edit(emptyDrafts(), firstTarget, "Saved exercise note");

    expect(isWorkoutNoteDirty(drafts, session, firstTarget)).toBe(false);

    expect(hasUnsavedWorkoutNotes(drafts, session)).toBe(false);
  });
});

describe("workout note robustness", () => {
  it("robustness: matches Python boundary whitespace normalization", () => {
    const whitespace =
      "\u0009\u000a\u000b\u000c\u000d\u001c\u001d\u001e\u001f" +
      "\u0020\u0085\u00a0\u1680\u2000\u2001\u2002\u2003" +
      "\u2004\u2005\u2006\u2007\u2008\u2009\u200a" +
      "\u2028\u2029\u202f\u205f\u3000";

    expect(normalizeWorkoutNote(whitespace)).toBeNull();

    expect(
      normalizeWorkoutNote(
        `${whitespace}Primeira linha\nSegunda  linha${whitespace}`,
      ),
    ).toBe("Primeira linha\nSegunda  linha");
  });

  it("robustness: preserves non-whitespace Unicode characters recognized by Python", () => {
    expect(normalizeWorkoutNote(" \ufeffNote\ufeff ")).toBe("\ufeffNote\ufeff");

    expect(normalizeWorkoutNote(" \u200bNote\u200b ")).toBe("\u200bNote\u200b");

    expect(normalizeWorkoutNote("\ufeff")).toBe("\ufeff");
    expect(normalizeWorkoutNote("\u200b")).toBe("\u200b");
  });

  it("robustness: removes overrides when returning to the exact persisted value", () => {
    let drafts = edit(emptyDrafts(), sessionTarget, "Temporary session draft");

    drafts = edit(drafts, firstTarget, "Temporary exercise draft");

    drafts = edit(drafts, sessionTarget, "Saved session note");

    drafts = edit(drafts, firstTarget, "Saved exercise note");

    expect(drafts.sessionNote).toBeUndefined();
    expect(drafts.exerciseNotes).toEqual({});
    expect(hasUnsavedWorkoutNotes(drafts, session)).toBe(false);
  });

  it("robustness: preserves newer draft text after an older save is acknowledged", () => {
    const newerDraft = edit(emptyDrafts(), sessionTarget, "Newer local note");

    const olderResponse: WorkoutNoteSource = {
      ...session,
      notes: "Previously submitted note",
    };

    const next = reconcileWorkoutNoteDrafts(
      newerDraft,
      olderResponse,
      sessionTarget,
    );

    expect(getWorkoutNoteDraft(next, olderResponse, sessionTarget)).toBe(
      "Newer local note",
    );

    expect(isWorkoutNoteDirty(next, olderResponse, sessionTarget)).toBe(true);
  });

  it("robustness: preserves raw text when an unrelated refresh matches a local note", () => {
    const drafts = edit(emptyDrafts(), sessionTarget, "  Local note  ");

    const refreshed: WorkoutNoteSource = {
      ...session,
      notes: "Local note",
    };

    const next = reconcileWorkoutNoteDrafts(drafts, refreshed, firstTarget);

    expect(getWorkoutNoteDraft(next, refreshed, sessionTarget)).toBe(
      "  Local note  ",
    );

    expect(isWorkoutNoteDirty(next, refreshed, sessionTarget)).toBe(false);
  });

  it("robustness: handles exercise identifiers without reading inherited properties", () => {
    const specialSession: WorkoutNoteSource = {
      id: "special-session",
      notes: null,
      exercises: [
        {
          id: "__proto__",
          notes: null,
        },
        {
          id: "constructor",
          notes: "Persisted constructor note",
        },
      ],
    };

    const protoTarget = {
      kind: "exercise",
      exerciseId: "__proto__",
    } as const;

    const constructorTarget = {
      kind: "exercise",
      exerciseId: "constructor",
    } as const;

    const initial = reconcileWorkoutNoteDrafts(null, specialSession);

    expect(getWorkoutNoteDraft(initial, specialSession, protoTarget)).toBe("");

    expect(
      getWorkoutNoteDraft(initial, specialSession, constructorTarget),
    ).toBe("Persisted constructor note");

    const edited = setWorkoutNoteDraft(
      initial,
      specialSession,
      protoTarget,
      "Independent draft",
    );

    expect(getWorkoutNoteDraft(edited, specialSession, protoTarget)).toBe(
      "Independent draft",
    );

    expect(getWorkoutNoteDraft(edited, specialSession, constructorTarget)).toBe(
      "Persisted constructor note",
    );

    expect(
      Object.prototype.hasOwnProperty.call(edited.exerciseNotes, "__proto__"),
    ).toBe(true);

    const reconciled = reconcileWorkoutNoteDrafts(edited, specialSession);

    expect(getWorkoutNoteDraft(reconciled, specialSession, protoTarget)).toBe(
      "Independent draft",
    );
  });
});
