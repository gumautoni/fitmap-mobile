import {
  AlertCircle,
  MessageSquareText,
  RefreshCw,
  Star,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiClientError } from "../services/apiClient";
import {
  createGymReview,
  getGymReviews,
  getMyGymReview,
  removeGymReview,
  reportGymReview,
  resolveGymIdentity,
  updateGymReview,
  type CreateGymReviewInput,
  type CreateGymReviewReportInput,
  type GymReview,
  type GymReviewList,
} from "../services/gymReviews";
import { useAppTheme } from "../theme/ThemeProvider";
import GymReviewForm from "./GymReviewForm";
import GymReviewReportForm from "./GymReviewReportForm";

interface Props {
  externalGymId: string;
  runAuthenticatedRequest: <T>(
    request: (accessToken: string) => Promise<T>,
  ) => Promise<T>;
}

function getLoadingErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "gym_not_found") {
      return "As avaliações desta academia não estão disponíveis.";
    }

    if (error.code === "gym_provider_unavailable") {
      return "O serviço de academias está indisponível no momento.";
    }
  }

  if (error instanceof Error) {
    if (error.message === "Sua sessão expirou. Entre novamente.") {
      return error.message;
    }

    if (error.message === "The request timed out.") {
      return "O carregamento das avaliações demorou mais do que o esperado.";
    }
  }

  return "Não foi possível carregar as avaliações. Tente novamente.";
}

function getCreationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "request_validation_error") {
      return "Confira a nota e o comentário antes de publicar.";
    }

    return "Não foi possível publicar sua avaliação. Tente novamente.";
  }

  if (error instanceof Error) {
    if (error.message === "Sua sessão expirou. Entre novamente.") {
      return error.message;
    }

    if (error.message === "The request timed out.") {
      return "A publicação demorou mais do que o esperado. Confira suas avaliações antes de tentar novamente.";
    }
  }

  return "Não foi possível publicar sua avaliação. Verifique a conexão.";
}
function getUpdateErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "request_validation_error") {
      return "Confira a nota e o comentário antes de salvar.";
    }

    return "Não foi possível atualizar sua avaliação. Tente novamente.";
  }

  if (error instanceof Error) {
    if (error.message === "Sua sessão expirou. Entre novamente.") {
      return error.message;
    }

    if (error.message === "The request timed out.") {
      return "A atualização demorou mais do que o esperado. Confira sua avaliação antes de tentar novamente.";
    }
  }

  return "Não foi possível atualizar sua avaliação. Verifique a conexão.";
}
function getDeletionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "Sua sessão expirou. Entre novamente.") {
      return error.message;
    }

    if (error.message === "The request timed out.") {
      return "A exclusão demorou mais do que o esperado. Confira sua avaliação antes de tentar novamente.";
    }
  }

  if (error instanceof ApiClientError) {
    return "Não foi possível excluir sua avaliação. Tente novamente.";
  }

  return "Não foi possível excluir sua avaliação. Verifique a conexão.";
}
function getReportErrorMessage(error: unknown): string {
  if (
    error instanceof ApiClientError &&
    error.code === "request_validation_error"
  ) {
    return "Confira o motivo e os detalhes da denúncia.";
  }

  if (error instanceof Error) {
    if (error.message === "Sua sessão expirou. Entre novamente.") {
      return error.message;
    }

    if (error.message === "The request timed out.") {
      return "O envio demorou mais do que o esperado. Confira antes de tentar novamente.";
    }
  }

  if (error instanceof ApiClientError) {
    return "Não foi possível enviar a denúncia. Tente novamente.";
  }

  return "Não foi possível enviar a denúncia. Verifique a conexão.";
}
function RatingStars({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={15}
          strokeWidth={2}
          color={color}
          fill={star <= rating ? color : "none"}
        />
      ))}
    </View>
  );
}

