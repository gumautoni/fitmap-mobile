import { useFocusEffect } from "@react-navigation/native";
import {
  AlertCircle,
  Archive,
  Dumbbell,
  RefreshCw,
  Save,
} from "lucide-react-native";
import { useCallback, useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  archiveWorkout,
  getWorkout,
  renameWorkout,
  type Workout,
} from "../services/training";
import { useAppTheme } from "../theme/ThemeProvider";

type WorkoutDetailsScreenProps = AppStackScreenProps<"DetalhesTreino">;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "workout_not_found") {
      return "Esse treino não foi encontrado.";
    }

    if (error.code === "workout_archived") {
      return "Esse treino está arquivado e não pode ser alterado.";
    }

    if (error.code === "request_validation_error") {
      return "Confira os dados informados e tente novamente.";
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

  return "Não foi possível concluir a solicitação.";
}

function formatTarget(
  value: number | null,
  singular: string,
  plural: string,
): string {
  if (value === null) {
    return "Não definido";
  }

  return `${value} ${value === 1 ? singular : plural}`;
}

function formatLoad(load: string | null, unit: "kg" | "lb" | null): string {
  if (load === null || unit === null) {
    return "Carga não definida";
  }

  return `${load} ${unit}`;
}

export default function WorkoutDetailsScreen({
  navigation,
  route,
}: WorkoutDetailsScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "WorkoutDetailsScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;
  const { workoutId } = route.params;

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedWorkout = await runAuthenticatedRequest((accessToken) =>
        getWorkout(accessToken, workoutId),
      );

      setWorkout(loadedWorkout);
      setName(loadedWorkout.name);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [runAuthenticatedRequest, workoutId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      runAuthenticatedRequest((accessToken) =>
        getWorkout(accessToken, workoutId),
      )
        .then((loadedWorkout) => {
          if (!active) {
            return;
          }

          setWorkout(loadedWorkout);
          setName(loadedWorkout.name);
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
    }, [runAuthenticatedRequest, workoutId]),
  );

  async function handleSaveName(): Promise<void> {
    if (!workout || savingName || archiving) {
      return;
    }

    const normalizedName = name.trim().replace(/\s+/g, " ");

    if (!normalizedName) {
      Alert.alert("Nome obrigatório", "Informe um nome para o treino.");

      return;
    }

    if (normalizedName.length > 120) {
      Alert.alert(
        "Nome muito longo",
        "O nome do treino deve ter no máximo 120 caracteres.",
      );

      return;
    }

    if (normalizedName === workout.name) {
      setName(workout.name);
      return;
    }

    setSavingName(true);
    setError(null);

    try {
      const updatedWorkout = await runAuthenticatedRequest((accessToken) =>
        renameWorkout(accessToken, workout.id, normalizedName),
      );

      setWorkout(updatedWorkout);
      setName(updatedWorkout.name);
    } catch (saveError) {
      const message = getErrorMessage(saveError);

      setError(message);

      Alert.alert("Não foi possível renomear", message);
    } finally {
      setSavingName(false);
    }
  }

  function confirmArchive(): void {
    if (!workout || archiving || savingName) {
      return;
    }

    Alert.alert(
      "Arquivar treino",
      `Deseja arquivar "${workout.name}"? Ele deixará de aparecer entre seus treinos ativos.`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Arquivar",
          style: "destructive",
          onPress: () => {
            void handleArchive();
          },
        },
      ],
    );
  }

  async function handleArchive(): Promise<void> {
    if (!workout) {
      return;
    }

    setArchiving(true);
    setError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        archiveWorkout(accessToken, workout.id),
      );

      navigation.goBack();
    } catch (archiveError) {
      const message = getErrorMessage(archiveError);

      setError(message);

      Alert.alert("Não foi possível arquivar", message);
    } finally {
      setArchiving(false);
    }
  }

  if (loading && !workout) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando treino</Text>

          <Text style={styles.centerText}>
            Buscando o planejamento salvo na sua conta.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
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
            Não foi possível abrir o treino
          </Text>

          <Text style={styles.centerText}>
            {error ?? "Tente novamente em alguns instantes."}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void loadWorkout();
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

  const normalizedName = name.trim().replace(/\s+/g, " ");

  const nameChanged = normalizedName !== workout.name;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PLANEJAMENTO</Text>

          <Text style={styles.title}>{workout.name}</Text>

          <Text style={styles.subtitle}>
            Edite as informações do treino e acompanhe os exercícios adicionados
            ao planejamento.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>IDENTIFICAÇÃO</Text>

          <Text style={styles.sectionTitle}>Nome do treino</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Nome</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              editable={!savingName && !archiving}
              autoCapitalize="sentences"
              autoCorrect={false}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleSaveName();
              }}
              placeholder="Nome do treino"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />

            {nameChanged ? (
              <Pressable
                accessibilityRole="button"
                disabled={savingName || archiving}
                onPress={() => {
                  void handleSaveName();
                }}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                  (savingName || archiving) && styles.buttonDisabled,
                ]}
              >
                {savingName ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textOnPrimary}
                  />
                ) : (
                  <>
                    <Save
                      size={17}
                      strokeWidth={2.3}
                      color={theme.colors.textOnPrimary}
                    />

                    <Text style={styles.saveButtonText}>Salvar nome</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>EXERCÍCIOS</Text>

              <Text style={styles.sectionTitle}>Planejamento</Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {workout.exercises.length}
              </Text>
            </View>
          </View>

          {workout.exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Dumbbell
                  size={30}
                  strokeWidth={1.9}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>Nenhum exercício adicionado</Text>

              <Text style={styles.emptyText}>
                Este treino pode permanecer vazio enquanto estiver sendo
                configurado. A inclusão de exercícios será feita pelo catálogo
                FitMap.
              </Text>
            </View>
          ) : (
            <View style={styles.exerciseList}>
              {workout.exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseCard}>
                  <View style={styles.exercisePosition}>
                    <Text style={styles.exercisePositionText}>
                      {exercise.position}
                    </Text>
                  </View>

                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>
                      {exercise.exerciseName}
                    </Text>

                    <Text style={styles.exerciseMeta}>
                      {formatTarget(exercise.targetSets, "série", "séries")}
                      {" • "}
                      {formatTarget(
                        exercise.targetRepetitions,
                        "repetição",
                        "repetições",
                      )}
                    </Text>

                    <Text style={styles.exerciseMeta}>
                      {formatLoad(exercise.targetLoad, exercise.targetLoadUnit)}
                    </Text>

                    {exercise.notes ? (
                      <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.dangerSection}>
          <Text style={styles.sectionEyebrow}>GERENCIAMENTO</Text>

          <Text style={styles.sectionTitle}>Arquivamento</Text>

          <Text style={styles.dangerDescription}>
            Arquivar mantém o treino salvo no FitMap, mas remove-o da lista de
            treinos ativos.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={archiving || savingName}
            onPress={confirmArchive}
            style={({ pressed }) => [
              styles.archiveButton,
              pressed && styles.buttonPressed,
              (archiving || savingName) && styles.buttonDisabled,
            ]}
          >
            {archiving ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <>
                <Archive
                  size={18}
                  strokeWidth={2.2}
                  color={theme.colors.danger}
                />

                <Text style={styles.archiveButtonText}>Arquivar treino</Text>
              </>
            )}
          </Pressable>
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

    header: {
      marginBottom: theme.spacing["2xl"],
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

    section: {
      marginBottom: theme.spacing["3xl"],
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

    card: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    label: {
      marginBottom: 7,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    input: {
      minHeight: 52,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.body,
    },

    saveButton: {
      minHeight: 48,
      marginTop: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    saveButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
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

    exerciseList: {
      gap: theme.spacing.md,
    },

    exerciseCard: {
      flexDirection: "row",
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    exercisePosition: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: theme.colors.primarySoft,
    },

    exercisePositionText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    exerciseCopy: {
      flex: 1,
    },

    exerciseName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    exerciseMeta: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    exerciseNotes: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
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

    dangerSection: {
      paddingTop: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    dangerDescription: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    archiveButton: {
      minHeight: 50,
      marginTop: theme.spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    archiveButtonText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    buttonPressed: {
      opacity: 0.72,
    },

    buttonDisabled: {
      opacity: 0.55,
    },
  });
}
