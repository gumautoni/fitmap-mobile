import { useFocusEffect } from "@react-navigation/native";
import {
  AlertCircle,
  CheckCircle2,
  Dumbbell,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react-native";
import { useCallback, useContext, useMemo, useState } from "react";
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
  addExerciseToWorkout,
  createCustomExercise,
  getAvailableExercises,
  getWorkout,
  type TrainingExercise,
} from "../services/training";
import { useAppTheme } from "../theme/ThemeProvider";

type ExerciseCatalogScreenProps = AppStackScreenProps<"CatalogoExercicios">;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "workout_not_found") {
      return "Esse treino não foi encontrado.";
    }

    if (error.code === "workout_archived") {
      return "Esse treino está arquivado e não pode ser alterado.";
    }

    if (error.code === "exercise_unavailable") {
      return "Esse exercício não está disponível.";
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

function normalizeExerciseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function ExerciseCatalogScreen({
  navigation,
  route,
}: ExerciseCatalogScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "ExerciseCatalogScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;
  const { workoutId } = route.params;

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [exercises, setExercises] = useState<TrainingExercise[]>([]);
  const [workoutName, setWorkoutName] = useState("");
  const [search, setSearch] = useState("");

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const busy = addingExerciseId !== null || creatingCustom;

  const loadCatalog = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [availableExercises, workout] = await runAuthenticatedRequest(
        async (accessToken) =>
          Promise.all([
            getAvailableExercises(accessToken),
            getWorkout(accessToken, workoutId),
          ]),
      );

      const existingExerciseIds = new Set(
        workout.exercises.map((exercise) => exercise.exerciseId),
      );

      setWorkoutName(workout.name);

      setExercises(
        availableExercises.filter(
          (exercise) => !existingExerciseIds.has(exercise.id),
        ),
      );
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

      runAuthenticatedRequest(async (accessToken) =>
        Promise.all([
          getAvailableExercises(accessToken),
          getWorkout(accessToken, workoutId),
        ]),
      )
        .then(([availableExercises, workout]) => {
          if (!active) {
            return;
          }

          const existingExerciseIds = new Set(
            workout.exercises.map((exercise) => exercise.exerciseId),
          );

          setWorkoutName(workout.name);

          setExercises(
            availableExercises.filter(
              (exercise) => !existingExerciseIds.has(exercise.id),
            ),
          );
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

  const filteredExercises = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      exercise.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    );
  }, [exercises, search]);

  function toggleCustomForm(): void {
    if (busy) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    setShowCustomForm((current) => !current);

    if (showCustomForm) {
      setCustomName("");
    }
  }

  async function handleCreateCustomExercise(): Promise<void> {
    if (busy) {
      return;
    }

    const normalizedName = normalizeExerciseName(customName);

    if (!normalizedName) {
      setError("Informe um nome para o exercício personalizado.");

      return;
    }

    if (normalizedName.length > 120) {
      setError("O nome do exercício deve ter no máximo 120 caracteres.");

      return;
    }

    setCreatingCustom(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const createdExercise = await runAuthenticatedRequest((accessToken) =>
        createCustomExercise(accessToken, normalizedName),
      );

      setExercises((currentExercises) => [
        createdExercise,
        ...currentExercises.filter(
          (exercise) => exercise.id !== createdExercise.id,
        ),
      ]);

      setCustomName("");
      setShowCustomForm(false);
      setSearch(createdExercise.name);

      setSuccessMessage(
        `"${createdExercise.name}" foi criado como exercício personalizado. Agora você pode adicioná-lo ao treino.`,
      );
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setCreatingCustom(false);
    }
  }

  async function handleAddExercise(exercise: TrainingExercise): Promise<void> {
    if (busy) {
      return;
    }

    setAddingExerciseId(exercise.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        addExerciseToWorkout(accessToken, workoutId, {
          exerciseId: exercise.id,
        }),
      );

      navigation.goBack();
    } catch (addError) {
      setError(getErrorMessage(addError));
      setAddingExerciseId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando exercícios</Text>

          <Text style={styles.centerText}>
            Buscando o catálogo disponível para sua conta.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && exercises.length === 0) {
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
            Não foi possível carregar o catálogo
          </Text>

          <Text style={styles.centerText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void loadCatalog();
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CATÁLOGO FITMAP</Text>

          <Text style={styles.title}>Adicionar exercício</Text>

          <Text style={styles.subtitle}>
            Escolha um exercício para adicionar ao treino
            {workoutName ? ` "${workoutName}"` : ""}.
          </Text>
        </View>

        <View style={styles.customSection}>
          <View style={styles.customHeader}>
            <View style={styles.customHeaderCopy}>
              <Text style={styles.customEyebrow}>PERSONALIZADO</Text>

              <Text style={styles.customTitle}>Não encontrou o exercício?</Text>

              <Text style={styles.customDescription}>
                Crie um exercício privado para sua conta e use-o nos seus
                treinos.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showCustomForm
                  ? "Cancelar criação de exercício personalizado"
                  : "Criar exercício personalizado"
              }
              disabled={busy}
              onPress={toggleCustomForm}
              style={({ pressed }) => [
                styles.customToggleButton,
                showCustomForm && styles.customToggleButtonOpen,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
            >
              {showCustomForm ? (
                <X
                  size={20}
                  strokeWidth={2.4}
                  color={theme.colors.textSecondary}
                />
              ) : (
                <Plus
                  size={20}
                  strokeWidth={2.4}
                  color={theme.colors.textOnPrimary}
                />
              )}
            </Pressable>
          </View>

          {showCustomForm ? (
            <View style={styles.customForm}>
              <Text style={styles.inputLabel}>Nome do exercício</Text>

              <TextInput
                value={customName}
                onChangeText={setCustomName}
                editable={!busy}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleCreateCustomExercise();
                }}
                placeholder="Ex.: Remada unilateral no cabo"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.customInput}
              />

              <Text style={styles.customHint}>
                Esse exercício ficará disponível somente para sua conta.
              </Text>

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  void handleCreateCustomExercise();
                }}
                style={({ pressed }) => [
                  styles.createButton,
                  pressed && styles.buttonPressed,
                  busy && styles.buttonDisabled,
                ]}
              >
                {creatingCustom ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textOnPrimary}
                  />
                ) : (
                  <>
                    <Plus
                      size={18}
                      strokeWidth={2.4}
                      color={theme.colors.textOnPrimary}
                    />

                    <Text style={styles.createButtonText}>Criar exercício</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {successMessage ? (
          <View style={styles.successMessage}>
            <CheckCircle2
              size={19}
              strokeWidth={2.2}
              color={theme.colors.success}
            />

            <Text style={styles.successMessageText}>{successMessage}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.inlineError}>
            <AlertCircle
              size={18}
              strokeWidth={2.2}
              color={theme.colors.danger}
            />

            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.searchContainer}>
          <Search size={19} strokeWidth={2.2} color={theme.colors.textMuted} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Buscar exercício"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
          />

          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              disabled={busy}
              onPress={() => setSearch("")}
              hitSlop={8}
            >
              <X size={18} strokeWidth={2.2} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>DISPONÍVEIS</Text>

            <Text style={styles.sectionTitle}>Exercícios</Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {filteredExercises.length}
            </Text>
          </View>
        </View>

        {exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Dumbbell
                size={30}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Todos os exercícios já foram adicionados
            </Text>

            <Text style={styles.emptyText}>
              Você ainda pode criar um exercício personalizado para este treino.
            </Text>
          </View>
        ) : filteredExercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Search
              size={30}
              strokeWidth={1.9}
              color={theme.colors.textMuted}
            />

            <Text style={styles.emptyTitle}>Nenhum exercício encontrado</Text>

            <Text style={styles.emptyText}>
              Tente buscar por outro nome ou crie um exercício personalizado.
            </Text>
          </View>
        ) : (
          <View style={styles.exerciseList}>
            {filteredExercises.map((exercise) => {
              const adding = addingExerciseId === exercise.id;

              return (
                <View key={exercise.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseIcon}>
                    <Dumbbell
                      size={21}
                      strokeWidth={2.1}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>

                    <View style={styles.originRow}>
                      <View
                        style={[
                          styles.originBadge,
                          exercise.origin === "custom" && styles.customBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.originBadgeText,
                            exercise.origin === "custom" &&
                              styles.customBadgeText,
                          ]}
                        >
                          {exercise.origin === "catalog"
                            ? "FitMap"
                            : "Personalizado"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Adicionar ${exercise.name}`}
                    disabled={busy}
                    onPress={() => {
                      void handleAddExercise(exercise);
                    }}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.buttonPressed,
                      busy && styles.buttonDisabled,
                    ]}
                  >
                    {adding ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.textOnPrimary}
                      />
                    ) : (
                      <Plus
                        size={19}
                        strokeWidth={2.5}
                        color={theme.colors.textOnPrimary}
                      />
                    )}
                  </Pressable>
                </View>
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

    customSection: {
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    customHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    customHeaderCopy: {
      flex: 1,
    },

    customEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
      marginBottom: 3,
    },

    customTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
    },

    customDescription: {
      marginTop: theme.spacing.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    customToggleButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
    },

    customToggleButtonOpen: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    customForm: {
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    inputLabel: {
      marginBottom: 7,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    customInput: {
      minHeight: 52,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.body,
    },

    customHint: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    createButton: {
      minHeight: 48,
      marginTop: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    createButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    successMessage: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.success,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    successMessageText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    inlineError: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.surface,
    },

    inlineErrorText: {
      flex: 1,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    searchContainer: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing["2xl"],
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.body,
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
      marginTop: theme.spacing.md,
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
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    exerciseIcon: {
      width: 46,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      backgroundColor: theme.colors.primarySoft,
    },

    exerciseCopy: {
      flex: 1,
    },

    exerciseName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    originRow: {
      flexDirection: "row",
      marginTop: 6,
    },

    originBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    originBadgeText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    customBadge: {
      backgroundColor: theme.colors.surfaceSecondary,
    },

    customBadgeText: {
      color: theme.colors.textSecondary,
    },

    addButton: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
    },

    buttonPressed: {
      opacity: 0.72,
    },

    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
