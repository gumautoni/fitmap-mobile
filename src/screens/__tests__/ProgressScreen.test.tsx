import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  ArrowRight: () => null,
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

  it("accessibility: groups real workout indicators with contextual values", async () => {
    await mountPhotos();

    expect(
      screen.getByRole("header", {
        name: "Meu progresso",
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("header", {
        name: "Atividade de treino",
      }),
    ).toBeTruthy();

    const indicators = [
      {
        label: "Treinos conclu\u00eddos: 12",
        value: "12",
        title: "Treinos conclu\u00eddos",
      },
      {
        label: "Treinos conclu\u00eddos nos \u00faltimos 7 dias: 3",
        value: "3",
        title: "\u00daltimos 7 dias",
      },
      {
        label: "Treinos conclu\u00eddos nos \u00faltimos 30 dias: 9",
        value: "9",
        title: "\u00daltimos 30 dias",
      },
      {
        label: "Dias de treino em 30 dias: 8",
        value: "8",
        title: "Dias de treino em 30 dias",
      },
      {
        label: "S\u00e9ries realmente realizadas: 84",
        value: "84",
        title: "S\u00e9ries realmente realizadas",
      },
    ];

    for (const indicator of indicators) {
      const group = screen.getByLabelText(indicator.label);

      expect(group).toHaveProp("accessible", true);

      expect(within(group).getByText(indicator.value)).toBeTruthy();

      expect(within(group).getByText(indicator.title)).toBeTruthy();
    }

    expectPhotos([first, second]);

    expect(mockedStatistics).toHaveBeenCalledTimes(1);
    expect(mockedPerformance).toHaveBeenCalledTimes(1);
    expect(mockedPage).toHaveBeenCalledTimes(1);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: exposes genuine zero indicators without treating them as unavailable", async () => {
    mockedStatistics.mockResolvedValueOnce({
      completedWorkouts: 0,
      completedWorkoutsLast7Days: 0,
      completedWorkoutsLast30Days: 0,
      trainingDaysLast30Days: 0,
      totalPerformedSets: 0,
    });

    await mountPhotos();

    const labels = [
      "Treinos conclu\u00eddos: 0",
      "Treinos conclu\u00eddos nos \u00faltimos 7 dias: 0",
      "Treinos conclu\u00eddos nos \u00faltimos 30 dias: 0",
      "Dias de treino em 30 dias: 0",
      "S\u00e9ries realmente realizadas: 0",
    ];

    for (const label of labels) {
      const group = screen.getByLabelText(label);

      expect(group).toHaveProp("accessible", true);
      expect(within(group).getByText("0")).toBeTruthy();
    }

    expect(
      screen.getByText("Seu progresso come\u00e7a no primeiro treino"),
    ).toBeTruthy();

    expect(screen.queryByRole("alert")).toBeNull();

    expectPhotos([first, second]);
    expect(mockedStatistics).toHaveBeenCalledTimes(1);
  });

  it("accessibility: distinguishes initial loading and errors and provides an accessible retry", async () => {
    let reject!: (reason: Error) => void;

    const pending = new Promise<Page<ProgressPhoto>>((_, fail) => {
      reject = fail;
    });

    mockedPage.mockReturnValueOnce(pending);

    await mountProgress();

    const loadingLabel = "Carregando seu progresso";

    try {
      const progress = screen.getByRole("progressbar", {
        name: loadingLabel,
      });

      expect(progress).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(screen.getByText(loadingLabel)).toBeTruthy();

      expect(screen.queryByText("Meu progresso")).toBeNull();

      expect(screen.queryByLabelText("Treinos conclu\u00eddos: 0")).toBeNull();

      expect(screen.queryByLabelText(INITIAL_RETRY)).toBeNull();

      expect(screen.queryByText(EMPTY)).toBeNull();

      expect(mockedPage).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        reject(new Error("The backend could not be reached."));
      });
    }

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(
      "N\u00e3o foi poss\u00edvel conectar ao servidor.",
    );

    expect(alert).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByRole("progressbar")).toBeNull();

    const retry = screen.getByRole("button", {
      name: INITIAL_RETRY,
    });

    expect(retry).not.toBeDisabled();

    expect(retry).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(retry).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });

    await fireEvent.press(retry);

    await screen.findByLabelText(photoLabel(first));

    expect(screen.getByLabelText("Treinos conclu\u00eddos: 12")).toBeTruthy();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();

    expectPhotos([first, second]);

    expect(mockedPage).toHaveBeenCalledTimes(2);
    expect(mockedStatistics).toHaveBeenCalledTimes(2);
    expect(mockedPerformance).toHaveBeenCalledTimes(2);
  });

  it("accessibility: announces background refresh without losing previously loaded progress", async () => {
    const view = await mountPhotos();

    const originalLabel = "Treinos conclu\u00eddos: 12";
    const refreshLabel = "Atualizando seu progresso";

    let reject!: (reason: Error) => void;

    const pending = new Promise<Page<ProgressPhoto>>((_, fail) => {
      reject = fail;
    });

    mockFocused = false;
    await view.rerender(progressTree());

    mockedPage.mockReturnValueOnce(pending);

    mockFocused = true;
    await view.rerender(progressTree());

    try {
      const progress = screen.getByRole("progressbar", {
        name: refreshLabel,
      });

      expect(progress).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(progress).toHaveProp("accessibilityLiveRegion", "polite");

      expect(screen.getByLabelText(originalLabel)).toBeTruthy();
      expectPhotos([first, second]);

      expect(screen.queryByLabelText(INITIAL_RETRY)).toBeNull();
      expect(screen.queryByText(EMPTY)).toBeNull();

      expect(mockedPage).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => {
        reject(new Error("The request timed out."));
      });
    }

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(
      "A conex\u00e3o com o servidor demorou mais que o esperado.",
    );

    expect(alert).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByLabelText(refreshLabel)).toBeNull();

    expect(screen.getByLabelText(originalLabel)).toBeTruthy();
    expectPhotos([first, second]);

    const retry = screen.getByLabelText(INITIAL_RETRY);

    expect(retry).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(retry).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });

    const recovery = deferred<Page<ProgressPhoto>>();

    mockedPage.mockReturnValueOnce(recovery.promise);

    mockedStatistics.mockResolvedValueOnce({
      completedWorkouts: 13,
      completedWorkoutsLast7Days: 4,
      completedWorkoutsLast30Days: 10,
      trainingDaysLast30Days: 9,
      totalPerformedSets: 90,
    });

    try {
      await fireEvent.press(retry);

      expect(
        screen.getByRole("progressbar", {
          name: refreshLabel,
        }),
      ).toBeTruthy();

      expect(screen.getByLabelText(originalLabel)).toBeTruthy();

      expect(screen.queryByRole("alert")).toBeNull();

      expectPhotos([first, second]);

      expect(mockedPage).toHaveBeenCalledTimes(3);
    } finally {
      await act(async () => {
        recovery.resolve({
          items: [fresh, first],
          nextCursor: null,
        });
      });
    }

    expect(screen.getByLabelText("Treinos conclu\u00eddos: 13")).toBeTruthy();

    expect(
      screen.getByLabelText("S\u00e9ries realmente realizadas: 90"),
    ).toBeTruthy();

    expect(screen.queryByLabelText(originalLabel)).toBeNull();
    expect(screen.queryByLabelText(refreshLabel)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    expectPhotos([fresh, first]);

    expect(mockedPage).toHaveBeenCalledTimes(3);
    expect(mockedStatistics).toHaveBeenCalledTimes(3);
    expect(mockedPerformance).toHaveBeenCalledTimes(3);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: distinguishes photos recorded on the same date without exposing internal identifiers", async () => {
    const sameDay = {
      ...first,
      id: "same-day-private-photo",
    };

    mockedPage.mockResolvedValueOnce({
      items: [first, sameDay, second],
      nextCursor: null,
    });

    await mountProgress();

    const baseLabel = photoLabel(first);

    const firstLabel = `${baseLabel}, foto 1 de 2 nesta data`;
    const secondLabel = `${baseLabel}, foto 2 de 2 nesta data`;

    const firstButton = await screen.findByRole("button", {
      name: firstLabel,
    });

    const secondButton = screen.getByRole("button", {
      name: secondLabel,
    });

    expect(firstButton).not.toBe(secondButton);

    expect(
      screen.getByRole("header", {
        name: "Fotos de progresso",
      }),
    ).toBeTruthy();

    for (const button of [firstButton, secondButton]) {
      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      expect(button).toHaveProp(
        "accessibilityHint",
        "Abre a imagem inteira em tela cheia",
      );

      expect(button.props.accessibilityLabel).not.toContain(sameDay.id);

      expect(button.props.accessibilityLabel).not.toContain(first.id);
    }

    expect(
      screen.getByRole("button", {
        name: photoLabel(second),
      }),
    ).toBeTruthy();

    await fireEvent.press(secondButton);

    expect(screen.getByLabelText("Foto de progresso ampliada")).toHaveProp(
      "source",
      {
        uri: `http://test-api/api/v1/progress/photos/${sameDay.id}/content`,
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(mockedPage).toHaveBeenCalledTimes(1);
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: announces pagination failures and preserves the existing gallery during retry", async () => {
    await mountPhotos();

    const pending = deferred<Page<ProgressPhoto>>();

    mockedPage.mockReturnValueOnce(pending.promise);

    try {
      await fireEvent.press(screen.getByLabelText(MORE));

      const button = screen.getByRole("button", {
        name: MORE,
      });

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({
          busy: true,
          disabled: true,
        }),
      );

      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      expect(button).toBeDisabled();
      expectPhotos([first, second]);

      await fireEvent.press(button);

      expect(mockedPage).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => {
        pending.resolve({
          items: [third],
          nextCursor: third.id,
        });
      });
    }

    await screen.findByLabelText(photoLabel(third));

    expectPhotos([first, second, third]);

    mockedPage.mockRejectedValueOnce(
      new Error("The backend could not be reached."),
    );

    await fireEvent.press(screen.getByLabelText(MORE));

    const retry = await screen.findByLabelText(RETRY);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(
      "N\u00e3o foi poss\u00edvel conectar ao servidor.",
    );

    expect(alert).toHaveProp("accessibilityLiveRegion", "polite");

    expect(retry).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(retry).not.toBeDisabled();

    expectPhotos([first, second, third]);

    mockedPage.mockResolvedValueOnce({
      items: [fresh],
      nextCursor: null,
    });

    await fireEvent.press(retry);

    await screen.findByLabelText(photoLabel(fresh));

    expectPhotos([first, second, third, fresh]);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText(RETRY)).toBeNull();
    expect(screen.queryByLabelText(MORE)).toBeNull();

    expect(mockedPage).toHaveBeenCalledTimes(4);

    expect(mockedPage.mock.calls[2]).toEqual([token, { cursor: third.id }]);

    expect(mockedPage.mock.calls[3]).toEqual([token, { cursor: third.id }]);

    expect(mockedStatistics).toHaveBeenCalledTimes(1);
    expect(mockedPerformance).toHaveBeenCalledTimes(1);
    expect(mockedLegacy).not.toHaveBeenCalled();
  });

  it("accessibility: announces upload failures without losing private photos", async () => {
    await mountPhotos();

    mockedUpload.mockRejectedValueOnce(
      new ApiClientError(
        "Storage unavailable.",
        503,
        "media_storage_unavailable",
      ),
    );

    await fireEvent.press(screen.getByLabelText(SAVE));

    const message =
      "O armazenamento privado de fotos est\u00e1 indispon\u00edvel no momento.";

    await screen.findByText(message);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(message);

    expect(alert).toHaveProp("accessibilityLiveRegion", "polite");

    expectPhotos([first, second]);

    expect(screen.getByLabelText(SAVE)).not.toBeDisabled();

    expect(Alert.alert).toHaveBeenCalledWith(
      "N\u00e3o foi poss\u00edvel adicionar a foto",
      message,
    );

    await fireEvent.press(screen.getByLabelText(SAVE));

    await screen.findByLabelText(photoLabel(uploaded));

    expectPhotos([uploaded, first, second]);

    expect(screen.queryByText(message)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    expect(mockedUpload).toHaveBeenCalledTimes(2);
    expect(mockedPage).toHaveBeenCalledTimes(1);
  });

  it("accessibility: distinguishes an empty gallery from refresh and unavailable records", async () => {
    mockedPage.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    const view = await mountProgress();

    const empty = await screen.findByText(EMPTY);

    expect(empty).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByLabelText(MORE)).toBeNull();

    let reject!: (reason: Error) => void;

    const pending = new Promise<Page<ProgressPhoto>>((_, fail) => {
      reject = fail;
    });

    mockFocused = false;
    await view.rerender(progressTree());

    mockedPage.mockReturnValueOnce(pending);

    mockFocused = true;
    await view.rerender(progressTree());

    const loadingLabel = "Atualizando suas fotos";

    try {
      const progress = screen.getByRole("progressbar", {
        name: loadingLabel,
      });

      expect(progress).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(screen.getByText("Atualizando suas fotos...")).toBeTruthy();

      expect(screen.queryByText(EMPTY)).toBeNull();
      expectPhotos([]);
    } finally {
      await act(async () => {
        reject(new Error("The backend could not be reached."));
      });
    }

    const unavailable = screen.getByText(
      "N\u00e3o foi poss\u00edvel confirmar seus registros visuais.",
    );

    expect(unavailable).toHaveProp("accessibilityRole", "alert");

    expect(unavailable).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByLabelText(loadingLabel)).toBeNull();
    expect(screen.queryByText(EMPTY)).toBeNull();

    expectPhotos([]);

    mockedPage.mockResolvedValueOnce({
      items: [first],
      nextCursor: null,
    });

    await fireEvent.press(screen.getByLabelText(INITIAL_RETRY));

    await screen.findByLabelText(photoLabel(first));

    expectPhotos([first]);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(EMPTY)).toBeNull();
    expect(mockedPage).toHaveBeenCalledTimes(3);
  });

  it("accessibility: contextualizes exercise performance without inventing comparable loads", async () => {
    mockedPerformance.mockResolvedValueOnce([
      {
        exerciseId: "exercise-bench",
        exerciseName: "Supino",
        points: [
          {
            workoutSessionId: "session-1",
            completedAt: first.recordedAt,
            performedSets: 3,
            totalRepetitions: 24,
            maxLoads: [{ loadUnit: "kg", maxLoad: "20" }],
          },
          {
            workoutSessionId: "session-2",
            completedAt: uploaded.recordedAt,
            performedSets: 4,
            totalRepetitions: 32,
            maxLoads: [{ loadUnit: "kg", maxLoad: "25" }],
          },
        ],
      },
      {
        exerciseId: "exercise-squat",
        exerciseName: "Agachamento",
        points: [
          {
            workoutSessionId: "session-3",
            completedAt: first.recordedAt,
            performedSets: 2,
            totalRepetitions: 20,
            maxLoads: [{ loadUnit: "lb", maxLoad: "40" }],
          },
          {
            workoutSessionId: "session-4",
            completedAt: uploaded.recordedAt,
            performedSets: 3,
            totalRepetitions: 30,
            maxLoads: [{ loadUnit: "kg", maxLoad: "30" }],
          },
        ],
      },
      {
        exerciseId: "exercise-pushup",
        exerciseName: "Flex\u00e3o",
        points: [
          {
            workoutSessionId: "session-5",
            completedAt: first.recordedAt,
            performedSets: 2,
            totalRepetitions: 20,
            maxLoads: [],
          },
          {
            workoutSessionId: "session-6",
            completedAt: uploaded.recordedAt,
            performedSets: 3,
            totalRepetitions: 30,
            maxLoads: [],
          },
        ],
      },
    ]);

    await mountPhotos();

    expect(
      screen.getByRole("header", {
        name: "Evolu\u00e7\u00e3o por exerc\u00edcio",
      }),
    ).toBeTruthy();

    for (const exercise of ["Supino", "Agachamento", "Flex\u00e3o"]) {
      expect(
        screen.getByRole("header", {
          name: exercise,
        }),
      ).toBeTruthy();
    }

    const dateFormat = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const firstDate = dateFormat.format(new Date(first.recordedAt));

    const latestDate = dateFormat.format(new Date(uploaded.recordedAt));

    const groups = [
      [`Supino: primeiro registro, ${firstDate}`, firstDate],
      [`Supino: registro mais recente, ${latestDate}`, latestDate],
      ["Supino: s\u00e9ries realizadas, 4", "4"],
      ["Supino: repeti\u00e7\u00f5es registradas, 32", "32"],
      ["Supino: carga m\u00e1xima no registro mais recente, 25 kg", "25 kg"],
      [
        "Agachamento: carga m\u00e1xima no registro mais recente, 30 kg",
        "30 kg",
      ],
      [
        "Flex\u00e3o: carga m\u00e1xima no registro mais recente, Carga n\u00e3o registrada",
        "Carga n\u00e3o registrada",
      ],
    ];

    for (const [label, value] of groups) {
      const group = screen.getByLabelText(label);

      expect(group).toHaveProp("accessible", true);

      expect(within(group).getByText(value)).toBeTruthy();
    }

    expect(
      screen.getByLabelText(
        "Evolu\u00e7\u00e3o de carga de Supino: 20 kg para 25 kg",
      ),
    ).toBeTruthy();

    expect(screen.getByText("20 kg \u2192 25 kg")).toBeTruthy();

    expect(
      screen.queryByLabelText(/^Evolu\u00e7\u00e3o de carga de Agachamento:/),
    ).toBeNull();

    expect(
      screen.queryByLabelText(/^Evolu\u00e7\u00e3o de carga de Flex\u00e3o:/),
    ).toBeNull();

    expect(screen.queryByText("40 lb \u2192 30 kg")).toBeNull();

    expect(mockedPerformance).toHaveBeenCalledTimes(1);
    expect(mockedStatistics).toHaveBeenCalledTimes(1);
    expect(mockedPage).toHaveBeenCalledTimes(1);
  });
});
