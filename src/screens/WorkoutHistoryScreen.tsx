import { useFocusEffect } from "@react-navigation/native";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  RefreshCw,
  Search,
} from "lucide-react-native";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthContext } from "../context/AuthContext";
import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import {
  getWorkoutHistory,
  type WorkoutHistoryItem,
} from "../services/trainingSessions";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  DEFAULT_WORKOUT_HISTORY_FILTERS,
  filterWorkoutHistory,
  type WorkoutHistoryFilters,
  type WorkoutHistoryPeriod,
} from "../utils/workoutHistoryFilters";

type WorkoutHistoryScreenProps = AppStackScreenProps<"HistoricoTreinos">;

const HISTORY_PERIOD_OPTIONS: readonly {
  value: WorkoutHistoryPeriod;
  label: string;
  accessibilityLabel: string;
}[] = [
  {
    value: null,
    label: "Todos",
    accessibilityLabel: "Todos os períodos",
  },
  {
    value: 7,
    label: "7 dias",
    accessibilityLabel: "Últimos 7 dias",
  },
  {
    value: 30,
    label: "30 dias",
    accessibilityLabel: "Últimos 30 dias",
  },
  {
    value: 90,
    label: "90 dias",
    accessibilityLabel: "Últimos 90 dias",
  },
];

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

  return "Não foi possível carregar o histórico de treinos.";
}

