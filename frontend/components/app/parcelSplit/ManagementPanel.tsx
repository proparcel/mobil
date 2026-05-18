/**
 * Yönetim paneli: modal değil, ekranın altında sabit View.
 * Header ve ActionBar hiç örtülmez; sadece canvas'ın alt kısmı panel ile kaplanır.
 * Daraltılabilir: handle'a dokunulunca açılır/kapanır; daraltıldığında canvas alanı genişler.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SelectedPiecesSection } from "./SelectedPiecesSection";
import { BottomPanelContent } from "./BottomPanelContent";
import { parcelSplitTheme } from "./theme";
import type { Piece, Point } from "../../../src/types/parcelSplit";
import type { SplitProfile, SplitMode, Orientation, UiMode } from "../../../src/types/parcelSplit";

const PANEL_MAX_HEIGHT = 320;

type Props = {
  insetsBottom: number;
  selectedPieceIds: string[];
  pieces: Piece[];
  onRemovePiece: (id: string) => void;
  onCloseSelectedPieces: () => void;
  roadPolygon: Point[] | null;
  roadSelected: boolean;
  onDeleteRoad: () => void;
  profile: SplitProfile;
  setProfile: (p: SplitProfile) => void;
  selectedRoadEdges: Set<string>;
  clearRoadEdges: () => void;
  uiMode: UiMode;
  setUiMode: (m: UiMode) => void;
  mode: SplitMode;
  setMode: (m: SplitMode) => void;
  targetArea: string;
  setTargetArea: (s: string) => void;
  targetCount: string;
  setTargetCount: (s: string) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  onCompute: () => void;
  computeDisabled: boolean;
  hasPieces: boolean;
  selectedPieceId: string | null;
  onDeletePiece: () => void;
  onUndo: () => void;
  canUndo: boolean;
};

export function ManagementPanel({
  insetsBottom,
  selectedPieceIds,
  pieces,
  onRemovePiece,
  onCloseSelectedPieces,
  roadPolygon,
  roadSelected,
  onDeleteRoad,
  profile,
  setProfile,
  selectedRoadEdges,
  clearRoadEdges,
  uiMode,
  setUiMode,
  mode,
  setMode,
  targetArea,
  setTargetArea,
  targetCount,
  setTargetCount,
  orientation,
  setOrientation,
  onCompute,
  computeDisabled,
  hasPieces,
  selectedPieceId,
  onDeletePiece,
  onUndo,
  canUndo,
}: Props) {
  /** İlk açılışta minimize; kullanıcı handle'a dokunup açar. */
  const [collapsed, setCollapsed] = useState(true);
  const insetsPadding = Math.max(insetsBottom, 12);

  return (
    <View
      style={[
        styles.panel,
        {
          bottom: insetsBottom,
          paddingBottom: collapsed ? 8 : insetsPadding,
          maxHeight: collapsed ? 48 : PANEL_MAX_HEIGHT,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.handleArea}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.8}
        accessibilityLabel={collapsed ? "Paneli aç" : "Paneli daralt"}
        accessibilityRole="button"
      >
        <View style={styles.handle} />
        {collapsed && (
          <View style={styles.collapsedHint}>
            <Ionicons name="chevron-up" size={16} color={parcelSplitTheme.textMuted} />
            <Text style={styles.collapsedHintText}>Ayarlar</Text>
          </View>
        )}
      </TouchableOpacity>
      {!collapsed && (
        <>
      {roadPolygon && roadPolygon.length >= 3 && roadSelected && (
        <View style={styles.roadDeleteRow}>
          <Text style={styles.roadDeleteLabel}>Yol seçili</Text>
          <TouchableOpacity style={styles.roadDeleteBtn} onPress={onDeleteRoad} activeOpacity={0.8}>
            <Text style={styles.roadDeleteBtnText}>Yolu sil</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SelectedPiecesSection
          selectedPieceIds={selectedPieceIds}
          pieces={pieces}
          onRemovePiece={onRemovePiece}
          onClose={onCloseSelectedPieces}
        />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Hisseli Parsel Ayarları</Text>
        <BottomPanelContent
          profile={profile}
          setProfile={setProfile}
          selectedRoadEdges={selectedRoadEdges}
          clearRoadEdges={clearRoadEdges}
          uiMode={uiMode}
          setUiMode={setUiMode}
          mode={mode}
          setMode={setMode}
          targetArea={targetArea}
          setTargetArea={setTargetArea}
          targetCount={targetCount}
          setTargetCount={setTargetCount}
          orientation={orientation}
          setOrientation={setOrientation}
          onCompute={onCompute}
          computeDisabled={computeDisabled}
          hasPieces={hasPieces}
          selectedPieceId={selectedPieceId}
          onDeletePiece={onDeletePiece}
          onUndo={onUndo}
          canUndo={canUndo}
        />
      </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    /** bottom: insetsBottom ile inline verilir; footer/safe area üstünde kalır. */
    bottom: 0,
    backgroundColor: parcelSplitTheme.cardBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  handleArea: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15,23,42,0.18)",
    marginBottom: 2,
  },
  collapsedHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  collapsedHintText: {
    fontSize: 12,
    color: parcelSplitTheme.textMuted,
    fontWeight: "500",
  },
  scroll: {
    maxHeight: PANEL_MAX_HEIGHT - 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 16,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: parcelSplitTheme.brandNavy,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  roadDeleteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  roadDeleteLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: parcelSplitTheme.textMuted,
  },
  roadDeleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  roadDeleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },
});
