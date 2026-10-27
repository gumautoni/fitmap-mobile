import { ArrowRight, Dumbbell, MapPin, TrendingUp } from "lucide-react-native";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";

import type { AuthStackScreenProps } from "../navigation/types";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/themes";

type Props = AuthStackScreenProps<"BoasVindas">;

function MapIllustration({ height }: { height: number }) {
  return (
    <View
      accessible
      accessibilityLabel="Ilustração estilizada de um mapa com academias e equipamentos de treino"
    >
      <Svg width="100%" height={height} viewBox="0 0 360 290">
        <Defs>
          <LinearGradient id="mapSurface" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F5FAFF" />
            <Stop offset="100%" stopColor="#CFE2FF" />
          </LinearGradient>

          <LinearGradient id="building" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#A7C6F9" />
          </LinearGradient>

          <LinearGradient id="gymRoof" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#83B4FF" />
            <Stop offset="100%" stopColor="#3F51E8" />
          </LinearGradient>

          <LinearGradient id="equipment" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#9BC3FF" />
            <Stop offset="100%" stopColor="#5369E9" />
          </LinearGradient>
        </Defs>

        <Circle cx="306" cy="48" r="40" fill="#C9E0FF" opacity={0.36} />
        <Circle cx="52" cy="218" r="26" fill="#C2D8FF" opacity={0.4} />

        <Ellipse
          cx="182"
          cy="260"
          rx="148"
          ry="22"
          fill="#7294DD"
          opacity={0.14}
        />

        {/* Base do mapa em perspectiva */}
        <Polygon points="25,164 182,92 338,164 182,236" fill="#B7D0F7" />
        <Polygon points="25,164 182,236 182,248 25,176" fill="#89B2EF" />
        <Polygon points="182,236 338,164 338,176 182,248" fill="#749CDC" />
        <Polygon
          points="25,153 182,81 338,153 182,225"
          fill="url(#mapSurface)"
          stroke="#D2E3FF"
          strokeWidth="2"
        />

        {/* Ruas */}
        <Path
          d="M65 171 L221 99"
          stroke="#FFFFFF"
          strokeWidth="15"
          strokeLinecap="round"
          opacity={0.9}
        />
        <Path
          d="M119 108 L272 181"
          stroke="#FFFFFF"
          strokeWidth="14"
          strokeLinecap="round"
          opacity={0.85}
        />
        <Path
          d="M75 151 L194 207"
          stroke="#B9D5FB"
          strokeWidth="2"
          strokeDasharray="5 6"
        />

        {/* Prédio à esquerda */}
        <Polygon points="77,145 105,132 133,145 105,158" fill="#E9F3FF" />
        <Polygon points="77,145 105,158 105,190 77,177" fill="#9FC3F5" />
        <Polygon
          points="105,158 133,145 133,177 105,190"
          fill="url(#building)"
        />

        <Path
          d="M114 164 L124 159 M114 175 L124 170"
          stroke="#79A4E7"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Academia central */}
        <Polygon
          points="151,129 196,108 240,129 195,150"
          fill="url(#gymRoof)"
        />
        <Polygon points="151,129 195,150 195,193 151,172" fill="#718EEB" />
        <Polygon points="195,150 240,129 240,172 195,193" fill="#A5C4FF" />

        <Polygon
          points="163,151 184,161 184,179 163,169"
          fill="#E6F1FF"
          opacity={0.95}
        />
        <Polygon points="205,159 228,148 228,170 205,181" fill="#DDEAFF" />

        <Path
          d="M173 124 L194 114 L216 124"
          stroke="#DCE9FF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Prédio secundário */}
        <Polygon points="253,152 274,143 294,152 273,162" fill="#F0F6FF" />
        <Polygon points="253,152 273,162 273,187 253,177" fill="#A7C5F6" />
        <Polygon points="273,162 294,152 294,177 273,187" fill="#D0E2FF" />

        {/* Rota ilustrativa */}
        <Path
          d="M87 201 C120 219 148 213 172 199 C198 184 225 196 259 183"
          stroke="#3F51E8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="7 7"
          fill="none"
          opacity={0.75}
        />

        {/* Pino principal */}
        <Path
          d="M196 62 C181 62 171 73 171 86 C171 104 196 125 196 125 C196 125 221 104 221 86 C221 73 211 62 196 62 Z"
          fill="#3F51E8"
        />
        <Circle cx="196" cy="86" r="10" fill="#FFFFFF" />
        <Circle cx="196" cy="86" r="4" fill="#91BCFF" />

        {/* Pino secundário */}
        <Path
          d="M291 89 C281 89 274 96 274 106 C274 118 291 133 291 133 C291 133 308 118 308 106 C308 96 301 89 291 89 Z"
          fill="#7AA7F2"
        />
        <Circle cx="291" cy="106" r="6" fill="#FFFFFF" />

        {/* Halter tridimensional estilizado */}
        <G transform="translate(265 218) rotate(-18)">
          <Rect x="-38" y="-4" width="76" height="8" rx="4" fill="#4B62D6" />
          <Rect
            x="-38"
            y="-17"
            width="13"
            height="34"
            rx="5"
            fill="url(#equipment)"
          />
          <Rect x="-25" y="-12" width="9" height="24" rx="3" fill="#B7D2FF" />
          <Rect x="16" y="-12" width="9" height="24" rx="3" fill="#B7D2FF" />
          <Rect
            x="25"
            y="-17"
            width="13"
            height="34"
            rx="5"
            fill="url(#equipment)"
          />
        </G>
      </Svg>
    </View>
  );
}