function formatDateTime(value: string): string {
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

function formatDuration(startedAt: string, completedAt: string): string | null {
  const started = new Date(startedAt);
  const completed = new Date(completedAt);

  if (Number.isNaN(started.getTime()) || Number.isNaN(completed.getTime())) {
    return null;
  }

  const milliseconds = completed.getTime() - started.getTime();

  if (milliseconds < 0) {
    return null;
  }

  const totalMinutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

export default function WorkoutHistoryScreen({
  navigation,
}: WorkoutHistoryScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "WorkoutHistoryScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<WorkoutHistoryFilters>(
    DEFAULT_WORKOUT_HISTORY_FILTERS,
  );

  const requestGeneration = useRef(0);
  const focusedRef = useRef(false);

  const visibleHistory = filterWorkoutHistory(history, filters, new Date());

  const canClearFilters =
    filters.nameQuery.length > 0 || filters.periodDays !== null;

  function clearFilters(): void {
    setFilters(DEFAULT_WORKOUT_HISTORY_FILTERS);
  }

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!focusedRef.current) {
      return;
    }

    const generation = ++requestGeneration.current;

    setLoading(true);
    setError(null);

    try {
      const loadedHistory = await runAuthenticatedRequest((accessToken) =>
        getWorkoutHistory(accessToken),
      );

      if (generation === requestGeneration.current) {
        setHistory(loadedHistory);
      }
    } catch (loadError: unknown) {
      if (generation === requestGeneration.current) {
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
      }
    }
  }, [runAuthenticatedRequest]);

  function retryHistory(): void {
    void loadHistory();
  }

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;

      void loadHistory();

      return () => {
        focusedRef.current = false;
        requestGeneration.current += 1;
      };
    }, [loadHistory]),
  );

  if (loading && history.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando seu histórico</Text>

          <Text style={styles.centerText}>
            Buscando os treinos que você já concluiu.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && history.length === 0) {
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
            Não foi possível carregar o histórico
          </Text>

          <Text style={styles.centerText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar histórico novamente"
            onPress={retryHistory}
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>EXECUÇÕES CONCLUÍDAS</Text>

          <Text style={styles.title}>Histórico de treinos</Text>

          <Text style={styles.subtitle}>
            Consulte os exercícios, séries, repetições e cargas realmente
            registrados em cada treino.
          </Text>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <AlertCircle
              size={18}
              strokeWidth={2}
              color={theme.colors.danger}
            />

            <View style={styles.inlineErrorCopy}>
              <Text style={styles.inlineErrorText}>{error}</Text>

              <Text style={styles.refreshStatus}>
                Exibindo os dados carregados anteriormente.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar histórico novamente"
                onPress={retryHistory}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.clearButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {loading && history.length > 0 ? (
          <Text style={styles.refreshStatus} accessibilityLiveRegion="polite">
            Atualizando histórico...
          </Text>
        ) : null}

        {history.length > 0 ? (
          <>
            <View style={styles.filterCard}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>Filtrar histórico</Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Limpar filtros do histórico"
                  accessibilityState={{ disabled: !canClearFilters }}
                  disabled={!canClearFilters}
                  onPress={clearFilters}
                  style={({ pressed }) => [
                    styles.clearButton,
                    !canClearFilters && styles.clearButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.clearButtonText}>Limpar filtros</Text>
                </Pressable>
              </View>

              <Text style={styles.filterLabel}>Nome do treino</Text>

              <View style={styles.searchField}>
                <Search
                  size={19}
                  strokeWidth={2}
                  color={theme.colors.textSecondary}
                />

                <TextInput
                  accessibilityLabel="Buscar histórico pelo nome do treino"
                  value={filters.nameQuery}
                  onChangeText={(nameQuery) =>
                    setFilters((current) => ({
                      ...current,
                      nameQuery,
                    }))
                  }
                  placeholder="Buscar pelo nome do treino"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={styles.searchInput}
                />
              </View>

              <Text style={styles.filterLabel}>Período</Text>

              <View style={styles.periodOptions}>
                {HISTORY_PERIOD_OPTIONS.map((option) => {
                  const selected = filters.periodDays === option.value;

                  return (
                    <Pressable
                      key={option.label}
                      accessibilityRole="button"
                      accessibilityLabel={option.accessibilityLabel}
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setFilters((current) => ({
                          ...current,
                          periodDays: option.value,
                        }))
                      }
                      style={({ pressed }) => [
                        styles.periodButton,
                        selected && styles.periodButtonSelected,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodButtonText,
                          selected && styles.periodButtonTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text
              testID="workout-history-results-count"
              accessibilityLiveRegion="polite"
              style={styles.resultsCount}
            >
              {visibleHistory.length}{" "}
              {visibleHistory.length === 1
                ? "treino encontrado"
                : "treinos encontrados"}
            </Text>
          </>
        ) : null}

        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Dumbbell
                size={30}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>Nenhum treino concluído</Text>

            <Text style={styles.emptyText}>
              Quando você finalizar um treino, ele aparecerá aqui com todos os
              dados registrados durante a execução.
            </Text>
          </View>
        ) : visibleHistory.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Search
                size={30}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>Nenhum treino encontrado</Text>

            <Text style={styles.emptyText}>
              Nenhum treino corresponde aos filtros selecionados. Experimente
              alterar ou limpar os filtros.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleHistory.map((item) => {
              const duration = formatDuration(item.startedAt, item.completedAt);

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir histórico do treino ${item.workoutName}`}
                  onPress={() =>
                    navigation.navigate("DetalhesHistoricoTreino", {
                      workoutSessionId: item.id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.historyCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.historyIcon}>
                    <CalendarDays
                      size={22}
                      strokeWidth={2.1}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={styles.historyCopy}>
                    <Text style={styles.workoutName}>{item.workoutName}</Text>

                    <Text style={styles.dateText}>
                      {formatDateTime(item.completedAt)}
                    </Text>

                    {duration ? (
                      <Text style={styles.durationText}>
                        Duração: {duration}
                      </Text>
                    ) : null}
                  </View>

                  <ChevronRight
                    size={20}
                    strokeWidth={2.2}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
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

    header: {
      marginBottom: theme.spacing.xl,
    },

    eyebrow: {
      color: theme.colors.primary,
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

    inlineErrorCopy: {
      flex: 1,
    },

    inlineErrorText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    refreshStatus: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    filterCard: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    filterHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },

    filterTitle: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.body,
    },

    clearButton: {
      minHeight: 48,
      alignSelf: "flex-start",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
    },

    clearButtonDisabled: {
      opacity: 0.45,
    },

    clearButtonText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    filterLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    searchField: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    searchInput: {
      flex: 1,
      minHeight: 48,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
    },

    periodOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },

    periodButton: {
      minHeight: 48,
      flexShrink: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    periodButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },

    periodButtonText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    periodButtonTextSelected: {
      color: theme.colors.textOnPrimary,
    },

    resultsCount: {
      marginBottom: theme.spacing.md,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    emptyCard: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing["3xl"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    emptyIcon: {
      width: 64,
      height: 64,
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

    list: {
      gap: theme.spacing.md,
    },

    historyCard: {
      minHeight: 92,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    cardPressed: {
      opacity: 0.72,
      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    historyIcon: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: theme.colors.primarySoft,
    },

    historyCopy: {
      flex: 1,
    },

    workoutName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyLarge,
    },

    dateText: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    durationText: {
      marginTop: 3,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    buttonPressed: {
      opacity: 0.72,
    },
  });
}
