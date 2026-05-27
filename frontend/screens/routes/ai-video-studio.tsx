import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";

import { useRoute, useRouter } from "../../src/hooks/useNavigation";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { creditService } from "../../services/creditService";
import {
  absoluteStudioMediaUrl,
  confirmAiVideoStudioJob,
  createAiVideoStudioJob,
  deleteAiVideoStudioJob,
  formatStudioQuoteSummary,
  generateAiVideoStudioScript,
  getAiVideoStudioQuote,
  listAiVideoStudioJobs,
  type AiVideoStudioJob,
  type AiVideoStudioQuote,
  type AiVideoStudioScript,
  type MobileUploadImage,
} from "../../services/aiVideoStudioService";

let Video: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const v = require("react-native-video");
  Video = v?.default || v;
} catch (e) {
  if (__DEV__) console.warn("[ai-video-studio] react-native-video unavailable", e);
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideo") ||
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideoView") ||
  !!(UIManager as any)?.getViewManagerConfig?.("ReactExoplayerView");

const MAX_IMAGES = 5;
const MAX_TEXT_CHARS = 420;

const COLORS = {
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
  text: "#1e293b",
  muted: "#64748b",
  primary: "#1a5fb4",
  border: "#e2e8f0",
} as const;

type TabKey = "create" | "videos";

function latestJob(items: AiVideoStudioJob[]): AiVideoStudioJob | null {
  return [...items].sort(
    (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime(),
  )[0] || null;
}

function statusLabel(status: string | undefined): string {
  const s = String(status || "").trim();
  if (s === "ready") return "Hazır";
  if (s === "processing") return "Üretiliyor";
  if (s === "script_ready") return "Metin hazır";
  if (s === "failed") return "Başarısız";
  if (s === "draft") return "Taslak";
  return s || "—";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export default function AiVideoStudioScreen() {
  const router = useRouter();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const routeParams = (route.params || {}) as { tab?: TabKey; jobId?: string };

  const [activeTab, setActiveTab] = useState<TabKey>(routeParams.tab === "videos" ? "videos" : "create");
  const [title, setTitle] = useState("AI Video");
  const [bodyText, setBodyText] = useState("");
  const [images, setImages] = useState<MobileUploadImage[]>([]);
  const [jobs, setJobs] = useState<AiVideoStudioJob[]>([]);
  const [scriptDraft, setScriptDraft] = useState<AiVideoStudioScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [quote, setQuote] = useState<AiVideoStudioQuote | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(routeParams.jobId || null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const currentJob = useMemo(() => latestJob(jobs), [jobs]);
  const prepareJobId = useMemo(() => currentJob?.job_id || null, [currentJob?.job_id]);

  const canPrepareText =
    bodyText.trim().length > 0 && bodyText.length <= MAX_TEXT_CHARS && !submitting;

  const selectedJob = useMemo(
    () => jobs.find((j) => j.job_id === selectedJobId) || null,
    [jobs, selectedJobId],
  );

  const refreshJobs = useCallback(async () => {
    const result = await listAiVideoStudioJobs();
    if (!result.ok) {
      throw new Error(result.error);
    }
    setJobs(result.items);
    return result.items;
  }, []);

  const refreshQuote = useCallback(async (imageCount: number) => {
    if (imageCount < 1) {
      setQuote(null);
      return;
    }
    const res = await getAiVideoStudioQuote(imageCount);
    if (res.ok) setQuote(res.quote);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const items = await refreshJobs();
        if (!cancelled) {
          const latest = latestJob(items);
          const preview = (latest?.scene_metadata?.script_preview || null) as AiVideoStudioScript | null;
          if (latest?.status === "script_ready" && preview) {
            setScriptDraft(preview);
          } else {
            setScriptDraft(null);
          }
          if (routeParams.jobId) {
            setSelectedJobId(routeParams.jobId);
            setActiveTab("videos");
          }
        }
        const balRes = await creditService.getBalance();
        if (!cancelled && balRes.success && balRes.data) {
          setBalance(typeof balRes.data.balance === "number" ? balRes.data.balance : null);
        }
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert("Hata", e?.message || "İşler yüklenemedi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshJobs, routeParams.jobId]);

  useEffect(() => {
    refreshQuote(images.length).catch(() => {});
  }, [images.length, refreshQuote]);

  useEffect(() => {
    if (!jobs.some((item) => item?.status === "processing")) return undefined;
    const tick = () => refreshJobs().catch(() => {});
    tick();
    const timer = setInterval(tick, 2500);
    return () => clearInterval(timer);
  }, [jobs, refreshJobs]);

  const pickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert("Limit", `En fazla ${MAX_IMAGES} görsel seçebilirsiniz.`);
      return;
    }
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.85,
      selectionLimit: remaining,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert("Hata", result.errorMessage || "Görseller seçilemedi");
      return;
    }
    const nextAssets = (result.assets || [])
      .filter((asset) => !!asset.uri)
      .map((asset, index) => ({
        uri: String(asset.uri),
        name: asset.fileName || `ai_video_${Date.now()}_${index}.jpg`,
        type: asset.type || "image/jpeg",
      }));
    if (!nextAssets.length) return;
    setImages((prev) => {
      const seen = new Set(prev.map((item) => item.uri));
      const merged = [...prev];
      nextAssets.forEach((item) => {
        if (!seen.has(item.uri) && merged.length < MAX_IMAGES) {
          seen.add(item.uri);
          merged.push(item);
        }
      });
      return merged;
    });
  }, [images.length]);

  const onPrepare = useCallback(async () => {
    if (!canPrepareText) {
      Alert.alert("Eksik", "Geçerli bir video metni girin (en fazla 420 karakter).");
      return;
    }
    if (!images.length) {
      Alert.alert("Görsel gerekli", "Metin hazırlamak için en az 1 görsel seçin.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createAiVideoStudioJob({ title, bodyText, images });
      if (!created.ok) throw new Error(created.error);
      const generated = await generateAiVideoStudioScript(created.job.job_id);
      if (!generated.ok) throw new Error(generated.error);
      setScriptDraft(generated.script);
      await refreshJobs();
      Alert.alert("Hazır", "Video metni hazır. Düzenleyip Video Oluştur ile onaylayabilirsiniz.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Metin hazırlanamadı.");
    } finally {
      setSubmitting(false);
    }
  }, [bodyText, canPrepareText, images, refreshJobs, title]);

  const runConfirm = useCallback(async () => {
    const jobId = prepareJobId;
    if (!jobId || !scriptDraft?.full_narration?.trim()) {
      Alert.alert("Eksik", "Önce metin hazırlayın.");
      return;
    }
    setConfirming(true);
    try {
      const result = await confirmAiVideoStudioJob(jobId, scriptDraft.full_narration);
      if (!result.ok) {
        if (result.status === 402) {
          Alert.alert(
            "Yetersiz kredi",
            `${result.error}\n\nTepe Kredi satın alarak devam edebilirsiniz.`,
            [
              { text: "İptal", style: "cancel" },
              { text: "Paketler", onPress: () => router.push("pricing") },
            ],
          );
          return;
        }
        throw new Error(result.error);
      }
      setScriptDraft(null);
      await refreshJobs();
      const balRes = await creditService.getBalance();
      if (balRes.success && balRes.data) {
        setBalance(typeof balRes.data.balance === "number" ? balRes.data.balance : null);
      }
      Alert.alert("Başladı", "Video üretimi başladı. Hazır olunca bildirim alacaksınız.");
      setActiveTab("videos");
      setSelectedJobId(jobId);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Video üretimi başlatılamadı.");
    } finally {
      setConfirming(false);
    }
  }, [prepareJobId, refreshJobs, router, scriptDraft]);

  const onCreateVideo = useCallback(() => {
    if (!scriptDraft?.full_narration?.trim()) {
      Alert.alert("Eksik", "Önce metin hazırlayın.");
      return;
    }
    const summary = formatStudioQuoteSummary(quote);
    const balanceLine =
      balance != null ? `\n\nMevcut bakiye: ${balance} Tepe Kredi` : "";
    Alert.alert(
      "Video Oluştur",
      `${summary || "Üretim ücreti hesaplanıyor."}\n\nOnayladığınızda video üretimi başlar. Kredi, video başarıyla hazır olunca düşülür.${balanceLine}\n\nHazır olunca bildirim alacaksınız.`,
      [
        { text: "İptal", style: "cancel" },
        { text: "Oluştur", onPress: () => runConfirm() },
      ],
    );
  }, [balance, quote, runConfirm, scriptDraft]);

  const onDeleteJob = useCallback(
    async (jobId: string) => {
      Alert.alert("Sil", "Bu AI video işini silmek istiyor musunuz?", [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deleteAiVideoStudioJob(jobId);
              if (!result.ok) throw new Error(result.error);
              if (selectedJobId === jobId) setSelectedJobId(null);
              if (prepareJobId === jobId) setScriptDraft(null);
              await refreshJobs();
            } catch (e: any) {
              Alert.alert("Hata", e?.message || "İş silinemedi.");
            }
          },
        },
      ]);
    },
    [prepareJobId, refreshJobs, selectedJobId],
  );

  const onDownloadVideo = useCallback(async (job: AiVideoStudioJob) => {
    const url = absoluteStudioMediaUrl(job.processed_url);
    if (!url || job.status !== "ready") {
      Alert.alert("Hata", "İndirilebilir video bulunamadı.");
      return;
    }
    setDownloadingId(job.job_id);
    try {
      const ext = url.includes(".mp4") ? "mp4" : "mp4";
      const path = `${RNFS.CachesDirectoryPath}/ai_studio_${job.job_id}.${ext}`;
      const dl = await RNFS.downloadFile({ fromUrl: url, toFile: path }).promise;
      if (dl.statusCode && dl.statusCode >= 400) {
        throw new Error(`İndirme başarısız (HTTP ${dl.statusCode})`);
      }
      const shareUrl = Platform.OS === "ios" ? path : `file://${path}`;
      await Share.share({
        url: shareUrl,
        message: job.title || "AI Video",
        title: job.title || "AI Video",
      });
    } catch (e: any) {
      const open = await Linking.canOpenURL(url);
      if (open) {
        Alert.alert(
          "İndirme",
          "Dosya paylaşımı açılamadı. Videoyu tarayıcıda açmak ister misiniz?",
          [
            { text: "İptal", style: "cancel" },
            { text: "Aç", onPress: () => Linking.openURL(url) },
          ],
        );
      } else {
        Alert.alert("Hata", e?.message || "Video indirilemedi.");
      }
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const renderCreateTab = () => (
    <>
      <View style={styles.infoBanner}>
        <Ionicons name="desktop-outline" size={18} color="#1d4ed8" />
        <Text style={styles.infoBannerText}>
          Detaylı video düzenlemeleri için masaüstü bilgisayardan giriş yapın.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Yeni video</Text>
        <Text style={styles.hint}>
          En fazla {MAX_IMAGES} görsel. İlk 3 görsel AI Video paketi; ek görseller ek kare ücreti ile
          fiyatlandırılır. Kredi, video başarıyla hazır olunca düşülür.
        </Text>
        {balance != null ? (
          <Text style={styles.balanceLine}>Bakiye: {balance} Tepe Kredi</Text>
        ) : null}
        {quote && images.length > 0 ? (
          <Text style={styles.quoteLine}>{formatStudioQuoteSummary(quote).replace(/\n/g, " · ")}</Text>
        ) : null}

        <Text style={styles.label}>Başlık</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          maxLength={80}
          placeholder="AI Video"
          placeholderTextColor="#94a3b8"
        />

        <Text style={[styles.label, styles.spacingTop]}>Video metni</Text>
        <TextInput
          value={bodyText}
          onChangeText={setBodyText}
          style={[styles.input, styles.textarea]}
          maxLength={MAX_TEXT_CHARS}
          multiline
          textAlignVertical="top"
          placeholder="Seslendirmede okunacak metni yazın."
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.counter}>
          {bodyText.length}/{MAX_TEXT_CHARS} karakter
        </Text>

        <TouchableOpacity style={[styles.secondaryBtn, styles.spacingTop]} onPress={pickImages} activeOpacity={0.85}>
          <Ionicons name="images-outline" size={18} color="#0f172a" />
          <Text style={styles.secondaryBtnText}>Görsel Seç ({images.length}/{MAX_IMAGES})</Text>
        </TouchableOpacity>

        {images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={styles.imageCard}>
                <Image source={{ uri: image.uri }} style={styles.imageThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== index))}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, !canPrepareText && styles.btnDisabled]}
            onPress={onPrepare}
            disabled={!canPrepareText}
          >
            <Ionicons name="sparkles-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{submitting ? "Metin hazırlanıyor..." : "Metin Hazırla"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {scriptDraft ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Script önizleme</Text>
          <TextInput
            value={scriptDraft.full_narration || ""}
            onChangeText={(value) => setScriptDraft((prev) => (prev ? { ...prev, full_narration: value } : prev))}
            style={[styles.input, styles.textarea]}
            maxLength={MAX_TEXT_CHARS}
            multiline
            textAlignVertical="top"
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.counter}>
            {(scriptDraft.full_narration || "").length}/{MAX_TEXT_CHARS} karakter
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, confirming && styles.btnDisabled, styles.spacingTop]}
            onPress={onCreateVideo}
            disabled={confirming}
          >
            <Ionicons name="film-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{confirming ? "Başlatılıyor..." : "Video Oluştur"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {currentJob && currentJob.status === "processing" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Üretim durumu</Text>
          <Text style={styles.statusLine}>{currentJob.progress?.label || currentJob.status}</Text>
          {currentJob.progress?.detail ? <Text style={styles.hint}>{currentJob.progress.detail}</Text> : null}
          <Text style={styles.pollHint}>Durum ~2,5 sn’de bir yenilenir. Videolarım sekmesinden takip edin.</Text>
        </View>
      ) : null}
    </>
  );

  const renderVideosTab = () => (
    <>
      {jobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="film-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyText}>Henüz video yok. Web veya mobilde oluşturduğunuz videolar burada listelenir.</Text>
        </View>
      ) : (
        jobs.map((job) => {
          const thumb = absoluteStudioMediaUrl(job.thumbnail_url);
          const isSelected = selectedJobId === job.job_id;
          const videoUrl = absoluteStudioMediaUrl(job.processed_url);
          return (
            <View key={job.job_id} style={[styles.card, isSelected && styles.cardSelected]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSelectedJobId(isSelected ? null : job.job_id)}
              >
                <View style={styles.jobRow}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.jobThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.jobThumb, styles.jobThumbPlaceholder]}>
                      <Ionicons name="videocam-outline" size={22} color="#94a3b8" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle}>{job.title || "AI Video"}</Text>
                    <Text style={styles.jobMeta}>
                      {statusLabel(job.status)}
                      {job.source === "ai_studio" || !job.source ? " · Studio" : ` · ${job.source}`}
                    </Text>
                    <Text style={styles.jobDate}>{formatDate(job.created_at)}</Text>
                  </View>
                  <Ionicons name={isSelected ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
                </View>
              </TouchableOpacity>

              {isSelected ? (
                <View style={styles.jobDetail}>
                  {job.status === "failed" && job.error_message ? (
                    <Text style={styles.errorBox} selectable>
                      {String(job.error_message)}
                    </Text>
                  ) : null}
                  {job.status === "processing" ? (
                    <Text style={styles.hint}>{job.progress?.label || "Üretiliyor..."}</Text>
                  ) : null}
                  {job.status === "ready" && videoUrl && Video && hasNativeVideoView ? (
                    <View style={styles.playerWrap}>
                      <Video
                        source={{ uri: videoUrl }}
                        style={styles.player}
                        controls
                        resizeMode="contain"
                        paused={false}
                      />
                    </View>
                  ) : null}
                  {job.status === "ready" && videoUrl ? (
                    <View style={styles.detailActions}>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => onDownloadVideo(job)}
                        disabled={downloadingId === job.job_id}
                      >
                        {downloadingId === job.job_id ? (
                          <ActivityIndicator size="small" color="#0f172a" />
                        ) : (
                          <>
                            <Ionicons name="download-outline" size={18} color="#0f172a" />
                            <Text style={styles.secondaryBtnText}>İndir / Paylaş</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.ghostBtn} onPress={() => onDeleteJob(job.job_id)}>
                        <Ionicons name="trash-outline" size={18} color="#0f172a" />
                        <Text style={styles.ghostBtnText}>Sil</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => onDeleteJob(job.job_id)}>
                      <Ionicons name="trash-outline" size={18} color="#0f172a" />
                      <Text style={styles.ghostBtnText}>Sil</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Video Oluşturucu</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "create" && styles.tabBtnActive]}
          onPress={() => setActiveTab("create")}
        >
          <Text style={[styles.tabBtnText, activeTab === "create" && styles.tabBtnTextActive]}>Oluştur</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "videos" && styles.tabBtnActive]}
          onPress={() => setActiveTab("videos")}
        >
          <Text style={[styles.tabBtnText, activeTab === "videos" && styles.tabBtnTextActive]}>Videolarım</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <KeyboardAwareScrollScreen
          headerHeight={63}
          backgroundColor={COLORS.pageBg}
          style={styles.content}
          contentContainerStyle={[styles.contentInner, { paddingBottom: 28 + insets.bottom }]}
        >
          {activeTab === "create" ? renderCreateTab() : renderVideosTab()}
        </KeyboardAwareScrollScreen>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1e293b" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold", color: "#fff" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.pageBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabBtnText: { color: COLORS.muted, fontWeight: "700", fontSize: 14 },
  tabBtnTextActive: { color: "#fff" },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.pageBg },
  content: { flex: 1, backgroundColor: COLORS.pageBg },
  contentInner: { padding: 16, gap: 14 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoBannerText: { flex: 1, color: "#1e40af", lineHeight: 20, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardSelected: { borderColor: "#3b82f6" },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: { color: "#64748b", textAlign: "center", lineHeight: 20, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  hint: { marginTop: 8, color: "#64748b", lineHeight: 20 },
  balanceLine: { marginTop: 8, color: "#0f172a", fontWeight: "800" },
  quoteLine: { marginTop: 6, color: "#475569", fontSize: 12, lineHeight: 18 },
  label: { marginTop: 12, marginBottom: 6, color: "#475569", fontWeight: "800", fontSize: 12 },
  spacingTop: { marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  textarea: { minHeight: 140 },
  counter: { marginTop: 6, color: "#64748b", fontSize: 12, textAlign: "right" },
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryBtnText: { color: "#0f172a", fontWeight: "800" },
  imageRow: { paddingTop: 12, gap: 10 },
  imageCard: { width: 108, position: "relative" },
  imageThumb: {
    width: 108,
    height: 108,
    borderRadius: 12,
    backgroundColor: "#cbd5e1",
  },
  removeImageBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: { marginTop: 14, gap: 10 },
  primaryBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },
  ghostBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  ghostBtnText: { color: "#0f172a", fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
  statusLine: { marginTop: 8, color: "#0f172a", fontWeight: "700" },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 18,
  },
  pollHint: { marginTop: 8, color: "#94a3b8", fontSize: 12 },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  jobThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#cbd5e1" },
  jobThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  jobTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  jobMeta: { marginTop: 4, color: "#64748b", fontWeight: "700", fontSize: 12 },
  jobDate: { marginTop: 2, color: "#94a3b8", fontSize: 11 },
  jobDetail: { marginTop: 12, gap: 10 },
  detailActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  playerWrap: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
    height: 220,
  },
  player: { width: "100%", height: "100%" },
});
