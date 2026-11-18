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

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("../../components/auth/AuthScreenShell", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    __esModule: true,
    default: ({ children }) => React.createElement(View, null, children),
  };
});

jest.mock("lucide-react-native", () => ({
  ArrowRight: () => null,
  CheckCircle2: () => null,
  Circle: () => null,
  Eye: () => null,
  EyeOff: () => null,
  LockKeyhole: () => null,
  Mail: () => null,
  UserRound: () => null,
}));

jest.mock("expo-linear-gradient", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    LinearGradient: ({ children }) => React.createElement(View, null, children),
  };
});

const LOGIN_ACTION = "Entrar na minha conta";
const REGISTER_ACTION = "Criar minha conta";
const CONFIRM_FIELD = "Confirmar senha";

const SHOW_CONFIRMATION = "Mostrar confirma\u00e7\u00e3o de senha";

const HIDE_CONFIRMATION = "Ocultar confirma\u00e7\u00e3o de senha";

const PASSWORD = "Aa1!bcde";
const LEGACY_PASSWORD = "senha";

const EMAIL = "pessoa@example.com";
const NAME = "Ana Silva";

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
  const auth = {
    login: jest.fn().mockResolvedValue(undefined),
    register: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  const navigation = {
    navigate: jest.fn(),
  };

  await render(
    <AuthContext.Provider value={auth}>
      <Screen navigation={navigation} />
    </AuthContext.Provider>,
  );

  return { auth, navigation };
}

async function fillLogin() {
  await fireEvent.changeText(
    screen.getByLabelText("E-mail"),
    "  PESSOA@EXAMPLE.COM  ",
  );

  await fireEvent.changeText(screen.getByLabelText("Senha"), LEGACY_PASSWORD);
}

async function fillRegister(confirmation = PASSWORD) {
  await fireEvent.changeText(
    screen.getByLabelText("Nome completo"),
    "  Ana   Silva  ",
  );

  await fireEvent.changeText(
    screen.getByLabelText("E-mail"),
    "  PESSOA@EXAMPLE.COM  ",
  );

  await fireEvent.changeText(screen.getByLabelText("Senha"), PASSWORD);

  await fireEvent.changeText(
    screen.getByLabelText(CONFIRM_FIELD),
    confirmation,
  );
}

function expectFieldsDisabled(labels, disabled) {
  for (const label of labels) {
    const field = screen.getByLabelText(label);

    expect(field).toHaveProp("editable", !disabled);

    expect(field).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled }),
    );
  }
}

function expectSubmitState(label, busy) {
  expect(screen.getByLabelText(label)).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy,
      disabled: busy,
    }),
  );
}

