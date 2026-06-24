import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

import { useSavedQueriesList } from "../../src/hooks/useSavedQueriesList";

import { getSavedQueryItemId } from "../../src/utils/savedQueryDisplay";

import AppBottomSheetModal from "./AppBottomSheetModal";

import { BottomSheetFlatList } from "@gorhom/bottom-sheet";

import { sheetScrollBottomPadding } from "../../src/utils/sheetSafeArea";

import {

  USER_MENU_SHEET_SNAP_POINTS,

  userMenuSheetDarkStyles,

} from "./UserMenuSheet";



export type SavedQueryItem =

  | (SavedQuery & { _fromApi?: false })

  | (ApiSavedQuery & { local?: SavedQuery | null; _fromApi: true });



type Props = {

  visible: boolean;

  onClose: () => void;

  onSelect: (q: SavedQueryItem) => void;

  onSelectPro?: (q: SavedQueryItem) => void;

  isAuthenticated?: boolean;

};



const st = userMenuSheetDarkStyles;



export default function MyQueriesModal({

  visible,

  onClose,

  onSelect,

  onSelectPro,

  isAuthenticated,

}: Props) {

  const insets = useSafeAreaInsets();

  const { loading, rows, refresh, pruneItems } = useSavedQueriesList(isAuthenticated, visible);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [listEpoch, setListEpoch] = useState(0);
  const keepAllSelectedRef = useRef(false);



  const listBottomPadding = useMemo(() => sheetScrollBottomPadding(insets.bottom || 0, 24), [insets.bottom]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;



  useEffect(() => {

    if (!visible) {
      setSelectedIds(new Set());
      keepAllSelectedRef.current = false;
      return;
    }

  }, [visible]);



  useEffect(() => {

    const allRowIds = rows.map((entry) => entry.row.id);

    if (keepAllSelectedRef.current && allRowIds.length > 0) {
      setSelectedIds(new Set(allRowIds));
      return;
    }

    const valid = new Set(allRowIds);

    setSelectedIds((prev) => {

      const next = new Set<string>();

      prev.forEach((id) => {

        if (valid.has(id)) next.add(id);

      });

      return next;

    });

  }, [rows]);



  const toggleSelect = useCallback((id: string) => {
    keepAllSelectedRef.current = false;
    setSelectedIds((prev) => {

      const next = new Set(prev);

      if (next.has(id)) next.delete(id);

      else next.add(id);

      return next;

    });

  }, []);



  const toggleSelectAll = useCallback(() => {

    if (allSelected) {
      keepAllSelectedRef.current = false;
      setSelectedIds(new Set());
      return;
    }

    keepAllSelectedRef.current = true;
    setSelectedIds(new Set(rows.map((entry) => entry.row.id)));

  }, [allSelected, rows]);



  const deleteOne = useCallback(

    async (item: SavedQueryItem) => {

      const itemId = getSavedQueryItemId(item);

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

          next.delete(itemId);

          return next;

        });

        pruneItems(new Set([itemId]));

        await refresh();

        setListEpoch((n) => n + 1);

        keepAllSelectedRef.current = false;
        setSelectedIds(new Set());

      } catch (e: unknown) {

        Alert.alert("Hata", (e as Error)?.message || "Silme işlemi başarısız oldu.");

      }

    },

    [pruneItems, refresh],

  );



  const deleteSelected = useCallback(async () => {

    if (selectedIds.size === 0) return;

    const targets = rows

      .filter((entry) => selectedIds.has(entry.row.id))

      .map((entry) => entry.item);

    const deletedIds = new Set(targets.map(getSavedQueryItemId));

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

      keepAllSelectedRef.current = false;
      setSelectedIds(new Set());

      pruneItems(deletedIds);

      await refresh();

      setListEpoch((n) => n + 1);

    } catch (e: unknown) {

      Alert.alert("Hata", (e as Error)?.message || "Silme işlemi başarısız oldu.");

    }

  }, [selectedIds, rows, pruneItems, refresh]);



  const renderRow = useCallback(

    ({ item: entry }: { item: (typeof rows)[number] }) => {

      const { item: q, row } = entry;

      const itemId = row.id;

      const checked = selectedIds.has(itemId);

      const subLine =

        `Ada/Parsel: ${row.ada}/${row.parsel}` + (row.alan ? ` · Alan: ${row.alan}` : "");



      return (

        <View style={localStyles.cardWrapper}>

          <View style={localStyles.card}>

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



          {checked ? (

            <View style={localStyles.queryRunRow}>

              <TouchableOpacity

                onPress={() => onSelect(q)}

                style={[localStyles.queryRunBtn, localStyles.queryRunBtnSimple]}

                activeOpacity={0.75}

                accessibilityRole="button"

                accessibilityLabel="Basit sorgu çalıştır"

              >

                <Text style={localStyles.queryRunBtnText}>Basit Sorgu</Text>

              </TouchableOpacity>

              {onSelectPro ? (

                <TouchableOpacity

                  onPress={() => onSelectPro(q)}

                  style={[localStyles.queryRunBtn, localStyles.queryRunBtnPro]}

                  activeOpacity={0.75}

                  accessibilityRole="button"

                  accessibilityLabel="Pro sorgu çalıştır"

                >

                  <Text style={[localStyles.queryRunBtnText, localStyles.queryRunBtnProText]}>

                    ProSorgu

                  </Text>

                </TouchableOpacity>

              ) : null}

            </View>

          ) : null}

        </View>

      );

    },

    [deleteOne, onSelect, onSelectPro, selectedIds, toggleSelect],

  );



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

      <View style={{ flex: 1 }}>

        <View style={localStyles.headerRow}>

          <Text style={localStyles.headerTitle}>Sorgularım</Text>

          <View style={localStyles.headerActions}>

            <TouchableOpacity

              onPress={() => void refresh()}

              style={localStyles.headerIconBtn}

              accessibilityLabel="Yenile"

              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}

            >

              <Ionicons name="refresh" size={20} color="#e2e8f0" />

            </TouchableOpacity>

            <TouchableOpacity

              onPress={onClose}

              style={localStyles.headerIconBtn}

              accessibilityLabel="Kapat"

              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}

            >

              <Ionicons name="close" size={22} color="#e2e8f0" />

            </TouchableOpacity>

          </View>

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



            <BottomSheetFlatList

              key={`my-queries-${listEpoch}`}

              data={rows}

              extraData={{ selectedIds, listEpoch, rowCount: rows.length }}

              keyExtractor={(entry) => entry.row.id}

              renderItem={renderRow}

              style={st.scroll}

              contentContainerStyle={{ flexGrow: 1, paddingBottom: listBottomPadding }}

              scrollEventThrottle={16}

              initialNumToRender={12}

              maxToRenderPerBatch={16}

              windowSize={7}

              removeClippedSubviews

            />

          </>

        )}

      </View>

    </AppBottomSheetModal>

  );

}



