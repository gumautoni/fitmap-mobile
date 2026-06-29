import React, { useContext, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';

export default function RegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function isValidEmail(value) {
    return /\S+@\S+\.\S+/.test(value);
  }

  async function handleRegister() {
    Keyboard.dismiss();

    const formattedName = name.trim();
    const formattedEmail = email.trim().toLowerCase();
    const formattedPassword = password.trim();
    const formattedConfirmPassword = confirmPassword.trim();

    if (!formattedName || !formattedEmail || !formattedPassword || !formattedConfirmPassword) {
      Alert.alert('Atenção', 'Preencha todos os campos para criar sua conta.');
      return;
    }

    if (formattedName.length < 3) {
      Alert.alert('Atenção', 'Digite um nome com pelo menos 3 caracteres.');
      return;
    }

    if (!isValidEmail(formattedEmail)) {
      Alert.alert('Atenção', 'Digite um e-mail válido.');
      return;
    }

    if (formattedPassword.length < 4) {
      Alert.alert('Atenção', 'A senha precisa ter pelo menos 4 caracteres.');
      return;
    }

    if (formattedPassword !== formattedConfirmPassword) {
      Alert.alert('Atenção', 'As senhas digitadas não são iguais.');
      return;
    }

    try {
      await register(formattedName, formattedEmail, formattedPassword);
    } catch (error) {
      Alert.alert(
        'Erro ao cadastrar',
        error.message || 'Não foi possível criar sua conta. Tente novamente.'
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.logoArea}>
            <Image
              source={require('../../assets/images/logo-fitmap.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.logoSubtitle}>
              Crie sua conta para começar
            </Text>
          </View>

          <Text style={styles.title}>Criar conta</Text>

          <Text style={styles.subtitle}>
            Cadastre-se para salvar seus exercícios, registrar fotos e encontrar academias com facilidade.
          </Text>

          <Text style={styles.label}>Nome completo</Text>
          <CustomInput
            placeholder="Digite seu nome"
            value={name}
            onChangeText={setName}
          />

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

          <Text style={styles.label}>Confirmar senha</Text>
          <CustomInput
            placeholder="Digite a senha novamente"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <CustomButton title="Cadastrar" onPress={handleRegister} />

          <View style={styles.divider} />

          <Text style={styles.loginText}>Já possui conta?</Text>

          <CustomButton
            title="Voltar para login"
            onPress={() => navigation.goBack()}
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
    backgroundColor: '#f3f4f6',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 210,
    height: 150,
    marginBottom: 4,
  },
  logoSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '700',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  loginText: {
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
});