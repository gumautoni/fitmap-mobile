import { useFocusEffect } from "@react-navigation/native";
import { Activity, Plus, RefreshCw, Ruler } from "lucide-react-native";
import { useCallback, useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthContext } from "../context/AuthContext";
import { ApiClientError } from "../services/apiClient";
import {
  createBodyMetric,
  getBodyMetrics,
  type BodyMetric,
  type BodyMetricType,
  type BodyMetricUnit,
} from "../services/bodyMetricsGoals";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/themes";

const METRIC_OPTIONS: {
  type: BodyMetricType;
  label: string;
}[] = [
  { type: "weight", label: "Peso" },
  { type: "waist", label: "Cintura" },
  { type: "chest", label: "Peito" },
  { type: "arm", label: "Braço" },
  { type: "thigh", label: "Coxa" },
  { type: "hip", label: "Quadril" },
];

function getMetricLabel(type: BodyMetricType): string {
  return METRIC_OPTIONS.find((option) => option.type === type)?.label ?? type;
}

function getAllowedUnits(type: BodyMetricType): BodyMetricUnit[] {
  return type === "weight" ? ["kg", "lb"] : ["cm", "in"];
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "invalid_access_token") {
      return "Sua sessão expirou. Entre novamente.";
    }

    if (error.code === "request_validation_error") {
      return "Confira o valor e a unidade informados.";
    }
  }

  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return "Não foi possível conectar ao servidor.";
    }

    if (error.message === "The request timed out.") {
      return "A conexão demorou mais que o esperado.";
    }

    return error.message;
  }

  return "Não foi possível concluir a operação.";
}

function validateValue(input: string): string | null {
  const normalized = input.trim().replace(",", ".");

  // Até oito dígitos inteiros e duas casas decimais,
  // respeitando a precisão do campo no PostgreSQL.
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return normalized;
}

