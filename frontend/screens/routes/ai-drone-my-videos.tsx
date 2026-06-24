/**
 * AI Drone — kullanıcının runway video arşivi (GET my-videos).
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";

import { MobileAiScreenShell } from "../../components/app/MobileAiScreenHeader";
import { userFacingRunwayProgressMessage } from "../../src/constants/aiDroneProductionPipeline";
import { useRouter } from "../../src/hooks/useNavigation";
import type { DroneMyVideoItem } from "../../services/droneRunwayService";
import {
  isMyVideoFailed,
  isMyVideoProcessing,
  isMyVideoReady,
  listDroneMyVideos,
} from "../../services/droneRunwayService";

const COLORS = {
  pageBg: "#f1f5f9",
  cardBg: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#3b82f6",
  success: "#16a34a",
  danger: "#dc2626",
} as const;

function formatDate(value: string | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function progressLabel(item: DroneMyVideoItem): string {
  if (item.meta?.progress) {
    return userFacingRunwayProgressMessage(item.meta.progress, "Üretiliyor…");
  }
  if (isMyVideoReady(item)) return "Hazır";
  if (isMyVideoFailed(item)) return "Başarısız";
  if (isMyVideoProcessing(item)) return "Üretiliyor…";
  return item.label || "Video";
}

function StatusBadge({ item }: { item: DroneMyVideoItem }) {
  if (item.is_license_placeholder) {
    return <Text style={[styles.badge, styles.badgeMuted]}>Lisans</Text>;
  }
  if (isMyVideoReady(item)) {
    return <Text style={[styles.badge, styles.badgeReady]}>Hazır</Text>;
  }
  if (isMyVideoFailed(item)) {
    return <Text style={[styles.badge, styles.badgeFailed]}>Başarısız</Text>;
  }
  if (isMyVideoProcessing(item)) {
    return <Text style={[styles.badge, styles.badgeProcessing]}>Üretiliyor</Text>;
  }
  return <Text style={[styles.badge, styles.badgeMuted]}>{item.status || "—"}</Text>;
}

export default function AiDroneMyVideosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<DroneMyVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listDroneMyVideos();
    if (!res.ok) {
      setError(res.error);
      setItems([]);
    } else {
      setItems(res.videos.filter((v) => !v.is_license_placeholder && String(v.job_id || "").trim()));
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openVideo = useCallback(
    (jobId: string) => {
      router.push("ai-drone-simple-editor", { jobId });
    },
    [router],
  );

  return (
    <MobileAiScreenShell title="Videolarım" onBack={() => router.back()} pageBackgroundColor={COLORS.pageBg}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void load()}>
            <Text style={styles.secondaryBtnText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
          <Text style={styles.lead}>
            Üretim devam eden ve hazır videolarınız. Arka planda üretilen işler burada görünür.
          </Text>
          {items.length === 0 ? (
            <Text style={styles.empty}>Henüz video yok.</Text>
          ) : (
            items.map((item) => {
              const jobId = String(item.job_id || "").trim();
              const ready = isMyVideoReady(item);
              return (
                <TouchableOpacity
                  key={jobId}
                  style={styles.card}
                  activeOpacity={ready ? 0.85 : 1}
                  onPress={() => {
                    if (ready) openVideo(jobId);
                  }}
                  disabled={!ready}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.label || jobId}
                    </Text>
                    <StatusBadge item={item} />
                  </View>
                  <Text style={styles.cardMeta}>{progressLabel(item)}</Text>
                  {item.reference_id ? (
                    <Text style={styles.cardRef} numberOfLines={1}>Parsel: {item.reference_id}</Text>
                  ) : null}
                  {formatDate(item.updated_at || item.created_at) ? (
                    <Text style={styles.cardDate}>{formatDate(item.updated_at || item.created_at)}</Text>
                  ) : null}
                  {ready ? (
                    <View style={styles.openRow}>
                      <Ionicons name="play-circle-outline" size={18} color={COLORS.accent} />
                      <Text style={styles.openText}>Önizle</Text>
                    </View>
                  ) : isMyVideoProcessing(item) ? (
                    <View style={styles.openRow}>
                      <ActivityIndicator size="small" color={COLORS.accent} />
                      <Text style={styles.openTextMuted}>Üretim sürüyor…</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </MobileAiScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: COLORS.danger, textAlign: "center", marginBottom: 12 },
  lead: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginBottom: 14 },
  empty: { color: COLORS.muted, fontSize: 14, textAlign: "center", marginTop: 32 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: COLORS.text },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  badgeReady: { backgroundColor: "rgba(22, 163, 74, 0.12)", color: COLORS.success },
  badgeProcessing: { backgroundColor: "rgba(59, 130, 246, 0.12)", color: COLORS.accent },
  badgeFailed: { backgroundColor: "rgba(220, 38, 38, 0.1)", color: COLORS.danger },
  badgeMuted: { backgroundColor: "rgba(100, 116, 139, 0.12)", color: COLORS.muted },
  cardMeta: { fontSize: 13, color: COLORS.text, marginTop: 8 },
  cardRef: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  cardDate: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  openRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  openText: { fontSize: 13, fontWeight: "700", color: COLORS.accent },
  openTextMuted: { fontSize: 13, color: COLORS.muted },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  secondaryBtnText: { color: "#fff", fontWeight: "700" },
});
