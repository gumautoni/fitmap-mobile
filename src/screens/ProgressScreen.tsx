import { useFocusEffect } from "@react-navigation/native";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Dumbbell,
  RefreshCw,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthContext } from "../context/AuthContext";
import { ApiClientError } from "../services/apiClient";
import {
  getExercisePerformance,
  getProgressStatistics,
  type BasicProgressStatistics,
  type ExercisePerformance,
  type ExercisePerformancePoint,
} from "../services/progress";
import { useAppTheme } from "../theme/ThemeProvider";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "invalid_access_token") {
      return "Sua sessão expirou. Entre novamente.";
    }
  }

  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return "Não foi possível conectar ao servidor.";
    }

    if (error.message === "The request timed out.") {
      return "A conexão com o servidor demorou mais que o esperado.";
    }

    if (error.message) {
      return error.message;
    }
  }

  return "Não foi possível carregar seus dados de progresso.";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatLoadSummary(point: ExercisePerformancePoint): string {
  if (point.maxLoads.length === 0) {
    return "Carga não registrada";
  }

  return point.maxLoads
    .map((load) => `${load.maxLoad} ${load.loadUnit}`)
    .join(" • ");
}

function getLoadEvolution(performance: ExercisePerformance): string | null {
  const firstPoint = performance.points[0];
  const lastPoint = performance.points.at(-1);

  if (!firstPoint || !lastPoint) {
    return null;
  }

  const comparisons = lastPoint.maxLoads
    .map((latestLoad) => {
      const initialLoad = firstPoint.maxLoads.find(
        (load) => load.loadUnit === latestLoad.loadUnit,
      );

      if (!initialLoad) {
        return null;
      }

      return `${initialLoad.maxLoad} ${initialLoad.loadUnit} → ${latestLoad.maxLoad} ${latestLoad.loadUnit}`;
    })
    .filter((value): value is string => value !== null);

  return comparisons.length > 0 ? comparisons.join(" • ") : null;
}

