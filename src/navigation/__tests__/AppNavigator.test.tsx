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

import { AccessibilityInfo } from "react-native";

import AppNavigator from "../AppNavigator";
import AuthNavigator from "../AuthNavigator";
import type { AppStackParamList, AuthStackParamList } from "../types";

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

jest.mock("../../screens/WelcomeScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo BoasVindas"),
}));

jest.mock("../../screens/LoginScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Login"),
}));

jest.mock("../../screens/RegisterScreen", () => ({
  __esModule: true,
  default: mockScreen("Conteudo Cadastro"),
}));

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);

  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRestore();
  jest.mocked(AccessibilityInfo.addEventListener).mockRestore();
});

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

describe("ACC-02.4 navigation accessibility", () => {
  const tabs = [
    {
      label: /^In\u00edcio, tab,/,
      content: "Conteudo Home",
    },
    {
      label: /^Mapa, tab,/,
      content: "Conteudo Mapa",
    },
    {
      label: /^Treinos, tab,/,
      content: "Conteudo Treinos",
    },
    {
      label: /^Progresso, tab,/,
      content: "Conteudo Progresso",
    },
  ];

  function expectSelectedTab(index: number) {
    tabs.forEach((tab, tabIndex) => {
      const button = screen.getByRole("button", {
        name: tab.label,
      });

      expect(Boolean(button.props.accessibilityState?.selected)).toBe(
        index === tabIndex,
      );

      expect(button).not.toBeDisabled();
    });
  }

  it("preserves exclusive accessible selection across all four tabs", async () => {
    await renderNavigator();

    await screen.findByText(tabs[0].content);

    expectSelectedTab(0);

    for (const index of [1, 2, 3, 0]) {
      const tab = tabs[index];

      await fireEvent.press(
        screen.getByRole("button", {
          name: tab.label,
        }),
      );

      await screen.findByText(tab.content);

      await waitFor(() => {
        expectSelectedTab(index);
      });
    }
  });

  it("accessibility: provides a practical history header action and preserves the selected workout tab", async () => {
    const navigation = await renderWithStackReference();

    await act(async () => {
      navigation.navigate("MainTabs", {
        screen: "Treinos",
      });
    });

    await screen.findByText("Conteudo Treinos");

    const history = await screen.findByRole("button", {
      name: "Abrir hist\u00f3rico de treinos",
    });

    expect(history).not.toBeDisabled();

    expect(history).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });

    expect(history).toHaveProp(
      "accessibilityHint",
      "Consulte seus treinos conclu\u00eddos.",
    );

    await fireEvent.press(history);

    await screen.findByText("Conteudo Historico");

    expect(navigation.getCurrentRoute()?.name).toBe("HistoricoTreinos");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: /^Treinos, tab,/,
        }),
      ).toBeNull();
    });

    await act(async () => {
      navigation.goBack();
    });

    await screen.findByText("Conteudo Treinos");

    await waitFor(() => {
      expectSelectedTab(2);
    });
  });

  it("accessibility: provides a practical workout execution header action and preserves the workout identifier", async () => {
    const navigation = await renderWithStackReference();

    const workoutId = "accessibility-workout-test";

    await act(async () => {
      navigation.navigate("MainTabs", {
        screen: "Treinos",
      });
    });

    await screen.findByText("Conteudo Treinos");

    await act(async () => {
      navigation.navigate("DetalhesTreino", {
        workoutId,
      });
    });

    await screen.findByText("Conteudo DetalhesTreino");

    const execute = await screen.findByRole("button", {
      name: "Executar treino",
    });

    expect(execute).not.toBeDisabled();

    expect(execute).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });

    expect(execute).toHaveProp(
      "accessibilityHint",
      "Abre a tela de execu\u00e7\u00e3o deste treino.",
    );

    await fireEvent.press(execute);

    await screen.findByText("Conteudo ExecutarTreino");

    expect(navigation.getCurrentRoute()).toMatchObject({
      name: "ExecutarTreino",
      params: { workoutId },
    });

    await act(async () => {
      navigation.goBack();
    });

    await screen.findByText("Conteudo DetalhesTreino");

    expect(navigation.getCurrentRoute()).toMatchObject({
      name: "DetalhesTreino",
      params: { workoutId },
    });

    await act(async () => {
      navigation.goBack();
    });

    await screen.findByText("Conteudo Treinos");

    await waitFor(() => {
      expectSelectedTab(2);
    });
  });
});

function getStackAnimation(options: object | undefined): unknown {
  if (options && "animation" in options) {
    return options.animation;
  }

  return undefined;
}

async function renderAuthWithStackReference() {
  const navigation = createNavigationContainerRef<AuthStackParamList>();

  await render(
    <NavigationContainer ref={navigation}>
      <AuthNavigator />
    </NavigationContainer>,
  );

  await screen.findByText("Conteudo BoasVindas");

  return navigation;
}

