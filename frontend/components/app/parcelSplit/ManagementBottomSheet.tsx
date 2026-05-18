/**
 * Yönetim bottom sheet: Seçilen parçalar + Hisseli Parsel Ayarları (tek alt kontrol alanı).
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { SelectedPiecesSection } from "./SelectedPiecesSection";
import { BottomPanelContent } from "./BottomPanelContent";
import { parcelSplitTheme } from "./theme";
import type { Piece } from "../../../src/types/parcelSplit";
import type { SplitProfile, SplitMode, Orientation, UiMode } from "../../../src/types/parcelSplit";

type Props = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  selectedPieceIds: string[];
  pieces: Piece[];
  onRemovePiece: (id: string) => void;
  onCloseSelectedPieces: () => void;
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

export function ManagementBottomSheet({
  visible,
  onClose,
  insetsBottom,
  selectedPieceIds,
  pieces,
  onRemovePiece,
  onCloseSelectedPieces,
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
  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["18%", "45%", "85%"]}
      initialIndex={0}
      enablePanDownToClose={false}
      backdropOpacity={0}
      enableBackdropTouchThrough
      backdropPressBehavior="collapse"
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insetsBottom, 24) }]}
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
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: parcelSplitTheme.cardBg,
  },
  handle: {
    backgroundColor: "rgba(15,23,42,0.18)",
    width: 42,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
});
