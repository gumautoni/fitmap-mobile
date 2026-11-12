import type { BodyMetric } from "../../services/bodyMetricsGoals";
import {
  BODY_EVOLUTION_OPTIONS,
  MAX_EVOLUTION_POINTS,
  buildBodyEvolutionSeries,
} from "../bodyEvolutionChart";

const NOW = Date.parse("2026-11-11T12:00:00Z");

function makeMetric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "metric-default",
    metricType: "weight",
    value: "70.00",
    unit: "kg",
    recordedAt: "2026-11-01T12:00:00Z",
    createdAt: "2026-11-01T12:01:00Z",
    updatedAt: "2026-11-01T12:01:00Z",
    ...overrides,
  };
}

describe("body evolution chart data", () => {
  it("supports all six body measurement types", () => {
    expect(BODY_EVOLUTION_OPTIONS.map((item) => item.type)).toEqual([
      "weight",
      "waist",
      "chest",
      "arm",
      "thigh",
      "hip",
    ]);
  });

  it("orders records chronologically without changing the input", () => {
    const records = [
      makeMetric({
        id: "latest",
        value: "75.00",
        recordedAt: "2026-11-10T12:00:00Z",
      }),
      makeMetric({
        id: "oldest",
        value: "80.00",
        recordedAt: "2026-11-01T12:00:00Z",
      }),
      makeMetric({
        id: "middle",
        value: "77.00",
        recordedAt: "2026-11-05T12:00:00Z",
      }),
    ];

    const originalOrder = records.map((item) => item.id);
    const result = buildBodyEvolutionSeries(records, "weight", NOW);

    expect(result.points.map((point) => point.id)).toEqual([
      "oldest",
      "middle",
      "latest",
    ]);

    expect(result.points.map((point) => point.value)).toEqual([80, 77, 75]);

    expect(records.map((item) => item.id)).toEqual(originalOrder);
  });

  it("converts pounds to kilograms", () => {
    const result = buildBodyEvolutionSeries(
      [
        makeMetric({
          value: "220.46",
          unit: "lb",
        }),
      ],
      "weight",
      NOW,
    );

    expect(result.unit).toBe("kg");
    expect(result.points[0]?.value).toBeCloseTo(100, 1);
  });

  it("converts inches to centimeters", () => {
    const result = buildBodyEvolutionSeries(
      [
        makeMetric({
          metricType: "waist",
          value: "32.00",
          unit: "in",
        }),
      ],
      "waist",
      NOW,
    );

    expect(result.unit).toBe("cm");
    expect(result.points[0]?.value).toBeCloseTo(81.28, 5);
  });

  it("preserves the original metric dates", () => {
    const date = "2026-11-02T15:30:00Z";

    const result = buildBodyEvolutionSeries(
      [makeMetric({ recordedAt: date })],
      "weight",
      NOW,
    );

    expect(result.points[0]?.recordedAt).toBe(date);
    expect(result.points[0]?.timestamp).toBe(Date.parse(date));
  });

  it("does not create artificial intermediate points", () => {
    const result = buildBodyEvolutionSeries(
      [
        makeMetric({
          id: "first",
          recordedAt: "2026-11-01T12:00:00Z",
        }),
        makeMetric({
          id: "last",
          recordedAt: "2026-11-10T12:00:00Z",
        }),
      ],
      "weight",
      NOW,
    );

    expect(result.points).toHaveLength(2);
    expect(result.totalValidRecords).toBe(2);
  });

  it("excludes future-dated records", () => {
    const result = buildBodyEvolutionSeries(
      [
        makeMetric({ id: "past" }),
        makeMetric({
          id: "future",
          recordedAt: "2026-11-12T12:00:00Z",
        }),
      ],
      "weight",
      NOW,
    );

    expect(result.points.map((point) => point.id)).toEqual(["past"]);
  });

  it("excludes invalid numeric values and dates", () => {
    const result = buildBodyEvolutionSeries(
      [
        makeMetric({ id: "valid" }),
        makeMetric({ id: "zero", value: "0.00" }),
        makeMetric({ id: "negative", value: "-10.00" }),
        makeMetric({ id: "nan", value: "NaN" }),
        makeMetric({ id: "infinity", value: "Infinity" }),
        makeMetric({ id: "exponent", value: "1e3" }),
        makeMetric({ id: "precision", value: "70.123" }),
        makeMetric({
          id: "bad-date",
          recordedAt: "invalid",
        }),
      ],
      "weight",
      NOW,
    );

    expect(result.points.map((point) => point.id)).toEqual(["valid"]);
    expect(result.totalValidRecords).toBe(1);
  });

  it("excludes incompatible units and other metric types", () => {
    const result = buildBodyEvolutionSeries(
      [
        makeMetric({ id: "valid" }),
        makeMetric({ id: "wrong-unit", unit: "cm" }),
        makeMetric({
          id: "wrong-type",
          metricType: "waist",
        }),
      ],
      "weight",
      NOW,
    );

    expect(result.points.map((point) => point.id)).toEqual(["valid"]);
  });

  it("uses a stable order for equal timestamps", () => {
    const result = buildBodyEvolutionSeries(
      [makeMetric({ id: "b" }), makeMetric({ id: "a" })],
      "weight",
      NOW,
    );

    expect(result.points.map((point) => point.id)).toEqual(["a", "b"]);
  });

  it("limits charts to the latest 30 valid records", () => {
    const records = Array.from({ length: 33 }, (_, index) =>
      makeMetric({
        id: `metric-${String(index).padStart(2, "0")}`,
        recordedAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
      }),
    );

    const result = buildBodyEvolutionSeries(records, "weight", NOW);

    expect(MAX_EVOLUTION_POINTS).toBe(30);
    expect(result.totalValidRecords).toBe(33);
    expect(result.points).toHaveLength(30);
    expect(result.points[0]?.id).toBe("metric-03");
    expect(result.points.at(-1)?.id).toBe("metric-32");
  });

  it("returns empty series without inventing data", () => {
    const result = buildBodyEvolutionSeries([], "hip", NOW);

    expect(result).toEqual({
      metricType: "hip",
      label: "Quadril",
      unit: "cm",
      totalValidRecords: 0,
      points: [],
    });
  });
});
