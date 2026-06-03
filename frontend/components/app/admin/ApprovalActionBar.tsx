import React from "react";
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from "react-native";
import { adminColors } from "../../../styles/admin/common";

type Props = {
  onApprove: () => void;
  onReject: () => void;
  loading?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
};

export function ApprovalActionBar({
  onApprove,
  onReject,
  loading,
  approveLabel = "Onayla",
  rejectLabel = "Reddet",
}: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, styles.approve]}
        onPress={onApprove}
        disabled={loading}
        accessibilityLabel={approveLabel}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>{approveLabel}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.reject]}
        onPress={onReject}
        disabled={loading}
        accessibilityLabel={rejectLabel}
      >
        <Text style={styles.btnText}>{rejectLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  approve: {
    backgroundColor: adminColors.success,
  },
  reject: {
    backgroundColor: adminColors.danger,
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
