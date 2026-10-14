import { Dumbbell } from "lucide-react-native";
import { useContext, useMemo, useState } from "react";
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
import { createWorkout } from "../services/training";
import { useAppTheme } from "../theme/ThemeProvider";

type CreateWorkoutScreenProps = AppStackScreenProps<"NovoTreino">;

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

  return "Não foi possível criar o treino.";
}

export default function CreateWorkoutScreen({
  navigation,
}: CreateWorkoutScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "CreateWorkoutScreen must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateWorkout(): Promise<void> {
    if (saving) {
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

    setSaving(true);
    setError(null);

    try {
      await runAuthenticatedRequest((accessToken) =>
        createWorkout(accessToken, normalizedName),
      );

      Alert.alert("Treino criado", "Seu treino foi salvo no FitMap.", [
        {
          text: "Continuar",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (createError) {
      const message = getErrorMessage(createError);

      setError(message);

      Alert.alert("Não foi possível criar", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroIcon}>
            <Dumbbell size={32} strokeWidth={2} color={theme.colors.primary} />
          </View>

          <Text style={styles.eyebrow}>NOVO PLANEJAMENTO</Text>

          <Text style={styles.title}>Crie seu treino</Text>

          <Text style={styles.subtitle}>
            Comece pelo nome. Depois você poderá adicionar exercícios e
            configurar séries, repetições, carga e observações.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>Nome do treino</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              editable={!saving}
              autoCapitalize="sentences"
              autoCorrect={false}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleCreateWorkout();
              }}
              placeholder="Ex.: Push, Pernas ou Treino A"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.hint}>
              Você poderá alterar esse nome depois.
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                void handleCreateWorkout();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
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
                <Text style={styles.primaryButtonText}>Criar treino</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
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

    keyboardView: {
      flex: 1,
    },

    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing["4xl"],
    },

    heroIcon: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.xl,
      borderRadius: 21,
      backgroundColor: theme.colors.primarySoft,
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
      marginBottom: theme.spacing["2xl"],
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },

    formCard: {
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    label: {
      marginBottom: 7,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
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

    hint: {
      marginTop: 7,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    errorBox: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    errorText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    primaryButton: {
      minHeight: 52,
      marginTop: theme.spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },

    primaryButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    secondaryButton: {
      minHeight: 50,
      marginTop: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    secondaryButtonText: {
      color: theme.colors.textPrimary,
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
