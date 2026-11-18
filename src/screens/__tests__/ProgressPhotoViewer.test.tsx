import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import type { ContextType } from "react";
import { Animated } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  getExercisePerformance,
  getProgressPhotosPage,
  getProgressStatistics,
  uploadProgressPhoto,
  type ProgressPhoto,
} from "../../services/progress";
import ProgressPhotoViewer from "../../components/ProgressPhotoViewer";
import ProgressScreen from "../ProgressScreen";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://127.0.0.1:8000/api/v1",
  },
}));

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { AuthContext: React.createContext(null) };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("../../components/BmiCard", () => () => null);

jest.mock(
  "../../components/BodyMetricsSection",
  () =>
    function MockBodyMetricsSection() {
      return null;
    },
);

jest.mock(
  "../../components/FitnessGoalsSection",
  () =>
    function MockFitnessGoalsSection() {
      return null;
    },
);

jest.mock(
  "../../components/ProgressPhotoCapture",
  () =>
    function MockProgressPhotoCapture() {
      return null;
    },
);

jest.mock("lucide-react-native", () => {
  function MockIcon() {
    return null;
  }

  return {
    Activity: MockIcon,
    AlertCircle: MockIcon,
    CalendarDays: MockIcon,
    Dumbbell: MockIcon,
    Images: MockIcon,
    Maximize2: MockIcon,
    RefreshCw: MockIcon,
    ShieldCheck: MockIcon,
    TrendingUp: MockIcon,
    X: MockIcon,
  };
});

jest.mock("../../services/progress", () => ({
  getProgressStatistics: jest.fn(),
  getExercisePerformance: jest.fn(),
  getProgressPhotosPage: jest.fn(),
  uploadProgressPhoto: jest.fn(),
  getProgressPhotoSource: (token: string, id: string) => ({
    uri: `https://example.test/progress/photos/${id}/content`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }),
}));

const mockedStatistics = getProgressStatistics as jest.Mock;
const mockedPerformance = getExercisePerformance as jest.Mock;
const mockedPhotos = getProgressPhotosPage as jest.Mock;
const mockedUpload = uploadProgressPhoto as jest.Mock;

const photo: ProgressPhoto = {
  id: "photo-test-001",
  workoutSessionId: null,
  mediaType: "image/jpeg",
  recordedAt: "2026-11-05T12:00:00Z",
  createdAt: "2026-11-05T12:00:00Z",
};

async function authenticatedRequest<T>(
  callback: (token: string) => Promise<T>,
): Promise<T> {
  return callback("test-access-token");
}

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: "test-access-token",
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: authenticatedRequest,
  updateAuthenticatedUser: jest.fn(),
};

describe("ProgressScreen - visualizador de fotos", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedStatistics.mockResolvedValue({
      completedWorkouts: 0,
      completedWorkoutsLast7Days: 0,
      completedWorkoutsLast30Days: 0,
      trainingDaysLast30Days: 0,
      totalPerformedSets: 0,
    });

    mockedPerformance.mockResolvedValue([]);
    mockedPhotos.mockResolvedValue({
      items: [photo],
      nextCursor: null,
    });
  });

  async function openPhoto() {
    await render(
      <AuthContext.Provider value={authValue}>
        <ProgressScreen />
      </AuthContext.Provider>,
    );

    const thumbnail = await screen.findByLabelText(
      /Ampliar foto de progresso registrada em/,
    );

    await fireEvent.press(thumbnail);
  }

  it("abre a foto inteira usando a origem autenticada", async () => {
    await openPhoto();

    const image = screen.getByLabelText("Foto de progresso ampliada");

    expect(image.props.resizeMode).toBe("contain");

    expect(image.props.source).toEqual({
      uri: "https://example.test/progress/photos/photo-test-001/content",
      headers: {
        Authorization: "Bearer test-access-token",
      },
    });

    expect(screen.getByText("Registro visual privado")).toBeTruthy();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("fecha o visualizador sem modificar a foto", async () => {
    await openPhoto();

    await fireEvent.press(screen.getByLabelText("Fechar foto ampliada"));

    expect(screen.queryByLabelText("Foto de progresso ampliada")).toBeNull();

    expect(
      screen.getByLabelText(/Ampliar foto de progresso registrada em/),
    ).toBeTruthy();

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("accessibility: exposes the viewer heading, authenticated image and recording date", async () => {
    await openPhoto();

    const heading = screen.getByRole("header", {
      name: "Foto de progresso",
    });

    expect(heading).toBeTruthy();

    const image = screen.getByRole("image", {
      name: "Foto de progresso ampliada",
    });

    const dateLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(photo.recordedAt));

    expect(image).toHaveProp(
      "accessibilityHint",
      `Registrada em ${dateLabel}. Registro visual privado.`,
    );

    expect(image).toHaveProp("resizeMode", "contain");

    expect(image).toHaveProp("source", {
      uri: "https://example.test/progress/photos/photo-test-001/content",
      headers: {
        Authorization: "Bearer test-access-token",
      },
    });

    expect(screen.getByText("Registro visual privado")).toBeTruthy();

    let modalContainer = heading.parent;

    while (
      modalContainer &&
      modalContainer.props.accessibilityViewIsModal !== true
    ) {
      modalContainer = modalContainer.parent;
    }

    if (!modalContainer) {
      throw new Error("Accessible modal boundary not found.");
    }

    expect(modalContainer).toContainElement(image);
    expect(within(modalContainer).getByText(dateLabel)).toBeTruthy();

    expect(mockedUpload).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Fechar foto ampliada"));

    expect(screen.queryByLabelText("Foto de progresso ampliada")).toBeNull();

    expect(
      screen.getByLabelText(/Ampliar foto de progresso registrada em/),
    ).toBeTruthy();

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("accessibility: provides a practical close target and an accessibility escape action", async () => {
    const onClose = jest.fn();

    await render(
      <ProgressPhotoViewer
        source={{ uri: "file:///synthetic-progress-photo.jpg" }}
        dateLabel="05/11/2026"
        reduceMotion
        onClose={onClose}
      />,
    );

    const close = screen.getByRole("button", {
      name: "Fechar foto ampliada",
    });

    expect(close).toHaveStyle({
      width: 48,
      height: 48,
    });

    expect(close).not.toBeDisabled();

    let modalContainer = close.parent;

    while (
      modalContainer &&
      modalContainer.props.accessibilityViewIsModal !== true
    ) {
      modalContainer = modalContainer.parent;
    }

    if (!modalContainer) {
      throw new Error("Accessible modal boundary not found.");
    }

    expect(modalContainer).toContainElement(close);

    expect(modalContainer).toHaveProp(
      "onAccessibilityEscape",
      expect.any(Function),
    );

    await fireEvent(modalContainer, "accessibilityEscape");

    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();

    await fireEvent.press(close);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves reduced-motion rendering and the close action without starting an animation", async () => {
    const timing = jest.spyOn(Animated, "timing");

    const onClose = jest.fn();

    try {
      await render(
        <ProgressPhotoViewer
          source={{ uri: "file:///synthetic-progress-photo.jpg" }}
          dateLabel="05/11/2026"
          reduceMotion
          onClose={onClose}
        />,
      );

      expect(screen.getByLabelText("Foto de progresso ampliada")).toBeTruthy();

      expect(screen.getByText("05/11/2026")).toBeTruthy();

      expect(timing).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByLabelText("Fechar foto ampliada"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(timing).not.toHaveBeenCalled();
    } finally {
      timing.mockRestore();
    }
  });
});
