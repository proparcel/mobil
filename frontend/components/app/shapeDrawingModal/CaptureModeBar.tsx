/**
 * 3D Model Editör – Hazırlık Modu Bar
 * captureMode aktifken üstte: Hazırlık Modu başlığı, altında Çek | Resimler | Kapat
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
  captureInProgress: boolean;
  onCapture: () => void;
  onClose: () => void;
  onOpenResimler: () => void;
};

export const CaptureModeBar: React.FC<Props> = ({
  captureInProgress,
  onCapture,
  onClose,
  onOpenResimler,
}) => {
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>Hazırlık Modu</Text>
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.captureButton, captureInProgress && styles.captureButtonDisabled]}
          onPress={onCapture}
          disabled={captureInProgress}
        >
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.captureButtonText}>{captureInProgress ? "..." : "Çek"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onOpenResimler} disabled={captureInProgress}>
          <Ionicons name="images" size={20} color="#fff" />
          <Text style={styles.buttonText}>Resimler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onClose} disabled={captureInProgress}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.buttonText}>Kapat</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>UI gizlendi, sadece harita yakalanacak.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#3b82f6",
    zIndex: 2000,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 8,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  captureButtonDisabled: {
    backgroundColor: "#64748b",
    opacity: 0.8,
  },
  captureButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
