import { LinearGradient } from "expo-linear-gradient";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  ExternalLink,
  Globe2,
  Images,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import { getGymDetails, type GymDetails } from "../services/gyms";
import { useAppTheme } from "../theme/ThemeProvider";

type Props = AppStackScreenProps<"DetalhesAcademia">;

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1).replace(".", ",")} km`;
}

function getDetailsErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "gym_not_found") {
      return "Os detalhes desta academia não estão disponíveis.";
    }

    if (error.code === "gym_provider_unavailable") {
      return "O serviço de academias está indisponível no momento. Tente novamente em instantes.";
    }

    return "Não foi possível carregar os detalhes da academia.";
  }

  if (error instanceof Error && error.message === "The request timed out.") {
    return "A busca pelos detalhes demorou mais do que o esperado. Tente novamente.";
  }

  return "Não foi possível conectar ao backend do FitMap. Verifique a conexão e tente novamente.";
}

export default function GymDetailsScreen({ navigation, route }: Props) {
  const { gymId, distanceKm = null } = route.params;

  const { width: windowWidth } = useWindowDimensions();

  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const galleryWidth = Math.max(windowWidth - theme.spacing.xl * 2, 0);

  const [gym, setGym] = useState<GymDetails | null>(null);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDetails(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);
        setCurrentImageIndex(0);

        const details = await getGymDetails(gymId);

        if (active) {
          setGym(details);
        }
      } catch (error: unknown) {
        if (active) {
          setGym(null);
          setErrorMessage(getDetailsErrorMessage(error));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDetails();

    return () => {
      active = false;
    };
  }, [gymId]);

  async function openRoute(): Promise<void> {
    if (!gym) {
      return;
    }

    let destination: string | null = null;

    if (gym.coordinates) {
      destination = `${gym.coordinates.latitude},${gym.coordinates.longitude}`;
    } else if (gym.address) {
      destination = gym.address;
    }

    if (!destination) {
      Alert.alert(
        "Rota indisponível",
        "Esta academia não possui localização ou endereço disponível.",
      );

      return;
    }

    try {
      const url =
        "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(destination);

      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir a rota para esta academia.");
    }
  }

  async function openWebsite(): Promise<void> {
    if (!gym?.website) {
      return;
    }

    try {
      const hasProtocol =
        gym.website.startsWith("http://") || gym.website.startsWith("https://");

      const url = hasProtocol ? gym.website : `https://${gym.website}`;

      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o site da academia.");
    }
  }

  async function callGym(): Promise<void> {
    if (!gym?.phone) {
      return;
    }

    try {
      const cleanPhone = gym.phone.replace(/[^\d+]/g, "");

      await Linking.openURL(`tel:${cleanPhone}`);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a ligação.");
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>

        <Text style={styles.loadingTitle}>Carregando academia</Text>

        <Text style={styles.loadingText}>
          Buscando as informações disponíveis.
        </Text>
      </View>
    );
  }

  if (!gym || errorMessage) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIcon}>
          <AlertCircle
            size={26}
            strokeWidth={2.2}
            color={theme.colors.danger}
          />
        </View>

        <Text style={styles.errorTitle}>
          Não foi possível carregar a academia
        </Text>

        <Text style={styles.errorText}>
          {errorMessage ?? "Os detalhes desta academia não estão disponíveis."}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.errorButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <ArrowLeft
            size={17}
            strokeWidth={2.4}
            color={theme.colors.textOnPrimary}
          />

          <Text style={styles.errorButtonText}>Voltar ao mapa</Text>
        </Pressable>
      </View>
    );
  }

  const hasRoute = Boolean(gym.coordinates || gym.address);

  const hasContactActions = Boolean(gym.phone || gym.website);

  const hasImages = gym.imageUrls.length > 0;

  const hasMultipleImages = gym.imageUrls.length > 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
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
        <View pointerEvents="none" style={styles.heroDecoration}>
          <View style={styles.heroDecorationRingLarge} />

          <View style={styles.heroDecorationRingSmall} />

          <View style={styles.heroDecorationLine} />
        </View>

        <View style={styles.heroEyebrow}>
          <Dumbbell
            size={14}
            strokeWidth={2.4}
            color={theme.colors.techAccent}
          />

          <Text style={styles.heroEyebrowText}>ACADEMIA</Text>
        </View>

        <Text style={styles.heroTitle}>{gym.name}</Text>

        <View style={styles.heroAddressRow}>
          <MapPin
            size={17}
            strokeWidth={2.2}
            color={theme.colors.heroTextMuted}
          />

          <Text style={styles.heroAddress} numberOfLines={3}>
            {gym.address ?? "Endereço não informado"}
          </Text>
        </View>

        <View style={styles.heroMetaRow}>
          {distanceKm !== null ? (
            <View style={styles.heroMetaPill}>
              <Navigation
                size={14}
                strokeWidth={2.3}
                color={theme.colors.techAccent}
              />

              <Text style={styles.heroMetaText}>
                {formatDistance(distanceKm)}
              </Text>
            </View>
          ) : null}

          {gym.coordinates ? (
            <View style={styles.heroMetaPill}>
              <View style={styles.liveDot} />

              <Text style={styles.heroMetaText}>No mapa</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {hasImages ? (
        <View style={styles.gallerySection}>
          <View style={styles.galleryHeader}>
            <View>
              <Text style={styles.galleryEyebrow}>FOTOS</Text>

              <Text style={styles.galleryTitle}>Conheça o espaço</Text>
            </View>

            {hasMultipleImages ? (
              <View style={styles.galleryCount}>
                <Images
                  size={14}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />

                <Text style={styles.galleryCountText}>
                  {currentImageIndex + 1} / {gym.imageUrls.length}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.imageCard}>
            <ScrollView
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const pageWidth = event.nativeEvent.layoutMeasurement.width;

                if (pageWidth <= 0) {
                  return;
                }

                const nextIndex = Math.round(
                  event.nativeEvent.contentOffset.x / pageWidth,
                );

                setCurrentImageIndex(
                  Math.min(Math.max(nextIndex, 0), gym.imageUrls.length - 1),
                );
              }}
            >
              {gym.imageUrls.map((imageUrl, index) => (
                <View
                  key={`${imageUrl}-${index}`}
                  style={[
                    styles.imageSlide,
                    {
                      width: galleryWidth,
                    },
                  ]}
                >
                  <Image
                    source={{
                      uri: imageUrl,
                    }}
                    style={styles.gymImage}
                    resizeMode="cover"
                  />

                  <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.24)"]}
                    style={styles.imageOverlay}
                  />
                </View>
              ))}
            </ScrollView>

            {hasMultipleImages ? (
              <View pointerEvents="none" style={styles.galleryOverlayBadge}>
                <Images size={13} strokeWidth={2.2} color="#FFFFFF" />

                <Text style={styles.galleryOverlayText}>
                  Deslize para ver mais
                </Text>
              </View>
            ) : null}
          </View>

          {hasMultipleImages ? (
            <View style={styles.galleryDots}>
              {gym.imageUrls.map((_, index) => (
                <View
                  key={`gallery-dot-${index}`}
                  style={[
                    styles.galleryDot,
                    index === currentImageIndex && styles.galleryDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionsSection}>
        {hasRoute ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir rota para a academia"
            onPress={() => {
              void openRoute();
            }}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.primaryActionIcon}>
              <Navigation
                size={20}
                strokeWidth={2.4}
                color={theme.colors.textOnPrimary}
              />
            </View>

            <View style={styles.primaryActionCopy}>
              <Text style={styles.primaryActionTitle}>Traçar rota</Text>

              <Text style={styles.primaryActionText}>
                Abrir no aplicativo de mapas
              </Text>
            </View>

            <ArrowRight
              size={19}
              strokeWidth={2.4}
              color={theme.colors.textOnPrimary}
            />
          </Pressable>
        ) : null}

        {hasContactActions ? (
          <View style={styles.secondaryActions}>
            {gym.phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ligar para a academia"
                onPress={() => {
                  void callGym();
                }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.secondaryActionPressed,
                ]}
              >
                <View style={styles.secondaryActionIcon}>
                  <Phone
                    size={19}
                    strokeWidth={2.2}
                    color={theme.colors.primary}
                  />
                </View>

                <Text style={styles.secondaryActionText}>Ligar</Text>
              </Pressable>
            ) : null}

            {gym.website ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir site da academia"
                onPress={() => {
                  void openWebsite();
                }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.secondaryActionPressed,
                ]}
              >
                <View style={styles.secondaryActionIcon}>
                  <Globe2
                    size={19}
                    strokeWidth={2.2}
                    color={theme.colors.primary}
                  />
                </View>

                <Text style={styles.secondaryActionText}>Site</Text>

                <ExternalLink
                  size={14}
                  strokeWidth={2}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>INFORMAÇÕES</Text>

        <Text style={styles.sectionTitle}>Sobre a academia</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <MapPin size={19} strokeWidth={2.2} color={theme.colors.primary} />
          </View>

          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Endereço</Text>

            <Text style={styles.infoValue}>
              {gym.address ?? "Não informado"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Phone size={19} strokeWidth={2.2} color={theme.colors.primary} />
          </View>

          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Telefone</Text>

            <Text style={styles.infoValue}>{gym.phone ?? "Não informado"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Globe2 size={19} strokeWidth={2.2} color={theme.colors.primary} />
          </View>

          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Site</Text>

            <Text style={styles.infoValue} numberOfLines={2}>
              {gym.website ?? "Não informado"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Clock3 size={19} strokeWidth={2.2} color={theme.colors.primary} />
          </View>

          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Horário de funcionamento</Text>

            {gym.openingHours && gym.openingHours.length > 0 ? (
              <View style={styles.openingHoursList}>
                {gym.openingHours.map((openingHour) => (
                  <Text key={openingHour} style={styles.infoValue}>
                    {openingHour}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.infoValue}>Não informado</Text>
            )}
          </View>
        </View>
      </View>

      {gym.amenities.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>ESTRUTURA</Text>

            <Text style={styles.sectionTitle}>O que você encontra</Text>
          </View>

          <View style={styles.amenitiesCard}>
            <View style={styles.amenitiesGrid}>
              {gym.amenities.map((amenity) => (
                <View key={amenity} style={styles.amenityChip}>
                  <View style={styles.amenityIcon}>
                    <Check
                      size={13}
                      strokeWidth={2.6}
                      color={theme.colors.primary}
                    />
                  </View>

                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.sourceNote}>
        <ShieldCheck size={18} strokeWidth={2.2} color={theme.colors.primary} />

        <View style={styles.sourceNoteCopy}>
          <Text style={styles.sourceNoteTitle}>Informações verificáveis</Text>

          <Text style={styles.sourceNoteText}>
            O FitMap apresenta apenas os dados disponibilizados pela fonte
            externa. Informações ausentes não são estimadas.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar ao mapa"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.secondaryActionPressed,
        ]}
      >
        <ArrowLeft
          size={17}
          strokeWidth={2.3}
          color={theme.colors.textSecondary}
        />

        <Text style={styles.backButtonText}>Voltar ao mapa</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing["4xl"],
    },

    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing["2xl"],
      backgroundColor: theme.colors.background,
    },

    loadingIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
      marginBottom: theme.spacing.lg,
    },

    loadingTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.cardTitle,
      textAlign: "center",
    },

    loadingText: {
      marginTop: 6,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    errorIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.mode === "dark" ? "#321B20" : "#FEF2F2",
      marginBottom: theme.spacing.lg,
    },

    errorTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      textAlign: "center",
    },

    errorText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
      maxWidth: 320,
    },

    errorButton: {
      marginTop: theme.spacing.xl,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    errorButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    hero: {
      position: "relative",
      overflow: "hidden",
      minHeight: 245,
      justifyContent: "flex-end",
      padding: theme.spacing["2xl"],
      borderRadius: theme.radii.xl,
      marginBottom: theme.spacing["2xl"],
    },

    heroDecoration: {
      ...StyleSheet.absoluteFill,
    },

    heroDecorationRingLarge: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 1,
      borderColor: theme.colors.heroDetail,
      right: -56,
      top: -40,
    },

    heroDecorationRingSmall: {
      position: "absolute",
      width: 105,
      height: 105,
      borderRadius: 53,
      borderWidth: 1,
      borderColor: theme.colors.heroDetail,
      right: -5,
      top: 18,
    },

    heroDecorationLine: {
      position: "absolute",
      width: 225,
      height: 1,
      backgroundColor: theme.colors.heroDetail,
      right: -30,
      bottom: 62,
      transform: [
        {
          rotate: "-20deg",
        },
      ],
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
      letterSpacing: 1.6,
    },

    heroTitle: {
      maxWidth: "92%",
      color: theme.colors.heroText,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.9,
    },

    heroAddressRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 7,
      marginTop: theme.spacing.md,
      maxWidth: "92%",
    },

    heroAddress: {
      flex: 1,
      color: theme.colors.heroTextMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },

    heroMetaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.heroDetail,
    },

    heroMetaText: {
      color: theme.colors.heroText,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.performanceAccent,
    },

    gallerySection: {
      marginBottom: theme.spacing["2xl"],
    },

    galleryHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },

    galleryEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.7,
      marginBottom: 3,
    },

    galleryTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      letterSpacing: -0.4,
    },

    galleryCount: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    galleryCountText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },

    imageCard: {
      position: "relative",
      height: 235,
      overflow: "hidden",
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    imageSlide: {
      height: "100%",
      overflow: "hidden",
    },

    gymImage: {
      width: "100%",
      height: "100%",
    },

    imageOverlay: {
      ...StyleSheet.absoluteFill,
    },

    galleryOverlayBadge: {
      position: "absolute",
      left: 12,
      bottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.radii.full,
      backgroundColor: "rgba(11, 14, 24, 0.68)",
    },

    galleryOverlayText: {
      color: "#FFFFFF",
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    galleryDots: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: theme.spacing.sm,
    },

    galleryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
    },

    galleryDotActive: {
      width: 18,
      backgroundColor: theme.colors.primary,
    },

    actionsSection: {
      gap: theme.spacing.md,
      marginBottom: theme.spacing["3xl"],
    },

    primaryAction: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },

    primaryActionIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
    },

    primaryActionCopy: {
      flex: 1,
    },

    primaryActionTitle: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    primaryActionText: {
      marginTop: 2,
      color: "rgba(255,255,255,0.72)",
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
    },

    secondaryActions: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },

    secondaryAction: {
      flex: 1,
      minHeight: 57,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    secondaryActionPressed: {
      opacity: 0.72,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    secondaryActionIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    secondaryActionText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    buttonPressed: {
      opacity: 0.86,
      transform: [
        {
          scale: 0.985,
        },
      ],
    },

    sectionHeader: {
      marginBottom: theme.spacing.md,
    },

    sectionEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.7,
      marginBottom: 3,
    },

    sectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      letterSpacing: -0.4,
    },

    infoCard: {
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing["3xl"],
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
    },

    infoIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    infoCopy: {
      flex: 1,
      paddingTop: 1,
    },

    infoLabel: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
      marginBottom: 4,
    },

    infoValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    openingHoursList: {
      gap: 3,
    },

    divider: {
      height: 1,
      backgroundColor: theme.colors.divider,
    },

    amenitiesCard: {
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing["3xl"],
    },

    amenitiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },

    amenityChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      maxWidth: "100%",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    amenityIcon: {
      width: 22,
      height: 22,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },

    amenityText: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    sourceNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primarySoft,
      marginBottom: theme.spacing.xl,
    },

    sourceNoteCopy: {
      flex: 1,
    },

    sourceNoteTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      marginBottom: 3,
    },

    sourceNoteText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    backButton: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    backButtonText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
  });
}
