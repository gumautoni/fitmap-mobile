import { useReducedMotion } from "../hooks/useReducedMotion";
import MotionScrollView from "../components/MotionScrollView";
import { lightMetricDetail, lightSurfaceDepth } from "../theme/surfaces";
import ScreenGradient from "../components/ScreenGradient";
import { useFocusEffect } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Dumbbell,
  Images,
  Maximize2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BmiCard from "../components/BmiCard";
import BodyMetricsSection from "../components/BodyMetricsSection";
import FitnessGoalsSection from "../components/FitnessGoalsSection";
import ProgressPhotoCapture from "../components/ProgressPhotoCapture";
import ProgressPhotoViewer from "../components/ProgressPhotoViewer";
import { AuthContext } from "../context/AuthContext";
import { ApiClientError } from "../services/apiClient";
import {
  getExercisePerformance,
  getProgressPhotosPage,
  getProgressPhotoSource,
  getProgressStatistics,
  uploadProgressPhoto,
  type BasicProgressStatistics,
  type ExercisePerformance,
  type ExercisePerformancePoint,
  type ProgressPhoto,
} from "../services/progress";
import { useAppTheme } from "../theme/ThemeProvider";

const MAX_PROGRESS_PHOTO_WIDTH = 2000;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "invalid_access_token":
        return "Sua sessão expirou. Entre novamente.";

      case "invalid_progress_photo":
        return "A imagem selecionada não pôde ser enviada.";

      case "media_storage_unavailable":
        return "O armazenamento privado de fotos está indisponível no momento.";

      default:
        break;
    }
  }

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

  return "Não foi possível carregar seus dados de progresso.";
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

function formatLoadSummary(point: ExercisePerformancePoint): string {
  if (point.maxLoads.length === 0) {
    return "Carga não registrada";
  }

  return point.maxLoads
    .map((load) => `${load.maxLoad} ${load.loadUnit}`)
    .join(" • ");
}

function getLoadEvolution(performance: ExercisePerformance): string | null {
  const firstPoint = performance.points[0];
  const lastPoint = performance.points.at(-1);

  if (!firstPoint || !lastPoint) {
    return null;
  }

  const comparisons = lastPoint.maxLoads
    .map((latestLoad) => {
      const initialLoad = firstPoint.maxLoads.find(
        (load) => load.loadUnit === latestLoad.loadUnit,
      );

      if (!initialLoad) {
        return null;
      }

      return `${initialLoad.maxLoad} ${initialLoad.loadUnit} → ${latestLoad.maxLoad} ${latestLoad.loadUnit}`;
    })
    .filter((value): value is string => value !== null);

  return comparisons.length > 0 ? comparisons.join(" • ") : null;
}

