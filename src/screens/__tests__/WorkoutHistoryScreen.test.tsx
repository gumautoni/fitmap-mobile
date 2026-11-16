import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import {
  getWorkoutHistory,
  type WorkoutHistoryItem,
} from "../../services/trainingSessions";
import WorkoutHistoryScreen from "../WorkoutHistoryScreen";

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

let mockIsFocused = true;
let mockThemeMode: "light" | "dark" = "light";

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  function useFocusEffect(effect: () => void | (() => void)): void {
    const isFocused = mockIsFocused;

    React.useEffect(() => {
      if (!isFocused) {
        return;
      }

      return effect();
    }, [effect, isFocused]);
  }

  return { useFocusEffect };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => {
    const themes = jest.requireActual("../../theme/themes");

    return {
      theme: mockThemeMode === "light" ? themes.lightTheme : themes.darkTheme,
    };
  },
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  CalendarDays: () => null,
  ChevronRight: () => null,
  Dumbbell: () => null,
  RefreshCw: () => null,
  Search: () => null,
}));

jest.mock("../../services/trainingSessions", () => ({
  getWorkoutHistory: jest.fn(),
}));

const mockedHistory = jest.mocked(getWorkoutHistory);

const navigation = {
  navigate: jest.fn(),
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

const NAME_INPUT = "Buscar hist\u00f3rico pelo nome do treino";
const ALL_PERIOD = "Todos os per\u00edodos";
const SEVEN_DAYS = "\u00daltimos 7 dias";
const THIRTY_DAYS = "\u00daltimos 30 dias";
const NINETY_DAYS = "\u00daltimos 90 dias";
const CLEAR_FILTERS = "Limpar filtros do hist\u00f3rico";
const RETRY_HISTORY = "Tentar carregar hist\u00f3rico novamente";

const PEITO = "Treino A - Peito e tr\u00edceps";
const COSTAS = "Treino B - Costas e b\u00edceps";
const PERNAS = "Treino C - Pernas";
const OMBROS = "Treino D - Ombros";

function makeSession(
  id: string,
  workoutName: string,
  daysAgo: number,
): WorkoutHistoryItem {
  const today = new Date();

  const completedAt = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysAgo,
    12,
  );

  const startedAt = new Date(completedAt.getTime() - 45 * 60_000).toISOString();

  return {
    id,
    sourceWorkoutId: "source-" + id,
    workoutName,
    notes: null,
    startedAt,
    completedAt: completedAt.toISOString(),
    createdAt: startedAt,
    updatedAt: completedAt.toISOString(),
  };
}

function makeHistory(): WorkoutHistoryItem[] {
  return [
    makeSession("today", PEITO, 0),
    makeSession("recent", COSTAS, 3),
    makeSession("seven", PERNAS, 5),
    makeSession("older", PEITO, 15),
    makeSession("ninety", PERNAS, 38),
    makeSession("oldest", OMBROS, 100),
  ];
}

function deferredHistory() {
  let resolve!: (items: WorkoutHistoryItem[]) => void;
  let reject!: (reason: Error) => void;

  const promise = new Promise<WorkoutHistoryItem[]>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function historyTree() {
  return (
    <AuthContext.Provider value={authValue}>
      <WorkoutHistoryScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof WorkoutHistoryScreen
          >["navigation"]
        }
        route={{
          key: "history-test-route",
          name: "HistoricoTreinos",
        }}
      />
    </AuthContext.Provider>
  );
}

function expectCount(count: number): void {
  const label =
    count === 1 ? "1 treino encontrado" : `${count} treinos encontrados`;

  expect(screen.getByText(label)).toBeTruthy();
}

function historyNames(): string[] {
  const prefix = "Abrir hist\u00f3rico do treino ";

  return screen
    .queryAllByLabelText(/^Abrir hist\u00f3rico do treino /)
    .map((card) => String(card.props.accessibilityLabel).slice(prefix.length));
}

