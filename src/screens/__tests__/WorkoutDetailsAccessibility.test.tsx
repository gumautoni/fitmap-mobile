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
  archiveWorkout,
  getWorkout,
  removeWorkoutExercise,
  renameWorkout,
  reorderWorkoutExercises,
  type Workout,
  type WorkoutExercise,
} from "../../services/training";
import WorkoutDetailsScreen from "../WorkoutDetailsScreen";

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
  AlertCircle: () => null,
  Archive: () => null,
  ArrowDown: () => null,
  ArrowUp: () => null,
  ChevronRight: () => null,
  Dumbbell: () => null,
  Plus: () => null,
  RefreshCw: () => null,
  Save: () => null,
  Trash2: () => null,
}));

jest.mock("../../services/training", () => ({
  archiveWorkout: jest.fn(),
  getWorkout: jest.fn(),
  removeWorkoutExercise: jest.fn(),
  renameWorkout: jest.fn(),
  reorderWorkoutExercises: jest.fn(),
}));

const mockedGet = jest.mocked(getWorkout);
const mockedRename = jest.mocked(renameWorkout);
const mockedArchive = jest.mocked(archiveWorkout);
const mockedRemove = jest.mocked(removeWorkoutExercise);
const mockedReorder = jest.mocked(reorderWorkoutExercises);

const TOKEN = "test-access-token";
const WORKOUT_ID = "workout-management-test";
const TIMESTAMP = "2026-11-17T12:00:00Z";

const firstExercise: WorkoutExercise = {
  id: "planned-bench",
  exerciseId: "catalog-bench",
  exerciseName: "Supino reto",
  position: 1,
  targetSets: 3,
  targetRepetitions: 10,
  targetLoad: "40",
  targetLoadUnit: "kg",
  notes: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

const secondExercise: WorkoutExercise = {
  ...firstExercise,
  id: "planned-row",
  exerciseId: "catalog-row",
  exerciseName: "Remada baixa",
  position: 2,
};

const workout: Workout = {
  id: WORKOUT_ID,
  name: "Treino de teste",
  isArchived: false,
  archivedAt: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  exercises: [firstExercise, secondExercise],
};

async function authenticatedRequest<T>(
  request: (accessToken: string) => Promise<T>,
): Promise<T> {
  return request(TOKEN);
}

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: TOKEN,
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: authenticatedRequest,
  updateAuthenticatedUser: jest.fn(),
};

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

async function renderDetails() {
  await render(
    <AuthContext.Provider value={authValue}>
      <WorkoutDetailsScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof WorkoutDetailsScreen
          >["navigation"]
        }
        route={{
          key: "workout-management-test",
          name: "DetalhesTreino",
          params: { workoutId: WORKOUT_ID },
        }}
      />
    </AuthContext.Provider>,
  );

  await screen.findByPlaceholderText("Nome do treino");
}

function deferredFailure<T>() {
  let reject!: (reason: Error) => void;

  const promise = new Promise<T>((_, rejectRequest) => {
    reject = rejectRequest;
  });

  return { promise, reject };
}

async function confirmAlert(title: string, action: string) {
  const calls = jest.mocked(Alert.alert).mock.calls;

  const call = calls.find(([alertTitle]) => alertTitle === title);

  const button = call?.[2]?.find((option) => option.text === action);

  expect(button?.onPress).toBeDefined();

  await act(async () => {
    button?.onPress?.();
  });
}

function expectBusyButton(name: string) {
  expect(screen.getByRole("button", { name })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy: true,
      disabled: true,
    }),
  );
}

function expectReadyButton(name: string) {
  expect(screen.getByRole("button", { name })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy: false,
      disabled: false,
    }),
  );
}

