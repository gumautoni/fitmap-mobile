import { useFocusEffect } from "@react-navigation/native";
import { AlertCircle, Dumbbell, Plus, RefreshCw } from "lucide-react-native";
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
import { getWorkouts, type WorkoutSummary } from "../services/training";
import { useAppTheme } from "../theme/ThemeProvider";

type WorkoutsScreenProps = AppStackScreenProps<"Treinos">;

function getErrorMessage(error: unknown): string {
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

  return "Não foi possível carregar seus treinos.";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Atualização indisponível";
  }

  return `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)}`;
}

export default function WorkoutsScreen({ navigation }: WorkoutsScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("WorkoutsScreen must be rendered inside AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkouts = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedWorkouts = await runAuthenticatedRequest((accessToken) =>
        getWorkouts(accessToken),
      );

      setWorkouts(loadedWorkouts);
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

      runAuthenticatedRequest((accessToken) => getWorkouts(accessToken))
        .then((loadedWorkouts) => {
          if (!active) {
            return;
          }

          setWorkouts(loadedWorkouts);
        })
        .catch((loadError: unknown) => {
          if (!active) {
            return;
          }

          setError(getErrorMessage(loadError));
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

  if (loading && workouts.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando seus treinos</Text>

          <Text style={styles.centerText}>
            Estamos buscando seus planejamentos salvos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && workouts.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <AlertCircle
              size={34}
              strokeWidth={1.9}
              color={theme.colors.danger}
            />
          </View>

          <Text style={styles.centerTitle}>
            Não foi possível carregar seus treinos
          </Text>

          <Text style={styles.centerText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void loadWorkouts();
            }}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <RefreshCw
              size={17}
              strokeWidth={2.3}
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
          <Text style={styles.eyebrow}>PLANEJAMENTO</Text>

          <Text style={styles.title}>Meus treinos</Text>

          <Text style={styles.subtitle}>
            Organize seus treinos e mantenha sua rotina estruturada no FitMap.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Criar novo treino"
          onPress={() => navigation.navigate("NovoTreino")}
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Plus
            size={20}
            strokeWidth={2.5}
            color={theme.colors.textOnPrimary}
          />

          <Text style={styles.createButtonText}>Criar novo treino</Text>
        </Pressable>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>ATIVOS</Text>

            <Text style={styles.sectionTitle}>Treinos salvos</Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{workouts.length}</Text>
          </View>
        </View>

        {workouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Dumbbell
                size={30}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>Nenhum treino criado ainda</Text>

            <Text style={styles.emptyText}>
              Crie seu primeiro treino e depois adicione exercícios do catálogo
              FitMap.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {workouts.map((workout) => (
              <View key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutIcon}>
                  <Dumbbell
                    size={22}
                    strokeWidth={2.2}
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.workoutCopy}>
                  <Text style={styles.workoutName}>{workout.name}</Text>

                  <Text style={styles.workoutMeta}>
                    {formatUpdatedAt(workout.updatedAt)}
                  </Text>
                </View>

                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Ativo</Text>
                </View>
              </View>
            ))}
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

    createButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing["2xl"],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },

    createButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    inlineError: {
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.surface,
    },

    inlineErrorText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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

    countBadge: {
      minWidth: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    countBadgeText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
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

    list: {
      gap: theme.spacing.md,
    },

    workoutCard: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    workoutIcon: {
      width: 46,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      backgroundColor: theme.colors.primarySoft,
    },

    workoutCopy: {
      flex: 1,
    },

    workoutName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    workoutMeta: {
      marginTop: 4,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    activeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    activeBadgeText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    buttonPressed: {
      opacity: 0.72,
    },
  });
}
