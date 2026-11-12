import { apiClient } from "../apiClient";
import { getBmiSnapshot } from "../bodyEvolution";

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

describe("body evolution service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("loads BMI using the authenticated API contract", async () => {
    mockedGet.mockResolvedValue({
      height_cm: "175.00",
      weight_kg: "70.00",
      bmi: "22.9",
      weight_recorded_at: "2026-11-09T10:00:00Z",
    });

    const result = await getBmiSnapshot("test-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/progress/bmi", {
      headers: {
        Authorization: "Bearer test-access-token",
      },
    });

    expect(result).toEqual({
      heightCm: "175.00",
      weightKg: "70.00",
      bmi: "22.9",
      weightRecordedAt: "2026-11-09T10:00:00Z",
    });
  });

  it("preserves incomplete measurements without inventing BMI", async () => {
    mockedGet.mockResolvedValue({
      height_cm: "175.00",
      weight_kg: null,
      bmi: null,
      weight_recorded_at: null,
    });

    const result = await getBmiSnapshot("test-access-token");

    expect(result).toEqual({
      heightCm: "175.00",
      weightKg: null,
      bmi: null,
      weightRecordedAt: null,
    });
  });

  it("preserves an entirely empty snapshot", async () => {
    mockedGet.mockResolvedValue({
      height_cm: null,
      weight_kg: null,
      bmi: null,
      weight_recorded_at: null,
    });

    const result = await getBmiSnapshot("test-access-token");

    expect(result.bmi).toBeNull();
    expect(result.heightCm).toBeNull();
    expect(result.weightKg).toBeNull();
  });

  it("propagates API failures without fabricating results", async () => {
    const error = new Error("The backend could not be reached.");

    mockedGet.mockRejectedValue(error);

    await expect(getBmiSnapshot("test-access-token")).rejects.toBe(error);
  });
});
