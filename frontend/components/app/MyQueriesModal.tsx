import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { formatTurkishPrice } from "../../src/utils/priceParser";
import {
  loadSavedQueries,
  removeSavedQuery,
  removeSavedQueryByKey,
  findSavedQueryByKey,
  SavedQuery,
} from "../../src/utils/savedQueries";
import {
  listSavedQueriesApi,
  deleteSavedQueryApi,
  type ApiSavedQuery,
  type SavedQueryListFilters,
} from "../../services/savedQueriesApi";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

export type SavedQueryItem = (SavedQuery & { _fromApi?: false }) | (ApiSavedQuery & { local?: SavedQuery | null; _fromApi: true });

function formatRouteMeters(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(Number(m))) return "—";
  const n = Number(m);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)} km`;
  return `${Math.round(n)} m`;
}

type NavPreset = number | null; // null = tümü; metre üst sınır

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (q: SavedQueryItem) => void;
  isAuthenticated?: boolean;
};

const CITY_PRESETS: { label: string; value: NavPreset }[] = [
  { label: "Tümü", value: null },
  { label: "≤ 5 km", value: 5000 },
  { label: "≤ 10 km", value: 10000 },
  { label: "≤ 20 km", value: 20000 },
  { label: "≤ 35 km", value: 35000 },
];

const TOWN_PRESETS: { label: string; value: NavPreset }[] = [
  { label: "Tümü", value: null },
  { label: "≤ 3 km", value: 3000 },
  { label: "≤ 8 km", value: 8000 },
  { label: "≤ 15 km", value: 15000 },
];

export default function MyQueriesModal({ visible, onClose, onSelect, isAuthenticated }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SavedQueryItem[]>([]);
  /** Şehir / ilçe merkezine rota mesafesi üst sınırı (m); yalnızca giriş yapmış kullanıcıda API’ye gider */
  const [maxNavCityM, setMaxNavCityM] = useState<NavPreset>(null);
  const [maxNavTownM, setMaxNavTownM] = useState<NavPreset>(null);
  const insets = useSafeAreaInsets();

  const listBottomPadding = useMemo(() => (insets.bottom || 0) + 24, [insets.bottom]);
  const snapPoints = useMemo(() => ["70%", "88%"], []);

  const navFiltersForApi = useMemo((): SavedQueryListFilters | undefined => {
    const f: SavedQueryListFilters = {};
    if (maxNavCityM != null) f.max_nav_city_m = maxNavCityM;
    if (maxNavTownM != null) f.max_nav_town_m = maxNavTownM;
    return Object.keys(f).length ? f : undefined;
  }, [maxNavCityM, maxNavTownM]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isAuthenticated) {
        const apiRes = await listSavedQueriesApi(navFiltersForApi);
        if (apiRes.ok && Array.isArray(apiRes.results)) {
          const merged: SavedQueryItem[] = [];
          for (const apiItem of apiRes.results) {
            const local = await findSavedQueryByKey(apiItem.tkgm_value, apiItem.ada, apiItem.parsel);
            merged.push({ ...apiItem, local: local ?? undefined, _fromApi: true });
          }
          setItems(merged);
        } else {
          setItems([]);
        }
      } else {
        const list = await loadSavedQueries();
        setItems(Array.isArray(list) ? list : []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, navFiltersForApi]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  const handleDelete = useCallback(
    async (item: SavedQueryItem) => {
      try {
        if (item._fromApi && "id" in item && typeof item.id === "number") {
          const delRes = await deleteSavedQueryApi(item.id);
          if (!delRes.ok) {
            Alert.alert("Hata", delRes.error || "Silme işlemi başarısız oldu.");
            return;
          }
          await removeSavedQueryByKey(item.tkgm_value, item.ada, item.parsel);
        } else {
          await removeSavedQuery(String((item as SavedQuery).id));
        }
        await refresh();
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Silme işlemi başarısız oldu.");
      }
    },
    [refresh]
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialIndex={0}
      modalProps={{
        // keep same look/feel as previous sheet
        containerStyle: styles.backdrop,
      }}
    >
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Sorgularım</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={refresh} style={styles.iconBtn} accessibilityLabel="Yenile">
              <Ionicons name="refresh" size={18} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Kapat">
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
          </View>
        </View>
        {isAuthenticated ? (
          <View style={styles.filterBlock}>
            <Text style={styles.filterLabel}>Şehir merkezi (rota)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {CITY_PRESETS.map((p) => {
                const sel = maxNavCityM === p.value;
                return (
                  <TouchableOpacity
                    key={`c-${p.label}-${p.value ?? "all"}`}
                    onPress={() => {
                      setMaxNavCityM(p.value);
                    }}
                    style={[styles.chip, sel && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={[styles.filterLabel, styles.filterLabelSecond]}>İlçe merkezi (rota)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {TOWN_PRESETS.map((p) => {
                const sel = maxNavTownM === p.value;
                return (
                  <TouchableOpacity
                    key={`t-${p.label}-${p.value ?? "all"}`}
                    onPress={() => {
                      setMaxNavTownM(p.value);
                    }}
                    style={[styles.chip, sel && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.filterHint}>
              Mesafe verisi yoksa sonuç listesinde görünmez. Listeyi yenileyin veya yeni sorgu kaydedin.
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#93c5fd" />
          <Text style={styles.muted}>Yükleniyor…</Text>
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Kayıtlı sorgu yok.</Text>
        </View>
      ) : (
        <BottomSheetScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          scrollEventThrottle={16}
        >
          {items.map((q) => {
            const apiTitle = "title" in q ? q.title : null;
            const baseTitle = apiTitle || `${q.ada}/${q.parsel} • ${q.tkgm_value}`;
            const local = "_fromApi" in q && q._fromApi ? q.local : undefined;
            const unit = (local?.price_snapshot ?? (q as SavedQuery).price_snapshot)?.unit_price ?? null;
            const total = (local?.price_snapshot ?? (q as SavedQuery).price_snapshot)?.total_price ?? null;
            const createdAt = "created_at" in q ? q.created_at : (q as SavedQuery).createdAt;
            // Uzman talebi sorguları için badge ve durum ikonu
            const isExpertRequest = "_fromApi" in q && q._fromApi && q.source_type === "expert_request";
            const responseStatus = "_fromApi" in q && q._fromApi ? q.responseStatus : null;
            const title = isExpertRequest && !String(baseTitle).includes("-talep") ? `${baseTitle} -talep` : baseTitle;
            return (
              <View key={String(q.id)} style={styles.card}>
                <TouchableOpacity onPress={() => onSelect(q)} style={styles.cardMain} activeOpacity={0.8}>
                  <View style={styles.cardTitleRow}>
                    {isExpertRequest && <View style={styles.requestDot} />}
                    <Text style={[styles.cardTitle, isExpertRequest && styles.cardTitleWithBadge]} numberOfLines={1}>
                      {title}
                    </Text>
                    {isExpertRequest && responseStatus && (
                      <Ionicons
                        name={responseStatus === "answered" ? "checkmark-circle" : "time-outline"}
                        size={16}
                        color={responseStatus === "answered" ? "#22c55e" : "#fbbf24"}
                        style={styles.statusIcon}
                      />
                    )}
                  </View>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    Birim: {formatTurkishPrice(unit)} • Toplam: {formatTurkishPrice(total)}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {new Date(createdAt).toLocaleString("tr-TR")}
                  </Text>
                  {"_fromApi" in q && q._fromApi && (q.nav_in_distance_m_city != null || q.nav_in_distance_m_town != null) ? (
                    <Text style={styles.cardNav} numberOfLines={1}>
                      Şehir: {formatRouteMeters(q.nav_in_distance_m_city)} • İlçe:{" "}
                      {formatRouteMeters(q.nav_in_distance_m_town)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(q)} style={styles.delBtn} accessibilityLabel="Sil">
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            );
          })}
        </BottomSheetScrollView>
      )}
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    // BottomSheetModal container style
    backgroundColor: "transparent",
  },
  sheet: {
    backgroundColor: "#f3f4f6",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    flexDirection: "row",
    alignItems: "center",
  },
  filterBlock: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
    backgroundColor: "#f8fafc",
  },
  filterLabel: { fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.55)", marginTop: 4 },
  filterLabelSecond: { marginTop: 10 },
  filterRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingRight: 8 },
  chip: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    backgroundColor: "#fff",
  },
  chipSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  chipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTextSelected: { color: "#1d4ed8" },
  filterHint: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(15,23,42,0.45)",
    marginTop: 4,
    lineHeight: 14,
  },
  title: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  headerBtns: { marginLeft: "auto", flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  center: { padding: 18, alignItems: "center", gap: 10 },
  muted: { color: "rgba(15,23,42,0.65)", fontSize: 12, fontWeight: "600" },
  list: { flex: 1, paddingHorizontal: 0 },
  listContent: { paddingVertical: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.12)",
    backgroundColor: "#ffffff",
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardMain: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  cardTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800", flex: 1 },
  cardTitleWithBadge: { flex: 0, marginLeft: 6 },
  requestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
  },
  statusIcon: { marginLeft: 6 },
  cardSub: { color: "rgba(15,23,42,0.65)", fontSize: 12, marginTop: 4, fontWeight: "600" },
  cardMeta: { color: "rgba(15,23,42,0.45)", fontSize: 11, marginTop: 6, fontWeight: "600" },
  cardNav: { color: "rgba(30,64,175,0.85)", fontSize: 11, marginTop: 5, fontWeight: "700" },
  delBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
});

