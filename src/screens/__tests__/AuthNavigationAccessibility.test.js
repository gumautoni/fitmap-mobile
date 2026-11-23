import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";

import { AuthContext } from "../../context/AuthContext";
import LoginScreen from "../LoginScreen";
import RegisterScreen from "../RegisterScreen";
import WelcomeScreen from "../WelcomeScreen";

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("../../components/FitMapBrand", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../components/auth/AuthBackground", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    __esModule: true,
    default: ({ children }) => React.createElement(View, null, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    SafeAreaView: ({ children, style }) =>
      React.createElement(View, { style }, children),
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
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    LinearGradient: ({ children }) => React.createElement(View, null, children),
  };
});

const BACK_LABEL = "Voltar para boas-vindas";
const LOGIN_ACTION = "Entrar na minha conta";
const REGISTER_ACTION = "Criar minha conta";

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });

  return { promise, resolve, reject };
}

async function mountScreen(Screen, overrides = {}) {
  const navigation = { navigate: jest.fn() };

  const auth = {
    login: jest.fn().mockResolvedValue(undefined),
    register: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  await render(
    <AuthContext.Provider value={auth}>
      <Screen navigation={navigation} />
    </AuthContext.Provider>,
  );

  return { navigation, auth };
}

function expectTouchTarget(label) {
  expect(screen.getByRole("button", { name: label })).toHaveStyle({
    minHeight: 48,
    minWidth: 48,
  });
}

function expectNavigationState(label, disabled) {
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

async function verifyNavigation(navigation, footer, destination) {
  await fireEvent.press(screen.getByRole("button", { name: BACK_LABEL }));

  expect(navigation.navigate).toHaveBeenCalledWith("BoasVindas");

  await fireEvent.press(screen.getByRole("button", { name: footer }));

  expect(navigation.navigate).toHaveBeenLastCalledWith(destination);

  expect(navigation.navigate).toHaveBeenCalledTimes(2);
}

async function verifyPendingNavigation({
  Screen,
  method,
  action,
  footer,
  destination,
  fields,
  args,
}) {
  const request = deferred();

  const submit = jest
    .fn()
    .mockImplementationOnce(() => request.promise)
    .mockResolvedValue(undefined);

  const { navigation } = await mountScreen(Screen, {
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

describe("Auth navigation accessibility", () => {
  it("preserves welcome actions and their touch targets", async () => {
    const { navigation } = await mountScreen(WelcomeScreen);

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
    const { navigation } = await mountScreen(LoginScreen);

    await verifyNavigation(navigation, "Criar conta", "Cadastro");

    expectTouchTarget(BACK_LABEL);
    expectTouchTarget("Criar conta");
  });

  it("accessibility: preserves registration navigation with practical touch targets", async () => {
    const { navigation } = await mountScreen(RegisterScreen);

    await verifyNavigation(navigation, "Ir para Login", "Login");

    expectTouchTarget(BACK_LABEL);
    expectTouchTarget("Ir para Login");
  });

  it("accessibility: disables login navigation while pending and restores it after failure", async () => {
    await verifyPendingNavigation({
      Screen: LoginScreen,
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
});
