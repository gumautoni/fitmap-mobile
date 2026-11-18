import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import ProfileHeightEditor from "../ProfileHeightEditor";

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

describe("ProfileHeightEditor", () => {
  it("displays the saved height using a decimal comma", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    await render(
      <ProfileHeightEditor heightCm="180.50" saving={false} onSave={onSave} />,
    );

    expect(screen.getByLabelText("Altura em centímetros").props.value).toBe(
      "180,50",
    );

    expect(screen.getByLabelText("Remover altura")).toBeTruthy();
  });

  it("updates its displayed value when profile data changes", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    const view = await render(
      <ProfileHeightEditor heightCm={null} saving={false} onSave={onSave} />,
    );

    expect(screen.getByLabelText("Altura em centímetros").props.value).toBe("");

    await view.rerender(
      <ProfileHeightEditor heightCm="175.00" saving={false} onSave={onSave} />,
    );

    expect(screen.getByLabelText("Altura em centímetros").props.value).toBe(
      "175,00",
    );
  });

  it("saves height entered using a decimal comma", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    const view = await render(
      <ProfileHeightEditor heightCm={null} saving={false} onSave={onSave} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText("Altura em centímetros"),
      "175,5",
    );

    await fireEvent.press(screen.getByLabelText("Salvar altura"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("175.50");
      expect(screen.getByText("Altura salva com sucesso.")).toBeTruthy();
    });

    await view.rerender(
      <ProfileHeightEditor heightCm="175.50" saving={false} onSave={onSave} />,
    );

    expect(screen.getByLabelText("Altura em centímetros").props.value).toBe(
      "175,50",
    );
  });

  it.each([
    ["vazio", ""],
    ["abaixo do minimo", "49,99"],
    ["acima do maximo", "250,01"],
    ["tres casas decimais", "175,555"],
    ["formato exponencial", "1e2"],
  ])("rejects %s without saving", async (_label, input) => {
    const onSave = jest.fn().mockResolvedValue(true);

    await render(
      <ProfileHeightEditor heightCm={null} saving={false} onSave={onSave} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText("Altura em centímetros"),
      input,
    );

    await fireEvent.press(screen.getByLabelText("Salvar altura"));

    expect(
      screen.getByText(
        "Informe uma altura entre 50 e 250 cm, com até duas casas decimais.",
      ),
    ).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not send an unchanged height", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    await render(
      <ProfileHeightEditor heightCm="175.00" saving={false} onSave={onSave} />,
    );

    await fireEvent.press(screen.getByLabelText("Salvar altura"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Altura já está atualizada.")).toBeTruthy();
  });

  it("preserves the entered value after a failed save", async () => {
    const onSave = jest.fn().mockResolvedValue(false);

    await render(
      <ProfileHeightEditor heightCm="175.00" saving={false} onSave={onSave} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText("Altura em centímetros"),
      "180,25",
    );

    await fireEvent.press(screen.getByLabelText("Salvar altura"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("180.25");
    });

    expect(screen.getByLabelText("Altura em centímetros").props.value).toBe(
      "180,25",
    );

    expect(screen.queryByText("Altura salva com sucesso.")).toBeNull();
  });

  it("asks for confirmation before removing height", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    try {
      await render(
        <ProfileHeightEditor
          heightCm="180.00"
          saving={false}
          onSave={onSave}
        />,
      );

      await fireEvent.press(screen.getByLabelText("Remover altura"));

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0]?.[0]).toBe("Remover altura");
      expect(onSave).not.toHaveBeenCalled();

      const buttons = alertSpy.mock.calls[0]?.[2];

      expect(buttons?.some((button) => button.text === "Cancelar")).toBe(true);

      const confirm = buttons?.find((button) => button.text === "Remover");

      expect(confirm?.style).toBe("destructive");
      expect(confirm?.onPress).toBeDefined();

      await act(async () => {
        confirm?.onPress?.();
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(null);
      });
    } finally {
      alertSpy.mockRestore();
    }
  });

  it("disables editing and actions while saving", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    try {
      await render(
        <ProfileHeightEditor heightCm="180.00" saving={true} onSave={onSave} />,
      );

      expect(
        screen.getByLabelText("Altura em centímetros").props.editable,
      ).toBe(false);

      await fireEvent.press(screen.getByLabelText("Salvar altura"));
      await fireEvent.press(screen.getByLabelText("Remover altura"));

      expect(onSave).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      alertSpy.mockRestore();
    }
  });

  it("hides the remove action when no height is saved", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    await render(
      <ProfileHeightEditor heightCm={null} saving={false} onSave={onSave} />,
    );

    expect(screen.queryByLabelText("Remover altura")).toBeNull();
  });

  it("accessibility: exposes pending height editing and action states", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    const view = await render(
      <ProfileHeightEditor heightCm="175.00" saving={true} onSave={onSave} />,
    );

    const inputLabel = "Altura em cent\u00edmetros";

    expect(screen.getByLabelText(inputLabel)).toHaveProp("editable", false);

    expect(screen.getByLabelText(inputLabel)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: true }),
    );

    expect(screen.getByLabelText("Salvar altura")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: true, disabled: true }),
    );

    expect(screen.getByLabelText("Remover altura")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: true }),
    );

    expect(screen.getByLabelText("Salvar altura")).toBeDisabled();
    expect(screen.getByLabelText("Remover altura")).toBeDisabled();

    await fireEvent.press(screen.getByLabelText("Salvar altura"));
    await fireEvent.press(screen.getByLabelText("Remover altura"));

    expect(onSave).not.toHaveBeenCalled();

    await view.rerender(
      <ProfileHeightEditor heightCm="175.00" saving={false} onSave={onSave} />,
    );

    expect(screen.getByLabelText(inputLabel)).toHaveProp("editable", true);

    expect(screen.getByLabelText(inputLabel)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText("Salvar altura")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false, disabled: false }),
    );

    expect(screen.getByLabelText("Remover altura")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText("Salvar altura")).not.toBeDisabled();
    expect(screen.getByLabelText("Remover altura")).not.toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("accessibility: associates height guidance and validation errors with the input", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    await render(
      <ProfileHeightEditor heightCm={null} saving={false} onSave={onSave} />,
    );

    const inputLabel = "Altura em cent\u00edmetros";

    const guidance =
      "Valores entre 50 e 250 cm. Use v\u00edrgula ou ponto como separador.";

    const error =
      "Informe uma altura entre 50 e 250 cm, com at\u00e9 duas casas decimais.";

    expect(screen.getByText(guidance)).toBeTruthy();

    expect(screen.getByLabelText(inputLabel)).toHaveProp(
      "accessibilityHint",
      guidance,
    );

    await fireEvent.changeText(screen.getByLabelText(inputLabel), "49");

    await fireEvent.press(screen.getByLabelText("Salvar altura"));

    expect(screen.getByText(error)).toBeTruthy();

    expect(screen.getByLabelText(inputLabel)).toHaveProp(
      "accessibilityHint",
      error,
    );

    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(inputLabel), "175,5");

    expect(screen.queryByText(error)).toBeNull();

    expect(screen.getByLabelText(inputLabel)).toHaveProp(
      "accessibilityHint",
      guidance,
    );

    await fireEvent.press(screen.getByLabelText("Salvar altura"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("175.50");

    expect(await screen.findByText("Altura salva com sucesso.")).toBeTruthy();
  });

  it("accessibility: provides practical height action touch targets", async () => {
    await render(
      <ProfileHeightEditor
        heightCm="175.00"
        saving={false}
        onSave={jest.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByLabelText("Salvar altura")).toHaveStyle({
      minHeight: 48,
    });

    expect(screen.getByLabelText("Remover altura")).toHaveStyle({
      minHeight: 48,
    });
  });
});
