export interface WorkoutNoteSource {
  readonly id: string;
  readonly notes: string | null;
  readonly exercises: readonly {
    readonly id: string;
    readonly notes: string | null;
  }[];
}

export type WorkoutNoteTarget =
  | { readonly kind: "session" }
  | {
      readonly kind: "exercise";
      readonly exerciseId: string;
    };

export interface WorkoutNoteDrafts {
  readonly sessionId: string;
  readonly sessionNote?: string;
  readonly exerciseNotes: Readonly<Record<string, string>>;
}

// Match the boundary whitespace handled by Python str.strip().
function isNoteWhitespace(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    (code >= 0x1c && code <= 0x20) ||
    code === 0x85 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000
  );
}

export function normalizeWorkoutNote(value: string): string | null {
  let start = 0;
  let end = value.length;

  while (start < end && isNoteWhitespace(value.charCodeAt(start))) {
    start += 1;
  }

  while (end > start && isNoteWhitespace(value.charCodeAt(end - 1))) {
    end -= 1;
  }

  const normalized = value.slice(start, end);

  return normalized || null;
}

function getPersistedWorkoutNote(
  session: WorkoutNoteSource,
  target: WorkoutNoteTarget,
): string | null {
  if (target.kind === "session") {
    return session.notes;
  }

  return (
    session.exercises.find((exercise) => exercise.id === target.exerciseId)
      ?.notes ?? null
  );
}

function normalizePersistedNote(value: string | null): string | null {
  return value === null ? null : normalizeWorkoutNote(value);
}

function noteMatchesPersisted(
  value: string,
  persisted: string | null,
): boolean {
  return normalizeWorkoutNote(value) === normalizePersistedNote(persisted);
}

function createEmptyDrafts(sessionId: string): WorkoutNoteDrafts {
  return {
    sessionId,
    exerciseNotes: {},
  };
}

function getOwnExerciseDraft(
  exerciseNotes: Readonly<Record<string, string>>,
  exerciseId: string,
): string | undefined {
  return Object.prototype.hasOwnProperty.call(exerciseNotes, exerciseId)
    ? exerciseNotes[exerciseId]
    : undefined;
}

export function reconcileWorkoutNoteDrafts(
  current: WorkoutNoteDrafts | null,
  session: WorkoutNoteSource,
  savedTarget?: WorkoutNoteTarget,
): WorkoutNoteDrafts {
  if (!current || current.sessionId !== session.id) {
    return createEmptyDrafts(session.id);
  }

  const validExercises = new Map(
    session.exercises.map((exercise) => [exercise.id, exercise] as const),
  );

  const exerciseNotes = Object.fromEntries(
    Object.entries(current.exerciseNotes).filter(([exerciseId, value]) => {
      const exercise = validExercises.get(exerciseId);

      if (!exercise) {
        return false;
      }

      const wasSaved =
        savedTarget?.kind === "exercise" &&
        savedTarget.exerciseId === exerciseId;

      return !wasSaved || !noteMatchesPersisted(value, exercise.notes);
    }),
  );

  const sessionNote = current.sessionNote;

  const sessionNoteConfirmed =
    savedTarget?.kind === "session" &&
    sessionNote !== undefined &&
    noteMatchesPersisted(sessionNote, session.notes);

  return {
    sessionId: session.id,
    ...(sessionNote !== undefined && !sessionNoteConfirmed
      ? { sessionNote }
      : {}),
    exerciseNotes,
  };
}

export function getWorkoutNoteDraft(
  drafts: WorkoutNoteDrafts | null,
  session: WorkoutNoteSource,
  target: WorkoutNoteTarget,
): string {
  const persisted = getPersistedWorkoutNote(session, target) ?? "";

  if (!drafts || drafts.sessionId !== session.id) {
    return persisted;
  }

  if (target.kind === "session") {
    return drafts.sessionNote ?? persisted;
  }

  if (
    !session.exercises.some((exercise) => exercise.id === target.exerciseId)
  ) {
    return "";
  }

  return (
    getOwnExerciseDraft(drafts.exerciseNotes, target.exerciseId) ?? persisted
  );
}

export function setWorkoutNoteDraft(
  drafts: WorkoutNoteDrafts | null,
  session: WorkoutNoteSource,
  target: WorkoutNoteTarget,
  value: string,
): WorkoutNoteDrafts {
  const current = reconcileWorkoutNoteDrafts(drafts, session);

  let next: WorkoutNoteDrafts;

  if (target.kind === "session") {
    next = {
      ...current,
      sessionNote: value,
    };
  } else {
    const exists = session.exercises.some(
      (exercise) => exercise.id === target.exerciseId,
    );

    if (!exists) {
      return current;
    }

    next = {
      ...current,
      exerciseNotes: Object.fromEntries([
        ...Object.entries(current.exerciseNotes),
        [target.exerciseId, value] as const,
      ]),
    };
  }

  const persisted = getPersistedWorkoutNote(session, target) ?? "";

  if (value === persisted) {
    return reconcileWorkoutNoteDrafts(next, session, target);
  }

  return next;
}

export function isWorkoutNoteDirty(
  drafts: WorkoutNoteDrafts | null,
  session: WorkoutNoteSource,
  target: WorkoutNoteTarget,
): boolean {
  const value = getWorkoutNoteDraft(drafts, session, target);

  const persisted = getPersistedWorkoutNote(session, target);

  return !noteMatchesPersisted(value, persisted);
}

export function hasUnsavedWorkoutNotes(
  drafts: WorkoutNoteDrafts | null,
  session: WorkoutNoteSource,
): boolean {
  if (!drafts || drafts.sessionId !== session.id) {
    return false;
  }

  if (isWorkoutNoteDirty(drafts, session, { kind: "session" })) {
    return true;
  }

  return session.exercises.some((exercise) =>
    isWorkoutNoteDirty(drafts, session, {
      kind: "exercise",
      exerciseId: exercise.id,
    }),
  );
}