describe("Auth screens accessibility", () => {
  it("preserves login validation without submitting invalid fields", async () => {
    const { auth } = await mountScreen(LoginScreen);

    await fireEvent.press(screen.getByLabelText(LOGIN_ACTION));

    expect(auth.login).not.toHaveBeenCalled();

    expect(screen.getByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.getByText("Informe sua senha.")).toBeTruthy();

    expect(screen.getByLabelText("E-mail")).toHaveProp(
      "accessibilityHint",
      "Informe seu e-mail.",
    );

    expect(screen.getByLabelText("Senha")).toHaveProp(
      "accessibilityHint",
      "Informe sua senha.",
    );
  });

  it("preserves registration validation for mismatched passwords", async () => {
    const { auth } = await mountScreen(RegisterScreen);

    await fillRegister("Aa1!different");

    await fireEvent.press(screen.getByLabelText(REGISTER_ACTION));

    const message = "As senhas n\u00e3o coincidem.";

    expect(auth.register).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeTruthy();

    expect(screen.getByLabelText(CONFIRM_FIELD)).toHaveProp(
      "accessibilityHint",
      message,
    );
  });

  it("preserves accessible password requirement descriptions", async () => {
    await mountScreen(RegisterScreen);

    await fireEvent.changeText(screen.getByLabelText("Senha"), "abc");

    expect(screen.getByLabelText("8 a 128 caracteres: pendente")).toBeTruthy();

    expect(
      screen.getByLabelText("Uma letra mai\u00fascula: pendente"),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Uma letra min\u00fascula: atendido"),
    ).toBeTruthy();

    expect(screen.getByLabelText("Um n\u00famero: pendente")).toBeTruthy();

    expect(
      screen.getByLabelText("Um s\u00edmbolo (!, @, #...): pendente"),
    ).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Senha"), PASSWORD);

    expect(screen.getByLabelText("8 a 128 caracteres: atendido")).toBeTruthy();

    expect(
      screen.getByLabelText("Uma letra mai\u00fascula: atendido"),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Uma letra min\u00fascula: atendido"),
    ).toBeTruthy();

    expect(screen.getByLabelText("Um n\u00famero: atendido")).toBeTruthy();

    expect(
      screen.getByLabelText("Um s\u00edmbolo (!, @, #...): atendido"),
    ).toBeTruthy();
  });

  it("accessibility: disables login fields while pending and restores them after failure", async () => {
    const request = deferred();

    const login = jest
      .fn()
      .mockImplementationOnce(() => request.promise)
      .mockResolvedValue(undefined);

    await mountScreen(LoginScreen, { login });

    await fillLogin();

    const fields = ["E-mail", "Senha"];

    expectFieldsDisabled(fields, false);

    const user = userEvent.setup();

    try {
      await user.press(screen.getByLabelText(LOGIN_ACTION));

      expect(login).toHaveBeenCalledTimes(1);

      expect(login).toHaveBeenCalledWith(EMAIL, LEGACY_PASSWORD);

      expectSubmitState(LOGIN_ACTION, true);

      expectFieldsDisabled(fields, true);

      expect(screen.getByLabelText("Mostrar senha")).toBeDisabled();

      await fireEvent.press(screen.getByLabelText(LOGIN_ACTION));

      expect(login).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        if (login.mock.calls.length > 0) {
          request.reject(new Error("Falha de login simulada."));
        } else {
          request.resolve();
        }
      });
    }

    expect(screen.getByText("Falha de login simulada.")).toBeTruthy();

    expectFieldsDisabled(fields, false);
    expectSubmitState(LOGIN_ACTION, false);

    expect(screen.getByLabelText("Mostrar senha")).not.toBeDisabled();

    await fireEvent.press(screen.getByLabelText(LOGIN_ACTION));

    expect(login).toHaveBeenCalledTimes(2);

    expect(login).toHaveBeenLastCalledWith(EMAIL, LEGACY_PASSWORD);

    expect(screen.queryByText("Falha de login simulada.")).toBeNull();

    expectSubmitState(LOGIN_ACTION, false);
  });

  it("accessibility: disables registration fields while pending and restores them after failure", async () => {
    const request = deferred();

    const register = jest
      .fn()
      .mockImplementationOnce(() => request.promise)
      .mockResolvedValue(undefined);

    await mountScreen(RegisterScreen, { register });

    await fillRegister();

    const fields = ["Nome completo", "E-mail", "Senha", CONFIRM_FIELD];

    expectFieldsDisabled(fields, false);

    const user = userEvent.setup();

    try {
      await user.press(screen.getByLabelText(REGISTER_ACTION));

      expect(register).toHaveBeenCalledTimes(1);

      expect(register).toHaveBeenCalledWith(NAME, EMAIL, PASSWORD);

      expectSubmitState(REGISTER_ACTION, true);

      expectFieldsDisabled(fields, true);

      expect(screen.getByLabelText("Mostrar senha")).toBeDisabled();

      expect(screen.getByLabelText(SHOW_CONFIRMATION)).toBeDisabled();

      await fireEvent.press(screen.getByLabelText(REGISTER_ACTION));

      expect(register).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        if (register.mock.calls.length > 0) {
          request.reject(new Error("Falha de cadastro simulada."));
        } else {
          request.resolve();
        }
      });
    }

    expect(screen.getByText("Falha de cadastro simulada.")).toBeTruthy();

    expectFieldsDisabled(fields, false);
    expectSubmitState(REGISTER_ACTION, false);

    expect(screen.getByLabelText("Mostrar senha")).not.toBeDisabled();

    expect(screen.getByLabelText(SHOW_CONFIRMATION)).not.toBeDisabled();

    await fireEvent.press(screen.getByLabelText(REGISTER_ACTION));

    expect(register).toHaveBeenCalledTimes(2);

    expect(register).toHaveBeenLastCalledWith(NAME, EMAIL, PASSWORD);

    expect(screen.queryByText("Falha de cadastro simulada.")).toBeNull();

    expectSubmitState(REGISTER_ACTION, false);
  });

  it("accessibility: identifies and toggles registration passwords independently", async () => {
    await mountScreen(RegisterScreen);

    await fillRegister();

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);

    expect(screen.getByLabelText(CONFIRM_FIELD)).toHaveProp(
      "secureTextEntry",
      true,
    );

    await fireEvent.press(screen.getByLabelText(SHOW_CONFIRMATION));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);

    expect(screen.getByLabelText(CONFIRM_FIELD)).toHaveProp(
      "secureTextEntry",
      false,
    );

    await fireEvent.press(screen.getByLabelText("Mostrar senha"));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", false);

    await fireEvent.press(screen.getByLabelText(HIDE_CONFIRMATION));

    expect(screen.getByLabelText(CONFIRM_FIELD)).toHaveProp(
      "secureTextEntry",
      true,
    );

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", false);

    await fireEvent.press(screen.getByLabelText("Ocultar senha"));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);
  });
});
