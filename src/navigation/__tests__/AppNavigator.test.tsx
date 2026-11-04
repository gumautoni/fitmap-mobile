import {
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import AppNavigator from "../AppNavigator";
import type { AppStackParamList } from "../types";

// Substitui somente o conteudo das telas.
// Os navegadores reais continuam sendo utilizados.
function mockScreen(label: string) {
  return function MockScreen() {
    const React = jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return React.createElement(Text, null, label);
  };
}

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  House: () => null,
  MapPin: () => null,
  Dumbbell: () => null,
  ChartNoAxesColumnIncreasing: () => null,
}));

jest.mock("../../screens/HomeScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Home"),
}));

jest.mock("../../screens/MapScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Mapa"),
}));

jest.mock("../../screens/WorkoutsScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Treinos"),
}));

jest.mock("../../screens/ProgressScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Progresso"),
}));

jest.mock("../../screens/ProfileScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Perfil"),
}));

jest.mock("../../screens/CreateWorkoutScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo NovoTreino"),
}));

jest.mock("../../screens/WorkoutDetailsScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo DetalhesTreino"),
}));

jest.mock("../../screens/WorkoutSessionScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo ExecutarTreino"),
}));

jest.mock("../../screens/WorkoutHistoryScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Historico"),
}));

jest.mock("../../screens/WorkoutHistoryDetailsScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo DetalhesHistorico"),
}));

jest.mock("../../screens/ExerciseCatalogScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Catalogo"),
}));

jest.mock("../../screens/WorkoutExerciseConfigScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo ConfigurarExercicio"),
}));

jest.mock("../../screens/GymDetailsScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo DetalhesAcademia"),
}));

function renderNavigator() {
  return render(
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>,
  );
}

describe("AppNavigator - navegacao inferior", () => {
  it("abre a Home e apresenta quatro abas", async () => {
    await renderNavigator();

    expect(await screen.findByText("Conteudo Home")).toBeTruthy();

    const tabs = screen.getAllByRole("button");

    expect(tabs).toHaveLength(4);
    expect(tabs[0].props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it.each([
    ["Mapa", "Conteudo Mapa"],
    ["Treinos", "Conteudo Treinos"],
    ["Progresso", "Conteudo Progresso"],
  ])("navega para %s e seleciona a aba correta", async (label, content) => {
    await renderNavigator();

    await fireEvent.press(
      screen.getByRole("button", { name: new RegExp(`^${label}, tab,`) }),
    );

    await waitFor(() => {
      expect(screen.getByText(content)).toBeTruthy();

      expect(
        screen.getByRole("button", { name: new RegExp(`^${label}, tab,`) })
          .props.accessibilityState,
      ).toMatchObject({
        selected: true,
      });
    });
  });

  it("permite retornar para a Home pela barra", async () => {
    await renderNavigator();

    await fireEvent.press(screen.getByRole("button", { name: /^Mapa, tab,/ }));

    await screen.findByText("Conteudo Mapa");

    await fireEvent.press(screen.getAllByRole("button")[0]);

    await waitFor(() => {
      expect(screen.getByText("Conteudo Home")).toBeTruthy();

      expect(
        screen.getAllByRole("button")[0].props.accessibilityState,
      ).toMatchObject({
        selected: true,
      });
    });
  });
});

async function renderWithStackReference() {
  const navigationRef = createNavigationContainerRef<AppStackParamList>();

  await render(
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
    </NavigationContainer>,
  );

  await screen.findByText("Conteudo Home");

  return navigationRef;
}

describe("AppNavigator - telas secundarias", () => {
  it("abre Perfil, oculta as abas e retorna para Home", async () => {
    const navigation = await renderWithStackReference();

    await act(async () => {
      navigation.navigate("Perfil");
    });

    expect(await screen.findByText("Conteudo Perfil")).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Mapa, tab,/ })).toBeNull();
    });

    await act(async () => {
      navigation.goBack();
    });

    expect(await screen.findByText("Conteudo Home")).toBeTruthy();

    expect(
      screen.getAllByRole("button")[0].props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it("abre detalhes de academia e retorna para Mapa", async () => {
    const navigation = await renderWithStackReference();

    await act(async () => {
      navigation.navigate("MainTabs", { screen: "Mapa" });
    });

    expect(await screen.findByText("Conteudo Mapa")).toBeTruthy();

    await act(async () => {
      navigation.navigate("DetalhesAcademia", {
        gymId: "academia-teste-123",
      });
    });

    expect(await screen.findByText("Conteudo DetalhesAcademia")).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Mapa, tab,/ })).toBeNull();
    });

    await act(async () => {
      navigation.goBack();
    });

    expect(await screen.findByText("Conteudo Mapa")).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: /^Mapa, tab,/,
      }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it("abre Historico e preserva a aba Treinos no retorno", async () => {
    const navigation = await renderWithStackReference();

    await act(async () => {
      navigation.navigate("MainTabs", { screen: "Treinos" });
    });

    expect(await screen.findByText("Conteudo Treinos")).toBeTruthy();

    await act(async () => {
      navigation.navigate("HistoricoTreinos");
    });

    expect(await screen.findByText("Conteudo Historico")).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^Treinos, tab,/ }),
      ).toBeNull();
    });

    await act(async () => {
      navigation.goBack();
    });

    expect(await screen.findByText("Conteudo Treinos")).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: /^Treinos, tab,/,
      }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });
});
