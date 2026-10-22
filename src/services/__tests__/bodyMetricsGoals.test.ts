import { apiClient } from "../apiClient";
import {
  createBodyMetric,
  createFitnessGoal,
  getBodyMetrics,
  getFitnessGoalProgress,
  getFitnessGoals,
} from "../bodyMetricsGoals";

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

const metricResponse = {
  id: "metric-123",
  metric_type: "weight",
  value: "80.00",
  unit: "kg",
  recorded_at: "2026-10-20T10:00:00Z",
  created_at: "2026-10-20T10:01:00Z",
  updated_at: "2026-10-20T10:01:00Z",
};

const goalResponse = {
  id: "goal-123",
  metric_type: "weight",
  target_value: "75.00",
  unit: "kg",
  created_at: "2026-10-20T11:00:00Z",
  updated_at: "2026-10-20T11:00:00Z",
};

const expectedMetric = {
  id: "metric-123",
  metricType: "weight",
  value: "80.00",
  unit: "kg",
  recordedAt: "2026-10-20T10:00:00Z",
  createdAt: "2026-10-20T10:01:00Z",
  updatedAt: "2026-10-20T10:01:00Z",
};

const expectedGoal = {
  id: "goal-123",
  metricType: "weight",
  targetValue: "75.00",
  unit: "kg",
  createdAt: "2026-10-20T11:00:00Z",
  updatedAt: "2026-10-20T11:00:00Z",
};

const expectedHeaders = {
  headers: {
    Authorization: "Bearer test-access-token",
  },
};

describe("body metrics and fitness goals service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("creates a body metric with the backend contract", async () => {
    mockedPost.mockResolvedValue(metricResponse);

    const result = await createBodyMetric("test-access-token", {
      metricType: "weight",
      value: "80.00",
      unit: "kg",
      recordedAt: "2026-10-20T10:00:00Z",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/progress/body-metrics",
      {
        metric_type: "weight",
        value: "80.00",
        unit: "kg",
        recorded_at: "2026-10-20T10:00:00Z",
      },
      expectedHeaders,
    );

    expect(result).toEqual(expectedMetric);
  });

  it("loads and normalizes body metric history", async () => {
    mockedGet.mockResolvedValue([metricResponse]);

    const result = await getBodyMetrics("test-access-token");

    expect(mockedGet).toHaveBeenCalledWith(
      "/progress/body-metrics",
      expectedHeaders,
    );

    expect(result).toEqual([expectedMetric]);
  });

  it("filters body metrics by type", async () => {
    mockedGet.mockResolvedValue([]);

    const result = await getBodyMetrics("test-access-token", "waist");

    expect(mockedGet).toHaveBeenCalledWith(
      "/progress/body-metrics?metric_type=waist",
      expectedHeaders,
    );

    expect(result).toEqual([]);
  });

  it("preserves decimal values returned by the backend", async () => {
    mockedGet.mockResolvedValue([
      {
        ...metricResponse,
        value: "80.25",
      },
    ]);

    const result = await getBodyMetrics("test-access-token");

    expect(result[0]?.value).toBe("80.25");
    expect(typeof result[0]?.value).toBe("string");
  });

  it("creates a fitness goal with the backend contract", async () => {
    mockedPost.mockResolvedValue(goalResponse);

    const result = await createFitnessGoal("test-access-token", {
      metricType: "weight",
      targetValue: "75.00",
      unit: "kg",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/progress/goals",
      {
        metric_type: "weight",
        target_value: "75.00",
        unit: "kg",
      },
      expectedHeaders,
    );

    expect(result).toEqual(expectedGoal);
  });

  it("loads and normalizes fitness goals", async () => {
    mockedGet.mockResolvedValue([goalResponse]);

    const result = await getFitnessGoals("test-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/progress/goals", expectedHeaders);

    expect(result).toEqual([expectedGoal]);
  });

  it("filters fitness goals by metric type", async () => {
    mockedGet.mockResolvedValue([]);

    const result = await getFitnessGoals("test-access-token", "weight");

    expect(mockedGet).toHaveBeenCalledWith(
      "/progress/goals?metric_type=weight",
      expectedHeaders,
    );

    expect(result).toEqual([]);
  });

  it("loads and normalizes fitness goal progress", async () => {
    mockedGet.mockResolvedValue({
      goal: goalResponse,
      status: "in_progress",
      baseline_value: "80.00",
      current_value: "78.00",
      progress_percent: "40.00",
    });

    const result = await getFitnessGoalProgress(
      "test-access-token",
      "goal-123",
    );

    expect(mockedGet).toHaveBeenCalledWith(
      "/progress/goals/goal-123/progress",
      expectedHeaders,
    );

    expect(result).toEqual({
      goal: expectedGoal,
      status: "in_progress",
      baselineValue: "80.00",
      currentValue: "78.00",
      progressPercent: "40.00",
    });
  });

  it("preserves missing goal progress data as null", async () => {
    mockedGet.mockResolvedValue({
      goal: goalResponse,
      status: "insufficient_data",
      baseline_value: null,
      current_value: null,
      progress_percent: null,
    });

    const result = await getFitnessGoalProgress(
      "test-access-token",
      "goal-123",
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.baselineValue).toBeNull();
    expect(result.currentValue).toBeNull();
    expect(result.progressPercent).toBeNull();
  });

  it("encodes the goal identifier in the request URL", async () => {
    mockedGet.mockResolvedValue({
      goal: goalResponse,
      status: "insufficient_data",
      baseline_value: null,
      current_value: null,
      progress_percent: null,
    });

    await getFitnessGoalProgress("test-access-token", "goal/123");

    expect(mockedGet).toHaveBeenCalledWith(
      "/progress/goals/goal%2F123/progress",
      expectedHeaders,
    );
  });

  it("propagates backend errors without inventing results", async () => {
    const backendError = new Error("Request validation failed.");

    mockedPost.mockRejectedValue(backendError);

    await expect(
      createFitnessGoal("test-access-token", {
        metricType: "weight",
        targetValue: "0",
        unit: "kg",
      }),
    ).rejects.toBe(backendError);

    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
