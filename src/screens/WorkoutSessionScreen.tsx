import {
  AlertCircle,
  Check,
  Dumbbell,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react-native";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import type { LoadUnit } from "../services/training";
import {
  addSetExecution,
  cancelWorkoutSession,
  finishWorkoutSession,
  getActiveWorkoutSession,
  getWorkoutSession,
  removeSetExecution,
  startWorkoutSession,
  updateExerciseExecution,
  type CreateSetExecutionInput,
  type ExerciseExecution,
  type SetExecution,
  type WorkoutSession,
} from "../services/trainingSessions";
import { useAppTheme } from "../theme/ThemeProvider";

type WorkoutSessionScreenProps = AppStackScreenProps<"ExecutarTreino">;

interface SetDraft {
  repetitions: string;
  load: string;
  loadUnit: LoadUnit;
}

type DraftMap = Record<string, SetDraft>;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "workout_not_found":
        return "Esse treino não foi encontrado.";

      case "workout_session_source_empty":
        return "Adicione pelo menos um exercício antes de iniciar o treino.";

      case "workout_session_source_unavailable":
        return "Esse treino não está disponível para iniciar uma sessão.";

      case "active_workout_session_exists":
        return "Já existe um treino em andamento.";

      case "workout_session_not_found":
        return "Essa sessão de treino não foi encontrada.";

      case "workout_session_not_active":
        return "Essa sessão já foi encerrada e não pode mais ser alterada.";

      case "exercise_execution_not_found":
        return "Esse exercício não foi encontrado na sessão.";

      case "set_execution_not_found":
        return "Essa série não foi encontrada.";

      case "request_validation_error":
        return "Confira os dados informados e tente novamente.";

      default:
        return "Não foi possível concluir a solicitação.";
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

function buildDefaultDraft(exercise: ExerciseExecution): SetDraft {
  return {
    repetitions:
      exercise.plannedRepetitions === null
        ? ""
        : String(exercise.plannedRepetitions),
    load: exercise.plannedLoad ?? "",
    loadUnit: exercise.plannedLoadUnit ?? "kg",
  };
}

function hydrateDrafts(
  current: DraftMap,
  workoutSession: WorkoutSession,
): DraftMap {
  const next = { ...current };

  for (const exercise of workoutSession.exercises) {
    if (!next[exercise.id]) {
      next[exercise.id] = buildDefaultDraft(exercise);
    }
  }

  return next;
}

function formatPlannedSets(value: number | null): string {
  if (value === null) {
    return "Séries livres";
  }

  return `${value} ${value === 1 ? "série" : "séries"}`;
}

function formatPlannedRepetitions(value: number | null): string {
  if (value === null) {
    return "Repetições livres";
  }

  return `${value} rep.`;
}

function formatPlannedLoad(
  load: string | null,
  loadUnit: LoadUnit | null,
): string {
  if (load === null || loadUnit === null) {
    return "Carga livre";
  }

  return `${load} ${loadUnit}`;
}

function formatRecordedLoad(setExecution: SetExecution): string {
  if (setExecution.load === null || setExecution.loadUnit === null) {
    return "Sem carga";
  }

  return `${setExecution.load} ${setExecution.loadUnit}`;
}

export default function WorkoutSessionScreen({
  navigation,
  route,
}: WorkoutSessionScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "WorkoutSessionScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;
  const { workoutId } = route.params;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const initializedRef = useRef(false);

  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(
    null,
  );
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [busyExerciseId, setBusyExerciseId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resumedDifferentWorkout, setResumedDifferentWorkout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = busyExerciseId !== null || finishing || cancelling;

  const applyWorkoutSession = useCallback(
    (nextWorkoutSession: WorkoutSession): void => {
      setWorkoutSession(nextWorkoutSession);
      setDrafts((current) => hydrateDrafts(current, nextWorkoutSession));
    },
    [],
  );

  const loadOrStartSession = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const activeSession = await runAuthenticatedRequest((accessToken) =>
        getActiveWorkoutSession(accessToken),
      );

      if (activeSession) {
        setResumedDifferentWorkout(activeSession.sourceWorkoutId !== workoutId);
        applyWorkoutSession(activeSession);

        return;
      }

      const startedSession = await runAuthenticatedRequest((accessToken) =>
        startWorkoutSession(accessToken, workoutId),
      );

      setResumedDifferentWorkout(false);
      applyWorkoutSession(startedSession);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [applyWorkoutSession, runAuthenticatedRequest, workoutId]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    void loadOrStartSession();
  }, [loadOrStartSession]);

  useEffect(() => {
    if (!workoutSession) {
      return;
    }

    navigation.setOptions({
      title: workoutSession.workoutName,
    });
  }, [navigation, workoutSession]);

  function updateDraft(
    exercise: ExerciseExecution,
    updates: Partial<SetDraft>,
  ): void {
    setDrafts((current) => ({
      ...current,
      [exercise.id]: {
        ...(current[exercise.id] ?? buildDefaultDraft(exercise)),
        ...updates,
      },
    }));
  }

  async function handleAddSet(exercise: ExerciseExecution): Promise<void> {
    if (!workoutSession || busy) {
      return;
    }

    const draft = drafts[exercise.id] ?? buildDefaultDraft(exercise);
    const repetitionsValue = draft.repetitions.trim();

    if (!/^\d+$/.test(repetitionsValue)) {
      Alert.alert(
        "Repetições inválidas",
        "Informe uma quantidade válida de repetições.",
      );

      return;
    }

    const repetitions = Number(repetitionsValue);

    if (!Number.isInteger(repetitions) || repetitions < 1) {
      Alert.alert(
        "Repetições inválidas",
        "A quantidade de repetições deve ser maior que zero.",
      );

      return;
    }

    const normalizedLoad = draft.load.trim().replace(",", ".");

    const input: CreateSetExecutionInput = {
      repetitions,
    };

    if (normalizedLoad) {
      const loadValue = Number(normalizedLoad);

      if (!Number.isFinite(loadValue) || loadValue < 0) {
        Alert.alert(
          "Carga inválida",
          "Informe uma carga válida ou deixe o campo vazio.",
        );

        return;
      }

      input.load = normalizedLoad;
      input.loadUnit = draft.loadUnit;
    }

    setBusyExerciseId(exercise.id);
    setError(null);

    try {
      const updatedSession = await runAuthenticatedRequest((accessToken) =>
        addSetExecution(accessToken, workoutSession.id, exercise.id, input),
      );

      applyWorkoutSession(updatedSession);
    } catch (addError) {
      const message = getErrorMessage(addError);

      setError(message);

      Alert.alert("Não foi possível registrar a série", message);
    } finally {
      setBusyExerciseId(null);
    }
  }

  async function handleToggleExercise(
    exercise: ExerciseExecution,
  ): Promise<void> {
    if (!workoutSession || busy) {
      return;
    }

    setBusyExerciseId(exercise.id);
    setError(null);

    try {
      const updatedSession = await runAuthenticatedRequest((accessToken) =>
        updateExerciseExecution(accessToken, workoutSession.id, exercise.id, {
          completed: !exercise.isCompleted,
        }),
      );

      applyWorkoutSession(updatedSession);
    } catch (updateError) {
      const message = getErrorMessage(updateError);

      setError(message);

      Alert.alert("Não foi possível atualizar o exercício", message);
    } finally {
      setBusyExerciseId(null);
    }
  }

  function confirmRemoveSet(
    exercise: ExerciseExecution,
    setExecution: SetExecution,
  ): void {
    if (busy) {
      return;
    }

    Alert.alert(
      "Remover série",
      `Deseja remover a série ${setExecution.position}?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            void handleRemoveSet(exercise, setExecution);
          },
        },
      ],
    );
  }

  async function handleRemoveSet(
    exercise: ExerciseExecution,
    setExecution: SetExecution,
  ): Promise<void> {
    if (!workoutSession) {
      return;
    }

    setBusyExerciseId(exercise.id);
    setError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        removeSetExecution(
          accessToken,
          workoutSession.id,
          exercise.id,
          setExecution.id,
        ),
      );

      const refreshedSession = await runAuthenticatedRequest((accessToken) =>
        getWorkoutSession(accessToken, workoutSession.id),
      );

      applyWorkoutSession(refreshedSession);
    } catch (removeError) {
      const message = getErrorMessage(removeError);

      setError(message);

      Alert.alert("Não foi possível remover a série", message);
    } finally {
      setBusyExerciseId(null);
    }
  }

  function confirmFinish(): void {
    if (!workoutSession || busy) {
      return;
    }

    const incompleteCount = workoutSession.exercises.filter(
      (exercise) => !exercise.isCompleted,
    ).length;

    const message =
      incompleteCount === 0
        ? "Deseja finalizar este treino?"
        : `${incompleteCount} ${
            incompleteCount === 1
              ? "exercício ainda não foi marcado como concluído"
              : "exercícios ainda não foram marcados como concluídos"
          }. Deseja finalizar mesmo assim?`;

    Alert.alert("Finalizar treino", message, [
      {
        text: "Continuar treinando",
        style: "cancel",
      },
      {
        text: "Finalizar",
        onPress: () => {
          void handleFinish();
        },
      },
    ]);
  }

  async function handleFinish(): Promise<void> {
    if (!workoutSession) {
      return;
    }

    setFinishing(true);
    setError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        finishWorkoutSession(accessToken, workoutSession.id),
      );

      Alert.alert("Treino concluído", "Sua execução foi salva no histórico.", [
        {
          text: "OK",
          onPress: () => {
            navigation.navigate("Treinos");
          },
        },
      ]);
    } catch (finishError) {
      const message = getErrorMessage(finishError);

      setError(message);

      Alert.alert("Não foi possível finalizar", message);
    } finally {
      setFinishing(false);
    }
  }

  function confirmCancel(): void {
    if (!workoutSession || busy) {
      return;
    }

    Alert.alert(
      "Cancelar treino",
      "A sessão será encerrada como cancelada. Deseja continuar?",
      [
        {
          text: "Continuar treinando",
          style: "cancel",
        },
        {
          text: "Cancelar treino",
          style: "destructive",
          onPress: () => {
            void handleCancel();
          },
        },
      ],
    );
  }

  async function handleCancel(): Promise<void> {
    if (!workoutSession) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        cancelWorkoutSession(accessToken, workoutSession.id),
      );

      navigation.navigate("Treinos");
    } catch (cancelError) {
      const message = getErrorMessage(cancelError);

      setError(message);

      Alert.alert("Não foi possível cancelar", message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Preparando seu treino</Text>

          <Text style={styles.centerText}>
            Carregando a sessão e o planejamento dos exercícios.
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
              size={30}
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
            accessibilityLabel="Tentar carregar o treino novamente"
            onPress={() => {
              void loadOrStartSession();
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Dumbbell
                size={27}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>TREINO EM ANDAMENTO</Text>

              <Text style={styles.title}>{workoutSession.workoutName}</Text>

              <Text style={styles.subtitle}>
                Registre abaixo exatamente o que foi realizado em cada série.
              </Text>
            </View>
          </View>

          {resumedDifferentWorkout ? (
            <View style={styles.infoCard}>
              <AlertCircle
                size={19}
                strokeWidth={2}
                color={theme.colors.warning}
              />

              <Text style={styles.infoCardText}>
                Já havia outro treino em andamento. Esta sessão foi retomada
                para preservar seu registro atual.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <AlertCircle
                size={19}
                strokeWidth={2}
                color={theme.colors.danger}
              />

              <Text style={styles.errorCardText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>PROGRESSO</Text>

            <Text style={styles.progressValue}>
              {
                workoutSession.exercises.filter(
                  (exercise) => exercise.isCompleted,
                ).length
              }
              /{workoutSession.exercises.length}
            </Text>

            <Text style={styles.progressDescription}>
              exercícios concluídos
            </Text>
          </View>

          <View style={styles.exerciseList}>
            {workoutSession.exercises.map((exercise) => {
              const draft = drafts[exercise.id] ?? buildDefaultDraft(exercise);

              const exerciseBusy = busyExerciseId === exercise.id;

              return (
                <View
                  key={exercise.id}
                  style={[
                    styles.exerciseCard,
                    exercise.isCompleted && styles.exerciseCardCompleted,
                  ]}
                >
                  <View style={styles.exerciseHeader}>
                    <View style={styles.exerciseHeaderCopy}>
                      <Text style={styles.exercisePosition}>
                        EXERCÍCIO {exercise.position}
                      </Text>

                      <Text style={styles.exerciseName}>
                        {exercise.exerciseName}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        exercise.isCompleted
                          ? `Reabrir exercício ${exercise.exerciseName}`
                          : `Concluir exercício ${exercise.exerciseName}`
                      }
                      disabled={busy}
                      onPress={() => {
                        void handleToggleExercise(exercise);
                      }}
                      style={({ pressed }) => [
                        styles.completeButton,
                        exercise.isCompleted && styles.completeButtonActive,
                        pressed && styles.buttonPressed,
                        busy && styles.buttonDisabled,
                      ]}
                    >
                      {exerciseBusy ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            exercise.isCompleted
                              ? theme.colors.textOnPrimary
                              : theme.colors.primary
                          }
                        />
                      ) : exercise.isCompleted ? (
                        <Check
                          size={18}
                          strokeWidth={2.6}
                          color={theme.colors.textOnPrimary}
                        />
                      ) : (
                        <Text style={styles.completeButtonText}>Concluir</Text>
                      )}
                    </Pressable>
                  </View>

                  <View style={styles.planRow}>
                    <View style={styles.planItem}>
                      <Text style={styles.planItemLabel}>SÉRIES</Text>

                      <Text style={styles.planItemValue}>
                        {formatPlannedSets(exercise.plannedSets)}
                      </Text>
                    </View>

                    <View style={styles.planItem}>
                      <Text style={styles.planItemLabel}>REPETIÇÕES</Text>

                      <Text style={styles.planItemValue}>
                        {formatPlannedRepetitions(exercise.plannedRepetitions)}
                      </Text>
                    </View>

                    <View style={styles.planItem}>
                      <Text style={styles.planItemLabel}>CARGA</Text>

                      <Text style={styles.planItemValue}>
                        {formatPlannedLoad(
                          exercise.plannedLoad,
                          exercise.plannedLoadUnit,
                        )}
                      </Text>
                    </View>
                  </View>

                  {exercise.plannedNotes ? (
                    <View style={styles.plannedNotes}>
                      <Text style={styles.plannedNotesLabel}>ORIENTAÇÃO</Text>

                      <Text style={styles.plannedNotesText}>
                        {exercise.plannedNotes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.recordedSection}>
                    <Text style={styles.sectionTitle}>Séries realizadas</Text>

                    {exercise.sets.length === 0 ? (
                      <Text style={styles.emptySetsText}>
                        Nenhuma série registrada ainda.
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
                                {setExecution.repetitions} rep.
                              </Text>

                              <Text style={styles.setSecondary}>
                                {formatRecordedLoad(setExecution)}
                              </Text>
                            </View>

                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remover série ${setExecution.position}`}
                              disabled={busy}
                              onPress={() =>
                                confirmRemoveSet(exercise, setExecution)
                              }
                              style={({ pressed }) => [
                                styles.deleteSetButton,
                                pressed && styles.buttonPressed,
                                busy && styles.buttonDisabled,
                              ]}
                            >
                              <Trash2
                                size={18}
                                strokeWidth={2}
                                color={theme.colors.danger}
                              />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.newSetSection}>
                    <Text style={styles.sectionTitle}>
                      Registrar nova série
                    </Text>

                    <View style={styles.inputRow}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Repetições</Text>

                        <TextInput
                          value={draft.repetitions}
                          editable={!busy}
                          keyboardType="number-pad"
                          placeholder="Ex.: 10"
                          placeholderTextColor={theme.colors.textMuted}
                          onChangeText={(value) =>
                            updateDraft(exercise, {
                              repetitions: value,
                            })
                          }
                          style={styles.input}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Carga</Text>

                        <TextInput
                          value={draft.load}
                          editable={!busy}
                          keyboardType="decimal-pad"
                          placeholder="Opcional"
                          placeholderTextColor={theme.colors.textMuted}
                          onChangeText={(value) =>
                            updateDraft(exercise, {
                              load: value,
                            })
                          }
                          style={styles.input}
                        />
                      </View>
                    </View>

                    <View style={styles.unitRow}>
                      {(["kg", "lb"] as const).map((unit) => (
                        <Pressable
                          key={unit}
                          accessibilityRole="button"
                          accessibilityLabel={`Usar carga em ${unit}`}
                          disabled={busy}
                          onPress={() =>
                            updateDraft(exercise, {
                              loadUnit: unit,
                            })
                          }
                          style={({ pressed }) => [
                            styles.unitButton,
                            draft.loadUnit === unit && styles.unitButtonActive,
                            pressed && styles.buttonPressed,
                            busy && styles.buttonDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitButtonText,
                              draft.loadUnit === unit &&
                                styles.unitButtonTextActive,
                            ]}
                          >
                            {unit}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Registrar série de ${exercise.exerciseName}`}
                      disabled={busy}
                      onPress={() => {
                        void handleAddSet(exercise);
                      }}
                      style={({ pressed }) => [
                        styles.addSetButton,
                        pressed && styles.buttonPressed,
                        busy && styles.buttonDisabled,
                      ]}
                    >
                      {exerciseBusy ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.textOnPrimary}
                        />
                      ) : (
                        <>
                          <Plus
                            size={19}
                            strokeWidth={2.4}
                            color={theme.colors.textOnPrimary}
                          />

                          <Text style={styles.addSetButtonText}>
                            Registrar série
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.sessionActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finalizar treino"
              disabled={busy}
              onPress={confirmFinish}
              style={({ pressed }) => [
                styles.finishButton,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
            >
              {finishing ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.textOnPrimary}
                />
              ) : (
                <>
                  <Check
                    size={20}
                    strokeWidth={2.5}
                    color={theme.colors.textOnPrimary}
                  />

                  <Text style={styles.finishButtonText}>Finalizar treino</Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar treino"
              disabled={busy}
              onPress={confirmCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <>
                  <X size={19} strokeWidth={2.3} color={theme.colors.danger} />

                  <Text style={styles.cancelButtonText}>Cancelar treino</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

    hero: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },

    heroIcon: {
      width: 52,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },

    heroCopy: {
      flex: 1,
    },

    eyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.5,
      marginBottom: 3,
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
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    infoCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    infoCardText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    errorCard: {
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

    errorCardText: {
      flex: 1,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    progressCard: {
      marginBottom: theme.spacing.xl,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    progressLabel: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
    },

    progressValue: {
      marginTop: 4,
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.metric,
      lineHeight: theme.typography.lineHeight.metric,
    },

    progressDescription: {
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

    exerciseCardCompleted: {
      borderColor: theme.colors.success,
    },

    exerciseHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
    },

    exerciseHeaderCopy: {
      flex: 1,
    },

    exercisePosition: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
      marginBottom: 3,
    },

    exerciseName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
    },

    completeButton: {
      minHeight: 38,
      minWidth: 80,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    completeButtonActive: {
      minWidth: 44,
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.success,
    },

    completeButtonText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    planRow: {
      marginTop: theme.spacing.lg,
      flexDirection: "row",
      gap: theme.spacing.sm,
    },

    planItem: {
      flex: 1,
      minHeight: 66,
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    planItemLabel: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 9,
      letterSpacing: 0.8,
    },

    planItemValue: {
      marginTop: 5,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    plannedNotes: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
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

    recordedSection: {
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

    emptySetsText: {
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
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    deleteSetButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
    },

    newSetSection: {
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    inputRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },

    inputGroup: {
      flex: 1,
    },

    inputLabel: {
      marginBottom: theme.spacing.xs,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.caption,
    },

    input: {
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.body,
    },

    unitRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },

    unitButton: {
      minWidth: 58,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    unitButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    },

    unitButtonText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    unitButtonTextActive: {
      color: theme.colors.primary,
    },

    addSetButton: {
      minHeight: 48,
      marginTop: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    addSetButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    sessionActions: {
      marginTop: theme.spacing["2xl"],
      gap: theme.spacing.md,
    },

    finishButton: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },

    finishButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyLarge,
    },

    cancelButton: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    cancelButtonText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    buttonPressed: {
      opacity: 0.72,
    },

    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
