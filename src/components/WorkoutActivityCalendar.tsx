import { useFocusEffect } from "@react-navigation/native";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCw,
} from "lucide-react-native";
import { useCallback, useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthContext } from "../context/AuthContext";
import {
  getWorkoutHistory,
  type WorkoutHistoryItem,
} from "../services/trainingSessions";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  getMonthDates,
  getWeekDates,
  groupCompletedSessions,
  localDateKey,
} from "../utils/workoutCalendar";

interface Props {
  onOpenWorkout: (sessionId: string) => void;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonth(date: Date): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function WorkoutActivityCalendar({ onOpenWorkout }: Props) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("WorkoutActivityCalendar requires AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;
  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [today, setToday] = useState(() => new Date());

  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStart(new Date()),
  );

  const [expanded, setExpanded] = useState(false);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setToday(new Date());
      setLoading(true);
      setError(false);

      runAuthenticatedRequest((token) => getWorkoutHistory(token))
        .then((items) => {
          if (active) {
            setHistory(items);
          }
        })
        .catch(() => {
          if (active) {
            setHistory([]);
            setError(true);
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
      // retryCounter intentionally triggers a new request after retry.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runAuthenticatedRequest, retryCounter]),
  );

  const grouped = useMemo(() => groupCompletedSessions(history), [history]);

  const weekDates = useMemo(() => getWeekDates(today), [today]);

  const monthDates = useMemo(() => getMonthDates(visibleMonth), [visibleMonth]);

  const todayKey = localDateKey(today);

  const selectedKey = selectedDay ? localDateKey(selectedDay) : null;

  const selectedSessions = selectedKey ? (grouped[selectedKey] ?? []) : [];

  const canGoForward = visibleMonth.getTime() < monthStart(today).getTime();

  function selectDay(date: Date): void {
    setSelectedDay(date);
    setVisibleMonth(monthStart(date));
    setExpanded(true);
  }

  function changeMonth(direction: number): void {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );

    setSelectedDay(null);
  }

  function renderDay(date: Date, monthly: boolean) {
    const key = localDateKey(date);
    const sessions = grouped[key] ?? [];

    const completed = sessions.length > 0;
    const isToday = key === todayKey;
    const selected = expanded && selectedKey === key;
    const isFuture = key > todayKey;

    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={`${formatDay(date)}. ${
          completed
            ? `${sessions.length} treino(s) concluído(s)`
            : "Sem treino concluído registrado"
        }`}
        accessibilityState={{
          selected,
          disabled: loading || error || isFuture,
        }}
        disabled={loading || error || isFuture}
        onPress={() => selectDay(date)}
        style={({ pressed }) => [
          monthly ? styles.monthDay : styles.weekDay,
          pressed && styles.pressed,
        ]}
      >
        {!monthly ? (
          <Text style={styles.weekday}>
            {WEEKDAYS[(date.getDay() + 6) % 7]}
          </Text>
        ) : null}

        <View
          style={[
            styles.dayCircle,
            completed && styles.completedCircle,
            isToday && styles.todayCircle,
            selected && styles.selectedCircle,
            isFuture && styles.futureCircle,
          ]}
        >
          <Text
            style={[
              styles.dayNumber,
              completed && styles.completedNumber,
              isFuture && styles.futureNumber,
            ]}
          >
            {date.getDate()}
          </Text>

          {completed ? (
            <Check size={9} strokeWidth={3} color="#FFFFFF" />
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? "Recolher calendário de treinos"
            : "Expandir calendário de treinos"
        }
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <CalendarDays size={19} color={styles.accentColor.color} />

            <Text style={styles.title}>Sua constância</Text>
          </View>

          <Text style={styles.subtitle}>Seus dias de treino, de verdade</Text>
        </View>

        <View style={styles.expandAction}>
          <Text style={styles.expandLabel}>
            {expanded ? "Recolher" : "Ver mês"}
          </Text>

          {expanded ? (
            <ChevronUp size={17} color={theme.colors.textSecondary} />
          ) : (
            <ChevronDown size={17} color={theme.colors.textSecondary} />
          )}
        </View>
      </Pressable>

      <View style={styles.weekRow}>
        {weekDates.map((day) => renderDay(day, false))}
      </View>

      {loading ? (
        <View style={styles.feedback}>
          <ActivityIndicator size="small" color={theme.colors.primary} />

          <Text style={styles.feedbackText}>Atualizando seus treinos...</Text>
        </View>
      ) : error ? (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>
            Não foi possível carregar os dias de treino.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar calendário novamente"
            onPress={() => setRetryCounter((value) => value + 1)}
            style={styles.retry}
          >
            <RefreshCw size={14} color={theme.colors.primary} />

            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      {expanded ? (
        <View style={styles.expandedContent}>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mês anterior"
              onPress={() => changeMonth(-1)}
              style={styles.monthArrow}
            >
              <ChevronLeft size={21} color={theme.colors.textPrimary} />
            </Pressable>

            <Text style={styles.monthTitle}>{formatMonth(visibleMonth)}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Próximo mês"
              accessibilityState={{
                disabled: !canGoForward,
              }}
              disabled={!canGoForward}
              onPress={() => changeMonth(1)}
              style={styles.monthArrow}
            >
              <ChevronRight
                size={21}
                color={
                  canGoForward
                    ? theme.colors.textPrimary
                    : theme.colors.textMuted
                }
              />
            </Pressable>
          </View>

          <View style={styles.monthGrid}>
            {WEEKDAYS.map((label, index) => (
              <View key={index} style={styles.monthWeekday}>
                <Text style={styles.weekday}>{label}</Text>
              </View>
            ))}

            {monthDates.map((date, index) =>
              date ? (
                renderDay(date, true)
              ) : (
                <View key={`empty-${index}`} style={styles.monthDay} />
              ),
            )}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendCompleted} />
              <Text style={styles.legendText}>Concluído</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={styles.legendToday} />
              <Text style={styles.legendText}>Hoje</Text>
            </View>

            <Text style={styles.legendText}>Sem marcação = sem registro</Text>
          </View>

          {!loading && !error ? (
            <View style={styles.details}>
              {selectedDay ? (
                <>
                  <Text style={styles.detailsTitle}>
                    {formatDay(selectedDay)}
                  </Text>

                  {selectedSessions.length > 0 ? (
                    selectedSessions.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver detalhes do treino ${item.workoutName}`}
                        onPress={() => onOpenWorkout(item.id)}
                        style={({ pressed }) => [
                          styles.sessionRow,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.sessionCopy}>
                          <Text style={styles.sessionTitle}>
                            {item.workoutName}
                          </Text>

                          <Text style={styles.sessionTime}>
                            Concluído às{" "}
                            {new Date(item.completedAt).toLocaleTimeString(
                              "pt-BR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </Text>
                        </View>

                        <ChevronRight
                          size={18}
                          color={theme.colors.textSecondary}
                        />
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>
                      Nenhum treino concluído registrado neste dia.
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>
                  Toque em uma data para consultar os treinos concluídos.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  const light = theme.mode === "light";
  const accent = light ? "#2563EB" : theme.colors.primary;
  const teal = "#0F766E";
  const surface = light ? "#FCFAF7" : theme.colors.surface;

  return StyleSheet.create({
    accentColor: {
      color: accent,
    },

    card: {
      backgroundColor: surface,
      borderColor: light ? "#E2DDD4" : theme.colors.border,
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
      marginBottom: 32,
      shadowColor: "#0F172A",
      shadowOpacity: light ? 0.045 : 0.14,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 1,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },

    headerText: {
      flex: 1,
      gap: 4,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 17,
    },

    subtitle: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 12,
    },

    expandAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingVertical: 9,
    },

    expandLabel: {
      color: accent,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 12,
    },

    weekRow: {
      flexDirection: "row",
      marginTop: 16,
      gap: 2,
    },

    weekDay: {
      flex: 1,
      alignItems: "center",
      gap: 7,
      paddingVertical: 3,
      minHeight: 64,
    },

    weekday: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 11,
    },

    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: light ? "#F2EFE9" : theme.colors.surfaceSecondary,
      borderWidth: 1.5,
      borderColor: "transparent",
    },

    completedCircle: {
      backgroundColor: teal,
    },

    todayCircle: {
      borderColor: accent,
    },

    selectedCircle: {
      borderColor: accent,
      borderWidth: 2,
    },

    futureCircle: {
      opacity: 0.45,
    },

    dayNumber: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 12,
      lineHeight: 15,
    },

    completedNumber: {
      color: "#FFFFFF",
    },

    futureNumber: {
      color: theme.colors.textMuted,
    },

    feedback: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 9,
    },

    feedbackText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
    },

    retry: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 5,
    },

    retryText: {
      color: accent,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 12,
    },

    expandedContent: {
      marginTop: 16,
      borderTopWidth: 1,
      borderColor: theme.colors.divider,
      paddingTop: 14,
    },

    monthHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 13,
    },

    monthTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 15,
    },

    monthArrow: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },

    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 4,
    },

    monthWeekday: {
      width: "14.2857%",
      alignItems: "center",
      paddingVertical: 7,
    },

    monthDay: {
      width: "14.2857%",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
      minHeight: 43,
    },

    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
      marginTop: 12,
    },

    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    legendText: {
      color: theme.colors.textSecondary,
      fontSize: 10,
    },

    legendCompleted: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: teal,
    },

    legendToday: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: accent,
    },

    details: {
      marginTop: 17,
      borderTopWidth: 1,
      borderColor: theme.colors.divider,
      paddingTop: 14,
      gap: 9,
    },

    detailsTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 14,
    },

    emptyText: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 12,
      lineHeight: 19,
    },

    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      padding: 12,
      gap: 9,
      backgroundColor: light ? "#F2EFE9" : theme.colors.surfaceSecondary,
    },

    sessionCopy: {
      flex: 1,
      gap: 3,
    },

    sessionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 13,
    },

    sessionTime: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 11,
    },

    pressed: {
      opacity: 0.77,
      transform: [{ scale: 0.985 }],
    },
  });
}
