import { useFocusEffect } from "@react-navigation/native";
import { Plus, RefreshCw, Target, TrendingUp } from "lucide-react-native";
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
  createFitnessGoal,
  getFitnessGoalProgress,
  getFitnessGoals,
  type BodyMetricType,
  type BodyMetricUnit,
  type FitnessGoal,
  type FitnessGoalProgress,
  type FitnessGoalProgressStatus,
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

interface GoalItem {
  goal: FitnessGoal;
  progress: FitnessGoalProgress | null;
}

function getMetricLabel(type: BodyMetricType): string {
  return METRIC_OPTIONS.find((option) => option.type === type)?.label ?? type;
}

function getAllowedUnits(type: BodyMetricType): BodyMetricUnit[] {
  return type === "weight" ? ["kg", "lb"] : ["cm", "in"];
}

function validateValue(input: string): string | null {
  const normalized = input.trim().replace(",", ".");

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const numeric = Number(normalized);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return normalized;
}

function formatValue(value: string | null, unit: string): string {
  if (value === null) {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return `${value.replace(".", ",")} ${unit}`;
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(numeric)} ${unit}`;
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

function getStatusLabel(status: FitnessGoalProgressStatus): string {
  switch (status) {
    case "insufficient_data":
      return "Aguardando medidas suficientes";
    case "not_calculable":
      return "Percentual não calculável";
    case "in_progress":
      return "Em andamento";
    case "achieved":
      return "Meta atingida";
  }
}

function getStatusDescription(status: FitnessGoalProgressStatus): string {
  switch (status) {
    case "insufficient_data":
      return "Registre novas medidas após criar a meta para acompanhar sua evolução.";
    case "not_calculable":
      return "O valor inicial é igual ao alvo. Não é possível calcular um percentual.";
    case "in_progress":
      return "A evolução considera as medidas registradas e é calculada pelo servidor.";
    case "achieved":
      return "O objetivo definido foi alcançado conforme os registros disponíveis.";
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "invalid_access_token") {
      return "Sua sessão expirou. Entre novamente.";
    }

    if (error.code === "request_validation_error") {
      return "Confira o valor e a unidade da meta.";
    }
  }

  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return "Não foi possível conectar ao servidor.";
    }

    if (error.message === "The request timed out.") {
      return "A conexão demorou mais que o esperado.";
    }

    if (error.message === "The request could not be completed.") {
      return "Não foi possível concluir a solicitação.";
    }

    return error.message;
  }

  return "Não foi possível concluir a operação.";
}

function getProgressPercentage(
  progress: FitnessGoalProgress | null,
): number | null {
  if (!progress || progress.progressPercent === null) {
    return null;
  }

  const percentage = Number(progress.progressPercent);

  if (!Number.isFinite(percentage)) {
    return null;
  }

  return Math.max(0, Math.min(100, percentage));
}

export default function FitnessGoalsSection() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error(
      "FitnessGoalsSection must be rendered inside AuthProvider.",
    );
  }

  const { runAuthenticatedRequest } = auth;
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [items, setItems] = useState<GoalItem[]>([]);
  const [selectedType, setSelectedType] = useState<BodyMetricType>("weight");
  const [selectedUnit, setSelectedUnit] = useState<BodyMetricUnit>("kg");
  const [targetValue, setTargetValue] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchGoalItems = useCallback(async (): Promise<GoalItem[]> => {
    const goals = await runAuthenticatedRequest((accessToken) =>
      getFitnessGoals(accessToken),
    );

    return Promise.all(
      goals.map(async (goal): Promise<GoalItem> => {
        try {
          const progress = await runAuthenticatedRequest((accessToken) =>
            getFitnessGoalProgress(accessToken, goal.id),
          );

          return { goal, progress };
        } catch {
          return { goal, progress: null };
        }
      }),
    );
  }, [runAuthenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      fetchGoalItems()
        .then((loadedItems) => {
          if (active) {
            setItems(loadedItems);
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
    }, [fetchGoalItems]),
  );

  const refreshGoals = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedItems = await fetchGoalItems();
      setItems(loadedItems);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [fetchGoalItems]);

  function selectMetricType(type: BodyMetricType): void {
    if (saving) {
      return;
    }

    setSelectedType(type);
    setSelectedUnit(type === "weight" ? "kg" : "cm");
    setTargetValue("");
    setFormError(null);
    setSuccessMessage(null);
  }

  async function saveGoal(): Promise<void> {
    if (saving) {
      return;
    }

    const normalized = validateValue(targetValue);

    if (!normalized) {
      setFormError("Informe um alvo positivo, com até duas casas decimais.");
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    let createdGoal: FitnessGoal;

    try {
      createdGoal = await runAuthenticatedRequest((accessToken) =>
        createFitnessGoal(accessToken, {
          metricType: selectedType,
          targetValue: normalized,
          unit: selectedUnit,
        }),
      );
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
      setSaving(false);
      return;
    }

    setItems((current) => [
      { goal: createdGoal, progress: null },
      ...current.filter((item) => item.goal.id !== createdGoal.id),
    ]);

    setTargetValue("");
    setSuccessMessage("Meta registrada com sucesso.");

    try {
      const updatedItems = await fetchGoalItems();
      setItems(updatedItems);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setSaving(false);
    }
  }

  const allowedUnits = getAllowedUnits(selectedType);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Target size={22} strokeWidth={2.1} color={theme.colors.primary} />
        </View>

        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>OBJETIVOS MENSURÁVEIS</Text>
          <Text style={styles.title}>Metas fitness</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Defina um objetivo para seu peso ou medidas corporais e acompanhe a
        evolução com base nos registros realizados.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Tipo de meta</Text>

        <View style={styles.options}>
          {METRIC_OPTIONS.map((option) => {
            const selected = selectedType === option.type;

            return (
              <Pressable
                key={option.type}
                accessibilityRole="button"
                accessibilityLabel={`Selecionar meta de ${option.label}`}
                accessibilityState={{ selected, disabled: saving }}
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

        <Text style={styles.fieldLabel}>Valor que deseja alcançar</Text>

        <View style={styles.valueRow}>
          <TextInput
            accessibilityLabel="Valor alvo da meta fitness"
            style={styles.valueInput}
            value={targetValue}
            onChangeText={(text) => {
              setTargetValue(text);
              setFormError(null);
              setSuccessMessage(null);
            }}
            placeholder="Ex.: 75,50"
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
                  accessibilityLabel={`Unidade da meta ${unit}`}
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

        {successMessage ? (
          <Text accessibilityRole="alert" style={styles.successText}>
            {successMessage}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar meta fitness"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => void saveGoal()}
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
            {saving ? "Salvando..." : "Registrar meta"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.historyHeading}>
        <View style={styles.historyTitleRow}>
          <TrendingUp size={20} strokeWidth={2} color={theme.colors.primary} />

          <Text style={styles.historyTitle}>Acompanhamento de metas</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar acompanhamento de metas"
          disabled={loading || saving}
          onPress={() => void refreshGoals()}
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
          <Text style={styles.emptyText}>Carregando suas metas...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhuma meta registrada</Text>
          <Text style={styles.emptyText}>
            Crie uma meta para começar a acompanhar seus resultados.
          </Text>
        </View>
      ) : (
        <View style={styles.goalList}>
          {items.map(({ goal, progress }) => {
            const percentage = getProgressPercentage(progress);

            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalHeaderCopy}>
                    <Text style={styles.goalType}>
                      {getMetricLabel(goal.metricType)}
                    </Text>

                    <Text style={styles.goalCreatedAt}>
                      Criada em {formatDate(goal.createdAt)}
                    </Text>
                  </View>

                  <View style={styles.targetBadge}>
                    <Text style={styles.targetLabel}>ALVO</Text>
                    <Text style={styles.targetValue}>
                      {formatValue(goal.targetValue, goal.unit)}
                    </Text>
                  </View>
                </View>

                {progress === null ? (
                  <Text style={styles.statusDescription}>
                    Acompanhamento indisponível. Atualize para tentar novamente.
                  </Text>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.statusText,
                        progress.status === "achieved" && styles.achievedText,
                      ]}
                    >
                      {getStatusLabel(progress.status)}
                    </Text>

                    <View style={styles.valuesRow}>
                      <View style={styles.valueBlock}>
                        <Text style={styles.valueLabel}>Inicial</Text>
                        <Text style={styles.valueText}>
                          {formatValue(progress.baselineValue, goal.unit)}
                        </Text>
                      </View>

                      <View style={styles.valueBlock}>
                        <Text style={styles.valueLabel}>Atual</Text>
                        <Text style={styles.valueText}>
                          {formatValue(progress.currentValue, goal.unit)}
                        </Text>
                      </View>
                    </View>

                    {percentage !== null ? (
                      <View style={styles.progressArea}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>
                            Evolução da meta
                          </Text>

                          <Text style={styles.progressPercentage}>
                            {new Intl.NumberFormat("pt-BR", {
                              maximumFractionDigits: 2,
                            }).format(percentage)}
                            %
                          </Text>
                        </View>

                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${percentage}%` },
                              progress.status === "achieved" &&
                                styles.achievedFill,
                            ]}
                          />
                        </View>
                      </View>
                    ) : null}

                    <Text style={styles.statusDescription}>
                      {getStatusDescription(progress.status)}
                    </Text>
                  </>
                )}
              </View>
            );
          })}
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
      minHeight: 44,
      paddingHorizontal: 12,
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
      color: colors.danger,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.small,
      lineHeight: typography.lineHeight.small,
    },
    successText: {
      color: colors.success,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
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
      gap: 8,
    },
    historyTitleRow: {
      flex: 1,
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
      minWidth: 44,
      minHeight: 44,
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
    goalList: {
      gap: 10,
    },
    goalCard: {
      padding: 16,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 14,
    },
    goalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    goalHeaderCopy: {
      flex: 1,
      gap: 4,
    },
    goalType: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.bodyLarge,
      color: colors.textPrimary,
    },
    goalCreatedAt: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.caption,
      color: colors.textMuted,
    },
    targetBadge: {
      padding: 10,
      borderRadius: radii.md,
      backgroundColor: colors.primarySoft,
      alignItems: "flex-end",
      gap: 3,
    },
    targetLabel: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primary,
    },
    targetValue: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.primary,
    },
    statusText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.small,
      color: colors.primary,
    },
    achievedText: {
      color: colors.success,
    },
    valuesRow: {
      flexDirection: "row",
      gap: 12,
    },
    valueBlock: {
      flex: 1,
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceSecondary,
      gap: 5,
    },
    valueLabel: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.caption,
      color: colors.textSecondary,
    },
    valueText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.textPrimary,
    },
    progressArea: {
      gap: 8,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    progressLabel: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.small,
      color: colors.textSecondary,
    },
    progressPercentage: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.primary,
    },
    progressTrack: {
      height: 10,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceSecondary,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: radii.full,
      backgroundColor: colors.primary,
    },
    achievedFill: {
      backgroundColor: colors.success,
    },
    statusDescription: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
      lineHeight: typography.lineHeight.small,
      color: colors.textSecondary,
    },
  });
}
