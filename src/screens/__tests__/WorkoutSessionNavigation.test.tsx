import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";
import { Alert } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  cancelWorkoutSession,
  finishWorkoutSession,
  getActiveWorkoutSession,
  type WorkoutSession,
} from "../../services/trainingSessions";
import WorkoutSessionScreen from "../WorkoutSessionScreen";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://127.0.0.1:8000/api/v1",
  },
}));
jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  Check: () => null,
  Dumbbell: () => null,
  Plus: () => null,
  RefreshCw: () => null,
  Trash2: () => null,
  X: () => null,
}));

jest.mock("../../services/trainingSessions", () => ({
  getActiveWorkoutSession: jest.fn(),
  startWorkoutSession: jest.fn(),
  getWorkoutSession: jest.fn(),
  finishWorkoutSession: jest.fn(),
  cancelWorkoutSession: jest.fn(),
  addSetExecution: jest.fn(),
  removeSetExecution: jest.fn(),
  updateExerciseExecution: jest.fn(),
}));

const mockedActive = getActiveWorkoutSession as jest.Mock;
const mockedFinish = finishWorkoutSession as jest.Mock;
const mockedCancel = cancelWorkoutSession as jest.Mock;

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

const navigation = {
  popTo: jest.fn(),
  setOptions: jest.fn(),
};

const session: WorkoutSession = {
  id: "session-test-123",
  sourceWorkoutId: "workout-test-123",
  workoutName: "Treino de teste",
  status: "active",
  notes: null,
  startedAt: "2026-11-04T10:00:00Z",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-11-04T10:00:00Z",
  updatedAt: "2026-11-04T10:00:00Z",
  exercises: [
    {
      id: "exercise-test-123",
      exerciseId: "catalog-exercise-123",
      exerciseName: "Exercicio de teste",
      position: 1,
      plannedSets: 1,
      plannedRepetitions: 10,
      plannedLoad: null,
      plannedLoadUnit: null,
      plannedNotes: null,
      notes: null,
      isCompleted: true,
      completedAt: "2026-11-04T10:10:00Z",
      sets: [],
      createdAt: "2026-11-04T10:00:00Z",
      updatedAt: "2026-11-04T10:10:00Z",
    },
  ],
};

async function authenticatedRequest<T>(
  request: (accessToken: string) => Promise<T>,
): Promise<T> {
  return request("test-access-token");
}

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: "test-access-token",
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: authenticatedRequest,
  updateAuthenticatedUser: jest.fn(),
};

async function renderSession() {
  await render(
    <AuthContext.Provider value={authValue}>
      <WorkoutSessionScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof WorkoutSessionScreen
          >["navigation"]
        }
        route={{
          key: "session-test-route",
          name: "ExecutarTreino",
          params: { workoutId: "workout-test-123" },
        }}
      />
    </AuthContext.Provider>,
  );

  await screen.findByLabelText("Finalizar treino");
}

async function confirmAlert(title: string, buttonText: string) {
  const call = alertSpy.mock.calls.find(([alertTitle]) => alertTitle === title);

  expect(call).toBeDefined();

  const button = call?.[2]?.find((option) => option.text === buttonText);

  expect(button?.onPress).toBeDefined();

  await act(async () => {
    button?.onPress?.();
  });
}

describe("WorkoutSessionScreen - navegacao apos encerramento", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedActive.mockResolvedValue(session);
    mockedFinish.mockResolvedValue(session);
    mockedCancel.mockResolvedValue(session);
  });

  it("retorna para Treinos depois de finalizar e confirmar o sucesso", async () => {
    await renderSession();

    await fireEvent.press(screen.getByLabelText("Finalizar treino"));

    expect(mockedFinish).not.toHaveBeenCalled();

    await confirmAlert("Finalizar treino", "Finalizar");

    await waitFor(() => {
      expect(mockedFinish).toHaveBeenCalledWith(
        "test-access-token",
        session.id,
      );
      expect(alertSpy).toHaveBeenCalledWith(
        "Treino concluído",
        "Sua execução foi salva no histórico.",
        expect.any(Array),
      );
    });

    expect(navigation.popTo).not.toHaveBeenCalled();

    await confirmAlert("Treino concluído", "OK");

    expect(navigation.popTo).toHaveBeenCalledWith("MainTabs", {
      screen: "Treinos",
    });
  });

  it("nao navega quando a finalizacao falha", async () => {
    mockedFinish.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await renderSession();

    await fireEvent.press(screen.getByLabelText("Finalizar treino"));
    await confirmAlert("Finalizar treino", "Finalizar");

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Não foi possível finalizar",
        "Não foi possível conectar ao servidor.",
      );
    });

    expect(navigation.popTo).not.toHaveBeenCalled();
  });

  it("retorna para Treinos depois de cancelar com sucesso", async () => {
    await renderSession();

    await fireEvent.press(screen.getByLabelText("Cancelar treino"));

    expect(mockedCancel).not.toHaveBeenCalled();

    await confirmAlert("Cancelar treino", "Cancelar treino");

    await waitFor(() => {
      expect(mockedCancel).toHaveBeenCalledWith(
        "test-access-token",
        session.id,
      );

      expect(navigation.popTo).toHaveBeenCalledWith("MainTabs", {
        screen: "Treinos",
      });
    });
  });

  it("nao navega quando o cancelamento falha", async () => {
    mockedCancel.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await renderSession();

    await fireEvent.press(screen.getByLabelText("Cancelar treino"));
    await confirmAlert("Cancelar treino", "Cancelar treino");

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Não foi possível cancelar",
        "Não foi possível conectar ao servidor.",
      );
    });

    expect(navigation.popTo).not.toHaveBeenCalled();
  });
});
