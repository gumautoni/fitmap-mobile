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
});
