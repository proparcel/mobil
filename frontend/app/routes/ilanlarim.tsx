/**
 * İlanlarım — self API ile liste; satıra dokununca web sihirbazı (düzenleme).
 */
import React, { useCallback, useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { getMyListings, createListingDraft } from "../../services/listingService";
import type { MineListingRow } from "../../src/types/listing";

const COLORS = {
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderSoft: "#e2e8f0",
  accentBlue: "#3b82f6",
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
} as const;

function formatPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  } catch {
    return "—";
  }
}

function statusLabel(pub?: string | null, workflow?: string | null): string {
  const p = (pub || "").toLowerCase();
  if (p === "published") return "Yayında";
  if (p === "unpublished") return "Taslak";
  const w = (workflow || "").toLowerCase();
  if (w === "draft") return "Taslak";
  return pub || workflow || "—";
}

export default function IlanlarimScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<MineListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    const res = await getMyListings();
    if (!res.ok) {
      setItems([]);
      if (res.status === 401) {
        Alert.alert("Oturum", "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.");
      } else if (res.status === 404) {
        Alert.alert(
          "İlan API",
          "İlan servisi bu ortamda kapalı olabilir. Yöneticinize başvurun.",
        );
      }
      return;
    }
    setItems(Array.isArray(res.data.items) ? res.data.items : []);
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openEdit = useCallback(
    (listingId: string) => {
      router.push("portal-webview", {
        path: `/portal/ilan/${listingId}/duzenle/`,
        title: "İlan düzenle",
      });
    },
    [router],
  );

  const listingTotals = useMemo(() => {
    let views = 0;
    let favorites = 0;
    let comments = 0;
    for (const it of items) {
      views += Math.max(0, Number(it.detail_view_count_total ?? 0) || 0);
      favorites += Math.max(0, Number(it.favorite_count_total ?? 0) || 0);
      comments += Math.max(0, Number(it.comment_count ?? 0) || 0);
    }
    return { views, favorites, comments };
  }, [items]);

  const onNewListing = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert("Giriş gerekli", "İlan oluşturmak için giriş yapın veya kayıt olun.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    setCreating(true);
    try {
      const res = await createListingDraft();
      if (!res.ok) {
        Alert.alert(
          "İlan oluşturulamadı",
          res.error || "Sunucu yanıtı alınamadı.",
        );
        return;
      }
      const lid = res.data?.data?.listing_id;
      if (!lid) {
        Alert.alert("İlan oluşturulamadı", "Tanıtıcı alınamadı.");
        return;
      }
      openEdit(lid);
    } finally {
      setCreating(false);
    }
  }, [isAuthenticated, router, openEdit]);

  const renderItem = useCallback(
    ({ item }: { item: MineListingRow }) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openEdit(item.listing_id)}
        activeOpacity={0.7}
      >
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="image-outline" size={28} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {item.title?.trim() || "Başlıksız ilan"}
          </Text>
          <Text style={styles.rowMeta}>
            {statusLabel(item.publication_status, item.workflow_status)} ·{" "}
            {formatDate(item.updated_at)}
          </Text>
          <Text style={styles.rowStats} numberOfLines={1}>
            {Math.max(0, Number(item.detail_view_count_total ?? 0) || 0).toLocaleString("tr-TR")} gösterim ·{" "}
            {Math.max(0, Number(item.favorite_count_total ?? 0) || 0).toLocaleString("tr-TR")} favori ·{" "}
            {Math.max(0, Number(item.comment_count ?? 0) || 0).toLocaleString("tr-TR")} yorum
          </Text>
          <Text style={styles.rowPrice}>{formatPrice(item.price_amount ?? null)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.borderSoft} />
      </TouchableOpacity>
    ),
    [openEdit],
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>İlanlarım</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errText}>İlanlarınızı görmek için giriş yapın.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("login")}>
            <Text style={styles.primaryBtnText}>Giriş</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>İlanlarım</Text>
        <TouchableOpacity
          onPress={onNewListing}
          disabled={creating}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {creating ? (
            <ActivityIndicator size="small" color={COLORS.accentBlue} />
          ) : (
            <Ionicons name="add-circle-outline" size={26} color={COLORS.accentBlue} />
          )}
        </TouchableOpacity>
      </View>
      {!loading && items.length ? (
        <View style={styles.statsStrip}>
          <Text style={styles.statsStripText}>
            Toplam:{" "}
            <Text style={styles.statsStripStrong}>{listingTotals.views.toLocaleString("tr-TR")}</Text> gösterim ·{" "}
            <Text style={styles.statsStripStrong}>{listingTotals.favorites.toLocaleString("tr-TR")}</Text> favori ·{" "}
            <Text style={styles.statsStripStrong}>{listingTotals.comments.toLocaleString("tr-TR")}</Text> yorum
          </Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.listing_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.accentBlue]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color={COLORS.borderSoft} />
              <Text style={styles.emptyText}>Henüz ilanınız yok.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onNewListing} disabled={creating}>
                <Text style={styles.primaryBtnText}>İlan ver</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: "#fff",
  },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  statsStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  statsStripText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  statsStripStrong: { color: COLORS.textPrimary, fontWeight: "800" },
  list: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    gap: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: COLORS.pageBg },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: COLORS.pageBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  rowMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  rowStats: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, fontWeight: "600" },
  rowPrice: { fontSize: 13, fontWeight: "600", color: COLORS.accentBlue, marginTop: 4 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errText: { fontSize: 15, color: COLORS.textSecondary, textAlign: "center", marginBottom: 16 },
  empty: { alignItems: "center", padding: 32 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, marginTop: 12, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: COLORS.accentBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
