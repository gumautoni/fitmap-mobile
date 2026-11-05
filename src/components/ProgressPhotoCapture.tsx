import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";

type PhotoSource = "camera" | "gallery";

interface Props {
  uploading: boolean;
  onSave: (asset: ImagePicker.ImagePickerAsset) => Promise<boolean>;
}

export default function ProgressPhotoCapture({ uploading, onSave }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selecting, setSelecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const busy = uploading || selecting || confirming;

  async function selectPhoto(source: PhotoSource): Promise<void> {
    if (busy || previewAsset) return;

    setSelecting(true);

    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          source === "camera" ? "Acesso à câmera" : "Acesso às fotos",
          source === "camera"
            ? "Permita que o FitMap use sua câmera para registrar uma foto de progresso."
            : "Permita que o FitMap acesse sua galeria para selecionar uma foto de progresso.",
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: false,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: false,
              quality: 1,
            });

      if (!result.canceled && result.assets[0]) {
        setPreviewAsset(result.assets[0]);
      }
    } catch {
      Alert.alert(
        "Não foi possível abrir a imagem",
        "Verifique as permissões e tente novamente.",
      );
    } finally {
      setSelecting(false);
    }
  }

  function openPhotoOptions(): void {
    if (busy || previewAsset) return;

    Alert.alert("Adicionar foto", "Como deseja registrar seu progresso?", [
      {
        text: "Tirar foto",
        onPress: () => {
          void selectPhoto("camera");
        },
      },
      {
        text: "Escolher da galeria",
        onPress: () => {
          void selectPhoto("gallery");
        },
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  }

  function discardPreview(): void {
    if (!busy) setPreviewAsset(null);
  }

  async function confirmPhoto(): Promise<void> {
    if (!previewAsset || busy) return;

    setConfirming(true);

    try {
      const saved = await onSave(previewAsset);

      if (saved) {
        setPreviewAsset(null);
      }
    } catch {
      Alert.alert(
        "Não foi possível salvar a foto",
        "Tente novamente. Sua foto ainda não foi enviada.",
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar foto de progresso"
        disabled={busy}
        onPress={openPhotoOptions}
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
        ) : (
          <ImagePlus size={20} color={theme.colors.textOnPrimary} />
        )}

        <Text style={styles.addButtonText}>
          {uploading ? "Enviando foto..." : "Adicionar foto"}
        </Text>
      </Pressable>

      {previewAsset ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={discardPreview}
        >
          <View style={styles.overlay}>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>
                Confirmar foto de progresso
              </Text>

              <Text style={styles.previewDescription}>
                Confira a imagem antes de salvá-la privadamente.
              </Text>

              <Image
                source={{ uri: previewAsset.uri }}
                style={styles.previewImage}
                resizeMode="contain"
                accessibilityLabel="Prévia da foto de progresso"
              />

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Descartar foto"
                  disabled={busy}
                  onPress={discardPreview}
                  style={[styles.actionButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelText}>Descartar</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Salvar foto de progresso"
                  disabled={busy}
                  onPress={() => {
                    void confirmPhoto();
                  }}
                  style={[
                    styles.actionButton,
                    styles.saveButton,
                    busy && styles.disabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.textOnPrimary}
                    />
                  ) : (
                    <Camera size={17} color={theme.colors.textOnPrimary} />
                  )}

                  <Text style={styles.saveText}>
                    {busy ? "Salvando..." : "Salvar foto"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    addButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },
    addButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },
    pressed: {
      opacity: 0.78,
    },
    disabled: {
      opacity: 0.55,
    },
    overlay: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: "rgba(5, 12, 28, 0.78)",
      padding: theme.spacing.lg,
    },
    previewCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    previewTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
    },
    previewDescription: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    previewImage: {
      width: "100%",
      height: 320,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radii.lg,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    actionButton: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.sm,
    },
    cancelButton: {
      backgroundColor: theme.colors.surfaceSecondary,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
    },
    cancelText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
    },
    saveText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
    },
  });
}
