import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import type { AppTheme } from "../theme/themes";

type ScreenGradientProps = {
  theme: AppTheme;
};

export default function ScreenGradient({ theme }: ScreenGradientProps) {
  if (theme.mode === "dark") {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <LinearGradient
        colors={["#FFDCC3", "#FAF7F2", "#FFE9D6"]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
