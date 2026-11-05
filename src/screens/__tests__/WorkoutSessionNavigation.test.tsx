import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";
import { AccessibilityInfo, Alert } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  cancelWorkoutSession,
  finishWorkoutSession,
  getActiveWorkoutSession,
  updateExerciseExecution,
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
const mockedUpdate = updateExerciseExecution as jest.Mock;
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
  beforeAll(() => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

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

  describe("indicador de progresso", () => {
    function buildProgressSession(
      total: number,
      completed: number,
    ): WorkoutSession {
      return {
        ...session,
        exercises: Array.from({ length: total }, (_, index) => ({
          ...session.exercises[0],
          id: `exercise-${index + 1}`,
          exerciseId: `catalog-${index + 1}`,
          exerciseName: `Exercício ${index + 1}`,
          position: index + 1,
          isCompleted: index < completed,
          completedAt: index < completed ? "2026-11-04T10:10:00Z" : null,
        })),
      };
    }

    function expectProgress(
      completed: number,
      total: number,
      percentage: number,
    ): void {
      expect(screen.getByText(`${completed}/${total}`)).toBeTruthy();

      expect(
        screen.getByLabelText("Progresso do treino").props.accessibilityValue,
      ).toEqual({
        min: 0,
        max: 100,
        now: percentage,
      });
    }

    beforeEach(() => {
      mockedUpdate.mockReset();
    });

    it.each([
      [0, 2, 0],
      [1, 2, 50],
      [2, 2, 100],
      [0, 0, 0],
    ])(
      "calcula %i de %i exercicios como %i por cento",
      async (completed, total, percentage) => {
        mockedActive.mockResolvedValue(buildProgressSession(total, completed));

        await renderSession();

        expectProgress(completed, total, percentage);

        expect(mockedUpdate).not.toHaveBeenCalled();
      },
    );

    it("atualiza o progresso apos o backend confirmar a conclusao", async () => {
      mockedActive.mockResolvedValue(buildProgressSession(2, 0));

      mockedUpdate.mockResolvedValue(buildProgressSession(2, 1));

      await renderSession();

      expectProgress(0, 2, 0);

      await fireEvent.press(
        screen.getByLabelText("Concluir exercício Exercício 1"),
      );

      await waitFor(() => {
        expectProgress(1, 2, 50);
      });

      expect(mockedUpdate).toHaveBeenCalledWith(
        "test-access-token",
        session.id,
        "exercise-1",
        { completed: true },
      );
    });

    it("reduz o progresso apos reabrir um exercicio", async () => {
      mockedActive.mockResolvedValue(buildProgressSession(2, 1));

      mockedUpdate.mockResolvedValue(buildProgressSession(2, 0));

      await renderSession();

      expectProgress(1, 2, 50);

      await fireEvent.press(
        screen.getByLabelText("Reabrir exercício Exercício 1"),
      );

      await waitFor(() => {
        expectProgress(0, 2, 0);
      });

      expect(mockedUpdate).toHaveBeenCalledWith(
        "test-access-token",
        session.id,
        "exercise-1",
        { completed: false },
      );
    });

    it("preserva o progresso quando o backend rejeita a atualizacao", async () => {
      mockedActive.mockResolvedValue(buildProgressSession(2, 0));

      mockedUpdate.mockRejectedValueOnce(
        new Error("The backend could not be reached."),
      );

      await renderSession();

      expectProgress(0, 2, 0);

      await fireEvent.press(
        screen.getByLabelText("Concluir exercício Exercício 1"),
      );

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "Não foi possível atualizar o exercício",
          "Não foi possível conectar ao servidor.",
        );
      });

      expectProgress(0, 2, 0);

      expect(
        screen.getByLabelText("Concluir exercício Exercício 1"),
      ).toBeTruthy();
    });

    it("nao antecipa o progresso enquanto o backend ainda responde", async () => {
      const updatedSession = buildProgressSession(2, 1);

      let resolveUpdate = (_value: WorkoutSession): void => {
        throw new Error("Requisicao nao inicializada.");
      };

      mockedActive.mockResolvedValue(buildProgressSession(2, 0));

      mockedUpdate.mockImplementationOnce(
        () =>
          new Promise<WorkoutSession>((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      await renderSession();

      expectProgress(0, 2, 0);

      await fireEvent.press(
        screen.getByLabelText("Concluir exercício Exercício 1"),
      );

      expect(mockedUpdate).toHaveBeenCalledTimes(1);
      expectProgress(0, 2, 0);

      await act(async () => {
        resolveUpdate(updatedSession);
      });

      await waitFor(() => {
        expectProgress(1, 2, 50);
      });
    });
  });
});
