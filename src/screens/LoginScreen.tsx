import { lightColors as authColors } from "../theme/themes";
import { LockKeyhole, Mail } from "lucide-react-native";
import React, { useContext, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import AuthButton from "../components/auth/AuthButton";
import AuthField from "../components/auth/AuthField";
import AuthScreenShell from "../components/auth/AuthScreenShell";
import { AuthContext } from "../context/AuthContext";
import type { AuthStackScreenProps } from "../navigation/types";
import {
  normalizeEmail,
  validateLoginForm,
  type LoginFormErrors,
} from "../utils/authFormValidation";

type Props = AuthStackScreenProps<"Login">;

export default function LoginScreen({ navigation }: Props) {
  const auth = useContext(AuthContext);
  const submittingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateEmail(value: string) {
    setEmail(value);
    setErrors((previous) => ({ ...previous, email: undefined }));
    setFormError("");
  }

  function updatePassword(value: string) {
    setPassword(value);
    setErrors((previous) => ({ ...previous, password: undefined }));
    setFormError("");
  }

  async function handleLogin(): Promise<void> {
    if (submittingRef.current) return;
    Keyboard.dismiss();

    const formattedEmail = normalizeEmail(email);
    const nextErrors = validateLoginForm(formattedEmail, password);
    setErrors(nextErrors);
    setFormError("");

    if (Object.keys(nextErrors).length > 0) return;
    if (!auth) {
      setFormError("A autenticação não está disponível neste momento.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await auth.login(formattedEmail, password);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível acessar sua conta. Tente novamente.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function goBack() {
    Keyboard.dismiss();
    navigation.navigate("BoasVindas");
  }

  return (
    <AuthScreenShell
      eyebrow="SAÚDE  •  TREINO  •  EVOLUÇÃO"
      title="Sua evolução continua."
      subtitle="Entre na sua conta e retome sua jornada no FitMap."
      onBack={goBack}
      backDisabled={submitting}
    >
      <AuthField
        editable={!submitting}
        label="E-mail"
        placeholder="seu@email.com"
        icon={Mail}
        value={email}
        onChangeText={updateEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="username"
        autoComplete="email"
        error={errors.email}
        returnKeyType="next"
      />

      <AuthField
        editable={!submitting}
        label="Senha"
        placeholder="Digite sua senha"
        icon={LockKeyhole}
        value={password}
        onChangeText={updatePassword}
        secure
        autoCapitalize="none"
        textContentType="password"
        autoComplete="current-password"
        error={errors.password}
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />

      {formError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}

      <View style={styles.actionSpacing}>
        <AuthButton
          title="Entrar na minha conta"
          onPress={handleLogin}
          loading={submitting}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Ainda não tem uma conta?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Criar conta"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={() => navigation.navigate("Cadastro")}
          style={[styles.footerLink, submitting && styles.footerLinkDisabled]}
        >
          <Text style={styles.footerLinkText}>Criar conta</Text>
        </Pressable>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  actionSpacing: { marginTop: 5 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 21,
    gap: 5,
  },
  footerText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: authColors.textSecondary,
  },
  footerLink: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  footerLinkDisabled: { opacity: 0.55 },
  footerLinkText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 12,
    color: authColors.primary,
  },
  errorBox: {
    backgroundColor: "#FFF4F3",
    borderColor: "#F8D6D3",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 13,
  },
  errorText: {
    fontFamily: "Manrope_500Medium",
    color: "#B42318",
    fontSize: 12,
    lineHeight: 18,
  },
});
