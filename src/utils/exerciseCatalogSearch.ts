export interface SearchableExercise {
  id: string;
  name: string;
}

/**
 * Normalizes Portuguese exercise names and user queries.
 * The result is suitable for matching, not for display.
 */
export function normalizeExerciseSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Common gym names mapped to canonical catalog exercises.
 * Keys must use normalized Portuguese catalog names.
 */
const EXERCISE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "supino reto com barra": ["bench press", "supino barra"],
  "flexao de bracos": ["push up", "pushup"],
  "puxada frontal na polia alta": [
    "pulley",
    "pulley frente",
    "lat pulldown",
    "puxador frente",
  ],
  "puxada frontal com pegada supinada": ["pulley supinado", "puxador supinado"],
  "puxada frontal com pegada neutra": ["pulley neutro", "puxador neutro"],
  "remada sentada na polia baixa": ["remada baixa", "cable row"],
  "crucifixo na maquina peck deck": ["voador", "peck deck"],
  "agachamento livre com barra": ["back squat", "squat livre"],
  "levantamento terra romeno": ["rdl", "romanian deadlift"],
  "levantamento terra convencional": ["deadlift", "terra convencional"],
  "flexora de pernas na maquina": ["leg curl"],
  "cadeira extensora": ["leg extension"],
  "elevacao pelvica com barra": ["hip thrust"],
  "triceps na polia alta": ["triceps pulley", "triceps barra"],
  "triceps com corda na polia alta": ["triceps corda"],
  "extensao de triceps acima da cabeca": ["triceps frances"],
  "rosca direta com barra": ["barbell curl", "biceps barra"],
  "rosca martelo com halteres": ["hammer curl"],
};

function matchScore(name: string, query: string): number | null {
  const normalizedName = normalizeExerciseSearch(name);
  const words = normalizedName.split(" ");

  if (normalizedName === query) {
    return 0;
  }

  if (normalizedName.startsWith(query)) {
    return 1;
  }

  if (words.some((word) => word.startsWith(query))) {
    return 2;
  }

  if (normalizedName.includes(query)) {
    return 3;
  }

  const terms = query.split(" ");

  if (
    terms.length > 1 &&
    terms.every((term) => words.some((word) => word.startsWith(term)))
  ) {
    return 3;
  }

  const aliases = EXERCISE_ALIASES[normalizedName] ?? [];

  for (const alias of aliases) {
    if (normalizeExerciseSearch(alias) === query) {
      return 2;
    }
  }

  for (const alias of aliases) {
    if (normalizeExerciseSearch(alias).startsWith(query)) {
      return 4;
    }
  }

  for (const alias of aliases) {
    if (normalizeExerciseSearch(alias).includes(query)) {
      return 5;
    }
  }

  return null;
}

/**
 * Returns matching exercises in relevance order.
 * Preserves the input order when the search is empty.
 */
export function searchCatalogExercises<T extends SearchableExercise>(
  exercises: readonly T[],
  search: string,
): T[] {
  const query = normalizeExerciseSearch(search);

  if (!query) {
    return [...exercises];
  }

  const matches: {
    exercise: T;
    score: number;
    index: number;
  }[] = [];

  exercises.forEach((exercise, index) => {
    const score = matchScore(exercise.name, query);

    if (score !== null) {
      matches.push({ exercise, score, index });
    }
  });

  matches.sort(
    (first, second) =>
      first.score - second.score ||
      first.exercise.name.localeCompare(second.exercise.name, "pt-BR") ||
      first.index - second.index,
  );

  return matches.map(({ exercise }) => exercise);
}

/**
 * Checks whether a proposed custom exercise already exists
 * under the same normalized name.
 */
export function findExistingExercise<T extends SearchableExercise>(
  exercises: readonly T[],
  name: string,
): T | undefined {
  const normalizedName = normalizeExerciseSearch(name);

  if (!normalizedName) {
    return undefined;
  }

  return exercises.find(
    (exercise) => normalizeExerciseSearch(exercise.name) === normalizedName,
  );
}
