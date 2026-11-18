import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

  it("accessibility: provides visible goal selections and practical touch targets", async () => {
    await renderSection();

    await screen.findByText("Nenhuma meta registrada");

    function expectSelection(label: string, selected: boolean) {
      const button = screen.getByLabelText(label);

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ selected, disabled: false }),
      );

      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      if (selected) {
        expect(within(button).getByText("\u2713")).toBeTruthy();
      } else {
        expect(within(button).queryByText("\u2713")).toBeNull();
      }
    }

    expectSelection("Selecionar meta de Peso", true);
    expectSelection("Selecionar meta de Cintura", false);
    expectSelection("Unidade da meta kg", true);
    expectSelection("Unidade da meta lb", false);

    await fireEvent.press(screen.getByLabelText("Selecionar meta de Cintura"));

    expectSelection("Selecionar meta de Peso", false);
    expectSelection("Selecionar meta de Cintura", true);
    expectSelection("Unidade da meta cm", true);
    expectSelection("Unidade da meta in", false);

    await fireEvent.press(screen.getByLabelText("Unidade da meta in"));

    expectSelection("Unidade da meta cm", false);
    expectSelection("Unidade da meta in", true);

    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it("accessibility: associates goal context and validation errors with the target input", async () => {
    await renderSection();

    await screen.findByText("Nenhuma meta registrada");

    const input = "Valor alvo da meta fitness";

    const guidance =
      "Informe um alvo positivo, com at\u00e9 duas casas decimais.";

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Peso em kg. ${guidance}`,
    );

    await fireEvent.press(screen.getByLabelText("Selecionar meta de Cintura"));

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Cintura em cm. ${guidance}`,
    );

    await fireEvent.press(screen.getByLabelText("Unidade da meta in"));

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Cintura em in. ${guidance}`,
    );

    await fireEvent.changeText(screen.getByLabelText(input), "0");

    await fireEvent.press(screen.getByLabelText("Salvar meta fitness"));

    expect(screen.getByRole("alert")).toHaveTextContent(guidance);

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      guidance,
    );

    expect(mockedCreateGoal).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(input), "32,50");

    expect(screen.queryByText(guidance)).toBeNull();

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Cintura em in. ${guidance}`,
    );
  });

  it("accessibility: exposes pending goal creation and restores controls after failure", async () => {
    let reject!: (reason: Error) => void;
    let resolve!: (value: FitnessGoal) => void;

    const request = new Promise<FitnessGoal>((done, fail) => {
      resolve = done;
      reject = fail;
    });

    mockedCreateGoal
      .mockReturnValueOnce(request)
      .mockResolvedValueOnce(savedWeightGoal);

    mockedGetGoals
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedWeightGoal]);

    await renderSection();

    await screen.findByText("Nenhuma meta registrada");

    const input = "Valor alvo da meta fitness";
    const save = "Salvar meta fitness";
    const refresh = "Atualizar acompanhamento de metas";

    await fireEvent.changeText(screen.getByLabelText(input), "75,50");

    try {
      await fireEvent.press(screen.getByLabelText(save));

      expect(mockedCreateGoal).toHaveBeenCalledTimes(1);

      expect(mockedCreateGoal).toHaveBeenCalledWith("test-access-token", {
        metricType: "weight",
        targetValue: "75.50",
        unit: "kg",
      });

      expect(screen.getByLabelText(input)).toHaveProp("editable", false);

      expect(screen.getByLabelText(input)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );

      expect(screen.getByLabelText(save)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true, disabled: true }),
      );

      expect(screen.getByLabelText(refresh)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );

      for (const label of [
        save,
        refresh,
        "Selecionar meta de Cintura",
        "Unidade da meta lb",
      ]) {
        const button = screen.getByLabelText(label);

        expect(button).toBeDisabled();

        await fireEvent.press(button);
      }

      expect(mockedCreateGoal).toHaveBeenCalledTimes(1);
      expect(mockedGetGoals).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        if (mockedCreateGoal.mock.calls.length > 0) {
          reject(new Error("Falha ao salvar meta."));
        } else {
          resolve(savedWeightGoal);
        }
      });
    }

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falha ao salvar meta.",
    );

    expect(screen.getByLabelText(input)).toHaveProp("editable", true);

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText(input)).toHaveProp("value", "75,50");

    expect(screen.getByLabelText(save)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false, disabled: false }),
    );

    for (const label of [
      save,
      refresh,
      "Selecionar meta de Cintura",
      "Unidade da meta lb",
    ]) {
      expect(screen.getByLabelText(label)).not.toBeDisabled();
    }

    await fireEvent.press(screen.getByLabelText(save));

    expect(await screen.findByText("75,5 kg")).toBeTruthy();

    expect(
      await screen.findByText("Meta registrada com sucesso."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByLabelText(save)).not.toBeDisabled();
    });

    expect(mockedCreateGoal).toHaveBeenCalledTimes(2);
    expect(mockedGetGoals).toHaveBeenCalledTimes(2);

    expect(screen.getByLabelText(input)).toHaveProp("value", "");
    expect(screen.queryByText("Falha ao salvar meta.")).toBeNull();
  });

  it("accessibility: exposes goal refresh processing and restores retry after failure", async () => {
    let reject!: (reason: Error) => void;
    let resolve!: (value: FitnessGoal[]) => void;

    const request = new Promise<FitnessGoal[]>((done, fail) => {
      resolve = done;
      reject = fail;
    });

    mockedGetGoals
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(request)
      .mockResolvedValueOnce([savedWeightGoal]);

    await renderSection();

    await screen.findByText("Nenhuma meta registrada");

    const label = "Atualizar acompanhamento de metas";

    try {
      await fireEvent.press(screen.getByLabelText(label));

      const button = screen.getByLabelText(label);

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true, disabled: true }),
      );

      expect(button).toBeDisabled();

      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      expect(screen.getByText("Carregando suas metas...")).toBeTruthy();

      await fireEvent.press(button);

      expect(mockedGetGoals).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => {
        if (mockedGetGoals.mock.calls.length > 1) {
          reject(new Error("The backend could not be reached."));
        } else {
          resolve([]);
        }
      });
    }

    expect(
      screen.getByText("N\u00e3o foi poss\u00edvel conectar ao servidor."),
    ).toBeTruthy();

    expect(screen.getByLabelText(label)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false, disabled: false }),
    );

    expect(screen.getByLabelText(label)).not.toBeDisabled();

    await fireEvent.press(screen.getByLabelText(label));

    expect(await screen.findByText("75,5 kg")).toBeTruthy();

    expect(mockedGetGoals).toHaveBeenCalledTimes(3);

    expect(
      screen.queryByText("N\u00e3o foi poss\u00edvel conectar ao servidor."),
    ).toBeNull();
  });

  it("accessibility: exposes distinct goal progress labels and server percentages", async () => {
    const achievedWaist: FitnessGoalProgress = {
      ...achievedProgress,
      goal: savedWaistGoal,
      baselineValue: "35.00",
      currentValue: "32.50",
    };

    mockedGetGoals.mockResolvedValue([savedWeightGoal, savedWaistGoal]);

    mockedGetProgress
      .mockResolvedValueOnce(inProgress)
      .mockResolvedValueOnce(achievedWaist);

    await renderSection();

    await screen.findByText("Em andamento");

    expect(screen.getByText("Meta atingida")).toBeTruthy();

    const weightProgress = screen.getByRole("progressbar", {
      name: "Evolu\u00e7\u00e3o da meta de Peso, alvo 75,5 kg",
    });

    expect(weightProgress).toHaveProp(
      "accessibilityValue",
      expect.objectContaining({
        min: 0,
        max: 100,
        now: 40,
        text: "40% \u2014 Em andamento",
      }),
    );

    const waistGoalProgress = screen.getByRole("progressbar", {
      name: "Evolu\u00e7\u00e3o da meta de Cintura, alvo 32,5 in",
    });

    expect(waistGoalProgress).toHaveProp(
      "accessibilityValue",
      expect.objectContaining({
        min: 0,
        max: 100,
        now: 100,
        text: "100% \u2014 Meta atingida",
      }),
    );

    expect(screen.getAllByRole("progressbar")).toHaveLength(2);

    expect(mockedGetProgress).toHaveBeenCalledWith(
      "test-access-token",
      savedWeightGoal.id,
    );

    expect(mockedGetProgress).toHaveBeenCalledWith(
      "test-access-token",
      savedWaistGoal.id,
    );

    expect(mockedGetProgress).toHaveBeenCalledTimes(2);
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it("preserves unavailable and non-calculable progress without misleading progressbars", async () => {
    const secondGoal: FitnessGoal = {
      ...savedWeightGoal,
      id: "goal-not-calculable-test",
      targetValue: "70.00",
    };

    const thirdGoal: FitnessGoal = {
      ...savedWaistGoal,
      id: "goal-unavailable-test",
    };

    mockedGetGoals.mockResolvedValue([savedWeightGoal, secondGoal, thirdGoal]);

    mockedGetProgress
      .mockResolvedValueOnce(insufficientProgress)
      .mockResolvedValueOnce({
        ...notCalculableProgress,
        goal: secondGoal,
        baselineValue: "70.00",
        currentValue: "70.00",
      })
      .mockRejectedValueOnce(new Error("The request timed out."));

    await renderSection();

    await screen.findByText("Aguardando medidas suficientes");

    expect(
      screen.getByText("Percentual n\u00e3o calcul\u00e1vel"),
    ).toBeTruthy();

    expect(
      screen.getByText(
        "Acompanhamento indispon\u00edvel. Atualize para tentar novamente.",
      ),
    ).toBeTruthy();

    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);

    expect(screen.queryByText("Evolu\u00e7\u00e3o da meta")).toBeNull();

    expect(mockedGetProgress).toHaveBeenCalledTimes(3);
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });
});
