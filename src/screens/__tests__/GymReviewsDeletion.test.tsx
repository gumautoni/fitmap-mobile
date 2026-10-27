import { fireEvent, render, screen } from "@testing-library/react-native";

import { ApiClientError } from "../../services/apiClient";
import {
  getGymReviews,
  getMyGymReview,
  removeGymReview,
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
  removeGymReview: jest.fn(),
  resolveGymIdentity: jest.fn(),
  updateGymReview: jest.fn(),
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
const mockedRemove = removeGymReview as jest.Mock;
const mockedTheme = useAppTheme as jest.Mock;

const ACCESS_TOKEN = "test-access-token";
const EXTERNAL_GYM_ID = "external-gym-123";
const INTERNAL_GYM_ID = "internal-gym-123";

function buildReview(): GymReview {
  return {
    id: "review-123",
    gymId: INTERNAL_GYM_ID,
    rating: 4,
    comment: "Academia bem equipada.",
    createdAt: "2026-10-26T10:00:00Z",
    updatedAt: "2026-10-26T10:00:00Z",
  };
}

function buildList(): GymReviewList {
  return {
    summary: {
      gymId: INTERNAL_GYM_ID,
      averageRating: "4.00",
      reviewCount: 1,
    },
    reviews: [buildReview()],
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

async function openDeleteConfirmation(): Promise<void> {
  await screen.findByLabelText("Excluir minha avaliação");

  await fireEvent.press(screen.getByLabelText("Excluir minha avaliação"));

  await screen.findByLabelText("Confirmar exclusão de avaliação");
}

describe("GymReviewsSection deletion", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockedTheme.mockReturnValue({
      theme: lightTheme,
    });

    mockedIdentity.mockResolvedValue({
      gymId: INTERNAL_GYM_ID,
      providerName: "geoapify",
      externalId: EXTERNAL_GYM_ID,
    });

    mockedMine.mockResolvedValue(buildReview());
    mockedReviews.mockResolvedValue(buildList());
    mockedRemove.mockResolvedValue(undefined);
  });

  it("shows the delete action for an existing own review", async () => {
    await renderSection();

    expect(
      await screen.findByLabelText("Excluir minha avaliação"),
    ).toBeTruthy();

    expect(screen.getByLabelText("Editar minha avaliação")).toBeTruthy();

    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("does not offer deletion when the user has no review", async () => {
    mockedMine.mockResolvedValue(null);

    await renderSection();

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(screen.queryByLabelText("Excluir minha avaliação")).toBeNull();

    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before deleting", async () => {
    await renderSection();
    await openDeleteConfirmation();

    expect(
      screen.getByText(
        "Excluir sua avaliação? Esta ação não pode ser desfeita.",
      ),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Cancelar exclusão de avaliação"),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    ).toBeTruthy();

    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("cancels deletion without calling the API", async () => {
    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Cancelar exclusão de avaliação"),
    );

    expect(screen.getByLabelText("Excluir minha avaliação")).toBeTruthy();

    expect(
      screen.queryByLabelText("Confirmar exclusão de avaliação"),
    ).toBeNull();

    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("deletes the review and refreshes the community summary", async () => {
    mockedMine.mockResolvedValueOnce(buildReview()).mockResolvedValueOnce(null);

    mockedReviews
      .mockResolvedValueOnce(buildList())
      .mockResolvedValueOnce(buildEmptyList());

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedRemove).toHaveBeenCalledWith(ACCESS_TOKEN, "review-123");

    expect(mockedMine).toHaveBeenCalledTimes(2);
    expect(mockedReviews).toHaveBeenCalledTimes(2);

    expect(screen.getByText("Sem nota")).toBeTruthy();

    expect(screen.getByText("0 avaliações no FitMap")).toBeTruthy();

    expect(screen.queryByLabelText("Excluir minha avaliação")).toBeNull();
  });

  it("refreshes when the review no longer exists", async () => {
    mockedRemove.mockRejectedValueOnce(
      new ApiClientError("Review not found.", 404, "gym_review_not_found"),
    );

    mockedMine.mockResolvedValueOnce(buildReview()).mockResolvedValueOnce(null);

    mockedReviews
      .mockResolvedValueOnce(buildList())
      .mockResolvedValueOnce(buildEmptyList());

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedMine).toHaveBeenCalledTimes(2);
  });

  it("shows an API error and preserves the confirmation", async () => {
    mockedRemove.mockRejectedValueOnce(
      new ApiClientError("Service unavailable.", 503, "service_unavailable"),
    );

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(
      await screen.findByText(
        "Não foi possível excluir sua avaliação. Tente novamente.",
      ),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    ).toBeTruthy();

    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedReviews).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed deletion", async () => {
    mockedRemove
      .mockRejectedValueOnce(
        new ApiClientError("Service unavailable.", 503, "service_unavailable"),
      )
      .mockResolvedValueOnce(undefined);

    mockedMine.mockResolvedValueOnce(buildReview()).mockResolvedValueOnce(null);

    mockedReviews
      .mockResolvedValueOnce(buildList())
      .mockResolvedValueOnce(buildEmptyList());

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    await screen.findByText(
      "Não foi possível excluir sua avaliação. Tente novamente.",
    );

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(mockedRemove).toHaveBeenCalledTimes(2);
    expect(mockedReviews).toHaveBeenCalledTimes(2);
  });

  it("shows a timeout-specific warning", async () => {
    mockedRemove.mockRejectedValueOnce(new Error("The request timed out."));

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(
      await screen.findByText(
        "A exclusão demorou mais do que o esperado. Confira sua avaliação antes de tentar novamente.",
      ),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    ).toBeTruthy();
  });

  it("preserves the session-expired message", async () => {
    mockedRemove.mockRejectedValueOnce(
      new Error("Sua sessão expirou. Entre novamente."),
    );

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(
      await screen.findByText("Sua sessão expirou. Entre novamente."),
    ).toBeTruthy();
  });

  it("disables confirmation while deletion is pending", async () => {
    mockedRemove.mockImplementation(() => new Promise(() => undefined));

    await renderSection();
    await openDeleteConfirmation();

    await fireEvent.press(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    );

    expect(await screen.findByText("Excluindo avaliação...")).toBeTruthy();

    expect(
      screen.getByLabelText("Confirmar exclusão de avaliação").props
        .accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(
      screen.getByLabelText("Cancelar exclusão de avaliação"),
    );

    expect(
      screen.getByLabelText("Confirmar exclusão de avaliação"),
    ).toBeTruthy();

    expect(mockedRemove).toHaveBeenCalledTimes(1);
  });

  it("does not expose deletion while the editing form is open", async () => {
    await renderSection();

    await screen.findByLabelText("Editar minha avaliação");

    await fireEvent.press(screen.getByLabelText("Editar minha avaliação"));

    expect(await screen.findByLabelText("Salvar alterações")).toBeTruthy();

    expect(screen.queryByLabelText("Excluir minha avaliação")).toBeNull();

    expect(
      screen.queryByLabelText("Confirmar exclusão de avaliação"),
    ).toBeNull();

    expect(mockedRemove).not.toHaveBeenCalled();
  });
});
