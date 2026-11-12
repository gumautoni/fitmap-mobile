import { apiClient } from "./apiClient";

export interface BmiSnapshot {
  heightCm: string | null;
  weightKg: string | null;
  bmi: string | null;
  weightRecordedAt: string | null;
}

interface BmiResponse {
  height_cm: string | null;
  weight_kg: string | null;
  bmi: string | null;
  weight_recorded_at: string | null;
}

export async function getBmiSnapshot(
  accessToken: string,
): Promise<BmiSnapshot> {
  const response = await apiClient.get<BmiResponse>("/progress/bmi", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return {
    heightCm: response.height_cm,
    weightKg: response.weight_kg,
    bmi: response.bmi,
    weightRecordedAt: response.weight_recorded_at,
  };
}
