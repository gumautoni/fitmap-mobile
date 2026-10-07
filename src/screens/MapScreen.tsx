import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import { searchGymsByLocation, type GymSearchResult } from "../services/gyms";

const INITIAL_REGION: Region = {
  latitude: -22.4708,
  longitude: -43.825,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const RESULT_REGION_DELTA = 0.05;

function getGymRegion(gym: GymSearchResult): Region | null {
  if (!gym.coordinates) {
    return null;
  }

  return {
    latitude: gym.coordinates.latitude,
    longitude: gym.coordinates.longitude,
    latitudeDelta: RESULT_REGION_DELTA,
    longitudeDelta: RESULT_REGION_DELTA,
  };
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [query, setQuery] = useState("");
  const [gyms, setGyms] = useState<GymSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  const mappableGyms = useMemo(
    () => gyms.filter((gym) => gym.coordinates !== null),
    [gyms],
  );

  async function handleSearch(): Promise<void> {
    Keyboard.dismiss();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setErrorMessage("Digite uma cidade, bairro ou região para buscar.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setGyms([]);
      setSelectedGymId(null);

      const results = await searchGymsByLocation(normalizedQuery);

      setGyms(results);
      setSearchedPlace(normalizedQuery);
      setHasSearched(true);

      const firstGymWithCoordinates = results.find(
        (gym) => gym.coordinates !== null,
      );

      if (firstGymWithCoordinates) {
        const nextRegion = getGymRegion(firstGymWithCoordinates);

        if (nextRegion) {
          mapRef.current?.animateToRegion(nextRegion, 800);
        }
      }
    } catch (error: unknown) {
      setGyms([]);
      setSearchedPlace(normalizedQuery);
      setHasSearched(true);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível buscar academias no momento.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSelectGym(gym: GymSearchResult): void {
    setSelectedGymId(gym.id);

    const nextRegion = getGymRegion(gym);

    if (nextRegion) {
      mapRef.current?.animateToRegion(nextRegion, 500);
    }
  }

  const listHeader = (
    <View>
      <View style={styles.searchPanel}>
        <Text style={styles.screenTitle}>Encontre academias</Text>

        <Text style={styles.screenSubtitle}>
          Pesquise por cidade, bairro ou região. Os resultados abaixo vêm do
          backend do FitMap.
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Ex.: Barra do Piraí"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            editable={!loading}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[
              styles.searchButton,
              loading && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.searchButtonText}>
              {loading ? "..." : "Buscar"}
            </Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapWrapper}>
        <MapView ref={mapRef} style={styles.map} initialRegion={INITIAL_REGION}>
          {mappableGyms.map((gym) => {
            if (!gym.coordinates) {
              return null;
            }

            return (
              <Marker
                key={gym.id}
                coordinate={{
                  latitude: gym.coordinates.latitude,
                  longitude: gym.coordinates.longitude,
                }}
                title={gym.name}
                description={gym.address ?? undefined}
                pinColor={selectedGymId === gym.id ? "#16A34A" : "#DC2626"}
                onPress={() => handleSelectGym(gym)}
              />
            );
          })}
        </MapView>
      </View>

      <View style={styles.resultsCard}>
        <Text style={styles.resultsTitle}>
          {loading
            ? "Buscando academias..."
            : hasSearched
              ? `${gyms.length} academia(s) encontrada(s)`
              : "Busque uma região para começar"}
        </Text>

        {searchedPlace ? (
          <Text style={styles.resultsSubtitle}>
            Região pesquisada: {searchedPlace}
          </Text>
        ) : (
          <Text style={styles.resultsSubtitle}>
            As academias disponíveis serão exibidas na lista e no mapa quando
            houver coordenadas.
          </Text>
        )}

        {hasSearched && gyms.length > 0 ? (
          <Text style={styles.resultsMapInfo}>
            {mappableGyms.length} de {gyms.length} resultado(s) possuem
            localização disponível para exibição no mapa.
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList<GymSearchResult>
      style={styles.container}
      data={gyms}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const isSelected = selectedGymId === item.id;

        return (
          <TouchableOpacity
            style={[styles.gymCard, isSelected && styles.gymCardSelected]}
            onPress={() => handleSelectGym(item)}
            activeOpacity={0.85}
          >
            <View style={styles.gymCardHeader}>
              <Text style={styles.gymName}>{item.name}</Text>

              {isSelected ? (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selecionada</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.gymAddress}>
              {item.address ?? "Endereço não informado"}
            </Text>

            <Text style={styles.gymLocationStatus}>
              {item.coordinates
                ? "Localização disponível no mapa"
                : "Localização exata não informada"}
            </Text>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          {loading ? (
            <>
              <ActivityIndicator size="large" />
              <Text style={styles.emptyText}>Buscando academias...</Text>
            </>
          ) : hasSearched && !errorMessage ? (
            <Text style={styles.emptyText}>
              Nenhuma academia foi encontrada para essa região.
            </Text>
          ) : !hasSearched ? (
            <Text style={styles.emptyText}>
              Digite uma cidade, bairro ou região para iniciar a busca.
            </Text>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
    shadowColor: "#111827",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  screenSubtitle: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    color: "#111827",
    fontWeight: "600",
  },
  searchButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 82,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  errorBox: {
    marginTop: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  mapWrapper: {
    height: 270,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  resultsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "900",
  },
  resultsSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 18,
  },
  resultsMapInfo: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 8,
    lineHeight: 17,
  },
  gymCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  gymCardSelected: {
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
  },
  gymCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  gymName: {
    flex: 1,
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  selectedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  selectedBadgeText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "900",
  },
  gymAddress: {
    marginTop: 7,
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
  },
  gymLocationStatus: {
    marginTop: 9,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
