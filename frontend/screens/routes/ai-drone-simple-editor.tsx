/**
 * AI Drone — basit dikey video editörü (web ai-drone-video-editor + drone-editor portrait).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import ParcelSearchModal from "../../components/ParcelSearchModal";
import {
  MobileAiScreenHeader,
  MOBILE_AI_HEADER_COLORS,
} from "../../components/app/MobileAiScreenHeader";
import { PortraitVideoFrame } from "../../components/ai-drone-simple/PortraitVideoFrame";
import { DroneMapCaptureModal } from "../../components/ai-drone-simple/DroneMapCaptureModal";
import { DroneProductionPipelineSheet } from "../../components/ai-drone-simple/DroneProductionPipelinePanel";
import type { DroneProductionStepId } from "../../src/constants/aiDroneProductionPipeline";
import type { AdaParselSubmitPayload } from "../../components/AdaParselForm";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { storageService } from "../../services/storageService";
import {
  createUserCardAnnotation,
  droneRunwayVideoUrl,
  fetchProfileUserCardInfo,
  generateRunwayNarration,
  resolveDroneNarrationInputs,
  type DroneNarrationInputs,
  getRecommendedMusic,
  getPortraitExportStatus,
  getSubtitleSettings,
  runwayPrepPushRef,
  runwayPrepStartSimple,
  saveNarrationDraft,
  saveSubtitleSettings,
  selectMusic,
  startDroneRunwayProduction,
  startPortraitExport,
  waitForRunwayVideoReady,
  type DroneParcelQuery,
  type MusicTrack,
  type SubtitleSettings,
} from "../../services/aiDroneSimpleEditorService";
import {
  AI_DRONE_EDITOR_THEME,
  DEFAULT_PORTRAIT_SUBTITLE,
} from "../../src/constants/aiDroneEditorTheme";
import {
  extractNitelikText,
} from "../../src/utils/propertyTypeUtils";
import {
  fetchTkgmParcelByAdaParsel,
  formatTkgmResultSummary,
  type TkgmParcelResponse,
} from "../../src/utils/tkgmParcelQuery";
import { formatParcelAreaM2Tr } from "../../src/utils/parcelAreaFormatTr";

let Video: any = null;
try {
  const v = require("react-native-video");
  Video = v?.default || v;
} catch {
  Video = null;
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideo") ||
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideoView");

type TabKey = "video" | "narration" | "music";

export default function AiDroneSimpleEditorScreen() {
  const router = useRouter();
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
    if (detail !== undefined) setPipelineDetail(detail);
  }, []);

  const resetPipeline = useCallback(() => {
    setPipelineBusy(false);
    setPipelineVisible(false);
    setPipelineSheetOpen(false);
    setPipelineActiveStep(null);
    setPipelineCompleted(new Set());
    setPipelineDetail("");
    setPipelineError("");
  }, []);

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

  const [narrationText, setNarrationText] = useState("");
  const [narrationBusy, setNarrationBusy] = useState(false);

  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicBusy, setMusicBusy] = useState(false);
  const [selectedMusicId, setSelectedMusicId] = useState("");

  const [showUserCard, setShowUserCard] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitlePos, setSubtitlePos] = useState({ x: 0.5, y: 0.12 });
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_PORTRAIT_SUBTITLE);

  const [exportBusy, setExportBusy] = useState(false);
  const [authHeader, setAuthHeader] = useState<Record<string, string> | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storageService.getAccessToken();
      if (!cancelled && token) setAuthHeader({ Authorization: `Bearer ${token}` });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const videoSource = useMemo(() => {
    if (!videoUri) return null;
    if (videoUri.startsWith("file:") || videoUri.startsWith("content:")) return { uri: videoUri };
    if (authHeader) return { uri: videoUri, headers: authHeader };
    return { uri: videoUri };
  }, [videoUri, authHeader]);

  const handleParcelQuery = useCallback(async (payload: AdaParselSubmitPayload) => {
    setQueryVisible(false);
    setNarrationInputs(null);
    setNarrationText("");
    startPipeline();
    goPipelineStep("tkgm", "TKGM parsel sorgusu…");
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

    goPipelineStep("context", "İl / ilçe / mesafe verisi…");
    const narrCtx = await resolveDroneNarrationInputs(nextParcel, res.data, rawArea);
    setNarrationInputs(narrCtx);
    completePipelineStep("context");

    goPipelineStep("map_capture", "Haritadan 3 referans karesi alın");
    setMapCaptureVisible(true);
  }, [startPipeline, goPipelineStep, completePipelineStep, resetPipeline]);

  const handleMapCaptureClose = useCallback(() => {
    setMapCaptureVisible(false);
  }, []);

  const handleMapCaptureStatus = useCallback((detail: string) => {
    setPipelineVisible(true);
    setPipelineBusy(true);
    setPipelineDetail(detail);
    goPipelineStep("map_capture", detail);
  }, [goPipelineStep]);

  const runPipelineAfterCapture = useCallback(
    async (images: { uri: string; name: string; type: string }[]) => {
      if (!parcel) return;
      setPipelineBusy(true);
      setPipelineVisible(true);
      try {
        completePipelineStep("map_capture");
        goPipelineStep("narration", "Anlatım metni hazırlanıyor…");
        const narrCtx =
          narrationInputs ||
          (await resolveDroneNarrationInputs(parcel, tkgmData, parcelAreaM2));
        setNarrationInputs(narrCtx);

        let narr = narrationText;
        if (!narr.trim()) {
          const gen = await generateRunwayNarration(narrCtx);
          if (gen.ok) {
            narr = gen.text;
            setNarrationText(gen.text);
          }
        }
        completePipelineStep("narration");

        goPipelineStep("prep", "Runway job oluşturuluyor…");
        const prep = await runwayPrepStartSimple({ refFrameCount: images.length, promptText: narr });
        if (!prep.ok) throw new Error(prep.error);
        completePipelineStep("prep");

        goPipelineStep("ref_upload", `Kare 0/${images.length}`);
        for (let i = 0; i < images.length; i += 1) {
          setPipelineDetail(`Kare ${i + 1}/${images.length} yükleniyor…`);
          const pushed = await runwayPrepPushRef(prep.jobId, i + 1, images[i]!);
          if (!pushed.ok) throw new Error(pushed.error);
        }
        completePipelineStep("ref_upload");

        goPipelineStep("production", "AI video üretimi başlatılıyor…");
        const started = await startDroneRunwayProduction({
          parcel,
          preparedJobId: prep.jobId,
          refFrameCount: images.length,
          narrationText: narr,
          parcelAreaLabelTr: formatParcelAreaM2Tr(parcelAreaM2),
          city: narrCtx.city,
          district: narrCtx.district,
          quarter: narrCtx.quarter,
          fullSubtitleOnly: showSubtitles,
        });
        if (!started.ok) throw new Error(started.error);
        completePipelineStep("production");

        goPipelineStep("polling", "Video üretiliyor…");
        const wait = await waitForRunwayVideoReady(started.jobId, started.pollMs, 180, (info) => {
          const label = String(info.progress?.label || "").trim();
          setPipelineDetail(label || info.progress?.step || info.state || "Bekleniyor…");
        });
        if (!wait.ok) throw new Error(wait.error);
        completePipelineStep("polling");

        setJobId(started.jobId);
        setVideoUri(droneRunwayVideoUrl(started.jobId));
        goPipelineStep("ready", "Önizleme hazır");
        completePipelineStep("ready");
        setPipelineDetail("Video hazır");
        Alert.alert("Hazır", "Video üretildi. Seslendirme ve müzik sekmesinden düzenleyebilirsiniz.");
      } catch (e: any) {
        setPipelineError(e?.message || "İşlem tamamlanamadı.");
        Alert.alert("Video oluşturma", e?.message || "İşlem tamamlanamadı.");
      } finally {
        setPipelineBusy(false);
      }
    },
    [
      parcel,
      narrationText,
      parcelAreaM2,
      showSubtitles,
      narrationInputs,
      tkgmData,
      goPipelineStep,
      completePipelineStep,
    ],
  );

  const handleMapCaptured = useCallback(
    (images: { uri: string; name: string; type: string }[]) => {
      setMapCaptureVisible(false);
      void runPipelineAfterCapture(images);
    },
    [runPipelineAfterCapture],
  );

  const onGenerateNarration = useCallback(async () => {
    if (!parcel) {
      Alert.alert("Parsel", "Önce parsel seçin.");
      return;
    }
    setNarrationBusy(true);
    const narrCtx =
      narrationInputs || (await resolveDroneNarrationInputs(parcel, tkgmData, parcelAreaM2));
    setNarrationInputs(narrCtx);
    const gen = await generateRunwayNarration(narrCtx);
    setNarrationBusy(false);
    if (!gen.ok) {
      Alert.alert("Metin", gen.error);
      return;
    }
    setNarrationText(gen.text);
  }, [parcel, parcelAreaM2, narrationInputs, tkgmData]);

  const onSaveNarration = useCallback(async () => {
    if (!jobId) {
      Alert.alert("Kayıt", "Önce video oluşturun.");
      return;
    }
    const res = await saveNarrationDraft(jobId, narrationText);
    if (!res.ok) Alert.alert("Kayıt", res.error);
    else Alert.alert("Kaydedildi", "Seslendirme metni kaydedildi.");
  }, [jobId, narrationText]);

  const loadMusic = useCallback(async () => {
    if (!jobId) return;
    setMusicBusy(true);
    const res = await getRecommendedMusic(jobId);
    setMusicBusy(false);
    if (!res.ok) Alert.alert("Müzik", res.error);
    else setMusicTracks(res.tracks);
  }, [jobId]);

  useEffect(() => {
    if (activeTab === "music" && jobId) void loadMusic();
  }, [activeTab, jobId, loadMusic]);

  const onSelectMusic = useCallback(
    async (track: MusicTrack) => {
      if (!jobId) return;
      const id = String(track.id || track.title || "");
      const res = await selectMusic(jobId, track);
      if (!res.ok) Alert.alert("Müzik", res.error);
      else setSelectedMusicId(id);
    },
    [jobId],
  );

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
        x: subtitlePos.x,
        y: subtitlePos.y,
      };
      await saveSubtitleSettings(jobId, sub);

      if (showUserCard) {
        const prof = await fetchProfileUserCardInfo();
        if (prof.ok) await createUserCardAnnotation(jobId, prof.userInfo);
      }

      const started = await startPortraitExport(jobId);
      if (!started.ok) throw new Error(started.error);

      for (let i = 0; i < 90; i += 1) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await getPortraitExportStatus(jobId);
        if (st === "ready" || st === "done") {
          Alert.alert("Tamam", "Dikey video dışa aktarıldı.");
          return;
        }
        if (st === "failed" || st === "error") {
          throw new Error("Dışa aktarma başarısız.");
        }
      }
      Alert.alert("Kuyruk", "Dışa aktarma devam ediyor; bir süre sonra tekrar deneyin.");
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
    subtitlePos,
    subtitleSettings,
  ]);

  useEffect(() => {
    if (!jobId) return;
    void (async () => {
      const sub = await getSubtitleSettings(jobId);
      if (sub.ok && sub.settings) {
        setSubtitleSettings({ ...DEFAULT_PORTRAIT_SUBTITLE, ...sub.settings });
        if (typeof sub.settings.x === "number") {
          setSubtitlePos({ x: sub.settings.x, y: sub.settings.y ?? 0.12 });
        }
      }
    })();
  }, [jobId]);

  const previewPhrase = useMemo(() => {
    if (!narrationText.trim()) return "Altyazı önizlemesi";
    const words = narrationText.trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 5).join(" ");
  }, [narrationText]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={MOBILE_AI_HEADER_COLORS.statusBar} />
      <MobileAiScreenHeader
        title="Basit Video"
        onBack={() => router.back()}
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
      />

      <View style={styles.body}>
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
        {parcelSummary ? (
          <Text style={styles.meta} numberOfLines={2}>
            {parcelSummary}
          </Text>
        ) : null}

        <PortraitVideoFrame
          subtitleText={previewPhrase}
          subtitleEnabled={showSubtitles}
          subtitlePos={subtitlePos}
          onSubtitlePosChange={setSubtitlePos}
        >
          {videoSource && Video && hasNativeVideoView ? (
            <Video source={videoSource} style={StyleSheet.absoluteFill} resizeMode="cover" repeat muted />
          ) : (
            <View style={styles.previewPlaceholder}>
              {pipelineBusy ? (
                <>
                  <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} size="large" />
                  <Text style={styles.previewHint}>{pipelineDetail || "İşleniyor…"}</Text>
                </>
              ) : (
                <Text style={styles.previewHint}>Video önizlemesi (9:16)</Text>
              )}
            </View>
          )}
        </PortraitVideoFrame>

        <View style={styles.checkRow}>
          <View style={styles.checkItem}>
            <Switch value={showUserCard} onValueChange={setShowUserCard} />
            <Text style={styles.checkLabel}>Kullanıcı kartı eklensin</Text>
          </View>
          <View style={styles.checkItem}>
            <Switch value={showSubtitles} onValueChange={setShowSubtitles} />
            <Text style={styles.checkLabel}>Üst altyazı</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, pipelineBusy && styles.createBtnDisabled]}
          disabled={pipelineBusy}
          onPress={() => {
            if (!isAuthenticated) {
              Alert.alert("Giriş", "Video oluşturmak için giriş yapın.", [
                { text: "İptal", style: "cancel" },
                { text: "Giriş", onPress: () => router.push("login") },
              ]);
              return;
            }
            setQueryVisible(true);
          }}
        >
          <Ionicons name="videocam" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Video Oluştur</Text>
        </TouchableOpacity>

        <View style={styles.tabs}>
          {(
            [
              { id: "video" as const, label: "Video", icon: "film-outline" },
              { id: "narration" as const, label: "Seslendirme", icon: "mic-outline" },
              { id: "music" as const, label: "Müzik", icon: "musical-notes-outline" },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.id ? AI_DRONE_EDITOR_THEME.tabActive : AI_DRONE_EDITOR_THEME.mutedOnDark}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "video" ? (
          <View style={styles.panel}>
            <Text style={styles.panelHint}>
              Dikey (9:16) dışa aktarım. Güvenli alan çizgileri web editör ile aynıdır; altyazıyı üstte sürükleyebilirsiniz.
            </Text>
          </View>
        ) : null}

        {activeTab === "narration" ? (
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Seslendirme metni</Text>
            <TextInput
              style={styles.textArea}
              multiline
              value={narrationText}
              onChangeText={setNarrationText}
              placeholder="Anlatım metni…"
              placeholderTextColor={AI_DRONE_EDITOR_THEME.mutedOnDark}
            />
            <View style={styles.rowBtns}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void onGenerateNarration()} disabled={narrationBusy}>
                {narrationBusy ? (
                  <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Metin hazırla</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void onSaveNarration()}>
                <Text style={styles.secondaryBtnText}>Kaydet</Text>
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
              musicTracks.map((track, idx) => {
                const tid = String(track.id || track.title || idx);
                const active = tid === selectedMusicId;
                return (
                  <TouchableOpacity
                    key={tid}
                    style={[styles.musicRow, active && styles.musicRowActive]}
                    onPress={() => void onSelectMusic(track)}
                  >
                    <Text style={styles.musicTitle} numberOfLines={1}>
                      {track.title || "Parça"}
                    </Text>
                    <Text style={styles.musicArtist} numberOfLines={1}>
                      {track.artist || ""}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            {jobId && !musicBusy && musicTracks.length === 0 ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void loadMusic()}>
                <Text style={styles.secondaryBtnText}>Önerilen müzikleri yükle</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        </ScrollView>
      </View>

      <DroneProductionPipelineSheet
        active={pipelineVisible}
        open={pipelineSheetOpen}
        onOpenChange={setPipelineSheetOpen}
        busy={pipelineBusy}
        activeStepId={pipelineActiveStep}
        completedStepIds={pipelineCompleted}
        detail={pipelineDetail}
        errorMessage={pipelineError}
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
          onClose={handleMapCaptureClose}
          onCancel={cancelPipeline}
          onCaptured={handleMapCaptured}
          onStatusChange={handleMapCaptureStatus}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AI_DRONE_EDITOR_THEME.shell },
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
  scroll: { padding: 16, paddingBottom: 32 + 24 + 72, gap: 14 },
  meta: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 12 },
  previewPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  previewHint: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 14 },
  checkRow: { gap: 10 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkLabel: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontSize: 14, fontWeight: "600" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  tabs: {
    flexDirection: "row",
    backgroundColor: AI_DRONE_EDITOR_THEME.tabBar,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: "rgba(56, 189, 248, 0.2)" },
  tabText: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: AI_DRONE_EDITOR_THEME.tabActive },
  panel: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    gap: 10,
  },
  panelHint: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 13, lineHeight: 19 },
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
  rowBtns: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
    alignItems: "center",
  },
  secondaryBtnText: { color: AI_DRONE_EDITOR_THEME.primaryBright, fontWeight: "800" },
  musicRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  musicRowActive: { borderColor: AI_DRONE_EDITOR_THEME.primaryBright, backgroundColor: "rgba(56, 189, 248, 0.12)" },
  musicTitle: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontWeight: "700" },
  musicArtist: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 12, marginTop: 2 },
});
