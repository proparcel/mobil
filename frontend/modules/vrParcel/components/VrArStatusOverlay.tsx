import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { VrCalibrationStep } from "../types/vrCalibrationStep";
import { getVrStepMeta } from "../utils/vrCalibrationSteps";

export type VrArReadinessState = {
  ready: boolean;
  planeCount: number;
  tracking: "ok" | "scanning" | "none" | string;
  message: string;
};

type Props = {
  step: VrCalibrationStep;
  readiness: VrArReadinessState | null;
  tapFeedback?: string;
  tapPulse?: string;
  waitingUnity?: boolean;
};

function getPillCopy(
  readiness: VrArReadinessState | null,
  waitingUnity?: boolean,
): { label: string; variant: "scanning" | "ready" | "pending" } {
  if (waitingUnity) {
    return { label: "AR oturumu başlatılıyor…", variant: "pending" };
  }
  if (readiness?.ready) {
    return {
      label: readiness.message || `Tıklamaya hazır · ${readiness.planeCount} zemin`,
      variant: "ready",
    };
  }
  if (readiness?.planeCount && readiness.planeCount > 0) {
    return {
      label: readiness.message || `Zemin algılandı (${readiness.planeCount})`,
      variant: "scanning",
    };
  }
  return {
    label: readiness?.message || "Zemin taranıyor — telefonu yavaş hareket ettirin",
    variant: "scanning",
  };
}

/** AR kamera adimlarinda yonlendirme + zemin pill durumu. */
export function VrArStatusOverlay({
  step,
  readiness,
  tapFeedback,
  tapPulse,
  waitingUnity,
}: Props): React.ReactElement {
  const meta = getVrStepMeta(step);
  const hint = tapFeedback ?? meta.hint;
  const isWarning = Boolean(tapFeedback);
  const pill = getPillCopy(readiness, waitingUnity);

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.panel, isWarning && styles.panelWarning]}>
        <Text style={styles.stepTitle}>{meta.title}</Text>
        <Text style={[styles.hint, isWarning && styles.hintWarning]}>{hint}</Text>

        <View
          style={[
            styles.pill,
            pill.variant === "ready" && styles.pillReady,
            pill.variant === "scanning" && styles.pillScanning,
            pill.variant === "pending" && styles.pillPending,
          ]}
        >
          <View
            style={[
              styles.pillDot,
              pill.variant === "ready" && styles.pillDotReady,
              pill.variant === "scanning" && styles.pillDotScanning,
            ]}
          />
          <Text
            style={[
              styles.pillText,
              pill.variant === "ready" && styles.pillTextReady,
              pill.variant === "scanning" && styles.pillTextScanning,
            ]}
          >
            {pill.label}
          </Text>
        </View>
      </View>

      {tapPulse ? (
        <View style={styles.tapPulse}>
          <Text style={styles.tapPulseText}>{tapPulse}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "space-between",
  },
  panel: {
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.25)",
    gap: 8,
  },
  panelWarning: {
    backgroundColor: "rgba(120, 53, 15, 0.92)",
  },
  stepTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  hint: {
    color: "#f8fafc",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  hintWarning: {
    color: "#fde68a",
  },
  pill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    maxWidth: "100%",
  },
  pillScanning: {
    backgroundColor: "rgba(120, 53, 15, 0.92)",
    borderColor: "#fbbf24",
  },
  pillReady: {
    backgroundColor: "rgba(21, 128, 61, 0.92)",
    borderColor: "#4ade80",
  },
  pillPending: {
    backgroundColor: "rgba(51, 65, 85, 0.92)",
    borderColor: "#94a3b8",
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#64748b",
  },
  pillDotScanning: {
    backgroundColor: "#fbbf24",
  },
  pillDotReady: {
    backgroundColor: "#4ade80",
  },
  pillText: {
    flexShrink: 1,
    color: "#fde68a",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  pillTextScanning: {
    color: "#fde68a",
  },
  pillTextReady: {
    color: "#dcfce7",
  },
  tapPulse: {
    alignSelf: "center",
    marginBottom: 28,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(59, 130, 246, 0.85)",
  },
  tapPulseText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default VrArStatusOverlay;
