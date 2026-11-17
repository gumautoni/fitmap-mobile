import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";
import { Alert } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  createWorkout,
  getWorkout,
  updateWorkoutExercise,
  type Workout,
} from "../../services/training";
import CreateWorkoutScreen from "../CreateWorkoutScreen";
import WorkoutExerciseConfigScreen from "../WorkoutExerciseConfigScreen";

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
  Dumbbell: () => null,
  RefreshCw: () => null,
  Save: () => null,
}));

jest.mock("../../services/training", () => ({
  createWorkout: jest.fn(),
  getWorkout: jest.fn(),
  updateWorkoutExercise: jest.fn(),
}));

const mockedCreateWorkout = jest.mocked(createWorkout);
const mockedGetWorkout = jest.mocked(getWorkout);

const TOKEN = "test-access-token";
const WORKOUT_ID = "workout-accessibility-test";
const EXERCISE_ID = "exercise-accessibility-test";
const TIMESTAMP = "2026-11-17T12:00:00Z";

const workout: Workout = {
  id: WORKOUT_ID,
  name: "Treino de teste",
  isArchived: false,
  archivedAt: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  exercises: [
    {
      id: EXERCISE_ID,
      exerciseId: "catalog-exercise-test",
      exerciseName: "Supino reto",
      position: 1,
      targetSets: 3,
      targetRepetitions: 10,
      targetLoad: "40",
      targetLoadUnit: "kg",
      notes: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
  ],
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
  goBack: jest.fn(),
};

async function renderCreateWorkout() {
  await render(
    <AuthContext.Provider value={authValue}>
      <CreateWorkoutScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof CreateWorkoutScreen
          >["navigation"]
        }
        route={{
          key: "create-workout-test",
          name: "NovoTreino",
        }}
      />
    </AuthContext.Provider>,
  );
}

async function renderExerciseConfig() {
  await render(
    <AuthContext.Provider value={authValue}>
      <WorkoutExerciseConfigScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof WorkoutExerciseConfigScreen
          >["navigation"]
        }
        route={{
          key: "exercise-config-test",
          name: "ConfigurarExercicioTreino",
          params: {
            workoutId: WORKOUT_ID,
            workoutExerciseId: EXERCISE_ID,
          },
        }}
      />
    </AuthContext.Provider>,
  );

  await screen.findByPlaceholderText("Ex.: 4");
}

