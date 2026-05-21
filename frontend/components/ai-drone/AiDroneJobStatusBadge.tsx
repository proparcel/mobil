import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { aiDroneJobStatusColors, aiDroneJobStatusLabel } from "../../src/utils/aiDroneJobStatus";

type Props = {
  status: string;
  statusLabel?: string | null;
};

export function AiDroneJobStatusBadge({ status, statusLabel }: Props) {
  const colors = aiDroneJobStatusColors(status);
  const label = aiDroneJobStatusLabel(status, statusLabel);

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: { fontSize: 12, fontWeight: "700" },
});
