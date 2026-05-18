/**
 * Alt panel: Profil, Yol Kenarı Seçimi, Mod, Yön, Hesapla (adımlı, collapsible).
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
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
  insetsBottom: number;
  selectedPieceId?: string | null;
  onDeletePiece?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  mergeNeighborVisible?: boolean;
  edgeSlideStep?: 0.1 | 0.5 | 1;
  onEdgeSlideStepChange?: (s: 0.1 | 0.5 | 1) => void;
  onEdgeSlideArrow?: (offsetMeters: number) => void;
  selectedEdgeId?: string | null;
  onEdgeSlideFinish?: () => void;
  onEdgeSlideCancel?: () => void;
  hasEdgeSlideSelection?: boolean;
};

export function BottomPanel({
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
  insetsBottom,
  selectedPieceId = null,
  onDeletePiece,
  onUndo,
  canUndo = false,
  mergeNeighborVisible = false,
  edgeSlideStep = 0.5,
  onEdgeSlideStepChange,
  onEdgeSlideArrow,
  selectedEdgeId = null,
  onEdgeSlideFinish,
  onEdgeSlideCancel,
  hasEdgeSlideSelection = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const canCompute =
    !computeDisabled &&
    (profile === "tarla" || selectedRoadEdges.size >= 1) &&
    (mode === "by_count" ? parseInt(targetCount, 10) >= 2 : parseFloat(targetArea) > 0);

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insetsBottom, 12) }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.8}
      >
        <Text style={styles.headerTitle}>Hisseli Parsel ayarları</Text>
        <Ionicons
          name={collapsed ? "chevron-up" : "chevron-down"}
          size={20}
          color={parcelSplitTheme.textMuted}
        />
      </TouchableOpacity>

      {!collapsed && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Adım 1: Profil */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>1. Profil</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, profile === "arsa" && styles.segBtnActive]}
                onPress={() => setProfile("arsa")}
              >
                <Text style={[styles.segText, profile === "arsa" && styles.segTextActive]}>
                  ARSA
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, profile === "tarla" && styles.segBtnActive]}
                onPress={() => setProfile("tarla")}
              >
                <Text style={[styles.segText, profile === "tarla" && styles.segTextActive]}>
                  TARLA
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Adım 2: Yol Kenarı Seçimi */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>2. Yol kenarı seçimi</Text>
            <Text style={styles.hint}>Yola bakan kenar(lar)ı işaretle.</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.segBtn, uiMode === "select_road_edges" && styles.segBtnActive]}
                onPress={() =>
                  setUiMode(uiMode === "select_road_edges" ? "pan_zoom" : "select_road_edges")
                }
              >
                <Text
                  style={[
                    styles.segText,
                    uiMode === "select_road_edges" && styles.segTextActive,
                  ]}
                >
                  Yol Kenarı Seç
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.segBtn} onPress={clearRoadEdges}>
                <Text style={styles.segText}>Temizle</Text>
              </TouchableOpacity>
            </View>
            {profile === "arsa" && selectedRoadEdges.size === 0 && (
              <Text style={styles.warn}>Arsa için en az bir yol cephesi seçmelisin.</Text>
            )}
          </View>

          {/* Adım 3: Bölme modu */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>3. Bölme modu</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, mode === "by_area" && styles.segBtnActive]}
                onPress={() => setMode("by_area")}
              >
                <Text style={[styles.segText, mode === "by_area" && styles.segTextActive]}>
                  m²'ye göre
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, mode === "by_count" && styles.segBtnActive]}
                onPress={() => setMode("by_count")}
              >
                <Text style={[styles.segText, mode === "by_count" && styles.segTextActive]}>
                  Adete göre
                </Text>
              </TouchableOpacity>
            </View>
            {mode === "by_area" ? (
              <TextInput
                style={styles.input}
                value={targetArea}
                onChangeText={setTargetArea}
                placeholder="Hedef m²"
                placeholderTextColor={parcelSplitTheme.muted}
                keyboardType="decimal-pad"
              />
            ) : (
              <TextInput
                style={styles.input}
                value={targetCount}
                onChangeText={setTargetCount}
                placeholder="Adet (2–200)"
                placeholderTextColor={parcelSplitTheme.muted}
                keyboardType="number-pad"
              />
            )}
          </View>

          {/* Adım 4: Yön */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>4. Yön</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, orientation === "vertical" && styles.segBtnActive]}
                onPress={() => setOrientation("vertical")}
              >
                <Text style={[styles.segText, orientation === "vertical" && styles.segTextActive]}>
                  Dikey
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, orientation === "horizontal" && styles.segBtnActive]}
                onPress={() => setOrientation("horizontal")}
              >
                <Text style={[styles.segText, orientation === "horizontal" && styles.segTextActive]}>
                  Yatay
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, orientation === "auto" && styles.segBtnActive]}
                onPress={() => setOrientation("auto")}
              >
                <Text style={[styles.segText, orientation === "auto" && styles.segTextActive]}>
                  Otomatik
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Parsel Sil / Kenar Kaydır / Geri Al */}
          {hasPieces && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Parça işlemleri</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.segBtn, !selectedPieceId && styles.computeBtnDisabled]}
                  onPress={onDeletePiece}
                  disabled={!selectedPieceId || !onDeletePiece}
                >
                  <Text style={styles.segText}>Parsel Sil</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, uiMode === "edge_slide" && styles.segBtnActive]}
                  onPress={() =>
                    setUiMode(uiMode === "edge_slide" ? "select_piece" : "edge_slide")
                  }
                >
                  <Text
                    style={[styles.segText, uiMode === "edge_slide" && styles.segTextActive]}
                  >
                    Kenar Kaydır
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, !canUndo && styles.computeBtnDisabled]}
                  onPress={onUndo}
                  disabled={!canUndo || !onUndo}
                >
                  <Text style={styles.segText}>Geri Al</Text>
                </TouchableOpacity>
              </View>
              {uiMode === "edge_slide" && selectedPieceId && (
                <View style={styles.section}>
                  <Text style={styles.hint}>Adım (m):</Text>
                  <View style={styles.row}>
                    {([0.1, 0.5, 1] as const).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.segBtn, edgeSlideStep === s && styles.segBtnActive]}
                        onPress={() => onEdgeSlideStepChange?.(s)}
                      >
                        <Text
                          style={[styles.segText, edgeSlideStep === s && styles.segTextActive]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.segBtn}
                      onPress={() => onEdgeSlideArrow?.(-edgeSlideStep)}
                      disabled={!selectedEdgeId}
                    >
                      <Text style={styles.segText}>← İçeri</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.segBtn}
                      onPress={() => onEdgeSlideArrow?.(edgeSlideStep)}
                      disabled={!selectedEdgeId}
                    >
                      <Text style={styles.segText}>Dışarı →</Text>
                    </TouchableOpacity>
                  </View>
                  {hasEdgeSlideSelection && (
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={[styles.segBtn, styles.segBtnCancel]}
                        onPress={onEdgeSlideCancel}
                        disabled={!onEdgeSlideCancel}
                      >
                        <Text style={styles.segText}>İptal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.segBtn, styles.segBtnPrimary]}
                        onPress={onEdgeSlideFinish}
                        disabled={!onEdgeSlideFinish}
                      >
                        <Text style={styles.segTextPrimary}>Bitir</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Adım 5: Hesapla */}
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: parcelSplitTheme.cardBg,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    maxHeight: 320,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: parcelSplitTheme.brandNavy,
  },
  scroll: { maxHeight: 260 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
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
  segBtnCancel: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  segBtnPrimary: {
    backgroundColor: parcelSplitTheme.accentBlue,
    borderColor: parcelSplitTheme.accentBlue,
  },
  segText: { fontSize: 13, color: parcelSplitTheme.textMuted },
  segTextActive: { color: parcelSplitTheme.accentBlue, fontWeight: "600" },
  segTextPrimary: { fontSize: 13, fontWeight: "600", color: "#fff" },
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
});