describe("Workout forms accessibility - ACC-02", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetWorkout.mockResolvedValue(workout);
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("provides an accessible label for the workout name", async () => {
    await renderCreateWorkout();

    expect(screen.getByLabelText("Nome do treino")).toBeTruthy();
  });

  it("provides accessible labels for exercise configuration fields", async () => {
    await renderExerciseConfig();

    for (const label of [
      "S\u00e9ries",
      "Repeti\u00e7\u00f5es",
      "Carga",
      "Notas do exerc\u00edcio",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("communicates the selected load unit and updates its state", async () => {
    await renderExerciseConfig();

    expect(screen.getByRole("button", { name: "kg" })).toHaveProp(
      "accessibilityState",
      {
        selected: true,
        disabled: false,
      },
    );

    expect(screen.getByRole("button", { name: "lb" })).toHaveProp(
      "accessibilityState",
      {
        selected: false,
        disabled: false,
      },
    );

    await fireEvent.press(screen.getByRole("button", { name: "lb" }));

    expect(screen.getByRole("button", { name: "kg" })).toHaveProp(
      "accessibilityState",
      {
        selected: false,
        disabled: false,
      },
    );

    expect(screen.getByRole("button", { name: "lb" })).toHaveProp(
      "accessibilityState",
      {
        selected: true,
        disabled: false,
      },
    );
  });

  it("preserves the create button name and announces its busy state", async () => {
    let finishRequest!: (value: Workout) => void;

    mockedCreateWorkout.mockReturnValueOnce(
      new Promise<Workout>((resolve) => {
        finishRequest = resolve;
      }),
    );

    await renderCreateWorkout();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Ex.: Push, Pernas ou Treino A"),
      "Treino A",
    );

    await fireEvent.press(screen.getByRole("button", { name: "Criar treino" }));

    try {
      expect(mockedCreateWorkout).toHaveBeenCalledWith(TOKEN, "Treino A");

      expect(screen.getByRole("button", { name: "Criar treino" })).toHaveProp(
        "accessibilityState",
        {
          busy: true,
          disabled: true,
        },
      );
    } finally {
      await act(async () => {
        finishRequest(workout);
      });
    }
  });

  it("shows a non-color indicator for the selected load unit", async () => {
    await renderExerciseConfig();

    expect(screen.getByText("kg \u2713")).toBeTruthy();
    expect(screen.queryByText("lb \u2713")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "lb" }));

    expect(screen.getByText("lb \u2713")).toBeTruthy();
    expect(screen.queryByText("kg \u2713")).toBeNull();
  });

  it("preserves configuration accessibility while saving", async () => {
    let finishRequest!: (value: Workout) => void;

    const mockedUpdate = jest.mocked(updateWorkoutExercise);

    mockedUpdate.mockReturnValueOnce(
      new Promise<Workout>((resolve) => {
        finishRequest = resolve;
      }),
    );

    await renderExerciseConfig();

    await fireEvent.press(screen.getByRole("button", { name: "lb" }));

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Salvar configura\u00e7\u00e3o",
      }),
    );

    try {
      expect(mockedUpdate).toHaveBeenCalledWith(
        TOKEN,
        WORKOUT_ID,
        EXERCISE_ID,
        {
          targetSets: 3,
          targetRepetitions: 10,
          targetLoad: "40",
          targetLoadUnit: "lb",
          notes: null,
        },
      );

      expect(
        screen.getByRole("button", {
          name: "Salvar configura\u00e7\u00e3o",
        }),
      ).toHaveProp("accessibilityState", {
        busy: true,
        disabled: true,
      });

      expect(screen.getByRole("button", { name: "kg" })).toHaveProp(
        "accessibilityState",
        {
          selected: false,
          disabled: true,
        },
      );

      expect(screen.getByRole("button", { name: "lb" })).toHaveProp(
        "accessibilityState",
        {
          selected: true,
          disabled: true,
        },
      );

      for (const label of [
        "S\u00e9ries",
        "Repeti\u00e7\u00f5es",
        "Carga",
        "Notas do exerc\u00edcio",
      ]) {
        const field = screen.getByLabelText(label);

        expect(field).toHaveProp("editable", false);
        expect(field).toHaveProp(
          "accessibilityState",
          expect.objectContaining({ disabled: true }),
        );
      }
    } finally {
      await act(async () => {
        finishRequest({
          ...workout,
          exercises: workout.exercises.map((exercise) => ({
            ...exercise,
            targetLoadUnit: "lb",
          })),
        });
      });
    }

    expect(
      screen.getByRole("button", {
        name: "Salvar configura\u00e7\u00e3o",
      }),
    ).toHaveProp("accessibilityState", {
      busy: false,
      disabled: false,
    });

    expect(screen.getByRole("button", { name: "lb" })).toHaveProp(
      "accessibilityState",
      {
        selected: true,
        disabled: false,
      },
    );
  });

  it("disables creation controls until the request finishes", async () => {
    let finishRequest!: (value: Workout) => void;

    mockedCreateWorkout.mockReturnValueOnce(
      new Promise<Workout>((resolve) => {
        finishRequest = resolve;
      }),
    );

    await renderCreateWorkout();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do treino"),
      "Treino A",
    );

    await fireEvent.press(screen.getByRole("button", { name: "Criar treino" }));

    try {
      const field = screen.getByLabelText("Nome do treino");

      expect(field).toHaveProp("editable", false);
      expect(field).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );

      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    } finally {
      await act(async () => {
        finishRequest(workout);
      });
    }

    expect(screen.getByLabelText("Nome do treino")).toHaveProp(
      "editable",
      true,
    );

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();

    expect(screen.getByRole("button", { name: "Criar treino" })).toHaveProp(
      "accessibilityState",
      {
        busy: false,
        disabled: false,
      },
    );
  });

  it("restores accessible controls after a configuration save failure", async () => {
    jest
      .mocked(updateWorkoutExercise)
      .mockRejectedValueOnce(new Error("Falha de teste"));

    await renderExerciseConfig();

    await fireEvent.press(screen.getByRole("button", { name: "lb" }));

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Salvar configura\u00e7\u00e3o",
      }),
    );

    await screen.findByText("Falha de teste");

    expect(
      screen.getByRole("button", {
        name: "Salvar configura\u00e7\u00e3o",
      }),
    ).toHaveProp("accessibilityState", {
      busy: false,
      disabled: false,
    });

    expect(screen.getByLabelText("Carga")).toHaveProp("editable", true);

    expect(screen.getByRole("button", { name: "lb" })).toHaveProp(
      "accessibilityState",
      {
        selected: true,
        disabled: false,
      },
    );

    expect(screen.getByText("lb \u2713")).toBeTruthy();
  });
});
