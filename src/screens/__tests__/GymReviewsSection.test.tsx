import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { ApiClientError } from "../../services/apiClient";
import {
  getGymReviews,
  getMyGymReview,
  resolveGymIdentity,
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

const mockedIdentity = resolveGymIdentity as jest.Mock;
const mockedReviews = getGymReviews as jest.Mock;
const mockedMine = getMyGymReview as jest.Mock;
const mockedTheme = useAppTheme as jest.Mock;

const ACCESS_TOKEN = "test-access-token";
const EXTERNAL_GYM_ID = "geoapify-gym-123";
const INTERNAL_GYM_ID = "internal-gym-123";

async function runAuthenticatedRequest<T>(
  request: (accessToken: string) => Promise<T>,
): Promise<T> {
  return request(ACCESS_TOKEN);
}

function buildReviews(): GymReviewList {
  return {
    summary: {
      gymId: INTERNAL_GYM_ID,
      averageRating: "4.50",
      reviewCount: 2,
    },
    reviews: [
      {
        id: "review-1",
        gymId: INTERNAL_GYM_ID,
        rating: 5,
        comment: "Excelente academia.",
        createdAt: "2026-10-26T10:00:00Z",
        updatedAt: "2026-10-26T10:00:00Z",
      },
      {
        id: "review-2",
        gymId: INTERNAL_GYM_ID,
        rating: 4,
        comment: "Ambiente organizado.",
        createdAt: "2026-10-26T11:00:00Z",
        updatedAt: "2026-10-26T11:00:00Z",
      },
    ],
  };
}

function renderReviews(externalGymId = EXTERNAL_GYM_ID) {
  return render(
    <GymReviewsSection
      externalGymId={externalGymId}
      runAuthenticatedRequest={runAuthenticatedRequest}
    />,
  );
}

describe("GymReviewsSection", () => {
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

    mockedReviews.mockResolvedValue(buildReviews());
    mockedMine.mockResolvedValue(null);
  });

  it("displays the loading state while the request is pending", async () => {
    mockedIdentity.mockImplementation(() => new Promise(() => undefined));

    await renderReviews();

    expect(screen.getByText("Carregando notas e avaliações...")).toBeTruthy();

    expect(mockedReviews).not.toHaveBeenCalled();
  });

  it("resolves the internal identity before loading reviews", async () => {
    await renderReviews();

    await screen.findByText("Excelente academia.");

    expect(mockedIdentity).toHaveBeenCalledWith(ACCESS_TOKEN, EXTERNAL_GYM_ID);

    expect(mockedReviews).toHaveBeenCalledWith(ACCESS_TOKEN, INTERNAL_GYM_ID);

    expect(mockedIdentity).toHaveBeenCalledTimes(1);
    expect(mockedReviews).toHaveBeenCalledTimes(1);
  });

  it("displays FitMap rating summary and community reviews", async () => {
    await renderReviews();

    expect(await screen.findByText("4,5")).toBeTruthy();

    expect(screen.getByText("2 avaliações no FitMap")).toBeTruthy();

    expect(screen.getByText("Excelente academia.")).toBeTruthy();

    expect(screen.getByText("Ambiente organizado.")).toBeTruthy();

    expect(screen.getByText("5/5")).toBeTruthy();

    expect(screen.getByText("4/5")).toBeTruthy();

    expect(
      screen.getByText("Opiniões compartilhadas por usuários do FitMap."),
    ).toBeTruthy();
  });

  it("displays an empty state when no reviews exist", async () => {
    mockedReviews.mockResolvedValue({
      summary: {
        gymId: INTERNAL_GYM_ID,
        averageRating: null,
        reviewCount: 0,
      },
      reviews: [],
    } satisfies GymReviewList);

    await renderReviews();

    expect(await screen.findByText("Nenhuma avaliação ainda")).toBeTruthy();

    expect(screen.getByText("Sem nota")).toBeTruthy();

    expect(screen.getByText("0 avaliações no FitMap")).toBeTruthy();
  });

  it("displays the singular label for one review", async () => {
    mockedReviews.mockResolvedValue({
      summary: {
        gymId: INTERNAL_GYM_ID,
        averageRating: "5.00",
        reviewCount: 1,
      },
      reviews: [buildReviews().reviews[0]],
    } satisfies GymReviewList);

    await renderReviews();

    await screen.findByText("Excelente academia.");

    expect(screen.getByText("1 avaliação no FitMap")).toBeTruthy();

    expect(screen.getByText("5,0")).toBeTruthy();
  });

  it("handles reviews without written comments", async () => {
    mockedReviews.mockResolvedValue({
      summary: {
        gymId: INTERNAL_GYM_ID,
        averageRating: "4.00",
        reviewCount: 1,
      },
      reviews: [
        {
          ...buildReviews().reviews[0],
          rating: 4,
          comment: null,
        },
      ],
    } satisfies GymReviewList);

    await renderReviews();

    expect(await screen.findByText("Avaliação sem comentário.")).toBeTruthy();

    expect(screen.getByText("4/5")).toBeTruthy();
  });

  it("displays an appropriate error when the gym provider is unavailable", async () => {
    mockedIdentity.mockRejectedValue(
      new ApiClientError(
        "Provider unavailable",
        502,
        "gym_provider_unavailable",
      ),
    );

    await renderReviews();

    expect(
      await screen.findByText(
        "O serviço de academias está indisponível no momento.",
      ),
    ).toBeTruthy();

    expect(mockedReviews).not.toHaveBeenCalled();

    expect(
      screen.getByLabelText("Tentar carregar avaliações novamente"),
    ).toBeTruthy();
  });

  it("can retry after an identity resolution failure", async () => {
    mockedIdentity
      .mockRejectedValueOnce(new Error("The backend could not be reached."))
      .mockResolvedValue({
        gymId: INTERNAL_GYM_ID,
        providerName: "geoapify",
        externalId: EXTERNAL_GYM_ID,
      });

    await renderReviews();

    await screen.findByText(
      "Não foi possível carregar as avaliações. Tente novamente.",
    );

    await fireEvent.press(
      screen.getByLabelText("Tentar carregar avaliações novamente"),
    );

    expect(await screen.findByText("Excelente academia.")).toBeTruthy();

    expect(mockedIdentity).toHaveBeenCalledTimes(2);
    expect(mockedReviews).toHaveBeenCalledTimes(1);
  });

  it("can retry after a review listing failure", async () => {
    mockedReviews
      .mockRejectedValueOnce(new Error("The request timed out."))
      .mockResolvedValue(buildReviews());

    await renderReviews();

    await screen.findByText(
      "O carregamento das avaliações demorou mais do que o esperado.",
    );

    await fireEvent.press(
      screen.getByLabelText("Tentar carregar avaliações novamente"),
    );

    expect(await screen.findByText("Ambiente organizado.")).toBeTruthy();

    expect(mockedReviews).toHaveBeenCalledTimes(2);
  });

  it("informs the user when the authenticated session expires", async () => {
    mockedIdentity.mockRejectedValue(
      new Error("Sua sessão expirou. Entre novamente."),
    );

    await renderReviews();

    expect(
      await screen.findByText("Sua sessão expirou. Entre novamente."),
    ).toBeTruthy();
  });

  it("reloads reviews when the selected gym changes", async () => {
    const rendered = await renderReviews();

    await screen.findByText("Excelente academia.");

    mockedIdentity.mockResolvedValue({
      gymId: "another-internal-gym",
      providerName: "geoapify",
      externalId: "another-external-gym",
    });

    mockedReviews.mockResolvedValue({
      summary: {
        gymId: "another-internal-gym",
        averageRating: null,
        reviewCount: 0,
      },
      reviews: [],
    } satisfies GymReviewList);

    await rendered.rerender(
      <GymReviewsSection
        externalGymId="another-external-gym"
        runAuthenticatedRequest={runAuthenticatedRequest}
      />,
    );

    expect(await screen.findByText("Nenhuma avaliação ainda")).toBeTruthy();

    expect(mockedIdentity).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      "another-external-gym",
    );

    expect(mockedReviews).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      "another-internal-gym",
    );

    expect(screen.queryByText("Excelente academia.")).toBeNull();
  });

  it("keeps an error separate from the rating summary", async () => {
    mockedReviews.mockRejectedValue(
      new Error("The backend could not be reached."),
    );

    await renderReviews();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Não foi possível carregar as avaliações. Tente novamente.",
        ),
      ).toBeTruthy();
    });

    expect(screen.queryByText("4,5")).toBeNull();

    expect(screen.queryByText("Excelente academia.")).toBeNull();
  });
});
