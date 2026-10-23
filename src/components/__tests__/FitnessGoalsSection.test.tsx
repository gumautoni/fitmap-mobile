import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import {
  createFitnessGoal,
  getFitnessGoalProgress,
  getFitnessGoals,
  type FitnessGoal,
  type FitnessGoalProgress,
} from "../../services/bodyMetricsGoals";
import FitnessGoalsSection from "../FitnessGoalsSection";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  Plus: () => null,
  RefreshCw: () => null,
  Target: () => null,
  TrendingUp: () => null,
}));

jest.mock("../../services/bodyMetricsGoals", () => ({
  createFitnessGoal: jest.fn(),
  getFitnessGoals: jest.fn(),
  getFitnessGoalProgress: jest.fn(),
}));

const mockedCreateGoal = createFitnessGoal as jest.Mock;
const mockedGetGoals = getFitnessGoals as jest.Mock;
const mockedGetProgress = getFitnessGoalProgress as jest.Mock;

const savedWeightGoal: FitnessGoal = {
  id: "goal-weight-123",
  metricType: "weight",
  targetValue: "75.50",
  unit: "kg",
  createdAt: "2026-10-21T11:00:00Z",
  updatedAt: "2026-10-21T11:00:00Z",
};

const savedWaistGoal: FitnessGoal = {
  id: "goal-waist-456",
  metricType: "waist",
  targetValue: "32.50",
  unit: "in",
  createdAt: "2026-10-21T12:00:00Z",
  updatedAt: "2026-10-21T12:00:00Z",
};

const inProgress: FitnessGoalProgress = {
  goal: savedWeightGoal,
  status: "in_progress",
  baselineValue: "80.00",
  currentValue: "78.20",
  progressPercent: "40.00",
};

const achievedProgress: FitnessGoalProgress = {
  ...inProgress,
  status: "achieved",
  currentValue: "75.50",
  progressPercent: "100.00",
};

const insufficientProgress: FitnessGoalProgress = {
  goal: savedWeightGoal,
  status: "insufficient_data",
  baselineValue: "80.00",
  currentValue: null,
  progressPercent: null,
};

const notCalculableProgress: FitnessGoalProgress = {
  goal: savedWeightGoal,
  status: "not_calculable",
  baselineValue: "75.50",
  currentValue: "75.50",
  progressPercent: null,
};

const waistProgress: FitnessGoalProgress = {
  goal: savedWaistGoal,
  status: "insufficient_data",
  baselineValue: null,
  currentValue: null,
  progressPercent: null,
};

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: "test-access-token",
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: (request) => request("test-access-token"),
  updateAuthenticatedUser: jest.fn(),
};

async function renderSection(): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <FitnessGoalsSection />
    </AuthContext.Provider>,
  );
}

