import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { AppStackScreenProps } from "../navigation/types";
import { ApiClientError } from "../services/apiClient";
import { getGymDetails, type GymDetails } from "../services/gyms";

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

  const [gym, setGym] = useState<GymDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetails(): Promise<void> {
      try {
        setLoading(true);
        setErrorMessage(null);

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
        `https://www.google.com/maps/dir/?api=1&destination=` +
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
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Carregando detalhes da academia...
        </Text>
      </View>
    );
  }

  if (!gym || errorMessage) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            Não foi possível carregar a academia
          </Text>

          <Text style={styles.errorText}>
            {errorMessage ??
              "Os detalhes desta academia não estão disponíveis."}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Voltar ao mapa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasRoute = Boolean(gym.coordinates || gym.address);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerLabel}>Academia selecionada</Text>

        <Text style={styles.title}>{gym.name}</Text>

        <Text style={styles.address}>
          {gym.address ?? "Endereço não informado"}
        </Text>
      </View>

      {gym.imageUrls.length > 0 ? (
        <View style={styles.imageCard}>
          <Image
            source={{ uri: gym.imageUrls[0] }}
            style={styles.gymImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {distanceKm !== null ? (
        <View style={styles.distanceCard}>
          <Text style={styles.distanceLabel}>Distância da sua localização</Text>

          <Text style={styles.distanceValue}>{formatDistance(distanceKm)}</Text>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Informações da academia</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Endereço</Text>

          <Text style={styles.infoText}>{gym.address ?? "Não informado"}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Telefone</Text>

          <Text style={styles.infoText}>{gym.phone ?? "Não informado"}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Site</Text>

          <Text style={styles.infoText}>{gym.website ?? "Não informado"}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Horário de funcionamento</Text>

          {gym.openingHours && gym.openingHours.length > 0 ? (
            gym.openingHours.map((openingHour) => (
              <Text key={openingHour} style={styles.infoText}>
                {openingHour}
              </Text>
            ))
          ) : (
            <Text style={styles.infoText}>Não informado</Text>
          )}
        </View>
      </View>

      {gym.amenities.length > 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Estrutura disponível</Text>

          {gym.amenities.map((amenity) => (
            <View key={amenity} style={styles.amenityItem}>
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Sobre estas informações</Text>

        <Text style={styles.noteText}>
          O FitMap exibe apenas informações disponíveis na fonte externa. Campos
          ausentes são apresentados como não informados e não são estimados pelo
          aplicativo.
        </Text>
      </View>

      {hasRoute ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openRoute}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Abrir rota no mapa</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.actionRow}>
        {gym.phone ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={callGym}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Ligar</Text>
          </TouchableOpacity>
        ) : null}

        {gym.website ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={openWebsite}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Abrir site</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Text style={styles.backButtonText}>Voltar ao mapa</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 14,
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
  },
  errorCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  errorTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  headerCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },
  headerLabel: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    marginBottom: 10,
  },
  address: {
    color: "#D1D5DB",
    fontSize: 15,
    lineHeight: 22,
  },
  imageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  gymImage: {
    width: "100%",
    height: 220,
  },
  distanceCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  distanceLabel: {
    color: "#1E40AF",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },
  distanceValue: {
    color: "#1D4ED8",
    fontSize: 22,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 14,
  },
  infoItem: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },
  infoText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  amenityItem: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  amenityText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
  noteCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 14,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#166534",
    marginBottom: 8,
  },
  noteText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#EAF2FF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  secondaryButtonText: {
    color: "#1D4ED8",
    fontWeight: "900",
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backButtonText: {
    color: "#111827",
    fontWeight: "900",
  },
});
