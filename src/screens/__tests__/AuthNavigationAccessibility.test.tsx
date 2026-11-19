import React, { type ComponentType, type ContextType } from "react";
import { AccessibilityInfo, StyleSheet, type ViewStyle } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";

import AuthButton from "../../components/auth/AuthButton";
import { AuthContext } from "../../context/AuthContext";
import type {
  AuthStackParamList,
  AuthStackScreenProps,
} from "../../navigation/types";
import LoginScreen from "../LoginScreen";
import RegisterScreen from "../RegisterScreen";
import WelcomeScreen from "../WelcomeScreen";

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme:
      jest.requireActual<typeof import("../../theme/themes")>(
        "../../theme/themes",
      ).lightTheme,
  }),
}));

jest.mock("../../components/FitMapBrand", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../components/auth/AuthBackground", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children: import("react").ReactNode;
      style?: import("react-native").StyleProp<
        import("react-native").ViewStyle
      >;
    }) => React.createElement(View, { style }, children),
  };
});

jest.mock("lucide-react-native", () => ({
  ArrowLeft: () => null,
  ArrowRight: () => null,
  CheckCircle2: () => null,
  Circle: () => null,
  Dumbbell: () => null,
  Eye: () => null,
  EyeOff: () => null,
  LockKeyhole: () => null,
  Mail: () => null,
  MapPin: () => null,
  TrendingUp: () => null,
  UserRound: () => null,
}));

jest.mock("expo-linear-gradient", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    LinearGradient: ({ children }: { children: import("react").ReactNode }) =>
      React.createElement(View, null, children),
  };
});

const BACK_LABEL = "Voltar para boas-vindas";
const LOGIN_ACTION = "Entrar na minha conta";
const REGISTER_ACTION = "Criar minha conta";

type AuthValue = NonNullable<ContextType<typeof AuthContext>>;
type AuthOverrides = Partial<Pick<AuthValue, "login" | "register">>;

type AuthRoute = keyof AuthStackParamList;

type NavigationMock = {
  navigate: jest.Mock<void, [AuthRoute]>;
};

function makeAuth(overrides: AuthOverrides): AuthValue {
  return {
    user: null,
    accessToken: null,
    loading: false,
    login: jest
      .fn<Promise<void>, Parameters<AuthValue["login"]>>()
      .mockResolvedValue(undefined),
    register: jest
      .fn<Promise<void>, Parameters<AuthValue["register"]>>()
      .mockResolvedValue(undefined),
    logout: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    refreshAccessToken: jest.fn<Promise<string>, []>(),
    runAuthenticatedRequest: async () => {
      throw new Error("Unexpected authenticated request in auth screen test.");
    },
    updateAuthenticatedUser: jest.fn<
      void,
      Parameters<AuthValue["updateAuthenticatedUser"]>
    >(),
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;

  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = () => onResolve();
    reject = onReject;
  });

  return { promise, resolve, reject };
}

async function mountScreen<R extends AuthRoute>(
  Screen: ComponentType<AuthStackScreenProps<R>>,
  routeName: R,
  overrides: AuthOverrides = {},
) {
  const navigation: NavigationMock = {
    navigate: jest.fn<void, [AuthRoute]>(),
  };

  const auth = makeAuth(overrides);

  // Partial navigation mock is isolated at the test boundary.
  const props: AuthStackScreenProps<R> = {
    navigation: navigation as unknown as AuthStackScreenProps<R>["navigation"],
    route: {
      key: `auth-test-${routeName}`,
      name: routeName,
    } as AuthStackScreenProps<R>["route"],
  };

  await render(
    <AuthContext.Provider value={auth}>
      <Screen {...props} />
    </AuthContext.Provider>,
  );

  return { navigation, auth };
}

function expectTouchTarget(label: string) {
  expect(screen.getByRole("button", { name: label })).toHaveStyle({
    minHeight: 48,
    minWidth: 48,
  });
}

function expectNavigationState(label: string, disabled: boolean) {
  const button = screen.getByRole("button", { name: label });

  expect(button).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled }),
  );

  if (disabled) {
    expect(button).toBeDisabled();
  } else {
    expect(button).not.toBeDisabled();
  }
}

async function verifyNavigation(
  navigation: NavigationMock,
  footer: string,
  destination: AuthRoute,
) {
  await fireEvent.press(screen.getByRole("button", { name: BACK_LABEL }));

  expect(navigation.navigate).toHaveBeenCalledWith("BoasVindas");

  await fireEvent.press(screen.getByRole("button", { name: footer }));

  expect(navigation.navigate).toHaveBeenLastCalledWith(destination);

  expect(navigation.navigate).toHaveBeenCalledTimes(2);
}

type PendingNavigationOptions<R extends AuthRoute> = {
  Screen: ComponentType<AuthStackScreenProps<R>>;
  routeName: R;
  method: "login" | "register";
  action: string;
  footer: string;
  destination: AuthRoute;
  fields: [string, string][];
  args: string[];
};

