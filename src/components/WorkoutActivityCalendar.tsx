import { lightSurfaceDepth } from "../theme/surfaces";
import { useFocusEffect } from "@react-navigation/native";
import {
  CalendarDays,
  BookOpen,
  Dumbbell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCw,
} from "lucide-react-native";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import { AuthContext } from "../context/AuthContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
import {
  getWorkoutHistoryPage,
  type WorkoutHistoryItem,
} from "../services/trainingSessions";
import type { Page } from "../services/pagination";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  getMonthActivitySummary,
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

const EMPTY_HISTORY: WorkoutHistoryItem[] = [];

interface CalendarBounds {
  completedFrom: string;
  completedBefore: string;
}

interface CalendarLoadState {
  key: string;
  status: "loading" | "ready" | "error";
  items: WorkoutHistoryItem[];
}

function getCalendarBounds(
  today: Date,
  monthTimestamp: number | null,
): CalendarBounds {
  const start =
    monthTimestamp === null ? getWeekDates(today)[0] : new Date(monthTimestamp);

  const end =
    monthTimestamp === null
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
      : new Date(start.getFullYear(), start.getMonth() + 1, 1);

  return {
    completedFrom: start.toISOString(),
    completedBefore: end.toISOString(),
  };
}

function calendarRequestKey(
  bounds: CalendarBounds,
  retryCounter: number,
): string {
  return `${bounds.completedFrom}|${bounds.completedBefore}|${retryCounter}`;
}

