import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  source: ImageSourcePropType;
  dateLabel: string;
  reduceMotion: boolean;
  onClose: () => void;
}

export default function ProgressPhotoViewer({
  source,
  dateLabel,
  reduceMotion,
  onClose,
}: Props) {
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }

    scale.setValue(0.96);

    const animation = Animated.timing(scale, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [reduceMotion, scale]);

  return (
    <Modal
      visible
      animationType={reduceMotion ? "none" : "fade"}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />

      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
        accessibilityViewIsModal
      >
        <View style={styles.header}>
          <Text style={styles.title}>Foto de progresso</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar foto ampliada"
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.imageContainer}>
          <Animated.Image
            source={source}
            resizeMode="contain"
            accessibilityLabel="Foto de progresso ampliada"
            style={[styles.image, { transform: [{ scale }] }]}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.date}>{dateLabel}</Text>

          <Text style={styles.privacy}>Registro visual privado</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#080D19",
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pressed: {
    opacity: 0.65,
  },
  imageContainer: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: "center",
    gap: 5,
  },
  date: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  privacy: {
    color: "#AAB4CA",
    fontSize: 12,
  },
});
