import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Location from "expo-location";
import type { ComponentProps, ContextType } from "react";

import { AuthContext } from "../../context/AuthContext";
import {
  getFavoriteGyms,
  searchGymsByLocation,
  searchNearbyGymsWithFallback,
  suggestGymLocations,
  type GymSearchResult,
  type LocationSuggestion,
} from "../../services/gyms";
import MapScreen from "../MapScreen";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://test-api/api/v1",
  },
}));

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  ArrowRight: () => null,
  Dumbbell: () => null,
  Heart: () => null,
  MapPin: () => null,
  Navigation: () => null,
  Search: () => null,
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  const MockMapView = React.forwardRef<
    { animateToRegion: (...args: unknown[]) => void },
    { children?: React.ReactNode }
  >(function MockMapView({ children }, ref) {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
    }));

    return React.createElement(View, { testID: "mock-map" }, children);
  });

  function MockMarker({
    children,
    title,
    onPress,
  }: {
    children?: React.ReactNode;
    title?: string;
    onPress?: () => void;
  }) {
    return React.createElement(
      Pressable,
      {
        testID: `map-marker-${title ?? "unknown"}`,
        onPress,
      },
      children,
    );
  }

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
  };
});

jest.mock("../../services/gyms", () => ({
  getFavoriteGyms: jest.fn(),
  searchGymsByLocation: jest.fn(),
  searchNearbyGymsWithFallback: jest.fn(),
  suggestGymLocations: jest.fn(),
}));

const mockedFavorites = getFavoriteGyms as jest.Mock;
const mockedSearch = searchGymsByLocation as jest.Mock;
const mockedNearby = searchNearbyGymsWithFallback as jest.Mock;
const mockedSuggestions = suggestGymLocations as jest.Mock;
const mockedPermissions =
  Location.requestForegroundPermissionsAsync as jest.Mock;
const mockedCurrentPosition = Location.getCurrentPositionAsync as jest.Mock;

const navigation = {
  navigate: jest.fn(),
};

const gyms: GymSearchResult[] = [
  {
    id: "gym-aurora",
    providerName: "geoapify",
    name: "Academia Aurora",
    address: "Rua das Flores, 100",
    coordinates: {
      latitude: -22.471,
      longitude: -43.825,
    },
  },
  {
    id: "gym-atlas",
    providerName: "geoapify",
    name: "Academia Atlas",
    address: "Rua Central, 200",
    coordinates: {
      latitude: -22.472,
      longitude: -43.824,
    },
  },
];

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: "test-token",
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: (request) => request("test-token"),
  updateAuthenticatedUser: jest.fn(),
};

async function mountMap(): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <MapScreen
        route={{ key: "map-preview-route", name: "Mapa" }}
        navigation={
          navigation as unknown as ComponentProps<
            typeof MapScreen
          >["navigation"]
        }
      />
    </AuthContext.Provider>,
  );
}

async function searchForGyms(query = "Barra do Piraí"): Promise<void> {
  await fireEvent.changeText(
    screen.getByPlaceholderText("Cidade, bairro ou região"),
    query,
  );

  await fireEvent.press(screen.getByLabelText("Buscar academias"));
}

async function loadResults(): Promise<void> {
  await mountMap();
  await searchForGyms();

  await screen.findByTestId("map-marker-Academia Aurora");
}