export default function ProgressScreen() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("ProgressScreen must be rendered inside AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [statistics, setStatistics] = useState<BasicProgressStatistics | null>(
    null,
  );
  const [performance, setPerformance] = useState<ExercisePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [loadedStatistics, loadedPerformance] =
        await runAuthenticatedRequest((accessToken) =>
          Promise.all([
            getProgressStatistics(accessToken),
            getExercisePerformance(accessToken),
          ]),
        );

      setStatistics(loadedStatistics);
      setPerformance(loadedPerformance);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [runAuthenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      runAuthenticatedRequest((accessToken) =>
        Promise.all([
          getProgressStatistics(accessToken),
          getExercisePerformance(accessToken),
        ]),
      )
        .then(([loadedStatistics, loadedPerformance]) => {
          if (!active) {
            return;
          }

          setStatistics(loadedStatistics);
          setPerformance(loadedPerformance);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(getErrorMessage(loadError));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [runAuthenticatedRequest]),
  );

  if (loading && !statistics) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando seu progresso</Text>

          <Text style={styles.centerText}>
            Analisando seus treinos concluídos e registros de desempenho.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !statistics) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <AlertCircle
              size={32}
              strokeWidth={2}
              color={theme.colors.danger}
            />
          </View>

          <Text style={styles.centerTitle}>
            Não foi possível carregar seu progresso
          </Text>

          <Text style={styles.centerText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar progresso novamente"
            onPress={() => {
              void loadProgress();
            }}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <RefreshCw
              size={18}
              strokeWidth={2.2}
              color={theme.colors.textOnPrimary}
            />

            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACOMPANHAMENTO</Text>

          <Text style={styles.title}>Meu progresso</Text>

          <Text style={styles.subtitle}>
            Acompanhe sua frequência de treino e a evolução registrada durante
            suas execuções concluídas.
          </Text>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <AlertCircle
              size={18}
              strokeWidth={2}
              color={theme.colors.danger}
            />

            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>VISÃO GERAL</Text>

            <Text style={styles.sectionTitle}>Atividade de treino</Text>
          </View>

          <Activity size={23} strokeWidth={2.2} color={theme.colors.primary} />
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {statistics.completedWorkouts}
            </Text>

            <Text style={styles.metricLabel}>Treinos concluídos</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {statistics.completedWorkoutsLast7Days}
            </Text>

            <Text style={styles.metricLabel}>Últimos 7 dias</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {statistics.completedWorkoutsLast30Days}
            </Text>

            <Text style={styles.metricLabel}>Últimos 30 dias</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {statistics.trainingDaysLast30Days}
            </Text>

            <Text style={styles.metricLabel}>Dias de treino em 30 dias</Text>
          </View>
        </View>

        <View style={styles.setsCard}>
          <View style={styles.setsIcon}>
            <Dumbbell
              size={23}
              strokeWidth={2.2}
              color={theme.colors.primary}
            />
          </View>

          <View style={styles.setsCopy}>
            <Text style={styles.setsValue}>
              {statistics.totalPerformedSets}
            </Text>

            <Text style={styles.setsLabel}>Séries realmente realizadas</Text>
          </View>
        </View>

        {statistics.completedWorkouts === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <CalendarDays
                size={30}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Seu progresso começa no primeiro treino
            </Text>

            <Text style={styles.emptyText}>
              Quando você concluir uma execução, os dados reais desse treino
              serão utilizados para compor seus indicadores.
            </Text>
          </View>
        ) : null}

        <View style={styles.performanceSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>DESEMPENHO</Text>

              <Text style={styles.sectionTitle}>Evolução por exercício</Text>
            </View>

            <TrendingUp
              size={23}
              strokeWidth={2.2}
              color={theme.colors.primary}
            />
          </View>

          <Text style={styles.sectionDescription}>
            A evolução aparece somente quando existe histórico suficiente do
            mesmo exercício em treinos concluídos.
          </Text>

          {performance.length === 0 ? (
            <View style={styles.performanceEmptyCard}>
              <TrendingUp
                size={29}
                strokeWidth={1.9}
                color={theme.colors.textMuted}
              />

              <Text style={styles.performanceEmptyTitle}>
                Ainda não há evolução suficiente
              </Text>

              <Text style={styles.performanceEmptyText}>
                Continue registrando suas execuções. Um exercício precisa ter
                histórico em mais de um treino concluído para aparecer aqui.
              </Text>
            </View>
          ) : (
            <View style={styles.performanceList}>
              {performance.map((exercise) => {
                const firstPoint = exercise.points[0];
                const latestPoint = exercise.points.at(-1);
                const loadEvolution = getLoadEvolution(exercise);

                if (!firstPoint || !latestPoint) {
                  return null;
                }

                return (
                  <View
                    key={exercise.exerciseId}
                    style={styles.performanceCard}
                  >
                    <View style={styles.performanceCardHeader}>
                      <View style={styles.performanceIcon}>
                        <Dumbbell
                          size={21}
                          strokeWidth={2.1}
                          color={theme.colors.primary}
                        />
                      </View>

                      <View style={styles.performanceHeaderCopy}>
                        <Text style={styles.exerciseName}>
                          {exercise.exerciseName}
                        </Text>

                        <Text style={styles.exerciseSessions}>
                          {exercise.points.length} execuções comparáveis
                        </Text>
                      </View>
                    </View>

                    <View style={styles.performanceDivider} />

                    <View style={styles.performanceRow}>
                      <Text style={styles.performanceLabel}>
                        Primeiro registro
                      </Text>

                      <Text style={styles.performanceValue}>
                        {formatDate(firstPoint.completedAt)}
                      </Text>
                    </View>

                    <View style={styles.performanceRow}>
                      <Text style={styles.performanceLabel}>
                        Registro mais recente
                      </Text>

                      <Text style={styles.performanceValue}>
                        {formatDate(latestPoint.completedAt)}
                      </Text>
                    </View>

                    <View style={styles.performanceRow}>
                      <Text style={styles.performanceLabel}>
                        Séries realizadas
                      </Text>

                      <Text style={styles.performanceValue}>
                        {latestPoint.performedSets}
                      </Text>
                    </View>

                    <View style={styles.performanceRow}>
                      <Text style={styles.performanceLabel}>
                        Repetições registradas
                      </Text>

                      <Text style={styles.performanceValue}>
                        {latestPoint.totalRepetitions}
                      </Text>
                    </View>

                    <View style={styles.loadBlock}>
                      <Text style={styles.loadLabel}>
                        Carga máxima no registro mais recente
                      </Text>

                      <Text style={styles.loadValue}>
                        {formatLoadSummary(latestPoint)}
                      </Text>

                      {loadEvolution ? (
                        <View style={styles.evolutionBadge}>
                          <TrendingUp
                            size={15}
                            strokeWidth={2.2}
                            color={theme.colors.primary}
                          />

                          <Text style={styles.evolutionText}>
                            {loadEvolution}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing["4xl"],
    },

    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing["2xl"],
    },

    stateIcon: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    centerTitle: {
      marginTop: theme.spacing.lg,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      textAlign: "center",
    },

    centerText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
      textAlign: "center",
    },

    retryButton: {
      minHeight: 48,
      marginTop: theme.spacing.xl,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    retryButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    buttonPressed: {
      opacity: 0.72,
    },

    header: {
      marginBottom: theme.spacing.xl,
    },

    eyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.6,
      marginBottom: 4,
    },

    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.screenTitle,
      lineHeight: theme.typography.lineHeight.screenTitle,
      letterSpacing: -0.7,
    },

    subtitle: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },

    inlineError: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    inlineErrorText: {
      flex: 1,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },

    sectionEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.6,
      marginBottom: 3,
    },

    sectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
    },

    sectionDescription: {
      marginTop: -theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },

    metricCard: {
      width: "47.8%",
      minHeight: 116,
      justifyContent: "space-between",
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    metricValue: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.metric,
      lineHeight: theme.typography.lineHeight.metric,
    },

    metricLabel: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    setsCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing["2xl"],
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    setsIcon: {
      width: 52,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },

    setsCopy: {
      flex: 1,
    },

    setsValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
    },

    setsLabel: {
      marginTop: 3,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    emptyCard: {
      alignItems: "center",
      marginBottom: theme.spacing["2xl"],
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing["2xl"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    emptyIcon: {
      width: 62,
      height: 62,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.lg,
      borderRadius: 20,
      backgroundColor: theme.colors.primarySoft,
    },

    emptyTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
      textAlign: "center",
    },

    emptyText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    performanceSection: {
      paddingTop: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    performanceEmptyCard: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing["2xl"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    performanceEmptyTitle: {
      marginTop: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
      textAlign: "center",
    },

    performanceEmptyText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    performanceList: {
      gap: theme.spacing.md,
    },

    performanceCard: {
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    performanceCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    performanceIcon: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: theme.colors.primarySoft,
    },

    performanceHeaderCopy: {
      flex: 1,
    },

    exerciseName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyLarge,
    },

    exerciseSessions: {
      marginTop: 3,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    performanceDivider: {
      height: 1,
      marginVertical: theme.spacing.lg,
      backgroundColor: theme.colors.divider,
    },

    performanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },

    performanceLabel: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
    },

    performanceValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      textAlign: "right",
    },

    loadBlock: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    loadLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    loadValue: {
      marginTop: 4,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    evolutionBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: theme.spacing.sm,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    evolutionText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },
  });
}
