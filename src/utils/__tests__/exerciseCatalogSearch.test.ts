import {
  findExistingExercise,
  normalizeExerciseSearch,
  searchCatalogExercises,
} from "../exerciseCatalogSearch";

const exercises = [
  { id: "1", name: "Supino reto com barra" },
  { id: "2", name: "Supino inclinado com halteres" },
  { id: "3", name: "Flex\u00e3o de bra\u00e7os" },
  { id: "4", name: "Puxada frontal na polia alta" },
  { id: "5", name: "Crucifixo na m\u00e1quina (peck deck)" },
  { id: "6", name: "Rosca martelo com halteres" },
  { id: "7", name: "Eleva\u00e7\u00e3o p\u00e9lvica com barra" },
  { id: "8", name: "Remada unilateral com halter" },
];

describe("exercise catalog search", () => {
  it("normalizes accents, case, spacing and punctuation", () => {
    expect(normalizeExerciseSearch("  TR\u00cdCEPS---na   POLIA  ")).toBe(
      "triceps na polia",
    );
  });

  it("finds Portuguese names without requiring accents", () => {
    const results = searchCatalogExercises(exercises, "FLEXAO");

    expect(results.map((item) => item.id)).toEqual(["3"]);
  });

  it("ranks name prefixes ahead of other matching words", () => {
    const results = searchCatalogExercises(exercises, "sup");

    expect(results.map((item) => item.id)).toEqual(["2", "1"]);
  });

  it("finds multiple words using partial terms", () => {
    const results = searchCatalogExercises(exercises, "rosca mart");

    expect(results.map((item) => item.id)).toEqual(["6"]);
  });

  it("recognizes popular alternative gym names", () => {
    expect(
      searchCatalogExercises(exercises, "pulley").map((item) => item.id),
    ).toEqual(["4"]);

    expect(
      searchCatalogExercises(exercises, "voador").map((item) => item.id),
    ).toEqual(["5"]);

    expect(
      searchCatalogExercises(exercises, "hip thrust").map((item) => item.id),
    ).toEqual(["7"]);
  });

  it("matches a word in the middle of an exercise name", () => {
    expect(
      searchCatalogExercises(exercises, "unilateral").map((item) => item.id),
    ).toEqual(["8"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchCatalogExercises(exercises, "nao existe")).toEqual([]);
  });

  it("preserves the available list for an empty query", () => {
    expect(searchCatalogExercises(exercises, "  ")).toEqual(exercises);
  });

  it("detects equivalent names before custom creation", () => {
    expect(findExistingExercise(exercises, "FLEXAO DE BRACOS")?.id).toBe("3");

    expect(findExistingExercise(exercises, "exercicio novo")).toBeUndefined();
  });
});
