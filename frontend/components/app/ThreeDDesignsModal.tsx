/**
 * 3D Tasarımlarım — liste tek kaynak: GET /api/credit/3d-design-licenses/ (web /accounts/3d-designs/ ile aynı).
 * Cihazdaki depolama yalnızca TKGM kodu önbelleği içindir (parcel3dPurchasedStorage).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { creditService, type Parcel3dLicenseRow } from "../../services/creditService";
import {
  getCachedTkgmForParcel,
  type Parcel3dEntry,
} from "../../src/utils/parcel3dPurchasedStorage";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenParcelInEditor: (entry: Parcel3dEntry) => void | Promise<void>;
};

function toEntry(row: Parcel3dLicenseRow): Parcel3dEntry {
  return {
    mahalle: String(row.mahalle ?? "").trim(),
    ada: String(row.ada ?? "").trim(),
    parsel: String(row.parsel ?? "").trim(),
    referenceId: String(row.reference_id ?? "").trim() || undefined,
  };
}

export default function ThreeDDesignsModal({ visible, onClose, onOpenParcelInEditor }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Parcel3dLicenseRow[]>([]);
  const insets = useSafeAreaInsets();

  const listBottomPadding = useMemo(() => (insets.bottom || 0) + 24, [insets.bottom]);
  const snapPoints = useMemo(() => ["70%", "88%"], []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creditService.list3dDesignLicenses();
      if (!res.ok) {
        setRows([]);
        if (res.message) {
          Alert.alert("Liste", res.message);
        }
        return;
      }
      setRows(res.licenses);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  const buildEntryForOpen = useCallback(async (row: Parcel3dLicenseRow): Promise<Parcel3dEntry> => {
    const base = toEntry(row);
    const cached = await getCachedTkgmForParcel(base.mahalle, base.ada, base.parsel);
    return { ...base, ...cached };
  }, []);

  const handleItemPress = useCallback(
    async (row: Parcel3dLicenseRow) => {
      try {
        const entry = await buildEntryForOpen(row);
        await onOpenParcelInEditor(entry);
        onClose();
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Parsel açılamadı.");
      }
    },
    [onOpenParcelInEditor, onClose, buildEntryForOpen]
  );

  const handleDelete = useCallback(
    (row: Parcel3dLicenseRow) => {
      const ref = String(row.reference_id ?? "").trim();
      if (!ref) return;
      Alert.alert(
        "Lisansı kaldır",
        "Bu parsel için 3D düzenleme lisansını listeden kaldırırsınız. Ödenen Tepe Kredi iadesi yapılmaz.",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Kaldır",
            style: "destructive",
            onPress: async () => {
              const res = await creditService.delete3dDesignLicense(ref);
              if (res.ok) {
                await refresh();
              } else {
                Alert.alert("Hata", res.message || "Lisans kaldırılamadı.");
              }
            },
          },
        ]
      );
    },
    [refresh]
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialIndex={0}
      modalProps={{ containerStyle: styles.backdrop }}
    >
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>3D Tasarımlarım</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={refresh} style={styles.iconBtn} accessibilityLabel="Yenile">
              <Ionicons name="refresh" size={18} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Kapat">
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.hint}>
          Liste, hesabınızdaki 3D düzenleme lisansları ile sunucudan aynıdır. TKGM kodu önbelleği yalnızca cihazda tutulur. Lisans kaldırıldığında kredi iadesi yapılmaz.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#93c5fd" />
          <Text style={styles.muted}>Yükleniyor…</Text>
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Henüz kayıtlı parsel yok. 3D düzenleme satın aldığınızda burada görünür.</Text>
        </View>
      ) : (
        <BottomSheetScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          scrollEventThrottle={16}
        >
          {rows.map((p) => (
            <View key={p.reference_id} style={styles.card}>
              <TouchableOpacity onPress={() => handleItemPress(p)} style={styles.cardMain} activeOpacity={0.8}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {p.display_text}
                </Text>
                {String(p.mahalle ?? "").trim().length > 0 && (
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {String(p.mahalle).trim()}
                  </Text>
                )}
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => handleDelete(p)}
                  style={styles.actionBtnDanger}
                  accessibilityLabel="Lisansı kaldır"
                >
                  <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleItemPress(p)}
                  style={styles.actionBtnPrimary}
                  accessibilityLabel="3D editörde aç"
                >
                  <Ionicons name="cube-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </BottomSheetScrollView>
      )}
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    backgroundColor: "#f8fafc",
  },
  headerBtns: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },
  list: {
    paddingHorizontal: 12,
  },
  listContent: {
    paddingTop: 12,
    gap: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  cardMain: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 10,
  },
  actionBtnPrimary: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDanger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
});
