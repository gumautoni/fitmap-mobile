import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import type { BodyMetric, BodyMetricType } from "../services/bodyMetricsGoals";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/themes";
import {
  BODY_EVOLUTION_OPTIONS,
  buildBodyEvolutionSeries,
  type BodyEvolutionPoint,
} from "../utils/bodyEvolutionChart";

interface BodyEvolutionChartProps {
  metrics: readonly BodyMetric[];
  loading: boolean;
  error?: string | null;
}

interface ChartCoordinate {
  id: string;
  x: number;
  y: number;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 174;
const PLOT_LEFT = 15;
const PLOT_RIGHT = 305;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 148;

function getCoordinates(
  points: readonly BodyEvolutionPoint[],
): ChartCoordinate[] {
  if (points.length === 0) {
    return [];
  }

  const minTime = points[0]?.timestamp ?? 0;
  const maxTime = points.at(-1)?.timestamp ?? minTime;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.12, 0.5);
  const lowerBound = Math.max(0, minimum - padding);
  const upperBound = maximum + padding;
  const valueRange = upperBound - lowerBound;
  const timeRange = maxTime - minTime;

  return points.map((point) => ({
    id: point.id,
    x:
      timeRange === 0
        ? (PLOT_LEFT + PLOT_RIGHT) / 2
        : PLOT_LEFT +
          ((point.timestamp - minTime) / timeRange) * (PLOT_RIGHT - PLOT_LEFT),
    y:
      PLOT_BOTTOM -
      ((point.value - lowerBound) / valueRange) * (PLOT_BOTTOM - PLOT_TOP),
  }));
}

function formatValue(value: number, unit: string): string {
  const number = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);

  return `${number} ${unit}`;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

export default function BodyEvolutionChart({
  metrics,
  loading,
  error = null,
}: BodyEvolutionChartProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedType, setSelectedType] = useState<BodyMetricType>("weight");

  const series = useMemo(
    () => buildBodyEvolutionSeries(metrics, selectedType),
    [metrics, selectedType],
  );

  const coordinates = useMemo(
    () => getCoordinates(series.points),
    [series.points],
  );

  const first = series.points[0];
  const last = series.points.at(-1);

  const difference =
    first && last && series.points.length > 1 ? last.value - first.value : null;

  const linePoints = coordinates
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HISTÓRICO VISUAL</Text>
        <Text style={styles.title}>Evolução das medidas</Text>
        <Text style={styles.description}>
          Acompanhe seus registros ao longo do tempo. Os valores são
          apresentados em kg ou cm.
        </Text>
      </View>

      <View style={styles.options}>
        {BODY_EVOLUTION_OPTIONS.map((option) => {
          const selected = option.type === selectedType;

          return (
            <Pressable
              key={option.type}
              accessibilityRole="button"
              accessibilityLabel={`Visualizar evolução de ${option.label}`}
              accessibilityState={{ selected }}
              onPress={() => setSelectedType(option.type)}
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

      {loading ? (
        <Text style={styles.emptyText}>Carregando evolução corporal...</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.emptyText}>
          Não foi possível carregar a evolução corporal. Atualize o histórico
          para tentar novamente.
        </Text>
      ) : !last ? (
        <Text style={styles.emptyText}>
          Nenhum registro válido de {series.label.toLowerCase()} para
          visualizar. Registre uma medida para começar.
        </Text>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Primeiro registro</Text>
              <Text style={styles.summaryValue}>
                {formatValue(first?.value ?? last.value, series.unit)}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Mais recente</Text>
              <Text style={styles.summaryValue}>
                {formatValue(last.value, series.unit)}
              </Text>
            </View>
          </View>

          <View
            accessible
            accessibilityLabel={`Gráfico de ${series.label}, com ${series.points.length} registros`}
            style={styles.chartArea}
          >
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            >
              {[PLOT_TOP, (PLOT_TOP + PLOT_BOTTOM) / 2, PLOT_BOTTOM].map(
                (y) => (
                  <Line
                    key={y}
                    x1={PLOT_LEFT}
                    y1={y}
                    x2={PLOT_RIGHT}
                    y2={y}
                    stroke={theme.colors.border}
                    strokeWidth={1}
                  />
                ),
              )}

              {coordinates.length > 1 ? (
                <Polyline
                  points={linePoints}
                  fill="none"
                  stroke={theme.colors.primary}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {coordinates.map((point) => (
                <Circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r={coordinates.length > 15 ? 2.5 : 4}
                  fill={theme.colors.primary}
                />
              ))}
            </Svg>
          </View>

          <View style={styles.dateRow}>
            <Text style={styles.dateText}>
              {formatDate(first?.timestamp ?? last.timestamp)}
            </Text>

            <Text style={styles.dateText}>{formatDate(last.timestamp)}</Text>
          </View>

          {difference !== null ? (
            <Text style={styles.changeText}>
              Variação do período: {difference > 0 ? "+" : ""}
              {formatValue(difference, series.unit)}
            </Text>
          ) : (
            <Text style={styles.changeText}>
              Adicione outro registro para visualizar a variação.
            </Text>
          )}

          <Text style={styles.countText}>
            {series.points.length} de {series.totalValidRecords} registros
            válidos exibidos.
          </Text>
        </>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.md,
    },
    header: {
      gap: theme.spacing.xs,
    },
    eyebrow: {
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
      color: theme.colors.primary,
    },
    title: {
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      color: theme.colors.textPrimary,
    },
    description: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      color: theme.colors.textSecondary,
    },
    options: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    option: {
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSecondary,
    },
    optionSelected: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary,
    },
    optionText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.small,
    },
    optionTextSelected: {
      color: theme.colors.primary,
    },
    emptyText: {
      paddingVertical: theme.spacing.xl,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },
    summaryRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    summaryItem: {
      flex: 1,
      minWidth: 0,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },
    summaryLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    summaryValue: {
      marginTop: theme.spacing.xs,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },
    chartArea: {
      width: "100%",
      overflow: "hidden",
    },
    dateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    dateText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },
    changeText: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.small,
    },
    countText: {
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
    },
  });
}
