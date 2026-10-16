import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  RefreshCw,
} from "lucide-react-native";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
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
import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import type { LoadUnit } from "../services/training";
import {
  getWorkoutSession,
  type SetExecution,
  type WorkoutSession,
} from "../services/trainingSessions";
import { useAppTheme } from "../theme/ThemeProvider";

type WorkoutHistoryDetailsScreenProps =
  AppStackScreenProps<"DetalhesHistoricoTreino">;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "workout_session_not_found") {
      return "Esse treino não foi encontrado no seu histórico.";
    }

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

  return "Não foi possível carregar os detalhes deste treino.";
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Data indisponível";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLoad(load: string | null, loadUnit: LoadUnit | null): string {
  if (load === null || loadUnit === null) {
    return "Sem carga";
  }

  return `${load} ${loadUnit}`;
}

function formatSet(setExecution: SetExecution): string {
  return `${setExecution.repetitions} rep. • ${formatLoad(
    setExecution.load,
    setExecution.loadUnit,
  )}`;
}

export default function WorkoutHistoryDetailsScreen({
  navigation,
  route,
}: WorkoutHistoryDetailsScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "WorkoutHistoryDetailsScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;
  const { workoutSessionId } = route.params;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedSession = await runAuthenticatedRequest((accessToken) =>
        getWorkoutSession(accessToken, workoutSessionId),
      );

      setWorkoutSession(loadedSession);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [runAuthenticatedRequest, workoutSessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!workoutSession) {
      return;
    }

    navigation.setOptions({
      title: workoutSession.workoutName,
    });
  }, [navigation, workoutSession]);

  if (loading && !workoutSession) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando treino</Text>

          <Text style={styles.centerText}>
            Recuperando os dados registrados nessa sessão.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workoutSession) {
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
            Não foi possível abrir o treino
          </Text>

          <Text style={styles.centerText}>
            {error ?? "Tente novamente em instantes."}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar treino novamente"
            onPress={() => {
              void loadSession();
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <CheckCircle2
              size={28}
              strokeWidth={2.1}
              color={theme.colors.success}
            />
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>TREINO CONCLUÍDO</Text>

            <Text style={styles.title}>{workoutSession.workoutName}</Text>

            <View style={styles.dateRow}>
              <CalendarDays
                size={16}
                strokeWidth={2}
                color={theme.colors.textMuted}
              />

              <Text style={styles.dateText}>
                {formatDateTime(workoutSession.completedAt)}
              </Text>
            </View>
          </View>
        </View>

        {workoutSession.notes ? (
          <View style={styles.sessionNotes}>
            <Text style={styles.notesLabel}>NOTAS DA SESSÃO</Text>

            <Text style={styles.notesText}>{workoutSession.notes}</Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>EXERCÍCIOS</Text>

          <Text style={styles.summaryValue}>
            {workoutSession.exercises.length}
          </Text>

          <Text style={styles.summaryDescription}>
            registrados nesta sessão
          </Text>
        </View>

        <View style={styles.exerciseList}>
          {workoutSession.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseIcon}>
                  <Dumbbell
                    size={20}
                    strokeWidth={2.1}
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.exerciseHeaderCopy}>
                  <Text style={styles.exercisePosition}>
                    EXERCÍCIO {exercise.position}
                  </Text>

                  <Text style={styles.exerciseName}>
                    {exercise.exerciseName}
                  </Text>
                </View>

                {exercise.isCompleted ? (
                  <CheckCircle2
                    size={22}
                    strokeWidth={2.2}
                    color={theme.colors.success}
                  />
                ) : null}
              </View>

              {exercise.plannedNotes ? (
                <View style={styles.plannedNotes}>
                  <Text style={styles.plannedNotesLabel}>PLANEJADO</Text>

                  <Text style={styles.plannedNotesText}>
                    {exercise.plannedNotes}
                  </Text>
                </View>
              ) : null}

              {exercise.notes ? (
                <View style={styles.executionNotes}>
                  <Text style={styles.executionNotesLabel}>
                    NOTA DA EXECUÇÃO
                  </Text>

                  <Text style={styles.executionNotesText}>
                    {exercise.notes}
                  </Text>
                </View>
              ) : null}

              <View style={styles.setSection}>
                <Text style={styles.sectionTitle}>Séries realizadas</Text>

                {exercise.sets.length === 0 ? (
                  <Text style={styles.emptySetText}>
                    Nenhuma série foi registrada para este exercício.
                  </Text>
                ) : (
                  <View style={styles.setList}>
                    {exercise.sets.map((setExecution) => (
                      <View key={setExecution.id} style={styles.setRow}>
                        <View style={styles.setNumberBadge}>
                          <Text style={styles.setNumberText}>
                            {setExecution.position}
                          </Text>
                        </View>

                        <View style={styles.setCopy}>
                          <Text style={styles.setPrimary}>
                            Série {setExecution.position}
                          </Text>

                          <Text style={styles.setSecondary}>
                            {formatSet(setExecution)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.planSnapshot}>
                <Text style={styles.planSnapshotLabel}>
                  PLANEJAMENTO ORIGINAL
                </Text>

                <Text style={styles.planSnapshotText}>
                  Séries:{" "}
                  {exercise.plannedSets === null
                    ? "livre"
                    : exercise.plannedSets}
                  {"  •  "}
                  Repetições:{" "}
                  {exercise.plannedRepetitions === null
                    ? "livre"
                    : exercise.plannedRepetitions}
                  {"  •  "}
                  Carga:{" "}
                  {formatLoad(exercise.plannedLoad, exercise.plannedLoadUnit)}
                </Text>
              </View>
            </View>
          ))}
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

    hero: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },

    heroIcon: {
      width: 54,
      height: 54,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    heroCopy: {
      flex: 1,
    },

    eyebrow: {
      color: theme.colors.success,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.5,
      marginBottom: 4,
    },

    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.screenTitle,
      lineHeight: theme.typography.lineHeight.screenTitle,
    },

    dateRow: {
      marginTop: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },

    dateText: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    sessionNotes: {
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    notesLabel: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.3,
    },

    notesText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    summaryCard: {
      marginBottom: theme.spacing.xl,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    summaryLabel: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.3,
    },

    summaryValue: {
      marginTop: 4,
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.metric,
      lineHeight: theme.typography.lineHeight.metric,
    },

    summaryDescription: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    exerciseList: {
      gap: theme.spacing.lg,
    },

    exerciseCard: {
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    exerciseIcon: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: theme.colors.primarySoft,
    },

    exerciseHeaderCopy: {
      flex: 1,
    },

    exercisePosition: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 9,
      letterSpacing: 1.2,
    },

    exerciseName: {
      marginTop: 2,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
    },

    plannedNotes: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primarySoft,
    },

    plannedNotesLabel: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 9,
      letterSpacing: 1,
    },

    plannedNotesText: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    executionNotes: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.success,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    executionNotesLabel: {
      color: theme.colors.success,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 9,
      letterSpacing: 1,
    },

    executionNotesText: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    setSection: {
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    sectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    emptySetText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
    },

    setList: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },

    setRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    setNumberBadge: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    setNumberText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    setCopy: {
      flex: 1,
    },

    setPrimary: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    setSecondary: {
      marginTop: 2,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    planSnapshot: {
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    planSnapshotLabel: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 9,
      letterSpacing: 1,
    },

    planSnapshotText: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    buttonPressed: {
      opacity: 0.72,
    },
  });
}
