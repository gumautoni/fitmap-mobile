import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";
import { formatHeightCmInput, normalizeHeightCm } from "../utils/profileHeight";

interface ProfileHeightEditorProps {
  heightCm: string | null;
  saving: boolean;
  onSave: (heightCm: string | null) => Promise<boolean>;
}

export default function ProfileHeightEditor({
  heightCm,
  saving,
  onSave,
}: ProfileHeightEditorProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [draftInput, setDraftInput] = useState<string | null>(null);
  const input = draftInput ?? formatHeightCmInput(heightCm);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleChangeText(text: string): void {
    setDraftInput(text);
    setValidationError(null);
    setFeedback(null);
  }

  async function saveHeight(): Promise<void> {
    if (saving) {
      return;
    }

    const normalized = normalizeHeightCm(input);

    if (normalized === null) {
      setValidationError(
        "Informe uma altura entre 50 e 250 cm, com até duas casas decimais.",
      );
      setFeedback(null);
      return;
    }

    setValidationError(null);

    if (normalized === heightCm) {
      setDraftInput(null);
      setFeedback("Altura já está atualizada.");
      return;
    }

    setFeedback(null);

    const success = await onSave(normalized);

    if (success) {
      setDraftInput(null);
      setFeedback("Altura salva com sucesso.");
    }
  }

  async function removeHeight(): Promise<void> {
    if (saving || heightCm === null) {
      return;
    }

    setValidationError(null);
    setFeedback(null);

    const success = await onSave(null);

    if (success) {
      setDraftInput(null);
      setFeedback("Altura removida.");
    }
  }

  function confirmRemoval(): void {
    if (saving || heightCm === null) {
      return;
    }

    Alert.alert(
      "Remover altura",
      "Deseja remover a altura do seu perfil? O IMC deixará de ser calculado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            void removeHeight();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Altura</Text>
      <Text style={styles.description}>
        Informe sua altura em centímetros para calcular seu IMC.
      </Text>

      <TextInput
        accessibilityLabel="Altura em centímetros"
        value={input}
        onChangeText={handleChangeText}
        editable={!saving}
        keyboardType="decimal-pad"
        autoCorrect={false}
        maxLength={6}
        placeholder="Ex.: 175,5"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.hint}>
        Valores entre 50 e 250 cm. Use vírgula ou ponto como separador.
      </Text>

      {validationError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {validationError}
        </Text>
      ) : null}

      {feedback ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {feedback}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Salvar altura"
        disabled={saving}
        onPress={() => {
          void saveHeight();
        }}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.pressed,
          saving && styles.disabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
        ) : (
          <Text style={styles.saveButtonText}>Salvar altura</Text>
        )}
      </Pressable>

      {heightCm !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remover altura"
          disabled={saving}
          onPress={confirmRemoval}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          <Text style={styles.removeButtonText}>Remover altura</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    card: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
    },
    title: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyLarge,
      color: theme.colors.textPrimary,
    },
    description: {
      marginTop: theme.spacing.xs,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      color: theme.colors.textSecondary,
    },
    input: {
      minHeight: 50,
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.body,
    },
    hint: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    error: {
      marginTop: theme.spacing.md,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },
    success: {
      marginTop: theme.spacing.md,
      color: theme.colors.success,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },
    saveButton: {
      minHeight: 46,
      marginTop: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },
    saveButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    removeButton: {
      minHeight: 44,
      marginTop: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    removeButtonText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.small,
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