async function normalizeProgressPhoto(
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);

  if (asset.width > MAX_PROGRESS_PHOTO_WIDTH) {
    context.resize({
      width: MAX_PROGRESS_PHOTO_WIDTH,
      height: null,
    });
  }

  const renderedImage = await context.renderAsync();

  const normalizedImage = await renderedImage.saveAsync({
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return normalizedImage.uri;
}

type PhotoRequestKind = "refresh" | "more" | "restart" | null;

interface PhotoPageError {
  message: string;
  restart: boolean;
}

function mergeUniquePhotos(
  current: ProgressPhoto[],
  incoming: ProgressPhoto[],
): ProgressPhoto[] {
  const seen = new Set<string>();
  const result: ProgressPhoto[] = [];

  for (const photo of [...current, ...incoming]) {
    if (!seen.has(photo.id)) {
      seen.add(photo.id);
      result.push(photo);
    }
  }

  return result;
}

export default function ProgressScreen() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("ProgressScreen must be rendered inside AuthProvider.");
  }

  const { accessToken, runAuthenticatedRequest } = auth;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [statistics, setStatistics] = useState<BasicProgressStatistics | null>(
    null,
  );
  const [performance, setPerformance] = useState<ExercisePerformance[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(
    null,
  );
  const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [goalsRefreshVersion, setGoalsRefreshVersion] = useState(0);
  const [bmiRefreshVersion, setBmiRefreshVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<PhotoPageError | null>(null);

  const focusedRef = useRef(false);
  const focusGeneration = useRef(0);
  const requestGeneration = useRef(0);
  const requestKindRef = useRef<PhotoRequestKind>(null);
  const cursorRef = useRef<string | null>(null);
  const seenCursors = useRef(new Set<string>());
  const uploadBusyRef = useRef(false);
  const uploadsDuringRefresh = useRef<ProgressPhoto[]>([]);

  const loadProgress = useCallback(async (): Promise<void> => {
    if (!focusedRef.current || requestKindRef.current !== null) {
      return;
    }

    const generation = ++requestGeneration.current;

    requestKindRef.current = "refresh";
    uploadsDuringRefresh.current = [];

    setLoading(true);
    setError(null);
    setPageLoading(false);
    setPageError(null);

    try {
      const [loadedStatistics, loadedPerformance, page] =
        await runAuthenticatedRequest((requestAccessToken) =>
          Promise.all([
            getProgressStatistics(requestAccessToken),
            getExercisePerformance(requestAccessToken),
            getProgressPhotosPage(requestAccessToken),
          ]),
        );

      if (generation !== requestGeneration.current) {
        return;
      }

      if (page.nextCursor !== null && page.items.length === 0) {
        throw new Error("A paginação das fotos não avançou.");
      }

      setStatistics(loadedStatistics);
      setPerformance(loadedPerformance);

      cursorRef.current = page.nextCursor;
      seenCursors.current = new Set(
        page.nextCursor === null ? [] : [page.nextCursor],
      );

      setNextCursor(page.nextCursor);
      setPhotos(mergeUniquePhotos(uploadsDuringRefresh.current, page.items));
    } catch (loadError: unknown) {
      if (generation === requestGeneration.current) {
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (generation === requestGeneration.current) {
        requestKindRef.current = null;
        uploadsDuringRefresh.current = [];
        setLoading(false);
      }
    }
  }, [runAuthenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;

      setUploadingPhoto(false);
      setPhotoError(null);
      setSelectedPhoto(null);

      void loadProgress();

      return () => {
        focusedRef.current = false;
        focusGeneration.current += 1;
        requestGeneration.current += 1;
        requestKindRef.current = null;
        uploadBusyRef.current = false;
        uploadsDuringRefresh.current = [];
      };
    }, [loadProgress]),
  );

  async function loadMorePhotos(restart = false): Promise<void> {
    const cursor = cursorRef.current;

    if (
      !focusedRef.current ||
      requestKindRef.current !== null ||
      (!restart && cursor === null)
    ) {
      return;
    }

    const generation = ++requestGeneration.current;

    requestKindRef.current = restart ? "restart" : "more";

    if (restart) {
      uploadsDuringRefresh.current = [];
    }

    setPageLoading(true);
    setPageError(null);

    try {
      const page = await runAuthenticatedRequest((accessToken) =>
        restart
          ? getProgressPhotosPage(accessToken)
          : getProgressPhotosPage(accessToken, { cursor }),
      );

      if (generation !== requestGeneration.current) {
        return;
      }

      if (
        page.nextCursor !== null &&
        (page.items.length === 0 ||
          (!restart && seenCursors.current.has(page.nextCursor)))
      ) {
        setPageError({
          message: "A paginação não avançou. Atualize suas fotos.",
          restart: true,
        });
        return;
      }

      cursorRef.current = page.nextCursor;
      setNextCursor(page.nextCursor);

      if (restart) {
        seenCursors.current.clear();

        setPhotos(mergeUniquePhotos(uploadsDuringRefresh.current, page.items));
      } else {
        setPhotos((current) => mergeUniquePhotos(current, page.items));
      }

      if (page.nextCursor !== null) {
        seenCursors.current.add(page.nextCursor);
      }
    } catch (loadError: unknown) {
      if (generation === requestGeneration.current) {
        const invalidCursor =
          loadError instanceof ApiClientError &&
          loadError.code === "invalid_pagination_cursor";

        setPageError({
          message: invalidCursor
            ? "Suas fotos mudaram. Atualize a galeria para continuar."
            : getErrorMessage(loadError),
          restart: restart || invalidCursor,
        });
      }
    } finally {
      if (generation === requestGeneration.current) {
        requestKindRef.current = null;
        uploadsDuringRefresh.current = [];
        setPageLoading(false);
      }
    }
  }

  async function handleSaveProgressPhoto(
    asset: ImagePicker.ImagePickerAsset,
  ): Promise<boolean> {
    if (!focusedRef.current || uploadBusyRef.current) {
      return false;
    }

    const generation = focusGeneration.current;

    uploadBusyRef.current = true;
    setPhotoError(null);
    setUploadingPhoto(true);

    try {
      const normalizedUri = await normalizeProgressPhoto(asset);

      if (generation !== focusGeneration.current) {
        return false;
      }

      const uploadedPhoto = await runAuthenticatedRequest(
        (requestAccessToken) =>
          uploadProgressPhoto(requestAccessToken, {
            uri: normalizedUri,
            mediaType: "image/jpeg",
            fileName: `progress-${Date.now()}.jpg`,
            recordedAt: new Date().toISOString(),
          }),
      );

      if (generation !== focusGeneration.current) {
        return false;
      }

      if (
        requestKindRef.current === "refresh" ||
        requestKindRef.current === "restart"
      ) {
        uploadsDuringRefresh.current = mergeUniquePhotos(
          [uploadedPhoto],
          uploadsDuringRefresh.current,
        );
      }

      setPhotos((currentPhotos) =>
        mergeUniquePhotos([uploadedPhoto], currentPhotos),
      );

      Alert.alert(
        "Foto adicionada",
        "Sua foto de progresso foi salva de forma privada.",
      );

      return true;
    } catch (uploadError) {
      if (generation !== focusGeneration.current) {
        return false;
      }

      const message = getErrorMessage(uploadError);

      setPhotoError(message);
      Alert.alert("Não foi possível adicionar a foto", message);

      return false;
    } finally {
      if (generation === focusGeneration.current) {
        uploadBusyRef.current = false;
        setUploadingPhoto(false);
      }
    }
  }

  if (loading && !statistics) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ScreenGradient theme={theme} />
        <View style={styles.centerState}>
          <ActivityIndicator
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Carregando seu progresso"
            accessibilityState={{ busy: true }}
            size="large"
            color={theme.colors.primary}
          />

          <Text style={styles.centerTitle}>Carregando seu progresso</Text>

          <Text style={styles.centerText}>
            Analisando seus treinos concluídos e registros de desempenho.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !statistics) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ScreenGradient theme={theme} />
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <AlertCircle
              size={32}
              strokeWidth={2}
              color={theme.colors.danger}
            />
          </View>

          <Text style={styles.centerTitle}>
            Não foi possível carregar seu progresso
          </Text>

          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.centerText}
          >
            {error}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar progresso novamente"
            accessibilityState={{ busy: loading, disabled: loading }}
            disabled={loading}
            onPress={() => {
              void loadProgress();
            }}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <RefreshCw
              size={18}
              strokeWidth={2.2}
              color={theme.colors.textOnPrimary}
            />

            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!statistics) {
    return null;
  }

  const datedPhotos = photos.map((photo) => ({
    photo,
    dateLabel: formatDate(photo.recordedAt),
  }));

  const photoDateCounts = new Map<string, number>();

  for (const { dateLabel } of datedPhotos) {
    photoDateCounts.set(dateLabel, (photoDateCounts.get(dateLabel) ?? 0) + 1);
  }

  const photoDatePositions = new Map<string, number>();

  const photoEntries = datedPhotos.map(({ photo, dateLabel }) => {
    const position = (photoDatePositions.get(dateLabel) ?? 0) + 1;
    photoDatePositions.set(dateLabel, position);

    const count = photoDateCounts.get(dateLabel) ?? 1;
    const baseLabel = `Ampliar foto de progresso registrada em ${dateLabel}`;

    return {
      photo,
      dateLabel,
      accessibilityLabel:
        count > 1
          ? `${baseLabel}, foto ${position} de ${count} nesta data`
          : baseLabel,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScreenGradient theme={theme} />
      <MotionScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACOMPANHAMENTO</Text>

          <Text accessibilityRole="header" style={styles.title}>
            Meu progresso
          </Text>

          <Text style={styles.subtitle}>
            Acompanhe sua frequência de treino, evolução de desempenho e seus
            registros visuais privados.
          </Text>

          {loading ? (
            <Text
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Atualizando seu progresso"
              accessibilityState={{ busy: true }}
              accessibilityLiveRegion="polite"
              style={styles.subtitle}
            >
              Atualizando seu progresso...
            </Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <AlertCircle
              size={18}
              strokeWidth={2}
              color={theme.colors.danger}
            />

            <View style={{ flex: 1 }}>
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.inlineErrorText}
              >
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar progresso novamente"
                accessibilityState={{ busy: loading, disabled: loading }}
                disabled={loading}
                onPress={() => void loadProgress()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>VISÃO GERAL</Text>

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Atividade de treino
            </Text>
          </View>

          <Activity size={23} strokeWidth={2.2} color={theme.colors.primary} />
        </View>

        <View style={styles.metricsGrid}>
          <View
            accessible
            accessibilityLabel={`Treinos concluídos: ${statistics.completedWorkouts}`}
            style={styles.metricCard}
          >
            <View
              style={styles.metricIcon}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Dumbbell
                size={21}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.metricValue}>
              {statistics.completedWorkouts}
            </Text>

            <Text style={styles.metricLabel}>Treinos concluídos</Text>
          </View>

          <View
            accessible
            accessibilityLabel={`Treinos concluídos nos últimos 7 dias: ${statistics.completedWorkoutsLast7Days}`}
            style={styles.metricCard}
          >
            <View
              style={styles.metricIcon}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <CalendarDays
                size={21}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.metricValue}>
              {statistics.completedWorkoutsLast7Days}
            </Text>

            <Text style={styles.metricLabel}>Últimos 7 dias</Text>
          </View>

          <View
            accessible
            accessibilityLabel={`Treinos concluídos nos últimos 30 dias: ${statistics.completedWorkoutsLast30Days}`}
            style={styles.metricCard}
          >
            <View
              style={styles.metricIcon}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Activity
                size={21}
                strokeWidth={2.2}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.metricValue}>
              {statistics.completedWorkoutsLast30Days}
            </Text>

            <Text style={styles.metricLabel}>Últimos 30 dias</Text>
          </View>

          <View
            accessible
            accessibilityLabel={`Dias de treino em 30 dias: ${statistics.trainingDaysLast30Days}`}
            style={styles.metricCard}
          >
            <View
              style={[styles.metricIcon, styles.metricIconTeal]}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <TrendingUp
                size={21}
                strokeWidth={2.2}
                color={theme.colors.techAccent}
              />
            </View>
            <Text style={[styles.metricValue, styles.metricValueTeal]}>
              {statistics.trainingDaysLast30Days}
            </Text>

            <Text style={styles.metricLabel}>Dias de treino em 30 dias</Text>
          </View>
        </View>

        <View
          accessible
          accessibilityLabel={`Séries realmente realizadas: ${statistics.totalPerformedSets}`}
          style={styles.setsCard}
        >
          <View style={styles.setsIcon}>
            <Dumbbell
              size={23}
              strokeWidth={2.2}
              color={theme.colors.primary}
            />
          </View>

          <View style={styles.setsCopy}>
            <Text style={styles.setsValue}>
              {statistics.totalPerformedSets}
            </Text>

            <Text style={styles.setsLabel}>Séries realmente realizadas</Text>
          </View>
        </View>

        {statistics.completedWorkouts === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <CalendarDays
                size={30}
                strokeWidth={1.9}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Seu progresso começa no primeiro treino
            </Text>

            <Text style={styles.emptyText}>
              Quando você concluir uma execução, os dados reais desse treino
              serão utilizados para compor seus indicadores.
            </Text>
          </View>
        ) : null}

        <BmiCard refreshVersion={bmiRefreshVersion} />

        <BodyMetricsSection
          onMetricSaved={() => setGoalsRefreshVersion((current) => current + 1)}
          onWeightSaved={() => {
            setBmiRefreshVersion((current) => current + 1);
          }}
        />

        <FitnessGoalsSection refreshVersion={goalsRefreshVersion} />

        <View style={styles.photoSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>REGISTRO VISUAL</Text>

              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Fotos de progresso
              </Text>
            </View>

            <Images size={23} strokeWidth={2.2} color={theme.colors.primary} />
          </View>

          <Text style={styles.sectionDescription}>
            Registre sua evolução visual independentemente da conclusão de um
            treino.
          </Text>

          <View style={styles.privacyNotice}>
            <ShieldCheck
              size={18}
              strokeWidth={2.2}
              color={theme.colors.success}
            />

            <Text style={styles.privacyNoticeText}>
              Suas fotos são privadas e ficam disponíveis somente na sua conta.
            </Text>
          </View>

          {photoError ? (
            <View style={styles.inlineError}>
              <AlertCircle
                size={18}
                strokeWidth={2}
                color={theme.colors.danger}
              />

              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.inlineErrorText}
              >
                {photoError}
              </Text>
            </View>
          ) : null}

          <ProgressPhotoCapture
            uploading={uploadingPhoto}
            onSave={handleSaveProgressPhoto}
          />

          {loading && photos.length === 0 ? (
            <View style={styles.photoEmptyCard}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Atualizando suas fotos"
                accessibilityState={{ busy: true }}
                style={styles.photoEmptyText}
                accessibilityLiveRegion="polite"
              >
                Atualizando suas fotos...
              </Text>
            </View>
          ) : error && photos.length === 0 ? (
            <View style={styles.photoEmptyCard}>
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.photoEmptyText}
              >
                Não foi possível confirmar seus registros visuais.
              </Text>
            </View>
          ) : photos.length === 0 ? (
            <View style={styles.photoEmptyCard}>
              <View style={styles.photoEmptyIcon}>
                <Images
                  size={30}
                  strokeWidth={1.9}
                  color={theme.colors.primary}
                />
              </View>

              <Text
                accessibilityLiveRegion="polite"
                style={styles.photoEmptyTitle}
              >
                Nenhuma foto registrada
              </Text>

              <Text style={styles.photoEmptyText}>
                Adicione uma foto para começar seu histórico visual de
                progresso.
              </Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {photoEntries.map(({ photo, dateLabel, accessibilityLabel }) => (
                <View key={photo.id} style={styles.photoCard}>
                  {accessToken ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={accessibilityLabel}
                      accessibilityHint="Abre a imagem inteira em tela cheia"
                      onPress={() => setSelectedPhoto(photo)}
                      style={({ pressed }) => [
                        styles.photoThumbnailButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Image
                        source={getProgressPhotoSource(accessToken, photo.id)}
                        style={styles.progressPhoto}
                        resizeMode="cover"
                        accessible={false}
                      />

                      <View style={styles.photoZoomHint} pointerEvents="none">
                        <Maximize2 size={17} strokeWidth={2} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  ) : (
                    <View style={styles.photoUnavailable}>
                      <Images
                        size={26}
                        strokeWidth={1.9}
                        color={theme.colors.textMuted}
                      />
                    </View>
                  )}

                  <View style={styles.photoMeta}>
                    <Text style={styles.photoDate}>{dateLabel}</Text>

                    <Text style={styles.photoPrivacy}>Privada</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {nextCursor !== null || pageError !== null ? (
            <View>
              {pageError ? (
                <Text
                  accessibilityRole="alert"
                  style={styles.inlineErrorText}
                  accessibilityLiveRegion="polite"
                >
                  {pageError.message}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  pageError
                    ? "Tentar carregar mais fotos novamente"
                    : "Carregar mais fotos"
                }
                accessibilityState={{
                  disabled: loading || pageLoading,
                  busy: pageLoading,
                }}
                disabled={loading || pageLoading}
                onPress={() => void loadMorePhotos(pageError?.restart ?? false)}
                style={({ pressed }) => [
                  styles.retryButton,
                  (pressed || loading || pageLoading) && styles.buttonPressed,
                ]}
              >
                {pageLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textOnPrimary}
                  />
                ) : null}
                <Text style={styles.retryButtonText}>
                  {pageLoading
                    ? "Carregando fotos..."
                    : pageError
                      ? "Tentar novamente"
                      : "Carregar mais fotos"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.performanceSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>DESEMPENHO</Text>

              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Evolução por exercício
              </Text>
            </View>

            <TrendingUp
              size={23}
              strokeWidth={2.2}
              color={theme.colors.primary}
            />
          </View>

          <Text style={styles.sectionDescription}>
            A evolução aparece somente quando existe histórico suficiente do
            mesmo exercício em treinos concluídos.
          </Text>

          {performance.length === 0 ? (
            <View style={styles.performanceEmptyCard}>
              <TrendingUp
                size={29}
                strokeWidth={1.9}
                color={theme.colors.textMuted}
              />

              <Text
                accessibilityLiveRegion="polite"
                style={styles.performanceEmptyTitle}
              >
                Ainda não há evolução suficiente
              </Text>

              <Text style={styles.performanceEmptyText}>
                Continue registrando suas execuções. Um exercício precisa ter
                histórico em mais de um treino concluído para aparecer aqui.
              </Text>
            </View>
          ) : (
            <View style={styles.performanceList}>
              {performance.map((exercise) => {
                const firstPoint = exercise.points[0];
                const latestPoint = exercise.points.at(-1);
                const loadEvolution = getLoadEvolution(exercise);

                if (!firstPoint || !latestPoint) {
                  return null;
                }

                return (
                  <View
                    key={exercise.exerciseId}
                    style={styles.performanceCard}
                  >
                    <View style={styles.performanceCardHeader}>
                      <View style={styles.performanceIcon}>
                        <Dumbbell
                          size={21}
                          strokeWidth={2.1}
                          color={theme.colors.primary}
                        />
                      </View>

                      <View style={styles.performanceHeaderCopy}>
                        <Text
                          accessibilityRole="header"
                          style={styles.exerciseName}
                        >
                          {exercise.exerciseName}
                        </Text>

                        <Text style={styles.exerciseSessions}>
                          {exercise.points.length} execuções comparáveis
                        </Text>
                      </View>
                    </View>

                    <View style={styles.performanceDivider} />

                    <View
                      accessible
                      accessibilityLabel={`${exercise.exerciseName}: primeiro registro, ${formatDate(firstPoint.completedAt)}`}
                      style={styles.performanceRow}
                    >
                      <Text style={styles.performanceLabel}>
                        Primeiro registro
                      </Text>

                      <Text style={styles.performanceValue}>
                        {formatDate(firstPoint.completedAt)}
                      </Text>
                    </View>

                    <View
                      accessible
                      accessibilityLabel={`${exercise.exerciseName}: registro mais recente, ${formatDate(latestPoint.completedAt)}`}
                      style={styles.performanceRow}
                    >
                      <Text style={styles.performanceLabel}>
                        Registro mais recente
                      </Text>

                      <Text style={styles.performanceValue}>
                        {formatDate(latestPoint.completedAt)}
                      </Text>
                    </View>

                    <View
                      accessible
                      accessibilityLabel={`${exercise.exerciseName}: séries realizadas, ${latestPoint.performedSets}`}
                      style={styles.performanceRow}
                    >
                      <Text style={styles.performanceLabel}>
                        Séries realizadas
                      </Text>

                      <Text style={styles.performanceValue}>
                        {latestPoint.performedSets}
                      </Text>
                    </View>

                    <View
                      accessible
                      accessibilityLabel={`${exercise.exerciseName}: repetições registradas, ${latestPoint.totalRepetitions}`}
                      style={styles.performanceRow}
                    >
                      <Text style={styles.performanceLabel}>
                        Repetições registradas
                      </Text>

                      <Text style={styles.performanceValue}>
                        {latestPoint.totalRepetitions}
                      </Text>
                    </View>

                    <View style={styles.loadBlock}>
                      <View
                        accessible
                        accessibilityLabel={`${exercise.exerciseName}: carga máxima no registro mais recente, ${formatLoadSummary(latestPoint)}`}
                      >
                        <Text style={styles.loadLabel}>
                          Carga máxima no registro mais recente
                        </Text>

                        <Text style={styles.loadValue}>
                          {formatLoadSummary(latestPoint)}
                        </Text>
                      </View>

                      {loadEvolution ? (
                        <View
                          accessible
                          accessibilityLabel={`Evolução de carga de ${exercise.exerciseName}: ${loadEvolution.replace(/ → /g, " para ").replace(/ • /g, "; ")}`}
                          style={styles.evolutionBadge}
                        >
                          <ArrowRight
                            size={15}
                            strokeWidth={2.2}
                            color={theme.colors.primary}
                          />

                          <Text style={styles.evolutionText}>
                            {loadEvolution}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </MotionScrollView>

      {selectedPhoto && accessToken ? (
        <ProgressPhotoViewer
          source={getProgressPhotoSource(accessToken, selectedPhoto.id)}
          dateLabel={formatDate(selectedPhoto.recordedAt)}
          reduceMotion={reduceMotion}
          onClose={() => setSelectedPhoto(null)}
        />
      ) : null}
    </SafeAreaView>
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
      backgroundColor:
        theme.mode === "light" ? "transparent" : theme.colors.background,
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

    stateIcon: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    centerTitle: {
      marginTop: theme.spacing.lg,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
      lineHeight: theme.typography.lineHeight.sectionTitle,
      textAlign: "center",
    },

    centerText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
      textAlign: "center",
    },

    retryButton: {
      minHeight: 48,
      minWidth: 48,
      marginTop: theme.spacing.xl,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
    },

    retryButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    buttonPressed: {
      opacity: 0.72,
    },

    buttonDisabled: {
      opacity: 0.55,
    },

    header: {
      marginBottom: theme.spacing.xl,
    },

    eyebrow: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: 10,
      letterSpacing: 1.6,
      marginBottom: 4,
    },

    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.screenTitle,
      lineHeight: theme.typography.lineHeight.screenTitle,
      letterSpacing: -0.7,
    },

    subtitle: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },

    inlineError: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    inlineErrorText: {
      flex: 1,
      color: theme.colors.danger,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
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
    },

    sectionDescription: {
      marginTop: -theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },

    metricCard: {
      width: "47.8%",
      minHeight: 146,
      justifyContent: "space-between",
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      ...lightSurfaceDepth(theme),
      ...lightMetricDetail(theme),
    },

    metricIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primarySoft,
    },
    metricIconTeal: {
      backgroundColor: theme.mode === "light" ? "#E0F7F3" : "#173630",
    },
    metricValueTeal: {
      color: theme.colors.techAccent,
    },
    metricValue: {
      marginTop: theme.spacing.sm,
      fontVariant: ["tabular-nums"],
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.metric,
      lineHeight: theme.typography.lineHeight.metric,
    },

    metricLabel: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    setsCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing["2xl"],
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      ...lightSurfaceDepth(theme, "featured"),
    },

    setsIcon: {
      width: 52,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },

    setsCopy: {
      flex: 1,
    },

    setsValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.sectionTitle,
    },

    setsLabel: {
      marginTop: 3,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
    },

    emptyCard: {
      alignItems: "center",
      marginBottom: theme.spacing["2xl"],
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing["2xl"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    emptyIcon: {
      width: 62,
      height: 62,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.lg,
      borderRadius: 20,
      backgroundColor: theme.colors.primarySoft,
    },

    emptyTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.extrabold,
      fontSize: theme.typography.size.cardTitle,
      lineHeight: theme.typography.lineHeight.cardTitle,
      textAlign: "center",
    },

    emptyText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    photoSection: {
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing["2xl"],
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    privacyNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },

    privacyNoticeText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
    },

    addPhotoButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.primary,
    },

    addPhotoButtonText: {
      color: theme.colors.textOnPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    photoEmptyCard: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing["2xl"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },

    photoEmptyIcon: {
      width: 62,
      height: 62,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.lg,
      borderRadius: 20,
      backgroundColor: theme.colors.primarySoft,
    },

    photoEmptyTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyLarge,
      textAlign: "center",
    },

    photoEmptyText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },

    photoCard: {
      width: "47.8%",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },

    progressPhoto: {
      width: "100%",
      aspectRatio: 0.82,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    photoThumbnailButton: {
      width: "100%",
      minHeight: 48,
      minWidth: 48,
      position: "relative",
    },

    photoZoomHint: {
      position: "absolute",
      right: 9,
      top: 9,
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: "rgba(5, 12, 28, 0.72)",
    },

    photoUnavailable: {
      width: "100%",
      aspectRatio: 0.82,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceSecondary,
    },

    photoMeta: {
      padding: theme.spacing.md,
    },

    photoDate: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
    },

    photoPrivacy: {
      marginTop: 3,
      color: theme.colors.success,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    performanceSection: {
      paddingTop: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },

    performanceEmptyCard: {
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing["2xl"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      ...lightSurfaceDepth(theme),
    },

    performanceEmptyTitle: {
      marginTop: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
      textAlign: "center",
    },

    performanceEmptyText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
      lineHeight: theme.typography.lineHeight.small,
      textAlign: "center",
    },

    performanceList: {
      gap: theme.spacing.md,
    },

    performanceCard: {
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      ...lightSurfaceDepth(theme),
    },

    performanceCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    performanceIcon: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: theme.colors.primarySoft,
    },

    performanceHeaderCopy: {
      flex: 1,
    },

    exerciseName: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.bodyLarge,
    },

    exerciseSessions: {
      marginTop: 3,
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    performanceDivider: {
      height: 1,
      marginVertical: theme.spacing.lg,
      backgroundColor: theme.colors.divider,
    },

    performanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },

    performanceLabel: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.size.small,
    },

    performanceValue: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.small,
      textAlign: "right",
    },

    loadBlock: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
    },

    loadLabel: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.size.caption,
    },

    loadValue: {
      marginTop: 4,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.body,
    },

    evolutionBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: theme.spacing.sm,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primarySoft,
    },

    evolutionText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontFamily.bold,
      fontSize: theme.typography.size.caption,
    },
  });
}
