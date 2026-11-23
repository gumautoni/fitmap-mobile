import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import ProgressPhotoCapture from "../ProgressPhotoCapture";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  Camera: () => null,
  ImagePlus: () => null,
}));

const cameraPermission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const galleryPermission =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchCamera = ImagePicker.launchCameraAsync as jest.Mock;
const launchGallery = ImagePicker.launchImageLibraryAsync as jest.Mock;

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

const cameraAsset: ImagePicker.ImagePickerAsset = {
  uri: "file:///camera-photo.jpg",
  width: 1200,
  height: 1600,
};

const galleryAsset: ImagePicker.ImagePickerAsset = {
  uri: "file:///gallery-photo.jpg",
  width: 1000,
  height: 1200,
};

async function mount(
  onSave = jest.fn().mockResolvedValue(true),
  uploading = false,
) {
  await render(<ProgressPhotoCapture uploading={uploading} onSave={onSave} />);

  return onSave;
}

async function chooseSource(
  optionName: "Tirar foto" | "Escolher da galeria",
): Promise<void> {
  await fireEvent.press(screen.getByLabelText("Adicionar foto de progresso"));

  const options = alertSpy.mock.calls.at(-1)?.[2];

  const option = options?.find((item) => item.text === optionName);

  if (!option?.onPress) {
    throw new Error(`Opcao nao encontrada: ${optionName}`);
  }

  await act(async () => {
    option.onPress?.();
  });
}

