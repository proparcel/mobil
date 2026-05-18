/**
 * Başka kullanıcının profili — web `VisitProfilePage` ile uyumlu herkese açık alanlar.
 * Gizli: Tepe Coin, ilan yönetimi, hesap ayarları (web’de olmayan bölümler gösterilmez).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRoute } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import ProfileGenelOverview from "../../components/app/ProfileGenelOverview";
import type { ProfileSectionId } from "../../components/app/profileSectionTypes";
import { getPortalUserProfile, getPortalUserAgentRatings } from "../../services/portalService";
import { API_URL } from "../../config/api";
import type { BadgeOverviewItem } from "../../src/types/badges";
import { authService } from "../../services/authService";
import { SvgUri } from "react-native-svg";

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_URL.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

function disp(v: unknown, fallback = ""): string {
  const t = String(v ?? "").trim();
  return t || fallback;
}

export default function VisitProfileScreen() {
  const router = useRouter();
  const route = useRoute();
  const { isAuthenticated } = useAuth();
  const params = route.params as { userId?: string; displayName?: string } | undefined;

  const userId = useMemo(() => {
    const n = parseInt(String(params?.userId || "").trim(), 10);
    return Number.isFinite(n) ? n : NaN;
  }, [params?.userId]);

  const titleName = (params?.displayName || "").trim();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portal, setPortal] = useState<Record<string, unknown> | null>(null);
  const [ratings, setRatings] = useState<{ avg: number | null; count: number } | null>(null);
  const [heroBadge, setHeroBadge] = useState<BadgeOverviewItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated || !Number.isFinite(userId)) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const [profRes, rateRes, badgeRes] = await Promise.all([
        getPortalUserProfile(userId, { badges: true }),
        getPortalUserAgentRatings(userId),
        authService.getBadgeOverview(userId),
      ]);

      if (profRes.ok && profRes.data && typeof profRes.data === "object") {
        setPortal(profRes.data as Record<string, unknown>);
      } else {
        setPortal(null);
        setLoadError(typeof profRes.error === "string" ? profRes.error : "Profil yüklenemedi.");
      }

      if (rateRes.ok && rateRes.data?.aggregate) {
        const a = rateRes.data.aggregate;
        setRatings({
          count: Number(a.count) || 0,
          avg: a.avg_overall != null ? Number(a.avg_overall) : null,
        });
      } else {
        setRatings({ count: 0, avg: null });
      }

      if (badgeRes.success && badgeRes.data?.main_badges) {
        const mb = badgeRes.data.main_badges;
        const order = ["expert_level", "education", "milestone", "sales", "first_task"] as const;
        let pick: BadgeOverviewItem | null = null;
        for (const k of order) {
          const g = mb[k]?.active_badge;
          if (g) {
            pick = g;
            break;
          }
        }
        setHeroBadge(pick);
      } else {
        setHeroBadge(null);
      }
    } catch {
      setLoadError("Profil yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const displayName = disp(
    portal?.full_name,
    titleName || "Kullanıcı",
  );

  const onShortcut = useCallback(
    (id: ProfileSectionId) => {
      if (id === "rozetler") {
        router.push("visitor-badges", { userId: String(userId), displayName: displayName });
      }
    },
    [router, userId, displayName],
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Profil
          </Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>Bu profili görmek için giriş yapın.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!Number.isFinite(userId)) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>Geçersiz kullanıcı.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#38bdf8" />
          <Text style={[styles.muted, { marginTop: 12 }]}>Profil yükleniyor…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loadError ? (
            <Text style={styles.err}>{loadError}</Text>
          ) : null}

          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.avatarWrap}>
                {resolveMediaUrl(disp(portal?.avatar_url, "") as string) ? (
                  <Image
                    source={{ uri: resolveMediaUrl(disp(portal?.avatar_url, "") as string)! }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <Text style={styles.avatarLetter}>{displayName.slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroName} numberOfLines={2}>
                  {displayName}
                </Text>
                {disp(portal?.email) ? (
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {disp(portal?.email)}
                  </Text>
                ) : null}
                <View style={styles.pillRow}>
                  {disp(portal?.role_label) ? (
                    <Text style={styles.pill}>{disp(portal?.role_label)}</Text>
                  ) : null}
                  {disp(portal?.member_type_label) ? (
                    <Text style={styles.pill}>{disp(portal?.member_type_label)}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.ratingTouch}
              onPress={() => setRatingOpen((o) => !o)}
              activeOpacity={0.85}
            >
              <View style={styles.ratingHead}>
                <Text style={styles.ratingLabel}>Kullanıcı puanı</Text>
                <Ionicons name={ratingOpen ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((i) => {
                  const filled =
                    ratings?.avg != null && Number.isFinite(ratings.avg) ? Math.round(ratings.avg) : 0;
                  return (
                    <Ionicons
                      key={i}
                      name={i <= filled ? "star" : "star-outline"}
                      size={26}
                      color="#f59e0b"
                      style={{ marginRight: i < 5 ? 4 : 0 }}
                    />
                  );
                })}
              </View>
              <Text style={styles.ratingNum}>
                {ratings?.avg != null && Number.isFinite(ratings.avg) ? ratings.avg.toFixed(1) : "—"}
                <Text style={styles.ratingSub}> / 5 · {ratings?.count ?? 0} değerlendirme</Text>
              </Text>
            </TouchableOpacity>

            {ratingOpen ? (
              <View style={styles.ratingPanel}>
                <Text style={styles.ratingPanelTxt}>
                  Web’deki «Yorumlar» sekmesindeki gibi detaylı değerlendirme listesi mobilde paylaşım
                  akışında «Kullanıcı Puanı» sekmesinden izlenir. Burada yalnızca özet gösterilir.
                </Text>
              </View>
            ) : null}

            {heroBadge ? (
              <View style={styles.badgeBlock}>
                <Text style={styles.badgeKicker}>Öne çıkan rozet</Text>
                <View style={styles.badgeRow}>
                  {resolveMediaUrl(heroBadge.svg_active_url || undefined) ? (
                    <SvgUri uri={resolveMediaUrl(heroBadge.svg_active_url || undefined)!} width={52} height={52} />
                  ) : (
                    <View style={styles.badgeFb}>
                      <Text style={styles.badgeFbTxt}>★</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <Text style={styles.badgeTitle} numberOfLines={2}>
                      {heroBadge.title || heroBadge.code}
                    </Text>
                    <TouchableOpacity onPress={() => onShortcut("rozetler")}>
                      <Text style={styles.badgeLink}>Tüm rozetler →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hakkında</Text>
            <Text style={styles.cardHint}>Web ziyaretçi profilindeki gibi salt okunur özet.</Text>
            <View style={styles.kv}>
              <Text style={styles.k}>Üye tipi</Text>
              <Text style={styles.v}>{disp(portal?.member_type_label, "—")}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Konum</Text>
              <Text style={styles.v} numberOfLines={3}>
                {disp(portal?.location_public || portal?.address_display, "—")}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Telefon</Text>
              <Text style={styles.v}>{disp(portal?.phone, "Gizli veya yok")}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adres özeti</Text>
            <View style={styles.kv}>
              <Text style={styles.k}>İl</Text>
              <Text style={styles.v}>{disp(portal?.city_name, "—")}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>İlçe</Text>
              <Text style={styles.v}>{disp(portal?.district_name, "—")}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Adres</Text>
              <Text style={styles.v} numberOfLines={4}>
                {disp(portal?.address_display, "—")}
              </Text>
            </View>
          </View>

          {disp(portal?.company_name) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Firma (özet)</Text>
              <View style={styles.kv}>
                <Text style={styles.k}>Firma</Text>
                <Text style={styles.v}>{disp(portal?.company_name)}</Text>
              </View>
              <Text style={styles.note}>
                Kurumsal alanların tamamı web’de «Firma» sekmesinde; mobilde yalnızca özet.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.rozetCta} onPress={() => onShortcut("rozetler")} activeOpacity={0.88}>
            <Ionicons name="ribbon-outline" size={22} color="#2563eb" />
            <Text style={styles.rozetCtaTxt}>Rozet panosunu aç</Text>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <ProfileGenelOverview userId={userId} onOpenProfileSection={onShortcut} visitorMode />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e293b" },
  scroll: { flex: 1, backgroundColor: "#f1f5f9" },
  scrollContent: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#1e293b",
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#f8fafc", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#f1f5f9" },
  muted: { fontSize: 14, color: "#64748b", textAlign: "center" },
  err: { color: "#b91c1c", marginBottom: 10, fontSize: 14 },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroRow: { flexDirection: "row", marginBottom: 12 },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { fontSize: 24, fontWeight: "800", color: "#475569" },
  heroName: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  heroMeta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  pill: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    marginRight: 6,
    marginBottom: 4,
  },
  ratingTouch: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  ratingHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  ratingLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  starsRow: { flexDirection: "row", marginBottom: 6 },
  ratingNum: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  ratingSub: { fontSize: 14, fontWeight: "500", color: "#64748b" },
  ratingPanel: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  ratingPanelTxt: { fontSize: 13, color: "#475569", lineHeight: 19 },
  badgeBlock: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  badgeKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  badgeRow: { flexDirection: "row", alignItems: "center" },
  badgeFb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeFbTxt: { fontSize: 22, color: "#f59e0b" },
  badgeTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  badgeLink: { marginTop: 6, fontSize: 14, fontWeight: "700", color: "#2563eb" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  cardHint: { fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 17 },
  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  k: { fontSize: 13, color: "#64748b", flex: 0.4, paddingRight: 8 },
  v: { fontSize: 14, color: "#0f172a", fontWeight: "500", flex: 0.6, textAlign: "right" },
  note: { fontSize: 12, color: "#94a3b8", marginTop: 10, lineHeight: 17 },
  rozetCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rozetCtaTxt: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: "700", color: "#0f172a" },
});
