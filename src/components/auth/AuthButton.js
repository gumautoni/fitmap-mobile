import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
}) {
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      onPress={onPress}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !unavailable && styles.pressed,
        unavailable && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={["#3F51E8", "#245FEC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.text}>{loading ? "Aguarde..." : title}</Text>
        <View style={styles.icon}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <ArrowRight color="#FFFFFF" size={19} strokeWidth={2.4} />
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: 15, overflow: "hidden" },
  gradient: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "Manrope_700Bold",
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  icon: { position: "absolute", right: 18 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.65 },
});
