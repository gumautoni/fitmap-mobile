import { fireEvent, render, screen } from "@testing-library/react-native";

import CustomButton from "../CustomButton";

describe("CustomButton", () => {
  it("renders the provided title", async () => {
    await render(<CustomButton title="Abrir mapa" onPress={jest.fn()} />);

    expect(screen.getByText("Abrir mapa")).toBeTruthy();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();

    await render(<CustomButton title="Entrar" onPress={onPress} />);

    await fireEvent.press(screen.getByText("Entrar"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();

    await render(<CustomButton title="Salvar" onPress={onPress} disabled />);

    await fireEvent.press(screen.getByText("Salvar"));

    expect(onPress).not.toHaveBeenCalled();
  });
});
