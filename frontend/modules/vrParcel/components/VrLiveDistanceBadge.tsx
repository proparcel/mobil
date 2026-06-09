import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatArDistanceM } from "../utils/vrArDistance";

type Props = {
  label: string;
  distanceM?: number;
  minRecommendedM?: number;
};

export function VrLiveDistanceBadge({
  label,
  distanceM,
  minRecommendedM = 3,
}: Props): React.ReactElement | null {
  if (distanceM == null) return null;

  const quality =
    distanceM >= 5 ? "good" : distanceM >= minRecommendedM ? "ok" : "low";

  return (
    <View style={[styles.root, quality === "good" ? styles.good : quality === "ok" ? styles.ok : styles.low]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{formatArDistanceM(distanceM)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  good: { backgroundColor: "rgba(34, 197, 94, 0.18)" },
  ok: { backgroundColor: "rgba(245, 158, 11, 0.18)" },
  low: { backgroundColor: "rgba(239, 68, 68, 0.18)" },
  label: { color: "#e2e8f0", fontSize: 12, flex: 1 },
  value: { color: "#f8fafc", fontSize: 13, fontWeight: "700" },
});

export default VrLiveDistanceBadge;
