import { useFocusEffect } from "@react-navigation/native";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  RefreshCw,
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
import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import {
  getWorkoutHistory,
  type WorkoutHistoryItem,
} from "../services/trainingSessions";
import { useAppTheme } from "../theme/ThemeProvider";

type WorkoutHistoryScreenProps = AppStackScreenProps<"HistoricoTreinos">;

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

  const loadHistory = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedHistory = await runAuthenticatedRequest((accessToken) =>
        getWorkoutHistory(accessToken),
      );

      setHistory(loadedHistory);
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

      runAuthenticatedRequest((accessToken) => getWorkoutHistory(accessToken))
        .then((loadedHistory) => {
          if (active) {
            setHistory(loadedHistory);
          }
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
            onPress={() => {
              void loadHistory();
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

            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
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
        ) : (
          <View style={styles.list}>
            {history.map((item) => {
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

    inlineErrorText: {
      flex: 1,
      color: theme.colors.danger,
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
