import {
  fireEvent,
  render,
  screen,
  waitFor,
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

async function renderSection(): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <BodyMetricsSection />
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
    mockedCreateBodyMetric.mockResolvedValue({
      ...savedWeight,
      value: "78.50",
    });

    await renderSection();

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
        recordedAt: expect.any(String),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("78,50 kg")).toBeTruthy();
    });

    expect(screen.getByLabelText("Valor da medida corporal").props.value).toBe(
      "",
    );
  });

  it("registers a circumference in inches", async () => {
    mockedCreateBodyMetric.mockResolvedValue({
      ...savedWaist,
      value: "34.50",
      unit: "in",
    });

    await renderSection();

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
        recordedAt: expect.any(String),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("34,50 in")).toBeTruthy();
    });
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
    mockedCreateBodyMetric.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await renderSection();

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
  });
});
