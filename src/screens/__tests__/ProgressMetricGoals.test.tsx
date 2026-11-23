import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ContextType } from "react";
import { AuthContext } from "../../context/AuthContext";
import { getBmiSnapshot } from "../../services/bodyEvolution";
import {
  createBodyMetric,
  getBodyMetrics,
  getFitnessGoals,
  getFitnessGoalProgress,
  type FitnessGoal,
  type FitnessGoalProgress,
} from "../../services/bodyMetricsGoals";
import {
  getProgressStatistics,
  getExercisePerformance,
  getProgressPhotosPage,
} from "../../services/progress";
import ProgressScreen from "../ProgressScreen";

jest.mock("lucide-react-native", () => ({
  Activity: () => null,
  AlertCircle: () => null,
  CalendarDays: () => null,
  Dumbbell: () => null,
  Images: () => null,
  Maximize2: () => null,
  RefreshCw: () => null,
  ShieldCheck: () => null,
  TrendingUp: () => null,
  Plus: () => null,
  Target: () => null,
  Ruler: () => null,
  Camera: () => null,
  ImagePlus: () => null,
  X: () => null,
}));
jest.mock("../../context/AuthContext", () => ({
  AuthContext: jest
    .requireActual<typeof import("react")>("react")
    .createContext(null),
}));
jest.mock("../../config/environment", () => ({
  environment: { apiUrl: "http://test-api/api/v1" },
}));
jest.mock("../../services/bodyMetricsGoals");
jest.mock("../../services/bodyEvolution");
jest.mock("../../services/progress");
jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect]),
  };
});
jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));
jest.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

const auth: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: "test-token",
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  updateAuthenticatedUser: jest.fn(),
  runAuthenticatedRequest: (request) => request("test-token"),
};

const timestamp = "2026-11-23T10:00:00Z";

async function openProgress(metricType: "weight" | "waist") {
  const goal: FitnessGoal = {
    id: "goal",
    metricType,
    targetValue: "70",
    unit: metricType === "weight" ? "kg" : "cm",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const initial: FitnessGoalProgress = {
    goal,
    status: "insufficient_data",
    baselineValue: "80",
    currentValue: null,
    progressPercent: null,
  };
  jest.mocked(getFitnessGoals).mockResolvedValue([goal]);
  jest
    .mocked(getFitnessGoalProgress)
    .mockResolvedValueOnce(initial)
    .mockResolvedValue({
      ...initial,
      status: "in_progress",
      currentValue: "75",
      progressPercent: "50",
    });
  await render(
    <AuthContext.Provider value={auth}>
      <ProgressScreen />
    </AuthContext.Provider>,
  );
  await screen.findByText("Aguardando medidas suficientes");
  if (metricType === "waist")
    await fireEvent.press(screen.getByLabelText("Selecionar Cintura"));
  await fireEvent.changeText(
    screen.getByLabelText("Valor da medida corporal"),
    "75",
  );
  return initial;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getProgressStatistics).mockResolvedValue({
    completedWorkouts: 0,
    completedWorkoutsLast7Days: 0,
    completedWorkoutsLast30Days: 0,
    trainingDaysLast30Days: 0,
    totalPerformedSets: 0,
  });
  jest.mocked(getExercisePerformance).mockResolvedValue([]);
  jest
    .mocked(getProgressPhotosPage)
    .mockResolvedValue({ items: [], nextCursor: null });
  jest.mocked(getBodyMetrics).mockResolvedValue([]);
  jest.mocked(getBmiSnapshot).mockResolvedValue({
    heightCm: null,
    weightKg: null,
    bmi: null,
    weightRecordedAt: null,
  });
  jest.mocked(createBodyMetric).mockImplementation(async (_token, input) => ({
    ...input,
    id: "measurement",
    recordedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
});

it.each(["weight", "waist"] as const)(
  "refreshes goals after saving %s and refreshes BMI only for weight",
  async (type) => {
    await openProgress(type);
    await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));
    await screen.findByText("Em andamento");
    expect(getFitnessGoals).toHaveBeenCalledTimes(2);
    expect(getFitnessGoalProgress).toHaveBeenCalledTimes(2);
    expect(getBmiSnapshot).toHaveBeenCalledTimes(type === "weight" ? 2 : 1);
  },
);

it("keeps goal progress and BMI when the measurement fails to save", async () => {
  await openProgress("weight");
  jest
    .mocked(createBodyMetric)
    .mockRejectedValueOnce(new Error("Falha ao salvar"));
  await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));
  await screen.findByText("Falha ao salvar");
  expect(getFitnessGoals).toHaveBeenCalledTimes(1);
  expect(getBmiSnapshot).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Aguardando medidas suficientes")).toBeTruthy();
});

it("discards a manual refresh that finishes after a measurement refresh", async () => {
  const initial = await openProgress("waist");
  let finishManual!: (result: FitnessGoalProgress) => void;
  jest.mocked(getFitnessGoalProgress).mockReturnValueOnce(
    new Promise((resolve) => {
      finishManual = resolve;
    }),
  );
  await fireEvent.press(
    screen.getByLabelText("Atualizar acompanhamento de metas"),
  );
  await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));
  await screen.findByText("Em andamento");
  await act(async () => finishManual(initial));
  expect(screen.getByText("Em andamento")).toBeTruthy();
  expect(getFitnessGoals).toHaveBeenCalledTimes(3);
});
