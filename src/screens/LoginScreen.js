import { ArrowLeft } from "lucide-react-native";
import React, { useContext, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import { AuthContext } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const auth = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function isValidEmail(value) {
    return /\S+@\S+\.\S+/.test(value);
  }

  async function handleLogin() {
    Keyboard.dismiss();

    const formattedEmail = email.trim().toLowerCase();

    if (!formattedEmail || !password) {
      Alert.alert("Atenção", "Preencha o e-mail e a senha para continuar.");
      return;
    }

    if (!isValidEmail(formattedEmail)) {
      Alert.alert("Atenção", "Digite um e-mail válido.");
      return;
    }

    if (!auth) {
      Alert.alert("Erro ao entrar", "A autenticação não está disponível.");
      return;
    }

    try {
      await auth.login(formattedEmail, password);
    } catch (error) {
      Alert.alert(
        "Erro ao entrar",
        error instanceof Error
          ? error.message
          : "Não foi possível acessar sua conta.",
      );
    }
  }

  function handleBack() {
    Keyboard.dismiss();
    navigation.navigate("BoasVindas");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar para boas-vindas"
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <ArrowLeft size={19} color="#3F51E8" strokeWidth={2.3} />
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>

          <View style={styles.logoArea}>
            <Image
              source={require("../../assets/images/logo-fitmap.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.logoSubtitle}>
              Academias e exercícios em um só lugar
            </Text>
          </View>

          <Text style={styles.title}>Entrar na conta</Text>

          <Text style={styles.subtitle}>
            Acesse o app para localizar academias próximas, comparar opções e
            acompanhar seus exercícios.
          </Text>

          <Text style={styles.label}>E-mail</Text>

          <CustomInput
            placeholder="Digite seu e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Senha</Text>

          <CustomInput
            placeholder="Digite sua senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <CustomButton title="Entrar" onPress={handleLogin} />

          <View style={styles.divider} />

          <Text style={styles.registerText}>Ainda não possui conta?</Text>

          <CustomButton
            title="Criar nova conta"
            onPress={() => navigation.navigate("Cadastro")}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 8,
  },

  backButtonPressed: {
    opacity: 0.6,
  },

  backButtonText: {
    color: "#3F51E8",
    fontSize: 14,
    fontWeight: "700",
  },

  logoArea: {
    alignItems: "center",
    marginBottom: 20,
  },

  logoImage: {
    width: 210,
    height: 160,
    marginBottom: 4,
  },

  logoSubtitle: {
    fontSize: 13,
    color: "#4b5563",
    fontWeight: "700",
    textAlign: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: "#4b5563",
    marginBottom: 20,
    lineHeight: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 16,
  },

  registerText: {
    textAlign: "center",
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
});