export default function WorkoutActivityCalendar({ onOpenWorkout }: Props) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("WorkoutActivityCalendar requires AuthProvider.");
  }

  const { runAuthenticatedRequest } = auth;
  const { theme } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const activityColor = theme.mode === "light" ? "#0F766E" : "#57D6B8";
  const todayColor = theme.colors.primary;
  const trackColor = theme.mode === "light" ? "#D7DFD9" : "#404B59";

  const [today, setToday] = useState(() => new Date());

  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStart(new Date()),
  );

  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const [selectionScale] = useState(() => new Animated.Value(1.065));

  const [diaryReveal] = useState(() => new Animated.Value(1));

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [loadState, setLoadState] = useState<CalendarLoadState | null>(null);

  const [retryCounter, setRetryCounter] = useState(0);

  const monthTimestamp = expanded ? visibleMonth.getTime() : null;

  const currentBounds = getCalendarBounds(today, monthTimestamp);

  const rangeKey = calendarRequestKey(currentBounds, retryCounter);

  const currentResult = loadState?.key === rangeKey ? loadState : null;

  const loading = currentResult === null || currentResult.status === "loading";

  const error = currentResult?.status === "error";

  const history =
    currentResult?.status === "ready" ? currentResult.items : EMPTY_HISTORY;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const now = new Date();
      const bounds = getCalendarBounds(now, monthTimestamp);
      const key = calendarRequestKey(bounds, retryCounter);

      setToday(now);

      setLoadState({
        key,
        status: "loading",
        items: [],
      });

      async function loadCalendarRange(): Promise<void> {
        const items: WorkoutHistoryItem[] = [];
        const seenIds = new Set<string>();
        const seenCursors = new Set<string>();

        let cursor: string | null = null;

        try {
          do {
            if (!active) {
              return;
            }

            const options = cursor === null ? bounds : { ...bounds, cursor };

            const page: Page<WorkoutHistoryItem> =
              await runAuthenticatedRequest((token) =>
                getWorkoutHistoryPage(token, options),
              );

            if (!active) {
              return;
            }

            if (
              page.nextCursor !== null &&
              (seenCursors.has(page.nextCursor) || page.items.length === 0)
            ) {
              throw new Error("Calendar pagination did not advance.");
            }

            for (const item of page.items) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                items.push(item);
              }
            }

            cursor = page.nextCursor;

            if (cursor !== null) {
              seenCursors.add(cursor);
            }
          } while (cursor !== null);

          if (active) {
            setLoadState({
              key,
              status: "ready",
              items,
            });
          }
        } catch {
          if (active) {
            setLoadState({
              key,
              status: "error",
              items: [],
            });
          }
        }
      }

      void loadCalendarRange();

      return () => {
        active = false;
      };
    }, [monthTimestamp, retryCounter, runAuthenticatedRequest]),
  );

  const grouped = useMemo(() => groupCompletedSessions(history), [history]);

  const weekDates = useMemo(() => getWeekDates(today), [today]);

  const monthDates = useMemo(() => getMonthDates(visibleMonth), [visibleMonth]);

  const monthActivity = useMemo(
    () => getMonthActivitySummary(grouped, visibleMonth),
    [grouped, visibleMonth],
  );

  const todayKey = localDateKey(today);

  const selectedKey = selectedDay ? localDateKey(selectedDay) : null;

  const diaryAnimationStyle = useMemo(
    () => ({
      opacity: diaryReveal,
      transform: [
        {
          translateY: diaryReveal.interpolate({
            inputRange: [0, 1],
            outputRange: [7, 0],
          }),
        },
      ],
    }),
    [diaryReveal],
  );

  useEffect(() => {
    if (!expanded || reduceMotion) {
      selectionScale.stopAnimation();
      diaryReveal.stopAnimation();

      selectionScale.setValue(1.065);
      diaryReveal.setValue(1);
      return;
    }

    selectionScale.setValue(0.94);
    diaryReveal.setValue(0);

    const animation = Animated.parallel([
      Animated.spring(selectionScale, {
        toValue: 1.065,
        speed: 17,
        bounciness: 3,
        useNativeDriver: true,
      }),
      Animated.timing(diaryReveal, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [selectedKey, expanded, reduceMotion, selectionScale, diaryReveal]);

  const selectedSessions = selectedKey ? (grouped[selectedKey] ?? []) : [];

  const sessionNameCounts = new Map<string, number>();

  for (const item of selectedSessions) {
    sessionNameCounts.set(
      item.workoutName,
      (sessionNameCounts.get(item.workoutName) ?? 0) + 1,
    );
  }

  const sessionNamePositions = new Map<string, number>();

  const selectedSessionEntries = selectedSessions.map((item) => {
    const name = item.workoutName;
    const position = (sessionNamePositions.get(name) ?? 0) + 1;
    sessionNamePositions.set(name, position);

    const count = sessionNameCounts.get(name) ?? 1;
    const baseLabel = `Ver detalhes do treino ${name}`;

    const time = new Date(item.completedAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      item,
      accessibilityLabel:
        count > 1
          ? `${baseLabel}, registro ${position} de ${count} neste dia`
          : baseLabel,
      accessibilityHint: `Concluído às ${time}. Ver exercícios, séries e cargas.`,
    };
  });

  const canGoForward = visibleMonth.getTime() < monthStart(today).getTime();

  function animateCalendarLayout(): void {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }

  function toggleExpanded(): void {
    animateCalendarLayout();
    setExpanded((value) => !value);
  }

  function selectDay(date: Date): void {
    animateCalendarLayout();
    setSelectedDay(date);
    setVisibleMonth(monthStart(date));
    setExpanded(true);
  }

  function changeMonth(direction: number): void {
    animateCalendarLayout();
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );

    setSelectedDay(null);
  }

  const selectionColor = theme.mode === "light" ? "#64748B" : "#94A3B8";

  function getDayAccessibilityLabel(date: Date): string {
    const key = localDateKey(date);
    const sessions = grouped[key] ?? [];

    const status = loading
      ? "Carregando dados de treino"
      : error
        ? "Dados de treino indisponíveis"
        : sessions.length > 0
          ? `${sessions.length} treino(s) concluído(s)`
          : "Sem treino concluído registrado";

    return `${formatDay(date)}. ${status}${key === todayKey ? ". Hoje" : ""}`;
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
        accessibilityLabel={getDayAccessibilityLabel(date)}
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

        <Animated.View
          style={[
            styles.activityRing,
            selected && styles.activityRingSelected,
            selected &&
              !reduceMotion && {
                transform: [{ scale: selectionScale }],
              },
            isFuture && styles.futureCircle,
          ]}
        >
          <Svg
            width={34}
            height={34}
            viewBox="0 0 34 34"
            pointerEvents="none"
            style={styles.activityRingArt}
          >
            <Circle
              cx={17}
              cy={17}
              r={13.3}
              fill="none"
              stroke={completed ? activityColor : trackColor}
              strokeWidth={completed ? 3.1 : 1.6}
            />
            {(isToday || selected) && (
              <Circle
                cx={17}
                cy={17}
                r={16}
                fill="none"
                stroke={isToday ? todayColor : selectionColor}
                strokeWidth={1.6}
              />
            )}
          </Svg>

          <View
            style={[
              styles.activityCore,
              completed && styles.activityCoreCompleted,
              selected && !completed && !isToday && styles.activityCoreSelected,
            ]}
          >
            <Text
              style={[
                styles.activityDayNumber,
                completed && styles.activityDayNumberCompleted,
                isFuture && styles.activityDayNumberFuture,
              ]}
            >
              {date.getDate()}
            </Text>
          </View>

          {completed ? (
            <View style={styles.activityCheck}>
              <Check size={8} strokeWidth={3.4} color="#FFFFFF" />
            </View>
          ) : null}
        </Animated.View>
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
        onPress={toggleExpanded}
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

      {!expanded ? (
        <View style={styles.weekRow}>
          {weekDates.map((day) => renderDay(day, false))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.feedback}>
          <ActivityIndicator size="small" color={theme.colors.primary} />

          <Text
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Atualizando seus treinos"
            accessibilityState={{ busy: true }}
            accessibilityLiveRegion="polite"
            style={styles.feedbackText}
          >
            Atualizando seus treinos...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.feedback}>
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.feedbackText}
          >
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

            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={styles.monthTitle}
            >
              {formatMonth(visibleMonth)}
            </Text>

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

          {!loading && !error ? (
            <View
              style={styles.monthStats}
              accessible
              accessibilityLabel={`Resumo de ${formatMonth(visibleMonth)}: ${monthActivity.activeDays} dias ativos e ${monthActivity.completedSessions} treinos concluídos`}
            >
              <View style={styles.monthStat}>
                <CalendarDays
                  size={16}
                  color={theme.mode === "light" ? "#0F766E" : "#57D6B8"}
                />
                <Text style={styles.monthStatValue}>
                  {monthActivity.activeDays}
                </Text>
                <Text style={styles.monthStatLabel}>
                  {monthActivity.activeDays === 1 ? "dia ativo" : "dias ativos"}
                </Text>
              </View>

              <View style={styles.monthStatDivider} />

              <View style={styles.monthStat}>
                <Dumbbell size={16} color={theme.colors.primary} />
                <Text style={styles.monthStatValue}>
                  {monthActivity.completedSessions}
                </Text>
                <Text style={styles.monthStatLabel}>
                  {monthActivity.completedSessions === 1
                    ? "treino concluído"
                    : "treinos concluídos"}
                </Text>
              </View>
            </View>
          ) : null}

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

            <View style={styles.legendItem}>
              <View style={styles.legendSelected} />
              <Text style={styles.legendText}>Selecionado</Text>
            </View>

            {!loading && !error ? (
              <Text style={styles.legendText}>Sem marcação = sem registro</Text>
            ) : null}
          </View>

          {!loading && !error ? (
            <Animated.View style={[styles.details, diaryAnimationStyle]}>
              {selectedDay ? (
                <>
                  <View style={styles.diaryHeader}>
                    <View style={styles.diaryHeaderCopy}>
                      <View style={styles.diaryEyebrowRow}>
                        <BookOpen
                          size={14}
                          color={theme.colors.textSecondary}
                        />
                        <Text style={styles.diaryEyebrow}>
                          DIÁRIO DE TREINOS
                        </Text>
                      </View>

                      <Text
                        accessibilityRole="header"
                        style={styles.detailsTitle}
                      >
                        {formatDay(selectedDay)}
                      </Text>
                    </View>

                    {selectedSessions.length > 0 ? (
                      <View style={styles.diaryBadge}>
                        <Text style={styles.diaryBadgeText}>
                          {selectedSessions.length}{" "}
                          {selectedSessions.length === 1 ? "treino" : "treinos"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {selectedSessions.length > 0 ? (
                    selectedSessionEntries.map(
                      ({ item, accessibilityLabel, accessibilityHint }) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={accessibilityLabel}
                          accessibilityHint={accessibilityHint}
                          onPress={() => onOpenWorkout(item.id)}
                          style={({ pressed }) => [
                            styles.sessionRow,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.sessionIcon}>
                            <Dumbbell
                              size={20}
                              strokeWidth={2.1}
                              color={
                                theme.mode === "light" ? "#0F766E" : "#57D6B8"
                              }
                            />
                          </View>

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

                            <Text style={styles.sessionAction}>
                              Ver exercícios, séries e cargas
                            </Text>
                          </View>

                          <ChevronRight
                            size={18}
                            color={theme.colors.textSecondary}
                          />
                        </Pressable>
                      ),
                    )
                  ) : (
                    <View style={styles.diaryEmpty}>
                      <CalendarDays
                        size={21}
                        color={theme.colors.textSecondary}
                      />

                      <View style={styles.diaryEmptyCopy}>
                        <Text
                          accessibilityLiveRegion="polite"
                          style={styles.diaryEmptyTitle}
                        >
                          Dia sem registros
                        </Text>

                        <Text style={styles.emptyText}>
                          Nenhum treino concluído foi registrado nesta data.
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.diaryHint}>
                  <BookOpen size={19} color={theme.colors.textSecondary} />

                  <Text style={styles.emptyText}>
                    Selecione um dia para consultar seu diário de treinos.
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  const light = theme.mode === "light";
  const accent = theme.colors.primary;
  const teal = "#0F766E";
  const surface = theme.colors.surface;

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
      ...lightSurfaceDepth(theme, "featured"),
    },

    header: {
      minHeight: 48,
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

    activityRing: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },

    activityRingArt: {
      position: "absolute",
      top: 0,
      left: 0,
    },

    activityRingSelected: {
      transform: [{ scale: 1.065 }],
      shadowColor: "#64748B",
      shadowOpacity: light ? 0.14 : 0.22,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    activityCore: {
      width: 23,
      height: 23,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: light ? "#F2EFE9" : theme.colors.surfaceSecondary,
    },

    activityCoreCompleted: {
      backgroundColor: light ? "#E5F2ED" : "#18382F",
    },

    activityCoreSelected: {
      backgroundColor: light ? "#E8EBEF" : "#293344",
    },

    activityCheck: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 13,
      height: 13,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: surface,
      backgroundColor: "#0F766E",
      alignItems: "center",
      justifyContent: "center",
    },

    futureCircle: {
      opacity: 0.78,
    },

    activityDayNumber: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 11,
      lineHeight: 14,
    },

    activityDayNumberCompleted: {
      color: light ? "#0F766E" : "#8AE6CE",
    },

    activityDayNumberFuture: {
      color: theme.colors.textSecondary,
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
      minHeight: 48,
      minWidth: 48,
      justifyContent: "center",
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
      flex: 1,
      minWidth: 0,
      textAlign: "center",
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 15,
    },

    monthArrow: {
      width: 48,
      height: 48,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
    },

    monthStats: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: light ? "#F6F3EE" : theme.colors.surfaceSecondary,
      borderRadius: 13,
      paddingHorizontal: 11,
      paddingVertical: 13,
      marginBottom: 14,
    },

    monthStat: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 6,
    },

    monthStatValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 17,
    },

    monthStatLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 11,
      textAlign: "center",
    },

    monthStatDivider: {
      width: 1,
      height: 27,
      backgroundColor: theme.colors.divider,
      marginHorizontal: 7,
    },

    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 2,
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
      paddingVertical: 2,
      minHeight: 48,
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

    legendSelected: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: light ? "#64748B" : "#94A3B8",
    },

    details: {
      marginTop: 17,
      borderTopWidth: 1,
      borderColor: theme.colors.divider,
      paddingTop: 14,
      gap: 9,
    },

    diaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 3,
    },

    diaryHeaderCopy: {
      flex: 1,
      gap: 7,
    },

    diaryEyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    diaryEyebrow: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.1,
    },

    diaryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: light ? "#E6F2ED" : "#17372F",
    },

    diaryBadgeText: {
      color: light ? "#0F766E" : "#87E1C8",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 11,
    },

    diaryEmpty: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderRadius: 14,
      backgroundColor: light ? "#F5F2ED" : theme.colors.surfaceSecondary,
    },

    diaryEmptyCopy: {
      flex: 1,
      gap: 3,
    },

    diaryEmptyTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 13,
    },

    diaryHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
    },

    sessionIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: light ? "#E3F0EA" : "#17372F",
      alignItems: "center",
      justifyContent: "center",
    },

    sessionAction: {
      color: light ? "#0F766E" : "#87E1C8",
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 11,
      marginTop: 3,
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
      minHeight: 48,
      minWidth: 48,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 15,
      padding: 13,
      gap: 11,
      borderWidth: 1,
      borderColor: light ? "#E2DDD4" : theme.colors.border,
      backgroundColor: light ? "#F6F3EE" : theme.colors.surfaceSecondary,
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
