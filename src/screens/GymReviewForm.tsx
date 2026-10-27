import { AlertCircle, Send, Star } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { CreateGymReviewInput } from "../services/gymReviews";
import { useAppTheme } from "../theme/ThemeProvider";

const MAX_COMMENT_LENGTH = 1000;
const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

interface Props {
  initialRating?: number | null;
  initialComment?: string | null;
  submitting?: boolean;
  submitLabel?: string;
  errorMessage?: string | null;
  onSubmit: (input: CreateGymReviewInput) => void;
  onCancel?: () => void;
}

export default function GymReviewForm({
  initialRating = null,
  initialComment = null,
  submitting = false,
  submitLabel = "Publicar avaliação",
  errorMessage = null,
  onSubmit,
  onCancel,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [rating, setRating] = useState(initialRating ?? 0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(): void {
    if (submitting) {
      return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setValidationError("Selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    setValidationError(null);

    const normalizedComment = comment.trim();

    onSubmit({
      rating,
      comment: normalizedComment || null,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sua avaliação</Text>

        <Text style={styles.description}>
          Compartilhe sua experiência com a comunidade FitMap.
        </Text>
      </View>

      <Text style={styles.fieldLabel}>Sua nota</Text>

      <View style={styles.starsRow}>
        {RATING_OPTIONS.map((star) => (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`Selecionar ${star} ${
              star === 1 ? "estrela" : "estrelas"
            }`}
            accessibilityState={{
              selected: rating === star,
              disabled: submitting,
            }}
            disabled={submitting}
            onPress={() => {
              setRating(star);
              setValidationError(null);
            }}
            style={({ pressed }) => [
              styles.starButton,
              rating === star && styles.starButtonSelected,
              pressed && !submitting && styles.pressed,
            ]}
          >
            <Star
              size={29}
              strokeWidth={2.1}
              color={theme.colors.warning}
              fill={star <= rating ? theme.colors.warning : "none"}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.ratingDescription}>
        {rating > 0
          ? `${rating} de 5 estrelas`
          : "Selecione uma nota para continuar"}
      </Text>

      <View style={styles.commentLabelRow}>
        <Text style={styles.fieldLabel}>Seu comentário</Text>

        <Text style={styles.optionalLabel}>Opcional</Text>
      </View>

      <TextInput
        accessibilityLabel="Comentário da avaliação"
        multiline
        maxLength={MAX_COMMENT_LENGTH}
        numberOfLines={4}
        textAlignVertical="top"
        editable={!submitting}
        value={comment}
        onChangeText={setComment}
        placeholder="Conte como foi sua experiência nesta academia..."
        placeholderTextColor={theme.colors.textMuted}
        style={styles.commentInput}
      />

      <Text style={styles.characterCount}>
        {comment.length}/{MAX_COMMENT_LENGTH} caracteres
      </Text>

      {validationError || errorMessage ? (
        <View style={styles.errorBox}>
          <AlertCircle size={17} color={theme.colors.danger} strokeWidth={2} />

          <Text style={styles.errorText}>
            {validationError ?? errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar avaliação"
            disabled={submitting}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && !submitting && styles.pressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
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
            <Send
              size={17}
              color={theme.colors.textOnPrimary}
              strokeWidth={2.2}
            />
          )}

          <Text style={styles.submitText}>
            {submitting ? "Salvando avaliação..." : submitLabel}
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
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      marginBottom: theme.spacing.lg,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
    },
    description: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    fieldLabel: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    starsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    starButton: {
      flex: 1,
      minHeight: 49,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    starButtonSelected: {
      borderColor: theme.colors.warning,
    },
    pressed: {
      opacity: 0.75,
    },
    ratingDescription: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    commentLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
    },
    optionalLabel: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    commentInput: {
      minHeight: 118,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    characterCount: {
      alignSelf: "flex-end",
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
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
      minHeight: 49,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
    },
    cancelText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    submitButton: {
      flex: 1,
      minHeight: 49,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },
    submitText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    disabled: {
      opacity: 0.65,
    },
  });
}
