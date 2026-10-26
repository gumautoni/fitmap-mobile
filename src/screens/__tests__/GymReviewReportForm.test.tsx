import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { useAppTheme } from "../../theme/ThemeProvider";
import { lightTheme } from "../../theme/themes";
import GymReviewReportForm from "../GymReviewReportForm";

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: jest.fn(),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  Flag: () => null,
}));

const mockedTheme = useAppTheme as jest.Mock;

type FormOptions = Omit<
  ComponentProps<typeof GymReviewReportForm>,
  "onSubmit" | "onCancel"
>;

const REASONS = [
  ["Spam ou publicidade", "spam"],
  ["Conteúdo ofensivo", "offensive"],
  ["Informação enganosa", "misleading"],
  ["Outro motivo", "other"],
] as const;

async function renderForm(options: FormOptions = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  await render(
    <GymReviewReportForm
      {...options}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );

  return { onSubmit, onCancel };
}

describe("GymReviewReportForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedTheme.mockReturnValue({
      theme: lightTheme,
    });
  });

  it("shows all reporting reasons and the optional details field", async () => {
    await renderForm();

    expect(screen.getByText("Denunciar avaliação")).toBeTruthy();

    for (const [label] of REASONS) {
      expect(screen.getByLabelText(`Selecionar motivo: ${label}`)).toBeTruthy();
    }

    expect(screen.getByText("Opcional")).toBeTruthy();
    expect(screen.getByText("0/500 caracteres")).toBeTruthy();

    expect(screen.getByLabelText("Enviar denúncia")).toBeTruthy();

    expect(screen.getByLabelText("Cancelar denúncia")).toBeTruthy();
  });

  it.each(REASONS)(
    "allows selecting the reporting reason: %s",
    async (label) => {
      await renderForm();

      await fireEvent.press(
        screen.getByLabelText(`Selecionar motivo: ${label}`),
      );

      expect(
        screen.getByLabelText(`Selecionar motivo: ${label}`).props
          .accessibilityState,
      ).toMatchObject({
        selected: true,
        disabled: false,
      });
    },
  );

  it("requires a reason before submitting", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(screen.getByText("Selecione o motivo da denúncia.")).toBeTruthy();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears the validation error after selecting a reason", async () => {
    await renderForm();

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(screen.getByText("Selecione o motivo da denúncia.")).toBeTruthy();

    await fireEvent.press(
      screen.getByLabelText("Selecionar motivo: Conteúdo ofensivo"),
    );

    expect(screen.queryByText("Selecione o motivo da denúncia.")).toBeNull();
  });

  it("allows changing the selected reason", async () => {
    await renderForm();

    const spam = screen.getByLabelText(
      "Selecionar motivo: Spam ou publicidade",
    );

    const misleading = screen.getByLabelText(
      "Selecionar motivo: Informação enganosa",
    );

    await fireEvent.press(spam);

    expect(
      screen.getByLabelText("Selecionar motivo: Spam ou publicidade").props
        .accessibilityState,
    ).toMatchObject({ selected: true });

    await fireEvent.press(misleading);

    expect(
      screen.getByLabelText("Selecionar motivo: Spam ou publicidade").props
        .accessibilityState,
    ).toMatchObject({ selected: false });

    expect(
      screen.getByLabelText("Selecionar motivo: Informação enganosa").props
        .accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it("submits a selected reason without optional details", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(
      screen.getByLabelText("Selecionar motivo: Spam ou publicidade"),
    );

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(onSubmit).toHaveBeenCalledTimes(1);

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "spam",
      details: null,
    });
  });

  it("trims optional details before submitting", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(
      screen.getByLabelText("Selecionar motivo: Informação enganosa"),
    );

    await fireEvent.changeText(
      screen.getByLabelText("Detalhes da denúncia"),
      "  O comentário apresenta informações falsas.  ",
    );

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "misleading",
      details: "O comentário apresenta informações falsas.",
    });
  });

  it("converts whitespace-only details into null", async () => {
    const { onSubmit } = await renderForm();

    await fireEvent.press(
      screen.getByLabelText("Selecionar motivo: Outro motivo"),
    );

    await fireEvent.changeText(
      screen.getByLabelText("Detalhes da denúncia"),
      "   ",
    );

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "other",
      details: null,
    });
  });

  it("configures the 500-character limit and updates the counter", async () => {
    await renderForm();

    const input = screen.getByLabelText("Detalhes da denúncia");

    expect(input.props.maxLength).toBe(500);

    const details = "Comentário inadequado.";

    await fireEvent.changeText(input, details);

    expect(screen.getByText(`${details.length}/500 caracteres`)).toBeTruthy();
  });

  it("calls cancellation without submitting", async () => {
    const { onSubmit, onCancel } = await renderForm();

    await fireEvent.press(screen.getByLabelText("Cancelar denúncia"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the form during submission", async () => {
    const { onSubmit, onCancel } = await renderForm({
      submitting: true,
    });

    expect(screen.getByText("Enviando denúncia...")).toBeTruthy();

    expect(
      screen.getByLabelText("Enviar denúncia").props.accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(
      screen.getByLabelText("Selecionar motivo: Conteúdo ofensivo").props
        .accessibilityState,
    ).toMatchObject({
      disabled: true,
    });

    expect(screen.getByLabelText("Detalhes da denúncia").props.editable).toBe(
      false,
    );

    await fireEvent.press(screen.getByLabelText("Enviar denúncia"));

    await fireEvent.press(screen.getByLabelText("Cancelar denúncia"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("displays a submission error without hiding the form", async () => {
    await renderForm({
      errorMessage: "Não foi possível enviar a denúncia.",
    });

    expect(
      screen.getByText("Não foi possível enviar a denúncia."),
    ).toBeTruthy();

    expect(screen.getByLabelText("Enviar denúncia")).toBeTruthy();

    expect(screen.getByLabelText("Cancelar denúncia")).toBeTruthy();
  });
});
