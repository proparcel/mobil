import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { adminColors } from "../../../styles/admin/common";

type Props = {
  count: number;
};

export function AdminPendingBadge({ count }: Props) {
  if (!count || count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? "99+" : String(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: adminColors.badge,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  text: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
