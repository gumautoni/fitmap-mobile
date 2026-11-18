import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ContextType } from "react";
import { AccessibilityInfo, LayoutAnimation } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  getWorkoutHistory,
  getWorkoutHistoryPage,
  type WorkoutHistoryItem,
} from "../../services/trainingSessions";
import type { Page } from "../../services/pagination";
import WorkoutActivityCalendar from "../WorkoutActivityCalendar";

let mockFocused = true;

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

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect(effect: () => void | (() => void)) {
      const focused = mockFocused;

      React.useEffect(() => {
        if (!focused) {
          return;
        }

        return effect();
      }, [effect, focused]);
    },
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  CalendarDays: () => null,
  BookOpen: () => null,
  Dumbbell: () => null,
  Check: () => null,
  ChevronDown: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  ChevronUp: () => null,
  RefreshCw: () => null,
}));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: () => null,
  Circle: () => null,
}));

jest.mock("../../services/trainingSessions", () => ({
  getWorkoutHistory: jest.fn(),
  getWorkoutHistoryPage: jest.fn(),
}));

const mockedLegacy = jest.mocked(getWorkoutHistory);
const mockedPage = jest.mocked(getWorkoutHistoryPage);
const openWorkout = jest.fn();

const token = "calendar-access-token";

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: token,
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: (request) => request(token),
  updateAuthenticatedUser: jest.fn(),
};

const EXPAND = "Expandir calend\u00e1rio de treinos";
const COLLAPSE = "Recolher calend\u00e1rio de treinos";
const PREVIOUS = "M\u00eas anterior";
const NEXT = "Pr\u00f3ximo m\u00eas";
const RETRY = "Tentar carregar calend\u00e1rio novamente";
const LOADING = "Atualizando seus treinos...";
const ERROR = "N\u00e3o foi poss\u00edvel carregar os dias de treino.";

function weekBounds(date = new Date()) {
  const mondayOffset = (date.getDay() + 6) % 7;

  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - mondayOffset,
  );

  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 7,
  );

  return {
    completedFrom: start.toISOString(),
    completedBefore: end.toISOString(),
  };
}

function monthBounds(offset = 0) {
  const date = new Date();

  return {
    completedFrom: new Date(
      date.getFullYear(),
      date.getMonth() + offset,
      1,
    ).toISOString(),
    completedBefore: new Date(
      date.getFullYear(),
      date.getMonth() + offset + 1,
      1,
    ).toISOString(),
  };
}

function session(
  id: string,
  day: number,
  hour = 12,
  monthOffset = 0,
): WorkoutHistoryItem {
  const date = new Date();

  const completedAt = new Date(
    date.getFullYear(),
    date.getMonth() + monthOffset,
    day,
    hour,
  ).toISOString();

  return {
    id,
    sourceWorkoutId: null,
    workoutName: `Treino ${id}`,
    notes: null,
    startedAt: completedAt,
    completedAt,
    createdAt: completedAt,
    updatedAt: completedAt,
  };
}

