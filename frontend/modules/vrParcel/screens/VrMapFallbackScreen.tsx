import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import { VrMapPreview } from "../components/VrMapPreview";

type Props = {
  payload: VrParcelPayload;
  onClose: () => void;
};

export function VrMapFallbackScreen({ payload, onClose }: Props): React.ReactElement {
  return (
    <View style={styles.root}>
      <VrMapPreview
        payload={payload}
        title="Harita Görünümü"
        subtitle="Bu cihazda kamera üzerinden VR parsel çizimi desteklenmiyor. Parsel sınırını haritada inceleyebilirsiniz."
      />
      <View style={styles.footer}>
        <Text style={styles.note}>
          AR destekli bir cihazda ve Unity bağlı development build ile tam VR kalibrasyonu kullanılabilir.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#334155",
    gap: 10,
  },
  note: { color: "#64748b", fontSize: 12, lineHeight: 17, textAlign: "center" },
  btn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});

export default VrMapFallbackScreen;
