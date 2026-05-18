/**
 * ModelTransformBar
 * Seçili 3D model için alt bar: boyut, Döndür (Sol/Sağ), Kaydır (4 yön, 1 m), Sil
 * Basılı tutunca döndürme / kaydırma tekrarlanır.
 */
import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Slider from "@react-native-community/slider";
import Ionicons from "react-native-vector-icons/Ionicons";
import { clampScale, scaleToSlider01, slider01ToScale } from "@/src/maps/models/ModelManager";

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "column",
    alignItems: "stretch",
    alignSelf: "center",
    maxWidth: 520,
    width: "100%",
    backgroundColor: "#1e293b",
    paddingTop: 2,
    paddingBottom: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  barZIndex: {
    zIndex: 2500,
    elevation: 25,
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: 2,
    minHeight: 32,
  },
  headerTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  framesRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
    width: "100%",
  },
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
  rotateRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
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
  nudgeCol: {
    alignItems: "center",
    gap: 3,
    width: "100%",
  },
  nudgeMidRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
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
  btnLabel: {
    color: "#fff",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  scaleSection: {
    width: "100%",
    paddingBottom: 4,
    paddingHorizontal: 0,
  },
  scaleLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  scaleLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  scaleValueText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  scaleSlider: {
    width: "100%",
    height: 28,
  },
  footprintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 2,
  },
});

type Props = {
  visible: boolean;
  bottomInset?: number;
  /** Yapı modelleri: dinamik taban alanı (m²) */
  footprintAreaM2?: number | null;
  scaleValue: number;
  onScaleChange: (scale: number) => void;
  onRotateLeftPressIn: () => void;
  onRotateLeftPressOut: () => void;
  onRotateRightPressIn: () => void;
  onRotateRightPressOut: () => void;
  /** eastM: doğu (+) / batı (-), northM: kuzey (+) / güney (-); her tetikleme 1 m */
  onNudgePressIn: (eastM: number, northM: number) => void;
  onNudgePressOut: () => void;
  onDelete: () => void;
  onClose?: () => void;
};

export const ModelTransformBar: React.FC<Props> = ({
  visible,
  bottomInset = 0,
  footprintAreaM2,
  scaleValue,
  onScaleChange,
  onRotateLeftPressIn,
  onRotateLeftPressOut,
  onRotateRightPressIn,
  onRotateRightPressOut,
  onNudgePressIn,
  onNudgePressOut,
  onDelete,
  onClose,
}) => {
  const handleDelete = useCallback(() => {
    Alert.alert("Modeli Sil", "Bu model silinecek. Emin misiniz?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: onDelete },
    ]);
  }, [onDelete]);

  if (!visible) return null;

  const safeScale =
    typeof scaleValue === "number" && Number.isFinite(scaleValue) ? clampScale(scaleValue) : 1;

  const sliderT = scaleToSlider01(safeScale);

  return (
    <View style={[styles.bar, styles.barZIndex, { paddingBottom: Math.max(bottomInset, 0) + 6 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Model</Text>
        {onClose ? (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Seçimi kaldır"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.scaleSection}>
        <View style={styles.scaleLabelRow}>
          <Text style={styles.scaleLabel}>Boyut</Text>
          <Text style={styles.scaleValueText}>{safeScale.toFixed(2)}×</Text>
        </View>
        <Slider
          style={styles.scaleSlider}
          minimumValue={0}
          maximumValue={1}
          step={0.008}
          value={sliderT}
          onValueChange={(t) => onScaleChange(slider01ToScale(t))}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#475569"
          thumbTintColor="#93c5fd"
        />
        {typeof footprintAreaM2 === "number" && Number.isFinite(footprintAreaM2) ? (
          <View style={styles.footprintRow}>
            <Text style={styles.scaleLabel}>Tahmini taban</Text>
            <Text style={styles.scaleValueText}>{footprintAreaM2.toFixed(1)} m²</Text>
          </View>
        ) : null}
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
              accessibilityLabel="Sola döndür"
            >
              <Ionicons name="arrow-undo" size={18} color="#fff" />
              <Text style={styles.btnLabel}>Sol</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPressIn={onRotateLeftPressIn}
              onPressOut={onRotateLeftPressOut}
              activeOpacity={0.8}
              accessibilityLabel="Sağa döndür"
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
              activeOpacity={0.8}
              accessibilityLabel="Yukarı kaydır"
            >
              <Ionicons name="arrow-up" size={17} color="#fff" />
            </TouchableOpacity>
            <View style={styles.nudgeMidRow}>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPressIn={() => onNudgePressIn(-1, 0)}
                onPressOut={onNudgePressOut}
                activeOpacity={0.8}
                accessibilityLabel="Sola kaydır"
              >
                <Ionicons name="arrow-back" size={17} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeBtn}
                onPressIn={() => onNudgePressIn(1, 0)}
                onPressOut={onNudgePressOut}
                activeOpacity={0.8}
                accessibilityLabel="Sağa kaydır"
              >
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPressIn={() => onNudgePressIn(0, -1)}
              onPressOut={onNudgePressOut}
              activeOpacity={0.8}
              accessibilityLabel="Aşağı kaydır"
            >
              <Ionicons name="arrow-down" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color="#fff" />
        <Text style={[styles.btnLabel, { marginTop: 0 }]}>Sil</Text>
      </TouchableOpacity>
    </View>
  );
};
