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
});
