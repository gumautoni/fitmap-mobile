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
  reportGymReview,
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
  removeGymReview: jest.fn(),
  reportGymReview: jest.fn(),
  resolveGymIdentity: jest.fn(),
  updateGymReview: jest.fn(),
}));

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: jest.fn(),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  Flag: () => null,
  MessageSquareText: () => null,
  RefreshCw: () => null,
  Send: () => null,
  Star: () => null,
}));

const mockedIdentity = resolveGymIdentity as jest.Mock;
const mockedReviews = getGymReviews as jest.Mock;
const mockedMine = getMyGymReview as jest.Mock;
const mockedReport = reportGymReview as jest.Mock;
const mockedUpdate = updateGymReview as jest.Mock;
const mockedTheme = useAppTheme as jest.Mock;

const ACCESS_TOKEN = "access-token-test";
const EXTERNAL_GYM_ID = "external-gym-123";
const INTERNAL_GYM_ID = "internal-gym-123";

function buildReview(id: string, comment: string): GymReview {
  return {
    id,
    gymId: INTERNAL_GYM_ID,
    rating: 4,
    comment,
    createdAt: "2026-10-26T10:00:00Z",
    updatedAt: "2026-10-26T10:00:00Z",
  };
}

const ownReview = buildReview("own-review-123", "Comentário próprio.");

const otherReview = buildReview(
  "other-review-456",
  "Comentário de outro usuário.",
);