export default function BodyMetricsSection() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("BodyMetricsSection must be rendered inside AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [selectedType, setSelectedType] = useState<BodyMetricType>("weight");
  const [selectedUnit, setSelectedUnit] = useState<BodyMetricUnit>("kg");
  const [value, setValue] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      runAuthenticatedRequest((accessToken) => getBodyMetrics(accessToken))
        .then((records) => {
          if (active) {
            setMetrics(records);
          }
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(getErrorMessage(loadError));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [runAuthenticatedRequest]),
  );

  const refreshMetrics = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const records = await runAuthenticatedRequest((accessToken) =>
        getBodyMetrics(accessToken),
      );

      setMetrics(records);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [runAuthenticatedRequest]);

  function selectMetricType(type: BodyMetricType): void {
    if (saving) {
      return;
    }

    setSelectedType(type);
    setSelectedUnit(type === "weight" ? "kg" : "cm");
    setValue("");
    setFormError(null);
  }

  async function saveMetric(): Promise<void> {
    if (saving) {
      return;
    }

    const normalizedValue = validateValue(value);

    if (!normalizedValue) {
      setFormError("Informe um valor positivo, com até duas casas decimais.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const created = await runAuthenticatedRequest((accessToken) =>
        createBodyMetric(accessToken, {
          metricType: selectedType,
          value: normalizedValue,
          unit: selectedUnit,
          recordedAt: new Date().toISOString(),
        }),
      );

      // O retorno da API confirma a persistência.
      // Adicionamos o registro sem exigir uma segunda requisição.
      setMetrics((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);

      setValue("");
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  const allowedUnits = getAllowedUnits(selectedType);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Activity size={22} strokeWidth={2.1} color={theme.colors.primary} />
        </View>

        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>EVOLUÇÃO CORPORAL</Text>
          <Text style={styles.title}>Medidas corporais</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Registre seu peso e suas medidas para acompanhar mudanças ao longo do
        tempo.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Tipo de medida</Text>

        <View style={styles.options}>
          {METRIC_OPTIONS.map((option) => {
            const selected = selectedType === option.type;

            return (
              <Pressable
                key={option.type}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: saving }}
                accessibilityLabel={`Selecionar ${option.label}`}
                disabled={saving}
                onPress={() => selectMetricType(option.type)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Valor</Text>

        <View style={styles.valueRow}>
          <TextInput
            accessibilityLabel="Valor da medida corporal"
            style={styles.valueInput}
            value={value}
            onChangeText={(text) => {
              setValue(text);
              if (formError) {
                setFormError(null);
              }
            }}
            placeholder="Ex.: 78,50"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            maxLength={12}
            editable={!saving}
          />

          <View style={styles.units}>
            {allowedUnits.map((unit) => {
              const selected = selectedUnit === unit;

              return (
                <Pressable
                  key={unit}
                  accessibilityRole="button"
                  accessibilityLabel={`Unidade ${unit}`}
                  accessibilityState={{ selected, disabled: saving }}
                  disabled={saving}
                  onPress={() => setSelectedUnit(unit)}
                  style={[
                    styles.unitButton,
                    selected && styles.unitButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.unitText,
                      selected && styles.unitTextSelected,
                    ]}
                  >
                    {unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {formError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {formError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar medida corporal"
          disabled={saving}
          onPress={() => void saveMetric()}
          style={[styles.saveButton, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.textOnPrimary}
            />
          ) : (
            <Plus
              size={19}
              strokeWidth={2.2}
              color={theme.colors.textOnPrimary}
            />
          )}

          <Text style={styles.saveButtonText}>
            {saving ? "Salvando..." : "Registrar medida"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.historyHeading}>
        <View style={styles.historyTitleRow}>
          <Ruler size={20} strokeWidth={2} color={theme.colors.primary} />

          <Text style={styles.historyTitle}>Histórico de medidas</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar histórico de medidas"
          disabled={loading}
          onPress={() => void refreshMetrics()}
          style={styles.refreshButton}
        >
          <RefreshCw size={19} strokeWidth={2} color={theme.colors.primary} />
        </Pressable>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.emptyText}>Carregando medidas...</Text>
        </View>
      ) : metrics.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhuma medida registrada</Text>
          <Text style={styles.emptyText}>
            Seu primeiro registro aparecerá aqui com a data e a unidade
            utilizada.
          </Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {metrics.map((metric) => (
            <View key={metric.id} style={styles.historyItem}>
              <View style={styles.historyItemCopy}>
                <Text style={styles.historyMetricName}>
                  {getMetricLabel(metric.metricType)}
                </Text>
                <Text style={styles.historyDate}>
                  {formatDate(metric.recordedAt)}
                </Text>
              </View>

              <Text style={styles.historyValue}>
                {metric.value.replace(".", ",")} {metric.unit}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, typography, radii } = theme;

  return StyleSheet.create({
    container: {
      marginTop: 24,
      gap: 14,
    },
    heading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headingIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    headingCopy: {
      flex: 1,
      gap: 3,
    },
    eyebrow: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.caption,
      letterSpacing: 1,
      color: colors.primary,
    },
    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sectionTitle,
      color: colors.textPrimary,
    },
    description: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.textSecondary,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.xl,
      padding: 16,
      gap: 14,
    },
    fieldLabel: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.small,
      color: colors.textPrimary,
    },
    options: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    option: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
    },
    optionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    optionText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
      color: colors.textSecondary,
    },
    optionTextSelected: {
      color: colors.primary,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    valueInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 48,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.bodyLarge,
    },
    units: {
      flexDirection: "row",
      gap: 6,
    },
    unitButton: {
      paddingHorizontal: 12,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
    },
    unitButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    unitText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.small,
      color: colors.textSecondary,
    },
    unitTextSelected: {
      color: colors.primary,
    },
    errorText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.small,
      lineHeight: typography.lineHeight.small,
      color: colors.danger,
    },
    saveButton: {
      minHeight: 48,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    saveButtonText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.textOnPrimary,
    },
    disabled: {
      opacity: 0.6,
    },
    historyHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
    },
    historyTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    historyTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.cardTitle,
      color: colors.textPrimary,
    },
    refreshButton: {
      minHeight: 44,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyCard: {
      padding: 22,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
      alignItems: "center",
    },
    emptyTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.textPrimary,
      textAlign: "center",
    },
    emptyText: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
      lineHeight: typography.lineHeight.small,
      color: colors.textSecondary,
      textAlign: "center",
    },
    historyList: {
      gap: 8,
    },
    historyItem: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    historyItemCopy: {
      flex: 1,
      gap: 4,
    },
    historyMetricName: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.textPrimary,
    },
    historyDate: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.caption,
      color: colors.textSecondary,
    },
    historyValue: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.bodyLarge,
      color: colors.primary,
    },
  });
}
