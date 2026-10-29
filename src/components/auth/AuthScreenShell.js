import { ArrowLeft } from "lucide-react-native";
import React from "react";
import {
  Image,
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

import AuthBackground from "./AuthBackground";

const COLORS = {
  background: "#F7F9FF",
  navy: "#152744",
  blue: "#3F51E8",
  muted: "#677997",
  border: "#DCE5F4",
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
                <View style={styles.logoShadow}>
                  <Image
                    source={require("../../../assets/images/fitmap-logo-symbol.png")}
                    resizeMode="contain"
                    style={styles.logo}
                    accessibilityLabel="Símbolo do FitMap"
                  />
                </View>
                <View style={styles.wordmark} accessibilityLabel="FitMap">
                  <Text style={styles.wordmarkFit}>Fit</Text>
                  <Text style={styles.wordmarkMap}>Map</Text>
                </View>
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
  logoShadow: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "rgba(234,241,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 48, height: 48 },
  wordmark: { flexDirection: "row", alignItems: "center" },
  wordmarkFit: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 27,
    color: COLORS.navy,
  },
  wordmarkMap: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 27,
    color: COLORS.blue,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#6B80A5",
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
    shadowColor: "#24458A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
});
