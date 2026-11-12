import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import { getBmiSnapshot, type BmiSnapshot } from "../../services/bodyEvolution";
import BmiCard from "../BmiCard";

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

jest.mock("../../services/bodyEvolution", () => ({
  getBmiSnapshot: jest.fn(),
}));

const mockedGetBmiSnapshot = getBmiSnapshot as jest.Mock;

const availableSnapshot: BmiSnapshot = {
  heightCm: "175.00",
  weightKg: "70.00",
  bmi: "22.9",
  weightRecordedAt: "2026-11-09T10:00:00Z",
};

const emptySnapshot: BmiSnapshot = {
  heightCm: null,
  weightKg: null,
  bmi: null,
  weightRecordedAt: null,
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

async function renderCard(): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <BmiCard />
    </AuthContext.Provider>,
  );
}

describe("BmiCard", () => {
  beforeEach(() => {
    mockedGetBmiSnapshot.mockReset();
    mockedGetBmiSnapshot.mockResolvedValue(availableSnapshot);
  });

  it("loads the authenticated BMI and measurements", async () => {
    await renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 22,9")).toBeTruthy();
    });

    expect(mockedGetBmiSnapshot).toHaveBeenCalledWith("test-access-token");

    expect(screen.getByText("175 cm")).toBeTruthy();
    expect(screen.getByText("70 kg")).toBeTruthy();

    expect(screen.getByText(/Peso registrado em/)).toBeTruthy();

    expect(screen.getByText(/O IMC não distingue massa muscular/)).toBeTruthy();
  });

  it("handles an entirely empty BMI snapshot", async () => {
    mockedGetBmiSnapshot.mockResolvedValue(emptySnapshot);

    await renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText("IMC indisponível")).toBeTruthy();
    });

    expect(
      screen.getByText(
        "Cadastre sua altura no Perfil e registre seu peso para visualizar o IMC.",
      ),
    ).toBeTruthy();

    expect(screen.getAllByText("Não registrado")).toHaveLength(2);
  });

  it("requests height when only weight exists", async () => {
    mockedGetBmiSnapshot.mockResolvedValue({
      ...emptySnapshot,
      weightKg: "80.00",
      weightRecordedAt: "2026-11-09T10:00:00Z",
    });

    await renderCard();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Cadastre sua altura na aba Perfil para calcular o IMC.",
        ),
      ).toBeTruthy();
    });

    expect(screen.getByText("80 kg")).toBeTruthy();
    expect(screen.getByLabelText("IMC indisponível")).toBeTruthy();
  });

  it("requests weight when only height exists", async () => {
    mockedGetBmiSnapshot.mockResolvedValue({
      ...emptySnapshot,
      heightCm: "180.00",
    });

    await renderCard();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Registre seu peso em Medidas corporais para calcular o IMC.",
        ),
      ).toBeTruthy();
    });

    expect(screen.getByText("180 cm")).toBeTruthy();
    expect(screen.getByLabelText("IMC indisponível")).toBeTruthy();
  });

  it("shows loading until the request completes", async () => {
    let resolveRequest: ((snapshot: BmiSnapshot) => void) | undefined;

    const pending = new Promise<BmiSnapshot>((resolve) => {
      resolveRequest = resolve;
    });

    mockedGetBmiSnapshot.mockReturnValue(pending);

    await renderCard();

    expect(screen.getByText("Carregando IMC...")).toBeTruthy();

    await act(async () => {
      resolveRequest?.(availableSnapshot);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 22,9")).toBeTruthy();
    });

    expect(screen.queryByText("Carregando IMC...")).toBeNull();
  });

  it("recovers from a connection failure", async () => {
    mockedGetBmiSnapshot
      .mockRejectedValueOnce(new Error("The backend could not be reached."))
      .mockResolvedValueOnce(availableSnapshot);

    await renderCard();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível conectar ao servidor."),
      ).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText("Atualizar IMC"));

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 22,9")).toBeTruthy();
    });

    expect(mockedGetBmiSnapshot).toHaveBeenCalledTimes(2);
  });

  it("refreshes automatically when the weight version changes", async () => {
    mockedGetBmiSnapshot
      .mockResolvedValueOnce(availableSnapshot)
      .mockResolvedValueOnce({
        ...availableSnapshot,
        weightKg: "75.00",
        bmi: "24.5",
      });

    const view = await render(
      <AuthContext.Provider value={authValue}>
        <BmiCard refreshVersion={0} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 22,9")).toBeTruthy();
    });

    await view.rerender(
      <AuthContext.Provider value={authValue}>
        <BmiCard refreshVersion={1} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 24,5")).toBeTruthy();
    });

    expect(mockedGetBmiSnapshot).toHaveBeenCalledTimes(2);
  });

  it("refreshes the BMI after a weight update", async () => {
    mockedGetBmiSnapshot
      .mockResolvedValueOnce(availableSnapshot)
      .mockResolvedValueOnce({
        ...availableSnapshot,
        weightKg: "75.00",
        bmi: "24.5",
        weightRecordedAt: "2026-11-10T10:00:00Z",
      });

    await renderCard();

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 22,9")).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText("Atualizar IMC"));

    await waitFor(() => {
      expect(screen.getByLabelText("IMC 24,5")).toBeTruthy();
    });

    expect(screen.getByText("75 kg")).toBeTruthy();
    expect(mockedGetBmiSnapshot).toHaveBeenCalledTimes(2);
  });
});
