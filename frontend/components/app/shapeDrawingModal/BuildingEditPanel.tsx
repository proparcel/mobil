/**
 * Seçili bina: taban m², ölçek, renk, döndür, kaydır, sil — bottom sheet içi (absolute yok).
 */
import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Slider from "@react-native-community/slider";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BUILDING_TEMPLATE_OPTIONS } from "@/src/maps/building/buildingFrameTemplates";
import { ROOF_TEMPLATE_OPTIONS } from "@/src/maps/building/roofTemplates";

const COLOR_PRESETS = [
  { hex: "#9ca3af", label: "Gri" },
  { hex: "#64748b", label: "Koyu gri" },
  { hex: "#3b82f6", label: "Mavi" },
  { hex: "#22c55e", label: "Yeşil" },
  { hex: "#eab308", label: "Sarı" },
  { hex: "#f97316", label: "Turuncu" },
  { hex: "#ef4444", label: "Kırmızı" },
  { hex: "#a855f7", label: "Mor" },
];

export type BuildingEditPanelProps = {
  footprintAreaM2: number;
  scaleSlider01: number;
  onScaleSlidingStart: () => void;
  onScaleValueChange: (slider01: number) => void;
  selectedColorHex: string;
  onSelectColor: (hex: string) => void;
  onRotateLeftPressIn: () => void;
  onRotateLeftPressOut: () => void;
  onRotateRightPressIn: () => void;
  onRotateRightPressOut: () => void;
  onNudgePressIn: (eastM: number, northM: number) => void;
  onNudgePressOut: () => void;
  onDelete: () => void;
  frameTemplate: string;
  onFrameTemplateChange: (v: string) => void;
  roofTemplate: string;
  onRoofTemplateChange: (v: string) => void;
};

