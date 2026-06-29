import React from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function GymDetailsScreen({ navigation, route }) {
  const gym = route?.params?.gym;

  if (!gym) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorCard}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.errorLogo}
            resizeMode="contain"
          />

          <Text style={styles.errorTitle}>Academia não encontrada</Text>

          <Text style={styles.errorText}>
            Não foi possível carregar os detalhes da academia selecionada.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isDemo = gym.source === 'demo';
  const address = gym.address || 'Endereço não informado';
  const phone = gym.phone || 'Não informado';
  const website = gym.website || '';
  const distance = Number(gym.distanceKm || 0);
  const price = Number(gym.monthlyPrice || 0);

  async function openRoute() {
    try {
      const url = `https://www.google.com/maps/search/?api=1&query=${gym.latitude},${gym.longitude}`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir a rota no mapa.');
    }
  }

  async function openWebsite() {
    if (!website) {
      Alert.alert('Site indisponível', 'Esta academia não possui site cadastrado.');
      return;
    }

    try {
      const hasProtocol = website.startsWith('http://') || website.startsWith('https://');
      const url = hasProtocol ? website : `https://${website}`;

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o site da academia.');
    }
  }

  async function callGym() {
    if (!phone || phone === 'Não informado') {
      Alert.alert('Telefone indisponível', 'Esta academia não possui telefone cadastrado.');
      return;
    }

    try {
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      await Linking.openURL(`tel:${cleanPhone}`);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível iniciar a ligação.');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.label}>Academia selecionada</Text>
        <Text style={styles.title}>{gym.name || 'Academia sem nome'}</Text>
        <Text style={styles.address}>{address}</Text>

        {isDemo ? (
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>Resultado demonstrativo</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Distância</Text>
          <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Preço estimado</Text>
          <Text style={styles.statValue}>R$ {price.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Informações da academia</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Endereço</Text>
          <Text style={styles.infoText}>{address}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Telefone</Text>
          <Text style={styles.infoText}>{phone}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Site</Text>
          <Text style={styles.infoText}>{website ? website : 'Não informado'}</Text>
        </View>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Observação</Text>

        {isDemo ? (
          <Text style={styles.noteText}>
            Este é um resultado demonstrativo criado automaticamente porque a busca pública
            de academias não retornou dados suficientes para sua localização atual.
          </Text>
        ) : (
          <Text style={styles.noteText}>
            As informações são obtidas de bases públicas de mapa. Alguns dados podem estar
            incompletos, desatualizados ou sem telefone/site cadastrado.
          </Text>
        )}

        <Text style={styles.noteText}>
          O valor da mensalidade é apenas uma estimativa para fins de comparação no protótipo.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={openRoute}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryButtonText}>Abrir rota no mapa</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={callGym}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Ligar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={openWebsite}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Abrir site</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Text style={styles.backButtonText}>Voltar ao mapa</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  errorLogo: {
    width: 200,
    height: 120,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  headerCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },
  logoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 190,
    height: 105,
  },
  label: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  address: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 14,
  },
  demoBadgeText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  statValue: {
    color: '#2563EB',
    fontSize: 20,
    fontWeight: '900',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },
  infoItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  infoText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  noteCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#166534',
    marginBottom: 10,
  },
  noteText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#EAF2FF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontWeight: '900',
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backButtonText: {
    color: '#111827',
    fontWeight: '900',
  },
});