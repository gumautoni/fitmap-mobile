import * as Location from "expo-location";
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

import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import {
  searchGymsByLocation,
  searchNearbyGyms,
  type GymSearchResult,
} from "../services/gyms";
import { calculateDistanceKm } from "../utils/distance";

const INITIAL_REGION: Region = {
  latitude: -22.4708,
  longitude: -43.825,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const RESULT_REGION_DELTA = 0.05;
const NEARBY_RADIUS_METERS = 5_000;

interface UserCoordinates {
  latitude: number;
  longitude: number;
}

type LoadingAction = "text" | "location" | null;

type Props = AppStackScreenProps<"Mapa">;

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

function getCoordinatesRegion(coordinates: UserCoordinates): Region {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    latitudeDelta: RESULT_REGION_DELTA,
    longitudeDelta: RESULT_REGION_DELTA,
  };
}

function getSearchErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "gym_provider_unavailable") {
      return "O serviço de academias está indisponível no momento. Tente novamente em instantes.";
    }

    return "Não foi possível concluir a busca de academias.";
  }

  if (error instanceof Error && error.message === "The request timed out.") {
    return "A busca demorou mais do que o esperado. Tente novamente.";
  }

  return "Não foi possível conectar ao backend do FitMap. Verifique a conexão e tente novamente.";
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m de distância`;
  }

  return `${distanceKm.toFixed(1).replace(".", ",")} km de distância`;
}

export default function MapScreen({ navigation }: Props) {
  const mapRef = useRef<MapView | null>(null);

  const [query, setQuery] = useState("");
  const [gyms, setGyms] = useState<GymSearchResult[]>([]);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [userCoordinates, setUserCoordinates] =
    useState<UserCoordinates | null>(null);

  const loading = loadingAction !== null;

  const mappableGyms = useMemo(
    () => gyms.filter((gym) => gym.coordinates !== null),
    [gyms],
  );

  function focusSearchResults(
    results: GymSearchResult[],
    fallbackCoordinates?: UserCoordinates,
  ): void {
    const firstGymWithCoordinates = results.find(
      (gym) => gym.coordinates !== null,
    );

    if (firstGymWithCoordinates) {
      const nextRegion = getGymRegion(firstGymWithCoordinates);

      if (nextRegion) {
        mapRef.current?.animateToRegion(nextRegion, 800);
      }

      return;
    }

    if (fallbackCoordinates) {
      mapRef.current?.animateToRegion(
        getCoordinatesRegion(fallbackCoordinates),
        800,
      );
    }
  }

  async function handleSearch(): Promise<void> {
    Keyboard.dismiss();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setErrorMessage("Digite uma cidade, bairro ou região para buscar.");
      return;
    }

    try {
      setLoadingAction("text");
      setErrorMessage(null);
      setGyms([]);
      setSelectedGymId(null);

      const results = await searchGymsByLocation(normalizedQuery);

      setGyms(results);
      setSearchedPlace(normalizedQuery);
      setHasSearched(true);

      focusSearchResults(results);
    } catch (error: unknown) {
      setGyms([]);
      setSearchedPlace(normalizedQuery);
      setHasSearched(true);
      setSelectedGymId(null);
      setErrorMessage(getSearchErrorMessage(error));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleUseCurrentLocation(): Promise<void> {
    Keyboard.dismiss();
    setLoadingAction("location");
    setErrorMessage(null);

    let currentCoordinates: UserCoordinates;

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setErrorMessage(
          "Permissão de localização negada. Você ainda pode pesquisar academias por cidade, bairro ou região.",
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      currentCoordinates = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setUserCoordinates(currentCoordinates);
    } catch {
      setErrorMessage(
        "Não foi possível obter sua localização atual. Verifique se a localização do aparelho está ativada e tente novamente.",
      );
      return;
    } finally {
      setLoadingAction(null);
    }

    try {
      setLoadingAction("location");
      setGyms([]);
      setSelectedGymId(null);
      setSearchedPlace("Sua localização atual");
      setHasSearched(true);

      const results = await searchNearbyGyms(
        currentCoordinates.latitude,
        currentCoordinates.longitude,
        NEARBY_RADIUS_METERS,
      );

      setGyms(results);

      focusSearchResults(results, currentCoordinates);
    } catch (error: unknown) {
      setGyms([]);
      setSelectedGymId(null);
      setSearchedPlace("Sua localização atual");
      setHasSearched(true);
      setErrorMessage(getSearchErrorMessage(error));

      mapRef.current?.animateToRegion(
        getCoordinatesRegion(currentCoordinates),
        800,
      );
    } finally {
      setLoadingAction(null);
    }
  }

  function handleSelectGym(gym: GymSearchResult): void {
    setSelectedGymId(gym.id);

    const nextRegion = getGymRegion(gym);

    if (nextRegion) {
      mapRef.current?.animateToRegion(nextRegion, 500);
    }
  }

  function handleOpenGymDetails(
    gym: GymSearchResult,
    distanceKm: number | null,
  ): void {
    setSelectedGymId(gym.id);

    navigation.navigate("DetalhesAcademia", {
      gymId: gym.id,
      distanceKm,
    });
  }

  const listHeader = (
    <View>
      <View style={styles.searchPanel}>
        <Text style={styles.screenTitle}>Encontre academias</Text>

        <Text style={styles.screenSubtitle}>
          Pesquise por cidade, bairro ou região ou use sua localização atual
          para encontrar academias próximas.
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
              {loadingAction === "text" ? "..." : "Buscar"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[
            styles.locationButton,
            loading && styles.locationButtonDisabled,
          ]}
          onPress={handleUseCurrentLocation}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.locationButtonText}>
            {loadingAction === "location"
              ? "Obtendo sua localização..."
              : "Usar minha localização"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.locationHint}>
          O FitMap solicitará acesso à sua localização somente ao usar esta
          opção.
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapWrapper}>
        <MapView ref={mapRef} style={styles.map} initialRegion={INITIAL_REGION}>
          {userCoordinates ? (
            <Marker
              coordinate={userCoordinates}
              title="Sua localização"
              description="Localização atual utilizada pelo FitMap"
              pinColor="#2563EB"
            />
          ) : null}

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
          {loadingAction === "location"
            ? "Buscando academias próximas..."
            : loadingAction === "text"
              ? "Buscando academias..."
              : errorMessage
                ? "Não foi possível concluir a busca"
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

        {hasSearched && gyms.length > 0 && !errorMessage ? (
          <Text style={styles.resultsMapInfo}>
            {mappableGyms.length} de {gyms.length} resultado(s) possuem
            localização disponível para exibição no mapa.
          </Text>
        ) : null}

        {userCoordinates && hasSearched && !errorMessage ? (
          <Text style={styles.resultsMapInfo}>
            Distâncias calculadas a partir da sua localização atual.
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

        const distanceKm =
          userCoordinates && item.coordinates
            ? calculateDistanceKm(
                userCoordinates.latitude,
                userCoordinates.longitude,
                item.coordinates.latitude,
                item.coordinates.longitude,
              )
            : null;

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

            {distanceKm !== null ? (
              <Text style={styles.gymDistance}>
                {formatDistance(distanceKm)}
              </Text>
            ) : null}

            <Text style={styles.gymLocationStatus}>
              {item.coordinates
                ? "Localização disponível no mapa"
                : "Localização exata não informada"}
            </Text>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => handleOpenGymDetails(item, distanceKm)}
              activeOpacity={0.85}
            >
              <Text style={styles.detailsButtonText}>Ver detalhes</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          {loading ? (
            <>
              <ActivityIndicator size="large" />
              <Text style={styles.emptyText}>
                {loadingAction === "location"
                  ? "Buscando academias próximas..."
                  : "Buscando academias..."}
              </Text>
            </>
          ) : hasSearched && !errorMessage ? (
            <Text style={styles.emptyText}>
              Nenhuma academia foi encontrada para essa região.
            </Text>
          ) : !hasSearched ? (
            <Text style={styles.emptyText}>
              Digite uma cidade, bairro ou região ou use sua localização para
              iniciar a busca.
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
  searchDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
  },
  locationButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "900",
  },
  locationHint: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
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
  gymDistance: {
    marginTop: 9,
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "900",
  },
  gymLocationStatus: {
    marginTop: 9,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
  detailsButton: {
    marginTop: 14,
    backgroundColor: "#EAF2FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 11,
    alignItems: "center",
  },
  detailsButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "900",
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