export default function GymReviewsSection({
  externalGymId,
  runAuthenticatedRequest,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [reviewData, setReviewData] = useState<GymReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<GymReview | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [reviewDeleteError, setReviewDeleteError] = useState<string | null>(
    null,
  );
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(
    null,
  );
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null,
  );
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedIdsByGym, setReportedIdsByGym] = useState<
    Record<string, string[]>
  >({});
  const [alreadyReportedIdsByGym, setAlreadyReportedIdsByGym] = useState<
    Record<string, string[]>
  >({});
  const reportedReviewIds = reportedIdsByGym[externalGymId] ?? [];

  useEffect(() => {
    let active = true;

    async function loadReviews(): Promise<void> {
      setLoading(true);
      setErrorMessage(null);
      setReviewData(null);
      setResolvedGymId(null);
      setMyReview(null);
      setIsEditing(false);
      setConfirmingDelete(false);
      setReviewDeleteError(null);
      setReviewSubmitError(null);
      setReportingReviewId(null);
      setReportError(null);

      try {
        const result = await runAuthenticatedRequest(async (accessToken) => {
          const identity = await resolveGymIdentity(accessToken, externalGymId);

          const [reviews, ownReview] = await Promise.all([
            getGymReviews(accessToken, identity.gymId),
            getMyGymReview(accessToken, identity.gymId),
          ]);

          return {
            gymId: identity.gymId,
            reviews,
            ownReview,
          };
        });

        if (active) {
          setResolvedGymId(result.gymId);
          setMyReview(result.ownReview);
          setReviewData(result.reviews);
        }
      } catch (error: unknown) {
        if (active) {
          setErrorMessage(getLoadingErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [externalGymId, reloadVersion, runAuthenticatedRequest]);

  async function submitReview(input: CreateGymReviewInput): Promise<void> {
    if (!resolvedGymId || reviewSubmitting || myReview) {
      return;
    }

    setReviewSubmitting(true);
    setReviewSubmitError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        createGymReview(accessToken, resolvedGymId, input),
      );

      setReloadVersion((version) => version + 1);
    } catch (error: unknown) {
      if (
        error instanceof ApiClientError &&
        error.code === "gym_review_already_exists"
      ) {
        setReloadVersion((version) => version + 1);
        return;
      }

      setReviewSubmitError(getCreationErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }
  async function submitEditedReview(
    input: CreateGymReviewInput,
  ): Promise<void> {
    if (!myReview || !isEditing || reviewSubmitting || loading) {
      return;
    }

    setReviewSubmitting(true);
    setReviewSubmitError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        updateGymReview(accessToken, myReview.id, input),
      );

      setIsEditing(false);
      setReloadVersion((version) => version + 1);
    } catch (error: unknown) {
      if (
        error instanceof ApiClientError &&
        error.code === "gym_review_not_found"
      ) {
        setIsEditing(false);
        setReloadVersion((version) => version + 1);
        return;
      }

      setReviewSubmitError(getUpdateErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }
  async function deleteOwnReview(): Promise<void> {
    if (
      !myReview ||
      !confirmingDelete ||
      deletingReview ||
      reviewSubmitting ||
      loading
    ) {
      return;
    }

    setDeletingReview(true);
    setReviewDeleteError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        removeGymReview(accessToken, myReview.id),
      );

      setConfirmingDelete(false);
      setReloadVersion((version) => version + 1);
    } catch (error: unknown) {
      if (
        error instanceof ApiClientError &&
        error.code === "gym_review_not_found"
      ) {
        setConfirmingDelete(false);
        setReloadVersion((version) => version + 1);
        return;
      }

      setReviewDeleteError(getDeletionErrorMessage(error));
    } finally {
      setDeletingReview(false);
    }
  }
  async function submitReviewReport(
    reviewId: string,
    input: CreateGymReviewReportInput,
  ): Promise<void> {
    if (
      loading ||
      !reviewData ||
      !resolvedGymId ||
      reportingReviewId !== reviewId ||
      reportSubmitting ||
      reportedReviewIds.includes(reviewId) ||
      myReview?.id === reviewId ||
      !reviewData.reviews.some((review) => review.id === reviewId)
    ) {
      return;
    }

    setReportSubmitting(true);
    setReportError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        reportGymReview(accessToken, reviewId, input),
      );

      setReportedIdsByGym((current) => {
        const previousIds = current[externalGymId] ?? [];

        return previousIds.includes(reviewId)
          ? current
          : {
              ...current,
              [externalGymId]: [...previousIds, reviewId],
            };
      });
      setReportingReviewId(null);
    } catch (error: unknown) {
      if (
        error instanceof ApiClientError &&
        error.code === "gym_review_not_found"
      ) {
        setReportingReviewId(null);
        setReloadVersion((version) => version + 1);
        return;
      }

      if (
        error instanceof ApiClientError &&
        error.status === 409 &&
        error.code === "gym_review_already_reported"
      ) {
        setReportedIdsByGym((current) => {
          const previousIds = current[externalGymId] ?? [];

          return previousIds.includes(reviewId)
            ? current
            : {
                ...current,
                [externalGymId]: [...previousIds, reviewId],
              };
        });

        setAlreadyReportedIdsByGym((current) => {
          const previousIds = current[externalGymId] ?? [];

          return previousIds.includes(reviewId)
            ? current
            : {
                ...current,
                [externalGymId]: [...previousIds, reviewId],
              };
        });

        setReportingReviewId(null);
        return;
      }

      setReportError(getReportErrorMessage(error));
    } finally {
      setReportSubmitting(false);
    }
  }
  const summary = reviewData?.summary;

  const averageText =
    summary?.averageRating !== null && summary?.averageRating !== undefined
      ? Number(summary.averageRating).toFixed(1).replace(".", ",")
      : null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>COMUNIDADE FITMAP</Text>

        <Text style={styles.title}>Avaliações da academia</Text>

        <Text style={styles.subtitle}>
          Opiniões compartilhadas por usuários do FitMap.
        </Text>
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={theme.colors.primary} />

          <Text style={styles.stateText}>Carregando notas e avaliações...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <AlertCircle
            size={23}
            strokeWidth={2.1}
            color={theme.colors.danger}
          />

          <Text style={styles.stateText}>{errorMessage}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar avaliações novamente"
            onPress={() => {
              setReloadVersion((version) => version + 1);
            }}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
          >
            <RefreshCw
              size={15}
              strokeWidth={2.2}
              color={theme.colors.primary}
            />

            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : reviewData && summary ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Star
                size={24}
                strokeWidth={2}
                color={theme.colors.warning}
                fill={theme.colors.warning}
              />
            </View>

            <View style={styles.summaryCopy}>
              <Text style={styles.average}>{averageText ?? "Sem nota"}</Text>

              <Text style={styles.summaryDescription}>
                {summary.reviewCount === 1
                  ? "1 avaliação no FitMap"
                  : `${summary.reviewCount} avaliações no FitMap`}
              </Text>
            </View>
          </View>

          {resolvedGymId ? (
            <View style={styles.formContainer}>
              {myReview ? (
                isEditing ? (
                  <GymReviewForm
                    key={myReview.id}
                    initialRating={myReview.rating}
                    initialComment={myReview.comment}
                    submitting={reviewSubmitting}
                    submitLabel="Salvar alterações"
                    errorMessage={reviewSubmitError}
                    onSubmit={(input) => {
                      void submitEditedReview(input);
                    }}
                    onCancel={() => {
                      setIsEditing(false);
                      setReviewSubmitError(null);
                    }}
                  />
                ) : (
                  <View style={styles.ownReviewNotice}>
                    <Text style={styles.ownReviewText}>
                      Você já avaliou esta academia no FitMap.
                    </Text>

                    {reviewDeleteError ? (
                      <Text style={styles.deleteErrorText}>
                        {reviewDeleteError}
                      </Text>
                    ) : null}

                    {confirmingDelete ? (
                      <View style={styles.deleteConfirmation}>
                        <Text style={styles.deleteConfirmationText}>
                          Excluir sua avaliação? Esta ação não pode ser
                          desfeita.
                        </Text>

                        <View style={styles.deleteActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Cancelar exclusão de avaliação"
                            disabled={deletingReview}
                            onPress={() => {
                              setConfirmingDelete(false);
                              setReviewDeleteError(null);
                            }}
                            style={({ pressed }) => [
                              styles.deleteCancelButton,
                              pressed && styles.retryButtonPressed,
                            ]}
                          >
                            <Text style={styles.deleteCancelText}>
                              Cancelar
                            </Text>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Confirmar exclusão de avaliação"
                            accessibilityState={{ disabled: deletingReview }}
                            disabled={deletingReview}
                            onPress={() => {
                              void deleteOwnReview();
                            }}
                            style={({ pressed }) => [
                              styles.deleteConfirmButton,
                              deletingReview && styles.deleteButtonDisabled,
                              pressed &&
                                !deletingReview &&
                                styles.retryButtonPressed,
                            ]}
                          >
                            <Text style={styles.deleteConfirmText}>
                              {deletingReview
                                ? "Excluindo avaliação..."
                                : "Excluir definitivamente"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.ownReviewActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Editar minha avaliação"
                          disabled={reviewSubmitting || deletingReview}
                          onPress={() => {
                            setReviewSubmitError(null);
                            setIsEditing(true);
                          }}
                          style={({ pressed }) => [
                            styles.editReviewButton,
                            pressed && styles.retryButtonPressed,
                          ]}
                        >
                          <Text style={styles.editReviewButtonText}>
                            Editar avaliação
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Excluir minha avaliação"
                          disabled={reviewSubmitting || deletingReview}
                          onPress={() => {
                            setReviewDeleteError(null);
                            setConfirmingDelete(true);
                          }}
                          style={({ pressed }) => [
                            styles.deleteReviewButton,
                            pressed && styles.retryButtonPressed,
                          ]}
                        >
                          <Text style={styles.deleteReviewButtonText}>
                            Excluir avaliação
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )
              ) : (
                <GymReviewForm
                  submitting={reviewSubmitting}
                  errorMessage={reviewSubmitError}
                  onSubmit={(input) => {
                    void submitReview(input);
                  }}
                />
              )}
            </View>
          ) : null}
          {reviewData.reviews.length === 0 ? (
            <View style={styles.stateCard}>
              <MessageSquareText
                size={25}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />

              <Text style={styles.emptyTitle}>Nenhuma avaliação ainda</Text>

              <Text style={styles.stateText}>
                Esta academia ainda não recebeu avaliações da comunidade FitMap.
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {reviewData.reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <RatingStars
                      rating={review.rating}
                      color={theme.colors.warning}
                    />

                    <Text style={styles.reviewRating}>{review.rating}/5</Text>
                  </View>

                  {review.comment ? (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  ) : (
                    <Text style={styles.noComment}>
                      Avaliação sem comentário.
                    </Text>
                  )}

                  {myReview?.id !== review.id ? (
                    reportedReviewIds.includes(review.id) ? (
                      <Text style={styles.reportSuccessText}>
                        {alreadyReportedIdsByGym[externalGymId]?.includes(
                          review.id,
                        )
                          ? "Esta avaliação já foi denunciada por você."
                          : "Denúncia enviada para análise."}
                      </Text>
                    ) : reportingReviewId === review.id ? (
                      <View style={styles.reportFormContainer}>
                        <GymReviewReportForm
                          submitting={reportSubmitting}
                          errorMessage={reportError}
                          onSubmit={(input) => {
                            void submitReviewReport(review.id, input);
                          }}
                          onCancel={() => {
                            setReportingReviewId(null);
                            setReportError(null);
                          }}
                        />
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Denunciar avaliação"
                        disabled={
                          reportingReviewId !== null || reportSubmitting
                        }
                        onPress={() => {
                          setReportError(null);
                          setReportingReviewId(review.id);
                        }}
                        style={({ pressed }) => [
                          styles.reportButton,
                          pressed && styles.retryButtonPressed,
                        ]}
                      >
                        <Text style={styles.reportButtonText}>Denunciar</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    section: {
      marginBottom: theme.spacing["2xl"],
    },
    header: {
      marginBottom: theme.spacing.lg,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      marginTop: 6,
    },
    stateCard: {
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stateText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      textAlign: "center",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primarySoft,
    },
    retryButtonPressed: {
      opacity: 0.7,
    },
    retryText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    summaryIcon: {
      width: 50,
      height: 50,
      borderRadius: theme.radii.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceSecondary,
    },
    summaryCopy: {
      flex: 1,
    },
    average: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 25,
    },
    summaryDescription: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      marginTop: 2,
    },
    formContainer: {
      marginBottom: theme.spacing.lg,
    },
    ownReviewNotice: {
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primarySoft,
    },
    ownReviewText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    editReviewButton: {
      alignSelf: "flex-start",
      minHeight: 42,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    editReviewButtonText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    ownReviewActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    deleteReviewButton: {
      minHeight: 42,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.surface,
    },
    deleteReviewButtonText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    deleteConfirmation: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    deleteConfirmationText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    deleteActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    deleteCancelButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    deleteCancelText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    deleteConfirmButton: {
      minHeight: 44,
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.danger,
    },
    deleteConfirmText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    deleteErrorText: {
      marginTop: theme.spacing.md,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    deleteButtonDisabled: {
      opacity: 0.65,
    },
    reviewsList: {
      gap: theme.spacing.md,
    },
    reviewCard: {
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    reviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    reviewRating: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    reviewComment: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    reportButton: {
      alignSelf: "flex-start",
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },
    reportButtonText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    reportFormContainer: {
      marginTop: theme.spacing.md,
    },
    reportSuccessText: {
      marginTop: theme.spacing.md,
      color: theme.colors.success,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    noComment: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      fontStyle: "italic",
    },
  });
}
