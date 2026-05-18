/**
 * Rozetler — web badges.html ile aynı API özeti
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SvgUri } from "react-native-svg";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { useBadgeCelebration } from "../contexts/BadgeCelebrationContext";
import { authService } from "../../services/authService";
import { API_URL } from "../../config/api";
import type {
  BadgeOverviewItem,
  BadgeOverviewPayload,
  BadgePageSummary,
  MainBadgeGroup,
} from "../../src/types/badges";

function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_URL.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

function BadgeThumb({ item, size }: { item: BadgeOverviewItem; size: number }) {
  const src = resolveAssetUrl(item.is_earned ? item.svg_active_url : item.svg_locked_url);
  if (!src) {
    return (
      <View style={[badgesScreenStyles.badgeFallback, { width: size, height: size }]}>
        <Text style={badgesScreenStyles.badgeFallbackText}>{item.is_earned ? "●" : "○"}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <SvgUri uri={src} width={size} height={size} />
    </View>
  );
}

export const MAIN_GROUPS: [keyof BadgeOverviewPayload["main_badges"], string][] = [
  ["education", "Mezuniyet durumu rozeti"],
  ["first_task", "İlk görev tamamlama rozeti"],
  ["tenure", "Meslek yılı rozeti"],
  ["expert_level", "ProParcel uzmanlık rozeti"],
  ["sales", "Satış rozeti (kademeler)"],
  ["milestone", "Kilometre taşı rozetleri"],
];

export const CATEGORIES: [string, string, keyof BadgeOverviewPayload["main_badges"]][] = [
  ["mezuniyet", "1) Mezuniyet rozetleri", "education"],
  ["ilk-gorev", "2) İlk görev rozetleri", "first_task"],
  ["meslek-yili", "3) Meslek yılı rozetleri", "tenure"],
  ["uzmanlik", "4) ProParcel uzmanlık rozeti (seviyeler)", "expert_level"],
  ["satis", "5) Satış rozeti (kademeler)", "sales"],
  ["kilometre-tasi", "6) Kilometre taşı rozetleri", "milestone"],
];

export function HeroChips({ s }: { s: BadgePageSummary }) {
  const chips: { k: string; v: string; sub?: string; warn?: boolean }[] = [
    {
      k: "Ömür boyu Pro sorgu",
      v: String(s.lifetime_pro_query ?? 0),
      sub:
        s.milestone_100_earned
          ? "100 Pro sorgu rozeti kazanıldı"
          : `100 tamamlanınca kilometre taşı (${s.lifetime_pro_query ?? 0}/100)`,
    },
    { k: "Kazanılan rozet", v: String(s.earned_badge_count ?? 0), sub: "Profilde görünen toplam" },
    {
      k: "Onaylı satış bildirimi",
      v: String(s.sales_report_count ?? 0),
      sub: "Satış kademesi rozetleri için",
    },
  ];
  if (s.show_expert_block) {
    chips.push({
      k: "Uzmanlık puanı (güncel / peak)",
      v: `${s.expert_score_current ?? 0} / ${s.expert_score_peak ?? 0}`,
      sub: `Seviye: ${s.expert_level_label ?? "—"}`,
    });
  }
  if (s.has_orm_user === false) {
    chips.push({
      k: "Profil eşlemesi",
      v: "—",
      sub: "SQL kullanıcı kaydı yoksa rozetler tam yüklenmeyebilir.",
      warn: true,
    });
  }
  return (
    <View style={badgesScreenStyles.heroGrid}>
      {chips.map((c, i) => (
        <View key={i} style={[badgesScreenStyles.heroChip, i === 0 ? badgesScreenStyles.heroChipAccent : null]}>
          <Text style={badgesScreenStyles.heroChipK}>{c.k}</Text>
          <Text style={badgesScreenStyles.heroChipV}>{c.v}</Text>
          {c.sub ? (
            <Text style={[badgesScreenStyles.heroChipSub, c.warn ? badgesScreenStyles.heroChipWarn : null]} numberOfLines={3}>
              {c.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function MainCard({
  label,
  group,
}: {
  label: string;
  group: MainBadgeGroup | undefined;
}) {
  const ab = group?.active_badge;
  const earned = ab?.is_earned;
  let footer = "";
  if (group?.summary?.completed !== undefined && group.summary.total !== undefined) {
    footer = `${group.summary.completed} / ${group.summary.total} ilk görev tamamlandı`;
  }
  if (group?.summary?.sales_score !== undefined) {
    footer = `Onaylı satış bildirimi: ${group.summary.sales_score}`;
  }
  return (
    <View style={badgesScreenStyles.mainCard}>
      {ab ? <BadgeThumb item={ab} size={56} /> : <View style={{ height: 56 }} />}
      <Text style={badgesScreenStyles.mainCardH3}>{label}</Text>
      {ab ? (
        <>
          <Text style={badgesScreenStyles.mainCardTitle}>
            {!earned ? "🔒 " : ""}
            {ab.title}
          </Text>
          <Text style={badgesScreenStyles.mainCardMuted}>{ab.unlock_hint || ab.description || ""}</Text>
        </>
      ) : (
        <Text style={badgesScreenStyles.mainCardMuted}>—</Text>
      )}
      {footer ? <Text style={badgesScreenStyles.mainCardMuted}>{footer}</Text> : null}
      {group?.all_tasks_complete ? (
        <Text style={badgesScreenStyles.mainCardOk}>Tüm ilk görevler tamamlandı</Text>
      ) : null}
    </View>
  );
}

export function CategoryBlock({
  title,
  slug,
  group,
}: {
  title: string;
  slug: string;
  group: MainBadgeGroup | undefined;
}) {
  const items = group?.items || [];
  if (!items.length) return null;
  const screenW = Dimensions.get("window").width;
  const hPad = 10;
  const w = (screenW - hPad * 2 - 8) / 2;
  return (
    <View style={badgesScreenStyles.catBlock} nativeID={`cat-${slug}`}>
      <Text style={badgesScreenStyles.catTitle}>
        {title} <Text style={badgesScreenStyles.catSlug}>{slug}</Text>
      </Text>
      <View style={badgesScreenStyles.grid}>
        {items.map((it) => (
          <View
            key={it.code}
            style={[badgesScreenStyles.cell, it.is_earned ? badgesScreenStyles.cellEarned : badgesScreenStyles.cellLocked, { minWidth: w * 0.45 }]}
          >
            <BadgeThumb item={it} size={48} />
            <Text style={badgesScreenStyles.cellT} numberOfLines={3}>
              {it.title || it.code}
            </Text>
            <Text style={badgesScreenStyles.cellD} numberOfLines={4}>
              {it.unlock_hint || it.description || ""}
            </Text>
            {it.progress_percent != null && !it.is_earned ? (
              <Text style={badgesScreenStyles.cellProg}>İlerleme: %{it.progress_percent}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function BadgesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { checkPending } = useBadgeCelebration();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<BadgeOverviewPayload | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const res = await authService.getBadgeOverview();
    if (res.success && res.data) {
      setOverview(res.data);
    } else {
      setOverview(null);
    }
    setLoading(false);
  }, [isAuthenticated]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    await checkPending();
    setRefreshing(false);
  }, [load, checkPending]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={badgesScreenStyles.container} edges={["top"]}>
        <View style={badgesScreenStyles.header}>
          <TouchableOpacity style={badgesScreenStyles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={badgesScreenStyles.headerTitle}>Rozetler</Text>
          <View style={badgesScreenStyles.headerRight} />
        </View>
        <View style={badgesScreenStyles.centerBox}>
          <Text style={badgesScreenStyles.muted}>Rozetleri görmek için giriş yapın.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !overview) {
    return (
      <SafeAreaView style={badgesScreenStyles.container} edges={["top"]}>
        <View style={badgesScreenStyles.header}>
          <TouchableOpacity style={badgesScreenStyles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={badgesScreenStyles.headerTitle}>Rozetler</Text>
          <View style={badgesScreenStyles.headerRight} />
        </View>
        <View style={badgesScreenStyles.centerBox}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  const mb = overview?.main_badges || {};
  const ps = overview?.page_summary;

  return (
    <SafeAreaView style={badgesScreenStyles.container} edges={["top"]}>
      <View style={badgesScreenStyles.header}>
        <TouchableOpacity style={badgesScreenStyles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={badgesScreenStyles.headerTitle}>Rozetler</Text>
        <View style={badgesScreenStyles.headerRight} />
      </View>

      <ScrollView
        style={badgesScreenStyles.scroll}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={badgesScreenStyles.lead}>
          Mobil rozet özeti — web ile aynı API. Kazanılan rozetler vurgulu; kilitli olanlar soluk görünür.
        </Text>

        {overview?.error ? (
          <View style={badgesScreenStyles.warnBanner}>
            <Text style={badgesScreenStyles.warnText}>Özet yüklenemedi. Sayfayı yenileyin.</Text>
          </View>
        ) : null}

        {ps ? (
          <View style={badgesScreenStyles.hero}>
            <Text style={badgesScreenStyles.heroTitle}>Genel durumunuz</Text>
            <Text style={badgesScreenStyles.heroLead}>
              Puanlar ve etkinlik özetiniz; kilometre taşı rozetleri bu ekranı her açtığınızda güncellenir.
            </Text>
            <HeroChips s={ps} />
          </View>
        ) : null}

        <Text style={badgesScreenStyles.sectionH2}>Ana özet</Text>
        <View style={badgesScreenStyles.mainRow}>
          {MAIN_GROUPS.map(([key, label]) => (
            <MainCard key={key} label={label} group={mb[key] as MainBadgeGroup | undefined} />
          ))}
        </View>

        <Text style={badgesScreenStyles.sectionH2}>Tüm rozetler (kategorilere göre)</Text>
        {CATEGORIES.map(([slug, title, apiKey]) => (
          <CategoryBlock key={slug} slug={slug} title={title} group={mb[apiKey] as MainBadgeGroup | undefined} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export const badgesScreenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e293b" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "700" },
  headerRight: { width: 36 },
  scroll: { flex: 1, backgroundColor: "#f1f5f9" },
  lead: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 4,
  },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#94a3b8" },
  warnBanner: {
    marginHorizontal: 10,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  warnText: { color: "#9a3412", fontSize: 13 },
  hero: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  heroTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginBottom: 6 },
  heroLead: { color: "#64748b", fontSize: 12, lineHeight: 17, marginBottom: 12 },
  heroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroChip: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 140,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroChipAccent: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  heroChipK: { color: "#64748b", fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  heroChipV: { color: "#0f172a", fontSize: 20, fontWeight: "700" },
  heroChipSub: { color: "#64748b", fontSize: 11, lineHeight: 15, marginTop: 4 },
  heroChipWarn: { color: "#b45309" },
  sectionH2: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginHorizontal: 10,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
  },
  mainRow: { paddingHorizontal: 8, gap: 10 },
  mainCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  mainCardH3: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  mainCardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "600", marginTop: 4 },
  mainCardMuted: { color: "#64748b", fontSize: 12, marginTop: 4, lineHeight: 17 },
  mainCardOk: { color: "#4ade80", fontSize: 12, fontWeight: "600", marginTop: 6 },
  catBlock: { marginHorizontal: 10, marginBottom: 18 },
  catTitle: { color: "#0f172a", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  catSlug: { color: "#64748b", fontSize: 11, fontWeight: "500", textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    flex: 1,
    minWidth: "44%",
    maxWidth: "48%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  cellEarned: {
    backgroundColor: "#ecfdf5",
    borderColor: "#34d399",
  },
  cellLocked: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  cellT: { color: "#0f172a", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 6 },
  cellD: { color: "#64748b", fontSize: 10, textAlign: "center", marginTop: 4, lineHeight: 14 },
  cellProg: { color: "#475569", fontSize: 10, marginTop: 4 },
  badgeFallback: { alignItems: "center", justifyContent: "center" },
  badgeFallbackText: { color: "#94a3b8", fontSize: 22 },
});
