/**
 * Hisseli Parsel ayarları içeriği (content-only): Profil, Yol kenarı, Mod, Yön, Parça işlemleri (Sil, Geri Al), Hesapla.
 * ManagementBottomSheet içinde kullanılır; Kenar Kaydır ActionBar'da, edge_slide detayları EdgeSlideModeBar'da.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { parcelSplitTheme } from "./theme";
import type { SplitProfile, SplitMode, Orientation, UiMode } from "../../../src/types/parcelSplit";

type Props = {
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
  selectedPieceId?: string | null;
  onDeletePiece?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  darkMode?: boolean;
};

export function BottomPanelContent({
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
  selectedPieceId = null,
  onDeletePiece,
  onUndo,
  canUndo = false,
  darkMode = false,
}: Props) {
  const canCompute =
    !computeDisabled &&
    (profile === "tarla" || selectedRoadEdges.size >= 1) &&
    (mode === "by_count" ? parseInt(targetCount, 10) >= 2 : parseFloat(targetArea) > 0);

  const dm = darkMode;
  return (
    <View style={styles.root}>
      {/* 1. Profil */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, dm && styles.sectionLabelDark]}>1. Profil</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, profile === "arsa" && styles.segBtnActive, dm && styles.segBtnDark, dm && profile === "arsa" && styles.segBtnActiveDark]}
            onPress={() => setProfile("arsa")}
          >
            <Text style={[styles.segText, profile === "arsa" && styles.segTextActive, dm && styles.segTextDark, dm && profile === "arsa" && styles.segTextActiveDark]}>ARSA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, profile === "tarla" && styles.segBtnActive, dm && styles.segBtnDark, dm && profile === "tarla" && styles.segBtnActiveDark]}
            onPress={() => setProfile("tarla")}
          >
            <Text style={[styles.segText, profile === "tarla" && styles.segTextActive, dm && styles.segTextDark, dm && profile === "tarla" && styles.segTextActiveDark]}>TARLA</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Yol Kenarı Seçimi */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, dm && styles.sectionLabelDark]}>2. Yol kenarı seçimi</Text>
        <Text style={[styles.hint, dm && styles.hintDark]}>Yola bakan kenar(lar)ı işaretle.</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.segBtn, uiMode === "select_road_edges" && styles.segBtnActive, dm && styles.segBtnDark, dm && uiMode === "select_road_edges" && styles.segBtnActiveDark]}
            onPress={() =>
              setUiMode(uiMode === "select_road_edges" ? "pan_zoom" : "select_road_edges")
            }
          >
            <Text
              style={[
                styles.segText,
                uiMode === "select_road_edges" && styles.segTextActive,
                dm && styles.segTextDark,
                dm && uiMode === "select_road_edges" && styles.segTextActiveDark,
              ]}
            >
              Yol Kenarı Seç
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, dm && styles.segBtnDark]} onPress={clearRoadEdges}>
            <Text style={[styles.segText, dm && styles.segTextDark]}>Temizle</Text>
          </TouchableOpacity>
        </View>
        {profile === "arsa" && selectedRoadEdges.size === 0 && (
          <Text style={styles.warn}>Arsa için en az bir yol cephesi seçmelisin.</Text>
        )}
      </View>

      {/* 3. Bölme modu */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, dm && styles.sectionLabelDark]}>3. Bölme modu</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, mode === "by_area" && styles.segBtnActive, dm && styles.segBtnDark, dm && mode === "by_area" && styles.segBtnActiveDark]}
            onPress={() => setMode("by_area")}
          >
            <Text style={[styles.segText, mode === "by_area" && styles.segTextActive, dm && styles.segTextDark, dm && mode === "by_area" && styles.segTextActiveDark]}>
              m²'ye göre
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, mode === "by_count" && styles.segBtnActive, dm && styles.segBtnDark, dm && mode === "by_count" && styles.segBtnActiveDark]}
            onPress={() => setMode("by_count")}
          >
            <Text style={[styles.segText, mode === "by_count" && styles.segTextActive, dm && styles.segTextDark, dm && mode === "by_count" && styles.segTextActiveDark]}>
              Adete göre
            </Text>
          </TouchableOpacity>
        </View>
        {mode === "by_area" ? (
          <TextInput
            style={[styles.input, dm && styles.inputDark]}
            value={targetArea}
            onChangeText={setTargetArea}
            placeholder="Hedef m²"
            placeholderTextColor={dm ? "#94a3b8" : parcelSplitTheme.muted}
            keyboardType="decimal-pad"
          />
        ) : (
          <TextInput
            style={[styles.input, dm && styles.inputDark]}
            value={targetCount}
            onChangeText={setTargetCount}
            placeholder="Adet (2–200)"
            placeholderTextColor={dm ? "#94a3b8" : parcelSplitTheme.muted}
            keyboardType="number-pad"
          />
        )}
      </View>

      {/* 4. Yön */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, dm && styles.sectionLabelDark]}>4. Yön</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, orientation === "vertical" && styles.segBtnActive, dm && styles.segBtnDark, dm && orientation === "vertical" && styles.segBtnActiveDark]}
            onPress={() => setOrientation("vertical")}
          >
            <Text style={[styles.segText, orientation === "vertical" && styles.segTextActive, dm && styles.segTextDark, dm && orientation === "vertical" && styles.segTextActiveDark]}>
              Dikey
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, orientation === "horizontal" && styles.segBtnActive, dm && styles.segBtnDark, dm && orientation === "horizontal" && styles.segBtnActiveDark]}
            onPress={() => setOrientation("horizontal")}
          >
            <Text style={[styles.segText, orientation === "horizontal" && styles.segTextActive, dm && styles.segTextDark, dm && orientation === "horizontal" && styles.segTextActiveDark]}>
              Yatay
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, orientation === "auto" && styles.segBtnActive, dm && styles.segBtnDark, dm && orientation === "auto" && styles.segBtnActiveDark]}
            onPress={() => setOrientation("auto")}
          >
            <Text style={[styles.segText, orientation === "auto" && styles.segTextActive, dm && styles.segTextDark, dm && orientation === "auto" && styles.segTextActiveDark]}>
              Otomatik
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Parça işlemleri: Parsel Sil, Geri Al (Kenar Kaydır ActionBar'da) */}
      {hasPieces && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, dm && styles.sectionLabelDark]}>Parça işlemleri</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.segBtn, !selectedPieceId && styles.computeBtnDisabled, dm && styles.segBtnDark]}
              onPress={onDeletePiece}
              disabled={!selectedPieceId || !onDeletePiece}
            >
              <Text style={[styles.segText, dm && styles.segTextDark]}>Parsel Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, !canUndo && styles.computeBtnDisabled, dm && styles.segBtnDark]}
              onPress={onUndo}
              disabled={!canUndo || !onUndo}
            >
              <Text style={[styles.segText, dm && styles.segTextDark]}>Geri Al</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Hesapla */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.computeBtn, !canCompute && styles.computeBtnDisabled]}
          onPress={onCompute}
          disabled={!canCompute}
        >
          <Text style={[styles.computeText, !canCompute && styles.computeTextDisabled]}>
            Hesapla / Yeniden Böl
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: parcelSplitTheme.textMuted,
    marginBottom: 4,
  },
  hint: { fontSize: 11, color: parcelSplitTheme.muted, marginBottom: 6 },
  warn: { fontSize: 11, color: "#ef4444", marginTop: 4 },
  row: { flexDirection: "row", marginTop: 4 },
  segment: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
    marginBottom: 6,
  },
  segBtnActive: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderColor: parcelSplitTheme.accentBlue,
  },
  segText: { fontSize: 13, color: parcelSplitTheme.textMuted },
  segTextActive: { color: parcelSplitTheme.accentBlue, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: parcelSplitTheme.brandNavy,
    marginTop: 8,
  },
  computeBtn: {
    backgroundColor: parcelSplitTheme.accentBlue,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  computeBtnDisabled: { backgroundColor: "#94a3b8", opacity: 0.7 },
  computeText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  computeTextDisabled: { color: "#cbd5e1" },
  // Dark mode
  sectionLabelDark: { color: "#94a3b8" },
  hintDark: { color: "#64748b" },
  segBtnDark: {
    backgroundColor: "#475569",
    borderColor: "#64748b",
  },
  segBtnActiveDark: {
    backgroundColor: "rgba(59,130,246,0.25)",
    borderColor: parcelSplitTheme.accentBlue,
  },
  segTextDark: { color: "#e2e8f0" },
  segTextActiveDark: { color: "#93c5fd", fontWeight: "600" },
  inputDark: {
    backgroundColor: "#475569",
    borderColor: "#64748b",
    color: "#e2e8f0",
  },
});
