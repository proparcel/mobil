import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { removeSavedQuery, removeSavedQueryByKey, SavedQuery } from "../../src/utils/savedQueries";
import { deleteSavedQueryApi, type ApiSavedQuery } from "../../services/savedQueriesApi";
import { SAVED_QUERIES_CHANGED } from "../../src/constants/savedQueriesEvents";
import { useSavedQueriesList } from "../../src/hooks/useSavedQueriesList";
import { DeviceEventEmitter } from "react-native";
import { getSavedQueryDisplayRow, getSavedQueryItemId } from "../../src/utils/savedQueryDisplay";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  USER_MENU_SHEET_SNAP_POINTS,
  UserMenuSheetTitleRow,
  userMenuSheetDarkStyles,
} from "./UserMenuSheet";

export type SavedQueryItem =
  | (SavedQuery & { _fromApi?: false })
  | (ApiSavedQuery & { local?: SavedQuery | null; _fromApi: true });

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (q: SavedQueryItem) => void;
  isAuthenticated?: boolean;
};

const st = userMenuSheetDarkStyles;

export default function MyQueriesModal({ visible, onClose, onSelect, isAuthenticated }: Props) {
  const insets = useSafeAreaInsets();
  const { loading, items, refresh } = useSavedQueriesList(isAuthenticated, visible);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const listBottomPadding = useMemo(() => (insets.bottom || 0) + 24, [insets.bottom]);

  useEffect(() => {
    if (!visible) setSelectedIds(new Set());
  }, [visible]);

  useEffect(() => {
    const valid = new Set(items.map(getSavedQueryItemId));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map(getSavedQueryItemId)));
  }, [allSelected, items]);

  const deleteOne = useCallback(
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
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(getSavedQueryItemId(item));
          return next;
        });
        await refresh();
        DeviceEventEmitter.emit(SAVED_QUERIES_CHANGED);
      } catch (e: unknown) {
        Alert.alert("Hata", (e as Error)?.message || "Silme işlemi başarısız oldu.");
      }
    },
    [refresh],
  );

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const targets = items.filter((q) => selectedIds.has(getSavedQueryItemId(q)));
    try {
      for (const item of targets) {
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
      }
      setSelectedIds(new Set());
      await refresh();
      DeviceEventEmitter.emit(SAVED_QUERIES_CHANGED);
    } catch (e: unknown) {
      Alert.alert("Hata", (e as Error)?.message || "Silme işlemi başarısız oldu.");
    }
  }, [selectedIds, items, refresh]);

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={[...USER_MENU_SHEET_SNAP_POINTS]}
      initialIndex={0}
      variant="dark"
      backdropOpacity={0.2}
      backdropPressBehavior="close"
    >
      <View style={{ paddingBottom: insets.bottom, flex: 1 }}>
        <UserMenuSheetTitleRow title="Sorgularım" variant="dark" />
        <View style={localStyles.toolbar}>
          <TouchableOpacity onPress={() => void refresh()} style={localStyles.toolBtn} accessibilityLabel="Yenile">
            <Ionicons name="refresh" size={18} color="#e2e8f0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={localStyles.toolBtn} accessibilityLabel="Kapat">
            <Ionicons name="close" size={20} color="#e2e8f0" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={localStyles.center}>
            <ActivityIndicator color="#60a5fa" />
            <Text style={localStyles.muted}>Yükleniyor…</Text>
          </View>
        ) : empty ? (
          <View style={localStyles.center}>
            <Text style={localStyles.muted}>Henüz kayıtlı sorgu yok.</Text>
          </View>
        ) : (
          <>
            <View style={localStyles.actionsRow}>
              <TouchableOpacity onPress={toggleSelectAll} style={localStyles.actionBtn} activeOpacity={0.7}>
                <Text style={localStyles.actionBtnText}>{allSelected ? "Seçimi kaldır" : "Hepsini seç"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void deleteSelected()}
                style={[localStyles.actionBtn, localStyles.actionBtnDanger, selectedIds.size === 0 && localStyles.actionBtnDisabled]}
                disabled={selectedIds.size === 0}
                activeOpacity={0.7}
              >
                <Text style={[localStyles.actionBtnText, localStyles.actionBtnDangerText]}>
                  {selectedIds.size > 0 ? `Seçilenleri sil (${selectedIds.size})` : "Seçilenleri sil"}
                </Text>
              </TouchableOpacity>
            </View>

            <BottomSheetScrollView
              style={st.scroll}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: listBottomPadding }}
              scrollEventThrottle={16}
              nestedScrollEnabled
            >
              {items.map((q) => {
                const row = getSavedQueryDisplayRow(q);
                const itemId = row.id;
                const checked = selectedIds.has(itemId);
                const subLine =
                  `Ada/Parsel: ${row.ada}/${row.parsel}` + (row.alan ? ` · Alan: ${row.alan}` : "");

                return (
                  <View key={itemId} style={localStyles.card}>
                    <Pressable
                      onPress={() => toggleSelect(itemId)}
                      style={localStyles.checkHit}
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
                      onPress={() => onSelect(q)}
                      style={localStyles.cardMain}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.il} ${row.ilce} ${row.mahalle} sorguyu çalıştır`}
                    >
                      <View style={localStyles.titleRow}>
                        <Text style={localStyles.cardTitle} numberOfLines={1}>
                          {row.il} / {row.ilce}
                        </Text>
                        <View style={localStyles.modeBadge}>
                          <Text style={localStyles.modeBadgeText}>{row.modeLabel}</Text>
                        </View>
                      </View>
                      <Text style={localStyles.cardMeta} numberOfLines={1}>
                        {row.mahalle}
                      </Text>
                      <Text style={localStyles.cardSub} numberOfLines={1}>
                        {subLine}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => void deleteOne(q)}
                      style={localStyles.delBtn}
                      accessibilityLabel="Sorguyu sil"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <View style={{ minHeight: 16 }} />
            </BottomSheetScrollView>
          </>
        )}
      </View>
    </AppBottomSheetModal>
  );
}

const localStyles = {
  toolbar: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#334155",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  center: { padding: 18, alignItems: "center" as const, gap: 10 },
  muted: { color: "#94a3b8", fontSize: 12, fontWeight: "600" as const },
  actionsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#334155",
  },
  actionBtnDanger: {
    borderColor: "rgba(248,113,113,0.45)",
    backgroundColor: "rgba(127,29,29,0.35)",
  },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnText: { fontSize: 12, fontWeight: "700" as const, color: "#e2e8f0" },
  actionBtnDangerText: { color: "#fca5a5" },
  card: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    marginBottom: 2,
  },
  checkHit: { padding: 4 },
  cardMain: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  cardTitle: { color: "#e2e8f0", fontSize: 13, fontWeight: "800" as const, flexShrink: 1 },
  modeBadge: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  modeBadgeText: { fontSize: 10, fontWeight: "800" as const, color: "#93c5fd" },
  cardMeta: { color: "#94a3b8", fontSize: 12, marginTop: 4, fontWeight: "600" as const },
  cardSub: { color: "#64748b", fontSize: 11, marginTop: 4, fontWeight: "600" as const },
  delBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(127,29,29,0.25)",
  },
};