describe("Workout details accessibility - ACC-02.2", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGet.mockResolvedValue(workout);
    mockedRename.mockResolvedValue(workout);
    mockedArchive.mockResolvedValue(workout);
    mockedRemove.mockResolvedValue(undefined);
    mockedReorder.mockResolvedValue(workout);

    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves existing navigation and movement boundaries", async () => {
    await renderDetails();

    expect(
      screen.getByRole("button", {
        name: "Mover Supino reto para cima",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Mover Remada baixa para baixo",
      }),
    ).toBeDisabled();

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Configurar Supino reto",
      }),
    );

    expect(navigation.navigate).toHaveBeenCalledWith(
      "ConfigurarExercicioTreino",
      {
        workoutId: WORKOUT_ID,
        workoutExerciseId: firstExercise.id,
      },
    );
  });

  it("provides an accessible label for the editable workout name", async () => {
    await renderDetails();

    const field = screen.getByLabelText("Nome do treino");

    expect(field).toHaveProp("value", workout.name);
    expect(field).toHaveProp("editable", true);
  });

  it("preserves rename accessibility and restores controls after failure", async () => {
    const request = deferredFailure<Workout>();

    mockedRename.mockReturnValueOnce(request.promise);

    await renderDetails();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Nome do treino"),
      "Treino renomeado",
    );

    await fireEvent.press(screen.getByText("Salvar nome"));

    try {
      expect(mockedRename).toHaveBeenCalledWith(
        TOKEN,
        WORKOUT_ID,
        "Treino renomeado",
      );

      expectBusyButton("Salvar nome");

      const field = screen.getByLabelText("Nome do treino");

      expect(field).toHaveProp("editable", false);
      expect(field).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );
    } finally {
      await act(async () => {
        request.reject(new Error("Falha de teste ao renomear"));
      });
    }

    expect(await screen.findByText("Falha de teste ao renomear")).toBeTruthy();

    expectReadyButton("Salvar nome");

    expect(screen.getByLabelText("Nome do treino")).toHaveProp(
      "editable",
      true,
    );

    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("preserves archive accessibility while the request is pending", async () => {
    const request = deferredFailure<Workout>();

    mockedArchive.mockReturnValueOnce(request.promise);

    await renderDetails();

    await fireEvent.press(screen.getByText("Arquivar treino"));
    await confirmAlert("Arquivar treino", "Arquivar");

    try {
      expect(mockedArchive).toHaveBeenCalledWith(TOKEN, WORKOUT_ID);

      expectBusyButton("Arquivar treino");

      expect(
        screen.getByRole("button", {
          name: "Configurar Supino reto",
        }),
      ).toBeDisabled();
    } finally {
      await act(async () => {
        request.reject(new Error("Falha de teste ao arquivar"));
      });
    }

    expect(await screen.findByText("Falha de teste ao arquivar")).toBeTruthy();

    expectReadyButton("Arquivar treino");

    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("announces exercise reordering and preserves movement boundaries", async () => {
    const request = deferredFailure<Workout>();

    mockedReorder.mockReturnValueOnce(request.promise);

    await renderDetails();

    const label = "Mover Supino reto para baixo";

    await fireEvent.press(screen.getByRole("button", { name: label }));

    try {
      expect(mockedReorder).toHaveBeenCalledWith(TOKEN, WORKOUT_ID, [
        secondExercise.id,
        firstExercise.id,
      ]);

      expectBusyButton(label);

      expect(
        screen.getByRole("button", {
          name: "Mover Remada baixa para cima",
        }),
      ).toBeDisabled();
    } finally {
      await act(async () => {
        request.reject(new Error("Falha de teste ao reordenar"));
      });
    }

    expect(await screen.findByText("Falha de teste ao reordenar")).toBeTruthy();

    expectReadyButton(label);

    expect(
      screen.getByRole("button", {
        name: "Mover Supino reto para cima",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Mover Remada baixa para cima",
      }),
    ).not.toBeDisabled();
  });

  it("announces exercise removal and restores controls after failure", async () => {
    const request = deferredFailure<void>();

    mockedRemove.mockReturnValueOnce(request.promise);

    await renderDetails();

    const label = "Remover Supino reto";

    await fireEvent.press(screen.getByRole("button", { name: label }));

    await confirmAlert("Remover exerc\u00edcio", "Remover");

    try {
      expect(mockedRemove).toHaveBeenCalledWith(
        TOKEN,
        WORKOUT_ID,
        firstExercise.id,
      );

      expectBusyButton(label);

      expect(
        screen.getByRole("button", {
          name: "Remover Remada baixa",
        }),
      ).toBeDisabled();
    } finally {
      await act(async () => {
        request.reject(new Error("Falha de teste ao remover"));
      });
    }

    expect(await screen.findByText("Falha de teste ao remover")).toBeTruthy();

    expectReadyButton(label);

    expect(
      screen.getByRole("button", {
        name: "Remover Remada baixa",
      }),
    ).not.toBeDisabled();
  });

  it("updates the accessible workout name after a successful rename", async () => {
    const renamedWorkout: Workout = {
      ...workout,
      name: "Treino renomeado com sucesso",
    };

    mockedRename.mockResolvedValueOnce(renamedWorkout);

    await renderDetails();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do treino"),
      renamedWorkout.name,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Salvar nome" }));

    await waitFor(() => {
      expect(mockedRename).toHaveBeenCalledWith(
        TOKEN,
        WORKOUT_ID,
        renamedWorkout.name,
      );

      expect(
        screen.queryByRole("button", {
          name: "Salvar nome",
        }),
      ).toBeNull();
    });

    const field = screen.getByLabelText("Nome do treino");

    expect(field).toHaveProp("value", renamedWorkout.name);

    expect(field).toHaveProp("editable", true);

    expect(field).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        disabled: false,
      }),
    );

    expect(screen.getByText(renamedWorkout.name)).toBeTruthy();

    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("preserves archive confirmation and navigation on success", async () => {
    mockedArchive.mockResolvedValueOnce({
      ...workout,
      isArchived: true,
      archivedAt: TIMESTAMP,
    });

    await renderDetails();

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Arquivar treino",
      }),
    );

    expect(mockedArchive).not.toHaveBeenCalled();

    await confirmAlert("Arquivar treino", "Arquivar");

    await waitFor(() => {
      expect(mockedArchive).toHaveBeenCalledTimes(1);

      expect(mockedArchive).toHaveBeenCalledWith(TOKEN, WORKOUT_ID);

      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  it("updates accessible movement boundaries after successful reordering", async () => {
    const reorderedWorkout: Workout = {
      ...workout,
      exercises: [
        { ...secondExercise, position: 1 },
        { ...firstExercise, position: 2 },
      ],
    };

    mockedReorder.mockResolvedValueOnce(reorderedWorkout);

    await renderDetails();

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Mover Supino reto para baixo",
      }),
    );

    await waitFor(() => {
      expect(mockedReorder).toHaveBeenCalledWith(TOKEN, WORKOUT_ID, [
        secondExercise.id,
        firstExercise.id,
      ]);

      expect(
        screen.getByRole("button", {
          name: "Mover Remada baixa para cima",
        }),
      ).toBeDisabled();

      expect(
        screen.getByRole("button", {
          name: "Mover Supino reto para baixo",
        }),
      ).toBeDisabled();

      expectReadyButton("Mover Supino reto para cima");
      expectReadyButton("Mover Remada baixa para baixo");
    });

    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("removes the accessible exercise controls after successful removal", async () => {
    await renderDetails();

    mockedGet.mockResolvedValueOnce({
      ...workout,
      exercises: [{ ...secondExercise, position: 1 }],
    });

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Remover Supino reto",
      }),
    );

    expect(mockedRemove).not.toHaveBeenCalled();

    await confirmAlert("Remover exerc\u00edcio", "Remover");

    await waitFor(() => {
      expect(mockedRemove).toHaveBeenCalledWith(
        TOKEN,
        WORKOUT_ID,
        firstExercise.id,
      );

      expect(mockedGet).toHaveBeenCalledTimes(2);

      expect(
        screen.queryByRole("button", {
          name: "Configurar Supino reto",
        }),
      ).toBeNull();

      expect(
        screen.queryByRole("button", {
          name: "Remover Supino reto",
        }),
      ).toBeNull();
    });

    expectReadyButton("Remover Remada baixa");

    expect(
      screen.getByRole("button", {
        name: "Mover Remada baixa para cima",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Mover Remada baixa para baixo",
      }),
    ).toBeDisabled();

    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
