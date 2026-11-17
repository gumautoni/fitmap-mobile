import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import { ApiClientError } from "../../services/apiClient";
import {
  getWorkoutHistory,
  getWorkoutHistoryPage,
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
  getWorkoutHistoryPage: jest.fn(),
}));

const mockedHistory = jest.mocked(getWorkoutHistory);
const mockedHistoryPage = jest.mocked(getWorkoutHistoryPage);

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

const historyFixture = jest.fn<
  ReturnType<typeof getWorkoutHistory>,
  Parameters<typeof getWorkoutHistory>
>();

describe("WorkoutHistoryScreen filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockIsFocused = true;
    mockThemeMode = "light";

    historyFixture.mockReset();
    historyFixture.mockResolvedValue(makeHistory());

    mockedHistory.mockReset();
    mockedHistoryPage.mockReset();
    mockedHistoryPage.mockImplementation(async (accessToken) => ({
      items: await historyFixture(accessToken),
      nextCursor: null,
    }));
  });

  it("shows initial loading before displaying the history", async () => {
    const pending = deferredHistory();

    historyFixture.mockReturnValueOnce(pending.promise);

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

    expect(mockedHistoryPage).toHaveBeenCalledWith("test-access-token");
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
    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
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
    historyFixture.mockResolvedValueOnce([]);

    await render(historyTree());

    await screen.findByText("Nenhum treino conclu\u00eddo");

    expect(screen.queryByLabelText(NAME_INPUT)).toBeNull();

    expect(screen.queryByTestId("workout-history-results-count")).toBeNull();

    expect(screen.queryByText("Nenhum treino encontrado")).toBeNull();
  });

  it("retries an initial request failure successfully", async () => {
    historyFixture.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await render(historyTree());

    await screen.findByText(
      "N\u00e3o foi poss\u00edvel carregar o hist\u00f3rico",
    );

    expect(screen.queryByLabelText(NAME_INPUT)).toBeNull();

    await fireEvent.press(screen.getByLabelText(RETRY_HISTORY));

    await screen.findByText("6 treinos encontrados");

    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });

  it("preserves filters after blur and refocus with fresh history", async () => {
    const view = await mountLoadedHistory();

    await enterName("peito");
    await choosePeriod(SEVEN_DAYS);

    expectCount(1);

    mockIsFocused = false;
    await view.rerender(historyTree());

    historyFixture.mockResolvedValueOnce([
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

    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });

  it("keeps loaded sessions and filters usable during refresh", async () => {
    const view = await mountLoadedHistory();
    const pending = deferredHistory();

    mockIsFocused = false;
    await view.rerender(historyTree());

    historyFixture.mockReturnValueOnce(pending.promise);

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
    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });

  it("retains filtered history after refresh failure and retries", async () => {
    const view = await mountLoadedHistory();

    await enterName("Peito");
    await choosePeriod(SEVEN_DAYS);

    mockIsFocused = false;
    await view.rerender(historyTree());

    historyFixture.mockRejectedValueOnce(
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

    expect(mockedHistoryPage).toHaveBeenCalledTimes(3);
  });

  it("ignores an obsolete request after blur and refocus", async () => {
    const pending = deferredHistory();

    historyFixture.mockReturnValueOnce(pending.promise);

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

    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });

  it.each(["success", "failure"])(
    "keeps the latest request loading when an obsolete request ends with %s",
    async (outcome) => {
      const obsolete = deferredHistory();
      const latest = deferredHistory();

      historyFixture
        .mockReturnValueOnce(obsolete.promise)
        .mockReturnValueOnce(latest.promise);

      const view = await render(historyTree());

      await screen.findByText("Carregando seu hist\u00f3rico");

      mockIsFocused = false;
      await view.rerender(historyTree());

      mockIsFocused = true;
      await view.rerender(historyTree());

      expect(mockedHistoryPage).toHaveBeenCalledTimes(2);

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

      expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
    },
  );

  it("accessibility: shows the selected period without relying on color", async () => {
    await mountLoadedHistory();

    const options = [
      { label: ALL_PERIOD, text: "Todos", count: 6 },
      { label: SEVEN_DAYS, text: "7 dias", count: 3 },
      { label: THIRTY_DAYS, text: "30 dias", count: 4 },
      { label: NINETY_DAYS, text: "90 dias", count: 5 },
    ];

    function expectSelectedPeriod(selectedLabel: string) {
      for (const option of options) {
        const selected = option.label === selectedLabel;

        const button = screen.getByRole("button", {
          name: option.label,
        });

        expect(button).toHaveProp(
          "accessibilityState",
          expect.objectContaining({ selected }),
        );

        const visibleText = selected ? `${option.text} \u2713` : option.text;

        expect(screen.getByText(visibleText)).toBeTruthy();

        const unexpectedText = selected ? option.text : `${option.text} \u2713`;

        expect(screen.queryByText(unexpectedText)).toBeNull();
      }
    }

    expectSelectedPeriod(ALL_PERIOD);

    for (const option of options.slice(1)) {
      await choosePeriod(option.label);

      expectSelectedPeriod(option.label);
      expectCount(option.count);
    }

    await fireEvent.press(
      screen.getByRole("button", {
        name: CLEAR_FILTERS,
      }),
    );

    expectSelectedPeriod(ALL_PERIOD);
    expectCount(6);

    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it("accessibility: preserves the non-color period indicator in dark mode", async () => {
    const view = await mountLoadedHistory();

    await choosePeriod(THIRTY_DAYS);

    expect(screen.getByText("30 dias \u2713")).toBeTruthy();

    mockThemeMode = "dark";

    await view.rerender(historyTree());

    expect(screen.getByText("30 dias \u2713")).toBeTruthy();

    expect(screen.queryByText("Todos \u2713")).toBeNull();

    expect(
      screen.getByRole("button", {
        name: THIRTY_DAYS,
      }),
    ).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ selected: true }),
    );

    expectCount(4);

    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
    expect(mockedHistory).not.toHaveBeenCalled();
  });

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

    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
  });
});

