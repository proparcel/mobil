/**
 * Ayarlar bottom sheet: Hisseli parsel ayarları. Parseller ile aynı renk tasarımı, sürükle kapat.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { BottomPanelContent } from "./BottomPanelContent";
import type { Piece } from "../../../src/types/parcelSplit";
import type { SplitProfile, SplitMode, Orientation, UiMode } from "../../../src/types/parcelSplit";
import type { ImarType } from "./BottomPanelContent";

const SHEET_BG = "#1e293b";

type Props = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  profile: SplitProfile;
  setProfile: (p: SplitProfile) => void;
  imarType: ImarType;
  setImarType: (t: ImarType) => void;
  cepheLength: string;
  setCepheLength: (s: string) => void;
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
  // Ozel m2 modu
  customTargetAreas?: number[];
  setCustomTargetAreas?: (areas: number[]) => void;
  customCount?: number;
  setCustomCount?: (n: number) => void;
  netArea?: number;
};

export function AyarlarBottomSheet({
  visible,
  onClose,
  insetsBottom,
  profile,
  setProfile,
  imarType,
  setImarType,
  cepheLength,
  setCepheLength,
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
  customTargetAreas = [],
  setCustomTargetAreas,
  customCount = 2,
  setCustomCount,
  netArea = 0,
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
          <Text style={styles.title}>Ayarlar</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Text style={styles.close}>Kapat</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contentCard}>
          <BottomSheetScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BottomPanelContent
              darkMode
              profile={profile}
              setProfile={setProfile}
              imarType={imarType}
              setImarType={setImarType}
              cepheLength={cepheLength}
              setCepheLength={setCepheLength}
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
              customTargetAreas={customTargetAreas}
              setCustomTargetAreas={setCustomTargetAreas}
              customCount={customCount}
              setCustomCount={setCustomCount}
              netArea={netArea}
            />
          </BottomSheetScrollView>
        </View>
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
  contentCard: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: "#334155",
    borderRadius: 12,
    overflow: "hidden",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
});
