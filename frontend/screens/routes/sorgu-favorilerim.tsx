/**
 * Pro sorgu favorilerim — GET /api/portal/recent-queries/favorites/
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
  Image,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import {
  getPortalQueryFavoritesList,
  type PortalQueryFavoriteListItem,
  type PortalQueryFavoritesListResponse,
} from "../../services/portalService";

/** Bildirimler / Emlak Vitrini / ilanlarım ile aynı üst bar dili */
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
} as const;

function formatTryPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

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

export default function SorguFavorilerimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<PortalQueryFavoriteListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasMore = useMemo(() => items.length < total, [items.length, total]);

  const countLabel = useMemo(() => {
    if (!isAuthenticated || loading) return null;
    return `${total.toLocaleString("tr-TR")} kayıt`;
  }, [isAuthenticated, loading, total]);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!isAuthenticated) return;
      const res = await getPortalQueryFavoritesList(nextPage, 30);
      if (!res.ok) {
        if (append) setLoadingMore(false);
        else {
          setItems([]);
          setTotal(0);
          setLoading(false);
        }
        if (!append && res.status === 401) {
          Alert.alert("Oturum", "Listeyi görmek için giriş yapın.");
        }
        return;
      }
      const raw: PortalQueryFavoritesListResponse = res.data;
      const list = Array.isArray(raw.items) ? raw.items : [];
      const tot = Number(raw.pagination?.total ?? list.length);
      setTotal(Number.isFinite(tot) ? tot : list.length);
      setPage(nextPage);
      setItems((prev) => (append ? [...prev, ...list] : list));
      if (append) setLoadingMore(false);
      else setLoading(false);
    },
    [isAuthenticated],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      void fetchPage(1, false);
    }, [isAuthenticated, fetchPage]),
  );

  const onRefresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setRefreshing(true);
    await fetchPage(1, false);
    setRefreshing(false);
  }, [isAuthenticated, fetchPage]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loading || loadingMore || refreshing) return;
    setLoadingMore(true);
    void fetchPage(page + 1, true);
  }, [hasMore, loading, loadingMore, refreshing, fetchPage, page]);

  const onOpen = useCallback(
    (it: PortalQueryFavoriteListItem) => {
      const sid = it.snapshot_id;
      if (sid == null || !Number.isFinite(Number(sid))) return;
      router.push("son-30-gun-detay", { snapshotId: String(sid) });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: PortalQueryFavoriteListItem }) => {
      const title = item.title?.trim() || "Pro sorgu";
      const loc = [item.quarter_name, item.town_name, item.city_name].filter(Boolean).join(" · ");
      const adaParsel =
        item.ada != null && item.parsel != null ? `${item.ada}/${item.parsel}` : "";
      const thumb = item.thumbnail_url?.trim();

      return (
        <TouchableOpacity style={styles.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
          <View style={styles.thumbWrap}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbPh]}>
                <Ionicons name="map-outline" size={24} color={THEME.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {title}
            </Text>
            {adaParsel ? (
              <Text style={styles.adaParsel} numberOfLines={1}>
                Ada/Parsel {adaParsel}
              </Text>
            ) : null}
            {loc ? (
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={14} color={THEME.textSecondary} />
                <Text style={styles.cardLoc} numberOfLines={2}>
                  {loc}
                </Text>
              </View>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={styles.price}>{formatTryPrice(item.total_price)}</Text>
              {item.area_m2 != null && Number.isFinite(Number(item.area_m2)) ? (
                <Text style={styles.area}>
                  {new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Number(item.area_m2))} m²
                </Text>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={THEME.borderSoft} />
        </TouchableOpacity>
      );
    },
    [onOpen],
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeOuter} edges={["top", "bottom"]}>
        <MobileFavoritesHeader
          title="Sorgu favorilerim"
          subtitle="Kaydettiğiniz Pro sorgular"
          countLabel={null}
          onBack={() => router.back()}
        />
        <View style={[styles.screenBody, styles.unauthBody, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Text style={styles.unauthText}>Giriş yaparak sorgu favorilerinizi görün.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("login")}>
            <Text style={styles.primaryBtnText}>Giriş yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeOuter} edges={["top"]}>
      <MobileFavoritesHeader
        title="Sorgu favorilerim"
        subtitle="Kaydettiğiniz Pro sorgular"
        countLabel={countLabel}
        onBack={() => router.back()}
      />
      <View style={styles.screenBody}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={THEME.accentBlue} />
            <Text style={styles.loadingHint}>Yükleniyor…</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.snapshot_id)}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 20) }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.accentBlue]} tintColor={THEME.accentBlue} />
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
                <Text style={styles.emptyTitle}>Henüz favori sorgu yok</Text>
                <Text style={styles.emptySub}>Son 30 gün listesinden sorgu detayında kalbe dokunun.</Text>
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
  list: { paddingHorizontal: 16, paddingTop: 6 },
  loadingBlock: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingHint: { marginTop: 12, fontSize: 15, color: THEME.textSecondary, fontWeight: "600" },
  footerLoad: { paddingVertical: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.borderSoft,
    padding: 12,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: "rgba(15,23,42,0.08)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  thumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: "hidden" },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbPh: { backgroundColor: THEME.pageBg, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: THEME.textPrimary, lineHeight: 22 },
  adaParsel: { fontSize: 12, fontWeight: "700", color: THEME.textSecondary, marginTop: 4 },
  locRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 6 },
  cardLoc: { flex: 1, fontSize: 13, color: THEME.textSecondary, lineHeight: 18 },
  cardFooter: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 },
  price: { fontSize: 16, fontWeight: "900", color: THEME.accentBlue },
  area: { fontSize: 13, fontWeight: "700", color: THEME.textSecondary },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
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
  emptySub: { fontSize: 15, color: THEME.textSecondary, textAlign: "center", marginTop: 10, lineHeight: 22 },
  unauthBody: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  unauthText: { fontSize: 15, color: THEME.textSecondary, textAlign: "center", marginBottom: 16 },
  primaryBtn: {
    backgroundColor: THEME.accentBlue,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
