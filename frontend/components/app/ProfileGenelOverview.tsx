/**
 * Web profil #genel — paylaşım akışı + alt sekmeler (Tüm / Kullanıcı / Kullanıcı Puanı).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { parseTurkishPrice } from "../../src/utils/priceParser";
import {
  fetchQuarterSocialPosts,
  resolveDjangoUrl,
  toggleQuarterSocialLike,
  type QuarterSocialPost,
} from "../../services/promahalleService";
import { getPortalUserAgentRatings } from "../../services/portalService";
import { useRouter } from "../../src/hooks/useNavigation";
import type { ProfileSectionId } from "./profileSectionTypes";
import { withProfileReturn } from "../../src/utils/profileReturnNavigation";

const SW = Dimensions.get("window").width;
/**
 * Profil ScrollView `paddingHorizontal: 8` ile hizalı — kart içi yatay boşluk düşük tutulur.
 * POST_INNER_WIDTH = ekran − scroll padding − kart padding (görseller taşmasın).
 */
const SCROLL_PAD = 8;
const H_PAD_OUTER = 0;
const H_PAD_CARD = 8;
const POST_INNER_WIDTH = Math.max(280, SW - 2 * SCROLL_PAD - 2 * H_PAD_CARD);

const COLORS = {
  accent: "#3b82f6",
  text: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  card: "#ffffff",
};

function isSystemPost(t?: string) {
  return t === "listing_publish" || t === "pro_query";
}

