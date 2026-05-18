import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";

import { useRouter } from "../../src/hooks/useNavigation";
import {
  confirmAiVideoStudioJob,
  createAiVideoStudioJob,
  deleteAiVideoStudioJob,
  generateAiVideoStudioScript,
  listAiVideoStudioJobs,
  type AiVideoStudioJob,
  type AiVideoStudioScript,
  type MobileUploadImage,
} from "../../services/aiVideoStudioService";

let Video: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const v = require("react-native-video");
  Video = v?.default || v;
} catch (e) {
  if (__DEV__) console.warn("[ai-video-studio.tsx] react-native-video unavailable", e);
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideo") ||
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideoView") ||
  !!(UIManager as any)?.getViewManagerConfig?.("ReactExoplayerView");

const MAX_IMAGES = 5;
const MAX_TEXT_CHARS = 420;

function latestJob(items: AiVideoStudioJob[]): AiVideoStudioJob | null {
  return [...items].sort(
    (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime(),
  )[0] || null;
}

export default function AiVideoStudioScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("AI Video");
  const [bodyText, setBodyText] = useState("");
  const [images, setImages] = useState<MobileUploadImage[]>([]);
  const [jobs, setJobs] = useState<AiVideoStudioJob[]>([]);
  const [scriptDraft, setScriptDraft] = useState<AiVideoStudioScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const currentJob = useMemo(() => latestJob(jobs), [jobs]);
  const canSubmit =
    images.length > 0 &&
    images.length <= MAX_IMAGES &&
    bodyText.trim().length > 0 &&
    bodyText.length <= MAX_TEXT_CHARS;

  const refreshJobs = useCallback(async () => {
    const result = await listAiVideoStudioJobs();
    if (!result.ok) {
      throw new Error(result.error);
    }
    setJobs(result.items);
    return result.items;
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
  }, [refreshJobs]);

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
    if (!canSubmit) {
      Alert.alert("Eksik", "En az 1 görsel ve geçerli bir video metni girin.");
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
      Alert.alert("Hazır", "Video metni hazır. Düzenleyip onaylayabilirsiniz.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Metin hazırlanamadı.");
    } finally {
      setSubmitting(false);
    }
  }, [bodyText, canSubmit, images, refreshJobs, title]);

  const onConfirm = useCallback(async () => {
    if (!currentJob?.job_id || !scriptDraft?.full_narration?.trim()) {
      Alert.alert("Eksik", "Önce script hazırlayın.");
      return;
    }
    setConfirming(true);
    try {
      const result = await confirmAiVideoStudioJob(currentJob.job_id, scriptDraft.full_narration);
      if (!result.ok) throw new Error(result.error);
      setScriptDraft(null);
      await refreshJobs();
      Alert.alert("Başladı", "Video üretimi başladı. Durum otomatik yenilenecek.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Video üretimi başlatılamadı.");
    } finally {
      setConfirming(false);
    }
  }, [currentJob?.job_id, refreshJobs, scriptDraft]);

  const onDeleteLatest = useCallback(async () => {
    if (!currentJob?.job_id) return;
    Alert.alert("Sil", "Son AI video işini silmek istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteAiVideoStudioJob(currentJob.job_id);
            if (!result.ok) throw new Error(result.error);
            setScriptDraft(null);
            await refreshJobs();
            Alert.alert("Silindi", "Son iş kaldırıldı.");
          } catch (e: any) {
            Alert.alert("Hata", e?.message || "İş silinemedi.");
          }
        },
      },
    ]);
  }, [currentJob?.job_id, refreshJobs]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Video Oluşturucu</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Yeni video</Text>
            <Text style={styles.hint}>
              En fazla 5 görsel seçin. 30 saniyelik video için metin sınırı korunur ve küfür filtresi uygulanır.
            </Text>

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
            <Text style={styles.counter}>{bodyText.length}/{MAX_TEXT_CHARS} karakter</Text>

            <TouchableOpacity style={[styles.secondaryBtn, styles.spacingTop]} onPress={pickImages} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={18} color="#0f172a" />
              <Text style={styles.secondaryBtnText}>Görsel Seç</Text>
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
                style={[styles.primaryBtn, (!canSubmit || submitting) && styles.btnDisabled]}
                onPress={onPrepare}
                disabled={!canSubmit || submitting}
              >
                <Ionicons name="sparkles-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>{submitting ? "Metin hazırlanıyor..." : "Metni Hazırla"}</Text>
              </TouchableOpacity>
              {currentJob ? (
                <TouchableOpacity style={styles.ghostBtn} onPress={onDeleteLatest}>
                  <Ionicons name="trash-outline" size={18} color="#0f172a" />
                  <Text style={styles.ghostBtnText}>Son İşi Sil</Text>
                </TouchableOpacity>
              ) : null}
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
              <Text style={styles.counter}>{(scriptDraft.full_narration || "").length}/{MAX_TEXT_CHARS} karakter</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, confirming && styles.btnDisabled, styles.spacingTop]}
                onPress={onConfirm}
                disabled={confirming}
              >
                <Ionicons name="film-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>{confirming ? "Video üretimi başlıyor..." : "Metni Onayla ve Üret"}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {currentJob ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Son durum</Text>
              <Text style={styles.statusLine}>Durum: {currentJob.progress?.label || currentJob.status}</Text>
              {currentJob.status === "processing" &&
              currentJob.progress?.index != null &&
              currentJob.progress?.total != null ? (
                <Text style={styles.hint}>
                  Sahne {currentJob.progress.index}/{currentJob.progress.total}
                </Text>
              ) : null}
              {currentJob.progress?.detail ? <Text style={styles.hint}>{currentJob.progress.detail}</Text> : null}
              {currentJob.status === "failed" && currentJob.error_message ? (
                <Text style={styles.errorBox} selectable>
                  {String(currentJob.error_message)}
                </Text>
              ) : null}
              {currentJob.status === "processing" ? (
                <Text style={styles.pollHint}>Durum ~2,5 sn’de bir yenilenir.</Text>
              ) : null}
              {currentJob.thumbnail_url ? (
                <Image source={{ uri: currentJob.thumbnail_url }} style={styles.readyThumb} resizeMode="cover" />
              ) : null}
              {currentJob.processed_url && Video && hasNativeVideoView ? (
                <View style={styles.playerWrap}>
                  <Video
                    source={{ uri: currentJob.processed_url }}
                    style={styles.player}
                    controls
                    resizeMode="contain"
                    paused
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e293b" },
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
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", flex: 1, textAlign: "center" },
  headerRight: { width: 36, height: 36 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  content: { flex: 1, backgroundColor: "#f8fafc" },
  contentInner: { padding: 16, gap: 14, paddingBottom: 28 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  hint: { marginTop: 8, color: "#64748b", lineHeight: 20 },
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
    backgroundColor: "#3b82f6",
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
  readyThumb: {
    marginTop: 12,
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#cbd5e1",
  },
  playerWrap: {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
    height: 220,
  },
  player: { width: "100%", height: "100%" },
});
