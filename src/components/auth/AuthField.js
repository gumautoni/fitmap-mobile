import { lightColors as authColors } from "../../theme/themes";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const PRIMARY = authColors.primary;

export default function AuthField({
  label,
  placeholder,
  icon: Icon,
  value,
  onChangeText,
  secure = false,
  error,
  helper,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          Boolean(error) && styles.fieldError,
        ]}
      >
        {Icon ? (
          <Icon
            size={18}
            color={focused ? PRIMARY : authColors.icon}
            strokeWidth={2}
          />
        ) : null}

        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#6B625A"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure && !revealed}
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel={label}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ocultar senha" : "Mostrar senha"}
            accessibilityState={{ expanded: revealed }}
            hitSlop={9}
            style={styles.eyeButton}
          >
            {revealed ? (
              <EyeOff size={19} color={authColors.icon} />
            ) : (
              <Eye size={19} color={authColors.icon} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 15 },
  label: {
    fontFamily: "Manrope_700Bold",
    color: authColors.textPrimary,
    fontSize: 12,
    marginBottom: 7,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 53,
    paddingHorizontal: 14,
    borderWidth: 1.3,
    borderColor: "#8B8178",
    borderRadius: 14,
    backgroundColor: authColors.surface,
    gap: 10,
  },
  fieldFocused: {
    borderColor: PRIMARY,
    backgroundColor: "#FFFFFF",
  },
  fieldError: { borderColor: "#D92D20" },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    fontSize: 14,
    fontFamily: "Manrope_500Medium",
    color: authColors.textPrimary,
    padding: 0,
  },
  eyeButton: { padding: 4, marginRight: -4 },
  errorText: {
    fontFamily: "Manrope_500Medium",
    color: "#C42C27",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  helperText: {
    fontFamily: "Manrope_500Medium",
    color: authColors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
});
