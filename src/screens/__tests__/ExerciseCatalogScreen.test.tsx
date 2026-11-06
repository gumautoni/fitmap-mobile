import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import {
  addExerciseToWorkout,
  createCustomExercise,
  getAvailableExercises,
  getWorkout,
  type TrainingExercise,
  type Workout,
} from "../../services/training";
import ExerciseCatalogScreen from "../ExerciseCatalogScreen";

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
  CheckCircle2: () => null,
  Dumbbell: () => null,
  Plus: () => null,
  RefreshCw: () => null,
  Search: () => null,
  X: () => null,
}));

jest.mock("../../services/training", () => ({
  addExerciseToWorkout: jest.fn(),
  createCustomExercise: jest.fn(),
  getAvailableExercises: jest.fn(),
  getWorkout: jest.fn(),
}));

const mockedAdd = addExerciseToWorkout as jest.Mock;
const mockedCreate = createCustomExercise as jest.Mock;
const mockedAvailable = getAvailableExercises as jest.Mock;
const mockedWorkout = getWorkout as jest.Mock;

const TOKEN = "test-access-token";
const WORKOUT_ID = "workout-catalog-test";
const TIMESTAMP = "2026-11-06T12:00:00Z";

const exercises: TrainingExercise[] = [
  {
    id: "bench",
    name: "Supino reto com barra",
    origin: "catalog",
    isArchived: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  {
    id: "pushup",
    name: "Flex\u00e3o de bra\u00e7os",
    origin: "catalog",
    isArchived: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  {
    id: "lat",
    name: "Puxada frontal na polia alta",
    origin: "catalog",
    isArchived: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
];

const workout: Workout = {
  id: WORKOUT_ID,
  name: "Treino de teste",
  isArchived: false,
  archivedAt: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
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
  goBack: jest.fn(),
};

async function renderCatalog(): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <ExerciseCatalogScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof ExerciseCatalogScreen
          >["navigation"]
        }
        route={{
          key: "catalog-test-route",
          name: "CatalogoExercicios",
          params: {
            workoutId: WORKOUT_ID,
          },
        }}
      />
    </AuthContext.Provider>,
  );

  await screen.findByText("Puxada frontal na polia alta");
}

async function openCustomForm(): Promise<void> {
  await fireEvent.press(
    screen.getByLabelText("Criar exerc\u00edcio personalizado"),
  );
}

describe("ExerciseCatalogScreen - intelligent catalog search", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedAvailable.mockResolvedValue(exercises);
    mockedWorkout.mockResolvedValue(workout);
    mockedAdd.mockResolvedValue(workout);
    mockedCreate.mockResolvedValue({
      id: "new-custom",
      name: "Movimento personalizado de teste",
      origin: "custom",
      isArchived: false,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
  });

  it("filters Portuguese exercise names without accents", async () => {
    await renderCatalog();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Buscar exerc\u00edcio"),
      "flexao",
    );

    expect(screen.getByText("Flex\u00e3o de bra\u00e7os")).toBeTruthy();

    expect(screen.queryByText("Supino reto com barra")).toBeNull();
  });

  it("finds catalog exercises using common aliases", async () => {
    await renderCatalog();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Buscar exerc\u00edcio"),
      "pulley",
    );

    expect(
      screen.getByLabelText("Adicionar Puxada frontal na polia alta"),
    ).toBeTruthy();

    expect(
      screen.queryByLabelText("Adicionar Supino reto com barra"),
    ).toBeNull();
  });

  it("limits custom exercise suggestions to five", async () => {
    const manyExercises: TrainingExercise[] = Array.from(
      { length: 8 },
      (_, index) => ({
        id: `supino-${index}`,
        name: `Supino varia\u00e7\u00e3o ${index + 1}`,
        origin: "catalog",
        isArchived: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      }),
    );

    mockedAvailable.mockResolvedValue([...exercises, ...manyExercises]);

    await renderCatalog();
    await openCustomForm();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do exerc\u00edcio personalizado"),
      "sup",
    );

    expect(screen.getAllByLabelText(/^Adicionar sugest\u00e3o /)).toHaveLength(
      5,
    );
  });

  it("adds an existing suggestion without creating a duplicate", async () => {
    await renderCatalog();
    await openCustomForm();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do exerc\u00edcio personalizado"),
      "pulley",
    );

    await fireEvent.press(
      screen.getByLabelText(
        "Adicionar sugest\u00e3o Puxada frontal na polia alta",
      ),
    );

    await waitFor(() => {
      expect(mockedAdd).toHaveBeenCalledWith(TOKEN, WORKOUT_ID, {
        exerciseId: "lat",
      });

      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("reuses an exercise when the custom name matches exactly", async () => {
    await renderCatalog();
    await openCustomForm();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do exerc\u00edcio personalizado"),
      "SUPINO RETO COM BARRA",
    );

    await fireEvent.press(screen.getByText("Adicionar existente"));

    await waitFor(() => {
      expect(mockedAdd).toHaveBeenCalledWith(TOKEN, WORKOUT_ID, {
        exerciseId: "bench",
      });
    });

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("prevents recreating an exercise already in the workout", async () => {
    mockedWorkout.mockResolvedValue({
      ...workout,
      exercises: [
        {
          id: "planned-bench",
          exerciseId: "bench",
          exerciseName: "Supino reto com barra",
          position: 1,
          targetSets: null,
          targetRepetitions: null,
          targetLoad: null,
          targetLoadUnit: null,
          notes: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    } satisfies Workout);

    await renderCatalog();

    expect(
      screen.queryByLabelText("Adicionar Supino reto com barra"),
    ).toBeNull();

    await openCustomForm();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do exerc\u00edcio personalizado"),
      "Supino reto com barra",
    );

    await fireEvent.press(screen.getByText("Criar exerc\u00edcio"));

    expect(
      await screen.findByText(
        "Este exerc\u00edcio j\u00e1 foi adicionado ao treino.",
      ),
    ).toBeTruthy();

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedAdd).not.toHaveBeenCalled();
  });

  it("preserves creation of genuinely new custom exercises", async () => {
    await renderCatalog();
    await openCustomForm();

    await fireEvent.changeText(
      screen.getByLabelText("Nome do exerc\u00edcio personalizado"),
      "Movimento personalizado de teste",
    );

    await fireEvent.press(screen.getByText("Criar exerc\u00edcio"));

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(
        TOKEN,
        "Movimento personalizado de teste",
      );
    });

    expect(
      await screen.findByText(/foi criado como exerc\u00edcio personalizado/),
    ).toBeTruthy();

    expect(mockedAdd).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
