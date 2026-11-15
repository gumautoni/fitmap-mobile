import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { usePreventRemove } from "@react-navigation/native";
import type { ComponentProps, ContextType } from "react";
import { AccessibilityInfo, Alert } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  addSetExecution,
  cancelWorkoutSession,
  finishWorkoutSession,
  getActiveWorkoutSession,
  updateExerciseExecution,
  updateWorkoutSession,
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

jest.mock("@react-navigation/native", () => ({
  usePreventRemove: jest.fn(),
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
  updateWorkoutSession: jest.fn(),
}));

const mockedActive = getActiveWorkoutSession as jest.Mock;
const mockedUpdate = updateExerciseExecution as jest.Mock;
const mockedFinish = finishWorkoutSession as jest.Mock;
const mockedCancel = cancelWorkoutSession as jest.Mock;
const mockedSessionUpdate = updateWorkoutSession as jest.Mock;
const mockedAdd = addSetExecution as jest.Mock;
const mockedPreventRemove = jest.mocked(usePreventRemove);

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

  describe("execution notes", () => {
    const sessionLabel = "Observa\u00e7\u00e3o do treino";
    const exerciseLabel =
      "Observa\u00e7\u00e3o do exerc\u00edcio Exercicio de teste";
    const secondLabel =
      "Observa\u00e7\u00e3o do exerc\u00edcio Segundo exercicio";

    const saveSessionLabel = "Salvar observa\u00e7\u00e3o do treino";
    const saveExerciseLabel =
      "Salvar observa\u00e7\u00e3o do exerc\u00edcio Exercicio de teste";
    const saveSecondLabel =
      "Salvar observa\u00e7\u00e3o do exerc\u00edcio Segundo exercicio";

    const discardSessionLabel =
      "Descartar altera\u00e7\u00f5es da observa\u00e7\u00e3o do treino";
    const discardExerciseLabel =
      "Descartar altera\u00e7\u00f5es da observa\u00e7\u00e3o do exerc\u00edcio Exercicio de teste";

    const unsavedTitle = "Observa\u00e7\u00f5es n\u00e3o salvas";
    const saveErrorTitle =
      "N\u00e3o foi poss\u00edvel salvar a observa\u00e7\u00e3o";

    const notedSession: WorkoutSession = {
      ...session,
      notes: "Saved workout note",
      exercises: [
        {
          ...session.exercises[0],
          plannedNotes: "Planned technique",
          notes: "Saved exercise note",
        },
        {
          ...session.exercises[0],
          id: "exercise-test-456",
          exerciseId: "catalog-exercise-456",
          exerciseName: "Segundo exercicio",
          position: 2,
          plannedNotes: null,
          notes: null,
          isCompleted: false,
          completedAt: null,
        },
      ],
    };

    function withSessionNote(notes: string | null): WorkoutSession {
      return {
        ...notedSession,
        notes,
      };
    }

    function withExerciseNote(notes: string | null): WorkoutSession {
      return {
        ...notedSession,
        exercises: [
          {
            ...notedSession.exercises[0],
            notes,
          },
          notedSession.exercises[1],
        ],
      };
    }

    function noteValue(label: string): string {
      return screen.getByLabelText(label).props.value;
    }

    async function typeNote(label: string, value: string): Promise<void> {
      await fireEvent.changeText(screen.getByLabelText(label), value);
    }

    async function pressNoteAction(label: string): Promise<void> {
      await fireEvent.press(screen.getByLabelText(label));
    }

    beforeEach(() => {
      mockedActive.mockResolvedValue(notedSession);
      mockedSessionUpdate.mockReset();
      mockedUpdate.mockReset();
      mockedAdd.mockReset();
    });

    it("notes: loads persisted notes separately from planned instructions", async () => {
      await renderSession();

      expect(noteValue(sessionLabel)).toBe("Saved workout note");
      expect(noteValue(exerciseLabel)).toBe("Saved exercise note");
      expect(noteValue(secondLabel)).toBe("");

      expect(screen.getByText("Planned technique")).toBeTruthy();

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      expect(screen.getByLabelText(saveExerciseLabel)).toBeDisabled();
      expect(screen.getByLabelText(saveSecondLabel)).toBeDisabled();

      expect(mockedSessionUpdate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it("notes: preserves raw input without making equivalent whitespace dirty", async () => {
      await renderSession();

      await typeNote(sessionLabel, "  Saved workout note  ");

      expect(noteValue(sessionLabel)).toBe("  Saved workout note  ");
      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();

      await typeNote(secondLabel, " \n\t ");

      expect(screen.getByLabelText(saveSecondLabel)).toBeDisabled();

      expect(mockedSessionUpdate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it("notes: saves normalized session notes and acknowledges the server response", async () => {
      mockedSessionUpdate.mockResolvedValue(
        withSessionNote("New workout note"),
      );

      await renderSession();

      await typeNote(sessionLabel, "  New workout note  ");

      expect(mockedSessionUpdate).not.toHaveBeenCalled();

      await pressNoteAction(saveSessionLabel);

      expect(mockedSessionUpdate).toHaveBeenCalledWith(
        "test-access-token",
        notedSession.id,
        { notes: "New workout note" },
      );

      await waitFor(() => {
        expect(noteValue(sessionLabel)).toBe("New workout note");
        expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      });

      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(noteValue(exerciseLabel)).toBe("Saved exercise note");
    });

    it("notes: saves exercise notes without changing completion or other drafts", async () => {
      mockedUpdate.mockResolvedValue(withExerciseNote("New exercise note"));

      await renderSession();

      await typeNote(sessionLabel, "Unsaved workout");
      await typeNote(secondLabel, "Unsaved second exercise");
      await typeNote(exerciseLabel, " New exercise note ");

      await pressNoteAction(saveExerciseLabel);

      expect(mockedUpdate).toHaveBeenCalledWith(
        "test-access-token",
        notedSession.id,
        notedSession.exercises[0].id,
        { notes: "New exercise note" },
      );

      await waitFor(() => {
        expect(noteValue(exerciseLabel)).toBe("New exercise note");
        expect(screen.getByLabelText(saveExerciseLabel)).toBeDisabled();
      });

      expect(noteValue(sessionLabel)).toBe("Unsaved workout");
      expect(noteValue(secondLabel)).toBe("Unsaved second exercise");

      expect(
        screen.getByLabelText("Reabrir exerc\u00edcio Exercicio de teste"),
      ).toBeTruthy();

      expect(screen.getByText("Planned technique")).toBeTruthy();
      expect(mockedSessionUpdate).not.toHaveBeenCalled();
    });

    it("notes: clears persisted session notes using an explicit null payload", async () => {
      mockedSessionUpdate.mockResolvedValue(withSessionNote(null));

      await renderSession();

      await typeNote(sessionLabel, "");

      expect(screen.getByLabelText(saveSessionLabel)).not.toBeDisabled();

      await pressNoteAction(saveSessionLabel);

      expect(mockedSessionUpdate).toHaveBeenCalledWith(
        "test-access-token",
        notedSession.id,
        { notes: null },
      );

      await waitFor(() => {
        expect(noteValue(sessionLabel)).toBe("");
        expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      });
    });

    it("notes: clears persisted exercise notes using an explicit null payload", async () => {
      mockedUpdate.mockResolvedValue(withExerciseNote(null));

      await renderSession();

      await typeNote(exerciseLabel, "   ");

      await pressNoteAction(saveExerciseLabel);

      expect(mockedUpdate).toHaveBeenCalledWith(
        "test-access-token",
        notedSession.id,
        notedSession.exercises[0].id,
        { notes: null },
      );

      await waitFor(() => {
        expect(noteValue(exerciseLabel)).toBe("");
        expect(screen.getByLabelText(saveExerciseLabel)).toBeDisabled();
      });

      expect(screen.getByText("Planned technique")).toBeTruthy();
    });

    it("notes: preserves unsaved drafts when exercise completion changes", async () => {
      mockedUpdate.mockResolvedValue({
        ...notedSession,
        exercises: [
          {
            ...notedSession.exercises[0],
            isCompleted: false,
            completedAt: null,
          },
          notedSession.exercises[1],
        ],
      });

      await renderSession();

      await typeNote(sessionLabel, "Session draft");
      await typeNote(exerciseLabel, "Exercise draft");

      await fireEvent.press(
        screen.getByLabelText("Reabrir exerc\u00edcio Exercicio de teste"),
      );

      await screen.findByLabelText(
        "Concluir exerc\u00edcio Exercicio de teste",
      );

      expect(mockedUpdate).toHaveBeenCalledWith(
        "test-access-token",
        notedSession.id,
        notedSession.exercises[0].id,
        { completed: false },
      );

      expect(noteValue(sessionLabel)).toBe("Session draft");
      expect(noteValue(exerciseLabel)).toBe("Exercise draft");

      expect(mockedSessionUpdate).not.toHaveBeenCalled();
    });

    it("notes: preserves unsaved drafts when a set is registered", async () => {
      mockedAdd.mockResolvedValue({
        ...notedSession,
        updatedAt: "2026-11-04T10:20:00Z",
      });

      await renderSession();

      await typeNote(sessionLabel, "Session draft");
      await typeNote(secondLabel, "Second exercise draft");

      await fireEvent.press(
        screen.getByLabelText("Registrar s\u00e9rie de Segundo exercicio"),
      );

      expect(mockedAdd).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Registrar s\u00e9rie de Segundo exercicio"),
        ).not.toBeDisabled();
      });

      expect(noteValue(sessionLabel)).toBe("Session draft");
      expect(noteValue(secondLabel)).toBe("Second exercise draft");

      expect(mockedSessionUpdate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it("notes: retains failed drafts and allows a successful retry", async () => {
      mockedSessionUpdate
        .mockRejectedValueOnce(new Error("The backend could not be reached."))
        .mockResolvedValueOnce(withSessionNote("Retry note"));

      await renderSession();

      await typeNote(sessionLabel, "  Retry note  ");

      await pressNoteAction(saveSessionLabel);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          saveErrorTitle,
          "N\u00e3o foi poss\u00edvel conectar ao servidor.",
        );
      });

      expect(noteValue(sessionLabel)).toBe("  Retry note  ");
      expect(screen.getByLabelText(saveSessionLabel)).not.toBeDisabled();

      await pressNoteAction(saveSessionLabel);

      await waitFor(() => {
        expect(noteValue(sessionLabel)).toBe("Retry note");
        expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      });

      expect(mockedSessionUpdate).toHaveBeenCalledTimes(2);
    });

    it("notes: retains dirty drafts when the response does not confirm the note", async () => {
      mockedSessionUpdate.mockResolvedValue(notedSession);

      await renderSession();

      await typeNote(sessionLabel, "Expected saved note");

      await pressNoteAction(saveSessionLabel);

      await waitFor(() => {
        expect(screen.getByLabelText(saveSessionLabel)).not.toBeDisabled();
      });

      expect(noteValue(sessionLabel)).toBe("Expected saved note");

      expect(alertSpy).toHaveBeenCalledWith(saveErrorTitle, expect.any(String));

      expect(mockedSessionUpdate).toHaveBeenCalledTimes(1);
    });

    it("notes: prevents conflicting operations while a save is pending", async () => {
      let resolveSave = (_value: WorkoutSession): void => {
        throw new Error("Save not initialized.");
      };

      mockedSessionUpdate.mockImplementationOnce(
        () =>
          new Promise<WorkoutSession>((resolve) => {
            resolveSave = resolve;
          }),
      );

      await renderSession();

      await typeNote(sessionLabel, "Pending save");

      await pressNoteAction(saveSessionLabel);

      expect(mockedSessionUpdate).toHaveBeenCalledTimes(1);

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      expect(screen.getByLabelText("Finalizar treino")).toBeDisabled();
      expect(screen.getByLabelText("Cancelar treino")).toBeDisabled();

      expect(
        screen.getByLabelText("Registrar s\u00e9rie de Segundo exercicio"),
      ).toBeDisabled();

      expect(
        screen.getByLabelText("Reabrir exerc\u00edcio Exercicio de teste"),
      ).toBeDisabled();

      expect(screen.getByLabelText(sessionLabel).props.editable).toBe(false);
      expect(screen.getByLabelText(exerciseLabel).props.editable).toBe(false);
      expect(screen.getByLabelText(secondLabel).props.editable).toBe(false);

      await act(async () => {
        resolveSave(withSessionNote("Pending save"));
      });

      await waitFor(() => {
        expect(screen.getByLabelText("Finalizar treino")).not.toBeDisabled();
        expect(screen.getByLabelText(sessionLabel).props.editable).toBe(true);
      });

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      expect(mockedFinish).not.toHaveBeenCalled();
      expect(mockedCancel).not.toHaveBeenCalled();
      expect(mockedAdd).not.toHaveBeenCalled();
    });

    it("notes: discards individual changes without updating the server", async () => {
      await renderSession();

      await typeNote(sessionLabel, "Discard session draft");
      await typeNote(exerciseLabel, "Discard exercise draft");

      await pressNoteAction(discardSessionLabel);

      expect(noteValue(sessionLabel)).toBe("Saved workout note");
      expect(noteValue(exerciseLabel)).toBe("Discard exercise draft");

      await pressNoteAction(discardExerciseLabel);

      expect(noteValue(exerciseLabel)).toBe("Saved exercise note");

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
      expect(screen.getByLabelText(saveExerciseLabel)).toBeDisabled();

      expect(mockedSessionUpdate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it("notes: blocks finishing while unsaved changes exist", async () => {
      await renderSession();

      await typeNote(sessionLabel, "Unsaved note");

      await fireEvent.press(screen.getByLabelText("Finalizar treino"));

      expect(alertSpy).toHaveBeenCalledWith(unsavedTitle, expect.any(String));

      expect(mockedFinish).not.toHaveBeenCalled();
      expect(noteValue(sessionLabel)).toBe("Unsaved note");

      await pressNoteAction(discardSessionLabel);

      await fireEvent.press(screen.getByLabelText("Finalizar treino"));

      await confirmAlert("Finalizar treino", "Finalizar");

      expect(mockedFinish).toHaveBeenCalledTimes(1);
    });

    it("notes: blocks cancelling while unsaved exercise changes exist", async () => {
      await renderSession();

      await typeNote(exerciseLabel, "Unsaved exercise");

      await fireEvent.press(screen.getByLabelText("Cancelar treino"));

      expect(alertSpy).toHaveBeenCalledWith(unsavedTitle, expect.any(String));

      expect(mockedCancel).not.toHaveBeenCalled();
      expect(noteValue(exerciseLabel)).toBe("Unsaved exercise");

      await pressNoteAction(discardExerciseLabel);

      await fireEvent.press(screen.getByLabelText("Cancelar treino"));

      await confirmAlert("Cancelar treino", "Cancelar treino");

      expect(mockedCancel).toHaveBeenCalledTimes(1);
    });

    it("notes: activates the navigation guard only while drafts remain unsaved", async () => {
      await renderSession();

      expect(mockedPreventRemove).toHaveBeenLastCalledWith(
        false,
        expect.any(Function),
      );

      await typeNote(sessionLabel, "Unsaved navigation note");

      expect(mockedPreventRemove).toHaveBeenLastCalledWith(
        true,
        expect.any(Function),
      );

      const calls = mockedPreventRemove.mock.calls;
      const preventRemoveCallback = calls[calls.length - 1][1];

      await act(async () => {
        preventRemoveCallback({
          data: {
            action: { type: "GO_BACK" },
          },
        });
      });

      expect(alertSpy).toHaveBeenCalledWith(unsavedTitle, expect.any(String));

      expect(noteValue(sessionLabel)).toBe("Unsaved navigation note");

      await pressNoteAction(discardSessionLabel);

      expect(mockedPreventRemove).toHaveBeenLastCalledWith(
        false,
        expect.any(Function),
      );

      expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it("notes: robustness: rejects a save response belonging to another session", async () => {
      mockedSessionUpdate.mockResolvedValue({
        ...withSessionNote("Submitted note"),
        id: "different-session",
        workoutName: "Different workout",
      });

      await renderSession();

      await typeNote(sessionLabel, "Submitted note");
      await pressNoteAction(saveSessionLabel);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          saveErrorTitle,
          expect.any(String),
        );
      });

      expect(noteValue(sessionLabel)).toBe("Submitted note");

      expect(screen.getByLabelText(saveSessionLabel)).not.toBeDisabled();

      expect(screen.queryByText("Different workout")).toBeNull();

      expect(noteValue(exerciseLabel)).toBe("Saved exercise note");
    });

    it("notes: robustness: rejects a response missing the saved exercise", async () => {
      mockedUpdate.mockResolvedValue({
        ...notedSession,
        exercises: [notedSession.exercises[1]],
      });

      await renderSession();

      await typeNote(exerciseLabel, "Unconfirmed exercise note");

      await pressNoteAction(saveExerciseLabel);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          saveErrorTitle,
          expect.any(String),
        );
      });

      expect(noteValue(exerciseLabel)).toBe("Unconfirmed exercise note");

      expect(screen.getByLabelText(saveExerciseLabel)).not.toBeDisabled();

      expect(noteValue(sessionLabel)).toBe("Saved workout note");

      expect(noteValue(secondLabel)).toBe("");
    });

    it("notes: robustness: prevents another note save during a pending save", async () => {
      let resolveSave = (_value: WorkoutSession): void => {
        throw new Error("Save not initialized.");
      };

      mockedSessionUpdate.mockImplementationOnce(
        () =>
          new Promise<WorkoutSession>((resolve) => {
            resolveSave = resolve;
          }),
      );

      await renderSession();

      await typeNote(sessionLabel, "Pending session save");
      await typeNote(exerciseLabel, "Independent exercise draft");

      await pressNoteAction(saveSessionLabel);

      expect(screen.getByLabelText(saveExerciseLabel)).toBeDisabled();

      await pressNoteAction(saveExerciseLabel);

      expect(mockedSessionUpdate).toHaveBeenCalledTimes(1);
      expect(mockedUpdate).not.toHaveBeenCalled();

      await act(async () => {
        resolveSave(withSessionNote("Pending session save"));
      });

      await waitFor(() => {
        expect(screen.getByLabelText(saveExerciseLabel)).not.toBeDisabled();
      });

      expect(noteValue(exerciseLabel)).toBe("Independent exercise draft");

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();
    });

    it("notes: robustness: prevents note saves during a pending set operation", async () => {
      let resolveSet = (_value: WorkoutSession): void => {
        throw new Error("Set operation not initialized.");
      };

      mockedAdd.mockImplementationOnce(
        () =>
          new Promise<WorkoutSession>((resolve) => {
            resolveSet = resolve;
          }),
      );

      await renderSession();

      await typeNote(sessionLabel, "Preserved workout draft");
      await typeNote(exerciseLabel, "Preserved exercise draft");

      await fireEvent.press(
        screen.getByLabelText("Registrar s\u00e9rie de Segundo exercicio"),
      );

      expect(mockedAdd).toHaveBeenCalledTimes(1);

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();

      expect(screen.getByLabelText(saveExerciseLabel)).toBeDisabled();

      expect(screen.getByLabelText(sessionLabel).props.editable).toBe(false);

      await pressNoteAction(saveSessionLabel);

      expect(mockedSessionUpdate).not.toHaveBeenCalled();

      await act(async () => {
        resolveSet(notedSession);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(saveSessionLabel)).not.toBeDisabled();
      });

      expect(noteValue(sessionLabel)).toBe("Preserved workout draft");

      expect(noteValue(exerciseLabel)).toBe("Preserved exercise draft");

      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it("notes: robustness: discards equivalent raw whitespace without an API request", async () => {
      await renderSession();

      await typeNote(sessionLabel, "  Saved workout note  ");

      expect(screen.getByLabelText(saveSessionLabel)).toBeDisabled();

      expect(screen.getByLabelText(discardSessionLabel)).not.toBeDisabled();

      await pressNoteAction(discardSessionLabel);

      expect(noteValue(sessionLabel)).toBe("Saved workout note");

      expect(screen.queryByLabelText(discardSessionLabel)).toBeNull();

      expect(mockedSessionUpdate).not.toHaveBeenCalled();

      expect(mockedPreventRemove).toHaveBeenLastCalledWith(
        false,
        expect.any(Function),
      );
    });
  });
});
