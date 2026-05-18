/**
 * Yardım bottom sheet (Info butonundan açılır).
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { parcelSplitTheme } from "./theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
};

export function HelpBottomSheet({ visible, onClose, insetsBottom }: Props) {
  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["70%", "88%"]}
      initialIndex={0}
      backdropPressBehavior="close"
      backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insetsBottom, 16) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Yardım</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Text style={styles.close}>Kapat</Text>
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.para}>
            Profil seçin (Arsa/Tarla). Arsa için yola bakan kenar(lar)ı “Yol Kenarı Seç” ile işaretleyin.
          </Text>
          <Text style={styles.para}>
            Bölme modunu (m² veya adet) ve yönü (Dikey/Yatay/Otomatik) seçin, “Hesapla”ya basın.
          </Text>
          <Text style={styles.para}>
            Sonuç parçaları seçebilir, parsel silme ve kenar kaydırma ile düzenleyebilirsiniz.
          </Text>
        </BottomSheetScrollView>
      </View>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fff" },
  close: { fontSize: 14, color: "#94a3b8" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 16 },
  para: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 22,
    marginBottom: 12,
  },
});
