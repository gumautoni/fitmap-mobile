import {
  CheckCircle2,
  Circle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react-native";
import React, { useContext, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import AuthButton from "../components/auth/AuthButton";
import AuthField from "../components/auth/AuthField";
import AuthScreenShell from "../components/auth/AuthScreenShell";
import { AuthContext } from "../context/AuthContext";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  getPasswordRequirements,
  normalizeEmail,
  normalizeName,
  validateRegistrationForm,
} from "../utils/authFormValidation";

const PASSWORD_RULES = [
  {
    key: "length",
    label: `${MIN_PASSWORD_LENGTH} a ${MAX_PASSWORD_LENGTH} caracteres`,
  },
  { key: "uppercase", label: "Uma letra maiúscula" },
  { key: "lowercase", label: "Uma letra minúscula" },
  { key: "number", label: "Um número" },
  { key: "special", label: "Um símbolo (!, @, #...)" },
];

function PasswordRequirements({ password }) {
  if (!password) return null;
  const requirements = getPasswordRequirements(password);

  return (
    <View style={styles.requirements} accessibilityLiveRegion="polite">
      <Text style={styles.requirementsTitle}>Sua senha precisa conter:</Text>
      {PASSWORD_RULES.map(({ key, label }) => {
        const passed = requirements[key];
        return (
          <View key={key} style={styles.requirementRow}>
            {passed ? (
              <CheckCircle2 size={14} color="#267256" strokeWidth={2} />
            ) : (
              <Circle size={14} color="#8C9BB1" strokeWidth={1.7} />
            )}
            <Text
              style={[
                styles.requirementText,
                passed && styles.requirementPassed,
              ]}
              accessibilityLabel={`${label}: ${passed ? "atendido" : "pendente"}`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const auth = useContext(AuthContext);
  const submittingRef = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value, setter) {
    setter(value);
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setFormError("");
  }

  async function handleRegister() {
    if (submittingRef.current) return;
    Keyboard.dismiss();

    const formattedName = normalizeName(name);
    const formattedEmail = normalizeEmail(email);
    const nextErrors = validateRegistrationForm(
      formattedName,
      formattedEmail,
      password,
      confirmPassword,
    );
    setErrors(nextErrors);
    setFormError("");

    if (Object.keys(nextErrors).length > 0) return;
    if (!auth) {
      setFormError("O cadastro não está disponível neste momento.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await auth.register(formattedName, formattedEmail, password);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar sua conta. Tente novamente.",
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
      title="Comece sua evolução."
      subtitle="Crie sua conta e dê o primeiro passo com o FitMap."
      onBack={goBack}
    >
      <AuthField
        label="Nome completo"
        placeholder="Seu nome completo"
        icon={UserRound}
        value={name}
        onChangeText={(value) => updateField("name", value, setName)}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        error={errors.name}
        returnKeyType="next"
      />

      <AuthField
        label="E-mail"
        placeholder="seu@email.com"
        icon={Mail}
        value={email}
        onChangeText={(value) => updateField("email", value, setEmail)}
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="username"
        autoComplete="email"
        error={errors.email}
        returnKeyType="next"
      />

      <AuthField
        label="Senha"
        placeholder="Crie uma senha segura"
        icon={LockKeyhole}
        value={password}
        onChangeText={(value) => updateField("password", value, setPassword)}
        secure
        autoCapitalize="none"
        textContentType="newPassword"
        autoComplete="new-password"
        error={errors.password}
        helper="Use letras maiúsculas, minúsculas, números e símbolos."
        returnKeyType="next"
      />
      <PasswordRequirements password={password} />

      <AuthField
        label="Confirmar senha"
        placeholder="Repita sua senha"
        icon={LockKeyhole}
        value={confirmPassword}
        onChangeText={(value) =>
          updateField("confirmPassword", value, setConfirmPassword)
        }
        secure
        autoCapitalize="none"
        textContentType="newPassword"
        autoComplete="new-password"
        error={errors.confirmPassword}
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />

      {formError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}

      <View style={styles.actionSpacing}>
        <AuthButton
          title="Criar minha conta"
          onPress={handleRegister}
          loading={submitting}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Já tem uma conta?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ir para Login"
          onPress={() => navigation.navigate("Login")}
          style={styles.footerLink}
        >
          <Text style={styles.footerLinkText}>Entrar</Text>
        </Pressable>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  requirements: { marginTop: -5, marginBottom: 15, paddingLeft: 2 },
  requirementsTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 11,
    color: "#596C8A",
    marginBottom: 7,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  requirementText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 11,
    lineHeight: 16,
    color: "#7787A0",
    flexShrink: 1,
  },
  requirementPassed: { color: "#267256" },
  actionSpacing: { marginTop: 5 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 18,
    gap: 5,
  },
  footerText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: "#657895",
  },
  footerLink: { paddingVertical: 4 },
  footerLinkText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 12,
    color: "#3F51E8",
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