describe("ProgressPhotoCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    cameraPermission.mockResolvedValue({ granted: true });
    galleryPermission.mockResolvedValue({ granted: true });

    launchCamera.mockResolvedValue({
      canceled: false,
      assets: [cameraAsset],
    });

    launchGallery.mockResolvedValue({
      canceled: false,
      assets: [galleryAsset],
    });
  });

  it("oferece camera e galeria sem iniciar upload", async () => {
    const onSave = await mount();

    await fireEvent.press(screen.getByLabelText("Adicionar foto de progresso"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Adicionar foto",
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: "Tirar foto" }),
        expect.objectContaining({ text: "Escolher da galeria" }),
        expect.objectContaining({ text: "Cancelar" }),
      ]),
    );

    expect(launchCamera).not.toHaveBeenCalled();
    expect(launchGallery).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("abre a camera e exibe previa sem enviar automaticamente", async () => {
    const onSave = await mount();

    await chooseSource("Tirar foto");

    expect(cameraPermission).toHaveBeenCalledTimes(1);
    expect(galleryPermission).not.toHaveBeenCalled();

    expect(launchCamera).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    expect(
      await screen.findByLabelText("Prévia da foto de progresso"),
    ).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("abre a galeria e exibe a imagem selecionada", async () => {
    const onSave = await mount();

    await chooseSource("Escolher da galeria");

    expect(galleryPermission).toHaveBeenCalledTimes(1);
    expect(cameraPermission).not.toHaveBeenCalled();

    expect(launchGallery).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    expect(
      await screen.findByLabelText("Prévia da foto de progresso"),
    ).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    ["camera", "Tirar foto"],
    ["galeria", "Escolher da galeria"],
  ] as const)(
    "nao abre %s quando a permissao e negada",
    async (source, option) => {
      if (source === "camera") {
        cameraPermission.mockResolvedValueOnce({ granted: false });
      } else {
        galleryPermission.mockResolvedValueOnce({ granted: false });
      }

      const onSave = await mount();

      await chooseSource(option);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          source === "camera" ? "Acesso à câmera" : "Acesso às fotos",
          expect.any(String),
        );
      });

      expect(launchCamera).not.toHaveBeenCalled();
      expect(launchGallery).not.toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["camera", "Tirar foto"],
    ["galeria", "Escolher da galeria"],
  ] as const)("nao salva nada ao cancelar a %s", async (source, option) => {
    if (source === "camera") {
      launchCamera.mockResolvedValueOnce({
        canceled: true,
        assets: [],
      });
    } else {
      launchGallery.mockResolvedValueOnce({
        canceled: true,
        assets: [],
      });
    }

    const onSave = await mount();

    await chooseSource(option);

    expect(screen.queryByLabelText("Prévia da foto de progresso")).toBeNull();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("descarta a foto sem executar upload", async () => {
    const onSave = await mount();

    await chooseSource("Tirar foto");

    await screen.findByLabelText("Prévia da foto de progresso");

    await fireEvent.press(screen.getByLabelText("Descartar foto"));

    expect(screen.queryByLabelText("Prévia da foto de progresso")).toBeNull();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("envia a foto confirmada e fecha a previa", async () => {
    const onSave = await mount();

    await chooseSource("Tirar foto");

    await screen.findByLabelText("Prévia da foto de progresso");

    await fireEvent.press(screen.getByLabelText("Salvar foto de progresso"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(cameraAsset);

      expect(screen.queryByLabelText("Prévia da foto de progresso")).toBeNull();
    });
  });

  it("preserva a previa quando o salvamento retorna falha", async () => {
    const onSave = jest.fn().mockResolvedValue(false);

    await mount(onSave);

    await chooseSource("Tirar foto");

    await fireEvent.press(screen.getByLabelText("Salvar foto de progresso"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);

      expect(
        screen.getByLabelText("Salvar foto de progresso").props
          .accessibilityState,
      ).toMatchObject({ disabled: false });
    });

    expect(screen.getByLabelText("Prévia da foto de progresso")).toBeTruthy();
  });

  it("permite tentar novamente depois de uma falha", async () => {
    const onSave = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await mount(onSave);

    await chooseSource("Tirar foto");

    await fireEvent.press(screen.getByLabelText("Salvar foto de progresso"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Salvar foto de progresso").props
          .accessibilityState,
      ).toMatchObject({ disabled: false });
    });

    await fireEvent.press(screen.getByLabelText("Salvar foto de progresso"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);

      expect(screen.queryByLabelText("Prévia da foto de progresso")).toBeNull();
    });
  });

  it("trata falhas inesperadas sem descartar a foto", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("network error"));

    await mount(onSave);

    await chooseSource("Escolher da galeria");

    await fireEvent.press(screen.getByLabelText("Salvar foto de progresso"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Não foi possível salvar a foto",
        expect.any(String),
      );
    });

    expect(screen.getByLabelText("Prévia da foto de progresso")).toBeTruthy();
  });

  it("nao permite iniciar outra captura durante upload", async () => {
    const onSave = await mount(undefined, true);

    const button = screen.getByLabelText("Adicionar foto de progresso");

    expect(button.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    expect(screen.getByText("Enviando foto...")).toBeTruthy();

    expect(cameraPermission).not.toHaveBeenCalled();
    expect(galleryPermission).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("accessibility: exposes photo selection processing and restores the action after permission denial", async () => {
    let resolvePermission!: (value: { granted: boolean }) => void;

    const pendingPermission = new Promise<{ granted: boolean }>((done) => {
      resolvePermission = done;
    });

    cameraPermission.mockReturnValueOnce(pendingPermission);

    const onSave = await mount();

    const label = "Adicionar foto de progresso";

    await chooseSource("Tirar foto");

    try {
      const button = screen.getByLabelText(label);

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({
          busy: true,
          disabled: true,
        }),
      );

      expect(button).toBeDisabled();

      expect(button).toHaveStyle({ minHeight: 52 });

      await fireEvent.press(button);

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(cameraPermission).toHaveBeenCalledTimes(1);

      expect(launchCamera).not.toHaveBeenCalled();
      expect(launchGallery).not.toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        resolvePermission({ granted: false });
      });
    }

    expect(alertSpy).toHaveBeenCalledWith(
      "Acesso \u00e0 c\u00e2mera",
      expect.any(String),
    );

    expect(screen.getByLabelText(label)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(screen.getByLabelText(label)).not.toBeDisabled();

    expect(
      screen.queryByLabelText("Pr\u00e9via da foto de progresso"),
    ).toBeNull();

    expect(launchCamera).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    await chooseSource("Tirar foto");

    expect(
      await screen.findByLabelText("Pr\u00e9via da foto de progresso"),
    ).toBeTruthy();

    expect(cameraPermission).toHaveBeenCalledTimes(2);
    expect(launchCamera).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("accessibility: identifies the confirmation heading and photo inside an isolated modal", async () => {
    const onSave = await mount();

    await chooseSource("Escolher da galeria");

    const heading = screen.getByRole("header", {
      name: "Confirmar foto de progresso",
    });

    expect(heading).toBeTruthy();

    const photo = screen.getByRole("image", {
      name: "Pr\u00e9via da foto de progresso",
    });

    expect(photo).toHaveProp("source", {
      uri: galleryAsset.uri,
    });

    let modalContainer = heading.parent;

    while (
      modalContainer &&
      modalContainer.props.accessibilityViewIsModal !== true
    ) {
      modalContainer = modalContainer.parent;
    }

    expect(modalContainer).not.toBeNull();
    expect(modalContainer).toContainElement(photo);

    expect(
      screen.getByText("Confira a imagem antes de salv\u00e1-la privadamente."),
    ).toBeTruthy();

    for (const label of ["Descartar foto", "Salvar foto de progresso"]) {
      const button = screen.getByRole("button", {
        name: label,
      });

      expect(button).not.toBeDisabled();

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: false }),
      );

      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });
    }

    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Descartar foto"));

    expect(
      screen.queryByRole("image", {
        name: "Pr\u00e9via da foto de progresso",
      }),
    ).toBeNull();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("accessibility: exposes pending photo confirmation and preserves the preview after failure", async () => {
    let resolveSave!: (saved: boolean) => void;

    const pendingSave = new Promise<boolean>((done) => {
      resolveSave = done;
    });

    const onSave = jest
      .fn()
      .mockReturnValueOnce(pendingSave)
      .mockResolvedValueOnce(true);

    await mount(onSave);

    await chooseSource("Tirar foto");

    const saveLabel = "Salvar foto de progresso";
    const discardLabel = "Descartar foto";
    const previewLabel = "Pr\u00e9via da foto de progresso";

    await screen.findByLabelText(previewLabel);

    try {
      await fireEvent.press(screen.getByLabelText(saveLabel));

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(cameraAsset);

      expect(screen.getByLabelText(saveLabel)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({
          busy: true,
          disabled: true,
        }),
      );

      expect(screen.getByLabelText(discardLabel)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );

      expect(screen.getByText("Salvando...")).toBeTruthy();

      for (const label of [saveLabel, discardLabel]) {
        const button = screen.getByLabelText(label);

        expect(button).toBeDisabled();

        await fireEvent.press(button);
      }

      expect(onSave).toHaveBeenCalledTimes(1);

      expect(screen.getByLabelText(previewLabel)).toBeTruthy();
    } finally {
      await act(async () => {
        resolveSave(false);
      });
    }

    expect(screen.getByLabelText(previewLabel)).toBeTruthy();

    expect(screen.getByLabelText(saveLabel)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(screen.getByLabelText(discardLabel)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText(saveLabel)).not.toBeDisabled();

    expect(screen.getByLabelText(discardLabel)).not.toBeDisabled();

    expect(screen.queryByText("Salvando...")).toBeNull();

    await fireEvent.press(screen.getByLabelText(saveLabel));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);

      expect(screen.queryByLabelText(previewLabel)).toBeNull();
    });

    expect(onSave).toHaveBeenNthCalledWith(2, cameraAsset);

    expect(
      screen.getByLabelText("Adicionar foto de progresso"),
    ).not.toBeDisabled();
  });

  it("accessibility: exposes externally controlled upload processing without opening another picker", async () => {
    const onSave = jest.fn().mockResolvedValue(true);

    const view = await render(
      <ProgressPhotoCapture uploading onSave={onSave} />,
    );

    const label = "Adicionar foto de progresso";

    const button = screen.getByLabelText(label);

    expect(button).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: true,
        disabled: true,
      }),
    );

    expect(button).toBeDisabled();

    expect(screen.getByText("Enviando foto...")).toBeTruthy();

    await fireEvent.press(button);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(cameraPermission).not.toHaveBeenCalled();
    expect(galleryPermission).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    await view.rerender(
      <ProgressPhotoCapture uploading={false} onSave={onSave} />,
    );

    expect(screen.getByLabelText(label)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
        disabled: false,
      }),
    );

    expect(screen.getByLabelText(label)).not.toBeDisabled();

    expect(screen.queryByText("Enviando foto...")).toBeNull();

    await fireEvent.press(screen.getByLabelText(label));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves explicit confirmation before uploading a selected photo", async () => {
    const onSave = await mount();

    await chooseSource("Escolher da galeria");

    const previewLabel = "Pr\u00e9via da foto de progresso";

    expect(await screen.findByLabelText(previewLabel)).toBeTruthy();

    expect(launchGallery).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Descartar foto"));

    expect(screen.queryByLabelText(previewLabel)).toBeNull();

    expect(onSave).not.toHaveBeenCalled();

    await chooseSource("Tirar foto");

    expect(await screen.findByLabelText(previewLabel)).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Salvar foto de progresso"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);

      expect(screen.queryByLabelText(previewLabel)).toBeNull();
    });

    expect(onSave).toHaveBeenCalledWith(cameraAsset);
    expect(onSave).not.toHaveBeenCalledWith(galleryAsset);
  });
});
