import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { View } from "react-native";

import AuthButton from "../auth/AuthButton";
import AuthField from "../auth/AuthField";

jest.mock("lucide-react-native", () => ({
  ArrowRight: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

jest.mock("expo-linear-gradient", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    LinearGradient: ({ children }) => React.createElement(View, null, children),
  };
});

function passwordProps(overrides = {}) {
  return {
    label: "Senha",
    placeholder: "Digite sua senha",
    value: "SyntheticPassword!123",
    onChangeText: jest.fn(),
    secure: true,
    ...overrides,
  };
}

describe("Auth controls accessibility", () => {
  it("preserves password masking and reversible visibility", async () => {
    await render(<AuthField {...passwordProps()} />);

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);

    await fireEvent.press(screen.getByLabelText("Mostrar senha"));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", false);

    await fireEvent.press(screen.getByLabelText("Ocultar senha"));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);
  });

  it("preserves the submit label and blocks duplicate submission", async () => {
    const onPress = jest.fn();

    const view = await render(
      <AuthButton title="Entrar" onPress={onPress} loading />,
    );

    const button = screen.getByLabelText("Entrar");

    expect(button).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: true, disabled: true }),
    );

    expect(screen.getByText("Aguarde...")).toBeTruthy();

    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();

    await view.rerender(<AuthButton title="Entrar" onPress={onPress} />);

    expect(screen.getByLabelText("Entrar")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false, disabled: false }),
    );

    await fireEvent.press(screen.getByLabelText("Entrar"));

    expect(onPress).toHaveBeenCalledTimes(1);

    await view.rerender(
      <AuthButton title="Entrar" onPress={onPress} disabled />,
    );

    expect(screen.getByLabelText("Entrar")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false, disabled: true }),
    );

    await fireEvent.press(screen.getByLabelText("Entrar"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("accessibility: distinguishes password and confirmation visibility", async () => {
    await render(
      <View>
        <AuthField {...passwordProps()} />

        <AuthField
          {...passwordProps({
            label: "Confirmar senha",
            placeholder: "Repita sua senha",
            visibilityLabel: "confirma\u00e7\u00e3o de senha",
          })}
        />
      </View>,
    );

    expect(screen.getByLabelText("Mostrar senha")).toBeTruthy();

    const confirmation = screen.getByLabelText(
      "Mostrar confirma\u00e7\u00e3o de senha",
    );

    await fireEvent.press(confirmation);

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);

    expect(screen.getByLabelText("Confirmar senha")).toHaveProp(
      "secureTextEntry",
      false,
    );

    await fireEvent.press(
      screen.getByLabelText("Ocultar confirma\u00e7\u00e3o de senha"),
    );

    expect(screen.getByLabelText("Confirmar senha")).toHaveProp(
      "secureTextEntry",
      true,
    );
  });

  it("accessibility: exposes disabled fields and visibility controls", async () => {
    const props = passwordProps();

    const view = await render(<AuthField {...props} editable={false} />);

    const field = screen.getByLabelText("Senha");

    expect(field).toHaveProp("editable", false);

    expect(field).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: true }),
    );

    expect(screen.getByLabelText("Mostrar senha")).toBeDisabled();

    await fireEvent.press(screen.getByLabelText("Mostrar senha"));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", true);

    await view.rerender(<AuthField {...props} editable />);

    expect(screen.getByLabelText("Senha")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText("Mostrar senha")).not.toBeDisabled();

    await fireEvent.press(screen.getByLabelText("Mostrar senha"));

    expect(screen.getByLabelText("Senha")).toHaveProp("secureTextEntry", false);
  });

  it("accessibility: associates helper and error messages with the field", async () => {
    const helper = "Use letras, numeros e simbolos.";
    const error = "Confira os requisitos da senha.";

    const props = passwordProps({ helper });

    const view = await render(<AuthField {...props} />);

    expect(screen.getByLabelText("Senha")).toHaveProp(
      "accessibilityHint",
      helper,
    );

    expect(screen.getByText(helper)).toBeTruthy();

    await view.rerender(<AuthField {...props} error={error} />);

    expect(screen.getByLabelText("Senha")).toHaveProp(
      "accessibilityHint",
      error,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(error);

    expect(screen.queryByText(helper)).toBeNull();

    await view.rerender(<AuthField {...props} />);

    expect(screen.getByLabelText("Senha")).toHaveProp(
      "accessibilityHint",
      helper,
    );
  });

  it("accessibility: provides a practical password visibility touch target", async () => {
    await render(<AuthField {...passwordProps()} />);

    expect(screen.getByLabelText("Mostrar senha")).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });
  });
});