describe("MapScreen - previa de academia selecionada", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedFavorites.mockResolvedValue([]);
    mockedSearch.mockResolvedValue(gyms);
    mockedNearby.mockReset();
    mockedSuggestions.mockReset();
    mockedSuggestions.mockResolvedValue([]);
    mockedPermissions.mockReset();
    mockedCurrentPosition.mockReset();
    mockedPermissions.mockResolvedValue({ status: "granted" });
    mockedCurrentPosition.mockResolvedValue({
      coords: {
        latitude: -22.47034,
        longitude: -43.82633,
      },
    });
  });

  it("nao apresenta a previa antes da selecao", async () => {
    await loadResults();

    expect(screen.queryByText("ACADEMIA SELECIONADA")).toBeNull();

    expect(
      screen.queryByLabelText("Ver detalhes de Academia Aurora no mapa"),
    ).toBeNull();
  });

  it("exibe a previa ao tocar em um marcador", async () => {
    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Aurora"));

    expect(screen.getByText("ACADEMIA SELECIONADA")).toBeTruthy();

    expect(
      screen.getByLabelText("Ver detalhes de Academia Aurora no mapa"),
    ).toBeTruthy();
  });

  it("abre os detalhes da academia correta pelo mapa", async () => {
    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Atlas"));

    await fireEvent.press(
      screen.getByLabelText("Ver detalhes de Academia Atlas no mapa"),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "gym-atlas",
      providerName: "geoapify",
      distanceKm: null,
    });
  });

  it("atualiza a previa ao selecionar outro marcador", async () => {
    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Aurora"));

    expect(
      screen.getByLabelText("Ver detalhes de Academia Aurora no mapa"),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Atlas"));

    expect(
      screen.getByLabelText("Ver detalhes de Academia Atlas no mapa"),
    ).toBeTruthy();

    expect(
      screen.queryByLabelText("Ver detalhes de Academia Aurora no mapa"),
    ).toBeNull();
  });

  it("tambem apresenta a previa ao selecionar um resultado da lista", async () => {
    await loadResults();

    await fireEvent.press(screen.getByLabelText("Selecionar Academia Atlas"));

    expect(
      screen.getByLabelText("Ver detalhes de Academia Atlas no mapa"),
    ).toBeTruthy();
  });

  it("limpa a previa ao executar outra pesquisa", async () => {
    mockedSearch.mockResolvedValueOnce(gyms).mockResolvedValueOnce([]);

    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Aurora"));

    expect(
      screen.getByLabelText("Ver detalhes de Academia Aurora no mapa"),
    ).toBeTruthy();

    await searchForGyms("Vassouras");

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith("Vassouras");

      expect(screen.queryByText("ACADEMIA SELECIONADA")).toBeNull();
    });
  });

  it("nao apresenta previa no mapa para academia sem coordenadas", async () => {
    mockedSearch.mockResolvedValueOnce([
      {
        id: "gym-sem-coordenadas",
        providerName: "geoapify",
        name: "Academia Sem Coordenadas",
        address: "Endereco de teste",
        coordinates: null,
      },
    ] satisfies GymSearchResult[]);

    await mountMap();

    await searchForGyms();

    await screen.findByLabelText("Selecionar Academia Sem Coordenadas");

    await fireEvent.press(
      screen.getByLabelText("Selecionar Academia Sem Coordenadas"),
    );

    expect(screen.queryByText("ACADEMIA SELECIONADA")).toBeNull();

    expect(
      screen.queryByLabelText(
        "Ver detalhes de Academia Sem Coordenadas no mapa",
      ),
    ).toBeNull();
  });

  it("distingue provedores com o mesmo ID externo", async () => {
    mockedSearch.mockResolvedValueOnce([
      {
        ...gyms[0],
        id: "shared-id",
        name: "Academia TomTom",
        providerName: "tomtom",
      },
      {
        ...gyms[1],
        id: "shared-id",
        name: "Academia Geoapify",
        providerName: "geoapify",
      },
    ]);

    await mountMap();
    await searchForGyms();

    await screen.findByTestId("map-marker-Academia TomTom");

    await fireEvent.press(screen.getByTestId("map-marker-Academia TomTom"));

    await fireEvent.press(
      screen.getByLabelText("Ver detalhes de Academia TomTom no mapa"),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "shared-id",
      providerName: "tomtom",
      distanceKm: null,
    });

    await fireEvent.press(screen.getByTestId("map-marker-Academia Geoapify"));

    expect(
      screen.getByLabelText("Ver detalhes de Academia Geoapify no mapa"),
    ).toBeTruthy();
  });

  it("preserva o provedor ao abrir favorito TomTom", async () => {
    mockedFavorites.mockResolvedValueOnce([
      {
        id: "favorite-tomtom",
        gymId: "internal-tomtom",
        providerName: "tomtom",
        externalId: "tomtom-external",
        name: "Academia Favorita TomTom",
        coordinates: null,
        address: "Barra do Pira?",
        favoritedAt: "2026-11-06T12:00:00Z",
      },
    ]);

    await mountMap();

    await fireEvent.press(
      await screen.findByLabelText(
        "Abrir academia favorita Academia Favorita TomTom",
      ),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "tomtom-external",
      providerName: "tomtom",
      distanceKm: null,
    });
  });

  it("shows nearby TomTom gyms and preserves provider in navigation", async () => {
    mockedNearby.mockResolvedValueOnce([
      {
        id: "tomtom-nearby",
        providerName: "tomtom",
        name: "Academia TomTom Próxima",
        address: "Barra do Piraí",
        coordinates: {
          latitude: -22.47034,
          longitude: -43.82633,
        },
      },
    ] satisfies GymSearchResult[]);

    await mountMap();

    await fireEvent.press(screen.getByLabelText("Usar minha localização"));

    await waitFor(() => {
      expect(mockedNearby).toHaveBeenCalledWith(-22.47034, -43.82633, 5_000);
    });

    await fireEvent.press(
      await screen.findByTestId("map-marker-Academia TomTom Próxima"),
    );

    await fireEvent.press(
      screen.getByLabelText("Ver detalhes de Academia TomTom Próxima no mapa"),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "tomtom-nearby",
      providerName: "tomtom",
      distanceKm: expect.any(Number),
    });
  });

  it("clears the previous city when using current location", async () => {
    mockedNearby.mockResolvedValueOnce(gyms);

    await loadResults();

    expect(
      screen.getByPlaceholderText("Cidade, bairro ou região").props.value,
    ).toBe("Barra do Piraí");

    await fireEvent.press(screen.getByLabelText("Usar minha localização"));

    await waitFor(() => {
      expect(mockedNearby).toHaveBeenCalledWith(-22.47034, -43.82633, 5_000);

      expect(
        screen.getByPlaceholderText("Cidade, bairro ou região").props.value,
      ).toBe("");

      expect(screen.getByText("Sua localização atual")).toBeTruthy();
    });
  });

  it("preserves the previous query when location permission is denied", async () => {
    await loadResults();

    mockedPermissions.mockResolvedValueOnce({
      status: "denied",
    });

    await fireEvent.press(screen.getByLabelText("Usar minha localização"));

    expect(
      await screen.findByText(/Permissão de localização negada/),
    ).toBeTruthy();

    expect(
      screen.getByPlaceholderText("Cidade, bairro ou região").props.value,
    ).toBe("Barra do Piraí");

    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("busca o bairro selecionado pelas coordenadas corretas", async () => {
    const suggestion: LocationSuggestion = {
      label: "Centro, Volta Redonda, RJ, Brasil",
      query: "Centro, Volta Redonda, RJ, Brasil",
      coordinates: {
        latitude: -22.512419,
        longitude: -44.0905846,
      },
    };

    mockedSuggestions.mockResolvedValueOnce([suggestion]);
    mockedNearby.mockResolvedValueOnce(gyms);

    await mountMap();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou região"),
      "Centro, Volta Redonda",
    );

    await fireEvent.press(
      await screen.findByLabelText(
        "Selecionar localidade Centro, Volta Redonda, RJ, Brasil",
        {},
        { timeout: 3000 },
      ),
    );

    await waitFor(() => {
      expect(mockedNearby).toHaveBeenCalledWith(
        -22.512419,
        -44.0905846,
        10_000,
      );
    });

    expect(mockedSearch).not.toHaveBeenCalled();

    expect(
      screen.getByPlaceholderText("Cidade, bairro ou região").props.value,
    ).toBe(suggestion.label);
  });

  it("descarta sugestoes antigas apos editar o texto", async () => {
    let resolveOld: ((items: LocationSuggestion[]) => void) | undefined;

    mockedSuggestions.mockImplementationOnce(
      () =>
        new Promise<LocationSuggestion[]>((resolve) => {
          resolveOld = resolve;
        }),
    );

    const current: LocationSuggestion = {
      label: "Barra do Piraí, RJ, Brasil",
      query: "Barra do Piraí, RJ, Brasil",
      coordinates: {
        latitude: -22.47,
        longitude: -43.82,
      },
    };

    mockedSuggestions.mockResolvedValueOnce([current]);

    await mountMap();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou região"),
      "Volta Red",
    );

    await waitFor(
      () => {
        expect(mockedSuggestions).toHaveBeenCalledWith("Volta Red");
      },
      { timeout: 3000 },
    );

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou região"),
      "Barra do Pir",
    );

    await screen.findByLabelText(
      "Selecionar localidade Barra do Piraí, RJ, Brasil",
      {},
      { timeout: 3000 },
    );

    await act(async () => {
      resolveOld?.([
        {
          label: "Volta Redonda, RJ, Brasil",
          query: "Volta Redonda, RJ, Brasil",
          coordinates: {
            latitude: -22.52,
            longitude: -44.1,
          },
        },
      ]);
    });

    expect(
      screen.queryByLabelText(
        "Selecionar localidade Volta Redonda, RJ, Brasil",
      ),
    ).toBeNull();

    expect(
      screen.getByLabelText("Selecionar localidade Barra do Piraí, RJ, Brasil"),
    ).toBeTruthy();
  });

  it("informa quando nenhuma localidade e encontrada", async () => {
    mockedSuggestions.mockResolvedValueOnce([]);

    await mountMap();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou região"),
      "Vassouras",
    );

    expect(
      await screen.findByText(
        "Nenhuma localidade encontrada. Utilize a busca por texto.",
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy();

    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("mantem a busca manual quando as sugestoes falham", async () => {
    mockedSuggestions.mockRejectedValueOnce(
      new Error("Suggestions unavailable"),
    );

    await mountMap();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou região"),
      "Vassouras",
    );

    await waitFor(
      () => {
        expect(mockedSuggestions).toHaveBeenCalledWith("Vassouras");
      },
      { timeout: 3000 },
    );

    expect(
      await screen.findByText(
        "Não foi possível carregar localidades. Utilize a busca por texto.",
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Buscar academias"));

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith("Vassouras");
    });

    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("does not search nearby gyms when location permission is denied", async () => {
    mockedPermissions.mockResolvedValueOnce({
      status: "denied",
    });

    await mountMap();

    await fireEvent.press(screen.getByLabelText("Usar minha localização"));

    expect(
      await screen.findByText(/Permissão de localização negada/),
    ).toBeTruthy();

    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("filters: hides controls before a successful search", async () => {
    await mountMap();

    expect(screen.queryByLabelText("Filtrar por nome da academia")).toBeNull();

    expect(screen.queryByLabelText("At\u00e9 1 km")).toBeNull();
  });

  it("filters: synchronizes name filtering across list map and count", async () => {
    await loadResults();

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "  ATLAS  ",
    );

    expect(screen.getByLabelText("Selecionar Academia Atlas")).toBeTruthy();

    expect(screen.getByTestId("map-marker-Academia Atlas")).toBeTruthy();

    expect(screen.queryByLabelText("Selecionar Academia Aurora")).toBeNull();

    expect(screen.queryByTestId("map-marker-Academia Aurora")).toBeNull();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^1$/);

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("filters: clears hidden selection without restoring it after reset", async () => {
    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Aurora"));

    expect(
      screen.getByLabelText("Ver detalhes de Academia Aurora no mapa"),
    ).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Atlas",
    );

    expect(screen.queryByText("ACADEMIA SELECIONADA")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Limpar filtros"));

    expect(screen.getByTestId("map-marker-Academia Aurora")).toBeTruthy();

    expect(screen.getByTestId("map-marker-Academia Atlas")).toBeTruthy();

    expect(screen.queryByText("ACADEMIA SELECIONADA")).toBeNull();

    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("filters: preserves selection when the selected gym remains visible", async () => {
    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Atlas"));

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Atlas",
    );

    await fireEvent.press(
      screen.getByLabelText("Ver detalhes de Academia Atlas no mapa"),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "gym-atlas",
      providerName: "geoapify",
      distanceKm: null,
    });

    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("filters: distinguishes filtered empty results and restores them locally", async () => {
    await loadResults();

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Academia inexistente",
    );

    expect(
      screen.getByText("Nenhuma academia corresponde aos filtros"),
    ).toBeTruthy();

    expect(screen.queryByText("Nenhuma academia encontrada")).toBeNull();

    expect(screen.queryByTestId("map-marker-Academia Aurora")).toBeNull();

    expect(screen.queryByLabelText("Selecionar Academia Atlas")).toBeNull();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^0$/);

    await fireEvent.press(screen.getByLabelText("Limpar filtros"));

    expect(
      screen.getByLabelText("Filtrar por nome da academia").props.value,
    ).toBe("");

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(screen.getByLabelText("Selecionar Academia Aurora")).toBeTruthy();

    expect(screen.getByLabelText("Selecionar Academia Atlas")).toBeTruthy();

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("filters: keeps name filtering available without device location", async () => {
    await loadResults();

    expect(screen.getByLabelText("At\u00e9 1 km")).toBeDisabled();

    expect(screen.getByLabelText("At\u00e9 3 km")).toBeDisabled();

    expect(screen.getByLabelText("At\u00e9 5 km")).toBeDisabled();

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Aurora",
    );

    expect(screen.getByLabelText("Selecionar Academia Aurora")).toBeTruthy();

    expect(screen.queryByLabelText("Selecionar Academia Atlas")).toBeNull();

    expect(mockedPermissions).not.toHaveBeenCalled();
    expect(mockedCurrentPosition).not.toHaveBeenCalled();
  });

  it("filters: combines name and distance using current location", async () => {
    mockedNearby.mockResolvedValueOnce([
      ...gyms,
      {
        ...gyms[0],
        id: "aurora-far",
        name: "Academia Aurora Distante",
        coordinates: {
          latitude: -22.44034,
          longitude: -43.82633,
        },
      },
      {
        ...gyms[0],
        id: "aurora-unknown",
        name: "Academia Aurora Sem Coordenadas",
        coordinates: null,
      },
    ] satisfies GymSearchResult[]);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Aurora",
    );

    expect(
      screen.getByLabelText("Selecionar Academia Aurora Sem Coordenadas"),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    expect(screen.getByLabelText("Selecionar Academia Aurora")).toBeTruthy();

    expect(
      screen.queryByLabelText("Selecionar Academia Aurora Distante"),
    ).toBeNull();

    expect(
      screen.queryByLabelText("Selecionar Academia Aurora Sem Coordenadas"),
    ).toBeNull();

    expect(
      screen.queryByTestId("map-marker-Academia Aurora Distante"),
    ).toBeNull();

    expect(screen.queryByTestId("map-marker-Academia Atlas")).toBeNull();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^1$/);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("filters: changes distance limits without requesting new results", async () => {
    mockedNearby.mockResolvedValueOnce([
      gyms[0],
      {
        ...gyms[1],
        coordinates: {
          latitude: -22.45034,
          longitude: -43.82633,
        },
      },
      {
        ...gyms[0],
        id: "gym-energia",
        name: "Academia Energia",
        coordinates: {
          latitude: -22.43034,
          longitude: -43.82633,
        },
      },
    ] satisfies GymSearchResult[]);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^1$/);

    await fireEvent.press(screen.getByLabelText("At\u00e9 3 km"));

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    await fireEvent.press(screen.getByLabelText("At\u00e9 5 km"));

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^3$/);

    expect(
      screen.getByLabelText("At\u00e9 5 km").props.accessibilityState?.selected,
    ).toBe(true);

    expect(
      screen.getByLabelText("At\u00e9 3 km").props.accessibilityState?.selected,
    ).toBe(false);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
  });

  it("filters: resets active filters when starting a new search", async () => {
    mockedNearby.mockResolvedValueOnce(gyms);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Aurora",
    );

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    await searchForGyms("Vassouras");

    await screen.findByTestId("map-marker-Academia Atlas");

    expect(
      screen.getByLabelText("Filtrar por nome da academia").props.value,
    ).toBe("");

    expect(
      screen.getByLabelText("Todas as dist\u00e2ncias").props.accessibilityState
        ?.selected,
    ).toBe(true);

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(mockedSearch).toHaveBeenCalledTimes(1);

    expect(mockedSearch).toHaveBeenCalledWith("Vassouras");
  });

  it("filters: preserves invalid-coordinate gyms in list without rendering markers", async () => {
    mockedSearch.mockResolvedValueOnce([
      ...gyms,
      {
        ...gyms[0],
        id: "invalid-gym",
        name: "Academia Coordenada Invalida",
        coordinates: {
          latitude: 91,
          longitude: 0,
        },
      },
    ] satisfies GymSearchResult[]);

    await loadResults();

    expect(
      screen.getByLabelText("Selecionar Academia Coordenada Invalida"),
    ).toBeTruthy();

    expect(
      screen.queryByTestId("map-marker-Academia Coordenada Invalida"),
    ).toBeNull();

    await fireEvent.press(
      screen.getByLabelText("Selecionar Academia Coordenada Invalida"),
    );

    expect(screen.queryByText("ACADEMIA SELECIONADA")).toBeNull();
  });

  it("filters: clears distance restriction when location permission is revoked", async () => {
    mockedNearby.mockResolvedValueOnce([
      gyms[0],
      {
        ...gyms[1],
        coordinates: {
          latitude: -22.45034,
          longitude: -43.82633,
        },
      },
    ] satisfies GymSearchResult[]);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Academia",
    );

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^1$/);

    mockedPermissions.mockResolvedValueOnce({
      status: "denied",
    });

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByText(/Permiss\u00e3o de localiza\u00e7\u00e3o negada/);

    expect(screen.getByLabelText("At\u00e9 1 km")).toBeDisabled();

    expect(
      screen.getByLabelText("Todas as dist\u00e2ncias").props.accessibilityState
        ?.selected,
    ).toBe(true);

    expect(
      screen.getByLabelText("Filtrar por nome da academia").props.value,
    ).toBe("Academia");

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(
      screen.queryByTestId("map-marker-Sua localiza\u00e7\u00e3o"),
    ).toBeNull();

    expect(mockedNearby).toHaveBeenCalledTimes(1);
    expect(mockedCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("filters: rejects invalid device coordinates without losing previous results", async () => {
    await loadResults();

    mockedCurrentPosition.mockResolvedValueOnce({
      coords: {
        latitude: 91,
        longitude: 0,
      },
    });

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByText(
      /N\u00e3o foi poss\u00edvel obter sua localiza\u00e7\u00e3o atual/,
    );

    expect(mockedNearby).not.toHaveBeenCalled();

    expect(screen.getByLabelText("At\u00e9 1 km")).toBeDisabled();

    expect(
      screen.queryByTestId("map-marker-Sua localiza\u00e7\u00e3o"),
    ).toBeNull();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Atlas",
    );

    expect(screen.getByLabelText("Selecionar Academia Atlas")).toBeTruthy();

    expect(screen.queryByLabelText("Selecionar Academia Aurora")).toBeNull();

    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("filters: resets active filters when selecting a location suggestion", async () => {
    const suggestion: LocationSuggestion = {
      label: "Centro, Vassouras, RJ, Brasil",
      query: "Centro, Vassouras, RJ, Brasil",
      coordinates: {
        latitude: -22.405,
        longitude: -43.662,
      },
    };

    mockedNearby.mockResolvedValueOnce(gyms).mockResolvedValueOnce(gyms);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Aurora",
    );

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    mockedSuggestions.mockResolvedValueOnce([suggestion]);

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou regi\u00e3o"),
      "Centro, Vassouras",
    );

    await fireEvent.press(
      await screen.findByLabelText(
        `Selecionar localidade ${suggestion.label}`,
        {},
        { timeout: 3000 },
      ),
    );

    await screen.findByTestId("map-marker-Academia Atlas");

    expect(mockedNearby).toHaveBeenCalledTimes(2);

    expect(mockedNearby).toHaveBeenNthCalledWith(
      2,
      suggestion.coordinates.latitude,
      suggestion.coordinates.longitude,
      10_000,
    );

    expect(
      screen.getByLabelText("Filtrar por nome da academia").props.value,
    ).toBe("");

    expect(
      screen.getByLabelText("Todas as dist\u00e2ncias").props.accessibilityState
        ?.selected,
    ).toBe(true);

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("filters: resets active filters when repeating a device location search", async () => {
    mockedNearby.mockResolvedValueOnce(gyms).mockResolvedValueOnce(gyms);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Atlas",
    );

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^1$/);

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByTestId("map-marker-Academia Aurora");

    expect(mockedNearby).toHaveBeenCalledTimes(2);

    expect(
      screen.getByLabelText("Filtrar por nome da academia").props.value,
    ).toBe("");

    expect(
      screen.getByLabelText("Todas as dist\u00e2ncias").props.accessibilityState
        ?.selected,
    ).toBe(true);

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("filters: hides filter controls when the provider returns no gyms", async () => {
    mockedSearch.mockResolvedValueOnce([]);

    await mountMap();

    await searchForGyms();

    expect(await screen.findByText("Nenhuma academia encontrada")).toBeTruthy();

    expect(
      screen.queryByText("Nenhuma academia corresponde aos filtros"),
    ).toBeNull();

    expect(screen.queryByLabelText("Filtrar por nome da academia")).toBeNull();

    expect(screen.queryByLabelText("Limpar filtros")).toBeNull();

    expect(screen.queryByTestId("gym-results-count")).toBeNull();

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedNearby).not.toHaveBeenCalled();
  });

  function getResultOrder(): string[] {
    return screen
      .getAllByLabelText(/^Selecionar Academia /)
      .map((result) => String(result.props.accessibilityLabel));
  }

  function getSortSelection(label: string): boolean {
    return (
      screen.getByLabelText(label).props.accessibilityState?.selected === true
    );
  }

  async function loadNearbyResults(
    results: GymSearchResult[] = gyms,
  ): Promise<void> {
    mockedNearby.mockResolvedValueOnce(results);

    await mountMap();

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByLabelText("Selecionar Academia Aurora");
  }

  it("sorting: hides sorting controls before searching", async () => {
    await mountMap();

    expect(screen.queryByLabelText("Ordenar por padr\u00e3o")).toBeNull();

    expect(screen.queryByLabelText("Ordenar por dist\u00e2ncia")).toBeNull();

    expect(screen.queryByLabelText("Ordenar por nome")).toBeNull();
  });

  it("sorting: preserves provider order by default", async () => {
    await loadResults();

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(true);

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);

    expect(getSortSelection("Ordenar por nome")).toBe(false);
  });

  it("sorting: orders by name without requesting device location", async () => {
    await loadResults();

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(getSortSelection("Ordenar por nome")).toBe(true);

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(false);

    expect(screen.getByTestId("map-marker-Academia Aurora")).toBeTruthy();

    expect(screen.getByTestId("map-marker-Academia Atlas")).toBeTruthy();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedNearby).not.toHaveBeenCalled();
    expect(mockedPermissions).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Ordenar por padr\u00e3o"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);
  });

  it("sorting: disables distance ordering without device location", async () => {
    await loadResults();

    expect(screen.getByLabelText("Ordenar por dist\u00e2ncia")).toBeDisabled();

    expect(screen.getByLabelText("Ordenar por nome")).not.toBeDisabled();

    expect(mockedPermissions).not.toHaveBeenCalled();

    expect(mockedCurrentPosition).not.toHaveBeenCalled();
  });

  it("sorting: orders nearby gyms by ascending distance", async () => {
    const unknown: GymSearchResult = {
      ...gyms[0],
      id: "gym-unknown-distance",
      name: "Academia Sem Coordenadas",
      coordinates: null,
    };

    await loadNearbyResults([unknown, gyms[1], gyms[0]]);

    expect(
      screen.getByLabelText("Ordenar por dist\u00e2ncia"),
    ).not.toBeDisabled();

    await fireEvent.press(screen.getByLabelText("Ordenar por dist\u00e2ncia"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
      "Selecionar Academia Sem Coordenadas",
    ]);

    expect(getSortSelection("Ordenar por dist\u00e2ncia")).toBe(true);

    expect(
      screen.queryByTestId("map-marker-Academia Sem Coordenadas"),
    ).toBeNull();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^3$/);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
    expect(mockedPermissions).toHaveBeenCalledTimes(1);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("sorting: preserves selected gym and details navigation", async () => {
    await loadResults();

    await fireEvent.press(screen.getByTestId("map-marker-Academia Atlas"));

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(screen.getByText("ACADEMIA SELECIONADA")).toBeTruthy();

    await fireEvent.press(
      screen.getByLabelText("Ver detalhes de Academia Atlas no mapa"),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "gym-atlas",
      providerName: "geoapify",
      distanceKm: null,
    });

    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("sorting: combines ordering with name and distance filters", async () => {
    const far: GymSearchResult = {
      ...gyms[0],
      id: "gym-energia-far",
      name: "Academia Energia",
      coordinates: {
        latitude: -22.44034,
        longitude: -43.82633,
      },
    };

    await loadNearbyResults([far, gyms[0], gyms[1]]);

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Academia",
    );

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(screen.queryByTestId("map-marker-Academia Energia")).toBeNull();

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    await fireEvent.press(screen.getByLabelText("Ordenar por dist\u00e2ncia"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);

    expect(
      screen.getByLabelText("At\u00e9 1 km").props.accessibilityState?.selected,
    ).toBe(true);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("sorting: preserves ordering when filters are cleared", async () => {
    await loadResults();

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Inexistente",
    );

    expect(
      screen.getByText("Nenhuma academia corresponde aos filtros"),
    ).toBeTruthy();

    expect(getSortSelection("Ordenar por nome")).toBe(true);

    await fireEvent.press(screen.getByLabelText("Limpar filtros"));

    expect(getSortSelection("Ordenar por nome")).toBe(true);

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("sorting: restores provider ordering on a new search", async () => {
    await loadResults();

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    await searchForGyms("Vassouras");

    await screen.findByLabelText("Selecionar Academia Aurora");

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(true);

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);

    expect(mockedSearch).toHaveBeenCalledTimes(2);

    expect(mockedSearch).toHaveBeenLastCalledWith("Vassouras");
  });

  it("sorting: restores provider ordering when device permission is denied", async () => {
    await loadNearbyResults([gyms[1], gyms[0]]);

    await fireEvent.press(screen.getByLabelText("Ordenar por dist\u00e2ncia"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);

    mockedPermissions.mockResolvedValueOnce({
      status: "denied",
    });

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByText(/Permiss\u00e3o de localiza\u00e7\u00e3o negada/);

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(true);

    expect(screen.getByLabelText("Ordenar por dist\u00e2ncia")).toBeDisabled();

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
  });

  it("sorting: preserves name ordering when device location becomes unavailable", async () => {
    await loadNearbyResults();

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    mockedCurrentPosition.mockRejectedValueOnce(
      new Error("Location unavailable"),
    );

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByText(
      /N\u00e3o foi poss\u00edvel obter sua localiza\u00e7\u00e3o atual/,
    );

    expect(getSortSelection("Ordenar por nome")).toBe(true);

    expect(screen.getByLabelText("Ordenar por dist\u00e2ncia")).toBeDisabled();

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
  });

  it("sorting: hides sorting controls for empty provider results", async () => {
    mockedSearch.mockResolvedValueOnce([]);

    await mountMap();
    await searchForGyms();

    expect(await screen.findByText("Nenhuma academia encontrada")).toBeTruthy();

    expect(screen.queryByLabelText("Ordenar por padr\u00e3o")).toBeNull();

    expect(screen.queryByLabelText("Ordenar por dist\u00e2ncia")).toBeNull();

    expect(screen.queryByLabelText("Ordenar por nome")).toBeNull();
  });

  it("sorting: resets ordering when selecting a location suggestion", async () => {
    const suggestion: LocationSuggestion = {
      label: "Centro, Vassouras, RJ, Brasil",
      query: "Centro, Vassouras, RJ, Brasil",
      coordinates: {
        latitude: -22.405,
        longitude: -43.662,
      },
    };

    mockedNearby.mockResolvedValueOnce(gyms);

    await loadResults();

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    expect(getSortSelection("Ordenar por nome")).toBe(true);

    mockedSuggestions.mockResolvedValueOnce([suggestion]);

    await fireEvent.changeText(
      screen.getByPlaceholderText("Cidade, bairro ou regi\u00e3o"),
      "Centro, Vassouras",
    );

    await fireEvent.press(
      await screen.findByLabelText(
        `Selecionar localidade ${suggestion.label}`,
        {},
        { timeout: 3000 },
      ),
    );

    await screen.findByLabelText("Selecionar Academia Aurora");

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(true);

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);

    expect(screen.getByLabelText("Ordenar por dist\u00e2ncia")).toBeDisabled();

    expect(mockedNearby).toHaveBeenCalledTimes(1);

    expect(mockedNearby).toHaveBeenCalledWith(
      suggestion.coordinates.latitude,
      suggestion.coordinates.longitude,
      10_000,
    );

    expect(mockedPermissions).not.toHaveBeenCalled();
    expect(mockedCurrentPosition).not.toHaveBeenCalled();
  });

  it("sorting: resets ordering when repeating a device location search", async () => {
    const reversed = [gyms[1], gyms[0]];

    await loadNearbyResults(reversed);

    await fireEvent.press(screen.getByLabelText("Ordenar por dist\u00e2ncia"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Aurora",
      "Selecionar Academia Atlas",
    ]);

    mockedNearby.mockResolvedValueOnce(reversed);

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByLabelText("Selecionar Academia Aurora");

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(true);

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(
      screen.getByLabelText("Ordenar por dist\u00e2ncia"),
    ).not.toBeDisabled();

    expect(mockedNearby).toHaveBeenCalledTimes(2);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("sorting: falls back to provider order for invalid device coordinates", async () => {
    await loadNearbyResults([gyms[1], gyms[0]]);

    await fireEvent.press(screen.getByLabelText("Ordenar por dist\u00e2ncia"));

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Academia",
    );

    await fireEvent.press(screen.getByLabelText("At\u00e9 1 km"));

    mockedCurrentPosition.mockResolvedValueOnce({
      coords: {
        latitude: 91,
        longitude: 0,
      },
    });

    await fireEvent.press(
      screen.getByLabelText("Usar minha localiza\u00e7\u00e3o"),
    );

    await screen.findByText(
      /N\u00e3o foi poss\u00edvel obter sua localiza\u00e7\u00e3o atual/,
    );

    expect(getSortSelection("Ordenar por padr\u00e3o")).toBe(true);

    expect(screen.getByLabelText("Ordenar por dist\u00e2ncia")).toBeDisabled();

    expect(screen.getByLabelText("At\u00e9 1 km")).toBeDisabled();

    expect(
      screen.getByLabelText("Todas as dist\u00e2ncias").props.accessibilityState
        ?.selected,
    ).toBe(true);

    expect(
      screen.getByLabelText("Filtrar por nome da academia").props.value,
    ).toBe("Academia");

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(mockedNearby).toHaveBeenCalledTimes(1);
  });

  it("sorting: preserves results and ordering for an empty search query", async () => {
    await loadResults();

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    await searchForGyms("   ");

    expect(
      await screen.findByText(
        "Digite uma cidade, bairro ou regi\u00e3o para buscar.",
      ),
    ).toBeTruthy();

    expect(getSortSelection("Ordenar por nome")).toBe(true);

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(screen.getByTestId("gym-results-count")).toHaveTextContent(/^2$/);

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedNearby).not.toHaveBeenCalled();
  });

  it("sorting: preserves favorite ordering and navigation independently", async () => {
    mockedFavorites.mockResolvedValueOnce([
      {
        id: "favorite-zulu",
        gymId: "internal-zulu",
        providerName: "tomtom",
        externalId: "zulu-external",
        name: "Academia Favorita Zulu",
        coordinates: null,
        address: null,
        favoritedAt: "2026-11-06T12:00:00Z",
      },
      {
        id: "favorite-alfa",
        gymId: "internal-alfa",
        providerName: "geoapify",
        externalId: "alfa-external",
        name: "Academia Favorita Alfa",
        coordinates: null,
        address: null,
        favoritedAt: "2026-11-06T11:00:00Z",
      },
    ]);

    await loadResults();

    await screen.findByLabelText(
      "Abrir academia favorita Academia Favorita Zulu",
    );

    const favoriteCalls = mockedFavorites.mock.calls.length;

    function getFavoriteOrder(): string[] {
      return screen
        .getAllByLabelText(/^Abrir academia favorita /)
        .map((item) => String(item.props.accessibilityLabel));
    }

    const expectedFavorites = [
      "Abrir academia favorita Academia Favorita Zulu",
      "Abrir academia favorita Academia Favorita Alfa",
    ];

    expect(getFavoriteOrder()).toEqual(expectedFavorites);

    await fireEvent.press(screen.getByLabelText("Ordenar por nome"));

    expect(getResultOrder()).toEqual([
      "Selecionar Academia Atlas",
      "Selecionar Academia Aurora",
    ]);

    expect(getFavoriteOrder()).toEqual(expectedFavorites);

    await fireEvent.changeText(
      screen.getByLabelText("Filtrar por nome da academia"),
      "Atlas",
    );

    expect(getFavoriteOrder()).toEqual(expectedFavorites);

    await fireEvent.press(
      screen.getByLabelText("Abrir academia favorita Academia Favorita Zulu"),
    );

    expect(navigation.navigate).toHaveBeenCalledWith("DetalhesAcademia", {
      gymId: "zulu-external",
      providerName: "tomtom",
      distanceKm: null,
    });

    expect(mockedFavorites).toHaveBeenCalledTimes(favoriteCalls);
    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });
});
