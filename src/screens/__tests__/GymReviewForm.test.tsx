import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { useAppTheme } from "../../theme/ThemeProvider";
import { lightTheme } from "../../theme/themes";
import GymReviewForm from "../GymReviewForm";

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: jest.fn(),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  Send: () => null,
  Star: () => null,
}));

const mockedTheme = useAppTheme as jest.Mock;

type FormOptions = Omit<ComponentProps<typeof GymReviewForm>, "onSubmit">;

async function renderForm(options: FormOptions = {}) {
  const onSubmit = jest.fn();

  await render(<GymReviewForm onSubmit={onSubmit} {...options} />);

  return { onSubmit };
}

describe("GymReviewForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedTheme.mockReturnValue({
      theme: lightTheme,
    });
  });

  it("shows an empty form with an optional comment", async () => {
    await renderForm();

    expect(screen.getByText("Sua avaliação")).toBeTruthy();

    expect(screen.getByText("Selecione uma nota para continuar")).toBeTruthy();

    expect(screen.getByText("Opcional")).toBeTruthy();

    expect(screen.getByText("0/1000 caracteres")).toBeTruthy();

    expect(screen.getByLabelText("Publicar avaliação")).toBeTruthy();

    expect(screen.queryByLabelText("Cancelar avaliação")).toBeNull();
  });

  it("selects a rating from one to five stars", async () => {
    await renderForm();

    await fireEvent.press(screen.getByLabelText("Selecionar 4 estrelas"));

    expect(screen.getByText("4 de 5 estrelas")).toBeTruthy();

    expect(
      screen.getByLabelText("Selecionar 4 estrelas").props.accessibilityState,
    ).toMatchObject({
      selected: true,
      disabled: false,
    });
  });

  it("requires a rating before submitting", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(
      screen.getByText("Selecione uma nota de 1 a 5 estrelas."),
    ).toBeTruthy();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears rating validation after selecting a star", async () => {
    await renderForm();

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(
      screen.getByText("Selecione uma nota de 1 a 5 estrelas."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Selecionar 3 estrelas"));

    expect(
      screen.queryByText("Selecione uma nota de 1 a 5 estrelas."),
    ).toBeNull();

    expect(screen.getByText("3 de 5 estrelas")).toBeTruthy();
  });

  it("submits a rating without a written comment", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(onSubmit).toHaveBeenCalledTimes(1);

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      comment: null,
    });
  });

  it("trims a written comment before submitting", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(screen.getByLabelText("Selecionar 4 estrelas"));

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "  Academia bem equipada.  ",
    );

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 4,
      comment: "Academia bem equipada.",
    });
  });

  it("converts a whitespace-only comment to null", async () => {
    const { onSubmit } = await renderForm({
      initialRating: 3,
    });

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "   ",
    );

    await fireEvent.press(screen.getByLabelText("Publicar avaliação"));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 3,
      comment: null,
    });
  });

  it("prefills existing values for editing", async () => {
    const { onSubmit } = await renderForm({
      initialRating: 4,
      initialComment: "Comentário anterior.",
      submitLabel: "Salvar alterações",
    });

    expect(screen.getByText("4 de 5 estrelas")).toBeTruthy();

    expect(screen.getByLabelText("Comentário da avaliação").props.value).toBe(
      "Comentário anterior.",
    );

    await fireEvent.press(screen.getByLabelText("Selecionar 5 estrelas"));

    await fireEvent.changeText(
      screen.getByLabelText("Comentário da avaliação"),
      "  Comentário atualizado.  ",
    );

    await fireEvent.press(screen.getByLabelText("Salvar alterações"));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      comment: "Comentário atualizado.",
    });
  });

  it("calls the cancellation callback when available", async () => {
    const onCancel = jest.fn();
    const { onSubmit } = await renderForm({
      onCancel,
    });

    await fireEvent.press(screen.getByLabelText("Cancelar avaliação"));

    expect(onCancel).toHaveBeenCalledTimes(1);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables interactions while submitting", async () => {
    const { onSubmit } = await renderForm({
      initialRating: 4,
      submitting: true,
      submitLabel: "Salvar alterações",
    });

    expect(screen.getByText("Salvando avaliação...")).toBeTruthy();

    expect(
      screen.getByLabelText("Salvar alterações").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(
      screen.getByLabelText("Selecionar 4 estrelas").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(
      screen.getByLabelText("Comentário da avaliação").props.editable,
    ).toBe(false);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("displays a backend submission error", async () => {
    await renderForm({
      initialRating: 5,
      errorMessage: "Não foi possível salvar sua avaliação.",
    });

    expect(
      screen.getByText("Não foi possível salvar sua avaliação."),
    ).toBeTruthy();

    expect(screen.getByLabelText("Publicar avaliação")).toBeTruthy();
  });

  it("limits the comment field to 1000 characters", async () => {
    await renderForm();

    const input = screen.getByLabelText("Comentário da avaliação");

    expect(input.props.maxLength).toBe(1000);

    await fireEvent.changeText(input, "Ótima academia!");

    expect(screen.getByText("15/1000 caracteres")).toBeTruthy();
  });
});