function deferredPage() {
  let resolve!: (value: Page<WorkoutHistoryItem>) => void;

  const promise = new Promise<Page<WorkoutHistoryItem>>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function calendarTree() {
  return (
    <AuthContext.Provider value={authValue}>
      <WorkoutActivityCalendar onOpenWorkout={openWorkout} />
    </AuthContext.Provider>
  );
}

async function waitUntilReady() {
  await waitFor(() => {
    expect(screen.queryByText(LOADING)).toBeNull();
  });
}

async function mountCalendar() {
  const view = await render(calendarTree());

  if (mockedPage.mock.calls.length === 0) {
    throw new Error("PERF03_CALENDAR_PAGINATION_MISSING");
  }

  await waitUntilReady();

  return view;
}

async function expandCalendar() {
  await fireEvent.press(screen.getByLabelText(EXPAND));
}

function summary(days: number, workouts: number): RegExp {
  return new RegExp(
    `^Resumo de .+: ${days} dias ativos e ${workouts} treinos conclu`,
  );
}

describe("PERF-03 WorkoutActivityCalendar pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFocused = true;

    mockedLegacy.mockReset();
    mockedLegacy.mockResolvedValue([]);

    mockedPage.mockReset();
    mockedPage.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    jest
      .spyOn(LayoutAnimation, "configureNext")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads only the local Monday-to-Sunday interval", async () => {
    await mountCalendar();

    expect(mockedPage).toHaveBeenCalledTimes(1);

    expect(mockedPage).toHaveBeenCalledWith(token, weekBounds());

    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("loads the visible month and opens its sessions without another request", async () => {
    await mountCalendar();

    mockedPage.mockResolvedValueOnce({
      items: [session("monthly", 1)],
      nextCursor: null,
    });

    await expandCalendar();

    await screen.findByLabelText(summary(1, 1));

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());

    await fireEvent.press(screen.getByLabelText(/^1 de .+\. 1 treino/));

    await fireEvent.press(
      screen.getByLabelText("Ver detalhes do treino Treino monthly"),
    );

    expect(openWorkout).toHaveBeenCalledWith("monthly");
    expect(mockedPage).toHaveBeenCalledTimes(2);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("completes all pages before publishing the monthly summary", async () => {
    await mountCalendar();

    const first = session("one", 1);
    const second = session("two", 1, 9);
    const third = session("three", 2);

    const pending = deferredPage();

    mockedPage
      .mockResolvedValueOnce({
        items: [second, first],
        nextCursor: first.id,
      })
      .mockReturnValueOnce(pending.promise);

    await expandCalendar();

    await waitFor(() => {
      expect(mockedPage).toHaveBeenCalledTimes(3);
    });

    expect(mockedPage).toHaveBeenLastCalledWith(token, {
      ...monthBounds(),
      cursor: first.id,
    });

    expect(screen.queryByLabelText(/^Resumo de /)).toBeNull();
    expect(screen.getByText(LOADING)).toBeTruthy();

    await act(async () => {
      pending.resolve({
        items: [first, third],
        nextCursor: null,
      });
    });

    await screen.findByLabelText(summary(2, 3));

    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("requests the previous month, current month and current week separately", async () => {
    await mountCalendar();

    await expandCalendar();
    await screen.findByLabelText(summary(0, 0));

    await fireEvent.press(screen.getByLabelText(PREVIOUS));
    await waitUntilReady();

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds(-1));

    await fireEvent.press(screen.getByLabelText(NEXT));
    await waitUntilReady();

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());

    await fireEvent.press(screen.getByLabelText(COLLAPSE));
    await waitUntilReady();

    expect(mockedPage).toHaveBeenLastCalledWith(token, weekBounds());

    expect(mockedPage).toHaveBeenCalledTimes(5);
  });

  it("retries an incomplete month from its first page", async () => {
    await mountCalendar();

    mockedPage
      .mockResolvedValueOnce({
        items: [session("first", 1)],
        nextCursor: "first",
      })
      .mockRejectedValueOnce(new Error("Page request failed."));

    await expandCalendar();

    await screen.findByText(ERROR);

    expect(screen.queryByLabelText(/^Resumo de /)).toBeNull();

    mockedPage.mockResolvedValueOnce({
      items: [session("recovered", 1)],
      nextCursor: null,
    });

    await fireEvent.press(screen.getByLabelText(RETRY));

    await screen.findByLabelText(summary(1, 1));

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());

    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("ignores a response from a month that is no longer visible", async () => {
    await mountCalendar();

    const pending = deferredPage();

    mockedPage.mockReturnValueOnce(pending.promise);

    await expandCalendar();

    mockedPage.mockResolvedValueOnce({
      items: [session("previous", 1, 12, -1)],
      nextCursor: null,
    });

    await fireEvent.press(screen.getByLabelText(PREVIOUS));

    await screen.findByLabelText(summary(1, 1));

    await act(async () => {
      pending.resolve({
        items: [session("obsolete", 1)],
        nextCursor: "obsolete",
      });
    });

    expect(screen.getByLabelText(summary(1, 1))).toBeTruthy();
    expect(mockedPage).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it("ignores obsolete pages after blur and refocus", async () => {
    const view = await mountCalendar();

    const pending = deferredPage();

    mockedPage.mockReturnValueOnce(pending.promise);

    await expandCalendar();

    mockFocused = false;
    await view.rerender(calendarTree());

    mockedPage.mockResolvedValueOnce({
      items: [session("fresh", 1)],
      nextCursor: null,
    });

    mockFocused = true;
    await view.rerender(calendarTree());

    await screen.findByLabelText(summary(1, 1));

    await act(async () => {
      pending.resolve({
        items: [session("obsolete-one", 1), session("obsolete-two", 2)],
        nextCursor: "obsolete-two",
      });
    });

    expect(screen.getByLabelText(summary(1, 1))).toBeTruthy();
    expect(mockedPage).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it("stops a repeated cursor and exposes a retry instead of looping", async () => {
    await mountCalendar();

    const first = session("repeat", 1);

    mockedPage
      .mockResolvedValueOnce({
        items: [first],
        nextCursor: first.id,
      })
      .mockResolvedValueOnce({
        items: [first],
        nextCursor: first.id,
      });

    await expandCalendar();

    await screen.findByText(ERROR);

    expect(mockedPage).toHaveBeenCalledTimes(3);

    expect(screen.getByLabelText(RETRY)).toBeTruthy();

    expect(screen.queryByLabelText(/^Resumo de /)).toBeNull();
  });

  it("accessibility: announces loading and errors and provides a practical retry action", async () => {
    let reject!: (reason: Error) => void;

    const pending = new Promise<Page<WorkoutHistoryItem>>((_, fail) => {
      reject = fail;
    });

    mockedPage.mockReturnValueOnce(pending);

    await render(calendarTree());

    try {
      const progress = screen.getByRole("progressbar", {
        name: "Atualizando seus treinos",
      });

      expect(progress).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(progress).toHaveProp("accessibilityLiveRegion", "polite");

      expect(screen.getByText(LOADING)).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByLabelText(RETRY)).toBeNull();
      expect(screen.queryByLabelText(/^Resumo de /)).toBeNull();

      expect(mockedPage).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        reject(new Error("Calendar unavailable."));
      });
    }

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(ERROR);

    expect(alert).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByRole("progressbar")).toBeNull();

    const retry = screen.getByRole("button", {
      name: RETRY,
    });

    expect(retry).not.toBeDisabled();

    expect(retry).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });

    const recovery = deferredPage();

    mockedPage.mockReturnValueOnce(recovery.promise);

    try {
      await fireEvent.press(retry);

      expect(
        screen.getByRole("progressbar", {
          name: "Atualizando seus treinos",
        }),
      ).toBeTruthy();

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByLabelText(RETRY)).toBeNull();
      expect(mockedPage).toHaveBeenCalledTimes(2);
      expect(mockedPage).toHaveBeenLastCalledWith(token, weekBounds());
    } finally {
      await act(async () => {
        recovery.resolve({
          items: [],
          nextCursor: null,
        });
      });
    }

    await waitUntilReady();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByLabelText(RETRY)).toBeNull();
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: provides practical calendar controls and announces the visible month", async () => {
    await mountCalendar();

    const expand = screen.getByRole("button", {
      name: EXPAND,
    });

    expect(expand).toHaveStyle({
      minHeight: 48,
    });

    expect(expand).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ expanded: false }),
    );

    await fireEvent.press(expand);

    await screen.findByLabelText(summary(0, 0));

    const monthText = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(new Date());

    const monthLabel = monthText.charAt(0).toUpperCase() + monthText.slice(1);

    const heading = screen.getByRole("header", {
      name: monthLabel,
    });

    expect(heading).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.getByRole("button", { name: COLLAPSE })).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ expanded: true }),
    );

    const previous = screen.getByRole("button", {
      name: PREVIOUS,
    });

    const next = screen.getByRole("button", {
      name: NEXT,
    });

    for (const control of [previous, next]) {
      expect(control).toHaveStyle({
        width: 48,
        height: 48,
      });
    }

    expect(previous).not.toBeDisabled();
    expect(next).toBeDisabled();

    await fireEvent.press(next);

    expect(mockedPage).toHaveBeenCalledTimes(2);

    await fireEvent.press(previous);

    await waitUntilReady();

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds(-1));

    const returnToCurrent = screen.getByRole("button", {
      name: NEXT,
    });

    expect(returnToCurrent).not.toBeDisabled();

    await fireEvent.press(returnToCurrent);

    await waitUntilReady();

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());

    expect(
      screen.getByRole("header", {
        name: monthLabel,
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: NEXT,
      }),
    ).toBeDisabled();

    await fireEvent.press(screen.getByRole("button", { name: COLLAPSE }));

    await waitUntilReady();

    expect(mockedPage).toHaveBeenLastCalledWith(token, weekBounds());

    expect(mockedPage).toHaveBeenCalledTimes(5);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: identifies today and exposes the selected empty training diary", async () => {
    await mountCalendar();

    const todayLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    const dayLabel = `${todayLabel}. Sem treino conclu\u00eddo registrado. Hoje`;

    const today = screen.getByRole("button", {
      name: dayLabel,
    });

    expect(today).not.toBeDisabled();

    expect(today).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ selected: false }),
    );

    await fireEvent.press(today);

    await screen.findByLabelText(summary(0, 0));

    const selected = screen.getByRole("button", {
      name: dayLabel,
    });

    expect(selected).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ selected: true }),
    );

    expect(selected).toHaveStyle({
      minHeight: 48,
    });

    expect(
      screen.getByRole("header", {
        name: todayLabel,
      }),
    ).toBeTruthy();

    expect(screen.getByText("Dia sem registros")).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    );

    expect(
      screen.getByText(
        "Nenhum treino conclu\u00eddo foi registrado nesta data.",
      ),
    ).toBeTruthy();

    expect(openWorkout).not.toHaveBeenCalled();
    expect(mockedPage).toHaveBeenCalledTimes(2);
    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());
  });

  it("accessibility: distinguishes same-name sessions without exposing identifiers", async () => {
    await mountCalendar();

    const first = {
      ...session("private-first-id", 1, 10),
      workoutName: "Treino A",
    };

    const second = {
      ...session("private-second-id", 1, 10),
      workoutName: "Treino A",
    };

    const unique = {
      ...session("private-unique-id", 1, 12),
      workoutName: "Treino B",
    };

    mockedPage.mockResolvedValueOnce({
      items: [first, second, unique],
      nextCursor: null,
    });

    await expandCalendar();

    await screen.findByLabelText(summary(1, 3));

    await fireEvent.press(screen.getByLabelText(/^1 de .+\. 3 treino/));

    const firstButton = screen.getByRole("button", {
      name: "Ver detalhes do treino Treino A, registro 1 de 2 neste dia",
    });

    const secondButton = screen.getByRole("button", {
      name: "Ver detalhes do treino Treino A, registro 2 de 2 neste dia",
    });

    const uniqueButton = screen.getByRole("button", {
      name: "Ver detalhes do treino Treino B",
    });

    expect(firstButton).not.toBe(secondButton);

    for (const [button, item] of [
      [firstButton, first],
      [secondButton, second],
      [uniqueButton, unique],
    ] as const) {
      const time = new Date(item.completedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      expect(button).toHaveProp(
        "accessibilityHint",
        `Conclu\u00eddo \u00e0s ${time}. Ver exerc\u00edcios, s\u00e9ries e cargas.`,
      );

      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      expect(button.props.accessibilityLabel).not.toContain(item.id);
    }

    await fireEvent.press(secondButton);
    await fireEvent.press(uniqueButton);

    expect(openWorkout.mock.calls).toEqual([[second.id], [unique.id]]);

    expect(mockedPage).toHaveBeenCalledTimes(2);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: keeps calendar motion reduced while the preference is pending and when detection fails", async () => {
    let reject!: (reason: Error) => void;

    const preference = new Promise<boolean>((_, fail) => {
      reject = fail;
    });

    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockReturnValueOnce(preference);

    await mountCalendar();

    try {
      await expandCalendar();

      await screen.findByLabelText(summary(0, 0));

      expect(LayoutAnimation.configureNext).not.toHaveBeenCalled();

      expect(mockedPage).toHaveBeenCalledTimes(2);

      expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());
    } finally {
      await act(async () => {
        reject(new Error("Motion preference unavailable."));
      });
    }

    await fireEvent.press(screen.getByLabelText(COLLAPSE));

    await waitUntilReady();

    expect(LayoutAnimation.configureNext).not.toHaveBeenCalled();

    expect(mockedPage).toHaveBeenCalledTimes(3);

    expect(mockedPage).toHaveBeenLastCalledWith(token, weekBounds());

    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: does not overwrite a newer reduced-motion preference with a stale response", async () => {
    let resolve!: (enabled: boolean) => void;

    const preference = new Promise<boolean>((done) => {
      resolve = done;
    });

    const remove = jest.fn();

    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove });

    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockReturnValueOnce(preference);

    const view = await mountCalendar();

    const subscription = jest
      .mocked(AccessibilityInfo.addEventListener)
      .mock.calls.find(([event]) => event === "reduceMotionChanged");

    expect(subscription).toBeDefined();

    const listener = subscription?.[1] as (enabled: boolean) => void;

    await act(async () => {
      listener(true);
    });

    await act(async () => {
      resolve(false);
    });

    expect(mockedPage).toHaveBeenCalledTimes(1);

    await expandCalendar();

    await screen.findByLabelText(summary(0, 0));

    expect(LayoutAnimation.configureNext).not.toHaveBeenCalled();

    expect(mockedPage).toHaveBeenCalledTimes(2);

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());

    await view.unmount();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("preserves calendar layout animation when motion is enabled", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false);

    await mountCalendar();

    await expandCalendar();

    await screen.findByLabelText(summary(0, 0));

    expect(LayoutAnimation.configureNext).toHaveBeenCalledTimes(1);

    expect(LayoutAnimation.configureNext).toHaveBeenCalledWith(
      LayoutAnimation.Presets.easeInEaseOut,
    );

    expect(mockedPage).toHaveBeenCalledTimes(2);

    expect(mockedPage).toHaveBeenLastCalledWith(token, monthBounds());

    expect(mockedLegacy).not.toHaveBeenCalled();
  });
});
