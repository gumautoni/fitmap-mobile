import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Dumbbell,
  MapPin,
  Monitor,
  Moon,
  Navigation,
  Palette,
  Search,
  Sun,
  Zap,
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

import FitMapPerformanceMark from "../components/FitMapPerformanceMark";
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
            duration: 1900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),

          Animated.timing(floatValue, {
            toValue: 0,
            duration: 1900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1750,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),

          Animated.timing(pulseValue, {
            toValue: 0,
            duration: 450,
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
          outputRange: [0, -8],
        }),
      },
      {
        rotate: floatValue.interpolate({
          inputRange: [0, 1],
          outputRange: ["-1deg", "1deg"],
        }),
      },
    ],
  };

  const pulseStyle = {
    opacity: pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.22, 0],
    }),

    transform: [
      {
        scale: pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.74, 1.22],
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
            start={{
              x: 0,
              y: 0,
            }}
            end={{
              x: 1,
              y: 1,
            }}
            style={styles.hero}
          >
            <View pointerEvents="none" style={styles.heroBackground}>
              <View style={styles.performanceLineOne} />
              <View style={styles.performanceLineTwo} />
              <View style={styles.performanceLineThree} />

              <View style={styles.performanceNodeOne} />
              <View style={styles.performanceNodeTwo} />
              <View style={styles.performanceNodeThree} />
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrow}>
                <Zap
                  size={13}
                  strokeWidth={2.4}
                  color={theme.colors.techAccent}
                />

                <Text style={styles.heroEyebrowText}>
                  SEU TREINO COMEÇA AQUI
                </Text>
              </View>

              <Text style={styles.heroTitle}>Encontre onde treinar</Text>

              <Text style={styles.heroDescription}>
                Descubra academias próximas ou pesquise uma região para começar.
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

            <View pointerEvents="none" style={styles.performanceVisual}>
              <Animated.View style={[styles.performancePulse, pulseStyle]} />

              <Animated.View style={floatingTransform}>
                <FitMapPerformanceMark
                  size={142}
                  primary={theme.colors.primary}
                  primaryDark={theme.colors.primaryPressed}
                  accent={theme.colors.techAccent}
                />
              </Animated.View>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>DESCUBRA</Text>

            <Text style={styles.sectionTitle}>Escolha onde treinar</Text>
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
          <View style={styles.discoveryAccent} />

          <View style={styles.discoveryMain}>
            <View style={styles.discoveryIcon}>
              <Dumbbell
                size={25}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.discoveryCopy}>
              <Text style={styles.discoveryTitle}>
                Seu próximo espaço de treino
              </Text>

              <Text style={styles.discoveryText}>
                Busque por cidade, bairro ou região ou encontre opções usando
                sua localização.
              </Text>
            </View>
          </View>

          <View style={styles.discoveryFooter}>
            <View style={styles.capability}>
              <Search
                size={14}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />

              <Text style={styles.capabilityText}>Busca</Text>
            </View>

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
      transform: [
        {
          scale: 0.97,
        },
      ],
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
      opacity: 0.97,
      transform: [
        {
          scale: 0.992,
        },
      ],
    },

    hero: {
      minHeight: 286,
      borderRadius: theme.radii.xl,
      padding: theme.spacing["2xl"],
      overflow: "hidden",
      justifyContent: "center",
    },

    heroBackground: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },

    performanceLineOne: {
      position: "absolute",
      width: 245,
      height: 1,
      right: -60,
      top: 51,
      backgroundColor: theme.colors.heroDetail,
      transform: [
        {
          rotate: "-29deg",
        },
      ],
    },

    performanceLineTwo: {
      position: "absolute",
      width: 230,
      height: 1,
      right: -35,
      top: 144,
      backgroundColor: theme.colors.heroDetail,
      transform: [
        {
          rotate: "18deg",
        },
      ],
    },

    performanceLineThree: {
      position: "absolute",
      width: 170,
      height: 1,
      right: 4,
      bottom: 51,
      backgroundColor: theme.colors.heroDetail,
      transform: [
        {
          rotate: "-15deg",
        },
      ],
    },

    performanceNodeOne: {
      position: "absolute",
      width: 7,
      height: 7,
      borderRadius: 4,
      right: 45,
      top: 61,
      backgroundColor: theme.colors.techAccent,
      opacity: 0.55,
    },

    performanceNodeTwo: {
      position: "absolute",
      width: 5,
      height: 5,
      borderRadius: 3,
      right: 110,
      bottom: 50,
      backgroundColor: theme.colors.heroText,
      opacity: 0.28,
    },

    performanceNodeThree: {
      position: "absolute",
      width: 4,
      height: 4,
      borderRadius: 2,
      right: 22,
      bottom: 98,
      backgroundColor: theme.colors.performanceAccent,
      opacity: 0.66,
    },

    heroCopy: {
      width: "61%",
      zIndex: 3,
    },

    heroEyebrow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: theme.spacing.md,
    },

    heroEyebrowText: {
      color: theme.colors.heroTextMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.15,
    },

    heroTitle: {
      color: theme.colors.heroText,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 29,
      lineHeight: 34,
      letterSpacing: -0.9,
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
      shadowOpacity: 0.15,
      shadowRadius: 14,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 4,
    },

    heroActionText: {
      color: theme.colors.primaryPressed,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    performanceVisual: {
      position: "absolute",
      width: 150,
      height: 170,
      right: -5,
      top: 42,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },

    performancePulse: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.techAccent,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: theme.spacing.md,
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
      maxWidth: 220,
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
      position: "relative",
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      shadowColor: "#0A0D15",
      shadowOpacity: theme.mode === "dark" ? 0.2 : 0.05,
      shadowRadius: 16,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 2,
    },

    discoveryAccent: {
      position: "absolute",
      left: 0,
      top: 18,
      bottom: 18,
      width: 3,
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: theme.colors.primary,
    },

    cardPressed: {
      opacity: 0.83,
      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    discoveryMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },

    discoveryIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
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
      marginBottom: 4,
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
      flexWrap: "wrap",
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
      width: 39,
      height: 39,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
