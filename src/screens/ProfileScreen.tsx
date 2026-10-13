import {
  ChevronRight,
  Clock3,
  Dumbbell,
  Gauge,
  LogOut,
  Palette,
  Ruler,
  Target,
  UserRound,
} from "lucide-react-native";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthContext } from "../context/AuthContext";
import type { AppStackScreenProps } from "../navigation/types";
import {
  getProfile,
  updateProfile,
  type ExperienceLevel,
  type FitnessGoal,
  type MeasurementSystem,
  type UpdateProfileInput,
  type UserProfile,
} from "../services/profile";
import { useAppTheme } from "../theme/ThemeProvider";

type ProfileScreenProps = AppStackScreenProps<"Perfil">;

interface SelectionOption<T> {
  label: string;
  value: T;
}

const FITNESS_GOAL_OPTIONS: SelectionOption<FitnessGoal>[] = [
  {
    label: "Ganhar massa muscular",
    value: "muscle_gain",
  },
  {
    label: "Aumentar força",
    value: "strength",
  },
  {
    label: "Condicionamento geral",
    value: "general_fitness",
  },
  {
    label: "Melhorar resistência",
    value: "endurance",
  },
  {
    label: "Reduzir gordura corporal",
    value: "fat_loss",
  },
];

const EXPERIENCE_LEVEL_OPTIONS: SelectionOption<ExperienceLevel>[] = [
  {
    label: "Iniciante",
    value: "beginner",
  },
  {
    label: "Intermediário",
    value: "intermediate",
  },
  {
    label: "Avançado",
    value: "advanced",
  },
];

const WEEKLY_GOAL_OPTIONS: SelectionOption<number>[] = [
  { label: "1 treino por semana", value: 1 },
  { label: "2 treinos por semana", value: 2 },
  { label: "3 treinos por semana", value: 3 },
  { label: "4 treinos por semana", value: 4 },
  { label: "5 treinos por semana", value: 5 },
  { label: "6 treinos por semana", value: 6 },
  { label: "7 treinos por semana", value: 7 },
];

const DURATION_OPTIONS: SelectionOption<number>[] = [
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "45 minutos", value: 45 },
  { label: "60 minutos", value: 60 },
  { label: "75 minutos", value: 75 },
  { label: "90 minutos", value: 90 },
  { label: "120 minutos", value: 120 },
  { label: "150 minutos", value: 150 },
  { label: "180 minutos", value: 180 },
];

