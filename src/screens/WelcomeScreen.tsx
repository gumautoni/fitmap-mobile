import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Dumbbell, MapPin, TrendingUp } from "lucide-react-native";
import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AuthStackScreenProps } from "../navigation/types";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/themes";

type Props = AuthStackScreenProps<"BoasVindas">;

const BRAND_BLUE = "#3F51E8";
const BACKGROUND = "#F7F9FF";

export default function WelcomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const artworkHeight = Math.min(360, Math.max(260, height * 0.4));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View pointerEvents="none" style={styles.decorationTop} />
      <View pointerEvents="none" style={styles.decorationBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          <View style={styles.wordmark} accessibilityLabel="FitMap">
            <Image
              source={require("../../assets/images/fitmap-logo-symbol.png")}
              style={styles.wordmarkSymbol}
              resizeMode="contain"
              accessible={false}
            />
            <Text style={styles.wordmarkFit}>Fit</Text>
            <Text style={styles.wordmarkMap}>Map</Text>
          </View>

          <Text style={styles.eyebrow}>SAÚDE • TREINO • EVOLUÇÃO</Text>

          <Text style={styles.title}>
            Encontre academias{"\n"}
            <Text style={styles.titleAccent}>perto de você</Text>
          </Text>

          <Text style={styles.subtitle}>
            Organize seus treinos, acompanhe sua evolução e viva uma vida mais
            saudável.
          </Text>

          <View style={[styles.hero, { height: artworkHeight }]}>
            <View style={styles.imageFrame}>
              <Image
                source={require("../../assets/images/welcome-map-3d.png")}
                style={styles.heroImage}
                resizeMode="cover"
                accessible={false}
              />

              <LinearGradient
                pointerEvents="none"
                colors={[BACKGROUND, "rgba(247,249,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.imageFade}
              />
            </View>

            <View style={styles.features}>
              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <MapPin size={21} color={BRAND_BLUE} strokeWidth={2.2} />
                </View>
                <Text style={styles.featureTitle}>Descubra</Text>
                <Text style={styles.featureText}>academias na sua região</Text>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Dumbbell size={21} color={BRAND_BLUE} strokeWidth={2.2} />
                </View>
                <Text style={styles.featureTitle}>Organize</Text>
                <Text style={styles.featureText}>seus treinos e rotinas</Text>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <TrendingUp size={21} color={BRAND_BLUE} strokeWidth={2.2} />
                </View>
                <Text style={styles.featureTitle}>Acompanhe</Text>
                <Text style={styles.featureText}>sua evolução</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Criar conta no FitMap"
            onPress={() => navigation.navigate("Cadastro")}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>Criar conta</Text>
            <ArrowRight color="#FFFFFF" size={20} strokeWidth={2.3} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar na minha conta"
            onPress={() => navigation.navigate("Login")}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Entrar</Text>
            <ArrowRight color={BRAND_BLUE} size={20} strokeWidth={2.3} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: BACKGROUND,
    },
    decorationTop: {
      position: "absolute",
      top: -120,
      right: -130,
      width: 290,
      height: 290,
      borderRadius: 145,
      backgroundColor: "#ECF3FF",
    },
    decorationBottom: {
      position: "absolute",
      bottom: 90,
      left: -115,
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: "#EFF5FF",
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "space-between",
      paddingTop: 14,
      paddingBottom: 18,
      paddingHorizontal: 22,
    },
    mainContent: {
      width: "100%",
    },
    wordmark: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    wordmarkSymbol: {
      width: 56,
      height: 56,
      marginRight: 2,
    },
    wordmarkFit: {
      color: "#13243C",
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 28,
    },
    wordmarkMap: {
      color: BRAND_BLUE,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 28,
    },
    eyebrow: {
      color: "#63789B",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.8,
      marginBottom: 24,
    },
    title: {
      color: "#13243C",
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 31,
      lineHeight: 39,
      marginBottom: 12,
    },
    titleAccent: {
      color: BRAND_BLUE,
    },
    subtitle: {
      maxWidth: 305,
      color: "#65758F",
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 14,
      lineHeight: 22,
    },
    hero: {
      position: "relative",
      width: "100%",
      marginTop: 12,
      marginBottom: 18,
      justifyContent: "center",
    },
    imageFrame: {
      position: "absolute",
      right: -8,
      top: 0,
      height: "100%",
      width: "75%",
      overflow: "hidden",
      borderRadius: 22,
      backgroundColor: "#E3EEFF",
    },
    heroImage: {
      width: "100%",
      height: "100%",
    },
    imageFade: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "70%",
    },
    features: {
      zIndex: 1,
      width: "51%",
      justifyContent: "space-around",
      height: "100%",
      paddingVertical: 15,
    },
    feature: {
      gap: 4,
      maxWidth: 135,
    },
    featureIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#E8F0FF",
      marginBottom: 3,
    },
    featureTitle: {
      color: "#162847",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 13,
    },
    featureText: {
      color: "#6F7F96",
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 11,
      lineHeight: 16,
    },
    actions: {
      width: "100%",
      gap: 12,
      paddingTop: 8,
    },
    primaryButton: {
      minHeight: 58,
      borderRadius: 17,
      backgroundColor: BRAND_BLUE,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 15,
    },
    secondaryButton: {
      minHeight: 58,
      borderRadius: 17,
      borderWidth: 1.5,
      borderColor: "#B4C4E1",
      backgroundColor: "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
    },
    secondaryButtonText: {
      color: "#172844",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 15,
    },
    pressedButton: {
      opacity: 0.8,
      transform: [{ scale: 0.99 }],
    },
  });
}
