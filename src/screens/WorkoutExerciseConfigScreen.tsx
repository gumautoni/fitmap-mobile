import { useFocusEffect } from "@react-navigation/native";
import { AlertCircle, Dumbbell, RefreshCw, Save } from "lucide-react-native";
import { useCallback, useContext, useMemo, useState } from "react";
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
import {
  getWorkout,
  updateWorkoutExercise,
  type LoadUnit,
  type WorkoutExercise,
} from "../services/training";
import { useAppTheme } from "../theme/ThemeProvider";

type WorkoutExerciseConfigScreenProps =
  AppStackScreenProps<"ConfigurarExercicioTreino">;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "workout_not_found") {
      return "Esse treino não foi encontrado.";
    }

    if (error.code === "workout_exercise_not_found") {
      return "Esse exercício não foi encontrado no treino.";
    }

    if (error.code === "workout_archived") {
      return "Esse treino está arquivado e não pode ser alterado.";
    }

    if (error.code === "request_validation_error") {
      return "Confira a configuração do exercício e tente novamente.";
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

function parseOptionalPositiveInteger(
  value: string,
  fieldName: string,
): number | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldName} deve ser informado com um número inteiro.`);
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} deve ser maior ou igual a 1.`);
  }

  return parsed;
}

function parseOptionalLoad(value: string): string | null {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(
      "A carga deve ter até 6 dígitos inteiros e no máximo 2 casas decimais.",
    );
  }

  return normalized;
}

function findWorkoutExercise(
  exercises: WorkoutExercise[],
  workoutExerciseId: string,
): WorkoutExercise | undefined {
  return exercises.find((exercise) => exercise.id === workoutExerciseId);
}