const MEASUREMENT_SYSTEM_OPTIONS: SelectionOption<MeasurementSystem>[] = [
  {
    label: "Métrico — kg / km",
    value: "metric",
  },
  {
    label: "Imperial — lb / mi",
    value: "imperial",
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "FM";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getOptionLabel<T>(
  options: SelectionOption<T>[],
  value: T | null,
): string {
  if (value === null) {
    return "Não definido";
  }

  return (
    options.find((option) => option.value === value)?.label ?? "Não definido"
  );
}

function formatMemberSince(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Membro do FitMap";
  }

  return `Membro desde ${new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(date)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return "Não foi possível conectar ao servidor.";
    }

    if (error.message === "The request timed out.") {
      return "A conexão com o servidor demorou mais que o esperado.";
    }

    if (error.message) {
      return error.message;
    }
  }

  return "Não foi possível concluir a solicitação.";
}

export default function ProfileScreen(_: ProfileScreenProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("ProfileScreen must be rendered inside AuthProvider.");
  }

  const { logout, runAuthenticatedRequest, updateAuthenticatedUser } = auth;

  const { theme, preference, setPreference } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback((): Promise<UserProfile> => {
    return runAuthenticatedRequest((accessToken) => getProfile(accessToken));
  }, [runAuthenticatedRequest]);

  useEffect(() => {
    let active = true;

    fetchProfile()
      .then((loadedProfile) => {
        if (!active) {
          return;
        }

        setProfile(loadedProfile);
        setName(loadedProfile.name);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchProfile]);

  const retryLoadProfile = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedProfile = await fetchProfile();

      setProfile(loadedProfile);
      setName(loadedProfile.name);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  const persistProfileUpdate = useCallback(
    async (input: UpdateProfileInput): Promise<UserProfile | null> => {
      setSaving(true);
      setError(null);

      try {
        const updatedProfile = await runAuthenticatedRequest((accessToken) =>
          updateProfile(accessToken, input),
        );

        setProfile(updatedProfile);
        setName(updatedProfile.name);

        updateAuthenticatedUser({
          id: updatedProfile.id,
          name: updatedProfile.name,
          email: updatedProfile.email,
          createdAt: updatedProfile.createdAt,
        });

        return updatedProfile;
      } catch (updateError) {
        const message = getErrorMessage(updateError);

        setError(message);

        Alert.alert("Não foi possível salvar", message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [runAuthenticatedRequest, updateAuthenticatedUser],
  );

  function showSelection<T>(
    title: string,
    options: SelectionOption<T>[],
    onSelect: (value: T) => void,
  ): void {
    Alert.alert(title, "Selecione uma opção.", [
      ...options.map((option) => ({
        text: option.label,
        onPress: () => {
          onSelect(option.value);
        },
      })),
      {
        text: "Cancelar",
        style: "cancel" as const,
      },
    ]);
  }

  function openFitnessGoalSelector(): void {
    showSelection("Objetivo principal", FITNESS_GOAL_OPTIONS, (value) => {
      void persistProfileUpdate({
        fitnessGoal: value,
      });
    });
  }

  function openExperienceLevelSelector(): void {
    showSelection("Nível de experiência", EXPERIENCE_LEVEL_OPTIONS, (value) => {
      void persistProfileUpdate({
        experienceLevel: value,
      });
    });
  }

  function openWeeklyGoalSelector(): void {
    showSelection("Meta semanal", WEEKLY_GOAL_OPTIONS, (value) => {
      void persistProfileUpdate({
        weeklyWorkoutGoal: value,
      });
    });
  }

  function openDurationSelector(): void {
    showSelection("Duração preferida", DURATION_OPTIONS, (value) => {
      void persistProfileUpdate({
        preferredWorkoutDurationMinutes: value,
      });
    });
  }

  function openMeasurementSystemSelector(): void {
    showSelection(
      "Sistema de unidades",
      MEASUREMENT_SYSTEM_OPTIONS,
      (value) => {
        void persistProfileUpdate({
          measurementSystem: value,
        });
      },
    );
  }

  function openAppearanceSelector(): void {
    Alert.alert("Aparência", "Escolha como o FitMap deve aparecer.", [
      {
        text: "Claro",
        onPress: () => {
          void setPreference("light");
        },
      },
      {
        text: "Escuro",
        onPress: () => {
          void setPreference("dark");
        },
      },
      {
        text: "Seguir sistema",
        onPress: () => {
          void setPreference("system");
        },
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  }

  async function saveName(): Promise<void> {
    if (!profile || saving) {
      return;
    }

    const normalizedName = name.trim().replace(/\s+/g, " ");

    if (!normalizedName) {
      Alert.alert("Nome inválido", "Informe um nome para continuar.");
      return;
    }

    if (normalizedName === profile.name) {
      setName(profile.name);
      return;
    }

    await persistProfileUpdate({
      name: normalizedName,
    });
  }

  function confirmLogout(): void {
    if (loggingOut) {
      return;
    }

    Alert.alert("Sair da conta", "Deseja encerrar sua sessão no FitMap?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void handleLogout();
        },
      },
    ]);
  }

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);

    try {
      await logout();
    } catch (logoutError) {
      Alert.alert("Não foi possível sair", getErrorMessage(logoutError));
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />

          <Text style={styles.centerStateTitle}>Carregando seu perfil</Text>

          <Text style={styles.centerStateText}>
            Estamos buscando suas preferências de treino.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.centerState}>
          <UserRound
            size={42}
            strokeWidth={1.8}
            color={theme.colors.textMuted}
          />

          <Text style={styles.centerStateTitle}>
            Não foi possível carregar seu perfil
          </Text>

          <Text style={styles.centerStateText}>
            {error ?? "Tente novamente em alguns instantes."}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void retryLoadProfile();
            }}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const completedPreferences = [
    profile.fitnessGoal,
    profile.experienceLevel,
    profile.weeklyWorkoutGoal,
    profile.preferredWorkoutDurationMinutes,
    profile.measurementSystem,
  ].filter((value) => value !== null).length;

  const completionPercentage = Math.round((completedPreferences / 5) * 100);

  const completionWidth = `${completionPercentage}%` as `${number}%`;

  const nameChanged = name.trim().replace(/\s+/g, " ") !== profile.name;

  const appearanceLabel =
    preference === "light"
      ? "Claro"
      : preference === "dark"
        ? "Escuro"
        : "Seguir sistema";

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
          </View>

          <View style={styles.profileHeaderCopy}>
            <Text style={styles.profileName}>{profile.name}</Text>

            <Text style={styles.profileEmail}>{profile.email}</Text>

            <Text style={styles.memberSince}>
              {formatMemberSince(profile.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.completionCard}>
          <View style={styles.completionTop}>
            <View>
              <Text style={styles.completionEyebrow}>PERFIL DE TREINO</Text>

              <Text style={styles.completionTitle}>
                {completionPercentage}% configurado
              </Text>
            </View>

            <View style={styles.completionBadge}>
              <Text style={styles.completionBadgeText}>
                {completedPreferences}/5
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: completionWidth,
                },
              ]}
            />
          </View>

          <Text style={styles.completionText}>
            Defina suas preferências para personalizar sua experiência no
            FitMap.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>SUA CONTA</Text>

          <Text style={styles.sectionTitle}>Informações pessoais</Text>

          <View style={styles.nameCard}>
            <Text style={styles.fieldLabel}>Nome</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              editable={!saving}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={() => {
                void saveName();
              }}
              style={styles.nameInput}
              placeholder="Seu nome"
              placeholderTextColor={theme.colors.textMuted}
            />

            {nameChanged ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => {
                  void saveName();
                }}
                style={({ pressed }) => [
                  styles.saveNameButton,
                  pressed && styles.buttonPressed,
                  saving && styles.buttonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textOnPrimary}
                  />
                ) : (
                  <Text style={styles.saveNameButtonText}>Salvar nome</Text>
                )}
              </Pressable>
            ) : null}

            <View style={styles.emailBlock}>
              <Text style={styles.fieldLabel}>E-mail</Text>

              <Text style={styles.emailValue}>{profile.email}</Text>

              <Text style={styles.fieldHint}>
                O e-mail da conta não pode ser alterado pelo perfil.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>SEU TREINO</Text>

          <Text style={styles.sectionTitle}>Preferências esportivas</Text>

          <View style={styles.settingsCard}>
            <SettingRow
              icon={
                <Target
                  size={21}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              }
              title="Objetivo principal"
              value={getOptionLabel(FITNESS_GOAL_OPTIONS, profile.fitnessGoal)}
              disabled={saving}
              onPress={openFitnessGoalSelector}
              styles={styles}
              theme={theme}
            />

            <SettingRow
              icon={
                <Gauge
                  size={21}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              }
              title="Experiência"
              value={getOptionLabel(
                EXPERIENCE_LEVEL_OPTIONS,
                profile.experienceLevel,
              )}
              disabled={saving}
              onPress={openExperienceLevelSelector}
              styles={styles}
              theme={theme}
            />

            <SettingRow
              icon={
                <Dumbbell
                  size={21}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              }
              title="Meta semanal"
              value={getOptionLabel(
                WEEKLY_GOAL_OPTIONS,
                profile.weeklyWorkoutGoal,
              )}
              disabled={saving}
              onPress={openWeeklyGoalSelector}
              styles={styles}
              theme={theme}
            />

            <SettingRow
              icon={
                <Clock3
                  size={21}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              }
              title="Duração preferida"
              value={getOptionLabel(
                DURATION_OPTIONS,
                profile.preferredWorkoutDurationMinutes,
              )}
              disabled={saving}
              onPress={openDurationSelector}
              styles={styles}
              theme={theme}
            />

            <SettingRow
              icon={
                <Ruler
                  size={21}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              }
              title="Unidades"
              value={getOptionLabel(
                MEASUREMENT_SYSTEM_OPTIONS,
                profile.measurementSystem,
              )}
              disabled={saving}
              onPress={openMeasurementSystemSelector}
              styles={styles}
              theme={theme}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>APLICATIVO</Text>

          <Text style={styles.sectionTitle}>Preferências</Text>

          <View style={styles.settingsCard}>
            <SettingRow
              icon={
                <Palette
                  size={21}
                  strokeWidth={2.2}
                  color={theme.colors.primary}
                />
              }
              title="Aparência"
              value={appearanceLabel}
              onPress={openAppearanceSelector}
              styles={styles}
              theme={theme}
              last
            />
          </View>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          disabled={loggingOut}
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.buttonPressed,
            loggingOut && styles.buttonDisabled,
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={theme.colors.danger} />
          ) : (
            <>
              <LogOut size={19} strokeWidth={2.2} color={theme.colors.danger} />

              <Text style={styles.logoutButtonText}>Sair da conta</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footerText}>
          FitMap • Seu treino, suas escolhas.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  last?: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useAppTheme>["theme"];
}

function SettingRow({
  icon,
  title,
  value,
  onPress,
  disabled = false,
  last = false,
  styles,
  theme,
}: SettingRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        !last && styles.settingRowBorder,
        pressed && styles.settingRowPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.settingIcon}>{icon}</View>

      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>

        <Text
          style={[
            styles.settingValue,
            value === "Não definido" && styles.settingValueEmpty,
          ]}
        >
          {value}
        </Text>
      </View>

      <ChevronRight
        size={19}
        strokeWidth={2.2}
        color={theme.colors.textMuted}
      />
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing["4xl"],
    },

    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing["2xl"],
    },

    centerStateTitle: {
      marginTop: theme.spacing.lg,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      textAlign: "center",
    },

    centerStateText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
      textAlign: "center",
    },

    retryButton: {
      marginTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: 13,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    retryButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },

    avatar: {
      width: 76,
      height: 76,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },

    avatarText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: 27,
      letterSpacing: -0.6,
    },

    profileHeaderCopy: {
      flex: 1,
    },

    profileName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
    },

    profileEmail: {
      marginTop: 2,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    memberSince: {
      marginTop: 5,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    completionCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing["3xl"],
    },

    completionTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },

    completionEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.4,
    },

    completionTitle: {
      marginTop: 3,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
    },

    completionBadge: {
      minWidth: 48,
      paddingHorizontal: 11,
      paddingVertical: 7,
      alignItems: "center",
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    completionBadgeText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    progressTrack: {
      height: 8,
      marginTop: theme.spacing.lg,
      overflow: "hidden",
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    progressFill: {
      height: "100%",
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primary,
    },

    completionText: {
      marginTop: theme.spacing.md,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    section: {
      marginBottom: theme.spacing["3xl"],
    },

    sectionEyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.6,
      marginBottom: 3,
    },

    sectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      marginBottom: theme.spacing.lg,
    },

    nameCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
    },

    fieldLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
      marginBottom: 7,
    },

    nameInput: {
      minHeight: 50,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 11,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSecondary,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.body,
    },

    saveNameButton: {
      minHeight: 44,
      marginTop: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    saveNameButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    emailBlock: {
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    emailValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.semibold,
      fontSize: theme.typography.size.body,
    },

    fieldHint: {
      marginTop: 5,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },

    settingsCard: {
      overflow: "hidden",
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },

    settingRow: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },

    settingRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },

    settingRowPressed: {
      backgroundColor: theme.colors.surfaceSecondary,
    },

    settingIcon: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: theme.colors.primarySoft,
    },

    settingCopy: {
      flex: 1,
    },

    settingTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    settingValue: {
      marginTop: 3,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    settingValueEmpty: {
      color: theme.colors.textMuted,
    },

    inlineError: {
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },

    inlineErrorText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    logoutButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.surface,
    },

    logoutButtonText: {
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    buttonPressed: {
      opacity: 0.72,
    },

    buttonDisabled: {
      opacity: 0.55,
    },

    footerText: {
      marginTop: theme.spacing.xl,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
      textAlign: "center",
    },
  });
}
