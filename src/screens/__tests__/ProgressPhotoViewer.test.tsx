import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import {
  getExercisePerformance,
  getProgressPhotos,
  getProgressStatistics,
  uploadProgressPhoto,
  type ProgressPhoto,
} from "../../services/progress";
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
  getProgressPhotos: jest.fn(),
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
const mockedPhotos = getProgressPhotos as jest.Mock;
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
    mockedPhotos.mockResolvedValue([photo]);
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
});
