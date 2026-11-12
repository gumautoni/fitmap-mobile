import type { BodyMetric, BodyMetricType } from "../services/bodyMetricsGoals";

export const MAX_EVOLUTION_POINTS = 30;

export const BODY_EVOLUTION_OPTIONS: readonly {
  type: BodyMetricType;
  label: string;
}[] = [
  { type: "weight", label: "Peso" },
  { type: "waist", label: "Cintura" },
  { type: "chest", label: "Peito" },
  { type: "arm", label: "Braço" },
  { type: "thigh", label: "Coxa" },
  { type: "hip", label: "Quadril" },
];

export interface BodyEvolutionPoint {
  id: string;
  recordedAt: string;
  timestamp: number;
  value: number;
}

export interface BodyEvolutionSeries {
  metricType: BodyMetricType;
  label: string;
  unit: "kg" | "cm";
  totalValidRecords: number;
  points: BodyEvolutionPoint[];
}

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

function normalizeMetricValue(metric: BodyMetric): number | null {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(metric.value)) {
    return null;
  }

  const value = Number(metric.value);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (metric.metricType === "weight") {
    if (metric.unit === "kg") {
      return value;
    }

    if (metric.unit === "lb") {
      return value * KG_PER_LB;
    }

    return null;
  }

  if (metric.unit === "cm") {
    return value;
  }

  if (metric.unit === "in") {
    return value * CM_PER_IN;
  }

  return null;
}

export function buildBodyEvolutionSeries(
  metrics: readonly BodyMetric[],
  metricType: BodyMetricType,
  nowMs: number = Date.now(),
): BodyEvolutionSeries {
  const option = BODY_EVOLUTION_OPTIONS.find(
    (item) => item.type === metricType,
  );

  if (!option) {
    throw new Error("Unsupported body metric type.");
  }

  const points: BodyEvolutionPoint[] = [];

  for (const metric of metrics) {
    if (metric.metricType !== metricType) {
      continue;
    }

    const timestamp = Date.parse(metric.recordedAt);

    if (!Number.isFinite(timestamp) || timestamp > nowMs) {
      continue;
    }

    const value = normalizeMetricValue(metric);

    if (value === null || !Number.isFinite(value)) {
      continue;
    }

    points.push({
      id: metric.id,
      recordedAt: metric.recordedAt,
      timestamp,
      value,
    });
  }

  points.sort(
    (left, right) =>
      left.timestamp - right.timestamp || left.id.localeCompare(right.id),
  );

  return {
    metricType,
    label: option.label,
    unit: metricType === "weight" ? "kg" : "cm",
    totalValidRecords: points.length,
    points: points.slice(-MAX_EVOLUTION_POINTS),
  };
}
