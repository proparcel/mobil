/**
 * İlanlarım — self API ile liste; web stratejisi ile uyumlu kartlar ve aksiyonlar.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import MineListingsPanel from "../../components/app/MineListingsPanel";
import {
  createListingDraft,
  deactivateListing,
  getMyListings,
  publishListing,
} from "../../services/listingService";
import type { MineListingRow } from "../../src/types/listing";

const COLORS = {
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderSoft: "#e2e8f0",
  accentBlue: "#3b82f6",
  pageBg: "#f8fafc",
} as const;

export default function IlanlarimScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<MineListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

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
      router.push("listing-wizard", {
        listingId,
        mode: "edit",
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
        Alert.alert("İlan oluşturulamadı", res.error || "Sunucu yanıtı alınamadı.");
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

  const onDeactivate = useCallback(
    (row: MineListingRow) => {
      const pub = String(row.publication_status || "").toLowerCase();
      if (pub !== "published") {
        Alert.alert("Bilgi", "Sadece yayında olan ilanlar pasife alınabilir.");
        return;
      }
      const v = row.version != null ? Number(row.version) : 0;
      Alert.alert("İlanı pasife al", "Yayındaki ilan vitrinden kaldırılır. Devam edilsin mi?", [
        { text: "İptal", style: "cancel" },
        {
          text: "Pasife al",
          style: "destructive",
          onPress: async () => {
            setBusyListingId(row.listing_id);
            try {
              const res = await deactivateListing(row.listing_id, v);
              if (!res.ok) {
                Alert.alert(
                  "Hata",
                  typeof res.error === "string" ? res.error : "İşlem tamamlanamadı.",
                );
                return;
              }
              await load();
              Alert.alert("Tamam", "İlan pasife alındı.");
            } finally {
              setBusyListingId(null);
            }
          },
        },
      ]);
    },
    [load],
  );

  const onPublish = useCallback(
    (row: MineListingRow) => {
      const pub = String(row.publication_status || "").toLowerCase();
      if (pub !== "inactive") {
        Alert.alert("Bilgi", "Sadece pasif ilanlar tekrar yayınlanabilir.");
        return;
      }
      const v = row.version != null ? Number(row.version) : 0;
      Alert.alert("İlanı yayınla", "Bu ilan tekrar vitrine yayınlansın mı?", [
        { text: "İptal", style: "cancel" },
        {
          text: "Yayınla",
          onPress: async () => {
            setBusyListingId(row.listing_id);
            try {
              const res = await publishListing(row.listing_id, v);
              if (!res.ok) {
                Alert.alert(
                  "Hata",
                  typeof res.error === "string" ? res.error : "İşlem tamamlanamadı.",
                );
                return;
              }
              await load();
              Alert.alert("Tamam", "İlan yayınlandı.");
            } finally {
              setBusyListingId(null);
            }
          },
        },
      ]);
    },
    [load],
  );

  const statsStrip =
    !loading && items.length ? (
      <View style={styles.statsStrip}>
        <Text style={styles.statsStripText}>
          Toplam:{" "}
          <Text style={styles.statsStripStrong}>{listingTotals.views.toLocaleString("tr-TR")}</Text>{" "}
          gösterim ·{" "}
          <Text style={styles.statsStripStrong}>
            {listingTotals.favorites.toLocaleString("tr-TR")}
          </Text>{" "}
          favori ·{" "}
          <Text style={styles.statsStripStrong}>
            {listingTotals.comments.toLocaleString("tr-TR")}
          </Text>{" "}
          yorum
        </Text>
      </View>
    ) : null;

  const emptyList = (
    <View style={styles.empty}>
      <Ionicons name="list-outline" size={48} color={COLORS.borderSoft} />
      <Text style={styles.emptyText}>Henüz ilanınız yok.</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={onNewListing} disabled={creating}>
        <Text style={styles.primaryBtnText}>İlan ver</Text>
      </TouchableOpacity>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
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
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
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
      {loading && !items.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
        </View>
      ) : (
        <MineListingsPanel
          items={items}
          loading={loading}
          onOpenEditor={openEdit}
          onDeactivate={onDeactivate}
          onPublish={onPublish}
          variant="standalone"
          refreshing={refreshing}
          onRefresh={onRefresh}
          busyListingId={busyListingId}
          ListHeaderComponent={statsStrip}
          ListEmptyComponent={emptyList}
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
    paddingHorizontal: 0,
    paddingVertical: 10,
    marginBottom: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 12,
  },
  statsStripText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  statsStripStrong: { color: COLORS.textPrimary, fontWeight: "800" },
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