export default function WorkoutExerciseConfigScreen({
  navigation,
  route,
}: WorkoutExerciseConfigScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "WorkoutExerciseConfigScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;
  const { workoutId, workoutExerciseId } = route.params;

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [workoutName, setWorkoutName] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [targetSets, setTargetSets] = useState("");
  const [targetRepetitions, setTargetRepetitions] = useState("");
  const [targetLoad, setTargetLoad] = useState("");
  const [loadUnit, setLoadUnit] = useState<LoadUnit>("kg");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyExercise(exercise: WorkoutExercise): void {
    setExerciseName(exercise.exerciseName);

    setTargetSets(
      exercise.targetSets === null ? "" : String(exercise.targetSets),
    );

    setTargetRepetitions(
      exercise.targetRepetitions === null
        ? ""
        : String(exercise.targetRepetitions),
    );

    setTargetLoad(exercise.targetLoad === null ? "" : exercise.targetLoad);

    setLoadUnit(exercise.targetLoadUnit ?? "kg");

    setNotes(exercise.notes ?? "");
  }

  const loadExercise = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const workout = await runAuthenticatedRequest((accessToken) =>
        getWorkout(accessToken, workoutId),
      );

      const exercise = findWorkoutExercise(
        workout.exercises,
        workoutExerciseId,
      );

      if (!exercise) {
        throw new Error("Esse exercício não foi encontrado no treino.");
      }

      setWorkoutName(workout.name);
      applyExercise(exercise);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [runAuthenticatedRequest, workoutExerciseId, workoutId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      runAuthenticatedRequest((accessToken) =>
        getWorkout(accessToken, workoutId),
      )
        .then((workout) => {
          if (!active) {
            return;
          }

          const exercise = findWorkoutExercise(
            workout.exercises,
            workoutExerciseId,
          );

          if (!exercise) {
            throw new Error("Esse exercício não foi encontrado no treino.");
          }

          setWorkoutName(workout.name);
          applyExercise(exercise);
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
    }, [runAuthenticatedRequest, workoutExerciseId, workoutId]),
  );

  async function handleSave(): Promise<void> {
    if (saving) {
      return;
    }

    let parsedSets: number | null;
    let parsedRepetitions: number | null;
    let parsedLoad: string | null;

    try {
      parsedSets = parseOptionalPositiveInteger(targetSets, "Séries");

      parsedRepetitions = parseOptionalPositiveInteger(
        targetRepetitions,
        "Repetições",
      );

      parsedLoad = parseOptionalLoad(targetLoad);
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Confira os dados informados.";

      Alert.alert("Configuração inválida", message);

      return;
    }

    const normalizedNotes = notes.trim() || null;

    setSaving(true);
    setError(null);

    try {
      const updatedWorkout = await runAuthenticatedRequest((accessToken) =>
        updateWorkoutExercise(accessToken, workoutId, workoutExerciseId, {
          targetSets: parsedSets,
          targetRepetitions: parsedRepetitions,
          targetLoad: parsedLoad,
          targetLoadUnit: parsedLoad === null ? null : loadUnit,
          notes: normalizedNotes,
        }),
      );

      const updatedExercise = findWorkoutExercise(
        updatedWorkout.exercises,
        workoutExerciseId,
      );

      if (updatedExercise) {
        applyExercise(updatedExercise);
      }

      Alert.alert(
        "Configuração salva",
        "As metas do exercício foram atualizadas no treino.",
        [
          {
            text: "Continuar",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (saveError) {
      const message = getErrorMessage(saveError);

      setError(message);

      Alert.alert("Não foi possível salvar", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerTitle}>Carregando exercício</Text>

          <Text style={styles.centerText}>
            Buscando a configuração salva no treino.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !exerciseName) {
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
            Não foi possível abrir o exercício
          </Text>

          <Text style={styles.centerText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void loadExercise();
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CONFIGURAÇÃO</Text>

            <Text style={styles.title}>{exerciseName}</Text>

            <Text style={styles.subtitle}>
              Defina as metas planejadas para este exercício
              {workoutName ? ` no treino "${workoutName}".` : "."}
            </Text>
          </View>

          <View style={styles.exerciseIdentity}>
            <View style={styles.exerciseIcon}>
              <Dumbbell
                size={24}
                strokeWidth={2.1}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.exerciseIdentityCopy}>
              <Text style={styles.exerciseLabel}>EXERCÍCIO</Text>

              <Text style={styles.exerciseName}>{exerciseName}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>VOLUME</Text>

            <Text style={styles.sectionTitle}>Séries e repetições</Text>

            <Text style={styles.sectionDescription}>
              Deixe um campo vazio quando não quiser definir uma meta.
            </Text>

            <View style={styles.twoColumns}>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Séries</Text>

                <TextInput
                  value={targetSets}
                  onChangeText={setTargetSets}
                  editable={!saving}
                  keyboardType="number-pad"
                  autoCorrect={false}
                  placeholder="Ex.: 4"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Repetições</Text>

                <TextInput
                  value={targetRepetitions}
                  onChangeText={setTargetRepetitions}
                  editable={!saving}
                  keyboardType="number-pad"
                  autoCorrect={false}
                  placeholder="Ex.: 10"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>CARGA</Text>

            <Text style={styles.sectionTitle}>Carga planejada</Text>

            <Text style={styles.sectionDescription}>
              A carga é opcional. Quando informada, selecione a unidade
              utilizada.
            </Text>

            <Text style={styles.label}>Carga</Text>

            <TextInput
              value={targetLoad}
              onChangeText={setTargetLoad}
              editable={!saving}
              keyboardType="decimal-pad"
              autoCorrect={false}
              placeholder="Ex.: 40"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.unitLabel}>Unidade</Text>

            <View style={styles.unitRow}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setLoadUnit("kg")}
                style={({ pressed }) => [
                  styles.unitButton,
                  loadUnit === "kg" && styles.unitButtonSelected,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    loadUnit === "kg" && styles.unitButtonTextSelected,
                  ]}
                >
                  kg
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setLoadUnit("lb")}
                style={({ pressed }) => [
                  styles.unitButton,
                  loadUnit === "lb" && styles.unitButtonSelected,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    loadUnit === "lb" && styles.unitButtonTextSelected,
                  ]}
                >
                  lb
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>OBSERVAÇÕES</Text>

            <Text style={styles.sectionTitle}>Notas do exercício</Text>

            <Text style={styles.sectionDescription}>
              Registre orientações úteis para executar este exercício durante o
              treino.
            </Text>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              editable={!saving}
              multiline
              scrollEnabled
              textAlignVertical="top"
              autoCapitalize="sentences"
              returnKeyType="default"
              blurOnSubmit={false}
              placeholder="Ex.: controlar a descida e manter a técnica."
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, styles.notesInput]}
            />

            <Text style={styles.notesHint}>
              Para textos maiores, role dentro da caixa de observações.
            </Text>
          </View>

          {error ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed,
              saving && styles.buttonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.textOnPrimary}
              />
            ) : (
              <>
                <Save
                  size={18}
                  strokeWidth={2.3}
                  color={theme.colors.textOnPrimary}
                />

                <Text style={styles.saveButtonText}>Salvar configuração</Text>
              </>
            )}
          </Pressable>
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

    keyboardAvoidingView: {
      flex: 1,
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

    exerciseIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing["3xl"],
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    exerciseIcon: {
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: theme.colors.primarySoft,
    },

    exerciseIdentityCopy: {
      flex: 1,
    },

    exerciseLabel: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
    },

    exerciseName: {
      marginTop: 3,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    section: {
      marginBottom: theme.spacing["3xl"],
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
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    twoColumns: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },

    fieldColumn: {
      flex: 1,
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
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.body,
    },

    unitLabel: {
      marginTop: theme.spacing.lg,
      marginBottom: 7,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    unitRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },

    unitButton: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    unitButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    },

    unitButtonText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    unitButtonTextSelected: {
      color: theme.colors.primary,
    },

    notesInput: {
      height: 220,
    },

    notesHint: {
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

    saveButton: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },

    saveButtonText: {
      color: theme.colors.textOnPrimary,
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