function postLabel(t?: string) {
  if (t === "listing_publish") return "İlan";
  if (t === "pro_query") return "Pro sorgu";
  return "Paylaşım";
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatQuarterSocialPriceMeta(value: unknown): string {
  const n =
    typeof value === "number" && Number.isFinite(value) ? value : parseTurkishPrice(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("tr-TR")} TL`;
}

function getQuarterSocialNativeDetailNav(
  item: QuarterSocialPost,
): { snapshotId: string; listingId?: string } | null {
  const pt = String(item.post_type || "");
  if (pt !== "listing_publish" && pt !== "pro_query") return null;
  const meta = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : {};
  const raw = meta.snapshot_id;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const listingRaw =
    pt === "pro_query"
      ? meta.source_listing_id ?? meta.listing_id
      : meta.listing_id ?? meta.source_listing_id;
  const listingId = String(listingRaw ?? "").trim();
  return {
    snapshotId: String(Math.trunc(n)),
    ...(listingId ? { listingId } : {}),
  };
}

function systemPostMetaLines(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const m = meta as Record<string, unknown>;
  const lines: string[] = [];
  const title = m.title;
  if (title != null && String(title).trim()) lines.push(`Başlık: ${String(title).trim()}`);
  const lt = m.listing_type_label;
  if (lt != null && String(lt).trim()) lines.push(`İlan Tipi: ${String(lt).trim()}`);
  const priceStr = formatQuarterSocialPriceMeta(m.price_amount);
  if (priceStr) lines.push(`Fiyat: ${priceStr}`);
  const rawArea = m.area_m2;
  if (rawArea != null && rawArea !== "") {
    const a = typeof rawArea === "number" && Number.isFinite(rawArea) ? rawArea : parseFloat(String(rawArea));
    if (Number.isFinite(a) && a > 0) lines.push(`Alan: ${a.toLocaleString("tr-TR")} m²`);
  }
  const pub = m.published_at;
  if (pub != null && String(pub).trim()) {
    const d = fmtDate(String(pub));
    if (d) lines.push(`Yayın: ${d}`);
  }
  return lines;
}

export type GenelSubTab = "all" | "user" | "ratings";

type Props = {
  userId: number;
  onOpenProfileSection: (id: ProfileSectionId) => void;
  /** Profil hamburger menüsü — tüm bölümler (ProfileMenuSheet). */
  onOpenProfileMenu?: () => void;
  /** Başka kullanıcının profili: ilan/kullanım kısayolları gizlenir (web ziyaretçi görünümü). */
  visitorMode?: boolean;
};

export default function ProfileGenelOverview({
  userId,
  onOpenProfileSection,
  onOpenProfileMenu,
  visitorMode = false,
}: Props) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<GenelSubTab>("all");
  const [items, setItems] = useState<QuarterSocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [postImageIndex, setPostImageIndex] = useState<Record<string, number>>({});
  const [ratingsAgg, setRatingsAgg] = useState<{ count: number; avg: number | null } | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const uidStr = String(userId);

  const loadPosts = useCallback(
    async (reset: boolean, cursorForNextPage?: string | null) => {
      if (subTab === "ratings") return;
      if (reset) {
        setLoading(true);
        setCursor(null);
      } else {
        setLoadingMore(true);
      }
      setError("");
      const c = reset ? null : cursorForNextPage !== undefined ? cursorForNextPage : cursor;
      const res = await fetchQuarterSocialPosts({
        scope: "global",
        user_id: uidStr,
        cursor: c,
        page_size: 10,
      });
      if (!res.ok) {
        setError(res.error || "Paylaşımlar yüklenemedi.");
        setItems([]);
        setHasMore(false);
      } else {
        const next = Array.isArray(res.data?.items) ? res.data!.items! : [];
        setItems((prev) => (reset ? next : prev.concat(next)));
        const nc = res.data?.next_cursor;
        setCursor(nc ?? null);
        setHasMore(Boolean(nc));
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [uidStr, subTab, cursor],
  );

  useEffect(() => {
    if (subTab === "ratings") return;
    setItems([]);
    setCursor(null);
    setHasMore(false);
    void loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, uidStr]);

  useEffect(() => {
    if (subTab !== "ratings") {
      setRatingsAgg(null);
      return;
    }
    let ignore = false;
    setRatingsLoading(true);
    void getPortalUserAgentRatings(userId).then((res) => {
      if (ignore) return;
      if (res.ok && res.data?.aggregate) {
        const a = res.data.aggregate;
        setRatingsAgg({
          count: Number(a.count) || 0,
          avg: a.avg_overall != null ? Number(a.avg_overall) : null,
        });
      } else {
        setRatingsAgg({ count: 0, avg: null });
      }
      setRatingsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [subTab, userId]);

  const visibleItems = useMemo(() => {
    if (subTab === "user") return items.filter((it) => !isSystemPost(it.post_type));
    return items;
  }, [items, subTab]);

  const openDetailUrl = (url?: string) => {
    const u = resolveDjangoUrl(String(url || ""));
    if (u) Linking.openURL(u).catch(() => {});
  };

  const openSystemDetail = (item: QuarterSocialPost) => {
    const nav = getQuarterSocialNativeDetailNav(item);
    if (nav) {
      router.push("son-30-gun-detay", withProfileReturn(nav, "genel"));
      return;
    }
    const detailUrl =
      item.meta && typeof item.meta === "object"
        ? String((item.meta as Record<string, unknown>).detail_url || "").trim()
        : "";
    if (detailUrl) openDetailUrl(detailUrl);
  };

  const onToggleLike = async (postId: string) => {
    const res = await toggleQuarterSocialLike("post", postId);
    if (res.ok) void loadPosts(true);
  };

  const renderPost = (item: QuarterSocialPost) => {
    const pid = String(item.post_id || "");
    const sys = isSystemPost(item.post_type);
    const imgs = Array.isArray(item.images) ? item.images : [];
    const detailUrl =
      item.meta && typeof item.meta === "object" ? String((item.meta as Record<string, unknown>).detail_url || "").trim() : "";
    const nativeNav = sys ? getQuarterSocialNativeDetailNav(item) : null;
    const canOpen = sys ? Boolean(nativeNav) || Boolean(detailUrl) : Boolean(detailUrl);
    const metaLines = sys ? systemPostMetaLines(item.meta) : [];

    return (
      <View key={pid} style={s.postCard}>
        <View style={s.postHeader}>
          <View style={s.avatar}>
            {item.avatar_url ? (
              <Image source={{ uri: resolveDjangoUrl(String(item.avatar_url)) }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarTxt}>{(item.username || "P").slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.postName}>{item.username || "Kullanıcı"}</Text>
            <View style={s.badgeRow}>
              <View style={[s.typeBadge, sys && s.typeBadgeSys]}>
                <Text style={s.typeBadgeText}>{postLabel(item.post_type)}</Text>
              </View>
              <Text style={s.postTime}>{fmtDate(item.created_at)}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          disabled={sys ? !nativeNav && !detailUrl : !detailUrl}
          onPress={() => (sys ? openSystemDetail(item) : openDetailUrl(detailUrl))}
          activeOpacity={canOpen ? 0.85 : 1}
        >
          <Text style={s.postBody}>{item.text || ""}</Text>
          {sys && metaLines.length > 0 ? (
            <View style={s.metaBlock}>
              {metaLines.map((line, i) => (
                <Text key={i} style={s.metaLine}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </TouchableOpacity>

        {imgs.length > 0 ? (
          <View style={s.mediaBlock}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={[s.imgScroll, { width: POST_INNER_WIDTH }]}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / POST_INNER_WIDTH);
                const clamped = Math.min(Math.max(0, idx), imgs.length - 1);
                setPostImageIndex((m) => ({ ...m, [pid]: clamped }));
              }}
            >
              {imgs.map((im, ii) => {
                const uri = resolveDjangoUrl(String(im.large || im.thumb || im.original || ""));
                if (!uri) return null;
                return (
                  <View key={ii} style={[s.postImgPage, { width: POST_INNER_WIDTH }]}>
                    <Image source={{ uri }} style={[s.postImg, { width: POST_INNER_WIDTH }]} resizeMode="cover" />
                  </View>
                );
              })}
            </ScrollView>
            {canOpen ? (
              <TouchableOpacity style={s.detailCta} onPress={() => (sys ? openSystemDetail(item) : openDetailUrl(detailUrl))}>
                <Text style={s.detailCtaTxt}>Detayları İncele</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={s.postActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => void onToggleLike(pid)} disabled={!pid}>
            <Ionicons name="thumbs-up-outline" size={22} color={COLORS.textSecondary} />
            <Text style={s.actionTxt}>{item.like_count ?? 0}</Text>
          </TouchableOpacity>
          <View style={s.actionBtn}>
            <Ionicons name="chatbubble-outline" size={21} color={COLORS.textSecondary} />
            <Text style={s.actionTxt}>{item.comment_count ?? 0}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.wrap}>
      {!visitorMode ? (
        <>
          <Text style={s.sectionTitle}>Hızlı erişim</Text>
          <View style={s.shortcuts}>
            {onOpenProfileMenu ? (
              <TouchableOpacity style={s.shortcutBtn} onPress={onOpenProfileMenu} activeOpacity={0.85}>
                <Ionicons name="menu-outline" size={20} color={COLORS.accent} />
                <Text style={s.shortcutTxt}>Tümü</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={s.shortcutBtn}
              onPress={() => router.push("badges", withProfileReturn({}, "genel"))}
            >
              <Ionicons name="ribbon-outline" size={20} color={COLORS.accent} />
              <Text style={s.shortcutTxt}>Rozetler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shortcutBtn} onPress={() => onOpenProfileSection("ilanlar")}>
              <Ionicons name="images-outline" size={20} color={COLORS.accent} />
              <Text style={s.shortcutTxt}>İlanlar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shortcutBtn} onPress={() => onOpenProfileSection("prosorgular")}>
              <Ionicons name="search-outline" size={20} color={COLORS.accent} />
              <Text style={s.shortcutTxt}>ProSorgular</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shortcutBtn} onPress={() => onOpenProfileSection("kullanimlarim")}>
              <Ionicons name="stats-chart-outline" size={20} color={COLORS.accent} />
              <Text style={s.shortcutTxt}>Kullanım</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={s.visitorHint}>
          <Ionicons name="eye-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 10, marginTop: 2 }} />
          <Text style={s.visitorHintTxt}>
            Ziyaret görünümü: yalnızca web ile uyumlu herkese açık alanlar. İlan / coin / ayarlar gizlidir.
          </Text>
        </View>
      )}

      <Text style={[s.sectionTitle, { marginTop: visitorMode ? 0 : 8 }]}>Paylaşımlar</Text>
      <Text style={s.sectionHint}>Mahalle sayfalarındaki paylaşımlarınız ve sistem gönderileri (web ile aynı liste).</Text>

      <View style={s.subTabRow}>
        {(
          [
            { id: "all" as const, label: "Tümü" },
            { id: "user" as const, label: "Kullanıcı" },
            { id: "ratings" as const, label: "Kullanıcı Puanı" },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[s.subTab, subTab === tab.id && s.subTabOn]}
            onPress={() => setSubTab(tab.id)}
          >
            <Text style={[s.subTabTxt, subTab === tab.id && s.subTabTxtOn]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text style={s.err}>{error}</Text>
      ) : null}

      {subTab === "ratings" ? (
        <View style={s.ratingsCard}>
          {ratingsLoading ? (
            <ActivityIndicator color={COLORS.accent} />
          ) : (
            <>
              <Text style={s.ratingsIntro}>
                Profilinize yapılan puanlama ve yorumlar web profilinizde de görüntülenir.
              </Text>
              <Text style={s.ratingsBig}>
                Ortalama: {ratingsAgg?.avg != null && Number.isFinite(ratingsAgg.avg) ? ratingsAgg.avg.toFixed(1) : "—"}
              </Text>
              <Text style={s.ratingsSub}>Değerlendirme sayısı: {ratingsAgg?.count ?? 0}</Text>
              <TouchableOpacity style={s.ratingsLink} onPress={() => onOpenProfileSection("ayarlar")}>
                <Text style={s.ratingsLinkTxt}>Hesap ayarları →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : loading && !visibleItems.length ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={s.loadingTxt}>Paylaşımlar yükleniyor…</Text>
        </View>
      ) : (
        <>{visibleItems.map((it) => renderPost(it))}</>
      )}

      {!loading && !visibleItems.length && subTab !== "ratings" ? (
        <Text style={s.empty}>
          {subTab === "user" ? "Henüz kullanıcı paylaşımı yok." : "Henüz paylaşım yok."}
        </Text>
      ) : null}

      {hasMore && subTab !== "ratings" ? (
        <TouchableOpacity
          style={s.moreBtn}
          onPress={() => void loadPosts(false, cursor)}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator color={COLORS.accent} />
          ) : (
            <Text style={s.moreBtnTxt}>Daha fazla göster</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: H_PAD_OUTER, paddingBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  sectionHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 18 },
  visitorHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visitorHintTxt: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  shortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shortcutTxt: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginLeft: 6 },
  subTabRow: { flexDirection: "row", marginBottom: 12, flexWrap: "wrap" },
  subTab: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subTabOn: { backgroundColor: `${COLORS.accent}12`, borderColor: `${COLORS.accent}55` },
  subTabTxt: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  subTabTxtOn: { color: COLORS.accent },
  err: { color: "#b91c1c", fontSize: 13, marginBottom: 8 },
  loadingBox: { paddingVertical: 24, alignItems: "center" },
  loadingTxt: { marginTop: 8, color: COLORS.textSecondary },
  empty: { color: COLORS.textSecondary, fontSize: 14, paddingVertical: 16, textAlign: "center" },
  moreBtn: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  moreBtnTxt: { fontSize: 14, fontWeight: "600", color: COLORS.accent },
  ratingsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ratingsIntro: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 18 },
  ratingsBig: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  ratingsSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  ratingsLink: { marginTop: 14 },
  ratingsLinkTxt: { fontSize: 14, fontWeight: "600", color: COLORS.accent },
  postCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginBottom: 14,
    padding: H_PAD_CARD,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  postHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarTxt: { fontSize: 13, fontWeight: "800", color: COLORS.textSecondary },
  postName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  badgeRow: { flexDirection: "row", alignItems: "center", marginTop: 2, flexWrap: "wrap" },
  typeBadge: {
    alignSelf: "flex-start",
    marginRight: 8,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeSys: { backgroundColor: "#ecfdf5" },
  typeBadgeText: { fontSize: 11, fontWeight: "700", color: "#4338ca" },
  postTime: { fontSize: 12, color: COLORS.textMuted },
  postBody: { fontSize: 15, color: COLORS.text, lineHeight: 22, marginBottom: 8 },
  metaBlock: { marginBottom: 8 },
  metaLine: { fontSize: 13, color: COLORS.textSecondary },
  mediaBlock: {
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    alignSelf: "stretch",
    maxWidth: "100%",
  },
  imgScroll: { maxHeight: 240 },
  postImgPage: { height: 220, justifyContent: "center", overflow: "hidden" },
  postImg: { height: 220, borderRadius: 12, backgroundColor: "#f1f5f9" },
  detailCta: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  postActions: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  actionTxt: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600", marginLeft: 6 },
});
