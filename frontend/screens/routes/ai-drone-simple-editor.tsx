/**
 * AI Drone — basit dikey video editörü (web ai-drone-video-editor + drone-editor portrait).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { MobileAiScreenShell } from "../../components/app/MobileAiScreenHeader";
import ParcelSearchModal from "../../components/ParcelSearchModal";
import { PortraitVideoFrame } from "../../components/ai-drone-simple/PortraitVideoFrame";
import { PortraitVideoPlayer } from "../../components/ai-drone-simple/PortraitVideoPlayer";
import {
  DroneMusicTrackCard,
  MusicPreviewLoadingRow,
  useMusicListPreview,
} from "../../components/ai-drone-simple/DroneMusicTrackCard";
import { DroneMapCaptureModal, type DroneMapCaptureContinuePayload } from "../../components/ai-drone-simple/DroneMapCaptureModal";
import { DroneProductionPipelineSheet } from "../../components/ai-drone-simple/DroneProductionPipelinePanel";
import { DroneVideoPurchaseModal } from "../../components/ai-drone-simple/DroneVideoPurchaseModal";
import { DroneExtraScenePurchaseModal } from "../../components/ai-drone-simple/DroneExtraScenePurchaseModal";
import {
  DroneSceneStrip,
  buildSceneStripCards,
} from "../../components/ai-drone-simple/DroneSceneStrip";
import { DroneCreditActionPurchaseModal } from "../../components/ai-drone-simple/DroneCreditActionPurchaseModal";
import { CompletedDroneVideoPicker } from "../../components/ai-drone-simple/CompletedDroneVideoPicker";
import { SubtitleFontSizeRow } from "../../components/ai-drone-simple/settings/SubtitleFontSizeRow";
import { DroneMusicVolumeRow } from "../../components/ai-drone-simple/settings/DroneMusicVolumeRow";
import { SecondaryActionButton } from "../../components/ai-drone-simple/settings/SecondaryActionButton";
import { ProparcelLabelRemovalCard } from "../../components/ai-drone-simple/settings/ProparcelLabelRemovalCard";
import {
  MediaTabs,
  type MediaTabDef,
} from "../../components/ai-drone-simple/settings/MediaTabs";
import { SettingsPanel, type SettingsPanelRow } from "../../components/ai-drone-simple/settings/SettingsPanel";
import { DRONE_SETTINGS_THEME } from "../../src/constants/droneSettingsTheme";
import {
  DRONE_VIDEO_PRODUCTION_STEPS,
  MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
  userFacingPipelineDetail,
  type DroneProductionStepId,
} from "../../src/constants/aiDroneProductionPipeline";
import type { AdaParselSubmitPayload } from "../../components/AdaParselForm";
import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { storageService } from "../../services/storageService";
import { authService } from "../../services/authService";
import { creditService } from "../../services/creditService";
import { launchImageLibrary } from "react-native-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  deleteDroneEditorAnnotation,
  droneMusicFileUrl,
  droneRunwayRawPreviewVideoUrl,
  isRunwayCleanPreviewVideoUrl,
  resolveDroneRunwayPreviewVideoUrl,
  enrichDroneNarrationInputs,
  clampDroneSimpleNarrationText,
  fetchProfileUserCardInfo,
  generateRunwayNarration,
  resolveDroneNarrationInputs,
  type DroneNarrationInputs,
  getSubtitleSettings,
  musicTrackKey,
  refreshRunwayAudio,
  runwayPrepPushRef,
  runwayPrepStartSimple,
  saveNarrationDraft,
  saveSubtitleSettings,
  saveHideProparcelBrand,
  getHideProparcelBrand,
  selectMusic,
  clearMusic,
  uploadDroneMusic,
  startDroneRunwayProduction,
  startPortraitExport,
  uploadUserCardAvatar,
  upsertUserCardAnnotation,
  type DroneParcelQuery,
  type MusicTrack,
  type SubtitleSettings,
  type UserCardInfo,
  initialRunwaySlotProgressMap,
  initialRunwaySlotProgressForSlot,
  mergeRunwaySlotProgressFromPoll,
  formatRunwaySlotProgressSummary,
  toPipelineSlotProgressItems,
  toPipelineSlotProgressItemsForSlots,
  type MergedRunwaySlotProgress,
} from "../../services/aiDroneSimpleEditorService";
import { beginDronePortraitExportJob } from "../../services/dronePortraitExportJobTracker";
import {
  pollRunwayUntilDone,
  runwayProgressLabel,
  listDroneMyVideos,
  type DroneMyVideoItem,
} from "../../services/droneRunwayService";
import { droneVideoMatchesEditorMode } from "../../src/utils/droneVideoEditorMode";
import { loadJobEditorContext, resolveTkgmDataForParcel } from "../../services/hydrateDroneJobContext";
import { getDroneMusicLibrary, buildMusicSelectSettings } from "../../services/droneMusicLibraryService";
import {
  clearActiveDroneJob,
  setActiveDroneJob,
} from "../../services/droneRunwayActiveJobStorage";
import { startDroneRunwayBackgroundPoll, subscribeDroneRunwayJobReady } from "../../services/droneRunwayJobTracker";
import {
  buildCanonicalTimeline,
  buildMergeTimelineFromStripOrder,
  computeNextAppendSlot,
  defaultSceneRights,
  deleteRunwaySceneEntry,
  fetchRunwaySegments,
  finalizeSegmentTimeline,
  getSceneRights,
  maxAppendCountForSession,
  moveSceneTimelineByStep,
  countExistingScenes,
  needsExtraScenePurchaseForAppend,
  resolveEkSahneActionForCount,
  DRONE_SCENE_INITIAL_COUNT,
  DRONE_SCENE_PACKAGE_ALLOWANCE,
  preflightRunwaySegment,
  regenerateRunwaySegment,
  updateSegmentTimeline,
  type RunwaySegmentItem,
  type RunwaySegmentTimelineEntry,
  type RunwaySegmentsResponse,
  type SceneGenerationRights,
} from "../../services/droneSceneService";
import {
  buildScenePreviewSource,
  resolveScenePreviewSourceAsync,
  scenePreviewSourceToPlayerSource,
  type ScenePreviewSource,
} from "../../services/droneScenePreview";
import {
  AI_DRONE_EDITOR_THEME,
  DEFAULT_PORTRAIT_SUBTITLE,
  DEFAULT_PORTRAIT_USER_CARD_POS,
  DRONE_SIMPLE_NARRATION_TEXT_MAX,
} from "../../src/constants/aiDroneEditorTheme";
import {
  DEFAULT_USER_CARD_SCALE,
  normalizePortraitSubtitleExportFontSize,
} from "../../src/utils/portraitOverlayContract";
import {
  extractNitelikText,
} from "../../src/utils/propertyTypeUtils";
import { syncedSubtitleForTime } from "../../src/utils/droneSubtitlePreview";
import {
  fetchTkgmParcelByAdaParsel,
  formatTkgmResultSummary,
  buildParcelReferenceId,
  type TkgmParcelResponse,
} from "../../src/utils/tkgmParcelQuery";
import { formatParcelAreaM2Tr } from "../../src/utils/parcelAreaFormatTr";

type TabKey = "video" | "narration" | "music";
type PreviewMode = "none" | "scene" | "full";
type MapCaptureMode = "initial" | "new_scene";

const MEDIA_TABS: readonly MediaTabDef[] = [
  { id: "video", label: "Video", icon: "film-outline" },
  { id: "narration", label: "Seslendirme", icon: "mic-outline" },
  { id: "music", label: "Müzik", icon: "musical-notes-outline" },
];

const PROPARCEL_LABEL_CREDIT_ACTION = "proparcel_video_etiket";

function stripVideoCacheBust(url: string): string {
  return String(url || "")
    .replace(/([?&])t=\d+(?=&|$)/g, "$1")
    .replace(/[?&]$/, "");
}

type PendingProduction = {
  preparedJobId: string;
  refFrameCount: number;
  narrationText: string;
  narrCtx: DroneNarrationInputs;
  useOpenAiPreflight: boolean;
};

export default function AiDroneSimpleEditorScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ jobId?: string }>();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("video");
  const [queryVisible, setQueryVisible] = useState(false);
  const [mapCaptureVisible, setMapCaptureVisible] = useState(false);

  const [parcel, setParcel] = useState<DroneParcelQuery | null>(null);
  const [tkgmData, setTkgmData] = useState<TkgmParcelResponse | null>(null);
  const [parcelSummary, setParcelSummary] = useState("");
  const [parcelAreaM2, setParcelAreaM2] = useState("");
  const [narrationInputs, setNarrationInputs] = useState<DroneNarrationInputs | null>(null);

  const [jobId, setJobId] = useState("");
  const [videoUri, setVideoUri] = useState("");
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineVisible, setPipelineVisible] = useState(false);
  const [pipelineActiveStep, setPipelineActiveStep] = useState<DroneProductionStepId | null>(null);
  const [pipelineCompleted, setPipelineCompleted] = useState<Set<DroneProductionStepId>>(() => new Set());
  const [pipelineDetail, setPipelineDetail] = useState("");
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineSheetOpen, setPipelineSheetOpen] = useState(false);
  const [refFrameCount, setRefFrameCount] = useState(DRONE_SCENE_INITIAL_COUNT);
  const [pipelineSlotByKey, setPipelineSlotByKey] = useState<Record<string, MergedRunwaySlotProgress>>({});
  const [pipelineBackgroundMode, setPipelineBackgroundMode] = useState(false);

  const [narrationText, setNarrationText] = useState("");
  const [narrationBusy, setNarrationBusy] = useState(false);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicLoadError, setMusicLoadError] = useState("");
  const [savedMusic, setSavedMusic] = useState<MusicTrack | null>(null);
  const [pendingMusic, setPendingMusic] = useState<MusicTrack | null>(null);
  const [musicSaveBusy, setMusicSaveBusy] = useState(false);
  const [musicClearBusy, setMusicClearBusy] = useState(false);
  const [musicUploadBusy, setMusicUploadBusy] = useState(false);
  const [musicVolume, setMusicVolume] = useState(45);
  const [showUserCard, setShowUserCard] = useState(false);
  const [userCardInfo, setUserCardInfo] = useState<UserCardInfo | null>(null);
  const [userCardAnnotationId, setUserCardAnnotationId] = useState<number | string | null>(null);
  const [userCardPos, setUserCardPos] = useState(DEFAULT_PORTRAIT_USER_CARD_POS);
  const [previewPlaybackTime, setPreviewPlaybackTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [userCardBusy, setUserCardBusy] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitlePos, setSubtitlePos] = useState({
    x: DEFAULT_PORTRAIT_SUBTITLE.x,
    y: DEFAULT_PORTRAIT_SUBTITLE.y,
  });
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_PORTRAIT_SUBTITLE);
  const [exportBusy, setExportBusy] = useState(false);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>();
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [labelPurchaseVisible, setLabelPurchaseVisible] = useState(false);
  const [labelCreditCost, setLabelCreditCost] = useState<number | null>(null);
  const [labelCreditLoading, setLabelCreditLoading] = useState(false);
  const [hideProParcelBrand, setHideProParcelBrand] = useState(false);
  const [pendingProduction, setPendingProduction] = useState<PendingProduction | null>(null);
  const [readyVideosRefreshToken, setReadyVideosRefreshToken] = useState(0);

  const [sceneSegments, setSceneSegments] = useState<RunwaySegmentItem[]>([]);
  const [sceneTimeline, setSceneTimeline] = useState<RunwaySegmentTimelineEntry[]>([]);
  const [sceneRights, setSceneRights] = useState<SceneGenerationRights>(() => defaultSceneRights());
  const [mergeSelectedSlots, setMergeSelectedSlots] = useState<Set<number>>(() => new Set());
  const [activeSceneSlot, setActiveSceneSlot] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("none");
  const [sceneBusy, setSceneBusy] = useState(false);
  const [mergingScenes, setMergingScenes] = useState(false);
  const [mapCaptureMode, setMapCaptureMode] = useState<MapCaptureMode>("initial");
  const [extraScenePurchaseVisible, setExtraScenePurchaseVisible] = useState(false);
  const [sceneSegmentCacheBust, setSceneSegmentCacheBust] = useState(0);
  const [selectedSceneSegment, setSelectedSceneSegment] = useState<RunwaySegmentItem | null>(null);
  const [scenePreviewFallback, setScenePreviewFallback] = useState<ScenePreviewSource | null>(null);
  const [sceneThumbCacheBust, setSceneThumbCacheBust] = useState(0);
  const [appendSceneProduction, setAppendSceneProduction] = useState<{
    runwaySlot: number;
    cardIndex: number;
  } | null>(null);
  const [pendingNewSceneCapture, setPendingNewSceneCapture] =
    useState<DroneMapCaptureContinuePayload | null>(null);
  const videoSourceErrorAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLabelCreditLoading(true);
    void creditService.getCreditCostForAction(PROPARCEL_LABEL_CREDIT_ACTION).then((cost) => {
      if (!cancelled) {
        setLabelCreditCost(cost != null && cost >= 0 ? cost : null);
        setLabelCreditLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!jobId) {
      setHideProParcelBrand(false);
      return;
    }
    void getHideProparcelBrand(jobId).then((res) => {
      if (res.ok) setHideProParcelBrand(res.hidden);
    });
  }, [jobId]);

  const onSubtitleFontSizeChange = useCallback((fontSize: number) => {
    setSubtitleSettings((prev) => ({
      ...prev,
      fontSize: normalizePortraitSubtitleExportFontSize(fontSize),
    }));
  }, []);

  const onPressRemoveProparcelLabel = useCallback(() => {
    if (!jobId) {
      Alert.alert("Etiket", "Önce video seçin veya oluşturun.");
      return;
    }
    if (hideProParcelBrand) return;
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Bu işlem için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    setLabelPurchaseVisible(true);
  }, [jobId, hideProParcelBrand, isAuthenticated, router]);

  const onProparcelLabelPurchaseSuccess = useCallback(async (): Promise<boolean> => {
    if (!jobId) {
      Alert.alert("Etiket", "Video seçilmedi.");
      return false;
    }
    const res = await saveHideProparcelBrand(jobId, true);
    if (!res.ok) {
      Alert.alert("Etiket", res.error);
      return false;
    }
    setHideProParcelBrand(true);
    return true;
  }, [jobId]);

  const completePipelineStep = useCallback((stepId: DroneProductionStepId) => {
    setPipelineCompleted((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const goPipelineStep = useCallback((stepId: DroneProductionStepId, detail?: string) => {
    setPipelineActiveStep(stepId);
    setPipelineError("");
    if (detail !== undefined) {
      setPipelineDetail(userFacingPipelineDetail(detail, "İşleniyor…"));
    }
  }, []);

  const markEditorVideoReady = useCallback(() => {
    goPipelineStep("ready", "Önizleme hazır");
    setPipelineCompleted(
      new Set([
        "tkgm",
        "context",
        "map_capture",
        "narration",
        "prep",
        "ref_upload",
        "payment",
        "production",
        "polling",
        "ready",
      ]),
    );
    setPipelineDetail("Video hazır");
    setPipelineBusy(false);
    setPipelineVisible(false);
    setPipelineBackgroundMode(false);
  }, [goPipelineStep]);

  const applySegmentsFromResponse = useCallback((data: RunwaySegmentsResponse) => {
    setSceneSegments(data.segments);
    setSceneTimeline(data.timeline);
    setSceneRights(data.scene_rights);
    const readySlots = data.segments.filter((s) => s.exists && s.slot > 0).map((s) => s.slot);
    setMergeSelectedSlots((prev) => {
      const next = new Set<number>();
      readySlots.forEach((slot) => {
        if (prev.size === 0 || prev.has(slot)) next.add(slot);
      });
      if (next.size === 0 && readySlots.length > 0) {
        return new Set(readySlots);
      }
      return next;
    });
  }, []);

  const refreshScenes = useCallback(
    async (targetJobId?: string) => {
      const id = String(targetJobId || jobId || "").trim();
      if (!id) return null;
      const res = await fetchRunwaySegments(id);
      if (res.ok) {
        applySegmentsFromResponse(res.data);
        return res.data;
      }
      return null;
    },
    [jobId, applySegmentsFromResponse],
  );

  const musicListPreview = useMusicListPreview();

  const applyHydratedContext = useCallback(
    (ctx: Awaited<ReturnType<typeof loadJobEditorContext>>) => {
      setNarrationText(clampDroneSimpleNarrationText(ctx.narrationText));
      setNarrationInputs(ctx.narrationInputs);
      if (ctx.parcel) setParcel(ctx.parcel);
      else setParcel(null);
      setParcelSummary(ctx.parcelSummary);
      setParcelAreaM2(ctx.parcelAreaM2);
      setSavedMusic(ctx.savedMusic);
      setPendingMusic(ctx.savedMusic);
      setMusicVolume(ctx.musicVolume);
      setShowUserCard(ctx.showUserCard);
      setHideProParcelBrand(ctx.hideProParcelBrand);
      setUserCardInfo(ctx.userCardInfo);
      setUserCardAnnotationId(ctx.userCardAnnotationId);
      setUserCardPos(ctx.userCardPos);
    },
    [],
  );

  const ensureTkgmDataForCapture = useCallback(async (): Promise<boolean> => {
    if (tkgmData?.geometry) return true;
    if (!parcel) return false;
    const res = await resolveTkgmDataForParcel(parcel);
    if (!res.ok) return false;
    setTkgmData(res.data);
    return Boolean(res.data.geometry);
  }, [tkgmData, parcel]);

  const applyResolvedPreviewVideo = useCallback((resolved: string) => {
    const next = String(resolved || "").trim();
    if (!next) return;
    setPreviewMode("full");
    setVideoUri((prev) => (stripVideoCacheBust(prev) === stripVideoCacheBust(next) ? prev : next));
  }, []);

  const refreshCurrentJobPreview = useCallback(
    async (targetJobId: string) => {
      const trimmed = String(targetJobId || "").trim();
      if (!trimmed) return;
      await refreshScenes(trimmed);
      const resolved = await resolveDroneRunwayPreviewVideoUrl(trimmed);
      if (resolved) applyResolvedPreviewVideo(resolved);
      markEditorVideoReady();
    },
    [refreshScenes, applyResolvedPreviewVideo, markEditorVideoReady],
  );

  const hydrateAndSelectJob = useCallback(
    async (id: string, archiveItem?: DroneMyVideoItem | null) => {
      const trimmed = String(id || "").trim();
      if (!trimmed) return;
      setJobId(trimmed);
      setPreviewPlaybackTime(0);
      setPreviewDuration(0);
      setPreviewMode("none");
      setActiveSceneSlot(null);
      setSelectedSceneSegment(null);
      setScenePreviewFallback(null);
      setVideoUri("");
      setSceneSegments([]);
      setSceneTimeline([]);
      setSceneRights(defaultSceneRights());
      setMergeSelectedSlots(new Set());
      setAppendSceneProduction(null);
      setPipelineSlotByKey({});
      markEditorVideoReady();
      try {
        const ctx = await loadJobEditorContext(trimmed, archiveItem);
        applyHydratedContext(ctx);
        if (ctx.parcel) {
          const tkgmRes = await resolveTkgmDataForParcel(ctx.parcel);
          setTkgmData(tkgmRes.ok ? tkgmRes.data : null);
        } else {
          setTkgmData(null);
        }
      } catch {
        setTkgmData(null);
        /* önizleme bağlam yüklemesinden bağımsız */
      }
      await refreshScenes(trimmed);
      setSceneThumbCacheBust(Date.now());
      const resolved = await resolveDroneRunwayPreviewVideoUrl(trimmed);
      if (resolved) applyResolvedPreviewVideo(resolved);
    },
    [applyHydratedContext, markEditorVideoReady, refreshScenes, applyResolvedPreviewVideo],
  );

  const selectReadyVideo = useCallback(
    (item: DroneMyVideoItem) => {
      void hydrateAndSelectJob(String(item.job_id || "").trim(), item);
    },
    [hydrateAndSelectJob],
  );

  useEffect(() => {
    const id = String(routeParams.jobId || "").trim();
    if (!id) return;
    void (async () => {
      const listRes = await listDroneMyVideos();
      const item =
        listRes.ok
          ? listRes.videos.find(
              (v) =>
                String(v.job_id || "").trim() === id &&
                droneVideoMatchesEditorMode(v, "ai_drone"),
            )
          : undefined;
      await hydrateAndSelectJob(id, item);
    })();
  }, [routeParams.jobId, hydrateAndSelectJob]);

  useEffect(() => {
    if (!jobId) {
      setSceneSegments([]);
      setSceneTimeline([]);
      setSceneRights(defaultSceneRights());
      setMergeSelectedSlots(new Set());
      setActiveSceneSlot(null);
      setSelectedSceneSegment(null);
      setScenePreviewFallback(null);
      setPreviewMode("none");
      setTkgmData(null);
    }
  }, [jobId]);

  useEffect(() => {
    return subscribeDroneRunwayJobReady((readyJobId) => {
      const id = String(readyJobId || "").trim();
      if (!id) return;
      if (!jobId) {
        void (async () => {
          const listRes = await listDroneMyVideos();
          const item =
            listRes.ok
              ? listRes.videos.find(
                  (v) =>
                    String(v.job_id || "").trim() === id &&
                    droneVideoMatchesEditorMode(v, "ai_drone"),
                )
              : undefined;
          if (!item) {
            setReadyVideosRefreshToken((n) => n + 1);
            return;
          }
          await hydrateAndSelectJob(id, item);
          setReadyVideosRefreshToken((n) => n + 1);
        })();
        return;
      }
      if (jobId !== id) return;
      setAppendSceneProduction(null);
      void refreshCurrentJobPreview(id);
      setReadyVideosRefreshToken((n) => n + 1);
    });
  }, [jobId, hydrateAndSelectJob, refreshCurrentJobPreview]);

  const resetPipeline = useCallback(() => {
    setPipelineBusy(false);
    setPipelineVisible(false);
    setPipelineSheetOpen(false);
    setPipelineActiveStep(null);
    setPipelineCompleted(new Set());
    setPipelineDetail("");
    setPipelineError("");
    setRefFrameCount(3);
    setPipelineSlotByKey({});
    setPipelineBackgroundMode(false);
    setAppendSceneProduction(null);
    setPendingNewSceneCapture(null);
  }, []);

  const resetEditorForNewProject = useCallback(() => {
    setJobId("");
    setVideoUri("");
    setPreviewMode("none");
    setPreviewPlaybackTime(0);
    setPreviewDuration(0);
    setParcel(null);
    setTkgmData(null);
    setParcelSummary("");
    setParcelAreaM2("");
    setNarrationText("");
    setNarrationInputs(null);
    setPendingProduction(null);
    setMapCaptureVisible(false);
    setMapCaptureMode("initial");
    setShowUserCard(false);
    setUserCardInfo(null);
    setUserCardAnnotationId(null);
    setUserCardPos(DEFAULT_PORTRAIT_USER_CARD_POS);
    setSubtitlePos({
      x: DEFAULT_PORTRAIT_SUBTITLE.x,
      y: DEFAULT_PORTRAIT_SUBTITLE.y,
    });
    setSubtitleSettings(DEFAULT_PORTRAIT_SUBTITLE);
    setActiveTab("video");
    resetPipeline();
  }, [resetPipeline]);

  const startNewProject = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Video oluşturmak için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    resetEditorForNewProject();
    setQueryVisible(true);
  }, [isAuthenticated, resetEditorForNewProject, router]);

  const cancelPipeline = useCallback(() => {
    setMapCaptureVisible(false);
    resetPipeline();
  }, [resetPipeline]);

  const startPipeline = useCallback(() => {
    setPipelineBusy(true);
    setPipelineVisible(true);
    setPipelineSheetOpen(true);
    setPipelineCompleted(new Set());
    setPipelineDetail("");
    setPipelineError("");
    setPipelineActiveStep("tkgm");
  }, []);

  const parcelReferenceId = useMemo(() => {
    if (!parcel || !tkgmData) return "";
    return buildParcelReferenceId(
      {
        mahalleTkgmValue: parcel.mahalleTkgmValue,
        mahalle: parcel.mahalle,
        ada: parcel.ada,
        parsel: parcel.parsel,
        city: parcel.city,
        town: parcel.town,
        cityId: parcel.cityId,
        townId: parcel.townId,
        proparcelValue: parcel.proparcelValue,
      },
      tkgmData,
    );
  }, [parcel, tkgmData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) {
        if (!cancelled) setAuthHeader(undefined);
        return;
      }
      let token = await storageService.getAccessToken();
      if (!token) {
        const refreshed = await authService.refreshToken();
        if (refreshed) token = await storageService.getAccessToken();
      }
      if (!cancelled && token) setAuthHeader({ Authorization: `Bearer ${token}` });
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const scenePreviewRemoteRetryRef = useRef(0);

  const scenePreviewSource = useMemo((): ScenePreviewSource | null => {
    if (previewMode !== "scene" || activeSceneSlot == null || !jobId) return null;
    if (scenePreviewFallback?.uri) return scenePreviewFallback;
    return buildScenePreviewSource({
      jobId,
      slot: Number(activeSceneSlot),
      segment: selectedSceneSegment,
      authHeader,
      cacheBust: sceneSegmentCacheBust || Date.now(),
    });
  }, [
    previewMode,
    activeSceneSlot,
    jobId,
    selectedSceneSegment,
    authHeader,
    sceneSegmentCacheBust,
    scenePreviewFallback,
  ]);

  const previewVideoUri = useMemo(() => {
    if (previewMode === "scene") {
      return String(scenePreviewSource?.uri || "").trim();
    }
    if (previewMode === "full") return String(videoUri || "").trim();
    return "";
  }, [previewMode, scenePreviewSource, videoUri]);

  const videoSource = useMemo(() => {
    if (previewMode === "scene") {
      return scenePreviewSourceToPlayerSource(scenePreviewSource);
    }
    if (!previewVideoUri) return null;
    if (previewVideoUri.startsWith("file:") || previewVideoUri.startsWith("content:")) {
      return { uri: previewVideoUri };
    }
    if (authHeader?.Authorization) {
      return { uri: previewVideoUri, headers: authHeader };
    }
    return { uri: previewVideoUri };
  }, [previewMode, scenePreviewSource, previewVideoUri, authHeader]);

  const videoPreviewLoading = Boolean(previewVideoUri && !videoSource && !pipelineBusy);

  const musicPreviewUrl = useMemo(() => {
    const pendingUrl = String(pendingMusic?.preview_url || "").trim();
    const savedPreview = String(savedMusic?.preview_url || "").trim();
    if (pendingUrl) return pendingUrl;
    if (savedPreview) return savedPreview;
    if (savedMusic && jobId) return droneMusicFileUrl(jobId);
    return "";
  }, [pendingMusic, savedMusic, jobId]);

  const musicSource = useMemo(() => {
    if (!musicPreviewUrl) return null;
    return authHeader
      ? { uri: musicPreviewUrl, headers: authHeader }
      : { uri: musicPreviewUrl };
  }, [musicPreviewUrl, authHeader]);

  const handleParcelQuery = useCallback(async (payload: AdaParselSubmitPayload) => {
    setQueryVisible(false);
    setNarrationInputs(null);
    setNarrationText("");
    startPipeline();
    goPipelineStep("tkgm", "Parsel sorgulanıyor…");
    const res = await fetchTkgmParcelByAdaParsel(payload);
    if (!res.ok) {
      resetPipeline();
      Alert.alert("Parsel sorgusu", res.error);
      return;
    }
    completePipelineStep("tkgm");
    const nitelik = extractNitelikText(res.data);
    const p = res.data?.properties || res.data;
    const rawArea = String(p?.alan ?? p?.ALAN ?? "").trim();
    const nextParcel: DroneParcelQuery = {
      mahalleTkgmValue: payload.mahalleTkgmValue,
      mahalle: payload.mahalle,
      ada: payload.ada,
      parsel: payload.parsel,
      city: payload.city,
      town: payload.town,
      cityId: payload.cityId,
      townId: payload.townId,
      proparcelValue: payload.proparcelValue,
    };
    setParcel(nextParcel);
    setTkgmData(res.data);
    setParcelSummary(formatTkgmResultSummary(payload, res.data, nitelik || undefined));
    setParcelAreaM2(rawArea);

    goPipelineStep("context", "Konum bilgileri alınıyor…");
    const narrCtx = await resolveDroneNarrationInputs(nextParcel, res.data, rawArea);
    setNarrationInputs(narrCtx);
    completePipelineStep("context");

    goPipelineStep("map_capture", `Haritadan ${DRONE_SCENE_INITIAL_COUNT} referans karesi alın`);
    setMapCaptureMode("initial");
    setMapCaptureVisible(true);
  }, [startPipeline, goPipelineStep, completePipelineStep, resetPipeline]);

  const handleMapCaptureStatus = useCallback((detail: string) => {
    setPipelineVisible(true);
    setPipelineDetail(detail);
    goPipelineStep("map_capture", detail);
  }, [goPipelineStep]);

  const continueRunwayProduction = useCallback(
    async (pending: PendingProduction) => {
      if (!parcel) return;
      let leftToBackground = false;
      setPipelineBusy(true);
      setPipelineVisible(true);
      setPipelineError("");
      try {
        goPipelineStep("production", "AI video üretimi başlatılıyor…");
        const started = await startDroneRunwayProduction({
          parcel,
          preparedJobId: pending.preparedJobId,
          refFrameCount: pending.refFrameCount,
          narrationText: pending.narrationText,
          parcelAreaLabelTr: formatParcelAreaM2Tr(parcelAreaM2),
          city: pending.narrCtx.city,
          district: pending.narrCtx.district,
          quarter: pending.narrCtx.quarter,
          fullSubtitleOnly: showSubtitles,
          useOpenAiPreflight: pending.useOpenAiPreflight,
          narrCtx: pending.narrCtx,
        });
        if (!started.ok) {
          if (started.licenseRequired) {
            setPendingProduction(pending);
            goPipelineStep("payment", "Video üretimi için lisans satın alın.");
            setPipelineBusy(false);
            setPurchaseModalVisible(true);
            return;
          }
          throw new Error(started.error);
        }
        completePipelineStep("production");

        const frameCount = Math.max(2, Math.min(8, pending.refFrameCount));
        setRefFrameCount(frameCount);
        setPipelineSlotByKey(initialRunwaySlotProgressMap(frameCount));
        setPipelineBackgroundMode(false);

        const referenceId = tkgmData
          ? buildParcelReferenceId(
              {
                mahalleTkgmValue: parcel.mahalleTkgmValue,
                ada: parcel.ada,
                parsel: parcel.parsel,
                mahalle: parcel.mahalle,
              },
              tkgmData,
            )
          : `${parcel.mahalleTkgmValue}_${parcel.ada}_${parcel.parsel}`;

        await setActiveDroneJob({
          jobId: started.jobId,
          referenceId,
          startedAt: Date.now(),
          refFrameCount: frameCount,
          source: MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
        });

        goPipelineStep("polling", "Video kareleri oluşturuluyor…");
        const pollResult = await pollRunwayUntilDone({
          jobId: started.jobId,
          pollMs: started.pollMs,
          onPoll: (status) => {
            const poll = {
              ...status,
              segmentSlotProgress: status.segment_slot_progress,
            };
            const mainStep = String(status.progress?.step || "").trim().toLowerCase();
            setPipelineSlotByKey((prev) => {
              const merged = mergeRunwaySlotProgressFromPoll(prev, poll, frameCount);
              const summary = formatRunwaySlotProgressSummary(merged, frameCount);
              const statusLabel = runwayProgressLabel(status);
              if (mainStep === "merge" || mainStep === "voice" || mainStep === "done" || mainStep === "ready") {
                setPipelineDetail(statusLabel);
              } else {
                setPipelineDetail(summary || statusLabel);
              }
              return merged;
            });
          },
          onSoftUiTimeout: () => {
            setPipelineBackgroundMode(true);
            setPipelineDetail(
              "Video arka planda üretiliyor. Hazır olunca önizleme açılacak.",
            );
            setPipelineBusy(false);
            setPipelineSheetOpen(true);
          },
        });

        if (!pollResult.ok) {
          if ("background" in pollResult && pollResult.background) {
            leftToBackground = true;
            startDroneRunwayBackgroundPoll(started.jobId);
            return;
          }
          await clearActiveDroneJob();
          throw new Error("error" in pollResult ? pollResult.error : "Video üretilemedi.");
        }

        await clearActiveDroneJob();
        setPipelineSlotByKey((prev) => {
          const next = { ...prev };
          for (let slot = 1; slot <= frameCount; slot += 1) {
            next[String(slot)] = {
              slot,
              step: "done",
              percent: 100,
              label: "Tamamlandı",
            };
          }
          return next;
        });
        completePipelineStep("polling");

        setJobId(started.jobId);
        setPreviewMode("none");
        setActiveSceneSlot(null);
        setVideoUri("");
        markEditorVideoReady();
        await refreshScenes(started.jobId);
        setPendingProduction(null);
        setReadyVideosRefreshToken((n) => n + 1);
        Alert.alert(
          "Hazır",
          `${DRONE_SCENE_INITIAL_COUNT} sahne üretildi. Bir sahneye dokunarak önizleyin veya sahneleri birleştirin.`,
        );
      } catch (e: unknown) {
        if (!leftToBackground) {
          const msg = e instanceof Error ? e.message : "İşlem tamamlanamadı.";
          setPipelineError(userFacingPipelineDetail(msg, "İşlem tamamlanamadı."));
          Alert.alert("Video oluşturma", userFacingPipelineDetail(msg, "İşlem tamamlanamadı."));
        }
      } finally {
        if (!leftToBackground) {
          setPipelineBusy(false);
        }
      }
    },
    [
      parcel,
      parcelAreaM2,
      showSubtitles,
      tkgmData,
      goPipelineStep,
      completePipelineStep,
      markEditorVideoReady,
      refreshScenes,
    ],
  );

  const handleDroneLicensePurchaseSuccess = useCallback(() => {
    const pending = pendingProduction;
    if (!pending) return;
    completePipelineStep("payment");
    void continueRunwayProduction(pending);
  }, [pendingProduction, continueRunwayProduction, completePipelineStep]);

  const handleDronePurchaseDismiss = useCallback(() => {
    setPendingProduction(null);
    cancelPipeline();
  }, [cancelPipeline]);

  const ensureDroneVideoLicenseOrPrompt = useCallback(
    async (pending: PendingProduction): Promise<boolean> => {
      const referenceId = parcelReferenceId.trim();
      if (!referenceId) {
        throw new Error("Parsel referansı oluşturulamadı. Lütfen parseli yeniden sorgulayın.");
      }
      goPipelineStep("payment", "Video lisansı kontrol ediliyor…");
      const allowed = await creditService.checkDroneVideoLicense(referenceId);
      if (!allowed) {
        setPendingProduction(pending);
        setPipelineDetail("Video üretimi için Tepe Kredi ile lisans satın alın.");
        setPipelineBusy(false);
        setPurchaseModalVisible(true);
        return false;
      }
      completePipelineStep("payment");
      return true;
    },
    [parcelReferenceId, goPipelineStep, completePipelineStep],
  );

  const runPipelineAfterCapture = useCallback(
    async (payload: DroneMapCaptureContinuePayload) => {
      if (!parcel) return;
      const images = payload.images || [];
      if (images.length < 1) return;
      const usePreflight = Boolean(payload.useOpenAiPreflight);
      setRefFrameCount(Math.max(2, Math.min(8, images.length)));
      setPipelineBusy(true);
      setPipelineVisible(true);
      try {
        completePipelineStep("map_capture");
        goPipelineStep("narration", "Anlatım metni hazırlanıyor…");
        const narrCtx =
          narrationInputs ||
          (await resolveDroneNarrationInputs(parcel, tkgmData, parcelAreaM2));
        setNarrationInputs(narrCtx);

        let narr = clampDroneSimpleNarrationText(narrationText);
        if (!narr.trim()) {
          const gen = await generateRunwayNarration(narrCtx, {
            maxChars: DRONE_SIMPLE_NARRATION_TEXT_MAX,
          });
          if (gen.ok) {
            narr = gen.text;
            setNarrationText(gen.text);
          }
        }
        completePipelineStep("narration");

        goPipelineStep("prep", "Video hazırlanıyor…");
        const prep = await runwayPrepStartSimple({
          refFrameCount: images.length,
          promptText: payload.promptText?.trim() || narr,
          useOpenAiPreflight: usePreflight,
          parcel,
        });
        if (!prep.ok) throw new Error(prep.error);
        completePipelineStep("prep");

        goPipelineStep("ref_upload", `Kare 0/${images.length}`);
        for (let i = 0; i < images.length; i += 1) {
          setPipelineDetail(`Kare ${i + 1}/${images.length} yükleniyor…`);
          const pushed = await runwayPrepPushRef(prep.jobId, i + 1, images[i]!);
          if (!pushed.ok) throw new Error(pushed.error);
        }
        completePipelineStep("ref_upload");

        const productionPending: PendingProduction = {
          preparedJobId: prep.jobId,
          refFrameCount: images.length,
          narrationText: narr,
          narrCtx,
          useOpenAiPreflight: usePreflight,
        };
        const licensed = await ensureDroneVideoLicenseOrPrompt(productionPending);
        if (!licensed) return;
        await continueRunwayProduction(productionPending);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "İşlem tamamlanamadı.";
        setPipelineError(userFacingPipelineDetail(msg, "İşlem tamamlanamadı."));
        Alert.alert("Video oluşturma", userFacingPipelineDetail(msg, "İşlem tamamlanamadı."));
        setPipelineBusy(false);
      }
    },
    [
      parcel,
      narrationText,
      parcelAreaM2,
      tkgmData,
      goPipelineStep,
      completePipelineStep,
      continueRunwayProduction,
      ensureDroneVideoLicenseOrPrompt,
    ],
  );

  const pollSegmentJob = useCallback(
    async (
      targetJobId: string,
      pollMs: number,
      options?: { slotHint?: number; trackSlotProgress?: boolean; cardOnly?: boolean },
    ) => {
      const slotHint = Math.max(0, Number(options?.slotHint || 0));
      const trackSlotProgress = options?.trackSlotProgress !== false && slotHint > 0;
      const cardOnly = Boolean(options?.cardOnly);
      const progressSlotCount = trackSlotProgress ? slotHint : refFrameCount;

      const pollResult = await pollRunwayUntilDone({
        jobId: targetJobId,
        pollMs,
        ignoreInitialDone: true,
        softUiWaitMs: 5 * 60 * 1000,
        maxWaitMs: 20 * 60 * 1000,
        onPoll: (status) => {
          const slot = Number(status.progress?.segment_slot || slotHint || 0);
          const label = runwayProgressLabel(status);
          if (trackSlotProgress && slotHint > 0) {
            const poll = {
              ...status,
              segmentSlotProgress: status.segment_slot_progress,
            };
            setPipelineSlotByKey((prev) =>
              mergeRunwaySlotProgressFromPoll(prev, poll, progressSlotCount),
            );
          } else if (!cardOnly) {
            setPipelineDetail(slot > 0 ? `Sahne ${slot}: ${label}` : label);
          }
        },
        onSoftUiTimeout: () => {
          if (cardOnly) return;
          setPipelineBackgroundMode(true);
          setPipelineDetail("Sahne arka planda üretiliyor. Süreci alttaki panelden izleyebilirsiniz.");
          setPipelineBusy(false);
          setPipelineSheetOpen(true);
        },
      });
      if (!pollResult.ok) {
        if ("background" in pollResult && pollResult.background) {
          startDroneRunwayBackgroundPoll(targetJobId);
          if (!cardOnly) {
            setPipelineVisible(true);
            setPipelineSheetOpen(true);
          }
          return false;
        }
        throw new Error("error" in pollResult ? pollResult.error : "Sahne üretilemedi.");
      }
      return true;
    },
    [refFrameCount],
  );

  const beginAppendSceneProduction = useCallback((runwaySlot: number, cardIndex: number) => {
    setAppendSceneProduction({ runwaySlot, cardIndex });
    setPipelineSlotByKey(initialRunwaySlotProgressForSlot(runwaySlot));
  }, []);

  const resolveAppendPlaceholderIndex = useCallback(
    (segments: RunwaySegmentItem[], timeline: RunwaySegmentTimelineEntry[], rights: SceneGenerationRights) => {
      const cards = buildSceneStripCards(segments, timeline, rights);
      const idx = cards.findIndex((card) => card.slot == null && card.placeholder);
      return idx >= 0 ? idx : Math.max(0, cards.length - 1);
    },
    [],
  );

  const produceAppendedScene = useCallback(
    async (
      targetJobId: string,
      image: { uri: string; name: string; type: string },
      options?: { promptText?: string; usePreflight?: boolean },
    ): Promise<{ slot: number; background?: boolean }> => {
      const segRes = await fetchRunwaySegments(targetJobId);
      if (!segRes.ok) throw new Error(segRes.error);
      const slot = computeNextAppendSlot(segRes.data);
      const cardIndex = resolveAppendPlaceholderIndex(
        segRes.data.segments,
        segRes.data.timeline,
        segRes.data.scene_rights,
      );
      beginAppendSceneProduction(slot, cardIndex);

      const promptText = String(options?.promptText || "").trim();
      const usePreflight = Boolean(options?.usePreflight);

      if (usePreflight) {
        const pf = await preflightRunwaySegment({
          jobId: targetJobId,
          slot,
          image,
          promptText: promptText || undefined,
          append: true,
          clientSource: MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
        });
        if (!pf.ok) throw new Error(pf.error);
        const pfDone = await pollSegmentJob(targetJobId, pf.pollMs, {
          slotHint: slot,
          trackSlotProgress: true,
          cardOnly: true,
        });
        if (!pfDone) return { slot, background: true };
      }

      const reg = await regenerateRunwaySegment({
        jobId: targetJobId,
        slot,
        image: usePreflight ? null : image,
        promptText: promptText || undefined,
        usePreflight,
        append: true,
        clientSource: MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
      });
      if (!reg.ok) {
        if (reg.licenseRequired) {
          throw new Error("Sahne hakkınız bitti. Lütfen tekrar deneyin.");
        }
        throw new Error(reg.error);
      }
      const done = await pollSegmentJob(targetJobId, reg.pollMs, {
        slotHint: slot,
        trackSlotProgress: true,
        cardOnly: true,
      });
      if (!done) return { slot, background: true };

      setPipelineSlotByKey((prev) => ({
        ...prev,
        [String(slot)]: { slot, step: "done", percent: 100, label: "Tamamlandı" },
      }));
      return { slot, background: false };
    },
    [pollSegmentJob, beginAppendSceneProduction, resolveAppendPlaceholderIndex],
  );

  const runNewSceneAfterCapture = useCallback(
    async (payload: DroneMapCaptureContinuePayload) => {
      const targetJobId = String(jobId || "").trim();
      if (!targetJobId) {
        Alert.alert("Sahne", "Önce video oluşturun.");
        return;
      }
      const images = payload.images || [];
      if (images.length < 1) {
        Alert.alert("Sahne", "En az bir kare gerekli.");
        return;
      }
      setSceneBusy(true);
      setPipelineError("");
      try {
        let lastSlot: number | null = null;
        for (let i = 0; i < images.length; i += 1) {
          const image = images[i]!;
          const promptText = i === 0 && images.length === 1 ? payload.promptText : undefined;
          const usePreflight = i === 0 ? payload.useOpenAiPreflight : false;
          const result = await produceAppendedScene(targetJobId, image, { promptText, usePreflight });
          if (result.background) {
            const remainingImages = images.slice(i + 1);
            if (remainingImages.length > 0) {
              setPendingNewSceneCapture({ ...payload, images: remainingImages });
            }
            return;
          }
          lastSlot = result.slot;
          await refreshScenes(targetJobId);
          const rights = await getSceneRights(targetJobId);
          setSceneRights(rights);
        }
        await refreshScenes(targetJobId);
        setSceneSegmentCacheBust(Date.now());
        setSceneThumbCacheBust(Date.now());
        if (lastSlot != null) {
          setActiveSceneSlot(lastSlot);
          setPreviewMode("scene");
        }
        setAppendSceneProduction(null);
        setPipelineSlotByKey({});
        Alert.alert("Hazır", "Yeni sahne eklendi.");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Sahne eklenemedi.";
        setAppendSceneProduction(null);
        setPipelineSlotByKey({});
        Alert.alert("Sahne", msg);
      } finally {
        setSceneBusy(false);
      }
    },
    [jobId, produceAppendedScene, refreshScenes, getSceneRights],
  );

  const handleExtraScenePurchaseDismiss = useCallback(() => {
    setExtraScenePurchaseVisible(false);
    setPendingNewSceneCapture(null);
    setAppendSceneProduction(null);
    setPipelineSlotByKey({});
  }, []);

  const handleMapCaptureContinue = useCallback(
    (payload: DroneMapCaptureContinuePayload) => {
      setMapCaptureVisible(false);
      if (mapCaptureMode === "new_scene") {
        setMapCaptureMode("initial");
        void (async () => {
          const targetJobId = String(jobId || "").trim();
          if (!targetJobId) {
            Alert.alert("Sahne", "Önce video oluşturun.");
            return;
          }
          const imageCount = Math.max(1, payload.images?.length ?? 0);
          await refreshScenes(targetJobId);
          const rights = await getSceneRights(targetJobId);
          setSceneRights(rights);
          if (needsExtraScenePurchaseForAppend(rights, imageCount)) {
            setPendingNewSceneCapture(payload);
            setExtraScenePurchaseVisible(true);
            return;
          }
          void runNewSceneAfterCapture(payload);
        })();
        return;
      }
      setPipelineBusy(true);
      void runPipelineAfterCapture(payload);
    },
    [mapCaptureMode, runPipelineAfterCapture, runNewSceneAfterCapture, jobId, refreshScenes],
  );

  const handleSelectScene = useCallback(
    (slot: number, segment?: RunwaySegmentItem | null) => {
      const normalizedSlot = Number(slot);
      if (!Number.isFinite(normalizedSlot) || normalizedSlot < 1) return;
      const seg =
        segment ??
        sceneSegments.find((s) => Number(s.slot) === normalizedSlot && s.exists) ??
        null;
      videoSourceErrorAtRef.current = 0;
      scenePreviewRemoteRetryRef.current = 0;
      setScenePreviewFallback(null);
      setSelectedSceneSegment(seg);
      setActiveSceneSlot(normalizedSlot);
      setPreviewMode("scene");
      setSceneSegmentCacheBust(Date.now());
    },
    [sceneSegments],
  );

  const handleSelectFullVideo = useCallback(() => {
    videoSourceErrorAtRef.current = 0;
    scenePreviewRemoteRetryRef.current = 0;
    setScenePreviewFallback(null);
    setSelectedSceneSegment(null);
    setActiveSceneSlot(null);
    setPreviewMode("full");
  }, []);

  const handleMoveActiveScene = useCallback(
    (direction: -1 | 1) => {
      const targetJobId = String(jobId || "").trim();
      const slot = Number(activeSceneSlot);
      if (!targetJobId || !Number.isFinite(slot) || slot < 1) return;

      void (async () => {
        const canonical = buildCanonicalTimeline(sceneSegments, sceneTimeline);
        const entry = canonical.find((item) => Number(item.slot) === slot);
        if (!entry?.id) return;

        const next = moveSceneTimelineByStep(canonical, entry.id, direction);
        if (!next) return;

        setSceneBusy(true);
        try {
          const res = await updateSegmentTimeline(targetJobId, next);
          if (!res.ok) throw new Error(res.error);
          setSceneTimeline(next);
          await refreshScenes(targetJobId);
        } catch (e: unknown) {
          Alert.alert("Sıra", e instanceof Error ? e.message : "Sahne sırası kaydedilemedi.");
          await refreshScenes(targetJobId);
        } finally {
          setSceneBusy(false);
        }
      })();
    },
    [jobId, activeSceneSlot, sceneSegments, sceneTimeline, refreshScenes],
  );

  const handleToggleMergeSlot = useCallback((slot: number) => {
    setMergeSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }, []);

  const handleDeleteScene = useCallback(
    (entryId: string, slot: number) => {
      const targetJobId = String(jobId || "").trim();
      if (!targetJobId) return;
      const readyCount = sceneSegments.filter((s) => s.exists && s.slot > 0).length;
      if (readyCount <= 1) {
        Alert.alert("Silme", "En az bir sahne kalmalı.");
        return;
      }
      Alert.alert("Sahneyi sil", `Sahne ${slot} silinsin mi? Hak iade edilmez.`, [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setSceneBusy(true);
              try {
                const res = await deleteRunwaySceneEntry(
                  targetJobId,
                  entryId,
                  sceneSegments,
                  sceneTimeline,
                );
                if (!res.ok) throw new Error(res.error);
                const deletedSlot = res.deletedSlot;
                const data = await refreshScenes(targetJobId);
                const stillExists = Boolean(
                  data?.segments.some((s) => s.slot === deletedSlot && s.exists),
                );
                if (stillExists) {
                  Alert.alert("Silme", "Sahne sunucudan silinemedi. Lütfen tekrar deneyin.");
                  return;
                }
                setMergeSelectedSlots((prev) => {
                  const next = new Set(prev);
                  next.delete(deletedSlot);
                  return next;
                });
                if (activeSceneSlot === deletedSlot) {
                  setActiveSceneSlot(null);
                  setPreviewMode("full");
                  const resolved = await resolveDroneRunwayPreviewVideoUrl(targetJobId);
                  if (resolved) applyResolvedPreviewVideo(resolved);
                }
                setSceneThumbCacheBust(Date.now());
                setSceneSegmentCacheBust(Date.now());
              } catch (e: unknown) {
                Alert.alert("Silme", e instanceof Error ? e.message : "Sahne silinemedi.");
              } finally {
                setSceneBusy(false);
              }
            })();
          },
        },
      ]);
    },
    [
      jobId,
      activeSceneSlot,
      refreshScenes,
      sceneTimeline,
      sceneSegments,
      applyResolvedPreviewVideo,
    ],
  );

  const handleMergeScenes = useCallback(async () => {
    const targetJobId = String(jobId || "").trim();
    if (!targetJobId) return;
    if (mergeSelectedSlots.size < 2) {
      Alert.alert("Birleştir", "En az iki sahne seçin.");
      return;
    }
    const timeline = buildMergeTimelineFromStripOrder(
      sceneSegments,
      sceneTimeline,
      mergeSelectedSlots,
    );
    if (timeline.length < 2) {
      Alert.alert("Birleştir", "En az iki sahne seçin.");
      return;
    }
    setMergingScenes(true);
    setSceneBusy(true);
    setPipelineBusy(true);
    setPipelineVisible(true);
    setPipelineDetail("Videolar birleştiriliyor…");
    try {
      const patchRes = await updateSegmentTimeline(targetJobId, timeline);
      if (!patchRes.ok) throw new Error(patchRes.error);
      const finRes = await finalizeSegmentTimeline(targetJobId, timeline);
      if (!finRes.ok) throw new Error(finRes.error);
      const done = await pollSegmentJob(targetJobId, finRes.pollMs);
      if (!done) return;
      const resolved = await resolveDroneRunwayPreviewVideoUrl(targetJobId);
      setPreviewMode("full");
      setVideoUri(resolved || droneRunwayRawPreviewVideoUrl(targetJobId, Date.now()));
      setActiveSceneSlot(null);
      setSelectedSceneSegment(null);
      setScenePreviewFallback(null);
      setMergeSelectedSlots(new Set());
      await refreshScenes(targetJobId);
      setPipelineVisible(false);
      Alert.alert("Hazır", "Sahneler birleştirildi. Tam video önizlemesi açıldı.");
    } catch (e: unknown) {
      Alert.alert("Birleştir", e instanceof Error ? e.message : "Birleştirme başarısız.");
    } finally {
      setMergingScenes(false);
      setSceneBusy(false);
      setPipelineBusy(false);
    }
  }, [jobId, mergeSelectedSlots, pollSegmentJob, refreshScenes, sceneSegments, sceneTimeline]);

  const handleNewScenePress = useCallback(() => {
    const targetJobId = String(jobId || "").trim();
    if (!targetJobId) {
      Alert.alert("Sahne", "Önce video oluşturun.");
      return;
    }
    const readyCount = sceneSegments.filter((s) => s.exists && s.slot > 0).length;
    if (readyCount >= DRONE_SCENE_PACKAGE_ALLOWANCE) {
      Alert.alert("Sahne limiti", "En fazla 5 sahne görseli alınabilir.");
      return;
    }
    void (async () => {
      setSceneBusy(true);
      try {
        const ready = await ensureTkgmDataForCapture();
        if (!ready) {
          Alert.alert("Harita", "Parsel geometrisi TKGM'den alınamadı.");
          return;
        }
        setMapCaptureMode("new_scene");
        setMapCaptureVisible(true);
      } finally {
        setSceneBusy(false);
      }
    })();
  }, [jobId, sceneSegments, ensureTkgmDataForCapture]);

  const handleExtraScenePurchaseSuccess = useCallback(async () => {
    setExtraScenePurchaseVisible(false);
    const pending = pendingNewSceneCapture;
    if (pending) {
      setPendingNewSceneCapture(null);
      await refreshScenes();
      void runNewSceneAfterCapture(pending);
      return;
    }
    await refreshScenes();
    const ready = await ensureTkgmDataForCapture();
    if (ready) {
      setMapCaptureMode("new_scene");
      setMapCaptureVisible(true);
    }
  }, [refreshScenes, ensureTkgmDataForCapture, pendingNewSceneCapture, runNewSceneAfterCapture]);

  const sceneStripCards = useMemo(() => {
    const sceneCards = buildSceneStripCards(sceneSegments, sceneTimeline, sceneRights);
    const trimmedJobId = String(jobId || "").trim();
    const hasFullVideo = Boolean(trimmedJobId && String(videoUri || "").trim());
    if (!hasFullVideo) return sceneCards;
    return [{ slot: null, fullVideo: true }, ...sceneCards];
  }, [sceneSegments, sceneTimeline, sceneRights, jobId, videoUri]);

  const showSceneStrip = Boolean(jobId);
  const existingSceneCount = useMemo(
    () => countExistingScenes(sceneSegments),
    [sceneSegments],
  );
  const mapCaptureSessionMax =
    mapCaptureMode === "new_scene"
      ? maxAppendCountForSession(sceneRights, existingSceneCount)
      : DRONE_SCENE_INITIAL_COUNT;

  const onNarrationTextChange = useCallback((raw: string) => {
    setNarrationText(clampDroneSimpleNarrationText(raw));
  }, []);

  const onGenerateNarration = useCallback(async () => {
    if (!parcel && !narrationInputs) {
      Alert.alert("Parsel", "Önce parsel seçin veya hazır video yükleyin.");
      return;
    }
    setNarrationBusy(true);
    try {
      const narrCtx = await enrichDroneNarrationInputs(
        parcel,
        tkgmData,
        parcelAreaM2,
        narrationInputs,
      );
      setNarrationInputs(narrCtx);
      if (jobId) {
        await saveNarrationDraft(jobId, narrationText, narrCtx);
      }
      const gen = await generateRunwayNarration(narrCtx, {
        maxChars: DRONE_SIMPLE_NARRATION_TEXT_MAX,
      });
      if (!gen.ok) {
        Alert.alert("Metin", gen.error);
        return;
      }
      setNarrationText(gen.text);
      if (jobId) {
        await saveNarrationDraft(jobId, gen.text, narrCtx);
      }
    } finally {
      setNarrationBusy(false);
    }
  }, [parcel, parcelAreaM2, narrationInputs, tkgmData, jobId, narrationText]);

  const onSaveNarration = useCallback(async () => {
    if (!jobId) {
      Alert.alert("Kayıt", "Önce video oluşturun.");
      return;
    }
    const text = clampDroneSimpleNarrationText(narrationText.trim());
    if (!text) {
      Alert.alert("Kayıt", "Seslendirme metni boş.");
      return;
    }
    setNarrationBusy(true);
    try {
      const draftRes = await saveNarrationDraft(jobId, text, narrationInputs || undefined);
      if (!draftRes.ok) throw new Error(draftRes.error);

      const refreshRes = await refreshRunwayAudio({
        jobId,
        narrationText: text,
        city: narrationInputs?.city,
        district: narrationInputs?.district,
        quarter: narrationInputs?.quarter,
        narrationForceTts: true,
      });
      if (!refreshRes.ok) throw new Error(refreshRes.error);

      const pollResult = await pollRunwayUntilDone({
        jobId: refreshRes.jobId,
        pollMs: refreshRes.pollMs,
        ignoreInitialDone: true,
        softUiWaitMs: 5 * 60 * 1000,
        maxWaitMs: 15 * 60 * 1000,
      });

      if (!pollResult.ok) {
        if ("background" in pollResult && pollResult.background) {
          Alert.alert(
            "Kuyruk",
            "Ses güncellemesi arka planda devam ediyor. Bir süre sonra videoyu yeniden açın.",
          );
          return;
        }
        throw new Error("error" in pollResult ? pollResult.error : "Ses güncellenemedi.");
      }

      const resolved = await resolveDroneRunwayPreviewVideoUrl(jobId);
      if (resolved) {
        setPreviewMode("full");
        setVideoUri(resolved);
      }
      Alert.alert("Kaydedildi", "Seslendirme metni kaydedildi ve yeni ses videoya eklendi.");
    } catch (e: unknown) {
      Alert.alert("Kayıt", e instanceof Error ? e.message : "Kayıt başarısız.");
    } finally {
      setNarrationBusy(false);
    }
  }, [jobId, narrationText, narrationInputs]);

  const loadMusic = useCallback(async () => {
    if (!jobId) return;
    setMusicBusy(true);
    setMusicLoadError("");
    const res = await getDroneMusicLibrary();
    setMusicBusy(false);
    if (!res.ok) {
      setMusicTracks([]);
      setMusicLoadError(res.error);
      return;
    }
    setMusicTracks(res.tracks);
    if (res.tracks.length === 0) {
      setMusicLoadError(
        "Sunucu müzik kütüphanesinde parça bulunamadı. Sekmeyi kapatıp tekrar açarak yeniden deneyebilirsiniz.",
      );
    }
  }, [jobId]);

  const onClearMusic = useCallback(async () => {
    if (!jobId) return;
    setMusicClearBusy(true);
    const res = await clearMusic(jobId);
    setMusicClearBusy(false);
    if (!res.ok) {
      Alert.alert("Müzik", res.error);
      return;
    }
    setSavedMusic(null);
    setPendingMusic(null);
    Alert.alert("Kaldırıldı", "Müzik işten kaldırıldı.");
  }, [jobId]);

  useEffect(() => {
    if (activeTab === "music" && jobId) void loadMusic();
  }, [activeTab, jobId, loadMusic]);

  const onPickPendingMusic = useCallback((track: MusicTrack) => {
    setPendingMusic(track);
  }, []);

  const onSaveMusic = useCallback(async () => {
    if (!jobId) {
      Alert.alert("Kayıt", "Önce video oluşturun.");
      return;
    }
    if (!pendingMusic) {
      Alert.alert("Müzik", "Önce bir parça seçin.");
      return;
    }
    setMusicSaveBusy(true);
    const settings = buildMusicSelectSettings(musicVolume);
    const res = await selectMusic(jobId, pendingMusic, settings);
    setMusicSaveBusy(false);
    if (!res.ok) Alert.alert("Müzik", res.error);
    else {
      setSavedMusic(pendingMusic);
      Alert.alert("Kaydedildi", "Müzik videoya eklendi. Dışa aktarımda işlenir.");
    }
  }, [jobId, pendingMusic, musicVolume]);

  const onUploadMusic = useCallback(async () => {
    if (!jobId) {
      Alert.alert("Müzik", "Önce video oluşturun.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "audio/mpeg", "audio/mp4", "audio/m4a", "audio/wav"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      setMusicUploadBusy(true);
      const settings = buildMusicSelectSettings(musicVolume);
      const res = await uploadDroneMusic(jobId, {
        uri: asset.uri,
        name: asset.name || "music.mp3",
        type: asset.mimeType || "audio/mpeg",
      }, settings);
      setMusicUploadBusy(false);

      if (!res.ok) {
        Alert.alert("Müzik", res.error);
        return;
      }

      const track = res.track;
      setMusicTracks((prev) => {
        const key = musicTrackKey(track);
        if (prev.some((t, i) => musicTrackKey(t, i) === key)) return prev;
        return [track, ...prev];
      });
      setSavedMusic(track);
      setPendingMusic(track);

      const uploadedVolume = Number(res.music?.volume);
      if (Number.isFinite(uploadedVolume)) {
        setMusicVolume(Math.max(0, Math.min(100, Math.round(uploadedVolume))));
      }

      Alert.alert("Yüklendi", "Müzik videoya eklendi.");
    } catch (e: unknown) {
      setMusicUploadBusy(false);
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Müzik", msg || "Müzik yüklenemedi.");
    }
  }, [jobId, musicVolume]);

  const handleUserCardToggle = useCallback(
    async (enabled: boolean) => {
      if (pipelineBusy || userCardBusy) return;

      const previous = showUserCard;
      setShowUserCard(enabled);

      if (!jobId) {
        if (enabled) {
          if (!userCardInfo) {
            setUserCardBusy(true);
            try {
              const prof = await fetchProfileUserCardInfo();
              if (!prof.ok) throw new Error(prof.error);
              setUserCardInfo(prof.userInfo);
            } catch (e: unknown) {
              setShowUserCard(previous);
              Alert.alert(
                "Kullanıcı kartı",
                e instanceof Error ? e.message : "Profil bilgisi alınamadı.",
              );
            } finally {
              setUserCardBusy(false);
            }
          }
        }
        return;
      }

      setUserCardBusy(true);
      try {
        if (enabled) {
          let info = userCardInfo;
          if (!info) {
            const prof = await fetchProfileUserCardInfo();
            if (!prof.ok) throw new Error(prof.error);
            info = prof.userInfo;
            setUserCardInfo(info);
          }
          const res = await upsertUserCardAnnotation(
            jobId,
            info,
            userCardAnnotationId,
            userCardPos,
          );
          if (!res.ok) throw new Error(res.error);
          if (res.annotation?.id) setUserCardAnnotationId(res.annotation.id);
        } else {
          if (userCardAnnotationId) {
            const del = await deleteDroneEditorAnnotation(userCardAnnotationId);
            if (!del.ok) throw new Error(del.error);
          }
          setUserCardAnnotationId(null);
        }
      } catch (e: unknown) {
        setShowUserCard(previous);
        Alert.alert(
          "Kullanıcı kartı",
          e instanceof Error ? e.message : "İşlem başarısız.",
        );
      } finally {
        setUserCardBusy(false);
      }
    },
    [jobId, userCardInfo, userCardAnnotationId, userCardPos, pipelineBusy, userCardBusy, showUserCard],
  );

  const onChangeUserCardImage = useCallback(async () => {
    if (!jobId || !showUserCard) return;
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.85,
      selectionLimit: 1,
    });
    if (result.didCancel || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setUserCardBusy(true);
    try {
      const uploaded = await uploadUserCardAvatar(jobId, {
        uri: asset.uri,
        name: asset.fileName || "user-card-avatar.jpg",
        type: asset.type || "image/jpeg",
      });
      if (!uploaded.ok) throw new Error(uploaded.error);
      const base = userCardInfo || {
        companyName: "ProParcel",
        fullName: "",
        avatarUrl: "",
      };
      const nextInfo: UserCardInfo = { ...base, avatarUrl: uploaded.url };
      setUserCardInfo(nextInfo);
      const res = await upsertUserCardAnnotation(
        jobId,
        nextInfo,
        userCardAnnotationId,
        userCardPos,
      );
      if (!res.ok) throw new Error(res.error);
      if (res.annotation?.id) setUserCardAnnotationId(res.annotation.id);
    } catch (e: unknown) {
      Alert.alert(
        "Kart resmi",
        e instanceof Error ? e.message : "Resim yüklenemedi.",
      );
    } finally {
      setUserCardBusy(false);
    }
  }, [jobId, showUserCard, userCardInfo, userCardAnnotationId, userCardPos]);

  const onExportPortrait = useCallback(async () => {
    if (!jobId) {
      Alert.alert("Dışa aktar", "Önce video oluşturun.");
      return;
    }
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Dışa aktarmak için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    setExportBusy(true);
    try {
      const sub: SubtitleSettings = {
        ...subtitleSettings,
        enabled: showSubtitles,
        fontSize: normalizePortraitSubtitleExportFontSize(subtitleSettings.fontSize),
        textAlign: "center",
        x: subtitlePos.x,
        y: subtitlePos.y,
      };
      await saveSubtitleSettings(jobId, sub);

      if (showUserCard && userCardInfo) {
        const cardRes = await upsertUserCardAnnotation(
          jobId,
          userCardInfo,
          userCardAnnotationId,
          userCardPos,
        );
        if (!cardRes.ok) throw new Error(cardRes.error);
        if (cardRes.annotation?.id) setUserCardAnnotationId(cardRes.annotation.id);
      }

      const started = await startPortraitExport(jobId);
      if (!started.ok) throw new Error(started.error);

      await beginDronePortraitExportJob(jobId, started.exportId);
      Alert.alert(
        "Dışa aktarma",
        "Video arka planda hazırlanıyor. Tamamlandığında galeriye kaydedilecek ve bildirim alacaksınız.",
      );
    } catch (e: any) {
      Alert.alert("Dışa aktar", e?.message || "Başarısız.");
    } finally {
      setExportBusy(false);
    }
  }, [
    jobId,
    isAuthenticated,
    router,
    showSubtitles,
    showUserCard,
    userCardInfo,
    userCardAnnotationId,
    userCardPos,
    subtitlePos,
    subtitleSettings,
  ]);

  useEffect(() => {
    if (!jobId) return;
    void (async () => {
      const sub = await getSubtitleSettings(jobId);
      if (sub.ok && sub.settings) {
        const merged = { ...DEFAULT_PORTRAIT_SUBTITLE, ...sub.settings };
        merged.fontSize = normalizePortraitSubtitleExportFontSize(merged.fontSize);
        merged.textAlign = "center";
        setSubtitleSettings(merged);
        if (typeof sub.settings.x === "number") {
          setSubtitlePos({
            x: sub.settings.x,
            y: sub.settings.y ?? DEFAULT_PORTRAIT_SUBTITLE.y,
          });
        }
      }
    })();
  }, [jobId]);

  const previewPhrase = useMemo(() => {
    const text = narrationText.trim();
    if (!text) return showSubtitles ? "Altyazı önizlemesi" : "";
    if (!showSubtitles) return "";
    const phrase = syncedSubtitleForTime(text, previewPlaybackTime, previewDuration, {
      ...subtitleSettings,
      enabled: true,
    });
    return phrase || "Altyazı önizlemesi";
  }, [narrationText, previewPlaybackTime, previewDuration, subtitleSettings, showSubtitles]);

  const handlePreviewPlaybackProgress = useCallback((currentTime: number, duration: number) => {
    setPreviewPlaybackTime(currentTime);
    if (duration > 0) setPreviewDuration(duration);
  }, []);

  const previewOverlayActive = useMemo(() => {
    if (previewMode === "scene" || previewMode === "full") {
      if (previewVideoUri) return true;
    }
    const uri = String(videoUri || "").trim();
    if (!uri) return true;
    if (isRunwayCleanPreviewVideoUrl(uri)) return true;
    return Boolean(jobId);
  }, [previewMode, previewVideoUri, videoUri, jobId]);

  const handleVideoSourceError = useCallback(() => {
    const trimmed = String(jobId || "").trim();
    if (!trimmed) return;
    if (previewMode === "scene" && activeSceneSlot != null) {
      const now = Date.now();
      if (now - videoSourceErrorAtRef.current < 2500) return;
      videoSourceErrorAtRef.current = now;

      if (scenePreviewRemoteRetryRef.current < 1) {
        scenePreviewRemoteRetryRef.current += 1;
        setScenePreviewFallback(null);
        setSceneSegmentCacheBust(Date.now());
        return;
      }

      const slot = Number(activeSceneSlot);
      const bust = sceneSegmentCacheBust || Date.now();
      void resolveScenePreviewSourceAsync({
        jobId: trimmed,
        slot,
        segment: selectedSceneSegment,
        authHeader,
        cacheBust: bust,
      }).then((fallback) => {
        if (fallback.uri) setScenePreviewFallback(fallback);
      });
      return;
    }
    const now = Date.now();
    if (now - videoSourceErrorAtRef.current < 4000) return;
    videoSourceErrorAtRef.current = now;
    void resolveDroneRunwayPreviewVideoUrl(trimmed).then((resolved) => {
      if (resolved) applyResolvedPreviewVideo(resolved);
    });
  }, [
    jobId,
    previewMode,
    activeSceneSlot,
    sceneSegmentCacheBust,
    selectedSceneSegment,
    authHeader,
    applyResolvedPreviewVideo,
  ]);

  useEffect(() => {
    setPreviewPlaybackTime(0);
    setPreviewDuration(0);
  }, [previewVideoUri]);

  const pipelineSlotProgress = useMemo(() => {
    if (appendSceneProduction) {
      return toPipelineSlotProgressItemsForSlots(pipelineSlotByKey, [appendSceneProduction.runwaySlot]);
    }
    return toPipelineSlotProgressItems(pipelineSlotByKey, refFrameCount);
  }, [pipelineSlotByKey, refFrameCount, appendSceneProduction]);

  const scenePlaceholderProgress = useMemo(() => {
    if (!appendSceneProduction) return null;
    const entry = pipelineSlotByKey[String(appendSceneProduction.runwaySlot)];
    const fullVideoOffset =
      Boolean(String(jobId || "").trim() && String(videoUri || "").trim()) ? 1 : 0;
    return {
      cardIndex: appendSceneProduction.cardIndex + fullVideoOffset,
      runwaySlot: appendSceneProduction.runwaySlot,
      percent: entry?.percent ?? 0,
      label: userFacingPipelineDetail(entry?.label || "Sahne hazırlanıyor…", "Sahne hazırlanıyor…"),
    };
  }, [appendSceneProduction, pipelineSlotByKey, jobId, videoUri]);

  const displayMusicTracks = useMemo(() => {
    if (!savedMusic) return musicTracks;
    const savedKey = musicTrackKey(savedMusic);
    const hasSaved = musicTracks.some((t, i) => musicTrackKey(t, i) === savedKey);
    if (hasSaved) return musicTracks;
    return [savedMusic, ...musicTracks];
  }, [musicTracks, savedMusic]);

  const appearanceSettingRows = useMemo((): SettingsPanelRow[] => [
    {
      key: "user-card",
      icon: "person-circle-outline",
      label: "Kullanıcı kartı",
      description: "Videoda profil kartını gösterir",
      value: showUserCard,
      onValueChange: (v) => void handleUserCardToggle(v),
      switchDisabled: pipelineBusy || userCardBusy,
      secondaryAction: {
        label: "Kart görselini değiştir",
        icon: "image-outline",
        onPress: () => void onChangeUserCardImage(),
        disabled: userCardBusy,
        loading: userCardBusy,
        visible: showUserCard && Boolean(jobId),
      },
    },
    {
      type: "paired",
      key: "subtitle-pair",
      icon: "chatbox-outline",
      left: {
        label: "Alt yazı",
        value: showSubtitles,
        onValueChange: setShowSubtitles,
        disabled: pipelineBusy,
      },
      right: {
        label: "Arka plan",
        value: subtitleSettings.mode !== "plain",
        onValueChange: (boxed) =>
          setSubtitleSettings((prev) => ({
            ...prev,
            mode: boxed ? "boxed" : "plain",
          })),
        disabled: pipelineBusy || !showSubtitles,
      },
    },
  ], [
    showUserCard,
    handleUserCardToggle,
    pipelineBusy,
    userCardBusy,
    jobId,
    onChangeUserCardImage,
    showSubtitles,
    subtitleSettings.mode,
  ]);

  return (
    <MobileAiScreenShell
      title="Pratik Video"
      onBack={() => router.back()}
      pageBackgroundColor={AI_DRONE_EDITOR_THEME.shell}
      right={
        <TouchableOpacity
          onPress={() => void onExportPortrait()}
          disabled={exportBusy || !jobId}
          style={[styles.headerBtn, (!jobId || exportBusy) && styles.headerBtnDisabled]}
          accessibilityLabel="Dikey dışa aktar"
        >
          {exportBusy ? (
            <ActivityIndicator color="#f8fafc" size="small" />
          ) : (
            <Ionicons
              name="download-outline"
              size={18}
              color={jobId ? "#f8fafc" : "rgba(248,250,252,0.35)"}
            />
          )}
        </TouchableOpacity>
      }
    >
      <View style={styles.body}>
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
        <TouchableOpacity
          style={[styles.newProjectBtn, pipelineBusy && styles.createBtnDisabled]}
          disabled={pipelineBusy}
          onPress={startNewProject}
          accessibilityLabel="Yeni proje başlat"
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Yeni proje</Text>
        </TouchableOpacity>

        {isAuthenticated ? (
          <CompletedDroneVideoPicker
            selectedJobId={jobId}
            onSelect={selectReadyVideo}
            disabled={pipelineBusy}
            refreshToken={readyVideosRefreshToken}
          />
        ) : null}

        <View style={styles.previewWrap}>
        <PortraitVideoFrame
          subtitleText={previewPhrase}
          subtitleEnabled={showSubtitles && previewOverlayActive}
          subtitlePos={subtitlePos}
          onSubtitlePosChange={setSubtitlePos}
          subtitleMode={subtitleSettings.mode === "plain" ? "plain" : "boxed"}
          subtitleFontSize={subtitleSettings.fontSize}
          userCardScale={DEFAULT_USER_CARD_SCALE}
          showProParcelBadge={previewOverlayActive && !hideProParcelBrand}
          userCardEnabled={showUserCard && previewOverlayActive}
          userCardData={userCardInfo}
          userCardPos={userCardPos}
          onUserCardPosChange={setUserCardPos}
        >
          {videoSource ? (
            <PortraitVideoPlayer
              key={`${previewMode}-${activeSceneSlot ?? "full"}-${previewVideoUri}`}
              source={videoSource}
              musicSource={previewMode === "scene" ? null : musicSource}
              autoPlay={previewMode === "scene"}
              onPlaybackProgress={handlePreviewPlaybackProgress}
              onSourceError={handleVideoSourceError}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              {pipelineBusy || videoPreviewLoading ? (
                <>
                  <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} size="large" />
                  <Text style={styles.previewHint}>
                    {videoPreviewLoading
                      ? "Video yükleniyor…"
                      : userFacingPipelineDetail(pipelineDetail, "İşleniyor…")}
                  </Text>
                </>
              ) : (
                <Text style={styles.previewHint}>
                  {previewMode === "scene" && activeSceneSlot != null && !previewVideoUri
                    ? "Sahne videosu yüklenemedi"
                    : showSceneStrip
                      ? "Sahne seçin veya birleştirin"
                      : "Video önizlemesi (9:16)"}
                </Text>
              )}
            </View>
          )}
        </PortraitVideoFrame>
        </View>

        {showSceneStrip ? (
          <View style={styles.sceneStripWrap}>
            <DroneSceneStrip
              jobId={jobId}
              authHeader={authHeader}
              thumbCacheBust={sceneThumbCacheBust}
              cards={sceneStripCards}
              activeSlot={activeSceneSlot}
              fullVideoActive={previewMode === "full"}
              fullVideoUri={videoUri}
              mergeSelectedSlots={mergeSelectedSlots}
              sceneRights={sceneRights}
              busy={sceneBusy || pipelineBusy}
              merging={mergingScenes}
              onSelectFullVideo={handleSelectFullVideo}
              onSelectScene={handleSelectScene}
              onToggleMerge={handleToggleMergeSlot}
              onDeleteScene={handleDeleteScene}
              onMoveActiveScene={handleMoveActiveScene}
              onMergeScenes={() => void handleMergeScenes()}
              onNewScene={handleNewScenePress}
              placeholderProgress={scenePlaceholderProgress}
            />
          </View>
        ) : null}

        <MediaTabs
          tabs={MEDIA_TABS}
          activeId={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "video" ? (
          <>
            <SettingsPanel
              title="Görünüm"
              rows={appearanceSettingRows}
              footer={
                <SubtitleFontSizeRow
                  value={subtitleSettings.fontSize}
                  onChange={onSubtitleFontSizeChange}
                  disabled={pipelineBusy || !showSubtitles}
                  showTopBorder
                />
              }
            />
            <ProparcelLabelRemovalCard
              creditCost={labelCreditCost}
              creditLoading={labelCreditLoading}
              removed={hideProParcelBrand}
              disabled={pipelineBusy || !jobId}
              onPress={onPressRemoveProparcelLabel}
            />
            <Text style={styles.panelHint}>
              Dikey (9:16) dışa aktarım. Güvenli alan çizgileri web editör ile aynıdır; altyazıyı üstte sürükleyebilirsiniz.
            </Text>
          </>
        ) : null}

        {activeTab === "narration" ? (
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Seslendirme metni</Text>
            <TextInput
              style={styles.textArea}
              multiline
              value={narrationText}
              onChangeText={onNarrationTextChange}
              maxLength={DRONE_SIMPLE_NARRATION_TEXT_MAX}
              placeholder="Anlatım metni…"
              placeholderTextColor={AI_DRONE_EDITOR_THEME.mutedOnDark}
            />
            <Text
              style={[
                styles.charCount,
                narrationText.length >= DRONE_SIMPLE_NARRATION_TEXT_MAX && styles.charCountAtLimit,
              ]}
            >
              {narrationText.length} / {DRONE_SIMPLE_NARRATION_TEXT_MAX}
            </Text>
            <View style={styles.rowBtns}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void onGenerateNarration()} disabled={narrationBusy}>
                {narrationBusy ? (
                  <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Metin hazırla</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => void onSaveNarration()}
                disabled={narrationBusy}
              >
                {narrationBusy ? (
                  <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {activeTab === "music" ? (
          <View style={styles.panel}>
            {!jobId ? (
              <Text style={styles.panelHint}>Müzik seçmek için önce video oluşturun.</Text>
            ) : musicBusy ? (
              <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
            ) : (
              <>
                <DroneMusicVolumeRow
                  value={musicVolume}
                  onChange={setMusicVolume}
                />
                <SecondaryActionButton
                  label="Müzik Yükle"
                  icon="cloud-upload-outline"
                  onPress={() => void onUploadMusic()}
                  loading={musicUploadBusy}
                  disabled={musicUploadBusy}
                  style={styles.musicUploadBtn}
                />
                {musicLoadError ? (
                  <Text style={styles.panelHint}>{musicLoadError}</Text>
                ) : null}
                {displayMusicTracks.map((track, idx) => {
                  const key = musicTrackKey(track, idx);
                  const isPending = Boolean(
                    pendingMusic && musicTrackKey(pendingMusic) === musicTrackKey(track, idx),
                  );
                  const isSaved = Boolean(
                    savedMusic && musicTrackKey(savedMusic) === musicTrackKey(track, idx),
                  );
                  return (
                    <DroneMusicTrackCard
                      key={key}
                      track={track}
                      index={idx}
                      isPending={Boolean(isPending)}
                      isSaved={Boolean(isSaved)}
                      isPlaying={musicListPreview.activeKey === key}
                      onPlayToggle={(t, i) => void musicListPreview.togglePreview(t, i)}
                      onSelect={onPickPendingMusic}
                    />
                  );
                })}
                <MusicPreviewLoadingRow visible={Boolean(musicListPreview.loadingKey)} />
                {pendingMusic ? (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, musicSaveBusy && styles.secondaryBtnDisabled]}
                    onPress={() => void onSaveMusic()}
                    disabled={musicSaveBusy}
                  >
                    {musicSaveBusy ? (
                      <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Kaydet</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {savedMusic ? (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, musicClearBusy && styles.secondaryBtnDisabled]}
                    onPress={() => void onClearMusic()}
                    disabled={musicClearBusy}
                  >
                    {musicClearBusy ? (
                      <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Müziği kaldır</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        ) : null}
        </ScrollView>
      </View>

      <DroneProductionPipelineSheet
        active={pipelineVisible && !appendSceneProduction}
        open={pipelineSheetOpen}
        onOpenChange={setPipelineSheetOpen}
        busy={pipelineBusy}
        activeStepId={pipelineActiveStep}
        completedStepIds={pipelineCompleted}
        detail={pipelineDetail}
        errorMessage={pipelineError}
        slotProgress={pipelineSlotProgress}
        hideSlotProgress={pipelineBackgroundMode}
      />

      <ParcelSearchModal
        visible={queryVisible}
        onClose={() => setQueryVisible(false)}
        onSubmit={handleParcelQuery}
      />

      {mapCaptureVisible && tkgmData ? (
        <DroneMapCaptureModal
          visible
          tkgmData={tkgmData}
          mode={mapCaptureMode}
          sessionMaxFrames={mapCaptureSessionMax}
          totalMaxFrames={DRONE_SCENE_PACKAGE_ALLOWANCE}
          minFrames={mapCaptureMode === "new_scene" ? 1 : DRONE_SCENE_INITIAL_COUNT}
          onCancel={() => {
            setMapCaptureVisible(false);
            setMapCaptureMode("initial");
            if (mapCaptureMode === "initial") cancelPipeline();
          }}
          onContinue={handleMapCaptureContinue}
          onStatusChange={handleMapCaptureStatus}
          onNeedPurchase={() => setExtraScenePurchaseVisible(true)}
        />
      ) : null}

      <DroneVideoPurchaseModal
        visible={purchaseModalVisible}
        onClose={() => setPurchaseModalVisible(false)}
        onDismiss={handleDronePurchaseDismiss}
        referenceId={parcelReferenceId}
        parcel={parcel}
        parcelSummary={parcelSummary}
        onPurchaseSuccess={handleDroneLicensePurchaseSuccess}
      />

      <DroneExtraScenePurchaseModal
        visible={extraScenePurchaseVisible}
        onClose={handleExtraScenePurchaseDismiss}
        onDismiss={handleExtraScenePurchaseDismiss}
        referenceId={parcelReferenceId}
        jobId={jobId}
        preferredActionType={
          pendingNewSceneCapture
            ? resolveEkSahneActionForCount(pendingNewSceneCapture.images?.length ?? 1)
            : undefined
        }
        onPurchaseSuccess={() => void handleExtraScenePurchaseSuccess()}
      />

      <DroneCreditActionPurchaseModal
        visible={labelPurchaseVisible}
        onClose={() => setLabelPurchaseVisible(false)}
        actionType={PROPARCEL_LABEL_CREDIT_ACTION}
        headerTitle="ProParcel Etiketini Kaldır"
        productName="ProParcel etiket kaldırma"
        referenceId={jobId}
        description={parcelSummary || "Video önizlemesi ve dışa aktarımdan ProParcel etiketi kaldırılır."}
        serverSidePurchase
        onPurchaseSuccess={() => onProparcelLabelPurchaseSuccess()}
      />
    </MobileAiScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  scrollFlex: { flex: 1 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerBtnDisabled: { opacity: 0.45 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 + 24 + 72, gap: 0 },
  newProjectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: DRONE_SETTINGS_THEME.ctaBg,
    height: 50,
    borderRadius: 14,
    marginBottom: 12,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 17 },
  previewWrap: {
    marginBottom: 4,
  },
  sceneStripWrap: {
    marginBottom: 12,
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  previewHint: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 14 },
  panel: {
    backgroundColor: DRONE_SETTINGS_THEME.panelBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: DRONE_SETTINGS_THEME.panelBorder,
    gap: 10,
    marginTop: 12,
  },
  panelHint: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  panelLabel: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontWeight: "800", fontSize: 14 },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 10,
    padding: 12,
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    textAlignVertical: "top",
  },
  charCount: {
    alignSelf: "flex-end",
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 12,
    fontWeight: "600",
  },
  charCountAtLimit: {
    color: "#fbbf24",
  },
  rowBtns: { flexDirection: "row", gap: 8 },
  musicUploadBtn: { marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
    alignItems: "center",
  },
  secondaryBtnDisabled: { opacity: 0.55 },
  secondaryBtnText: { color: AI_DRONE_EDITOR_THEME.primaryBright, fontWeight: "800" },
});
