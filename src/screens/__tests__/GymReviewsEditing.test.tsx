import { fireEvent, render, screen } from "@testing-library/react-native";

import { ApiClientError } from "../../services/apiClient";
import {
  getGymReviews,
  getMyGymReview,
  resolveGymIdentity,
  updateGymReview,
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
const mockedUpdate = updateGymReview as jest.Mock;
const mockedTheme = useAppTheme as jest.Mock;

const ACCESS_TOKEN = "test-access-token";
const EXTERNAL_GYM_ID = "external-gym-123";
const INTERNAL_GYM_ID = "internal-gym-123";

function buildReview(changes: Partial<GymReview> = {}): GymReview {
  return {
    id: "review-123",
    gymId: INTERNAL_GYM_ID,
    rating: 4,
    comment: "Comentário anterior.",
    createdAt: "2026-10-26T10:00:00Z",
    updatedAt: "2026-10-26T10:00:00Z",
    ...changes,
  };
}

function buildList(review: GymReview = buildReview()): GymReviewList {
  return {
    summary: {
      gymId: INTERNAL_GYM_ID,
      averageRating: `${review.rating}.00`,
      reviewCount: 1,
    },
    reviews: [review],
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

async function openEditingForm(): Promise<void> {
  await screen.findByLabelText("Editar minha avaliação");

  await fireEvent.press(screen.getByLabelText("Editar minha avaliação"));

  await screen.findByLabelText("Salvar alterações");
}

describe("GymReviewsSection editing", () => {
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
    mockedUpdate.mockResolvedValue(buildReview());
  });

  it("shows the edit action for an existing own review", async () => {
    await renderSection();

    expect(await screen.findByLabelText("Editar minha avaliação")).toBeTruthy();

    expect(
      screen.getByText("Você já avaliou esta academia no FitMap."),
    ).toBeTruthy();

    expect(screen.queryByLabelText("Publicar avaliação")).toBeNull();

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("prefills rating and comment when editing begins", async () => {
    await renderSection();
    await openEditingForm();

    expect(screen.getByText("4 de 5 estrelas")).toBeTruthy();

    expect(screen.getByLabelText("Comentário da avaliação").props.value).toBe(
      "Comentário anterior.",
    );

    expect(screen.getByLabelText("Cancelar avaliação")).toBeTruthy();

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("cancels editing without sending a PATCH request", async () => {
    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Selecionar 2 estrelas"));

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "Alteração não salva.",
    );

    await fireEvent.press(screen.getByLabelText("Cancelar avaliação"));

    expect(screen.getByLabelText("Editar minha avaliação")).toBeTruthy();

    expect(screen.queryByLabelText("Salvar alterações")).toBeNull();

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("updates rating and comment and refreshes the summary", async () => {
    const updatedReview = buildReview({
      rating: 5,
      comment: "Comentário atualizado.",
      updatedAt: "2026-10-26T12:00:00Z",
    });

    mockedUpdate.mockResolvedValue(updatedReview);

    mockedMine
      .mockResolvedValueOnce(buildReview())
      .mockResolvedValueOnce(updatedReview);

    mockedReviews
      .mockResolvedValueOnce(buildList())
      .mockResolvedValueOnce(buildList(updatedReview));

    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "  Comentário atualizado.  ",
    );

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(await screen.findByText("Comentário atualizado.")).toBeTruthy();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);

    expect(mockedUpdate).toHaveBeenCalledWith(ACCESS_TOKEN, "review-123", {
      rating: 5,
      comment: "Comentário atualizado.",
    });

    expect(mockedReviews).toHaveBeenCalledTimes(2);
    expect(mockedMine).toHaveBeenCalledTimes(2);

    expect(screen.getByText("5,0")).toBeTruthy();

    expect(screen.queryByLabelText("Salvar alterações")).toBeNull();
  });

  it("allows the user to remove only the written comment", async () => {
    const updatedReview = buildReview({
      comment: null,
    });

    mockedUpdate.mockResolvedValue(updatedReview);

    mockedMine
      .mockResolvedValueOnce(buildReview())
      .mockResolvedValueOnce(updatedReview);

    mockedReviews
      .mockResolvedValueOnce(buildList())
      .mockResolvedValueOnce(buildList(updatedReview));

    await renderSection();
    await openEditingForm();

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "   ",
    );

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(await screen.findByText("Avaliação sem comentário.")).toBeTruthy();

    expect(mockedUpdate).toHaveBeenCalledWith(ACCESS_TOKEN, "review-123", {
      rating: 4,
      comment: null,
    });

    expect(screen.getByLabelText("Editar minha avaliação")).toBeTruthy();
  });

  it("shows a validation error and preserves the editing form", async () => {
    mockedUpdate.mockRejectedValueOnce(
      new ApiClientError("Validation failed.", 422, "request_validation_error"),
    );

    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(
      await screen.findByText("Confira a nota e o comentário antes de salvar."),
    ).toBeTruthy();

    expect(screen.getByLabelText("Salvar alterações")).toBeTruthy();

    expect(mockedReviews).toHaveBeenCalledTimes(1);
  });

  it("reloads when the review no longer exists", async () => {
    mockedUpdate.mockRejectedValueOnce(
      new ApiClientError("Review not found.", 404, "gym_review_not_found"),
    );

    mockedMine.mockResolvedValueOnce(buildReview()).mockResolvedValueOnce(null);

    mockedReviews.mockResolvedValueOnce(buildList()).mockResolvedValueOnce({
      summary: {
        gymId: INTERNAL_GYM_ID,
        averageRating: null,
        reviewCount: 0,
      },
      reviews: [],
    } satisfies GymReviewList);

    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    expect(mockedMine).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Editar minha avaliação")).toBeNull();
  });

  it("shows a timeout warning while keeping editing available", async () => {
    mockedUpdate.mockRejectedValueOnce(new Error("The request timed out."));

    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(
      await screen.findByText(
        "A atualização demorou mais do que o esperado. Confira sua avaliação antes de tentar novamente.",
      ),
    ).toBeTruthy();

    expect(screen.getByLabelText("Salvar alterações")).toBeTruthy();
  });

  it("preserves the session-expired message", async () => {
    mockedUpdate.mockRejectedValueOnce(
      new Error("Sua sessão expirou. Entre novamente."),
    );

    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(
      await screen.findByText("Sua sessão expirou. Entre novamente."),
    ).toBeTruthy();

    expect(screen.getByLabelText("Salvar alterações")).toBeTruthy();
  });

  it("disables editing controls while the PATCH is pending", async () => {
    mockedUpdate.mockImplementation(() => new Promise(() => undefined));

    await renderSection();
    await openEditingForm();

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(await screen.findByText("Salvando avaliação...")).toBeTruthy();

    expect(
      screen.getByLabelText("Salvar alterações").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(
      screen.getByLabelText("Selecionar 4 estrelas").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(
      screen.getByLabelText("Comentário da avaliação").props.editable,
    ).toBe(false);

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not offer editing to users without an active review", async () => {
    mockedMine.mockResolvedValue(null);

    mockedReviews.mockResolvedValue({
      summary: {
        gymId: INTERNAL_GYM_ID,
        averageRating: null,
        reviewCount: 0,
      },
      reviews: [],
    } satisfies GymReviewList);

    await renderSection();

    expect(await screen.findByLabelText("Publicar avaliação")).toBeTruthy();

    expect(screen.queryByLabelText("Editar minha avaliação")).toBeNull();

    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});
