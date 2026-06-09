import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { VrGpsSnapshot } from "../utils/vrGpsStream";
import { formatGpsQualityLabel } from "../utils/vrGpsStream";
import type { VrGpsReadiness } from "../utils/vrGpsReadiness";
import {
  VR_MIN_WALK_DISTANCE_M,
  VR_RECOMMENDED_WALK_DISTANCE_M,
} from "../utils/vrGpsReadiness";
import type { VrGpsReference } from "../utils/vrGpsStream";

type Props = {
  title: string;
  refA: VrGpsReference | null;
  snapshot: VrGpsSnapshot | null;
  readiness: VrGpsReadiness | null;
  walkDistanceM?: number;
  showWalkDistance?: boolean;
  debugCoords?: boolean;
};

const COLOR_MAP = {
  red: "#ef4444",
  yellow: "#f59e0b",
  green: "#22c55e",
};

export function VrGpsStatusPanel({
  title,
  refA,
  snapshot,
  readiness,
  walkDistanceM = 0,
  showWalkDistance = false,
  debugCoords = __DEV__,
}: Props): React.ReactElement {
  const accent = readiness ? COLOR_MAP[readiness.qualityColor] : "#94a3b8";

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Konum sinyali</Text>
        <Text style={[styles.value, { color: accent }]}>
          {formatGpsQualityLabel(snapshot)}
        </Text>
      </View>

      {snapshot ? (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Tahmini hassasiyet</Text>
            <Text style={styles.value}>±{Math.round(snapshot.accuracyMedianM)} m</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Konum oynama</Text>
            <Text style={styles.value}>{snapshot.positionStdDevM.toFixed(1)} m</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Denge</Text>
            <Text style={[styles.value, { color: accent }]}>
              {(snapshot.stableForMs / 1000).toFixed(1)} sn / 3 sn
            </Text>
          </View>
        </>
      ) : null}

      {refA ? (
        <View style={styles.block}>
          <Text style={styles.label}>1. referans kaydedildi</Text>
          {debugCoords ? (
            <Text style={styles.mono}>
              ±{Math.round(refA.gpsAccuracyM)} m · {refA.sampleCount} örnek
            </Text>
          ) : (
            <Text style={styles.mono}>Kayıt kalitesi: {refA.confidence}</Text>
          )}
        </View>
      ) : null}

      {showWalkDistance ? (
        <View style={styles.block}>
          <Text style={styles.label}>Yürünen mesafe (hareket takibi)</Text>
          <Text style={[styles.walkDistance, { color: accent }]}>
            {walkDistanceM.toFixed(1)} m / min {VR_MIN_WALK_DISTANCE_M} m
          </Text>
          <Text style={styles.hint}>Önerilen: {VR_RECOMMENDED_WALK_DISTANCE_M}–10 m</Text>
        </View>
      ) : null}

      {readiness ? (
        <View style={[styles.hintBox, { borderColor: accent }]}>
          <Text style={[styles.hintText, { color: accent }]}>{readiness.suggestedAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
  },
  title: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  block: {
    marginTop: 4,
    gap: 2,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  value: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  mono: {
    color: "#94a3b8",
    fontSize: 11,
  },
  walkDistance: {
    fontSize: 16,
    fontWeight: "800",
  },
  hint: {
    color: "#64748b",
    fontSize: 10,
  },
  hintBox: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginTop: 6,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
