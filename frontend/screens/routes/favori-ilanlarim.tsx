/**
 * Favori ilanlarım — mobil özgü liste; satıra dokununca Pro detay (son-30-gun-detay), web URL yok.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import {
  listFavoriteFolders,
  listMyFavorites,
  type FavoriteListItem,
} from "../../services/portalFavoritesApi";
import { extractPublicListingPayload, getPublicListing } from "../../services/publicListingApi";

/** Bildirimler / Emlak Vitrini ile aynı üst bar */
const MOBILE_HEADER_BG = "#1e293b";
const MOBILE_HEADER_ACCENT = "#3b82f6";

const THEME = {
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderSoft: "#e2e8f0",
  accentBlue: "#3b82f6",
  accentRose: "#f43f5e",
  chipBg: "#f1f5f9",
  chipActiveBg: "#eff6ff",
  chipActiveBorder: "#93c5fd",
  shadow: "rgba(15, 23, 42, 0.08)",
} as const;

const PAGE_SIZE = 25;

function formatTryPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatListingType(t: string | null | undefined): string {
  const s = String(t || "").toLowerCase();
  if (s === "sale" || s === "satilik") return "Satılık";
  if (s === "rent" || s === "kiralik") return "Kiralık";
  return "";
}

function formatLocationLine(labels: unknown): string {
  if (labels == null) return "";
  if (typeof labels === "string") return labels.trim();
  if (typeof labels === "object" && !Array.isArray(labels)) {
    const o = labels as Record<string, unknown>;
    const parts = [
      o.city_name ?? o.cityName ?? o.il,
      o.district_name ?? o.districtName ?? o.ilce,
      o.quarter_name ?? o.quarterName ?? o.mahalle,
    ]
      .map((x) => (x != null ? String(x).trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
    const compact = Object.values(o)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    return compact.slice(0, 3).join(" · ");
  }
  return "";
}

function pickTitle(row: FavoriteListItem): string {
  const t = row.snapshot?.listing_summary?.title;
  if (t && String(t).trim()) return String(t).trim();
  return "İlan";
}

function pickPrice(row: FavoriteListItem): string {
  const snap = row.snapshot;
  const cur = snap?.current_price_amount ?? snap?.listing_summary?.price_amount;
  return formatTryPrice(cur != null ? Number(cur) : null);
}

function pickArea(row: FavoriteListItem): string {
  const a = row.snapshot?.listing_summary?.area_m2;
  if (a == null || Number.isNaN(Number(a))) return "";
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Number(a))} m²`;
}

type FolderRow = { folder_id: string; name: string };

function MobileFavoritesHeader({
  title,
  subtitle,
  countLabel,
  onBack,
}: {
  title: string;
  subtitle: string;
  countLabel: string | null;
  onBack: () => void;
}) {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={MOBILE_HEADER_BG} />
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerIconBtn} pointerEvents="none" />
      </View>
      <View style={styles.headerMetaStrip}>
        <Text style={styles.headerMetaText} numberOfLines={2}>
          {subtitle}
          {countLabel ? ` · ${countLabel}` : ""}
        </Text>
      </View>
    </>
  );
}

export default function FavoriIlanlarimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [folderLoading, setFolderLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [items, setItems] = useState<FavoriteListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openBusyId, setOpenBusyId] = useState<string | null>(null);

  const hasMore = useMemo(() => items.length < totalCount, [items.length, totalCount]);

  const countLabel = useMemo(() => {
    if (!isAuthenticated || loading) return null;
    const n = totalCount;
    if (!Number.isFinite(n) || n < 0) return null;
    return `${n.toLocaleString("tr-TR")} kayıt`;
  }, [isAuthenticated, loading, totalCount]);

  const loadFolders = useCallback(async () => {
    if (!isAuthenticated) {
      setFolders([]);
      setFolderLoading(false);
      return;
    }
    setFolderLoading(true);
    try {
      const list = await listFavoriteFolders();
      setFolders(Array.isArray(list) ? list : []);
    } catch {
      setFolders([]);
    } finally {
      setFolderLoading(false);
    }
  }, [isAuthenticated]);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!isAuthenticated) return;
      const res = await listMyFavorites({
        page: nextPage,
        pageSize: PAGE_SIZE,
        folderId: selectedFolderId,
      });
      if (!res.ok) {
        if (append) setLoadingMore(false);
        else {
          setItems([]);
          setTotalCount(0);
          setLoading(false);
        }
        if (!append && res.status === 401) {
          Alert.alert("Oturum", "Favorilerinizi görmek için giriş yapın.");
        }
        return;
      }
      const raw = res.data as { items?: FavoriteListItem[]; pagination?: { total_count?: number } };
      const list = Array.isArray(raw.items) ? raw.items : [];
      const tot = Number(raw.pagination?.total_count ?? list.length);
      setTotalCount(Number.isFinite(tot) ? tot : list.length);
      setPage(nextPage);
      setItems((prev) => (append ? [...prev, ...list] : list));
      if (append) setLoadingMore(false);
      else setLoading(false);
    },
    [isAuthenticated, selectedFolderId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadFolders();
    }, [loadFolders]),
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchPage(1, false);
  }, [isAuthenticated, selectedFolderId, fetchPage]);

  const onRefresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setRefreshing(true);
    await loadFolders();
    await fetchPage(1, false);
    setRefreshing(false);
  }, [isAuthenticated, fetchPage, loadFolders]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loading || loadingMore || refreshing) return;
    setLoadingMore(true);
    void fetchPage(page + 1, true);
  }, [hasMore, loading, loadingMore, refreshing, fetchPage, page]);

  const onOpenRow = useCallback(
    async (row: FavoriteListItem) => {
      const listingId = String(row.listing_id || "").trim();
      if (!listingId) return;
      const state = String(row.state || "").toLowerCase();
      if (state === "unpublished") {
        Alert.alert("İlan", "Bu ilan vitrinde artık yayında değil.");
        return;
      }
      setOpenBusyId(listingId);
      try {
        const res = await getPublicListing(listingId);
        const payload = extractPublicListingPayload(res);
        if (!res.ok || !payload) {
          Alert.alert("Detay", typeof res.ok === "boolean" && !res.ok ? res.error : "İlan bilgisi alınamadı.");
          return;
        }
        const sid = payload.portal_snapshot_id;
        if (sid != null && Number.isFinite(Number(sid)) && Number(sid) > 0) {
          router.push("son-30-gun-detay", {
            snapshotId: String(sid),
            listingId,
          });
        } else {
          Alert.alert("Detay", "Bu ilan için henüz Pro sorgu bağlantısı yok.");
        }
      } finally {
        setOpenBusyId(null);
      }
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: FavoriteListItem }) => {
      const lid = String(item.listing_id || "").trim();
      const busy = openBusyId === lid;
      const title = pickTitle(item);
      const price = pickPrice(item);
      const area = pickArea(item);
      const loc =
        formatLocationLine(item.snapshot?.listing_summary?.location_labels) ||
        formatLocationLine((item.snapshot?.listing_summary as { location?: unknown } | undefined)?.location);
      const lt = formatListingType(item.snapshot?.listing_summary?.listing_type);
      const cat = item.snapshot?.listing_summary?.category_main
        ? String(item.snapshot.listing_summary.category_main)
        : "";

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => void onOpenRow(item)}
          activeOpacity={0.75}
          disabled={busy}
        >
          <View style={styles.cardInner}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {title}
              </Text>
              {busy ? (
                <ActivityIndicator size="small" color={THEME.accentBlue} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={THEME.borderSoft} />
              )}
            </View>
            <View style={styles.cardMetaRow}>
              {lt ? (
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{lt}</Text>
                </View>
              ) : null}
              {cat ? (
                <Text style={styles.cardCat} numberOfLines={1}>
                  {cat}
                </Text>
              ) : null}
            </View>
            {loc ? (
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={15} color={THEME.textSecondary} />
                <Text style={styles.cardLoc} numberOfLines={2}>
                  {loc}
                </Text>
              </View>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={styles.price}>{price}</Text>
              {area ? (
                <View style={styles.areaPill}>
                  <Text style={styles.areaPillText}>{area}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [onOpenRow, openBusyId],
  );

  const folderChips = !folderLoading && folders.length > 0 && (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      <TouchableOpacity
        style={[styles.chip, selectedFolderId == null && styles.chipActive]}
        onPress={() => setSelectedFolderId(null)}
        activeOpacity={0.85}
      >
        <Text style={[styles.chipText, selectedFolderId == null && styles.chipTextActive]}>Tümü</Text>
      </TouchableOpacity>
      {folders.map((f) => (
        <TouchableOpacity
          key={f.folder_id}
          style={[styles.chip, selectedFolderId === f.folder_id && styles.chipActive]}
          onPress={() => setSelectedFolderId(f.folder_id)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="folder-open-outline"
            size={15}
            color={selectedFolderId === f.folder_id ? THEME.accentBlue : THEME.textSecondary}
          />
          <Text style={[styles.chipText, selectedFolderId === f.folder_id && styles.chipTextActive]} numberOfLines={1}>
            {f.name || "—"}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeOuter} edges={["top", "bottom"]}>
        <MobileFavoritesHeader
          title="Favoriler"
          subtitle="Kaydettiğiniz vitrin ilanları"
          countLabel={null}
          onBack={() => router.back()}
        />
        <View style={[styles.screenBody, styles.unauthBody, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.unauthCard}>
            <View style={styles.unauthIconWrap}>
              <Ionicons name="heart-dislike-outline" size={40} color={THEME.textSecondary} />
            </View>
            <Text style={styles.unauthTitle}>Giriş gerekli</Text>
            <Text style={styles.unauthSub}>Favori ilanlarınızı görmek ve yönetmek için hesabınıza giriş yapın.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("login")} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>Giriş yap</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeOuter} edges={["top"]}>
      <MobileFavoritesHeader
        title="Favoriler"
        subtitle="Kaydettiğiniz vitrin ilanları"
        countLabel={countLabel}
        onBack={() => router.back()}
      />

      <View style={styles.screenBody}>
        {folderLoading ? (
          <View style={styles.chipsLoading}>
            <ActivityIndicator size="small" color={THEME.accentBlue} />
            <Text style={styles.chipsLoadingText}>Klasörler…</Text>
          </View>
        ) : (
          folderChips
        )}

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={THEME.accentBlue} />
            <Text style={styles.loadingHint}>Favoriler hazırlanıyor…</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it, i) => String(it.favorite_id ?? it.listing_id ?? i)}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 20) }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[THEME.accentBlue]}
                tintColor={THEME.accentBlue}
              />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoad}>
                  <ActivityIndicator size="small" color={THEME.accentBlue} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="heart-outline" size={36} color={THEME.accentRose} />
                </View>
                <Text style={styles.emptyTitle}>Henüz favori yok</Text>
                <Text style={styles.emptySub}>
                  Emlak vitrininde beğendiğiniz ilanlarda kalbe dokunun; kayıtlar burada listelenir.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1, backgroundColor: MOBILE_HEADER_BG },
  screenBody: { flex: 1, backgroundColor: THEME.pageBg },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: MOBILE_HEADER_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: MOBILE_HEADER_ACCENT,
    gap: 6,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  headerMetaStrip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderSoft,
  },
  headerMetaText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: "600",
    lineHeight: 18,
  },
  chipsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  chipsLoadingText: { fontSize: 13, color: THEME.textSecondary, fontWeight: "600" },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: THEME.chipBg,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: THEME.chipActiveBg,
    borderColor: THEME.chipActiveBorder,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: THEME.textSecondary },
  chipTextActive: { color: THEME.accentBlue },
  list: { paddingHorizontal: 16, paddingTop: 6 },
  loadingBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingHint: { marginTop: 14, fontSize: 15, color: THEME.textSecondary, fontWeight: "600" },
  footerLoad: { paddingVertical: 18 },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  cardInner: { padding: 16 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: THEME.textPrimary,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
  },
  typePillText: { fontSize: 11, fontWeight: "800", color: "#c2410c", textTransform: "uppercase", letterSpacing: 0.3 },
  cardCat: { fontSize: 13, color: THEME.textSecondary, fontWeight: "600", flex: 1 },
  locRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  cardLoc: { flex: 1, fontSize: 14, color: THEME.textSecondary, lineHeight: 20, fontWeight: "500" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.borderSoft,
  },
  price: { fontSize: 19, fontWeight: "900", color: THEME.accentBlue, letterSpacing: -0.3 },
  areaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: THEME.pageBg,
  },
  areaPillText: { fontSize: 13, fontWeight: "700", color: THEME.textSecondary },
  empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 28 },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.borderSoft,
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: THEME.textPrimary, marginTop: 8 },
  emptySub: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
    fontWeight: "500",
  },
  unauthBody: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  unauthCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  unauthIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: THEME.pageBg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  unauthTitle: { fontSize: 20, fontWeight: "800", color: THEME.textPrimary, textAlign: "center" },
  unauthSub: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "500",
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: THEME.accentBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
