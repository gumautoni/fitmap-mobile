import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ContextType } from "react";
import { Alert } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import { ApiClientError } from "../../services/apiClient";
import type { Page } from "../../services/pagination";
import {
  getExercisePerformance,
  getProgressPhotos,
  getProgressPhotosPage,
  getProgressPhotoSource,
  getProgressStatistics,
  uploadProgressPhoto,
  type ProgressPhoto,
} from "../../services/progress";
import ProgressScreen from "../ProgressScreen";

let mockFocused = true;

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { AuthContext: React.createContext(null) };
});

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect(effect: () => void | (() => void)) {
      const focused = mockFocused;

      React.useEffect(() => {
        if (!focused) return;
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

jest.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

jest.mock(
  "../../components/MotionScrollView",
  () => jest.requireActual("react-native").ScrollView,
);

jest.mock("../../components/ScreenGradient", () => () => null);
jest.mock("../../components/BmiCard", () => () => null);
jest.mock("../../components/BodyMetricsSection", () => () => null);
jest.mock("../../components/FitnessGoalsSection", () => () => null);

jest.mock("../../components/ProgressPhotoCapture", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } = jest.requireActual("react-native");

  return function Capture({
    uploading,
    onSave,
  }: {
    uploading: boolean;
    onSave: (asset: {
      uri: string;
      width: number;
      height: number;
    }) => Promise<boolean>;
  }) {
    return React.createElement(
      Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel: "Salvar foto de teste",
        disabled: uploading,
        onPress: () =>
          void onSave({
            uri: "file:///test.jpg",
            width: 800,
            height: 600,
          }),
      },
      React.createElement(Text, null, "Salvar foto de teste"),
    );
  };
});

jest.mock("../../components/ProgressPhotoViewer", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Image } = jest.requireActual("react-native");

  return function Viewer({
    source,
  }: {
    source: import("react-native").ImageSourcePropType;
  }) {
    return React.createElement(Image, {
      source,
      accessibilityLabel: "Foto de progresso ampliada",
    });
  };
});

jest.mock("expo-image-picker", () => ({}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn(),
      renderAsync: jest.fn(async () => ({
        saveAsync: jest.fn(async () => ({
          uri: "file:///normalized.jpg",
        })),
      })),
    })),
  },
}));

jest.mock("lucide-react-native", () => ({
  Activity: () => null,
  AlertCircle: () => null,
  CalendarDays: () => null,
  Dumbbell: () => null,
  Images: () => null,
  Maximize2: () => null,
  RefreshCw: () => null,
  ShieldCheck: () => null,
  TrendingUp: () => null,
}));

jest.mock("../../services/progress", () => ({
  getProgressStatistics: jest.fn(),
  getExercisePerformance: jest.fn(),
  getProgressPhotos: jest.fn(),
  getProgressPhotosPage: jest.fn(),
  getProgressPhotoSource: jest.fn(),
  uploadProgressPhoto: jest.fn(),
}));

const mockedLegacy = jest.mocked(getProgressPhotos);
const mockedPage = jest.mocked(getProgressPhotosPage);
const mockedStatistics = jest.mocked(getProgressStatistics);
const mockedPerformance = jest.mocked(getExercisePerformance);
const mockedSource = jest.mocked(getProgressPhotoSource);
const mockedUpload = jest.mocked(uploadProgressPhoto);

const token = "progress-access-token";

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

const MORE = "Carregar mais fotos";
const RETRY = "Tentar carregar mais fotos novamente";
const EMPTY = "Nenhuma foto registrada";
const SAVE = "Salvar foto de teste";
const INITIAL_RETRY = "Tentar carregar progresso novamente";

function makePhoto(id: string, day: number): ProgressPhoto {
  const recordedAt = new Date(2026, 10, day, 12).toISOString();

  return {
    id,
    workoutSessionId: null,
    mediaType: "image/jpeg",
    recordedAt,
    createdAt: recordedAt,
  };
}

const first = makePhoto("photo-1", 15);
const second = makePhoto("photo-2", 14);
const third = makePhoto("photo-3", 13);
const uploaded = makePhoto("photo-new", 16);
const fresh = makePhoto("photo-fresh", 17);

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function photoLabel(photo: ProgressPhoto): string {
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(photo.recordedAt));

  return `Ampliar foto de progresso registrada em ${date}`;
}

function expectPhotos(photos: ProgressPhoto[]): void {
  const labels = screen
    .queryAllByLabelText(/^Ampliar foto de progresso registrada em /)
    .map((item) => item.props.accessibilityLabel);

  expect(labels).toEqual(photos.map(photoLabel));
}

