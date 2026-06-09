import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";
import { getVrModeUiCopy } from "../types/vrCalibrationMode";

type Props = {
  mode: VrCalibrationMode;
  onClose: () => void;
  onOpenMapFallback?: () => void;
};

export function VrUnsupportedPanel({ mode, onClose, onOpenMapFallback }: Props): React.ReactElement {
  const copy = getVrModeUiCopy(mode);
  const isFallback = mode === "map_only_fallback";

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={isFallback ? "map-marker-radius" : "camera-off"}
          size={42}
          color="#64748b"
        />
      </View>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>
        {isFallback
          ? "Bu cihazda kamera üzerinden VR parsel çizimi desteklenmiyor. Parseli harita üzerinde görüntüleyebilirsiniz."
          : copy.subtitle}
      </Text>
      {isFallback || onOpenMapFallback ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onOpenMapFallback ?? onClose}
        >
          <Text style={styles.primaryBtnText}>Haritada Görüntüle</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
        <Text style={styles.secondaryBtnText}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b1220",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: "#94a3b8", fontSize: 15, lineHeight: 22, textAlign: "center" },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 220,
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#64748b", fontWeight: "600" },
});

export default VrUnsupportedPanel;