async function changeMotionPreference(enabled: boolean) {
  const subscriptions = jest.mocked(AccessibilityInfo.addEventListener).mock
    .calls;

  await act(async () => {
    for (const [event, listener] of subscriptions) {
      if (event === "reduceMotionChanged") {
        (listener as (value: boolean) => void)(enabled);
      }
    }
  });
}

describe("ACC-02.5 native navigation motion", () => {
  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in authenticated stack transitions",
    async (reduceMotion) => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(reduceMotion);

      const navigation = await renderWithStackReference();

      await act(async () => {
        navigation.navigate("Perfil");
      });

      await screen.findByText("Conteudo Perfil");

      expect(navigation.getCurrentRoute()?.name).toBe("Perfil");

      const profileAnimation = getStackAnimation(
        navigation.getCurrentOptions(),
      );

      await act(async () => {
        navigation.navigate("DetalhesTreino", {
          workoutId: "motion-workout-test",
        });
      });

      await screen.findByText("Conteudo DetalhesTreino");

      expect(navigation.getCurrentRoute()).toMatchObject({
        name: "DetalhesTreino",
        params: { workoutId: "motion-workout-test" },
      });

      const workoutAnimation = getStackAnimation(
        navigation.getCurrentOptions(),
      );

      await act(async () => {
        navigation.goBack();
      });

      await screen.findByText("Conteudo Perfil");

      await act(async () => {
        navigation.goBack();
      });

      await screen.findByText("Conteudo Home");

      expect(navigation.getCurrentRoute()?.name).toBe("Home");

      const expected = reduceMotion ? "none" : "slide_from_right";

      expect([profileAnimation, workoutAnimation]).toEqual([
        expected,
        expected,
      ]);
    },
  );

  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in authentication stack transitions",
    async (reduceMotion) => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(reduceMotion);

      const navigation = await renderAuthWithStackReference();

      await act(async () => {
        navigation.navigate("Login");
      });

      await screen.findByText("Conteudo Login");

      expect(navigation.getCurrentRoute()?.name).toBe("Login");

      const loginAnimation = getStackAnimation(navigation.getCurrentOptions());

      await act(async () => {
        navigation.navigate("Cadastro");
      });

      await screen.findByText("Conteudo Cadastro");

      expect(navigation.getCurrentRoute()?.name).toBe("Cadastro");

      const registerAnimation = getStackAnimation(
        navigation.getCurrentOptions(),
      );

      await act(async () => {
        navigation.goBack();
      });

      await screen.findByText("Conteudo Login");

      await act(async () => {
        navigation.goBack();
      });

      await screen.findByText("Conteudo BoasVindas");

      expect(navigation.getCurrentRoute()?.name).toBe("BoasVindas");

      const expected = reduceMotion ? "none" : "slide_from_right";

      expect([loginAnimation, registerAnimation]).toEqual([expected, expected]);
    },
  );

  it("accessibility: updates authenticated stack motion without resetting navigation", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false);

    const navigation = await renderWithStackReference();

    await act(async () => {
      navigation.navigate("DetalhesTreino", {
        workoutId: "live-motion-workout",
      });
    });

    await screen.findByText("Conteudo DetalhesTreino");

    const route = navigation.getCurrentRoute();

    expect(getStackAnimation(navigation.getCurrentOptions())).toBe(
      "slide_from_right",
    );

    await changeMotionPreference(true);

    expect(navigation.getCurrentRoute()).toEqual(route);

    const reducedAnimation = getStackAnimation(navigation.getCurrentOptions());

    await changeMotionPreference(false);

    expect(navigation.getCurrentRoute()).toEqual(route);

    const restoredAnimation = getStackAnimation(navigation.getCurrentOptions());

    await act(async () => {
      navigation.goBack();
    });

    await screen.findByText("Conteudo Home");

    expect([reducedAnimation, restoredAnimation]).toEqual([
      "none",
      "slide_from_right",
    ]);
  });

  it("accessibility: updates authentication stack motion without resetting navigation", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false);

    const navigation = await renderAuthWithStackReference();

    await act(async () => {
      navigation.navigate("Login");
    });

    await screen.findByText("Conteudo Login");

    const route = navigation.getCurrentRoute();

    expect(getStackAnimation(navigation.getCurrentOptions())).toBe(
      "slide_from_right",
    );

    await changeMotionPreference(true);

    expect(navigation.getCurrentRoute()).toEqual(route);

    const reducedAnimation = getStackAnimation(navigation.getCurrentOptions());

    await changeMotionPreference(false);

    expect(navigation.getCurrentRoute()).toEqual(route);

    const restoredAnimation = getStackAnimation(navigation.getCurrentOptions());

    await act(async () => {
      navigation.goBack();
    });

    await screen.findByText("Conteudo BoasVindas");

    expect([reducedAnimation, restoredAnimation]).toEqual([
      "none",
      "slide_from_right",
    ]);
  });
});