function progressTree() {
  return (
    <AuthContext.Provider value={authValue}>
      <ProgressScreen />
    </AuthContext.Provider>
  );
}

async function mountProgress() {
  const view = await render(progressTree());

  if (mockedPage.mock.calls.length === 0) {
    throw new Error("PERF03_PHOTO_PAGINATION_MISSING");
  }

  return view;
}

async function mountPhotos() {
  const view = await mountProgress();
  await screen.findByLabelText(photoLabel(first));
  return view;
}

describe("PERF-03 ProgressScreen photo pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;

    mockedLegacy.mockReset();
    mockedLegacy.mockResolvedValue([first, second, third]);

    mockedPage.mockReset();
    mockedPage.mockResolvedValue({
      items: [first, second],
      nextCursor: second.id,
    });

    mockedStatistics.mockReset();
    mockedStatistics.mockResolvedValue({
      completedWorkouts: 12,
      completedWorkoutsLast7Days: 3,
      completedWorkoutsLast30Days: 9,
      trainingDaysLast30Days: 8,
      totalPerformedSets: 84,
    });

    mockedPerformance.mockReset();
    mockedPerformance.mockResolvedValue([]);

    mockedSource.mockReset();
    mockedSource.mockImplementation((accessToken, id) => ({
      uri: `http://test-api/api/v1/progress/photos/${id}/content`,
      headers: { Authorization: `Bearer ${accessToken}` },
    }));

    mockedUpload.mockReset();
    mockedUpload.mockResolvedValue(uploaded);

    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads only the first photo page and preserves private viewing", async () => {
    await mountPhotos();

    expectPhotos([first, second]);

    expect(mockedPage).toHaveBeenCalledTimes(1);
    expect(mockedPage).toHaveBeenCalledWith(token);
    expect(mockedLegacy).not.toHaveBeenCalled();

    expect(mockedStatistics).toHaveBeenCalledTimes(1);
    expect(mockedPerformance).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Meu progresso")).toBeTruthy();
    expect(screen.getByLabelText(MORE)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(photoLabel(second)));

    expect(
      screen.getByLabelText("Foto de progresso ampliada").props.source,
    ).toEqual({
      uri: `http://test-api/api/v1/progress/photos/${second.id}/content`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(mockedPage).toHaveBeenCalledTimes(1);
  });

  it("shows a genuine empty gallery without a load-more button", async () => {
    mockedPage.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    await mountProgress();

    await screen.findByText(EMPTY);

    expectPhotos([]);
    expect(screen.queryByLabelText(MORE)).toBeNull();
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("does not publish an empty gallery before the initial page arrives", async () => {
    const pending = deferred<Page<ProgressPhoto>>();
    mockedPage.mockReturnValueOnce(pending.promise);

    await mountProgress();

    expect(screen.queryByText(EMPTY)).toBeNull();

    await act(async () => {
      pending.resolve({
        items: [],
        nextCursor: null,
      });
    });

    await screen.findByText(EMPTY);
  });

  it("recovers from an initial progress request failure", async () => {
    mockedPage.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await mountProgress();

    const retry = await screen.findByLabelText(INITIAL_RETRY);
    await fireEvent.press(retry);

    await screen.findByLabelText(photoLabel(first));

    expectPhotos([first, second]);
    expect(mockedPage).toHaveBeenCalledTimes(2);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("appends the next page without duplicates or extra statistics requests", async () => {
    await mountPhotos();

    mockedPage.mockResolvedValueOnce({
      items: [second, third],
      nextCursor: null,
    });

    await fireEvent.press(screen.getByLabelText(MORE));

    await screen.findByLabelText(photoLabel(third));

    expectPhotos([first, second, third]);
    expect(screen.queryByLabelText(MORE)).toBeNull();

    expect(mockedPage).toHaveBeenLastCalledWith(token, {
      cursor: second.id,
    });

    expect(mockedStatistics).toHaveBeenCalledTimes(1);
    expect(mockedPerformance).toHaveBeenCalledTimes(1);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("preserves the gallery and retries the same cursor after a page failure", async () => {
    await mountPhotos();

    mockedPage.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await fireEvent.press(screen.getByLabelText(MORE));

    const retry = await screen.findByLabelText(RETRY);

    expectPhotos([first, second]);

    mockedPage.mockResolvedValueOnce({
      items: [third],
      nextCursor: null,
    });

    await fireEvent.press(retry);
    await screen.findByLabelText(photoLabel(third));

    expectPhotos([first, second, third]);

    expect(mockedPage.mock.calls[1]).toEqual([token, { cursor: second.id }]);

    expect(mockedPage.mock.calls[2]).toEqual([token, { cursor: second.id }]);
  });

  it("restarts the gallery from its first page after an invalid cursor", async () => {
    await mountPhotos();

    mockedPage.mockRejectedValueOnce(
      new ApiClientError(
        "Invalid pagination cursor.",
        422,
        "invalid_pagination_cursor",
      ),
    );

    await fireEvent.press(screen.getByLabelText(MORE));

    const retry = await screen.findByLabelText(RETRY);

    mockedPage.mockResolvedValueOnce({
      items: [fresh],
      nextCursor: null,
    });

    await fireEvent.press(retry);

    await screen.findByLabelText(photoLabel(fresh));

    expectPhotos([fresh]);
    expect(mockedPage).toHaveBeenLastCalledWith(token);
  });

  it("restarts rather than repeatedly requesting a stalled cursor", async () => {
    await mountPhotos();

    mockedPage.mockResolvedValueOnce({
      items: [second, third],
      nextCursor: second.id,
    });

    await fireEvent.press(screen.getByLabelText(MORE));

    const retry = await screen.findByLabelText(RETRY);

    expectPhotos([first, second]);

    mockedPage.mockResolvedValueOnce({
      items: [fresh],
      nextCursor: null,
    });

    await fireEvent.press(retry);

    await screen.findByLabelText(photoLabel(fresh));

    expectPhotos([fresh]);
    expect(mockedPage).toHaveBeenLastCalledWith(token);
  });

  it("prevents simultaneous requests for the same page", async () => {
    await mountPhotos();

    const pending = deferred<Page<ProgressPhoto>>();
    mockedPage.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByLabelText(MORE));

    const button = screen.getByLabelText(MORE);

    expect(button.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(button);

    expect(mockedPage).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending.resolve({
        items: [third],
        nextCursor: null,
      });
    });

    await screen.findByLabelText(photoLabel(third));

    expectPhotos([first, second, third]);
  });

  it("ignores an obsolete next page after blur and refocus", async () => {
    const view = await mountPhotos();

    const pending = deferred<Page<ProgressPhoto>>();
    mockedPage.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByLabelText(MORE));

    mockFocused = false;
    await view.rerender(progressTree());

    mockedPage.mockResolvedValueOnce({
      items: [fresh],
      nextCursor: null,
    });

    mockFocused = true;
    await view.rerender(progressTree());

    await screen.findByLabelText(photoLabel(fresh));

    await act(async () => {
      pending.resolve({
        items: [third],
        nextCursor: null,
      });
    });

    expectPhotos([fresh]);
    expect(mockedPage).toHaveBeenCalledTimes(3);
  });

  it("preserves a new upload while a next page is in flight", async () => {
    await mountPhotos();

    const pending = deferred<Page<ProgressPhoto>>();
    mockedPage.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByLabelText(MORE));
    await fireEvent.press(screen.getByLabelText(SAVE));

    await screen.findByLabelText(photoLabel(uploaded));

    expectPhotos([uploaded, first, second]);

    await act(async () => {
      pending.resolve({
        items: [uploaded, second, third],
        nextCursor: null,
      });
    });

    await screen.findByLabelText(photoLabel(third));

    expectPhotos([uploaded, first, second, third]);

    expect(mockedUpload).toHaveBeenCalledWith(
      token,
      expect.objectContaining({
        uri: "file:///normalized.jpg",
        mediaType: "image/jpeg",
      }),
    );

    expect(mockedPage).toHaveBeenCalledTimes(2);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("does not publish an obsolete upload result after refocus", async () => {
    const view = await mountPhotos();

    const pending = deferred<ProgressPhoto>();
    mockedUpload.mockReturnValueOnce(pending.promise);

    await fireEvent.press(screen.getByLabelText(SAVE));

    await waitFor(() => {
      expect(mockedUpload).toHaveBeenCalledTimes(1);
    });

    mockFocused = false;
    await view.rerender(progressTree());

    mockedPage.mockResolvedValueOnce({
      items: [fresh],
      nextCursor: null,
    });

    mockFocused = true;
    await view.rerender(progressTree());

    await screen.findByLabelText(photoLabel(fresh));

    await act(async () => {
      pending.resolve(uploaded);
    });

    expectPhotos([fresh]);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