async function verifyPendingNavigation<R extends AuthRoute>({
  Screen,
  routeName,
  method,
  action,
  footer,
  destination,
  fields,
  args,
}: PendingNavigationOptions<R>) {
  const request = deferred();

  const submit = jest
    .fn<Promise<void>, string[]>()
    .mockImplementationOnce(() => request.promise)
    .mockResolvedValue(undefined);

  const { navigation } = await mountScreen(Screen, routeName, {
    [method]: submit,
  });

  for (const [label, value] of fields) {
    await fireEvent.changeText(screen.getByLabelText(label), value);
  }

  const user = userEvent.setup();
  const message = "Falha de autenticacao simulada.";

  try {
    await user.press(screen.getByRole("button", { name: action }));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(...args);

    expect(screen.getByLabelText(action)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: true,
        disabled: true,
      }),
    );

    expectNavigationState(BACK_LABEL, true);
    expectNavigationState(footer, true);

    await fireEvent.press(screen.getByRole("button", { name: BACK_LABEL }));

    await fireEvent.press(screen.getByRole("button", { name: footer }));

    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      if (submit.mock.calls.length > 0) {
        request.reject(new Error(message));
      } else {
        request.resolve();
      }
    });
  }

  expect(await screen.findByText(message)).toBeTruthy();

  expectNavigationState(BACK_LABEL, false);
  expectNavigationState(footer, false);

  expect(screen.getByLabelText(action)).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy: false,
      disabled: false,
    }),
  );

  for (const [label, value] of fields) {
    expect(screen.getByLabelText(label)).toHaveProp("editable", true);

    expect(screen.getByLabelText(label)).toHaveProp("value", value);
  }

  await verifyNavigation(navigation, footer, destination);
}

async function pressAndReadFeedback(name: string, opacity: number) {
  const button = screen.getByRole("button", { name });
  const initial = StyleSheet.flatten<ViewStyle>(button.props.style);

  expect(initial?.opacity).not.toBe(opacity);

  const observed: { feedback?: Pick<ViewStyle, "opacity" | "transform"> } = {};

  const user = userEvent.setup({
    advanceTimers: (delay) => {
      if (delay <= 0) {
        return;
      }

      const pressed = screen.getByRole("button", { name });
      const style = StyleSheet.flatten<ViewStyle>(pressed.props.style);

      observed.feedback = {
        opacity: style?.opacity,
        transform: style?.transform,
      };
    },
  });

  await user.press(button);

  if (!observed.feedback) {
    throw new Error("Pressed feedback was not observed.");
  }

  return observed.feedback;
}

describe("Auth navigation accessibility", () => {
  it("preserves welcome actions and their touch targets", async () => {
    const { navigation } = await mountScreen(WelcomeScreen, "BoasVindas");

    const create = screen.getByRole("button", {
      name: "Criar conta no FitMap",
    });

    const login = screen.getByRole("button", {
      name: LOGIN_ACTION,
    });

    expect(create).toHaveStyle({ minHeight: 58 });
    expect(login).toHaveStyle({ minHeight: 58 });

    await fireEvent.press(create);

    expect(navigation.navigate).toHaveBeenCalledWith("Cadastro");

    await fireEvent.press(login);

    expect(navigation.navigate).toHaveBeenLastCalledWith("Login");

    expect(navigation.navigate).toHaveBeenCalledTimes(2);
  });

  it("accessibility: preserves login navigation with practical touch targets", async () => {
    const { navigation } = await mountScreen(LoginScreen, "Login");

    await verifyNavigation(navigation, "Criar conta", "Cadastro");

    expectTouchTarget(BACK_LABEL);
    expectTouchTarget("Criar conta");
  });

  it("accessibility: preserves registration navigation with practical touch targets", async () => {
    const { navigation } = await mountScreen(RegisterScreen, "Cadastro");

    await verifyNavigation(navigation, "Ir para Login", "Login");

    expectTouchTarget(BACK_LABEL);
    expectTouchTarget("Ir para Login");
  });

  it("accessibility: disables login navigation while pending and restores it after failure", async () => {
    await verifyPendingNavigation({
      Screen: LoginScreen,
      routeName: "Login",
      method: "login",
      action: LOGIN_ACTION,
      footer: "Criar conta",
      destination: "Cadastro",
      fields: [
        ["E-mail", "pessoa@example.com"],
        ["Senha", "senha"],
      ],
      args: ["pessoa@example.com", "senha"],
    });
  });

  it("accessibility: disables registration navigation while pending and restores it after failure", async () => {
    await verifyPendingNavigation({
      Screen: RegisterScreen,
      routeName: "Cadastro",
      method: "register",
      action: REGISTER_ACTION,
      footer: "Ir para Login",
      destination: "Login",
      fields: [
        ["Nome completo", "Ana Silva"],
        ["E-mail", "pessoa@example.com"],
        ["Senha", "Aa1!bcde"],
        ["Confirmar senha", "Aa1!bcde"],
      ],
      args: ["Ana Silva", "pessoa@example.com", "Aa1!bcde"],
    });
  });

  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in auth press feedback",
    async (reduceMotion) => {
      const preference = jest
        .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
        .mockResolvedValue(reduceMotion);

      const subscription = jest
        .spyOn(AccessibilityInfo, "addEventListener")
        .mockReturnValue({ remove: jest.fn() });

      try {
        const onPress = jest.fn<void, []>();

        const view = await render(
          <AuthButton title="Confirmar" onPress={onPress} />,
        );

        const submit = await pressAndReadFeedback("Confirmar", 0.84);

        expect(onPress).toHaveBeenCalledTimes(1);

        await view.unmount();

        const { navigation } = await mountScreen(WelcomeScreen, "BoasVindas");

        const create = await pressAndReadFeedback("Criar conta no FitMap", 0.8);

        const login = await pressAndReadFeedback(LOGIN_ACTION, 0.8);

        expect(navigation.navigate.mock.calls).toEqual([
          ["Cadastro"],
          ["Login"],
        ]);

        const expectedSubmit = {
          opacity: 0.84,
          transform: reduceMotion ? undefined : [{ scale: 0.995 }],
        };

        const expectedWelcome = {
          opacity: 0.8,
          transform: reduceMotion ? undefined : [{ scale: 0.99 }],
        };

        expect({ submit, create, login }).toEqual({
          submit: expectedSubmit,
          create: expectedWelcome,
          login: expectedWelcome,
        });
      } finally {
        preference.mockRestore();
        subscription.mockRestore();
      }
    },
  );
});
