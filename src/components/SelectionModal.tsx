import { useMemo, useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useReducedMotion } from "../hooks/useReducedMotion";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/themes";

export interface SelectionModalOption {
  label: string;
  checked: boolean;
  onSelect: () => void;
}

export interface SelectionModalContent {
  title: string;
  description: string;
  options: readonly SelectionModalOption[];
}

interface Props {
  selection: SelectionModalContent;
  onClose: () => void;
}

export default function SelectionModal({ selection, onClose }: Props) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handledRef = useRef(false);

  function dismiss(): void {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;
    onClose();
  }

  function selectOption(option: SelectionModalOption): void {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;
    onClose();
    option.onSelect();
  }

  return (
    <Modal
      visible
      transparent
      presentationStyle="overFullScreen"
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={dismiss}
    >
      <SafeAreaView
        style={styles.overlay}
        edges={["top", "right", "bottom", "left"]}
      >
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={dismiss}
          style={styles.panel}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              accessibilityRole="header"
              accessibilityLabel={selection.title}
              style={styles.title}
            >
              {selection.title}
            </Text>

            <Text style={styles.description}>{selection.description}</Text>

            {selection.options.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: option.checked }}
                onPress={() => selectOption(option)}
                style={({ pressed }) => [
                  styles.option,
                  option.checked && styles.optionChecked,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.radioIndicator,
                    option.checked && styles.radioIndicatorChecked,
                  ]}
                >
                  {option.checked ? <View style={styles.radioDot} /> : null}
                </View>

                <Text style={styles.optionLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              onPress={dismiss}
              style={({ pressed }) => [
                styles.cancel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
      backgroundColor: "rgba(0, 0, 0, 0.58)",
    },
    panel: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "100%",
      flexShrink: 1,
      borderRadius: theme.radii["2xl"],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    content: {
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.sectionTitle,
    },
    description: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      marginBottom: theme.spacing.sm,
    },
    option: {
      minHeight: 48,
      minWidth: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    optionChecked: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    },
    radioIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.textSecondary,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    radioIndicatorChecked: {
      borderColor: theme.colors.primary,
    },
    radioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
    },
    optionLabel: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.body,
    },
    footer: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },
    cancel: {
      minWidth: 48,
      minHeight: 48,
      padding: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },
    cancelLabel: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