describe("FitnessGoalsSection", () => {
  beforeEach(() => {
    mockedCreateGoal.mockReset();
    mockedGetGoals.mockReset();
    mockedGetProgress.mockReset();

    mockedGetGoals.mockResolvedValue([]);
    mockedGetProgress.mockResolvedValue(inProgress);
  });

  it("loads an empty list of goals", async () => {
    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma meta registrada")).toBeTruthy();
    });

    expect(mockedGetGoals).toHaveBeenCalledWith("test-access-token");

    expect(screen.getByText("Metas fitness")).toBeTruthy();

    expect(screen.getByText("Acompanhamento de metas")).toBeTruthy();
  });

  it("displays goal progress calculated by the backend", async () => {
    mockedGetGoals.mockResolvedValue([savedWeightGoal]);
    mockedGetProgress.mockResolvedValue(inProgress);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Em andamento")).toBeTruthy();
    });

    expect(mockedGetProgress).toHaveBeenCalledWith(
      "test-access-token",
      "goal-weight-123",
    );

    expect(screen.getByText("75,5 kg")).toBeTruthy();
    expect(screen.getByText("80 kg")).toBeTruthy();
    expect(screen.getByText("78,2 kg")).toBeTruthy();

    expect(screen.getByText(/40\s*%/)).toBeTruthy();
  });

  it("displays an achieved goal", async () => {
    mockedGetGoals.mockResolvedValue([savedWeightGoal]);

    mockedGetProgress.mockResolvedValue(achievedProgress);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Meta atingida")).toBeTruthy();
    });

    expect(screen.getByText(/100\s*%/)).toBeTruthy();
  });

  it("handles insufficient measurement history", async () => {
    mockedGetGoals.mockResolvedValue([savedWeightGoal]);

    mockedGetProgress.mockResolvedValue(insufficientProgress);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Aguardando medidas suficientes")).toBeTruthy();
    });

    expect(screen.getByText("80 kg")).toBeTruthy();

    expect(
      screen.getByText(
        "Registre novas medidas após criar a meta para acompanhar sua evolução.",
      ),
    ).toBeTruthy();

    expect(screen.queryByText("Evolução da meta")).toBeNull();
  });

  it("handles goals with a non-calculable percentage", async () => {
    mockedGetGoals.mockResolvedValue([savedWeightGoal]);

    mockedGetProgress.mockResolvedValue(notCalculableProgress);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Percentual não calculável")).toBeTruthy();
    });

    expect(
      screen.getByText(
        "O valor inicial é igual ao alvo. Não é possível calcular um percentual.",
      ),
    ).toBeTruthy();

    expect(screen.queryByText("Evolução da meta")).toBeNull();
  });

  it("changes the available units when selecting a goal type", async () => {
    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma meta registrada")).toBeTruthy();
    });

    expect(screen.getByLabelText("Unidade da meta kg")).toBeTruthy();

    expect(screen.getByLabelText("Unidade da meta lb")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Selecionar meta de Cintura"));

    expect(screen.getByLabelText("Unidade da meta cm")).toBeTruthy();

    expect(screen.getByLabelText("Unidade da meta in")).toBeTruthy();

    expect(screen.queryByLabelText("Unidade da meta kg")).toBeNull();

    expect(screen.queryByLabelText("Unidade da meta lb")).toBeNull();
  });

  it("creates a weight goal using a decimal comma", async () => {
    mockedGetGoals
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedWeightGoal]);

    mockedCreateGoal.mockResolvedValue(savedWeightGoal);

    mockedGetProgress.mockResolvedValue(insufficientProgress);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma meta registrada")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByLabelText("Valor alvo da meta fitness"),
      "75,50",
    );

    await fireEvent.press(screen.getByLabelText("Salvar meta fitness"));

    await waitFor(() => {
      expect(mockedCreateGoal).toHaveBeenCalledWith("test-access-token", {
        metricType: "weight",
        targetValue: "75.50",
        unit: "kg",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Meta registrada com sucesso.")).toBeTruthy();

      expect(screen.getByText("75,5 kg")).toBeTruthy();
    });

    expect(
      screen.getByLabelText("Valor alvo da meta fitness").props.value,
    ).toBe("");
  });

  it("creates a circumference goal in inches", async () => {
    mockedGetGoals
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedWaistGoal]);

    mockedCreateGoal.mockResolvedValue(savedWaistGoal);

    mockedGetProgress.mockResolvedValue(waistProgress);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma meta registrada")).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText("Selecionar meta de Cintura"));

    await fireEvent.press(screen.getByLabelText("Unidade da meta in"));

    await fireEvent.changeText(
      screen.getByLabelText("Valor alvo da meta fitness"),
      "32.50",
    );

    await fireEvent.press(screen.getByLabelText("Salvar meta fitness"));

    await waitFor(() => {
      expect(mockedCreateGoal).toHaveBeenCalledWith("test-access-token", {
        metricType: "waist",
        targetValue: "32.50",
        unit: "in",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("32,5 in")).toBeTruthy();
    });
  });

  it.each([
    ["zero", "0"],
    ["valor negativo", "-5"],
    ["mais de duas casas decimais", "75,555"],
    ["mais de oito digitos inteiros", "123456789"],
  ])(
    "rejects %s without sending a request",
    async (_description, invalidValue) => {
      await renderSection();

      await waitFor(() => {
        expect(screen.getByText("Nenhuma meta registrada")).toBeTruthy();
      });

      await fireEvent.changeText(
        screen.getByLabelText("Valor alvo da meta fitness"),
        invalidValue,
      );

      await fireEvent.press(screen.getByLabelText("Salvar meta fitness"));

      expect(
        screen.getByText(
          "Informe um alvo positivo, com até duas casas decimais.",
        ),
      ).toBeTruthy();

      expect(mockedCreateGoal).not.toHaveBeenCalled();
    },
  );

  it("preserves the entered value when creation fails", async () => {
    mockedCreateGoal.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma meta registrada")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByLabelText("Valor alvo da meta fitness"),
      "74,50",
    );

    await fireEvent.press(screen.getByLabelText("Salvar meta fitness"));

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível conectar ao servidor."),
      ).toBeTruthy();
    });

    expect(
      screen.getByLabelText("Valor alvo da meta fitness").props.value,
    ).toBe("74,50");

    expect(screen.queryByText("Meta registrada com sucesso.")).toBeNull();
  });

  it("retries after a goal loading error", async () => {
    mockedGetGoals
      .mockRejectedValueOnce(new Error("The backend could not be reached."))
      .mockResolvedValueOnce([savedWeightGoal]);

    await renderSection();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível conectar ao servidor."),
      ).toBeTruthy();
    });

    await fireEvent.press(
      screen.getByLabelText("Atualizar acompanhamento de metas"),
    );

    await waitFor(() => {
      expect(screen.getByText("75,5 kg")).toBeTruthy();
    });

    expect(mockedGetGoals).toHaveBeenCalledTimes(2);

    expect(
      screen.queryByText("Não foi possível conectar ao servidor."),
    ).toBeNull();
  });

  it("preserves the goal when its progress request fails", async () => {
    mockedGetGoals.mockResolvedValue([savedWeightGoal]);

    mockedGetProgress.mockRejectedValueOnce(
      new Error("The request timed out."),
    );

    await renderSection();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Acompanhamento indisponível. Atualize para tentar novamente.",
        ),
      ).toBeTruthy();
    });

    expect(screen.getByText("75,5 kg")).toBeTruthy();

    expect(mockedGetProgress).toHaveBeenCalledWith(
      "test-access-token",
      "goal-weight-123",
    );
  });
});
