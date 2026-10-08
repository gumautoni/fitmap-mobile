import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  MapPin,
  Monitor,
  Moon,
  Navigation,
  Palette,
  Search,
  Sun,
} from "lucide-react-native";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthContext } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeProvider";

function AppearancePreferenceIcon({ preference, color }) {
  if (preference === "light") {
    return <Sun size={19} strokeWidth={2.2} color={color} />;
  }

  if (preference === "dark") {
    return <Moon size={19} strokeWidth={2.2} color={color} />;
  }

  return <Monitor size={19} strokeWidth={2.2} color={color} />;
}

export default function HomeScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const { theme, preference, setPreference } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [floatValue] = useState(() => new Animated.Value(0));

  const [pulseValue] = useState(() => new Animated.Value(0));

  const firstName = user?.name?.trim()?.split(" ")[0] || "usuário";

  useEffect(() => {
    let active = true;
    let floatAnimation;
    let pulseAnimation;

    async function startAnimations() {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();

      if (!active || reduceMotion) {
        return;
      }

      floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatValue, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatValue, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      floatAnimation.start();
      pulseAnimation.start();
    }

    void startAnimations();

    return () => {
      active = false;
      floatAnimation?.stop();
      pulseAnimation?.stop();
    };
  }, [floatValue, pulseValue]);

  const floatingTransform = {
    transform: [
      {
        translateY: floatValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -7],
        }),
      },
    ],
  };

  const pulseStyle = {
    opacity: pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.38, 0],
    }),
    transform: [
      {
        scale: pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1.24],
        }),
      },
    ],
  };

  function openAppearanceSelector() {
    Alert.alert("Aparência", "Escolha como o FitMap deve aparecer.", [
      {
        text: "Claro",
        onPress: () => {
          void setPreference("light");
        },
      },
      {
        text: "Escuro",
        onPress: () => {
          void setPreference("dark");
        },
      },
      {
        text: "Seguir sistema",
        onPress: () => {
          void setPreference("system");
        },
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkFit}>Fit</Text>

            <Text style={styles.wordmarkMap}>Map</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar aparência"
            onPress={openAppearanceSelector}
            style={({ pressed }) => [
              styles.appearanceButton,
              pressed && styles.appearanceButtonPressed,
            ]}
          >
            <AppearancePreferenceIcon
              preference={preference}
              color={theme.colors.textSecondary}
            />

            <Palette
              size={12}
              strokeWidth={2.2}
              color={theme.colors.primary}
              style={styles.paletteBadge}
            />
          </Pressable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>Olá, {firstName}</Text>

          <Text style={styles.greetingSubtitle}>
            Onde vai ser o treino de hoje?
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explorar academias"
          onPress={() => navigation.navigate("Mapa")}
          style={({ pressed }) => [
            styles.heroPressable,
            pressed && styles.heroPressed,
          ]}
        >
          <LinearGradient
            colors={[theme.colors.heroStart, theme.colors.heroEnd]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View pointerEvents="none" style={styles.techBackground}>
              <View style={styles.mapLineOne} />
              <View style={styles.mapLineTwo} />
              <View style={styles.mapLineThree} />

              <View style={styles.mapNodeOne} />
              <View style={styles.mapNodeTwo} />
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrow}>
                <View style={styles.heroEyebrowDot} />

                <Text style={styles.heroEyebrowText}>EXPLORE</Text>
              </View>

              <Text style={styles.heroTitle}>Encontre uma academia</Text>

              <Text style={styles.heroDescription}>
                Descubra opções perto de você ou pesquise uma região.
              </Text>

              <View style={styles.heroAction}>
                <Text style={styles.heroActionText}>Explorar academias</Text>

                <ArrowRight
                  size={18}
                  strokeWidth={2.4}
                  color={theme.colors.primaryPressed}
                />
              </View>
            </View>

            <View pointerEvents="none" style={styles.radarArea}>
              <View style={styles.radarRingOuter} />
              <View style={styles.radarRingMiddle} />

              <Animated.View style={[styles.radarPulse, pulseStyle]} />

              <Animated.View
                style={[styles.pinFloatContainer, floatingTransform]}
              >
                <View style={styles.pinGlow} />

                <LinearGradient
                  colors={["#FFFFFF", "#E7EAFF"]}
                  style={styles.pinShell}
                >
                  <View style={styles.pinInner}>
                    <MapPin
                      size={31}
                      strokeWidth={2.5}
                      color={theme.colors.primary}
                    />
                  </View>
                </LinearGradient>

                <View style={styles.pinShadow} />
              </Animated.View>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>DESCUBRA</Text>

            <Text style={styles.sectionTitle}>Academias</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("Mapa")}
            style={({ pressed }) => [
              styles.textAction,
              pressed && styles.textActionPressed,
            ]}
          >
            <Text style={styles.textActionLabel}>Ver mapa</Text>

            <ArrowRight
              size={16}
              strokeWidth={2.3}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Mapa")}
          style={({ pressed }) => [
            styles.discoveryCard,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.discoveryMain}>
            <View style={styles.discoveryIcon}>
              <Search
                size={22}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.discoveryCopy}>
              <Text style={styles.discoveryTitle}>Pesquise do seu jeito</Text>

              <Text style={styles.discoveryText}>
                Cidade, bairro, região ou sua localização atual.
              </Text>
            </View>
          </View>

          <View style={styles.discoveryFooter}>
            <View style={styles.capability}>
              <Navigation
                size={14}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />

              <Text style={styles.capabilityText}>Localização</Text>
            </View>

            <View style={styles.capability}>
              <MapPin
                size={14}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />

              <Text style={styles.capabilityText}>Mapa</Text>
            </View>

            <View style={styles.openButton}>
              <ArrowRight
                size={18}
                strokeWidth={2.4}
                color={theme.colors.textOnPrimary}
              />
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing["4xl"],
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing["2xl"],
    },

    wordmark: {
      flexDirection: "row",
      alignItems: "center",
    },

    wordmarkFit: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 25,
      letterSpacing: -1,
    },

    wordmarkMap: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 25,
      letterSpacing: -1,
    },

    appearanceButton: {
      width: 43,
      height: 43,
      borderRadius: 15,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    appearanceButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },

    paletteBadge: {
      position: "absolute",
      right: 5,
      bottom: 5,
    },

    greetingBlock: {
      marginBottom: theme.spacing.xl,
    },

    greeting: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.screenTitle,
      lineHeight: theme.typography.lineHeight.screenTitle,
      letterSpacing: -0.7,
    },

    greetingSubtitle: {
      marginTop: 3,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },

    heroPressable: {
      borderRadius: theme.radii.xl,
      marginBottom: theme.spacing["3xl"],
    },

    heroPressed: {
      transform: [{ scale: 0.992 }],
      opacity: 0.97,
    },

    hero: {
      minHeight: 270,
      borderRadius: theme.radii.xl,
      padding: theme.spacing["2xl"],
      overflow: "hidden",
      justifyContent: "center",
    },

    techBackground: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.75,
    },

    mapLineOne: {
      position: "absolute",
      width: 230,
      height: 1,
      right: -45,
      top: 61,
      backgroundColor: theme.colors.heroDetail,
      transform: [{ rotate: "-32deg" }],
    },

    mapLineTwo: {
      position: "absolute",
      width: 210,
      height: 1,
      right: -13,
      top: 136,
      backgroundColor: theme.colors.heroDetail,
      transform: [{ rotate: "20deg" }],
    },

    mapLineThree: {
      position: "absolute",
      width: 150,
      height: 1,
      right: 2,
      bottom: 52,
      backgroundColor: theme.colors.heroDetail,
      transform: [{ rotate: "-18deg" }],
    },

    mapNodeOne: {
      position: "absolute",
      width: 7,
      height: 7,
      borderRadius: 4,
      right: 48,
      top: 62,
      backgroundColor: theme.colors.techAccent,
      opacity: 0.45,
    },

    mapNodeTwo: {
      position: "absolute",
      width: 5,
      height: 5,
      borderRadius: 3,
      right: 118,
      bottom: 52,
      backgroundColor: theme.colors.heroText,
      opacity: 0.25,
    },

    heroCopy: {
      width: "62%",
      zIndex: 3,
    },

    heroEyebrow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: theme.spacing.md,
    },

    heroEyebrowDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.techAccent,
    },

    heroEyebrowText: {
      color: theme.colors.heroTextMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
      letterSpacing: 1.6,
    },

    heroTitle: {
      color: theme.colors.heroText,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 27,
      lineHeight: 32,
      letterSpacing: -0.8,
      marginBottom: theme.spacing.sm,
    },

    heroDescription: {
      color: theme.colors.heroTextMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      marginBottom: theme.spacing.xl,
    },

    heroAction: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: "#FFFFFF",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 12,
      borderRadius: theme.radii.md,
      shadowColor: "#0B1027",
      shadowOpacity: 0.13,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 7,
      },
      elevation: 4,
    },

    heroActionText: {
      color: theme.colors.primaryPressed,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    radarArea: {
      position: "absolute",
      width: 145,
      height: 145,
      right: -2,
      top: 42,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },

    radarRingOuter: {
      position: "absolute",
      width: 138,
      height: 138,
      borderRadius: 69,
      borderWidth: 1,
      borderColor: theme.colors.heroDetail,
    },

    radarRingMiddle: {
      position: "absolute",
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1,
      borderColor: theme.colors.heroDetail,
    },

    radarPulse: {
      position: "absolute",
      width: 115,
      height: 115,
      borderRadius: 58,
      backgroundColor: theme.colors.techAccent,
    },

    pinFloatContainer: {
      width: 78,
      height: 90,
      alignItems: "center",
      justifyContent: "center",
    },

    pinGlow: {
      position: "absolute",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.techAccent,
      opacity: 0.12,
      transform: [{ scale: 1.25 }],
    },

    pinShell: {
      width: 65,
      height: 65,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "8deg" }],
      shadowColor: "#080B18",
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: {
        width: 0,
        height: 10,
      },
      elevation: 8,
    },

    pinInner: {
      width: 51,
      height: 51,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.86)",
    },

    pinShadow: {
      width: 38,
      height: 9,
      borderRadius: 20,
      backgroundColor: "rgba(5, 8, 22, 0.20)",
      marginTop: 8,
      transform: [{ scaleX: 1.15 }],
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: theme.spacing.lg,
    },

    sectionEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.7,
      marginBottom: 2,
    },

    sectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      letterSpacing: -0.4,
    },

    textAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 7,
    },

    textActionPressed: {
      opacity: 0.6,
    },

    textActionLabel: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    discoveryCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      shadowColor: "#0A0D15",
      shadowOpacity: theme.mode === "dark" ? 0.2 : 0.045,
      shadowRadius: 15,
      shadowOffset: {
        width: 0,
        height: 7,
      },
      elevation: 2,
    },

    cardPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.995 }],
    },

    discoveryMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },

    discoveryIcon: {
      width: 50,
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    discoveryCopy: {
      flex: 1,
    },

    discoveryTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
      marginBottom: 3,
    },

    discoveryText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    discoveryFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },

    capability: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radii.full,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    capabilityText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    openButton: {
      marginLeft: "auto",
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