interface HistoryPageFixture {
  items: WorkoutHistoryItem[];
  nextCursor: string | null;
}

function deferredPage() {
  let resolve!: (page: HistoryPageFixture) => void;

  const promise = new Promise<HistoryPageFixture>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

const LOAD_MORE = "Carregar mais treinos";
const RETRY_MORE = "Tentar carregar mais treinos novamente";
const RETRY_FULL = "Tentar buscar histórico completo novamente";
const FULL_LOADING = "Buscando em todo o histórico...";

async function mountPartialHistory() {
  const view = await render(historyTree());

  if (mockedHistoryPage.mock.calls.length === 0) {
    throw new Error("PERF03_HISTORY_PAGINATION_MISSING");
  }

  await screen.findByText("2 treinos carregados");

  return view;
}

describe("PERF-03 WorkoutHistoryScreen pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockIsFocused = true;
    mockThemeMode = "light";

    mockedHistory.mockReset();
    mockedHistory.mockResolvedValue(makeHistory());

    mockedHistoryPage.mockReset();
    mockedHistoryPage.mockResolvedValue({
      items: makeHistory().slice(0, 2),
      nextCursor: "recent",
    });
  });

  it("loads only the first page and labels its partial count", async () => {
    await mountPartialHistory();

    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
    expect(mockedHistoryPage).toHaveBeenCalledWith("test-access-token");
    expect(mockedHistory).not.toHaveBeenCalled();

    expect(historyNames()).toEqual([PEITO, COSTAS]);

    expect(screen.queryByText("2 treinos encontrados")).toBeNull();
    expect(screen.getByLabelText(LOAD_MORE)).toBeTruthy();
  });

  it("appends the next page without duplicated sessions", async () => {
    await mountPartialHistory();

    mockedHistoryPage.mockResolvedValueOnce({
      items: makeHistory().slice(1),
      nextCursor: null,
    });

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    await screen.findByText("6 treinos encontrados");

    expect(mockedHistoryPage).toHaveBeenLastCalledWith("test-access-token", {
      cursor: "recent",
    });

    expect(historyNames()).toEqual([
      PEITO,
      COSTAS,
      PERNAS,
      PEITO,
      PERNAS,
      OMBROS,
    ]);

    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
    expect(mockedHistory).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(LOAD_MORE)).toBeNull();
  });

  it("preserves loaded items and retries the same cursor on page failure", async () => {
    await mountPartialHistory();

    mockedHistoryPage.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    const retry = await screen.findByLabelText(RETRY_MORE);

    expect(historyNames()).toEqual([PEITO, COSTAS]);
    expect(screen.getByText("2 treinos carregados")).toBeTruthy();

    mockedHistoryPage.mockResolvedValueOnce({
      items: makeHistory().slice(2),
      nextCursor: null,
    });

    await fireEvent.press(retry);

    await screen.findByText("6 treinos encontrados");

    expect(mockedHistoryPage).toHaveBeenCalledTimes(3);

    expect(mockedHistoryPage.mock.calls[1]).toEqual([
      "test-access-token",
      { cursor: "recent" },
    ]);

    expect(mockedHistoryPage.mock.calls[2]).toEqual([
      "test-access-token",
      { cursor: "recent" },
    ]);

    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it("does not show false empty results while loading the complete history", async () => {
    await mountPartialHistory();

    const pending = deferredHistory();
    mockedHistory.mockReturnValueOnce(pending.promise);

    await enterName("Ombros");

    await screen.findByText(FULL_LOADING);

    expect(mockedHistory).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId("workout-history-results-count")).toBeNull();

    expect(screen.queryByText("Nenhum treino encontrado")).toBeNull();

    await act(async () => {
      pending.resolve(makeHistory());
    });

    await screen.findByText("1 treino encontrado");

    expect(historyNames()).toEqual([OMBROS]);
  });

  it("reuses a single complete-history request while filters change", async () => {
    await mountPartialHistory();

    const pending = deferredHistory();
    mockedHistory.mockReturnValueOnce(pending.promise);

    await enterName("Ombros");
    await screen.findByText(FULL_LOADING);

    await enterName("Pernas");
    await choosePeriod(THIRTY_DAYS);

    expect(mockedHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(makeHistory());
    });

    await screen.findByText("1 treino encontrado");

    expect(historyNames()).toEqual([PERNAS]);

    await choosePeriod(NINETY_DAYS);

    expectCount(2);
    expect(historyNames()).toEqual([PERNAS, PERNAS]);

    expect(mockedHistory).toHaveBeenCalledTimes(1);
    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
  });

  it("keeps cleared filters after an in-flight complete-history request", async () => {
    await mountPartialHistory();

    const pending = deferredHistory();
    mockedHistory.mockReturnValueOnce(pending.promise);

    await enterName("Ombros");
    await screen.findByText(FULL_LOADING);

    await fireEvent.press(screen.getByLabelText(CLEAR_FILTERS));

    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("");

    await act(async () => {
      pending.resolve(makeHistory());
    });

    await screen.findByText("6 treinos encontrados");

    expect(
      screen.getByLabelText(ALL_PERIOD).props.accessibilityState,
    ).toMatchObject({ selected: true });

    expect(historyNames()).toHaveLength(6);
    expect(mockedHistory).toHaveBeenCalledTimes(1);
  });

  it("filters locally when all pages are already loaded", async () => {
    await mountPartialHistory();

    mockedHistoryPage.mockResolvedValueOnce({
      items: makeHistory().slice(2),
      nextCursor: null,
    });

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));
    await screen.findByText("6 treinos encontrados");

    await enterName("Peito");
    await choosePeriod(SEVEN_DAYS);

    expectCount(1);
    expect(historyNames()).toEqual([PEITO]);

    expect(mockedHistory).not.toHaveBeenCalled();
    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });

  it("ignores an obsolete next-page response after refocus", async () => {
    const view = await mountPartialHistory();

    const pending = deferredPage();
    mockedHistoryPage.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    mockIsFocused = false;
    await view.rerender(historyTree());

    mockedHistoryPage.mockResolvedValueOnce({
      items: [makeSession("new", "Treino atualizado", 0)],
      nextCursor: null,
    });

    mockIsFocused = true;
    await view.rerender(historyTree());

    await screen.findByText("1 treino encontrado");

    await act(async () => {
      pending.resolve({
        items: [makeSession("obsolete", "Treino obsoleto", 3)],
        nextCursor: null,
      });
    });

    expect(historyNames()).toEqual(["Treino atualizado"]);
    expect(screen.queryByText("Treino obsoleto")).toBeNull();

    expect(mockedHistoryPage).toHaveBeenCalledTimes(3);
  });

  it("prevents simultaneous requests for the same next page", async () => {
    await mountPartialHistory();

    const pending = deferredPage();
    mockedHistoryPage.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    const button = screen.getByLabelText(LOAD_MORE);

    expect(button.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(button);

    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending.resolve({
        items: makeHistory().slice(2),
        nextCursor: null,
      });
    });

    await screen.findByText("6 treinos encontrados");
  });

  it("retries a failed complete-history search without false results", async () => {
    await mountPartialHistory();

    mockedHistory.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await enterName("Ombros");

    const retry = await screen.findByLabelText(RETRY_FULL);

    expect(screen.queryByTestId("workout-history-results-count")).toBeNull();

    expect(screen.queryByText("Nenhum treino encontrado")).toBeNull();

    await fireEvent.press(retry);

    await screen.findByText("1 treino encontrado");

    expect(historyNames()).toEqual([OMBROS]);
    expect(mockedHistory).toHaveBeenCalledTimes(2);
    expect(mockedHistoryPage).toHaveBeenCalledTimes(1);
  });

  it("restarts from the first page after an invalid cursor", async () => {
    await mountPartialHistory();

    mockedHistoryPage.mockRejectedValueOnce(
      new ApiClientError(
        "Invalid pagination cursor.",
        422,
        "invalid_pagination_cursor",
      ),
    );

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    const retry = await screen.findByLabelText(RETRY_MORE);

    expect(historyNames()).toEqual([PEITO, COSTAS]);

    mockedHistoryPage.mockResolvedValueOnce({
      items: [makeSession("fresh", "Treino atualizado", 0)],
      nextCursor: null,
    });

    await fireEvent.press(retry);

    expect(mockedHistoryPage).toHaveBeenLastCalledWith("test-access-token");

    await screen.findByText("1 treino encontrado");

    expect(historyNames()).toEqual(["Treino atualizado"]);
  });

  it("restarts rather than repeating a non-advancing cursor", async () => {
    await mountPartialHistory();

    mockedHistoryPage.mockResolvedValueOnce({
      items: makeHistory().slice(1, 3),
      nextCursor: "recent",
    });

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    const retry = await screen.findByLabelText(RETRY_MORE);

    expect(historyNames()).toEqual([PEITO, COSTAS]);

    mockedHistoryPage.mockResolvedValueOnce({
      items: [makeSession("fresh", "Treino atualizado", 0)],
      nextCursor: null,
    });

    await fireEvent.press(retry);

    const lastCall =
      mockedHistoryPage.mock.calls[mockedHistoryPage.mock.calls.length - 1];

    if (lastCall?.length !== 1) {
      throw new Error("PERF03_STALLED_CURSOR_RETRY");
    }

    expect(lastCall).toEqual(["test-access-token"]);

    await screen.findByText("1 treino encontrado");

    expect(historyNames()).toEqual(["Treino atualizado"]);
  });

  it.each(["success", "failure"] as const)(
    "ignores an obsolete complete-history request ending with %s",
    async (outcome) => {
      const view = await mountPartialHistory();
      const pending = deferredHistory();

      mockedHistory.mockReturnValueOnce(pending.promise);

      await enterName("Ombros");
      await screen.findByText(FULL_LOADING);

      mockIsFocused = false;
      await view.rerender(historyTree());

      mockedHistoryPage.mockResolvedValueOnce({
        items: [makeSession("new", "Ombros atualizado", 0)],
        nextCursor: null,
      });

      mockIsFocused = true;
      await view.rerender(historyTree());

      await screen.findByText("1 treino encontrado");

      await act(async () => {
        if (outcome === "success") {
          pending.resolve([makeSession("obsolete", "Ombros obsoleto", 0)]);
        } else {
          pending.reject(new Error("Obsolete full-history error"));
        }
      });

      expect(historyNames()).toEqual(["Ombros atualizado"]);

      expect(screen.queryByText("Ombros obsoleto")).toBeNull();

      expect(screen.queryByText("Obsolete full-history error")).toBeNull();

      expect(screen.queryByLabelText(RETRY_FULL)).toBeNull();
      expect(screen.queryByText(FULL_LOADING)).toBeNull();
    },
  );

  it("supersedes an in-flight next page when complete filtering begins", async () => {
    await mountPartialHistory();

    const pendingPage = deferredPage();
    const pendingFull = deferredHistory();

    mockedHistoryPage.mockReturnValueOnce(pendingPage.promise);

    await fireEvent.press(screen.getByLabelText(LOAD_MORE));

    mockedHistory.mockReturnValueOnce(pendingFull.promise);

    await enterName("Ombros");
    await screen.findByText(FULL_LOADING);

    await act(async () => {
      pendingPage.resolve({
        items: [makeSession("obsolete", "Ombros obsoleto", 1)],
        nextCursor: null,
      });
    });

    expect(screen.getByText(FULL_LOADING)).toBeTruthy();

    expect(screen.queryByTestId("workout-history-results-count")).toBeNull();

    await act(async () => {
      pendingFull.resolve(makeHistory());
    });

    await screen.findByText("1 treino encontrado");

    expect(historyNames()).toEqual([OMBROS]);
    expect(mockedHistory).toHaveBeenCalledTimes(1);
    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });

  it("refreshes complete filtered results after refocus", async () => {
    const view = await mountPartialHistory();

    await enterName("Ombros");
    await screen.findByText("1 treino encontrado");

    mockIsFocused = false;
    await view.rerender(historyTree());

    const freshHistory = [
      makeSession("new", "Ombros atualizado", 0),
      ...makeHistory(),
    ];

    mockedHistoryPage.mockResolvedValueOnce({
      items: freshHistory.slice(0, 2),
      nextCursor: "today",
    });

    mockedHistory.mockResolvedValueOnce(freshHistory);

    mockIsFocused = true;
    await view.rerender(historyTree());

    await screen.findByText("2 treinos encontrados");

    expect(historyNames()).toEqual(["Ombros atualizado", OMBROS]);

    expect(screen.getByLabelText(NAME_INPUT).props.value).toBe("Ombros");

    expect(mockedHistory).toHaveBeenCalledTimes(2);
    expect(mockedHistoryPage).toHaveBeenCalledTimes(2);
  });
});
