import React, { useContext } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import CustomButton from '../components/CustomButton';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const firstName = user?.name?.split(' ')[0] || 'usuário';

  function confirmLogout() {
    Alert.alert(
      'Sair do FitMap',
      'Tem certeza que deseja sair da sua conta?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.homeLogoBox}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.homeLogo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.welcome}>Olá, {firstName}</Text>

        <Text style={styles.subtitle}>
          Localize academias próximas, compare opções e registre seus exercícios de forma simples.
        </Text>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Acesso rápido</Text>

        <View style={styles.actionCard}>
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle}>Mapa de academias</Text>
            <Text style={styles.actionText}>
              Pesquise academias por cidade, bairro ou pela sua localização atual.
            </Text>
          </View>

          <CustomButton
            title="Abrir mapa"
            onPress={() => navigation.navigate('Mapa')}
          />
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle}>Meus exercícios</Text>
            <Text style={styles.actionText}>
              Cadastre exercícios, marque como concluídos e registre fotos do seu progresso.
            </Text>
          </View>

          <CustomButton
            title="Gerenciar exercícios"
            onPress={() => navigation.navigate('Tarefas')}
            variant="secondary"
          />
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Funcionalidades do app</Text>

        <View style={styles.featureItem}>
          <Text style={styles.featureNumber}>01</Text>
          <View style={styles.featureTextBlock}>
            <Text style={styles.featureTitle}>Busca inteligente</Text>
            <Text style={styles.featureText}>
              Encontre academias próximas utilizando mapa, busca por região e localização atual.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureNumber}>02</Text>
          <View style={styles.featureTextBlock}>
            <Text style={styles.featureTitle}>Comparação de opções</Text>
            <Text style={styles.featureText}>
              Visualize distância, endereço, contato, site, rota e preço estimado.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureNumber}>03</Text>
          <View style={styles.featureTextBlock}>
            <Text style={styles.featureTitle}>Controle de exercícios</Text>
            <Text style={styles.featureText}>
              Organize seus treinos e registre exercícios concluídos com foto.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Protótipo funcional</Text>
        <Text style={styles.footerText}>
          Aplicativo desenvolvido para localização de academias e acompanhamento de exercícios.
        </Text>
      </View>

      <CustomButton
        title="Sair da conta"
        onPress={confirmLogout}
        variant="secondary"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  homeLogoBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
  },
  homeLogo: {
    width: 210,
    height: 120,
  },
  welcome: {
    fontSize: 16,
    fontWeight: '800',
    color: '#93c5fd',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 23,
  },
  quickActions: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  actionTextBlock: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 5,
  },
  actionText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 18,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  featureNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '900',
    fontSize: 12,
    paddingTop: 8,
  },
  featureTextBlock: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  footerCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 14,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#166534',
    marginBottom: 5,
  },
  footerText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
});