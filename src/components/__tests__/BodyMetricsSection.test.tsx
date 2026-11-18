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
  createBodyMetric,
  getBodyMetrics,
  type BodyMetric,
} from "../../services/bodyMetricsGoals";
import BodyMetricsSection from "../BodyMetricsSection";

// Isola as configuracoes de ambiente do teste.
jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

// Os icones sao apenas elementos visuais neste teste.
// O mock evita carregar a distribuicao ESM do lucide-react-native.
jest.mock("lucide-react-native", () => ({
  Activity: () => null,
  Plus: () => null,
  RefreshCw: () => null,
  Ruler: () => null,
}));

// Evita carregar os modulos nativos de autenticacao e armazenamento.
// Mantem um contexto React funcional para testar o componente.
jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

// Simula o foco da tela sem exigir um navegador real.
jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

// Mantem o tema visual real, sem montar o ThemeProvider.
jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

// Simula somente as requisicoes HTTP.
jest.mock("../../services/bodyMetricsGoals", () => ({
  getBodyMetrics: jest.fn(),
  createBodyMetric: jest.fn(),
}));

const mockedGetBodyMetrics = getBodyMetrics as jest.Mock;
const mockedCreateBodyMetric = createBodyMetric as jest.Mock;

const savedWeight: BodyMetric = {
  id: "metric-weight-123",
  metricType: "weight",
  value: "80.00",
  unit: "kg",
  recordedAt: "2026-10-20T10:00:00Z",
  createdAt: "2026-10-20T10:01:00Z",
  updatedAt: "2026-10-20T10:01:00Z",
};

const savedWaist: BodyMetric = {
  id: "metric-waist-456",
  metricType: "waist",
  value: "85.50",
  unit: "cm",
  recordedAt: "2026-10-21T10:00:00Z",
  createdAt: "2026-10-21T10:01:00Z",
  updatedAt: "2026-10-21T10:01:00Z",
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

async function renderSection(
  onWeightSaved: () => void = () => undefined,
): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <BodyMetricsSection onWeightSaved={onWeightSaved} />
    </AuthContext.Provider>,
  );
}

