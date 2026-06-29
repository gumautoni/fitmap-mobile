import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import GymCard from '../components/GymCard';
import { geocodeRegion } from '../services/geocoding';
import { fetchNearbyGyms } from '../services/overpass';
import { requestForegroundLocation } from '../services/location';

export default function MapScreen({ navigation }) {
  const mapRef = useRef(null);

  const [query, setQuery] = useState('');
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState('');
  const [sortMode, setSortMode] = useState('distance');
  const [region, setRegion] = useState({
    latitude: -22.6077,
    longitude: -43.7108,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const cheapestGym = useMemo(() => {
    if (!gyms.length) return null;
    return [...gyms].sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0];
  }, [gyms]);

  const filteredGyms = useMemo(() => {
    const nextGyms = [...gyms];

    if (sortMode === 'price') {
      nextGyms.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    }

    if (sortMode === 'distance') {
      nextGyms.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    if (sortMode === 'contact') {
      nextGyms.sort((a, b) => {
        const aHasContact = a.phone !== 'Não informado' || !!a.website;
        const bHasContact = b.phone !== 'Não informado' || !!b.website;

        if (aHasContact === bHasContact) {
          return a.distanceKm - b.distanceKm;
        }

        return aHasContact ? -1 : 1;
      });
    }

    return nextGyms;
  }, [gyms, sortMode]);

  async function loadGymsByCoords(latitude, longitude, placeLabel = '') {
    try {
      setLoading(true);

      const data = await fetchNearbyGyms(latitude, longitude);

      setGyms(data);
      setSearchedPlace(placeLabel);
    } catch (error) {
      setGyms([]);
      Alert.alert(
        'Busca sem resultado',
        error.message || 'Não foi possível buscar academias próximas.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUseCurrentLocation() {
    try {
      Keyboard.dismiss();
      setLoading(true);

      const current = await requestForegroundLocation();

      const nextRegion = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };

      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 1000);

      await loadGymsByCoords(
        nextRegion.latitude,
        nextRegion.longitude,
        'sua localização atual'
      );
    } catch (error) {
      Alert.alert(
        'Erro',
        error.message || 'Não foi possível obter sua localização.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    Keyboard.dismiss();

    if (!query.trim()) {
      Alert.alert('Atenção', 'Digite uma cidade, bairro ou região.');
      return;
    }

    try {
      setLoading(true);

      const place = await geocodeRegion(query.trim());

      const nextRegion = {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };

      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 1000);

      const data = await fetchNearbyGyms(
        nextRegion.latitude,
        nextRegion.longitude
      );

      setGyms(data);
      setSearchedPlace(query.trim());
    } catch (error) {
      setGyms([]);
      Alert.alert(
        'Busca sem resultado',
        error.message || 'Não foi possível localizar a região.'
      );
    } finally {
      setLoading(false);
    }
  }

  const hasResults = gyms.length > 0;

  const listHeader = (
    <View>
      <View style={styles.searchPanel}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.screenTitle}>Encontre academias próximas</Text>

        <Text style={styles.screenSubtitle}>
          Busque por cidade, bairro ou use sua localização atual para comparar academias no mapa.
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Ex.: Volta Redonda"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.disabledButton]}
            onPress={handleSearch}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.searchButtonText}>
              {loading ? '...' : 'Buscar'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.locationButton, loading && styles.disabledLocationButton]}
          onPress={handleUseCurrentLocation}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.locationButtonText}>
            Usar minha localização
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          region={region}
        >
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            title="Centro da busca"
            pinColor="#2563EB"
          />

          {gyms.map((gym) => (
            <Marker
              key={gym.id}
              coordinate={{
                latitude: gym.latitude,
                longitude: gym.longitude,
              }}
              title={gym.name}
              description={`Preço estimado: R$ ${gym.monthlyPrice.toFixed(2)}`}
            />
          ))}
        </MapView>
      </View>

      <View style={styles.resultsCard}>
        <View>
          <Text style={styles.resultsTitle}>
            {loading
              ? 'Buscando academias...'
              : `${gyms.length} academia(s) encontrada(s)`}
          </Text>

          {searchedPlace ? (
            <Text style={styles.resultsSubtitle}>Região: {searchedPlace}</Text>
          ) : (
            <Text style={styles.resultsSubtitle}>
              Faça uma busca ou use sua localização para começar.
            </Text>
          )}
        </View>
      </View>

      {hasResults ? (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              sortMode === 'distance' && styles.filterButtonActive,
            ]}
            onPress={() => setSortMode('distance')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.filterButtonText,
                sortMode === 'distance' && styles.filterButtonTextActive,
              ]}
            >
              Mais próximas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              sortMode === 'price' && styles.filterButtonActive,
            ]}
            onPress={() => setSortMode('price')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.filterButtonText,
                sortMode === 'price' && styles.filterButtonTextActive,
              ]}
            >
              Menor preço
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              sortMode === 'contact' && styles.filterButtonActive,
            ]}
            onPress={() => setSortMode('contact')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.filterButtonText,
                sortMode === 'contact' && styles.filterButtonTextActive,
              ]}
            >
              Com contato
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {cheapestGym ? (
        <TouchableOpacity
          style={styles.highlightBox}
          onPress={() =>
            navigation.navigate('DetalhesAcademia', { gym: cheapestGym })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.highlightTag}>Mais em conta</Text>
          <Text style={styles.highlightTitle}>{cheapestGym.name}</Text>
          <Text style={styles.highlightPrice}>
            R$ {cheapestGym.monthlyPrice.toFixed(2)} por mês
          </Text>
          <Text style={styles.highlightText}>
            Toque para ver detalhes e rota.
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={filteredGyms}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <GymCard
          gym={item}
          onPress={() =>
            navigation.navigate('DetalhesAcademia', { gym: item })
          }
        />
      )}
      ListHeaderComponent={listHeader}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        !loading ? (
          <Text style={styles.emptyText}>
            Nenhuma academia encontrada ainda. Pesquise uma região ou use sua localização atual.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  searchPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 180,
    height: 95,
  },
  screenTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    color: '#111827',
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 82,
  },
  disabledButton: {
    backgroundColor: '#93C5FD',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  locationButton: {
    backgroundColor: '#EAF2FF',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  disabledLocationButton: {
    opacity: 0.7,
  },
  locationButtonText: {
    color: '#1D4ED8',
    fontWeight: '900',
  },
  mapWrapper: {
    height: 270,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '900',
  },
  resultsSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
  },
  filterButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '900',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  highlightBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  highlightTag: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  highlightTitle: {
    color: '#064E3B',
    fontWeight: '900',
    fontSize: 17,
    marginBottom: 4,
  },
  highlightPrice: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 15,
    marginBottom: 4,
  },
  highlightText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 16,
    lineHeight: 20,
  },
});