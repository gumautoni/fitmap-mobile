import { fireEvent, render, screen } from "@testing-library/react-native";

import { ApiClientError } from "../../services/apiClient";
import {
  createGymReview,
  getGymReviews,
  getMyGymReview,
  resolveGymIdentity,
  type GymReview,
  type GymReviewList,
} from "../../services/gymReviews";
import { useAppTheme } from "../../theme/ThemeProvider";
import { lightTheme } from "../../theme/themes";
import GymReviewsSection from "../GymReviewsSection";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://127.0.0.1:8000/api/v1",
  },
}));

jest.mock("../../services/gymReviews", () => ({
  createGymReview: jest.fn(),
  getGymReviews: jest.fn(),
  getMyGymReview: jest.fn(),
  resolveGymIdentity: jest.fn(),
}));

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: jest.fn(),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  MessageSquareText: () => null,
  RefreshCw: () => null,
  Send: () => null,
  Star: () => null,
}));

const mockedCreate = createGymReview as jest.Mock;
const mockedReviews = getGymReviews as jest.Mock;
const mockedMine = getMyGymReview as jest.Mock;
const mockedIdentity = resolveGymIdentity as jest.Mock;
const mockedTheme = useAppTheme as jest.Mock;

const ACCESS_TOKEN = "access-token-test";
const EXTERNAL_GYM_ID = "external-gym-123";
const INTERNAL_GYM_ID = "internal-gym-123";

function buildOwnReview(): GymReview {
  return {
    id: "review-123",
    gymId: INTERNAL_GYM_ID,
    rating: 5,
    comment: "Excelente academia.",
    createdAt: "2026-10-26T10:00:00Z",
    updatedAt: "2026-10-26T10:00:00Z",
  };
}

function buildEmptyList(): GymReviewList {
  return {
    summary: {
      gymId: INTERNAL_GYM_ID,
      averageRating: null,
      reviewCount: 0,
    },
    reviews: [],
  };
}

function buildPublishedList(): GymReviewList {
  return {
    summary: {
      gymId: INTERNAL_GYM_ID,
      averageRating: "5.00",
      reviewCount: 1,
    },
    reviews: [buildOwnReview()],
  };
}

async function runAuthenticatedRequest<T>(
  request: (accessToken: string) => Promise<T>,
): Promise<T> {
  return request(ACCESS_TOKEN);
}

async function renderSection() {
  return render(
    <GymReviewsSection
      externalGymId={EXTERNAL_GYM_ID}
      runAuthenticatedRequest={runAuthenticatedRequest}
    />,
  );
}

describe("GymReviewsSection publication", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedTheme.mockReturnValue({
      theme: lightTheme,
    });

    mockedIdentity.mockResolvedValue({
      gymId: INTERNAL_GYM_ID,
      providerName: "geoapify",
      externalId: EXTERNAL_GYM_ID,
    });

    mockedReviews.mockResolvedValue(buildEmptyList());
    mockedMine.mockResolvedValue(null);
    mockedCreate.mockResolvedValue(buildOwnReview());
  });

  it("shows the form when the user has no active review", async () => {
    await renderSection();

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(mockedMine).toHaveBeenCalledWith(ACCESS_TOKEN, INTERNAL_GYM_ID);

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("hides the form when the user already reviewed the gym", async () => {
    mockedMine.mockResolvedValue(buildOwnReview());

    await renderSection();

    expect(
      await screen.findByText("Você já avaliou esta academia no FitMap."),
    ).toBeTruthy();

    expect(screen.queryByLabelText("Publicar avaliação")).toBeNull();

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("publishes a review and reloads community ratings", async () => {
    mockedMine
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildOwnReview());

    mockedReviews
      .mockResolvedValueOnce(buildEmptyList())
      .mockResolvedValueOnce(buildPublishedList());

    await renderSection();

    await screen.findByLabelText("Publicar avaliação");

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "  Excelente academia.  ",
    );

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(await screen.findByText("Excelente academia.")).toBeTruthy();

    expect(mockedCreate).toHaveBeenCalledTimes(1);

    expect(mockedCreate).toHaveBeenCalledWith(ACCESS_TOKEN, INTERNAL_GYM_ID, {
      rating: 5,
      comment: "Excelente academia.",
    });

    expect(mockedReviews).toHaveBeenCalledTimes(2);
    expect(mockedMine).toHaveBeenCalledTimes(2);

    expect(screen.getByText("1 avaliação no FitMap")).toBeTruthy();

    expect(
      screen.getByText("Você já avaliou esta academia no FitMap."),
    ).toBeTruthy();

    expect(screen.queryByLabelText("Publicar avaliação")).toBeNull();
  });

  it("recovers from an already-existing-review conflict", async () => {
    mockedMine
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildOwnReview());

    mockedReviews
      .mockResolvedValueOnce(buildEmptyList())
      .mockResolvedValueOnce(buildPublishedList());

    mockedCreate.mockRejectedValueOnce(
      new ApiClientError(
        "Review already exists.",
        409,
        "gym_review_already_exists",
      ),
    );

    await renderSection();

    await screen.findByLabelText("Publicar avaliação");

    await fireEvent.press(screen.getByLabelText("Selecionar 4 estrelas"));

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(
      await screen.findByText("Você já avaliou esta academia no FitMap."),
    ).toBeTruthy();

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedMine).toHaveBeenCalledTimes(2);

    expect(screen.queryByLabelText("Publicar avaliação")).toBeNull();
  });

  it("shows an API error without discarding the form", async () => {
    mockedCreate.mockRejectedValueOnce(
      new ApiClientError("Service unavailable.", 503, "service_unavailable"),
    );

    await renderSection();

    await screen.findByLabelText("Publicar avaliação");

    await fireEvent.press(screen.getByLabelText("Selecionar 3 estrelas"));

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(
      await screen.findByText(
        "Não foi possível publicar sua avaliação. Tente novamente.",
      ),
    ).toBeTruthy();

    expect(screen.getByLabelText("Publicar avaliação")).toBeTruthy();

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedMine).toHaveBeenCalledTimes(1);
  });

  it("displays the timeout-specific publication message", async () => {
    mockedCreate.mockRejectedValueOnce(new Error("The request timed out."));

    await renderSection();

    await screen.findByLabelText("Publicar avaliação");

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(
      await screen.findByText(
        "A publicação demorou mais do que o esperado. Confira suas avaliações antes de tentar novamente.",
      ),
    ).toBeTruthy();
  });

  it("preserves the session-expired message", async () => {
    mockedCreate.mockRejectedValueOnce(
      new Error("Sua sessão expirou. Entre novamente."),
    );

    await renderSection();

    await screen.findByLabelText("Publicar avaliação");

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(
      await screen.findByText("Sua sessão expirou. Entre novamente."),
    ).toBeTruthy();
  });

  it("disables the form while publication is pending", async () => {
    mockedCreate.mockImplementation(() => new Promise(() => undefined));

    await renderSection();

    await screen.findByLabelText("Publicar avaliação");

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(await screen.findByText("Salvando avaliação...")).toBeTruthy();

    expect(
      screen.getByLabelText("Publicar avaliação").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });
});
