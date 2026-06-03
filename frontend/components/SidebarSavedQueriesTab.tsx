import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SIDEBAR_SAVED_QUERIES_CHANGED } from "../src/constants/sidebarSavedQueriesEvents";
import { formatQueryArea } from "../src/utils/savedQueryDisplay";
import {
  buildSidebarQueryKey,
  deleteSidebarSavedQuery,
  loadSidebarSavedQueries,
  type SidebarSavedQuery,
} from "../src/utils/sidebarSavedQueries";

type Props = {
  visible: boolean;
  onSelect: (item: SidebarSavedQuery) => void;
};

export default function SidebarSavedQueriesTab({ visible, onSelect }: Props) {
  const [items, setItems] = useState<SidebarSavedQuery[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const list = await loadSidebarSavedQueries();
    setItems(list);
    const valid = new Set(list.map((row) => String(row.id || buildSidebarQueryKey(row))));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    const sub = DeviceEventEmitter.addListener(SIDEBAR_SAVED_QUERIES_CHANGED, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [visible, refresh]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((row) => String(row.id || buildSidebarQueryKey(row)))));
  }, [allSelected, items]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteOne = useCallback(
    async (id: string) => {
      try {
        await deleteSidebarSavedQuery(id);
        await refresh();
      } catch (e: unknown) {
        Alert.alert("Hata", (e as Error)?.message || "Silme işlemi başarısız oldu.");
      }
    },
    [refresh]
  );

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        await deleteSidebarSavedQuery(id);
      }
      setSelectedIds(new Set());
      await refresh();
    } catch (e: unknown) {
      Alert.alert("Hata", (e as Error)?.message || "Silme işlemi başarısız oldu.");
    }
  }, [selectedIds, refresh]);

  if (!items.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerHint}>Cihazda saklanan son sorgular</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Henüz kayıtlı sorgu yok.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerHint}>Cihazda saklanan son sorgular</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={toggleSelectAll} style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionBtnText}>{allSelected ? "Seçimi kaldır" : "Hepsini seç"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void deleteSelected()}
          style={[styles.actionBtn, styles.actionBtnDanger, selectedIds.size === 0 && styles.actionBtnDisabled]}
          disabled={selectedIds.size === 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>
            {selectedIds.size > 0 ? `Seçilenleri sil (${selectedIds.size})` : "Seçilenleri sil"}
          </Text>
        </TouchableOpacity>
      </View>

      {items.map((item) => {
        const itemId = String(item.id || buildSidebarQueryKey(item));
        const checked = selectedIds.has(itemId);
        const area = formatQueryArea(item.alan);
        const subLine =
          `Ada/Parsel: ${item.ada || "-"}/${item.parsel || "-"}` + (area ? ` · Alan: ${area}` : "");
        const modeLabel = item.mode === "pro" ? "Pro" : "Basit";

        return (
          <View key={itemId} style={styles.card}>
            <Pressable
              onPress={() => toggleSelect(itemId)}
              style={styles.checkHit}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel="Sorguyu seç"
            >
              <Ionicons
                name={checked ? "checkbox" : "square-outline"}
                size={22}
                color={checked ? "#60a5fa" : "#64748b"}
              />
            </Pressable>

            <TouchableOpacity
              onPress={() => onSelect(item)}
              style={styles.cardMain}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${item.il} ${item.ilce} sorguyu çalıştır`}
            >
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {(item.il || "-") + " / " + (item.ilce || "-")}
                </Text>
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeText}>{modeLabel}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.mahalle || "Mahalle bilgisi yok"}
              </Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {subLine}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void deleteOne(itemId)}
              style={styles.delBtn}
              accessibilityLabel="Sorguyu sil"
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 10,
  },
  headerHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#334155",
  },
  actionBtnDanger: {
    borderColor: "rgba(248, 113, 113, 0.45)",
    backgroundColor: "rgba(127, 29, 29, 0.25)",
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  actionBtnDangerText: {
    color: "#fecaca",
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    overflow: "hidden",
  },
  checkHit: {
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  cardMain: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 8,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#1e3a5f",
  },
  modeBadgeText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
  },
  cardMeta: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  cardSub: {
    color: "#94a3b8",
    fontSize: 12,
  },
  delBtn: {
    paddingHorizontal: 12,
    justifyContent: "center",
  },
});