async function enterName(value: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText(NAME_INPUT), value);
}

async function choosePeriod(label: string): Promise<void> {
  await fireEvent.press(screen.getByLabelText(label));
}

async function mountLoadedHistory() {
  const view = await render(historyTree());

  await screen.findByText("6 treinos encontrados");

  return view;
}

describe("WorkoutHistoryScreen filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockIsFocused = true;
    mockThemeMode = "light";

    mockedHistory.mockReset();
    mockedHistory.mockResolvedValue(makeHistory());
  });

  it("shows initial loading before displaying the history", async () => {
    const pending = deferredHistory();

    mockedHistory.mockReturnValueOnce(pending.promise);

    await render(historyTree());

    expect(screen.getByText("Carregando seu hist\u00f3rico")).toBeTruthy();

    expect(screen.queryByLabelText(NAME_INPUT)).toBeNull();

    await act(async () => {
      pending.resolve(makeHistory());
    });

    await screen.findByText("6 treinos encontrados");
    expect(screen.getByLabelText(NAME_INPUT)).toBeTruthy();
  });

  it("shows all sessions in the original order by default", async () => {
    await mountLoadedHistory();

    expectCount(6);

    expect(historyNames()).toEqual([
      PEITO,
      COSTAS,
      PERNAS,
      PEITO,
      PERNAS,
      OMBROS,
    ]);

    expect(
      screen.getByLabelText(ALL_PERIOD).props.accessibilityState,
    ).toMatchObject({ selected: true });

    expect(
      screen.getByLabelText(CLEAR_FILTERS).props.accessibilityState,
    ).toMatchObject({ disabled: true });

    expect(mockedHistory).toHaveBeenCalledWith("test-access-token");
  });

  it("filters partial names ignoring accents and case", async () => {
    await mountLoadedHistory();

    await enterName("  TRICEPS  ");

    expectCount(2);
    expect(historyNames()).toEqual([PEITO, PEITO]);
  });

  it.each([
    [SEVEN_DAYS, 3, [PEITO, COSTAS, PERNAS]],
    [THIRTY_DAYS, 4, [PEITO, COSTAS, PERNAS, PEITO]],
    [NINETY_DAYS, 5, [PEITO, COSTAS, PERNAS, PEITO, PERNAS]],
  ] as const)(
    "filters by %s and marks the selected option",
    async (label, expectedCount, names) => {
      await mountLoadedHistory();

      await choosePeriod(label);

      expectCount(expectedCount);
      expect(historyNames()).toEqual(names);

      for (const option of [ALL_PERIOD, SEVEN_DAYS, THIRTY_DAYS, NINETY_DAYS]) {
        expect(
          screen.getByLabelText(option).props.accessibilityState,
        ).toMatchObject({ selected: option === label });
      }
    },
  );

  it("combines period and name criteria", async () => {
    await mountLoadedHistory();

    await enterName("peito");
    await choosePeriod(SEVEN_DAYS);

    expectCount(1);
    expect(historyNames()).toEqual([PEITO]);
    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("peito");
  });

  it("shows a distinct empty state when filters have no matches", async () => {
    await mountLoadedHistory();

    await enterName("Ombros");
    await choosePeriod(SEVEN_DAYS);

    expectCount(0);

    expect(screen.getByText("Nenhum treino encontrado")).toBeTruthy();

    expect(screen.queryByText("Nenhum treino conclu\u00eddo")).toBeNull();

    expect(screen.getByLabelText(NAME_INPUT)).toBeTruthy();
    expect(screen.getByLabelText(CLEAR_FILTERS)).toBeTruthy();
    expect(historyNames()).toEqual([]);
  });

  it("clears both filters and restores the complete history", async () => {
    await mountLoadedHistory();

    await enterName("Ombros");
    await choosePeriod(SEVEN_DAYS);

    expectCount(0);

    await fireEvent.press(screen.getByLabelText(CLEAR_FILTERS));

    expectCount(6);

    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("");

    expect(
      screen.getByLabelText(ALL_PERIOD).props.accessibilityState,
    ).toMatchObject({ selected: true });

    expect(
      screen.getByLabelText(CLEAR_FILTERS).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it("keeps whitespace queries clearable without filtering sessions", async () => {
    await mountLoadedHistory();

    await enterName("   ");

    expectCount(6);

    expect(
      screen.getByLabelText(CLEAR_FILTERS).props.accessibilityState,
    ).toMatchObject({ disabled: false });

    await fireEvent.press(screen.getByLabelText(CLEAR_FILTERS));

    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("");
  });

  it("does not issue new API requests when local filters change", async () => {
    await mountLoadedHistory();

    await enterName("Peito");
    await choosePeriod(SEVEN_DAYS);
    await choosePeriod(THIRTY_DAYS);
    await enterName("Pernas");
    await fireEvent.press(screen.getByLabelText(CLEAR_FILTERS));

    expectCount(6);
    expect(mockedHistory).toHaveBeenCalledTimes(1);
  });

  it("opens the exact historical session even for repeated workout names", async () => {
    await mountLoadedHistory();

    await enterName("Peito");

    const cards = screen.getAllByLabelText(
      `Abrir hist\u00f3rico do treino ${PEITO}`,
    );

    expect(cards).toHaveLength(2);

    await fireEvent.press(cards[1]);

    expect(navigation.navigate).toHaveBeenCalledWith(
      "DetalhesHistoricoTreino",
      { workoutSessionId: "older" },
    );
  });

  it("shows the original empty-history state for accounts without sessions", async () => {
    mockedHistory.mockResolvedValueOnce([]);

    await render(historyTree());

    await screen.findByText("Nenhum treino conclu\u00eddo");

    expect(screen.queryByLabelText(NAME_INPUT)).toBeNull();

    expect(screen.queryByTestId("workout-history-results-count")).toBeNull();

    expect(screen.queryByText("Nenhum treino encontrado")).toBeNull();
  });

  it("retries an initial request failure successfully", async () => {
    mockedHistory.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await render(historyTree());

    await screen.findByText(
      "N\u00e3o foi poss\u00edvel carregar o hist\u00f3rico",
    );

    expect(screen.queryByLabelText(NAME_INPUT)).toBeNull();

    await fireEvent.press(screen.getByLabelText(RETRY_HISTORY));

    await screen.findByText("6 treinos encontrados");

    expect(mockedHistory).toHaveBeenCalledTimes(2);
  });

  it("preserves filters after blur and refocus with fresh history", async () => {
    const view = await mountLoadedHistory();

    await enterName("peito");
    await choosePeriod(SEVEN_DAYS);

    expectCount(1);

    mockIsFocused = false;
    await view.rerender(historyTree());

    mockedHistory.mockResolvedValueOnce([
      makeSession("new-session", PEITO, 0),
      ...makeHistory(),
    ]);

    mockIsFocused = true;
    await view.rerender(historyTree());

    await screen.findByText("2 treinos encontrados");

    expect(historyNames()).toEqual([PEITO, PEITO]);

    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("peito");

    expect(
      screen.getByLabelText(SEVEN_DAYS).props.accessibilityState,
    ).toMatchObject({ selected: true });

    expect(mockedHistory).toHaveBeenCalledTimes(2);
  });

  it("keeps loaded sessions and filters usable during refresh", async () => {
    const view = await mountLoadedHistory();
    const pending = deferredHistory();

    mockIsFocused = false;
    await view.rerender(historyTree());

    mockedHistory.mockReturnValueOnce(pending.promise);

    mockIsFocused = true;
    await view.rerender(historyTree());

    await screen.findByText("Atualizando hist\u00f3rico...");

    await enterName("Pernas");

    expectCount(2);
    expect(historyNames()).toEqual([PERNAS, PERNAS]);

    await act(async () => {
      pending.resolve(makeHistory());
    });

    await waitFor(() => {
      expect(screen.queryByText("Atualizando hist\u00f3rico...")).toBeNull();
    });

    expectCount(2);
    expect(mockedHistory).toHaveBeenCalledTimes(2);
  });

  it("retains filtered history after refresh failure and retries", async () => {
    const view = await mountLoadedHistory();

    await enterName("Peito");
    await choosePeriod(SEVEN_DAYS);

    mockIsFocused = false;
    await view.rerender(historyTree());

    mockedHistory.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    mockIsFocused = true;
    await view.rerender(historyTree());

    await screen.findByText("Exibindo os dados carregados anteriormente.");

    expectCount(1);
    expect(historyNames()).toEqual([PEITO]);

    await fireEvent.press(screen.getByLabelText(RETRY_HISTORY));

    await waitFor(() => {
      expect(
        screen.queryByText("Exibindo os dados carregados anteriormente."),
      ).toBeNull();

      expectCount(1);
    });

    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("Peito");

    expect(mockedHistory).toHaveBeenCalledTimes(3);
  });

  it("ignores an obsolete request after blur and refocus", async () => {
    const pending = deferredHistory();

    mockedHistory.mockReturnValueOnce(pending.promise);

    const view = await render(historyTree());

    await screen.findByText("Carregando seu hist\u00f3rico");

    mockIsFocused = false;
    await view.rerender(historyTree());

    mockIsFocused = true;
    await view.rerender(historyTree());

    await screen.findByText("6 treinos encontrados");

    await act(async () => {
      pending.resolve([makeSession("obsolete", "Treino obsoleto", 0)]);
    });

    expectCount(6);

    expect(screen.queryByText("Treino obsoleto")).toBeNull();

    expect(mockedHistory).toHaveBeenCalledTimes(2);
  });

  it.each(["success", "failure"])(
    "keeps the latest request loading when an obsolete request ends with %s",
    async (outcome) => {
      const obsolete = deferredHistory();
      const latest = deferredHistory();

      mockedHistory
        .mockReturnValueOnce(obsolete.promise)
        .mockReturnValueOnce(latest.promise);

      const view = await render(historyTree());

      await screen.findByText("Carregando seu hist\u00f3rico");

      mockIsFocused = false;
      await view.rerender(historyTree());

      mockIsFocused = true;
      await view.rerender(historyTree());

      expect(mockedHistory).toHaveBeenCalledTimes(2);

      await act(async () => {
        if (outcome === "success") {
          obsolete.resolve([makeSession("obsolete", "Treino obsoleto", 0)]);
        } else {
          obsolete.reject(new Error("Obsolete request failure"));
        }
      });

      expect(screen.getByText("Carregando seu hist\u00f3rico")).toBeTruthy();

      expect(screen.queryByLabelText(NAME_INPUT)).toBeNull();
      expect(screen.queryByText("Treino obsoleto")).toBeNull();
      expect(screen.queryByText("Obsolete request failure")).toBeNull();

      await act(async () => {
        latest.resolve(makeHistory());
      });

      await screen.findByText("6 treinos encontrados");

      expectCount(6);
      expect(screen.queryByText("Treino obsoleto")).toBeNull();
      expect(screen.queryByText("Obsolete request failure")).toBeNull();

      expect(screen.queryByText("Carregando seu hist\u00f3rico")).toBeNull();

      expect(mockedHistory).toHaveBeenCalledTimes(2);
    },
  );

  it("preserves filter state when changing to the dark theme", async () => {
    const view = await mountLoadedHistory();

    await enterName("Peito");
    await choosePeriod(SEVEN_DAYS);

    mockThemeMode = "dark";
    await view.rerender(historyTree());

    expectCount(1);
    expect(historyNames()).toEqual([PEITO]);

    expect(
      screen.getByLabelText(SEVEN_DAYS).props.accessibilityState,
    ).toMatchObject({ selected: true });

    expect(mockedHistory).toHaveBeenCalledTimes(1);
  });
});
