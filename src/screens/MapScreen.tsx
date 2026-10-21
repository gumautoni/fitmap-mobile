import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  AlertCircle,
  ArrowRight,
  Dumbbell,
  Heart,
  MapPin,
  Navigation,
  Search,
} from "lucide-react-native";
import React, {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import { AuthContext } from "../context/AuthContext";
import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import {
  getFavoriteGyms,
  searchGymsByLocation,
  searchNearbyGyms,
  type FavoriteGym,
  type GymSearchResult,
} from "../services/gyms";
import { useAppTheme } from "../theme/ThemeProvider";
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

function getFavoritesErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return "Não foi possível conectar ao servidor para carregar seus favoritos.";
    }

    if (error.message === "The request timed out.") {
      return "A sincronização dos favoritos demorou mais do que o esperado.";
    }

    if (error.message === "Sua sessão expirou. Entre novamente.") {
      return error.message;
    }
  }

  return "Não foi possível sincronizar suas academias favoritas.";
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m de distância`;
  }

  return `${distanceKm.toFixed(1).replace(".", ",")} km de distância`;
}

export default function MapScreen({ navigation }: Props) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("MapScreen must be rendered inside AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const mapRef = useRef<MapView | null>(null);

  const favoritesRequestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [gyms, setGyms] = useState<GymSearchResult[]>([]);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [userCoordinates, setUserCoordinates] =
    useState<UserCoordinates | null>(null);

  const [favoriteGyms, setFavoriteGyms] = useState<FavoriteGym[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesErrorMessage, setFavoritesErrorMessage] = useState<
    string | null
  >(null);

  const loading = loadingAction !== null;

  const mappableGyms = useMemo(
    () => gyms.filter((gym) => gym.coordinates !== null),
    [gyms],
  );

  const favoriteExternalIds = useMemo(
    () => new Set(favoriteGyms.map((favorite) => favorite.externalId)),
    [favoriteGyms],
  );

  const loadFavorites = useCallback(async (): Promise<void> => {
    const requestId = favoritesRequestIdRef.current + 1;

    favoritesRequestIdRef.current = requestId;

    try {
      setFavoritesLoading(true);
      setFavoritesErrorMessage(null);

      const favorites = await runAuthenticatedRequest((accessToken) =>
        getFavoriteGyms(accessToken),
      );

      if (favoritesRequestIdRef.current === requestId) {
        setFavoriteGyms(favorites);
      }
    } catch (error: unknown) {
      if (favoritesRequestIdRef.current === requestId) {
        setFavoriteGyms([]);
        setFavoritesErrorMessage(getFavoritesErrorMessage(error));
      }
    } finally {
      if (favoritesRequestIdRef.current === requestId) {
        setFavoritesLoading(false);
      }
    }
  }, [runAuthenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();

      return () => {
        favoritesRequestIdRef.current += 1;
      };
    }, [loadFavorites]),
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

  function handleOpenFavoriteGym(favorite: FavoriteGym): void {
    navigation.navigate("DetalhesAcademia", {
      gymId: favorite.externalId,
      distanceKm: null,
    });
  }

  function getResultsTitle(): string {
    if (loadingAction === "location") {
      return "Buscando academias próximas...";
    }

    if (loadingAction === "text") {
      return "Buscando academias...";
    }

    if (errorMessage) {
      return "Não foi possível concluir a busca";
    }

    if (hasSearched) {
      return gyms.length === 1
        ? "1 academia encontrada"
        : `${gyms.length} academias encontradas`;
    }

    return "Seu próximo treino pode começar aqui";
  }

  const listHeader = (
    <View>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>FITMAP DISCOVERY</Text>

        <Text style={styles.screenTitle}>Encontre onde treinar</Text>

        <Text style={styles.screenSubtitle}>
          Descubra academias por região ou encontre opções próximas da sua
          localização.
        </Text>
      </View>

      <View style={styles.favoritesSection}>
        <View style={styles.favoritesHeader}>
          <View style={styles.favoritesHeaderCopy}>
            <Text style={styles.favoritesEyebrow}>FAVORITOS</Text>

            <Text style={styles.favoritesTitle}>Suas academias salvas</Text>
          </View>

          {!favoritesLoading && !favoritesErrorMessage ? (
            <View style={styles.favoritesCount}>
              <Heart
                size={13}
                strokeWidth={2.3}
                color={theme.colors.primary}
                fill={favoriteGyms.length > 0 ? theme.colors.primary : "none"}
              />

              <Text style={styles.favoritesCountText}>
                {favoriteGyms.length}
              </Text>
            </View>
          ) : null}
        </View>

        {favoritesLoading ? (
          <View style={styles.favoriteStateCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />

            <View style={styles.favoriteStateCopy}>
              <Text style={styles.favoriteStateTitle}>
                Sincronizando favoritos
              </Text>

              <Text style={styles.favoriteStateText}>
                Carregando suas academias salvas.
              </Text>
            </View>
          </View>
        ) : favoritesErrorMessage ? (
          <View style={styles.favoriteErrorCard}>
            <AlertCircle
              size={19}
              strokeWidth={2.2}
              color={theme.colors.danger}
            />

            <View style={styles.favoriteStateCopy}>
              <Text style={styles.favoriteErrorTitle}>
                Favoritos indisponíveis
              </Text>

              <Text style={styles.favoriteStateText}>
                {favoritesErrorMessage}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar favoritos novamente"
                onPress={() => {
                  void loadFavorites();
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          </View>
        ) : favoriteGyms.length === 0 ? (
          <View style={styles.favoriteStateCard}>
            <View style={styles.favoriteEmptyIcon}>
              <Heart size={19} strokeWidth={2.2} color={theme.colors.primary} />
            </View>

            <View style={styles.favoriteStateCopy}>
              <Text style={styles.favoriteStateTitle}>
                Nenhuma academia favorita
              </Text>

              <Text style={styles.favoriteStateText}>
                Abra os detalhes de uma academia e salve as opções que deseja
                encontrar novamente.
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesScrollContent}
          >
            {favoriteGyms.map((favorite) => (
              <Pressable
                key={favorite.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir academia favorita ${favorite.name}`}
                onPress={() => handleOpenFavoriteGym(favorite)}
                style={({ pressed }) => [
                  styles.favoriteCard,
                  pressed && styles.favoriteCardPressed,
                ]}
              >
                <View style={styles.favoriteCardHeader}>
                  <View style={styles.favoriteCardIcon}>
                    <Heart
                      size={17}
                      strokeWidth={2.2}
                      color={theme.colors.primary}
                      fill={theme.colors.primary}
                    />
                  </View>

                  <View style={styles.favoriteCardCopy}>
                    <Text style={styles.favoriteCardName} numberOfLines={2}>
                      {favorite.name}
                    </Text>

                    <Text style={styles.favoriteCardAddress} numberOfLines={2}>
                      {favorite.address ?? "Endereço não informado"}
                    </Text>
                  </View>
                </View>

                <View style={styles.favoriteCardFooter}>
                  <Text style={styles.favoriteCardFooterText}>
                    Ver detalhes
                  </Text>

                  <ArrowRight
                    size={15}
                    strokeWidth={2.3}
                    color={theme.colors.primary}
                  />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchShell}>
          <Search size={20} strokeWidth={2.2} color={theme.colors.textMuted} />

          <TextInput
            style={styles.input}
            placeholder="Cidade, bairro ou região"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              void handleSearch();
            }}
            editable={!loading}
            autoCapitalize="words"
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar academias"
            onPress={() => {
              void handleSearch();
            }}
            disabled={loading}
            style={({ pressed }) => [
              styles.searchButton,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
          >
            {loadingAction === "text" ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.textOnPrimary}
              />
            ) : (
              <ArrowRight
                size={19}
                strokeWidth={2.5}
                color={theme.colors.textOnPrimary}
              />
            )}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usar minha localização"
          onPress={() => {
            void handleUseCurrentLocation();
          }}
          disabled={loading}
          style={({ pressed }) => [
            styles.locationAction,
            loading && styles.buttonDisabled,
            pressed && !loading && styles.locationActionPressed,
          ]}
        >
          <View style={styles.locationIcon}>
            {loadingAction === "location" ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Navigation
                size={18}
                strokeWidth={2.3}
                color={theme.colors.primary}
              />
            )}
          </View>

          <View style={styles.locationCopy}>
            <Text style={styles.locationActionTitle}>
              {loadingAction === "location"
                ? "Obtendo sua localização..."
                : "Usar minha localização"}
            </Text>

            <Text style={styles.locationActionText}>
              Buscar academias próximas em um raio de 5 km
            </Text>
          </View>

          <ArrowRight
            size={18}
            strokeWidth={2.2}
            color={theme.colors.textMuted}
          />
        </Pressable>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <View style={styles.errorIcon}>
              <AlertCircle
                size={18}
                strokeWidth={2.2}
                color={theme.colors.danger}
              />
            </View>

            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapCard}>
        <MapView ref={mapRef} style={styles.map} initialRegion={INITIAL_REGION}>
          {userCoordinates ? (
            <Marker
              coordinate={userCoordinates}
              title="Sua localização"
              description="Localização atual utilizada pelo FitMap"
            >
              <View style={styles.userMarkerOuter}>
                <View style={styles.userMarkerInner}>
                  <Navigation size={15} strokeWidth={2.6} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          ) : null}

          {mappableGyms.map((gym) => {
            if (!gym.coordinates) {
              return null;
            }

            const isSelected = selectedGymId === gym.id;

            return (
              <Marker
                key={gym.id}
                coordinate={{
                  latitude: gym.coordinates.latitude,
                  longitude: gym.coordinates.longitude,
                }}
                title={gym.name}
                description={gym.address ?? undefined}
                onPress={() => handleSelectGym(gym)}
              >
                <View
                  style={[
                    styles.gymMarkerOuter,
                    isSelected && styles.gymMarkerOuterSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.gymMarker,
                      isSelected && styles.gymMarkerSelected,
                    ]}
                  >
                    <Dumbbell
                      size={isSelected ? 17 : 15}
                      strokeWidth={2.5}
                      color="#FFFFFF"
                    />
                  </View>

                  <View
                    style={[
                      styles.markerPointer,
                      isSelected && styles.markerPointerSelected,
                    ]}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>

        <View pointerEvents="none" style={styles.mapBadge}>
          <MapPin size={14} strokeWidth={2.3} color={theme.colors.primary} />

          <Text style={styles.mapBadgeText}>Mapa FitMap</Text>
        </View>
      </View>

      <View style={styles.resultsSummary}>
        <View style={styles.resultsHeadingRow}>
          <View style={styles.resultsCopy}>
            <Text style={styles.resultsTitle}>{getResultsTitle()}</Text>

            {searchedPlace ? (
              <Text style={styles.resultsSubtitle}>{searchedPlace}</Text>
            ) : (
              <Text style={styles.resultsSubtitle}>
                Faça uma busca para ver academias no mapa e na lista.
              </Text>
            )}
          </View>

          {hasSearched && gyms.length > 0 && !errorMessage ? (
            <View style={styles.resultsCount}>
              <Text style={styles.resultsCountValue}>{gyms.length}</Text>
            </View>
          ) : null}
        </View>

        {hasSearched && gyms.length > 0 && !errorMessage ? (
          <View style={styles.resultsMetaRow}>
            <View style={styles.metaPill}>
              <MapPin
                size={13}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />

              <Text style={styles.metaText}>{mappableGyms.length} no mapa</Text>
            </View>

            {userCoordinates ? (
              <View style={styles.metaPill}>
                <Navigation
                  size={13}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />

                <Text style={styles.metaText}>Distância disponível</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {gyms.length > 0 ? (
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionEyebrow}>RESULTADOS</Text>

          <Text style={styles.listSectionTitle}>Academias encontradas</Text>
        </View>
      ) : null}
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
        const isFavorite = favoriteExternalIds.has(item.id);

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Selecionar ${item.name}`}
            onPress={() => handleSelectGym(item)}
            style={({ pressed }) => [
              styles.gymCard,
              isSelected && styles.gymCardSelected,
              pressed && styles.gymCardPressed,
            ]}
          >
            {isSelected ? <View style={styles.selectedAccent} /> : null}

            <View style={styles.gymCardHeader}>
              <View style={styles.gymIcon}>
                <Dumbbell
                  size={21}
                  strokeWidth={2.2}
                  color={
                    isSelected
                      ? theme.colors.textOnPrimary
                      : theme.colors.primary
                  }
                />
              </View>

              <View style={styles.gymTitleArea}>
                <Text style={styles.gymName} numberOfLines={2}>
                  {item.name}
                </Text>

                {isSelected || isFavorite ? (
                  <View style={styles.gymBadgesRow}>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>
                          Selecionada
                        </Text>
                      </View>
                    ) : null}

                    {isFavorite ? (
                      <View style={styles.favoriteBadge}>
                        <Heart
                          size={11}
                          strokeWidth={2.3}
                          color={theme.colors.primary}
                          fill={theme.colors.primary}
                        />

                        <Text style={styles.favoriteBadgeText}>Favorita</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.gymInfo}>
              <View style={styles.infoRow}>
                <MapPin
                  size={15}
                  strokeWidth={2.1}
                  color={theme.colors.textMuted}
                />

                <Text style={styles.gymAddress} numberOfLines={2}>
                  {item.address ?? "Endereço não informado"}
                </Text>
              </View>

              {distanceKm !== null ? (
                <View style={styles.infoRow}>
                  <Navigation
                    size={15}
                    strokeWidth={2.1}
                    color={theme.colors.primary}
                  />

                  <Text style={styles.gymDistance}>
                    {formatDistance(distanceKm)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.cardFooter}>
              <View
                style={[
                  styles.locationStatus,
                  !item.coordinates && styles.locationStatusMuted,
                ]}
              >
                <View
                  style={[
                    styles.locationStatusDot,
                    !item.coordinates && styles.locationStatusDotMuted,
                  ]}
                />

                <Text style={styles.locationStatusText}>
                  {item.coordinates
                    ? "Disponível no mapa"
                    : "Localização não informada"}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver detalhes de ${item.name}`}
                onPress={(event) => {
                  event.stopPropagation();

                  handleOpenGymDetails(item, distanceKm);
                }}
                style={({ pressed }) => [
                  styles.detailsButton,
                  pressed && styles.detailsButtonPressed,
                ]}
              >
                <Text style={styles.detailsButtonText}>Ver detalhes</Text>

                <ArrowRight
                  size={16}
                  strokeWidth={2.3}
                  color={theme.colors.textOnPrimary}
                />
              </Pressable>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          {loading ? (
            <>
              <View style={styles.emptyIcon}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>

              <Text style={styles.emptyTitle}>
                {loadingAction === "location"
                  ? "Buscando perto de você"
                  : "Procurando academias"}
              </Text>

              <Text style={styles.emptyText}>
                Estamos consultando as opções disponíveis.
              </Text>
            </>
          ) : hasSearched && !errorMessage ? (
            <>
              <View style={styles.emptyIcon}>
                <Search
                  size={22}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>Nenhuma academia encontrada</Text>

              <Text style={styles.emptyText}>
                Tente pesquisar outra cidade, bairro ou região.
              </Text>
            </>
          ) : !hasSearched ? (
            <>
              <View style={styles.emptyIcon}>
                <Dumbbell
                  size={23}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>
                Encontre seu espaço de treino
              </Text>

              <Text style={styles.emptyText}>
                Pesquise uma região ou use sua localização para começar.
              </Text>
            </>
          ) : null}
        </View>
      }
    />
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    listContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing["4xl"],
    },

    intro: {
      marginBottom: theme.spacing.xl,
    },

    eyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.8,
      marginBottom: 5,
    },

    screenTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.screenTitle,
      lineHeight: theme.typography.lineHeight.screenTitle,
      letterSpacing: -0.8,
      marginBottom: theme.spacing.sm,
    },

    screenSubtitle: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
      maxWidth: 330,
    },

    favoritesSection: {
      marginBottom: theme.spacing["2xl"],
    },

    favoritesHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },

    favoritesHeaderCopy: {
      flex: 1,
    },

    favoritesEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.7,
      marginBottom: 3,
    },

    favoritesTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
    },

    favoritesCount: {
      minWidth: 44,
      height: 38,
      paddingHorizontal: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    favoritesCountText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    favoriteStateCard: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    favoriteErrorCard: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.mode === "dark" ? "#321B20" : "#FEF2F2",
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "#593039" : "#FECACA",
    },

    favoriteEmptyIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    favoriteStateCopy: {
      flex: 1,
    },

    favoriteStateTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      marginBottom: 3,
    },

    favoriteErrorTitle: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      marginBottom: 3,
    },

    favoriteStateText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    retryButton: {
      alignSelf: "flex-start",
      marginTop: theme.spacing.sm,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    retryButtonPressed: {
      opacity: 0.72,
    },

    retryButtonText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    favoritesScrollContent: {
      paddingRight: theme.spacing.sm,
    },

    favoriteCard: {
      width: 240,
      padding: theme.spacing.md,
      marginRight: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    favoriteCardPressed: {
      opacity: 0.8,
      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    favoriteCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },

    favoriteCardIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    favoriteCardCopy: {
      flex: 1,
    },

    favoriteCardName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    favoriteCardAddress: {
      marginTop: 4,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    favoriteCardFooter: {
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 5,
    },

    favoriteCardFooterText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    searchArea: {
      marginBottom: theme.spacing.xl,
    },

    searchShell: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingLeft: theme.spacing.lg,
      paddingRight: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    input: {
      flex: 1,
      minHeight: 56,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.body,
      paddingVertical: 0,
    },

    searchButton: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },

    buttonDisabled: {
      opacity: 0.55,
    },

    buttonPressed: {
      transform: [
        {
          scale: 0.96,
        },
      ],
      opacity: 0.9,
    },

    locationAction: {
      marginTop: theme.spacing.md,
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radii.lg,
    },

    locationActionPressed: {
      opacity: 0.75,
      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    locationIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },

    locationCopy: {
      flex: 1,
    },

    locationActionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      marginBottom: 2,
    },

    locationActionText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    errorBox: {
      marginTop: theme.spacing.md,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.mode === "dark" ? "#321B20" : "#FEF2F2",
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "#593039" : "#FECACA",
    },

    errorIcon: {
      paddingTop: 1,
    },

    errorText: {
      flex: 1,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    mapCard: {
      height: 300,
      borderRadius: theme.radii.xl,
      overflow: "hidden",
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },

    map: {
      width: "100%",
      height: "100%",
    },

    mapBadge: {
      position: "absolute",
      top: 12,
      left: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.radii.full,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(14, 17, 24, 0.90)"
          : "rgba(255, 255, 255, 0.94)",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    mapBadgeText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    userMarkerOuter: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(92, 200, 255, 0.22)",
      borderWidth: 1,
      borderColor: "rgba(92, 200,255,0.50)",
    },

    userMarkerInner: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.techAccent,
    },

    gymMarkerOuter: {
      alignItems: "center",
    },

    gymMarkerOuterSelected: {
      transform: [
        {
          scale: 1.14,
        },
      ],
    },

    gymMarker: {
      width: 34,
      height: 34,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      shadowColor: "#10131A",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: {
        width: 0,
        height: 3,
      },
      elevation: 4,
    },

    gymMarkerSelected: {
      backgroundColor: theme.colors.primaryPressed,
      width: 38,
      height: 38,
      borderRadius: 14,
    },

    markerPointer: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 7,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: theme.colors.primary,
      marginTop: -1,
    },

    markerPointerSelected: {
      borderTopColor: theme.colors.primaryPressed,
    },

    resultsSummary: {
      paddingVertical: theme.spacing.md,
      marginBottom: theme.spacing["2xl"],
    },

    resultsHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    resultsCopy: {
      flex: 1,
    },

    resultsTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
    },

    resultsSubtitle: {
      marginTop: 3,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    resultsCount: {
      minWidth: 45,
      height: 45,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    resultsCountValue: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 17,
    },

    resultsMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },

    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    metaText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    listSectionHeader: {
      marginBottom: theme.spacing.md,
    },

    listSectionEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.7,
      marginBottom: 3,
    },

    listSectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
    },

    gymCard: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },

    gymCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.mode === "dark" ? "#171C30" : "#F8F8FF",
    },

    gymCardPressed: {
      opacity: 0.83,
      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    selectedAccent: {
      position: "absolute",
      left: 0,
      top: 16,
      bottom: 16,
      width: 3,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      backgroundColor: theme.colors.primary,
    },

    gymCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
    },

    gymIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    gymTitleArea: {
      flex: 1,
      alignItems: "flex-start",
    },

    gymName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
    },

    gymBadgesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6,
    },

    selectedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    selectedBadgeText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
    },

    favoriteBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    favoriteBadgeText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
    },

    gymInfo: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },

    gymAddress: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    gymDistance: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    cardFooter: {
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },

    locationStatus: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    locationStatusMuted: {
      opacity: 0.65,
    },

    locationStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
    },

    locationStatusDotMuted: {
      backgroundColor: theme.colors.textMuted,
    },

    locationStatusText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    detailsButtonPressed: {
      opacity: 0.82,
      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    detailsButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    emptyContainer: {
      alignItems: "center",
      paddingVertical: theme.spacing["3xl"],
      paddingHorizontal: theme.spacing.xl,
    },

    emptyIcon: {
      width: 50,
      height: 50,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
      marginBottom: theme.spacing.md,
    },

    emptyTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      textAlign: "center",
    },

    emptyText: {
      marginTop: 5,
      maxWidth: 285,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },
  });
}
