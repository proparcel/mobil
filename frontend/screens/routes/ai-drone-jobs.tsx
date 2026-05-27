/**
 * AI Drone — kullanıcının talep ettiği işler (İşlerim).
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { AiDroneJobStatusBadge } from "../../components/ai-drone/AiDroneJobStatusBadge";
import { StarRatingInput } from "../../components/ai-drone/StarRatingInput";
import { aiDroneProparcelService, type AiDroneJobListItem } from "../../services/aiDroneProparcelService";
import { canDownloadDroneJob } from "../../src/utils/aiDroneJobStatus";

const COLORS = {
  headerBg: "#0f172a",
  pageBg: "#f1f5f9",
  cardBg: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#3b82f6",
} as const;

function formatDate(value: string | undefined): string {
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

export default function AiDroneJobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<AiDroneJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    const res = await aiDroneProparcelService.listMyRequests({ limit: 50, offset: 0 });
    if (!res.ok) {
      setError(res.error);
      setItems([]);
    } else {
      setItems(res.data);
    }
    setLoading(false);
  }, [isAuthenticated]);

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI İşlerim</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.lead}>
          Sizin yerinize ürettiğimiz AI Drone videolarınızın durumunu buradan takip edebilirsiniz.
        </Text>

        {!isAuthenticated ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Giriş gerekli</Text>
            <Text style={styles.emptyBody}>İşlerinizi görmek için giriş yapın.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("login")}>
              <Text style={styles.primaryBtnText}>Giriş yap</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>Liste yüklenemedi</Text>
            <Text style={styles.emptyBody}>{error}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => void load()}>
              <Text style={styles.secondaryBtnText}>Yenile</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="airplane-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>Henüz iş yok</Text>
            <Text style={styles.emptyBody}>İlk drone video talebinizi oluşturun.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("ai-drone-video-info")}>
              <Text style={styles.primaryBtnText}>Talep oluştur</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((job) => {
            const downloadable = canDownloadDroneJob(job.status, job.deliveryUrl);
            return (
              <TouchableOpacity
                key={job.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push("ai-drone-job-detail", { requestId: String(job.id) })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardId}>#{job.id}</Text>
                  <AiDroneJobStatusBadge status={job.status} statusLabel={job.statusLabel} />
                </View>
                {job.parcelSummary ? (
                  <Text style={styles.cardSummary} numberOfLines={2}>
                    {job.parcelSummary}
                  </Text>
                ) : null}
                <Text style={styles.cardDate}>{formatDate(job.createdAt)}</Text>
                {job.userRating?.stars ? (
                  <View style={styles.ratingRow}>
                    <StarRatingInput value={job.userRating.stars} readonly size={18} />
                    <Text style={styles.ratedHint}>Puanlandı</Text>
                  </View>
                ) : null}
                {job.canAcceptDelivery ? (
                  <Text style={styles.actionHint}>Teslim bekliyor — detaydan onaylayın</Text>
                ) : null}
                <View style={styles.cardFooter}>
                  <Text style={styles.detailLink}>Detay</Text>
                  {downloadable ? (
                    <View style={styles.readyPill}>
                      <Ionicons name="download-outline" size={14} color="#15803d" />
                      <Text style={styles.readyPillText}>İndirilebilir</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
  lead: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginBottom: 14 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardId: { fontSize: 13, fontWeight: "800", color: COLORS.muted },
  cardParcel: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  cardSummary: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
  cardDate: { fontSize: 12, color: "#94a3b8", marginTop: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  ratedHint: { fontSize: 12, color: "#b45309", fontWeight: "600" },
  actionHint: { fontSize: 12, color: "#1d4ed8", fontWeight: "600", marginTop: 6 },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 },
  detailLink: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.accent },
  readyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  readyPillText: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  emptyCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  emptyBody: { fontSize: 14, color: COLORS.muted, textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  secondaryBtnText: { color: COLORS.accent, fontWeight: "700" },
});