describe("BodyMetricsSection", () => {
  beforeEach(() => {
    mockedGetBodyMetrics.mockReset();
    mockedCreateBodyMetric.mockReset();

    mockedGetBodyMetrics.mockResolvedValue([]);
  });

  it("loads an empty history for an authenticated user", async () => {
    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma medida registrada")).toBeTruthy();
    });

    expect(mockedGetBodyMetrics).toHaveBeenCalledWith("test-access-token");

    expect(screen.getByText("Medidas corporais")).toBeTruthy();
    expect(screen.getByText("Histórico de medidas")).toBeTruthy();
  });

  it("displays saved measurements with their units", async () => {
    mockedGetBodyMetrics.mockResolvedValue([savedWaist, savedWeight]);

    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("80,00 kg")).toBeTruthy();
      expect(screen.getByText("85,50 cm")).toBeTruthy();
    });

    expect(screen.getAllByText("Peso").length).toBeGreaterThan(1);

    expect(screen.getAllByText("Cintura").length).toBeGreaterThan(1);
  });

  it("changes available units when selecting another metric", async () => {
    await renderSection();

    await waitFor(() => {
      expect(screen.getByText("Nenhuma medida registrada")).toBeTruthy();
    });

    expect(screen.getByLabelText("Unidade kg")).toBeTruthy();
    expect(screen.getByLabelText("Unidade lb")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Selecionar Cintura"));

    expect(screen.getByLabelText("Unidade cm")).toBeTruthy();
    expect(screen.getByLabelText("Unidade in")).toBeTruthy();

    expect(screen.queryByLabelText("Unidade kg")).toBeNull();
    expect(screen.queryByLabelText("Unidade lb")).toBeNull();
  });

  it("registers a weight measurement using a decimal comma", async () => {
    const onWeightSaved = jest.fn();
    mockedCreateBodyMetric.mockResolvedValue({
      ...savedWeight,
      value: "78.50",
    });

    await renderSection(onWeightSaved);

    await waitFor(() => {
      expect(screen.getByText("Nenhuma medida registrada")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByLabelText("Valor da medida corporal"),
      "78,50",
    );

    await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));

    await waitFor(() => {
      expect(mockedCreateBodyMetric).toHaveBeenCalledWith("test-access-token", {
        metricType: "weight",
        value: "78.50",
        unit: "kg",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("78,50 kg")).toBeTruthy();
    });

    expect(onWeightSaved).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText("Valor da medida corporal").props.value).toBe(
      "",
    );
  });

  it("registers a circumference in inches", async () => {
    const onWeightSaved = jest.fn();
    mockedCreateBodyMetric.mockResolvedValue({
      ...savedWaist,
      value: "34.50",
      unit: "in",
    });

    await renderSection(onWeightSaved);

    await waitFor(() => {
      expect(screen.getByText("Nenhuma medida registrada")).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText("Selecionar Cintura"));

    await fireEvent.press(screen.getByLabelText("Unidade in"));

    await fireEvent.changeText(
      screen.getByLabelText("Valor da medida corporal"),
      "34.50",
    );

    await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));

    await waitFor(() => {
      expect(mockedCreateBodyMetric).toHaveBeenCalledWith("test-access-token", {
        metricType: "waist",
        value: "34.50",
        unit: "in",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("34,50 in")).toBeTruthy();
    });

    expect(onWeightSaved).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", "0"],
    ["valor negativo", "-2"],
    ["mais de duas casas decimais", "78,555"],
    ["mais de oito digitos inteiros", "123456789"],
  ])(
    "rejects %s without sending a request",
    async (_description, invalidValue) => {
      await renderSection();

      await waitFor(() => {
        expect(screen.getByText("Nenhuma medida registrada")).toBeTruthy();
      });

      await fireEvent.changeText(
        screen.getByLabelText("Valor da medida corporal"),
        invalidValue,
      );

      await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));

      expect(
        screen.getByText(
          "Informe um valor positivo, com até duas casas decimais.",
        ),
      ).toBeTruthy();

      expect(mockedCreateBodyMetric).not.toHaveBeenCalled();
    },
  );

  it("shows a loading error and retries successfully", async () => {
    mockedGetBodyMetrics
      .mockRejectedValueOnce(new Error("The backend could not be reached."))
      .mockResolvedValueOnce([savedWeight]);

    await renderSection();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível conectar ao servidor."),
      ).toBeTruthy();
    });

    expect(
      screen.getByText(/Não foi possível carregar a evolução corporal/),
    ).toBeTruthy();

    expect(screen.queryByText("Nenhuma medida registrada")).toBeNull();

    await fireEvent.press(
      screen.getByLabelText("Atualizar histórico de medidas"),
    );

    await waitFor(() => {
      expect(screen.getByText("80,00 kg")).toBeTruthy();
    });

    expect(mockedGetBodyMetrics).toHaveBeenCalledTimes(2);

    expect(
      screen.queryByText("Não foi possível conectar ao servidor."),
    ).toBeNull();
  });

  it("preserves the entered value when saving fails", async () => {
    const onWeightSaved = jest.fn();

    mockedCreateBodyMetric.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await renderSection(onWeightSaved);

    await waitFor(() => {
      expect(screen.getByText("Nenhuma medida registrada")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByLabelText("Valor da medida corporal"),
      "79,50",
    );

    await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível conectar ao servidor."),
      ).toBeTruthy();
    });

    expect(screen.getByLabelText("Valor da medida corporal").props.value).toBe(
      "79,50",
    );

    expect(screen.queryByText("79,50 kg")).toBeNull();
    expect(onWeightSaved).not.toHaveBeenCalled();
  });

  it("accessibility: provides visible selection indicators and practical touch targets", async () => {
    await renderSection();

    await screen.findByText("Nenhuma medida registrada");

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

    expectSelection("Selecionar Peso", true);
    expectSelection("Selecionar Cintura", false);
    expectSelection("Unidade kg", true);
    expectSelection("Unidade lb", false);

    await fireEvent.press(screen.getByLabelText("Selecionar Cintura"));

    expectSelection("Selecionar Peso", false);
    expectSelection("Selecionar Cintura", true);
    expectSelection("Unidade cm", true);
    expectSelection("Unidade in", false);

    await fireEvent.press(screen.getByLabelText("Unidade in"));

    expectSelection("Unidade cm", false);
    expectSelection("Unidade in", true);

    expect(mockedCreateBodyMetric).not.toHaveBeenCalled();
  });

  it("accessibility: associates the selected measurement and validation error with its input", async () => {
    await renderSection();

    await screen.findByText("Nenhuma medida registrada");

    const input = "Valor da medida corporal";
    const guidance =
      "Informe um valor positivo, com at\u00e9 duas casas decimais.";

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Peso em kg. ${guidance}`,
    );

    await fireEvent.press(screen.getByLabelText("Selecionar Cintura"));

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Cintura em cm. ${guidance}`,
    );

    await fireEvent.press(screen.getByLabelText("Unidade in"));

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Cintura em in. ${guidance}`,
    );

    await fireEvent.changeText(screen.getByLabelText(input), "0");

    await fireEvent.press(screen.getByLabelText("Salvar medida corporal"));

    expect(screen.getByRole("alert")).toHaveTextContent(guidance);

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      guidance,
    );

    expect(mockedCreateBodyMetric).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(input), "34,50");

    expect(screen.queryByText(guidance)).toBeNull();

    expect(screen.getByLabelText(input)).toHaveProp(
      "accessibilityHint",
      `Cintura em in. ${guidance}`,
    );
  });

  it("accessibility: exposes saving states and restores controls after a failed measurement", async () => {
    let reject!: (reason: Error) => void;
    let resolve!: (value: BodyMetric) => void;

    const request = new Promise<BodyMetric>((done, fail) => {
      resolve = done;
      reject = fail;
    });

    mockedCreateBodyMetric
      .mockReturnValueOnce(request)
      .mockResolvedValueOnce(savedWeight);

    const onWeightSaved = jest.fn();

    await renderSection(onWeightSaved);

    await screen.findByText("Nenhuma medida registrada");

    const inputLabel = "Valor da medida corporal";
    const saveLabel = "Salvar medida corporal";

    await fireEvent.changeText(screen.getByLabelText(inputLabel), "80,00");

    try {
      await fireEvent.press(screen.getByLabelText(saveLabel));

      expect(mockedCreateBodyMetric).toHaveBeenCalledTimes(1);

      expect(mockedCreateBodyMetric).toHaveBeenCalledWith("test-access-token", {
        metricType: "weight",
        value: "80.00",
        unit: "kg",
      });

      expect(screen.getByLabelText(inputLabel)).toHaveProp("editable", false);

      expect(screen.getByLabelText(inputLabel)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );

      expect(screen.getByLabelText(saveLabel)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true, disabled: true }),
      );

      for (const label of [saveLabel, "Selecionar Cintura", "Unidade lb"]) {
        const button = screen.getByLabelText(label);

        expect(button).toBeDisabled();

        await fireEvent.press(button);
      }

      expect(mockedCreateBodyMetric).toHaveBeenCalledTimes(1);
      expect(onWeightSaved).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        if (mockedCreateBodyMetric.mock.calls.length > 0) {
          reject(new Error("Falha ao salvar medida."));
        } else {
          resolve(savedWeight);
        }
      });
    }

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falha ao salvar medida.",
    );

    expect(screen.getByLabelText(inputLabel)).toHaveProp("editable", true);

    expect(screen.getByLabelText(inputLabel)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText(inputLabel)).toHaveProp("value", "80,00");

    expect(screen.getByLabelText(saveLabel)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false, disabled: false }),
    );

    expect(screen.getByLabelText("Selecionar Cintura")).not.toBeDisabled();
    expect(screen.getByLabelText("Unidade lb")).not.toBeDisabled();

    await fireEvent.press(screen.getByLabelText(saveLabel));

    expect(await screen.findByText("80,00 kg")).toBeTruthy();

    expect(mockedCreateBodyMetric).toHaveBeenCalledTimes(2);
    expect(onWeightSaved).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText(inputLabel)).toHaveProp("value", "");
    expect(screen.queryByText("Falha ao salvar medida.")).toBeNull();
  });

  it("accessibility: exposes history refresh processing and restores the action after failure", async () => {
    let reject!: (reason: Error) => void;
    let resolve!: (value: BodyMetric[]) => void;

    const request = new Promise<BodyMetric[]>((done, fail) => {
      resolve = done;
      reject = fail;
    });

    mockedGetBodyMetrics
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(request)
      .mockResolvedValueOnce([savedWeight]);

    await renderSection();

    await screen.findByText("Nenhuma medida registrada");

    const label = "Atualizar hist\u00f3rico de medidas";

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

      expect(screen.getByText("Carregando medidas...")).toBeTruthy();

      await fireEvent.press(button);

      expect(mockedGetBodyMetrics).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => {
        if (mockedGetBodyMetrics.mock.calls.length > 1) {
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

    expect(await screen.findByText("80,00 kg")).toBeTruthy();

    expect(mockedGetBodyMetrics).toHaveBeenCalledTimes(3);
    expect(
      screen.queryByText("N\u00e3o foi poss\u00edvel conectar ao servidor."),
    ).toBeNull();
  });
});
