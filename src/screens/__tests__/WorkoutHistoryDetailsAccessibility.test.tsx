import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import {
  getWorkoutSession,
  type WorkoutSession,
} from "../../services/trainingSessions";
import WorkoutHistoryDetailsScreen from "../WorkoutHistoryDetailsScreen";

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

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  CalendarDays: () => null,
  CheckCircle2: () => null,
  Dumbbell: () => null,
  RefreshCw: () => null,
}));

jest.mock("../../services/trainingSessions", () => ({
  getWorkoutSession: jest.fn(),
}));

const mockedSession = jest.mocked(getWorkoutSession);

const navigation = {
  setOptions: jest.fn(),
};

const startedAt = "2026-11-04T10:00:00Z";
const completedAt = "2026-11-04T10:45:00Z";

const session: WorkoutSession = {
  id: "history-accessibility-session",
  sourceWorkoutId: "history-accessibility-workout",
  workoutName: "Treino de peito",
  status: "completed",
  notes: "Nota geral da sessao",
  startedAt,
  completedAt,
  cancelledAt: null,
  createdAt: startedAt,
  updatedAt: completedAt,
  exercises: [
    {
      id: "history-exercise-1",
      exerciseId: "catalog-exercise-1",
      exerciseName: "Supino reto",
      position: 1,
      plannedSets: 3,
      plannedRepetitions: 10,
      plannedLoad: "40",
      plannedLoadUnit: "kg",
      plannedNotes: "Manter a tecnica",
      notes: "Execucao controlada",
      isCompleted: true,
      completedAt,
      createdAt: startedAt,
      updatedAt: completedAt,
      sets: [
        {
          id: "history-set-1",
          position: 1,
          repetitions: 10,
          load: "40",
          loadUnit: "kg",
          createdAt: startedAt,
          updatedAt: completedAt,
        },
      ],
    },
    {
      id: "history-exercise-2",
      exerciseId: "catalog-exercise-2",
      exerciseName: "Supino inclinado",
      position: 2,
      plannedSets: 3,
      plannedRepetitions: 12,
      plannedLoad: null,
      plannedLoadUnit: null,
      plannedNotes: null,
      notes: null,
      isCompleted: false,
      completedAt: null,
      createdAt: startedAt,
      updatedAt: completedAt,
      sets: [
        {
          id: "history-set-2",
          position: 1,
          repetitions: 12,
          load: null,
          loadUnit: null,
          createdAt: startedAt,
          updatedAt: completedAt,
        },
      ],
    },
  ],
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

async function mountHistoryDetails() {
  return render(
    <AuthContext.Provider value={authValue}>
      <WorkoutHistoryDetailsScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof WorkoutHistoryDetailsScreen
          >["navigation"]
        }
        route={{
          key: "history-accessibility-route",
          name: "DetalhesHistoricoTreino",
          params: {
            workoutSessionId: session.id,
          },
        }}
      />
    </AuthContext.Provider>,
  );
}

async function mountLoadedDetails() {
  await mountHistoryDetails();
  await screen.findByText("Supino reto");
}

describe("WorkoutHistoryDetails accessibility - ACC-02.2", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSession.mockReset();
    mockedSession.mockResolvedValue(session);
  });

  it("preserves recorded exercises, notes and session identity", async () => {
    await mountLoadedDetails();

    expect(mockedSession).toHaveBeenCalledTimes(1);

    expect(mockedSession).toHaveBeenCalledWith("test-access-token", session.id);

    expect(screen.getByText("Supino inclinado")).toBeTruthy();

    expect(screen.getByText("Nota geral da sessao")).toBeTruthy();

    expect(screen.getByText("Manter a tecnica")).toBeTruthy();

    expect(screen.getByText("Execucao controlada")).toBeTruthy();

    expect(screen.getByText("10 rep. \u2022 40 kg")).toBeTruthy();

    expect(screen.getByText("12 rep. \u2022 Sem carga")).toBeTruthy();

    expect(navigation.setOptions).toHaveBeenCalledWith({
      title: session.workoutName,
    });
  });

  it("preserves accessible retry after a loading failure", async () => {
    mockedSession.mockRejectedValueOnce(
      new Error("Falha de teste no historico"),
    );

    await mountHistoryDetails();

    expect(await screen.findByText("Falha de teste no historico")).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Tentar carregar treino novamente",
      }),
    );

    await screen.findByText("Supino reto");

    await waitFor(() => {
      expect(mockedSession).toHaveBeenCalledTimes(2);
    });

    expect(mockedSession).toHaveBeenLastCalledWith(
      "test-access-token",
      session.id,
    );
  });

  it("accessibility: exposes completed exercise status as text", async () => {
    await mountLoadedDetails();

    expect(screen.getByText("Conclu\u00eddo")).toBeTruthy();

    expect(
      screen.getByLabelText("Status de Supino reto: conclu\u00eddo"),
    ).toBeTruthy();
  });

  it("accessibility: exposes incomplete status even with recorded sets", async () => {
    await mountLoadedDetails();

    expect(screen.getByText("N\u00e3o conclu\u00eddo")).toBeTruthy();

    expect(
      screen.getByLabelText(
        "Status de Supino inclinado: n\u00e3o conclu\u00eddo",
      ),
    ).toBeTruthy();

    expect(screen.getByText("12 rep. \u2022 Sem carga")).toBeTruthy();
  });
});