export default function WelcomeScreen({ navigation }: Props) {
  const { theme, isDark } = useAppTheme();
  const { height } = useWindowDimensions();

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const illustrationHeight = Math.min(310, Math.max(218, height * 0.34));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.decorationTop} />
      <View pointerEvents="none" style={styles.decorationBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.mainContent}>
          {/* Wordmark provisório até integrar a nova logo oficial */}
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkFit}>Fit</Text>
            <Text style={styles.wordmarkMap}>Map</Text>
          </View>

          <Text style={styles.eyebrow}>SUA JORNADA COMEÇA AQUI</Text>

          <Text style={styles.title}>
            Encontre academias.{"\n"}
            Evolua do seu jeito.
          </Text>

          <Text style={styles.subtitle}>
            Descubra onde treinar, organize seus exercícios e acompanhe seu
            progresso em um só lugar.
          </Text>

          <View style={styles.illustration}>
            <MapIllustration height={illustrationHeight} />
          </View>

          <View style={styles.features}>
            <View style={styles.feature}>
              <MapPin size={16} color={theme.colors.primary} />
              <Text style={styles.featureText}>Academias</Text>
            </View>

            <View style={styles.feature}>
              <Dumbbell size={16} color={theme.colors.primary} />
              <Text style={styles.featureText}>Treinos</Text>
            </View>

            <View style={styles.feature}>
              <TrendingUp size={16} color={theme.colors.primary} />
              <Text style={styles.featureText}>Progresso</Text>
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
            <ArrowRight size={19} color="#FFFFFF" strokeWidth={2.3} />
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
            <Text style={styles.secondaryButtonText}>
              Já tenho conta — Entrar
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme, isDark: boolean) {
  const background = isDark ? "#0E1118" : "#F7F9FF";
  const decoration = isDark ? "#24305B" : "#E2EDFF";

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: background,
    },
    decorationTop: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: decoration,
      top: -115,
      right: -115,
      opacity: 0.8,
    },
    decorationBottom: {
      position: "absolute",
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: decoration,
      bottom: 150,
      left: -110,
      opacity: 0.7,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 24,
    },
    mainContent: {
      alignItems: "center",
    },
    wordmark: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 19,
    },
    wordmarkFit: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 27,
    },
    wordmarkMap: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 27,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 2,
      textAlign: "center",
      marginBottom: 13,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 27,
      lineHeight: 36,
      textAlign: "center",
      marginBottom: 12,
    },
    subtitle: {
      maxWidth: 325,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 13,
      lineHeight: 21,
      textAlign: "center",
    },
    illustration: {
      width: "100%",
      marginTop: 10,
      marginBottom: 2,
    },
    features: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    feature: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      flexShrink: 1,
    },
    featureText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: 11,
    },
    actions: {
      gap: 12,
    },
    primaryButton: {
      minHeight: 56,
      borderRadius: 17,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 12,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 15,
    },
    secondaryButton: {
      minHeight: 54,
      borderRadius: 17,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 14,
    },
    pressedButton: {
      opacity: 0.82,
      transform: [{ scale: 0.99 }],
    },
  });
}
