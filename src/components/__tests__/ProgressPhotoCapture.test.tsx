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
});