function buildList(
  reviews: GymReview[] = [ownReview, otherReview],
): GymReviewList {
  return {
    summary: {
      gymId: INTERNAL_GYM_ID,
      averageRating: reviews.length > 0 ? "4.00" : null,
      reviewCount: reviews.length,
    },
    reviews,
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

async function openReportForm(): Promise<void> {
  await screen.findByLabelText("Denunciar avaliação");

  await fireEvent.press(screen.getByLabelText("Denunciar avaliação"));

  await screen.findByLabelText("Enviar denúncia");
}

async function selectSpam(): Promise<void> {
  await fireEvent.press(
    screen.getByLabelText("Selecionar motivo: Spam ou publicidade"),
  );
}

describe("GymReviewsSection reporting", () => {
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

    mockedMine.mockResolvedValue(ownReview);
    mockedReviews.mockResolvedValue(buildList());

    mockedReport.mockResolvedValue({
      id: "report-789",
      reviewId: otherReview.id,
      reason: "spam",
      createdAt: "2026-10-26T12:00:00Z",
    });

    mockedUpdate.mockResolvedValue(ownReview);
  });

  it("shows reporting only for another user's review", async () => {
    await renderSection();

    expect(await screen.findByLabelText("Denunciar avaliação")).toBeTruthy();

    expect(screen.getAllByLabelText("Denunciar avaliação")).toHaveLength(1);

    expect(screen.getByText("Comentário próprio.")).toBeTruthy();

    expect(screen.getByText("Comentário de outro usuário.")).toBeTruthy();

    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("does not allow reporting when only the own review exists", async () => {
    mockedReviews.mockResolvedValue(buildList([ownReview]));

    await renderSection();

    await screen.findByText("Comentário próprio.");

    expect(screen.queryByLabelText("Denunciar avaliação")).toBeNull();

    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("opens and cancels a report without an API request", async () => {
    await renderSection();
    await openReportForm();

    expect(screen.getByText("Denunciar avaliação")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Cancelar denúncia"));

    expect(screen.queryByLabelText("Enviar denúncia")).toBeNull();

    expect(screen.getByLabelText("Denunciar avaliação")).toBeTruthy();

    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("sends an authenticated report and marks it as submitted", async () => {
    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.changeText(
      screen.getByLabelText("Detalhes da denúncia"),
      "  Publicidade repetitiva.  ",
    );

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Denúncia enviada para análise."),
    ).toBeTruthy();

    expect(mockedReport).toHaveBeenCalledTimes(1);

    expect(mockedReport).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      "other-review-456",
      {
        reason: "spam",
        details: "Publicidade repetitiva.",
      },
    );

    expect(screen.queryByLabelText("Denunciar avaliação")).toBeNull();

    expect(screen.queryByLabelText("Enviar denúncia")).toBeNull();
  });

  it("recognizes an already reported review and blocks retry", async () => {
    mockedReport.mockRejectedValueOnce(
      new ApiClientError(
        "Review has already been reported by this user.",
        409,
        "gym_review_already_reported",
      ),
    );

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Esta avaliação já foi denunciada por você."),
    ).toBeTruthy();

    expect(screen.queryByLabelText("Denunciar avaliação")).toBeNull();
    expect(screen.queryByLabelText("Enviar denúncia")).toBeNull();
    expect(mockedReport).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a service failure", async () => {
    mockedReport.mockRejectedValueOnce(
      new ApiClientError("Service unavailable.", 503, "service_unavailable"),
    );

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText(
        "Não foi possível enviar a denúncia. Tente novamente.",
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Denúncia enviada para análise."),
    ).toBeTruthy();

    expect(mockedReport).toHaveBeenCalledTimes(2);
  });

  it("shows a validation error and keeps the form open", async () => {
    mockedReport.mockRejectedValueOnce(
      new ApiClientError("Validation failed.", 422, "request_validation_error"),
    );

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Confira o motivo e os detalhes da denúncia."),
    ).toBeTruthy();

    expect(screen.getByLabelText("Enviar denúncia")).toBeTruthy();

    expect(mockedReport).toHaveBeenCalledTimes(1);
  });

  it("shows a timeout-specific warning", async () => {
    mockedReport.mockRejectedValueOnce(new Error("The request timed out."));

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText(
        "O envio demorou mais do que o esperado. Confira antes de tentar novamente.",
      ),
    ).toBeTruthy();

    expect(screen.getByLabelText("Enviar denúncia")).toBeTruthy();
  });

  it("preserves the session-expired message", async () => {
    mockedReport.mockRejectedValueOnce(
      new Error("Sua sessão expirou. Entre novamente."),
    );

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Sua sessão expirou. Entre novamente."),
    ).toBeTruthy();
  });

  it("reloads when the reported review no longer exists", async () => {
    mockedReport.mockRejectedValueOnce(
      new ApiClientError("Review not found.", 404, "gym_review_not_found"),
    );

    mockedReviews
      .mockResolvedValueOnce(buildList())
      .mockResolvedValueOnce(buildList([ownReview]));

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    await waitFor(() => {
      expect(mockedReviews).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByLabelText("Denunciar avaliação")).toBeNull();

    expect(mockedReport).toHaveBeenCalledTimes(1);
  });

  it("blocks cancellation and repeat submission while pending", async () => {
    mockedReport.mockImplementation(() => new Promise(() => undefined));

    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(await screen.findByText("Enviando denúncia...")).toBeTruthy();

    expect(
      screen.getByLabelText("Enviar denúncia").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    await fireEvent.press(screen.getByLabelText("Cancelar denúncia"));

    expect(screen.getByText("Enviando denúncia...")).toBeTruthy();

    expect(mockedReport).toHaveBeenCalledTimes(1);
  });

  it("keeps a submitted report marked after refreshing the same gym", async () => {
    await renderSection();
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Denúncia enviada para análise."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Editar minha avaliação"));

    await screen.findByLabelText("Salvar alterações");

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    await waitFor(() => {
      expect(mockedReviews).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByText("Denúncia enviada para análise."),
    ).toBeTruthy();

    expect(mockedReport).toHaveBeenCalledTimes(1);

    expect(screen.queryByLabelText("Denunciar avaliação")).toBeNull();
  });

  it("isolates submitted reports when navigating between gyms", async () => {
    const secondExternalGymId = "external-gym-789";
    const secondInternalGymId = "internal-gym-789";

    // A reutilizacao do ID no mock verifica se o isolamento
    // depende da academia e nao apenas do identificador da avaliacao.
    const secondGymReview: GymReview = {
      ...otherReview,
      gymId: secondInternalGymId,
      comment: "Avaliação da segunda academia.",
    };

    mockedIdentity.mockImplementation(
      async (_accessToken: string, externalId: string) => ({
        gymId:
          externalId === secondExternalGymId
            ? secondInternalGymId
            : INTERNAL_GYM_ID,
        providerName: "geoapify",
        externalId,
      }),
    );

    mockedReviews.mockImplementation(
      async (_accessToken: string, gymId: string) => {
        if (gymId === secondInternalGymId) {
          return {
            summary: {
              gymId: secondInternalGymId,
              averageRating: "4.00",
              reviewCount: 1,
            },
            reviews: [secondGymReview],
          } satisfies GymReviewList;
        }

        return buildList();
      },
    );

    mockedMine.mockImplementation(
      async (_accessToken: string, gymId: string) =>
        gymId === secondInternalGymId ? null : ownReview,
    );

    const view = await renderSection();

    // Academia A: enviar uma denuncia.
    await openReportForm();
    await selectSpam();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(
      await screen.findByText("Denúncia enviada para análise."),
    ).toBeTruthy();

    expect(mockedReport).toHaveBeenCalledTimes(1);

    // Academia B: a denuncia da academia A nao pode aparecer.
    await view.rerender(
      <GymReviewsSection
        externalGymId={secondExternalGymId}
        runAuthenticatedRequest={runAuthenticatedRequest}
      />,
    );

    expect(
      await screen.findByText("Avaliação da segunda academia."),
    ).toBeTruthy();

    expect(screen.queryByText("Denúncia enviada para análise.")).toBeNull();

    expect(screen.getByLabelText("Denunciar avaliação")).toBeTruthy();

    // Retorno a academia A: preservar a denuncia enviada.
    await view.rerender(
      <GymReviewsSection
        externalGymId={EXTERNAL_GYM_ID}
        runAuthenticatedRequest={runAuthenticatedRequest}
      />,
    );

    expect(
      await screen.findByText("Comentário de outro usuário."),
    ).toBeTruthy();

    expect(screen.getByText("Denúncia enviada para análise.")).toBeTruthy();

    expect(screen.queryByLabelText("Denunciar avaliação")).toBeNull();

    // Navegar entre academias nao cria denuncias adicionais.
    expect(mockedReport).toHaveBeenCalledTimes(1);
  });
});
