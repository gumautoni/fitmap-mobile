import MotionPressable from "../components/MotionPressable";
import { useReducedMotion } from "../hooks/useReducedMotion";
import MotionScrollView from "../components/MotionScrollView";
import { lightSurfaceDepth } from "../theme/surfaces";
import ScreenGradient from "../components/ScreenGradient";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Dumbbell, TrendingUp, Zap } from "lucide-react-native";
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FitMapBrand from "../components/FitMapBrand";
import FitMapLocationGymPin3D from "../components/FitMapLocationGymPin3D";
import WorkoutActivityCalendar from "../components/WorkoutActivityCalendar";
import { AuthContext } from "../context/AuthContext";
import { getWorkouts } from "../services/training";
import { getActiveWorkoutSession } from "../services/trainingSessions";
import { useAppTheme } from "../theme/ThemeProvider";
import { brandColors } from "../theme/tokens";

function getInitials(name) {
  const parts = name?.trim()?.split(/\s+/)?.filter(Boolean);

  if (!parts?.length) {
    return "FM";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function HomeScreen({ navigation }) {
  const auth = useContext(AuthContext);

  const user = auth?.user ?? null;
  const runAuthenticatedRequest = auth?.runAuthenticatedRequest;

  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [floatValue] = useState(() => new Animated.Value(0));
  const [pulseValue] = useState(() => new Animated.Value(0));

  const firstName = user?.name?.trim()?.split(" ")[0] || "usuário";
  const initials = getInitials(user?.name);

  const [workoutOverview, setWorkoutOverview] = useState({
    status: "loading",
    session: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setWorkoutOverview({ status: "loading", session: null });

      async function loadWorkoutOverview() {
        if (!runAuthenticatedRequest) {
          if (active) {
            setWorkoutOverview({ status: "error", session: null });
          }
          return;
        }

        try {
          const session = await runAuthenticatedRequest((accessToken) =>
            getActiveWorkoutSession(accessToken),
          );

          if (!active) return;

          if (session) {
            setWorkoutOverview({ status: "active", session });
            return;
          }

          const workouts = await runAuthenticatedRequest((accessToken) =>
            getWorkouts(accessToken),
          );

          if (active) {
            setWorkoutOverview({
              status: workouts.length > 0 ? "available" : "empty",
              session: null,
            });
          }
        } catch {
          if (active) {
            setWorkoutOverview({ status: "error", session: null });
          }
        }
      }

      void loadWorkoutOverview();

      return () => {
        active = false;
      };
    }, [runAuthenticatedRequest]),
  );

  let trainingTitle = "Meus treinos";
  let trainingDescription = "Carregando seus treinos...";
  let trainingAction = "Ver meus treinos";

  switch (workoutOverview.status) {
    case "active":
      trainingTitle = "Treino em andamento";
      trainingDescription = `Continue "${workoutOverview.session.workoutName}" de onde parou.`;
      trainingAction = "Continuar treino";
      break;
    case "available":
      trainingTitle = "Seu proximo treino";
      trainingDescription =
        "Seus treinos estao prontos. Escolha um para comecar.";
      trainingAction = "Escolher treino";
      break;
    case "empty":
      trainingTitle = "Seu primeiro treino";
      trainingDescription =
        "Crie um treino para organizar exercicios e acompanhar sua evolucao.";
      trainingAction = "Criar primeiro treino";
      break;
    case "error":
      trainingDescription =
        "Nao foi possivel consultar os treinos agora. Acesse sua lista para tentar novamente.";
      break;
    default:
      break;
  }

  function openTrainingAction() {
    if (workoutOverview.status === "active") {
      navigation.navigate("ExecutarTreino", {
        workoutId: workoutOverview.session.sourceWorkoutId ?? undefined,
      });
      return;
    }

    navigation.navigate(
      workoutOverview.status === "empty" ? "NovoTreino" : "Treinos",
    );
  }

  useFocusEffect(
    useCallback(() => {
      floatValue.setValue(0);
      pulseValue.setValue(0);

      if (reduceMotion) {
        return;
      }

      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatValue, {
            toValue: 1,
            duration: 1900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(floatValue, {
            toValue: 0,
            duration: 1900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
      );

      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1750,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(pulseValue, {
            toValue: 0,
            duration: 450,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
      );

      floatAnimation.start();
      pulseAnimation.start();

      return () => {
        floatAnimation.stop();
        pulseAnimation.stop();
        floatValue.setValue(0);
        pulseValue.setValue(0);
      };
    }, [floatValue, pulseValue, reduceMotion]),
  );

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

  const activeTrainingPulseStyle = {
    opacity: pulseValue.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [0, 0.75, 0],
    }),
    transform: [
      {
        scale: pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.65, 1.35],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenGradient theme={theme} />
      <MotionScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <FitMapBrand variant="wordmark" mode={theme.mode} width={112} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir meu perfil"
            onPress={() => navigation.navigate("Perfil")}
            style={({ pressed }) => [
              styles.profileButton,
              pressed && styles.profileButtonPressed,
            ]}
          >
            <Text style={styles.profileButtonText}>{initials}</Text>
          </Pressable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>Olá, {firstName}</Text>

          <Text style={styles.greetingSubtitle}>
            Onde vai ser o treino de hoje?
          </Text>
        </View>

        <MotionPressable
          reduceMotion={reduceMotion}
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
                Busque por cidade ou bairro, ou use sua localização para
                explorar academias no mapa.
              </Text>

              <View style={styles.heroAction}>
                <Text style={styles.heroActionText}>Explorar academias</Text>

                <ArrowRight
                  size={18}
                  strokeWidth={2.4}
                  color={theme.colors.heroActionText}
                />
              </View>
            </View>

            <View pointerEvents="none" style={styles.performanceVisual}>
              <Animated.View style={[styles.performancePulse, pulseStyle]} />

              <Animated.View style={floatingTransform}>
                <FitMapLocationGymPin3D
                  size={154}
                  primary={brandColors.orange}
                  primaryDark={brandColors.orangeInk}
                  accent={theme.colors.techAccent}
                />
              </Animated.View>
            </View>
          </LinearGradient>
        </MotionPressable>

        <WorkoutActivityCalendar
          onOpenWorkout={(workoutSessionId) =>
            navigation.navigate("DetalhesHistoricoTreino", {
              workoutSessionId,
            })
          }
        />
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>ORGANIZE</Text>

            <Text style={styles.sectionTitle}>Seu treino</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir meus treinos"
            onPress={() => navigation.navigate("Treinos")}
            style={({ pressed }) => [
              styles.textAction,
              pressed && styles.textActionPressed,
            ]}
          >
            <Text style={styles.textActionLabel}>Ver treinos</Text>

            <ArrowRight
              size={16}
              strokeWidth={2.3}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>

        <MotionPressable
          reduceMotion={reduceMotion}
          accessibilityRole="button"
          accessibilityLabel={trainingAction}
          onPress={openTrainingAction}
          style={({ pressed }) => [
            styles.trainingCard,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.trainingAccent} />

          <View style={styles.trainingMain}>
            <View style={styles.trainingIcon}>
              <Dumbbell
                size={25}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.trainingCopy}>
              <Text style={styles.trainingTitle}>{trainingTitle}</Text>

              <Text style={styles.trainingText}>{trainingDescription}</Text>
            </View>
          </View>

          <View style={styles.trainingFooter}>
            <View style={styles.trainingStatus}>
              {(workoutOverview.status === "active" ||
                workoutOverview.status === "available") && (
                <View style={styles.trainingStatusIndicator}>
                  {workoutOverview.status === "active" && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.trainingStatusHalo,
                        activeTrainingPulseStyle,
                      ]}
                    />
                  )}
                  <View style={styles.trainingStatusDot} />
                </View>
              )}

              <Text style={styles.trainingStatusText}>{trainingAction}</Text>
            </View>

            <View style={styles.openButton}>
              <ArrowRight
                size={18}
                strokeWidth={2.4}
                color={theme.colors.textOnPrimary}
              />
            </View>
          </View>
        </MotionPressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>EVOLUÇÃO</Text>

            <Text style={styles.sectionTitle}>Acompanhe seu progresso</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir meu progresso"
            onPress={() => navigation.navigate("Progresso")}
            style={({ pressed }) => [
              styles.textAction,
              pressed && styles.textActionPressed,
            ]}
          >
            <Text style={styles.textActionLabel}>Ver progresso</Text>

            <ArrowRight
              size={16}
              strokeWidth={2.3}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>

        <MotionPressable
          reduceMotion={reduceMotion}
          accessibilityRole="button"
          accessibilityLabel="Abrir meu progresso"
          onPress={() => navigation.navigate("Progresso")}
          style={({ pressed }) => [
            styles.progressCard,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.progressAccent} />

          <View style={styles.progressMain}>
            <View style={styles.progressIcon}>
              <TrendingUp
                size={25}
                strokeWidth={2.2}
                color={theme.colors.techAccent}
              />
            </View>

            <View style={styles.progressCopy}>
              <Text style={styles.progressTitle}>Meu progresso</Text>

              <Text style={styles.progressText}>
                Consulte sua frequência de treino e a evolução registrada nos
                exercícios concluídos.
              </Text>
            </View>
          </View>

          <View style={styles.progressFooter}>
            <View style={styles.progressCapability}>
              <TrendingUp
                size={14}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />

              <Text style={styles.progressCapabilityText}>Desempenho</Text>
            </View>

            <View style={styles.progressCapability}>
              <Dumbbell
                size={14}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />

              <Text style={styles.progressCapabilityText}>Histórico real</Text>
            </View>

            <View style={styles.openButton}>
              <ArrowRight
                size={18}
                strokeWidth={2.4}
                color={theme.colors.textOnPrimary}
              />
            </View>
          </View>
        </MotionPressable>
      </MotionScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  const homeBackground = theme.colors.background;
  const homeSurface = theme.colors.surface;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: homeBackground,
    },

    container: {
      flex: 1,
      backgroundColor: theme.mode === "light" ? "transparent" : homeBackground,
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

    profileButton: {
      width: 43,
      height: 43,
      borderRadius: 15,
      backgroundColor: theme.colors.primary,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#0A0D15",
      shadowOpacity: theme.mode === "dark" ? 0.2 : 0.08,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 2,
    },

    profileButtonPressed: {
      opacity: 0.76,
      transform: [
        {
          scale: 0.96,
        },
      ],
    },

    profileButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 14,
      letterSpacing: 0.2,
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
      ...lightSurfaceDepth(theme, "hero"),
    },

    heroPressed: {
      opacity: 0.94,
    },

    hero: {
      minHeight: 306,
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
      color: theme.colors.heroActionText,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    performanceVisual: {
      position: "absolute",
      width: 158,
      height: 190,
      right: -10,
      top: 68,
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

    trainingCard: {
      position: "relative",
      overflow: "hidden",
      marginBottom: theme.spacing["3xl"],
      backgroundColor: homeSurface,
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
      ...lightSurfaceDepth(theme, "featured"),
      ...(theme.mode === "light" ? { overflow: "visible" } : {}),
    },

    trainingAccent: {
      position: "absolute",
      left: 0,
      top: 18,
      bottom: 18,
      width: 3,
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: theme.colors.primary,
    },

    trainingMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },

    trainingIcon: {
      width: 54,
      height: 54,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: theme.colors.primarySoft,
    },

    trainingCopy: {
      flex: 1,
    },

    trainingTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
      marginBottom: 4,
    },

    trainingText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    trainingFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    trainingStatus: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    trainingStatusIndicator: {
      width: 10,
      height: 10,
      alignItems: "center",
      justifyContent: "center",
    },

    trainingStatusHalo: {
      position: "absolute",
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.success,
    },

    trainingStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
    },

    trainingStatusText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    progressCard: {
      position: "relative",
      overflow: "hidden",
      marginBottom: theme.spacing["3xl"],
      backgroundColor: homeSurface,
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
      ...lightSurfaceDepth(theme, "featured"),
      ...(theme.mode === "light" ? { overflow: "visible" } : {}),
    },

    progressAccent: {
      position: "absolute",
      left: 0,
      top: 18,
      bottom: 18,
      width: 3,
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: theme.colors.techAccent,
    },

    progressMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },

    progressIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor:
        theme.mode === "light" ? brandColors.turquoiseSoft : "#16352F",
      alignItems: "center",
      justifyContent: "center",
    },

    progressCopy: {
      flex: 1,
    },

    progressTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
      marginBottom: 4,
    },

    progressText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    progressFooter: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },

    progressCapability: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.radii.full,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    progressCapabilityText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    discoveryCard: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: homeSurface,
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
      opacity: 0.94,
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
