/**
 * AI Drone iş detayı — durum, teslim al, indirme, editör mesajı, 5 yıldız geri bildirim.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRoute } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { KeyboardAwareScrollScreen } from "../../components/app/KeyboardAwareScrollScreen";
import { AiDroneJobStatusBadge } from "../../components/ai-drone/AiDroneJobStatusBadge";
import { StarRatingInput } from "../../components/ai-drone/StarRatingInput";
import { aiDroneProparcelService, type AiDroneJobDetail } from "../../services/aiDroneProparcelService";
import { canDownloadDroneJob } from "../../src/utils/aiDroneJobStatus";
import { DJANGO_API_URL } from "../../config/api";

const COLORS = {
  headerBg: "#0f172a",
  pageBg: "#f1f5f9",
  cardBg: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#3b82f6",
  success: "#16a34a",
} as const;

function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function absoluteAvatarUrl(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = DJANGO_API_URL.replace(/\/$/, "");
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export default function AiDroneJobDetailScreen() {
  const router = useRouter();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const requestId = Number((route.params as { requestId?: string })?.requestId || 0);

  const [job, setJob] = useState<AiDroneJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);

  const load = useCallback(async () => {
    if (!requestId || requestId < 1) {
      setError("Geçersiz iş numarası");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await aiDroneProparcelService.getMyRequestDetail(requestId);
    if (!res.ok) {
      setError(res.error);
      setJob(null);
    } else {
      setJob(res.data);
      setRatingDraft(res.data.userRating?.stars || 0);
    }
    setLoading(false);
  }, [requestId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDownload = useCallback(async () => {
    const url = String(job?.deliveryUrl || "").trim();
    if (!url) {
      Alert.alert("İndirme", "Video linki henüz eklenmedi.");
      return;
    }
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else Alert.alert("Video linki", url);
  }, [job?.deliveryUrl]);

  const onAcceptDelivery = useCallback(() => {
    if (!job) return;
    Alert.alert(
      "Teslim aldım",
      "Videoyu incelediğinizi ve teslimi kabul ettiğinizi onaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Teslim aldım",
          onPress: async () => {
            setAcceptBusy(true);
            const res = await aiDroneProparcelService.acceptDelivery(job.id);
            setAcceptBusy(false);
            if (!res.ok) {
              Alert.alert("İşlem", res.error);
              return;
            }
            Alert.alert("Teşekkürler", "Teslim kaydedildi. İsterseniz geri bildirim verebilirsiniz.");
            void load();
          },
        },
      ],
    );
  }, [job, load]);

  const submitRating = useCallback(async () => {
    if (!job || ratingDraft < 1) {
      Alert.alert("Puanlama", "Lütfen 1–5 arası yıldız seçin.");
      return;
    }
    setRatingBusy(true);
    const res = await aiDroneProparcelService.submitFeedback(job.id, ratingDraft);
    setRatingBusy(false);
    if (!res.ok) {
      Alert.alert("Puanlama", res.error);
      return;
    }
    Alert.alert("Teşekkürler", "Geri bildiriminiz kaydedildi.");
    void load();
  }, [job, ratingDraft, load]);

  const openEditorChat = useCallback(() => {
    if (!job?.editor?.userId) {
      Alert.alert("Mesaj", "Editör henüz atanmadı.");
      return;
    }
    router.push("ai-drone-editor-chat", {
      editorUserId: String(job.editor.userId),
      editorName: job.editor.displayName,
      requestId: String(job.id),
    });
  }, [job, router]);

  const downloadable = job ? canDownloadDroneJob(job.status, job.deliveryUrl) : false;
  const editor = job?.editor;
  const avatarUri = absoluteAvatarUrl(editor?.avatarUrl);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>İş detayı</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : error || !job ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "İş bulunamadı"}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void load()}>
            <Text style={styles.secondaryBtnText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAwareScrollScreen
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        >
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.jobId}>İş #{job.id}</Text>
              <AiDroneJobStatusBadge status={job.status} statusLabel={job.statusLabel} />
            </View>
            <Text style={styles.metaLabel}>Oluşturulma</Text>
            <Text style={styles.metaValue}>{formatDate(job.createdAt)}</Text>
            {job.editorDeliveredAt ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 12 }]}>Editör teslimi</Text>
                <Text style={styles.metaValue}>{formatDate(job.editorDeliveredAt)}</Text>
              </>
            ) : null}
            {job.userAcceptedAt ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 12 }]}>Sizin teslim onayınız</Text>
                <Text style={styles.metaValue}>{formatDate(job.userAcceptedAt)}</Text>
              </>
            ) : null}
            {job.parcelSummary ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 12 }]}>Parsel özeti</Text>
                <Text style={styles.summary}>{job.parcelSummary}</Text>
              </>
            ) : null}
            {job.userNote ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 12 }]}>Talep notunuz</Text>
                <Text style={styles.summary}>{job.userNote}</Text>
              </>
            ) : null}
            {job.showUserCard ? (
              <Text style={styles.userCardFlag}>Videoda kullanıcı kartı istendi</Text>
            ) : null}
          </View>

          {job.timeline && job.timeline.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Süreç</Text>
              {job.timeline.map((step) => (
                <View key={step.key} style={styles.timelineRow}>
                  <Ionicons
                    name={step.done ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={step.done ? COLORS.success : COLORS.muted}
                  />
                  <View style={styles.timelineText}>
                    <Text style={styles.timelineLabel}>{step.label}</Text>
                    {step.at ? <Text style={styles.timelineAt}>{formatDate(step.at)}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {job.canAcceptDelivery ? (
            <TouchableOpacity
              style={[styles.acceptBtn, acceptBusy && styles.primaryBtnDisabled]}
              onPress={onAcceptDelivery}
              disabled={acceptBusy}
              activeOpacity={0.85}
            >
              {acceptBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                  <Text style={styles.acceptBtnText}>Teslim aldım</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {downloadable ? (
            <TouchableOpacity style={styles.downloadBtn} onPress={() => void openDownload()} activeOpacity={0.85}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>Videoyu indir / izle</Text>
            </TouchableOpacity>
          ) : !job.canAcceptDelivery ? (
            <View style={styles.infoBanner}>
              <Ionicons name="time-outline" size={20} color={COLORS.muted} />
              <Text style={styles.infoBannerText}>
                Video hazır olduğunda indirme linki ve teslim onayı burada görünecek.
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Üretici / Editör</Text>
            {editor ? (
              <View style={styles.editorRow}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={28} color={COLORS.muted} />
                  </View>
                )}
                <View style={styles.editorInfo}>
                  <Text style={styles.editorName}>{editor.displayName}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.placeholder}>Editör atandığında bilgiler burada görünür.</Text>
            )}
            {job.canMessageEditor ? (
              <TouchableOpacity style={styles.messageBtn} onPress={openEditorChat} activeOpacity={0.85}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.accent} />
                <Text style={styles.messageBtnText}>Editörle mesajlaş</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Geri bildirim</Text>
            <Text style={styles.sectionHint}>Hizmeti 5 yıldız üzerinden değerlendirin (yalnızca puan).</Text>
            {job.userRating?.stars ? (
              <>
                <StarRatingInput value={job.userRating.stars} readonly label="Verdiğiniz puan" />
                {job.userRating.submittedAt ? (
                  <Text style={styles.ratedAt}>Gönderim: {formatDate(job.userRating.submittedAt)}</Text>
                ) : null}
              </>
            ) : job.canSubmitFeedback ? (
              <>
                <StarRatingInput value={ratingDraft} onChange={setRatingDraft} label="Puanınız" />
                <TouchableOpacity
                  style={[styles.primaryBtn, (ratingDraft < 1 || ratingBusy) && styles.primaryBtnDisabled]}
                  onPress={() => void submitRating()}
                  disabled={ratingDraft < 1 || ratingBusy}
                >
                  {ratingBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Puanı gönder</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.placeholder}>
                {job.canAcceptDelivery
                  ? "Önce teslimi onaylayın; ardından puan verebilirsiniz."
                  : "Puanlama, teslim sonrası açılır."}
              </Text>
            )}
          </View>
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
  scroll: { flex: 1, backgroundColor: COLORS.pageBg },
  scrollContent: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: COLORS.pageBg },
  errorText: { fontSize: 15, color: "#b91c1c", textAlign: "center", marginBottom: 12 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  jobId: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  metaLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { fontSize: 15, color: COLORS.text, marginTop: 4 },
  summary: { fontSize: 14, color: COLORS.text, lineHeight: 21, marginTop: 4 },
  userCardFlag: { fontSize: 13, color: COLORS.accent, fontWeight: "600", marginTop: 12 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  timelineText: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  timelineAt: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  acceptBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  downloadBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  infoBannerText: { flex: 1, fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text, marginBottom: 10 },
  sectionHint: { fontSize: 13, color: COLORS.muted, marginBottom: 12, lineHeight: 18 },
  editorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#e2e8f0" },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  editorInfo: { flex: 1 },
  editorName: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  placeholder: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
  },
  messageBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.accent },
  ratedAt: { fontSize: 12, color: COLORS.muted, marginTop: 8 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  secondaryBtnText: { color: COLORS.accent, fontWeight: "700" },
});
