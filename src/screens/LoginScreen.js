import React, { useContext, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function isValidEmail(value) {
    return /\S+@\S+\.\S+/.test(value);
  }

  async function handleLogin() {
    Keyboard.dismiss();

    const formattedEmail = email.trim().toLowerCase();
    const formattedPassword = password.trim();

    if (!formattedEmail || !formattedPassword) {
      Alert.alert('Atenção', 'Preencha o e-mail e a senha para continuar.');
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

    try {
      await login(formattedEmail, formattedPassword);
    } catch (error) {
      Alert.alert(
        'Erro ao entrar',
        error.message || 'Não foi possível acessar sua conta. Verifique os dados informados.'
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <Text style={styles.logoSubtitle}>
            Academias e exercícios em um só lugar
          </Text>
        </View>

        <Text style={styles.title}>Entrar na conta</Text>

        <Text style={styles.subtitle}>
          Acesse o app para localizar academias próximas, comparar opções e acompanhar seus exercícios.
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
          onPress={() => navigation.navigate('Cadastro')}
          variant="secondary"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f3f4f6',
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
    height: 160,
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
  registerText: {
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
});