export const BuildingEditPanel: React.FC<BuildingEditPanelProps> = ({
  footprintAreaM2,
  scaleSlider01,
  onScaleSlidingStart,
  onScaleValueChange,
  selectedColorHex,
  onSelectColor,
  onRotateLeftPressIn,
  onRotateLeftPressOut,
  onRotateRightPressIn,
  onRotateRightPressOut,
  onNudgePressIn,
  onNudgePressOut,
  onDelete,
  frameTemplate,
  onFrameTemplateChange,
  roofTemplate,
  onRoofTemplateChange,
}) => {
  const handleDelete = useCallback(() => {
    Alert.alert("Binayı kaldır", "Bu bina haritadan kaldırılsın mı?", [
      { text: "İptal", style: "cancel" },
      { text: "Kaldır", style: "destructive", onPress: onDelete },
    ]);
  }, [onDelete]);

  const scaleFactor = 0.5 * Math.pow(4, Math.max(0, Math.min(1, scaleSlider01)));

  return (
    <View style={styles.root}>
      <View style={styles.areaRow}>
        <Text style={styles.areaLabel}>Taban alanı</Text>
        <Text style={styles.areaValue}>
          {Number.isFinite(footprintAreaM2) ? footprintAreaM2.toFixed(1) : "—"} m²
        </Text>
      </View>

      <Text style={[styles.scaleLabel, { marginBottom: 6 }]}>Pencere şablonu</Text>
      <View style={styles.templateRow}>
        {BUILDING_TEMPLATE_OPTIONS.map((opt) => {
          const sel = frameTemplate === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onFrameTemplateChange(opt.value)}
              style={[styles.templateChip, sel && styles.templateChipActive]}
            >
              <Text style={[styles.templateChipText, sel && styles.templateChipTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.scaleLabel, { marginBottom: 6, marginTop: 4 }]}>Çatı şablonu</Text>
      <View style={styles.templateRow}>
        {ROOF_TEMPLATE_OPTIONS.map((opt) => {
          const sel = roofTemplate === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onRoofTemplateChange(opt.value)}
              style={[styles.templateChip, sel && styles.templateChipActive]}
            >
              <Text style={[styles.templateChipText, sel && styles.templateChipTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.scaleLabel, { marginBottom: 4 }]}>Renk</Text>
      <View style={styles.colorRow}>
        {COLOR_PRESETS.map((c) => (
          <TouchableOpacity
            key={c.hex}
            onPress={() => onSelectColor(c.hex)}
            accessibilityLabel={c.label}
            style={[
              styles.colorDot,
              { backgroundColor: c.hex },
              selectedColorHex.toLowerCase() === c.hex.toLowerCase() ? styles.colorDotActive : null,
            ]}
          />
        ))}
      </View>

      <View style={styles.scaleSection}>
        <View style={styles.scaleLabelRow}>
          <Text style={styles.scaleLabel}>Boyut (ölçek)</Text>
          <Text style={styles.scaleValueText}>{scaleFactor.toFixed(2)}×</Text>
        </View>
        <Slider
          style={styles.scaleSlider}
          minimumValue={0}
          maximumValue={1}
          step={0.004}
          value={scaleSlider01}
          onSlidingStart={onScaleSlidingStart}
          onValueChange={onScaleValueChange}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#475569"
          thumbTintColor="#93c5fd"
        />
      </View>

      <View style={styles.framesRow}>
        <View style={styles.frame}>
          <Text style={styles.frameTitle}>Döndür</Text>
          <View style={styles.rotateRow}>
            <TouchableOpacity
              style={styles.btn}
              onPressIn={onRotateRightPressIn}
              onPressOut={onRotateRightPressOut}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-undo" size={18} color="#fff" />
              <Text style={styles.btnLabel}>Sol</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPressIn={onRotateLeftPressIn}
              onPressOut={onRotateLeftPressOut}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-redo" size={18} color="#fff" />
              <Text style={styles.btnLabel}>Sağ</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.frame}>
          <Text style={styles.frameTitle}>Kaydır 1 m</Text>
          <View style={styles.nudgeCol}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPressIn={() => onNudgePressIn(0, 1)}
              onPressOut={onNudgePressOut}
            >
              <Ionicons name="arrow-up" size={17} color="#fff" />
            </TouchableOpacity>
            <View style={styles.nudgeMidRow}>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPressIn={() => onNudgePressIn(-1, 0)}
                onPressOut={onNudgePressOut}
              >
                <Ionicons name="arrow-back" size={17} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPressIn={() => onNudgePressIn(1, 0)}
                onPressOut={onNudgePressOut}
              >
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPressIn={() => onNudgePressIn(0, -1)}
              onPressOut={onNudgePressOut}
            >
              <Ionicons name="arrow-down" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color="#fff" />
        <Text style={[styles.btnLabel, { marginTop: 0 }]}>Kaldır</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { paddingBottom: 4 },
  areaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  areaLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  areaValue: { color: "#38bdf8", fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: { borderColor: "#fff", elevation: 2 },
  scaleSection: { width: "100%", paddingBottom: 4 },
  scaleLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scaleLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  scaleValueText: { color: "#e2e8f0", fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  scaleSlider: { width: "100%", height: 28 },
  framesRow: { flexDirection: "row", alignItems: "stretch", gap: 6, width: "100%" },
  frame: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  frameTitle: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  rotateRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  btn: {
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#334155",
    borderRadius: 8,
    minWidth: 56,
    flex: 1,
  },
  btnLabel: { color: "#fff", fontSize: 10, marginTop: 2, fontWeight: "600" },
  nudgeBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#334155",
    borderRadius: 6,
    minWidth: 44,
    minHeight: 36,
  },
  nudgeCol: { alignItems: "center", gap: 3, width: "100%" },
  nudgeMidRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, width: "100%" },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  templateChip: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#1e293b",
    maxWidth: "48%",
  },
  templateChipActive: { borderColor: "#60a5fa", backgroundColor: "#1e3a5f" },
  templateChipText: { color: "#cbd5e1", fontSize: 11, fontWeight: "500" },
  templateChipTextActive: { color: "#93c5fd", fontWeight: "700" },
  deleteBtn: {
    backgroundColor: "#dc2626",
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
});