const localStyles = {

  headerRow: {

    flexDirection: "row" as const,

    alignItems: "center" as const,

    justifyContent: "space-between" as const,

    paddingHorizontal: 16,

    paddingVertical: 10,

    borderBottomWidth: 1,

    borderBottomColor: "rgba(51, 65, 85, 0.85)",

  },

  headerTitle: {

    fontSize: 18,

    fontWeight: "700" as const,

    color: "#e2e8f0",

    flex: 1,

  },

  headerActions: {

    flexDirection: "row" as const,

    alignItems: "center" as const,

    gap: 4,

  },

  headerIconBtn: {

    width: 32,

    height: 32,

    alignItems: "center" as const,

    justifyContent: "center" as const,

  },

  center: { padding: 18, alignItems: "center" as const, gap: 10 },

  muted: { color: "#94a3b8", fontSize: 12, fontWeight: "600" as const },

  actionsRow: {

    flexDirection: "row" as const,

    flexWrap: "wrap" as const,

    justifyContent: "center" as const,

    alignItems: "center" as const,

    gap: 8,

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderBottomWidth: 1,

    borderBottomColor: "#334155",

  },

  actionBtn: {

    paddingHorizontal: 12,

    paddingVertical: 6,

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

  cardWrapper: {

    borderBottomWidth: 1,

    borderBottomColor: "#334155",

    marginHorizontal: 4,

    marginBottom: 2,

    borderRadius: 12,

  },

  card: {

    flexDirection: "row" as const,

    alignItems: "center" as const,

    gap: 8,

    paddingVertical: 12,

    paddingHorizontal: 12,

  },

  queryRunRow: {

    flexDirection: "row" as const,

    gap: 8,

    paddingHorizontal: 12,

    paddingBottom: 10,

    paddingLeft: 42,

  },

  queryRunBtn: {

    flex: 1,

    paddingVertical: 6,

    borderRadius: 8,

    borderWidth: 1,

    alignItems: "center" as const,

    justifyContent: "center" as const,

  },

  queryRunBtnSimple: {

    borderColor: "#475569",

    backgroundColor: "#334155",

  },

  queryRunBtnPro: {

    borderColor: "rgba(59,130,246,0.45)",

    backgroundColor: "rgba(59,130,246,0.15)",

  },

  queryRunBtnText: { fontSize: 11, fontWeight: "700" as const, color: "#e2e8f0" },

  queryRunBtnProText: { color: "#93c5fd" },

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


