/**
 * Parseller bottom sheet. Parça thumbnail kartları. Tıklayınca canvas'ta seçilir.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { PiecesGridSection } from "./PiecesGridSection";
import type { Piece } from "../../../src/types/parcelSplit";

const SHEET_BG = "#1e293b";

type Props = {
  visible: boolean;
  onClose: () => void;
  pieces: Piece[];
  selectedPieceId: string | null;
  onSelectPiece: (id: string | null) => void;
  insetsBottom: number;
};

export function PieceListBottomSheet({
  visible,
  onClose,
  pieces,
  selectedPieceId,
  onSelectPiece,
  insetsBottom,
}: Props) {
  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["70%", "88%", "92%"]}
      initialIndex={0}
      enablePanDownToClose
      backdropPressBehavior="close"
      backdropOpacity={0.4}
      backgroundStyle={{ backgroundColor: SHEET_BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insetsBottom, 16) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Parseller</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Text style={styles.close}>Kapat</Text>
          </TouchableOpacity>
        </View>
        <PiecesGridSection
          pieces={pieces}
          selectedPieceId={selectedPieceId}
          onSelectPiece={onSelectPiece}
          darkMode
        />
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
});
