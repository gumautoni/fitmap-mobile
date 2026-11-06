import {
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
  type GymSearchResult,
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
}));

const mockedFavorites = getFavoriteGyms as jest.Mock;
const mockedSearch = searchGymsByLocation as jest.Mock;
const mockedNearby = searchNearbyGymsWithFallback as jest.Mock;
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
