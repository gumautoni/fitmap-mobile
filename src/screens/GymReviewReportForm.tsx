import { AlertCircle, Flag } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type {
  CreateGymReviewReportInput,
  GymReviewReportReason,
} from "../services/gymReviews";
import { useAppTheme } from "../theme/ThemeProvider";

const MAX_DETAILS_LENGTH = 500;

const REASONS: {
  value: GymReviewReportReason;
  label: string;
}[] = [
  { value: "spam", label: "Spam ou publicidade" },
  { value: "offensive", label: "Conteúdo ofensivo" },
  { value: "misleading", label: "Informação enganosa" },
  { value: "other", label: "Outro motivo" },
];

interface Props {
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (input: CreateGymReviewReportInput) => void;
  onCancel: () => void;
}

export default function GymReviewReportForm({
  submitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [reason, setReason] = useState<GymReviewReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(): void {
    if (submitting) {
      return;
    }

    if (!reason) {
      setValidationError("Selecione o motivo da denúncia.");
      return;
    }

    setValidationError(null);

    const normalizedDetails = details.trim();

    onSubmit({
      reason,
      details: normalizedDetails || null,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Flag size={19} color={theme.colors.danger} strokeWidth={2} />

        <Text style={styles.title}>Denunciar avaliação</Text>
      </View>

      <Text style={styles.description}>
        Conte por que esta avaliação deve ser analisada. A denúncia não remove
        automaticamente o comentário.
      </Text>

      <Text style={styles.label}>Motivo da denúncia</Text>

      <View style={styles.reasons}>
        {REASONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`Selecionar motivo: ${option.label}`}
            accessibilityState={{
              selected: reason === option.value,
              disabled: submitting,
            }}
            disabled={submitting}
            onPress={() => {
              setReason(option.value);
              setValidationError(null);
            }}
            style={({ pressed }) => [
              styles.reasonButton,
              reason === option.value && styles.reasonSelected,
              pressed && !submitting && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.reasonIndicator,
                reason === option.value && styles.reasonIndicatorSelected,
              ]}
            />

            <Text style={styles.reasonText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.detailsHeading}>
        <Text style={styles.label}>Detalhes adicionais</Text>
        <Text style={styles.optional}>Opcional</Text>
      </View>

      <TextInput
        accessibilityLabel="Detalhes da denúncia"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        editable={!submitting}
        maxLength={MAX_DETAILS_LENGTH}
        value={details}
        onChangeText={setDetails}
        placeholder="Descreva o problema, se necessário..."
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.counter}>
        {details.length}/{MAX_DETAILS_LENGTH} caracteres
      </Text>

      {validationError || errorMessage ? (
        <View style={styles.errorRow}>
          <AlertCircle size={17} color={theme.colors.danger} strokeWidth={2} />

          <Text style={styles.errorText}>
            {validationError ?? errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancelar denúncia"
          disabled={submitting}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && !submitting && styles.pressed,
          ]}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar denúncia"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            submitting && styles.disabled,
            pressed && !submitting && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.textOnPrimary}
            />
          ) : (
            <Flag
              size={16}
              color={theme.colors.textOnPrimary}
              strokeWidth={2}
            />
          )}

          <Text style={styles.submitText}>
            {submitting ? "Enviando denúncia..." : "Enviar denúncia"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceSecondary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
    },
    description: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      marginBottom: theme.spacing.lg,
    },
    label: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    reasons: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    reasonButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: 46,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    reasonSelected: {
      borderColor: theme.colors.primary,
    },
    reasonIndicator: {
      width: 16,
      height: 16,
      borderRadius: theme.radii.full,
      borderWidth: 2,
      borderColor: theme.colors.textMuted,
    },
    reasonIndicatorSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    reasonText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },
    detailsHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
    },
    optional: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    input: {
      minHeight: 92,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    counter: {
      alignSelf: "flex-end",
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    errorText: {
      flex: 1,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    cancelButton: {
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    cancelText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    submitButton: {
      flex: 1,
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },
    submitText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    pressed: {
      opacity: 0.75,
    },
    disabled: {
      opacity: 0.65,
    },
  });
}
