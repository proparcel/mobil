/**
 * Kenar modunda yol çizimi için mode bar (Tamamla / İptal).
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export type EdgeRoadModeBarProps = {
  onComplete: () => void;
  onCancel: () => void;
};

export function EdgeRoadModeBar({ onComplete, onCancel }: EdgeRoadModeBarProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Ionicons name="close" size={20} color="#ef4444" />
        <Text style={styles.cancelText}>İptal</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
        <Ionicons name="checkmark" size={20} color="#fff" />
        <Text style={styles.completeText}>Tamamla</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
  },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  completeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
