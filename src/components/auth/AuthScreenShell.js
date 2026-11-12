import { lightColors as authColors } from "../../theme/themes";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FitMapBrand from "../FitMapBrand";
import AuthBackground from "./AuthBackground";

const COLORS = {
  background: authColors.background,
  navy: authColors.textPrimary,

  muted: authColors.textSecondary,
  border: authColors.border,
};

/**
 * Estrutura compartilhada para manter Login e Cadastro visualmente consistentes.
 * A fita aprovada aparece como imagem de fundo, e o formulario fica acima dela.
 */
export default function AuthScreenShell({
  title,
  subtitle,
  eyebrow,
  onBack,
  children,
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      {/* 22-C3.5: o formulario e filho do fundo, nunca fica atras dele. */}
      <AuthBackground>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.content}>
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Voltar para boas-vindas"
                hitSlop={10}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
              >
                <ArrowLeft size={20} color={COLORS.navy} strokeWidth={2.2} />
                <Text style={styles.backText}>Voltar</Text>
              </Pressable>

              <View style={styles.brand}>
                <FitMapBrand variant="full" mode="light" width={174} />
              </View>

              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              <View style={styles.formCard}>{children}</View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </AuthBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 23,
    paddingTop: 16,
    paddingBottom: 22,
  },
  content: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 9,
    paddingRight: 12,
    marginBottom: 15,
  },
  backText: {
    color: COLORS.navy,
    fontSize: 13,
    fontFamily: "Manrope_700Bold",
  },
  pressed: { opacity: 0.7 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    marginBottom: 9,
  },

  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: authColors.textSecondary,
    fontFamily: "Manrope_700Bold",
    textAlign: "center",
    marginBottom: 22,
  },
  title: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 26,
    lineHeight: 34,
    color: COLORS.navy,
    textAlign: "center",
    marginBottom: 9,
  },
  subtitle: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 330,
    marginBottom: 21,
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 20,
    shadowColor: authColors.primaryPressed,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
});
