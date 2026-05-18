/**
 * Silinen parçayı hangi komşu ile birleştireceğini seçmek için bottom sheet.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheetModal from "../AppBottomSheetModal";
import type { Piece } from "../../../src/types/parcelSplit";
import { parcelSplitTheme } from "./theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  deletedPiece: Piece | null;
  adjacentPieces: Piece[];
  onSelectNeighbor: (pieceId: string) => void;
  insetsBottom: number;
};

export function MergeNeighborBottomSheet({
  visible,
  onClose,
  deletedPiece,
  adjacentPieces,
  onSelectNeighbor,
  insetsBottom,
}: Props) {
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
          <Text style={styles.title}>Komşu ile birleştir</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Text style={styles.close}>Kapat</Text>
          </TouchableOpacity>
        </View>
        {deletedPiece && (
          <Text style={styles.hint}>
            Silinen parça: {Math.round(deletedPiece.area)} m². Birleştirmek istediğin komşuyu seç.
          </Text>
        )}
        <BottomSheetScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {adjacentPieces.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.row}
              onPress={() => {
                onSelectNeighbor(p.id);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.id}>{p.id}</Text>
              <Text style={styles.area}>{Math.round(p.area)} m²</Text>
            </TouchableOpacity>
          ))}
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
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: parcelSplitTheme.textOnDark,
  },
  close: {
    fontSize: 14,
    color: parcelSplitTheme.accentBlue,
  },
  hint: {
    fontSize: 12,
    color: parcelSplitTheme.textMuted,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  id: { fontSize: 14, fontWeight: "600", color: "#f8fafc" },
  area: { fontSize: 14, color: parcelSplitTheme.textMuted },
});
