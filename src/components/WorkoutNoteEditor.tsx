import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";

interface WorkoutNoteEditorProps {
  title: string;
  scopeLabel: string;
  value: string;
  dirty: boolean;
  canDiscard: boolean;
  disabled: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export default function WorkoutNoteEditor({
  title,
  scopeLabel,
  value,
  dirty,
  canDiscard,
  disabled,
  saving,
  onChange,
  onSave,
  onDiscard,
}: WorkoutNoteEditorProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const saveDisabled = disabled || !dirty;
  const discardDisabled = disabled || !canDiscard;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <TextInput
        accessibilityLabel={`Observa\u00e7\u00e3o ${scopeLabel}`}
        value={value}
        editable={!disabled}
        multiline
        textAlignVertical="top"
        placeholder={"Registre suas observa\u00e7\u00f5es..."}
        placeholderTextColor={theme.colors.textMuted}
        onChangeText={onChange}
        style={styles.input}
      />

      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {saving
          ? "Salvando observa\u00e7\u00e3o..."
          : dirty
            ? "Altera\u00e7\u00f5es n\u00e3o salvas"
            : value
              ? "Nenhuma altera\u00e7\u00e3o pendente"
              : "Campo opcional"}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Salvar observa\u00e7\u00e3o ${scopeLabel}`}
        accessibilityState={{
          disabled: saveDisabled,
          busy: saving,
        }}
        disabled={saveDisabled}
        onPress={onSave}
        style={({ pressed }) => [
          styles.saveButton,
          saveDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
        ) : (
          <Text style={styles.saveText}>{"Salvar observa\u00e7\u00e3o"}</Text>
        )}
      </Pressable>

      {canDiscard ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Descartar altera\u00e7\u00f5es da observa\u00e7\u00e3o ${scopeLabel}`}
          accessibilityState={{
            disabled: discardDisabled,
          }}
          disabled={discardDisabled}
          onPress={onDiscard}
          style={({ pressed }) => [
            styles.discardButton,
            discardDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.discardText}>
            {"Descartar altera\u00e7\u00f5es"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    input: {
      minHeight: 92,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },

    status: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    saveButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    saveText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      textAlign: "center",
    },

    discardButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    discardText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.small,
      textAlign: "center",
    },

    disabled: {
      opacity: 0.5,
    },

    pressed: {
      opacity: 0.72,
    },
  });
}
