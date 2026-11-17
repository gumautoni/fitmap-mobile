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
  getWorkouts,
  restoreWorkout,
  type Workout,
  type WorkoutSummary,
} from "../../services/training";
import WorkoutsScreen from "../WorkoutsScreen";

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

jest.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

jest.mock("../../components/ScreenGradient", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  Archive: () => null,
  ArchiveRestore: () => null,
  ChevronRight: () => null,
  Dumbbell: () => null,
  Plus: () => null,
  RefreshCw: () => null,
}));

jest.mock("../../services/training", () => ({
  getWorkouts: jest.fn(),
  restoreWorkout: jest.fn(),
}));

const mockedGet = jest.mocked(getWorkouts);
const mockedRestore = jest.mocked(restoreWorkout);

const TOKEN = "test-access-token";
const TIMESTAMP = "2026-11-17T12:00:00Z";

const activeWorkout: WorkoutSummary = {
  id: "active-workout",
  name: "Treino ativo",
  isArchived: false,
  archivedAt: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

const archivedWorkout: WorkoutSummary = {
  ...activeWorkout,
  id: "archived-workout",
  name: "Treino arquivado A",
  isArchived: true,
  archivedAt: TIMESTAMP,
};

const anotherArchivedWorkout: WorkoutSummary = {
  ...archivedWorkout,
  id: "another-archived-workout",
  name: "Treino arquivado B",
};

const restoredWorkout: Workout = {
  ...archivedWorkout,
  isArchived: false,
  archivedAt: null,
  exercises: [],
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
};

async function renderWorkouts() {
  await render(
    <AuthContext.Provider value={authValue}>
      <WorkoutsScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof WorkoutsScreen
          >["navigation"]
        }
        route={{
          key: "workouts-accessibility-test",
          name: "Treinos",
        }}
      />
    </AuthContext.Provider>,
  );

  await screen.findByLabelText("Restaurar treino Treino arquivado A");
}

async function confirmRestore() {
  const call = jest
    .mocked(Alert.alert)
    .mock.calls.find(([title]) => title === "Restaurar treino");

  const button = call?.[2]?.find((option) => option.text === "Restaurar");

  expect(button?.onPress).toBeDefined();

  await act(async () => {
    button?.onPress?.();
  });
}

function restoreButton() {
  return screen.getByRole("button", {
    name: "Restaurar treino Treino arquivado A",
  });
}

function otherRestoreButton() {
  return screen.getByRole("button", {
    name: "Restaurar treino Treino arquivado B",
  });
}

function createButton() {
  return screen.getByRole("button", {
    name: "Criar novo treino",
  });
}

function activeButton() {
  return screen.getByRole("button", {
    name: "Abrir treino Treino ativo",
  });
}

describe("Workout list accessibility - ACC-02.2", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGet.mockResolvedValue([
      activeWorkout,
      archivedWorkout,
      anotherArchivedWorkout,
    ]);

    mockedRestore.mockResolvedValue(restoredWorkout);

    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves accessible navigation for active workouts", async () => {
    await renderWorkouts();

    expect(mockedGet).toHaveBeenCalledWith(TOKEN, true);

    await fireEvent.press(createButton());

    expect(navigation.navigate).toHaveBeenCalledWith("NovoTreino");

    await fireEvent.press(activeButton());

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesTreino", {
      workoutId: activeWorkout.id,
    });

    expect(mockedRestore).not.toHaveBeenCalled();
  });

  it("announces restoration until the refreshed list is available", async () => {
    await renderWorkouts();

    let finishRefresh!: (value: WorkoutSummary[]) => void;

    mockedGet.mockReturnValueOnce(
      new Promise<WorkoutSummary[]>((resolve) => {
        finishRefresh = resolve;
      }),
    );

    await fireEvent.press(restoreButton());

    expect(mockedRestore).not.toHaveBeenCalled();

    await confirmRestore();

    try {
      await waitFor(() => {
        expect(mockedGet).toHaveBeenCalledTimes(2);
      });

      expect(mockedRestore).toHaveBeenCalledWith(TOKEN, archivedWorkout.id);

      expect(restoreButton()).toHaveProp(
        "accessibilityState",
        expect.objectContaining({
          busy: true,
          disabled: true,
        }),
      );

      expect(otherRestoreButton()).toBeDisabled();
      expect(createButton()).toBeDisabled();
      expect(activeButton()).toBeDisabled();
    } finally {
      await act(async () => {
        finishRefresh([activeWorkout, restoredWorkout, anotherArchivedWorkout]);
      });
    }

    expect(
      screen.queryByRole("button", {
        name: "Restaurar treino Treino arquivado A",
      }),
    ).toBeNull();

    expect(
      screen.getByRole("button", {
        name: "Abrir treino Treino arquivado A",
      }),
    ).not.toBeDisabled();

    expect(otherRestoreButton()).not.toBeDisabled();
    expect(createButton()).not.toBeDisabled();

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("restores accessible controls after restoration failure", async () => {
    let failRequest!: (reason: Error) => void;

    mockedRestore.mockReturnValueOnce(
      new Promise<Workout>((_, reject) => {
        failRequest = reject;
      }),
    );

    await renderWorkouts();

    await fireEvent.press(restoreButton());
    await confirmRestore();

    try {
      expect(mockedRestore).toHaveBeenCalledWith(TOKEN, archivedWorkout.id);

      expect(restoreButton()).toHaveProp(
        "accessibilityState",
        expect.objectContaining({
          busy: true,
          disabled: true,
        }),
      );

      expect(otherRestoreButton()).toBeDisabled();
      expect(createButton()).toBeDisabled();
      expect(activeButton()).toBeDisabled();
    } finally {
      await act(async () => {
        failRequest(new Error("Falha de teste ao restaurar"));
      });
    }

    expect(await screen.findByText("Falha de teste ao restaurar")).toBeTruthy();

    expect(restoreButton()).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(otherRestoreButton()).not.toBeDisabled();
    expect(createButton()).not.toBeDisabled();
    expect(activeButton()).not.toBeDisabled();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
