import { useFocusEffect } from "@react-navigation/native";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthContext } from "../context/AuthContext";
import { ApiClientError } from "../services/apiClient";
import { getBmiSnapshot, type BmiSnapshot } from "../services/bodyEvolution";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/themes";

function formatMeasurement(value: string | null, unit: string): string {
  if (value === null) {
    return "Não registrado";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "Indisponível";
  }

  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(numeric);

  return `${formatted} ${unit}`;
}

function formatRecordedAt(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getMissingDataMessage(snapshot: BmiSnapshot): string {
  if (snapshot.heightCm === null && snapshot.weightKg === null) {
    return "Cadastre sua altura no Perfil e registre seu peso para visualizar o IMC.";
  }

  if (snapshot.heightCm === null) {
    return "Cadastre sua altura na aba Perfil para calcular o IMC.";
  }

  if (snapshot.weightKg === null) {
    return "Registre seu peso em Medidas corporais para calcular o IMC.";
  }

  return "O IMC está indisponível para os dados atuais.";
}

function getErrorMessage(error: unknown): string {
  if (
    error instanceof ApiClientError &&
    error.code === "invalid_access_token"
  ) {
    return "Sua sessão expirou. Entre novamente.";
  }

  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return "Não foi possível conectar ao servidor.";
    }

    if (error.message === "The request timed out.") {
      return "A conexão demorou mais que o esperado.";
    }
  }

  return "Não foi possível carregar seu IMC.";
}

interface BmiCardProps {
  refreshVersion?: number;
}

export default function BmiCard({ refreshVersion = 0 }: BmiCardProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("BmiCard must be rendered inside AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [snapshot, setSnapshot] = useState<BmiSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const isFocused = useRef(false);
  const lastRefreshVersion = useRef(refreshVersion);

  const loadSnapshot = useCallback(async (): Promise<void> => {
    const currentRequest = ++requestSequence.current;

    setLoading(true);
    setError(null);

    try {
      const result = await runAuthenticatedRequest((accessToken) =>
        getBmiSnapshot(accessToken),
      );

      if (currentRequest === requestSequence.current) {
        setSnapshot(result);
      }
    } catch (loadError) {
      if (currentRequest === requestSequence.current) {
        setSnapshot(null);
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (currentRequest === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [runAuthenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      void loadSnapshot();

      return () => {
        isFocused.current = false;
        requestSequence.current += 1;
      };
    }, [loadSnapshot]),
  );

  useEffect(() => {
    if (lastRefreshVersion.current === refreshVersion) {
      return;
    }

    lastRefreshVersion.current = refreshVersion;

    if (isFocused.current) {
      void loadSnapshot();
    }
  }, [loadSnapshot, refreshVersion]);

  const recordedAt = formatRecordedAt(snapshot?.weightRecordedAt ?? null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>EVOLUÇÃO CORPORAL</Text>
          <Text style={styles.title}>Índice de massa corporal</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar IMC"
          disabled={loading}
          onPress={() => {
            void loadSnapshot();
          }}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          <Text style={styles.refreshText}>Atualizar</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.statusBlock}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.statusText}>Carregando IMC...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusBlock}>
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {error}
          </Text>

          <Text style={styles.statusText}>
            Use Atualizar para tentar novamente.
          </Text>
        </View>
      ) : snapshot ? (
        <>
          <View style={styles.bmiValueBlock}>
            <Text
              accessibilityLabel={
                snapshot.bmi === null
                  ? "IMC indisponível"
                  : `IMC ${snapshot.bmi.replace(".", ",")}`
              }
              style={styles.bmiValue}
            >
              {snapshot.bmi === null ? "—" : snapshot.bmi.replace(".", ",")}
            </Text>

            <Text style={styles.bmiUnit}>kg/m²</Text>
          </View>

          {snapshot.bmi === null ? (
            <Text style={styles.statusText}>
              {getMissingDataMessage(snapshot)}
            </Text>
          ) : (
            <Text style={styles.informationText}>
              Indicador informativo. O IMC não distingue massa muscular de
              gordura corporal.
            </Text>
          )}

          <View style={styles.measurements}>
            <View style={styles.measurement}>
              <Text style={styles.measurementLabel}>Altura</Text>
              <Text style={styles.measurementValue}>
                {formatMeasurement(snapshot.heightCm, "cm")}
              </Text>
            </View>

            <View style={styles.measurement}>
              <Text style={styles.measurementLabel}>Último peso</Text>
              <Text style={styles.measurementValue}>
                {formatMeasurement(snapshot.weightKg, "kg")}
              </Text>
            </View>
          </View>

          {recordedAt ? (
            <Text style={styles.recordedAt}>
              Peso registrado em {recordedAt}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.statusText}>Nenhum dado de IMC disponível.</Text>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      marginBottom: theme.spacing["3xl"],
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    headingCopy: {
      flex: 1,
    },
    eyebrow: {
      marginBottom: theme.spacing.xs,
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
    },
    refreshButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primarySoft,
    },
    refreshText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },
    statusBlock: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing["2xl"],
    },
    statusText: {
      marginTop: theme.spacing.md,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    errorText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },
    bmiValueBlock: {
      marginTop: theme.spacing.lg,
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.sm,
    },
    bmiValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.display,
      lineHeight: theme.typography.lineHeight.display,
    },
    bmiUnit: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.small,
    },
    informationText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    measurements: {
      flexDirection: "row",
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    measurement: {
      flex: 1,
      minHeight: 70,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },
    measurementLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    measurementValue: {
      marginTop: theme.spacing.xs,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },
    recordedAt: {
      marginTop: theme.spacing.md,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
