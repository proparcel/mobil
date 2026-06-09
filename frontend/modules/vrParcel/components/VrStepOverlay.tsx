import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";
import { getVrStepMeta } from "../utils/vrCalibrationSteps";
import type { VrCalibrationStep } from "../types/vrCalibrationStep";

type Props = {
  step: VrCalibrationStep;
  mode: VrCalibrationMode;
  unityLinked?: boolean;
  extra?: string;
};

export function VrStepOverlay({ step, mode, unityLinked, extra }: Props): React.ReactElement {
  const meta = getVrStepMeta(step);
  const progress = meta.index / meta.total;

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Adım {meta.index}/{meta.total}
      </Text>
      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.hint}>{meta.hint}</Text>
      {mode === "lidar_precise" ? (
        <Text style={styles.badge}>LiDAR hassas mod</Text>
      ) : mode === "arkit_standard" ? (
        <Text style={styles.badgeMuted}>Standart ARKit</Text>
      ) : null}
      {unityLinked === false && meta.phase === "ar" ? (
        <Text style={styles.unityHint}>
          UnityFramework embed edilmedi — AR adımları Unity export + Mac Xcode build sonrası açılır.
        </Text>
      ) : null}
      {extra ? <Text style={styles.extra}>{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.35)",
    gap: 6,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(51, 65, 85, 0.9)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  progressLabel: { color: "#64748b", fontSize: 11, fontWeight: "600" },
  title: { color: "#f8fafc", fontSize: 15, fontWeight: "700" },
  hint: { color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    color: "#86efac",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  badgeMuted: {
    alignSelf: "flex-start",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  unityHint: {
    color: "#fbbf24",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  extra: { color: "#60a5fa", fontSize: 12, fontWeight: "600", marginTop: 2 },
});

export default VrStepOverlay;
