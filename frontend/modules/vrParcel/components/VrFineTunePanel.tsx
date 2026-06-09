import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

type Props = {
  onMove: (dx: number, dz: number, dyaw: number) => void;
  onScale: (factor: number) => void;
  onLock: () => void;
  onRecalibrate: () => void;
};

/**
 * Unity UI yoksa RN fallback ince ayar paneli.
 */
export function VrFineTunePanel({ onMove, onScale, onLock, onRecalibrate }: Props): React.ReactElement {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>İnce ayar</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onMove(0, 0.1, 0)}>
          <Text style={styles.btnText}>10 cm ileri</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onMove(0, -0.1, 0)}>
          <Text style={styles.btnText}>10 cm geri</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onMove(-0.1, 0, 0)}>
          <Text style={styles.btnText}>10 cm sola</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onMove(0.1, 0, 0)}>
          <Text style={styles.btnText}>10 cm sağa</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onMove(0, 0, 1)}>
          <Text style={styles.btnText}>1° saat yönü</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onMove(0, 0, -1)}>
          <Text style={styles.btnText}>1° ters yön</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onScale(1.1)}>
          <Text style={styles.btnText}>Ölçek +10%</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onScale(0.9)}>
          <Text style={styles.btnText}>Ölçek −10%</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onScale(1.05)}>
          <Text style={styles.btnText}>Ölçek +5%</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onScale(0.95)}>
          <Text style={styles.btnText}>Ölçek −5%</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onLock}>
          <Text style={styles.btnText}>Kilitle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onRecalibrate}>
          <Text style={styles.btnText}>Yeniden kalibre</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#334155",
  },
  title: {
    color: "#f8fafc",
    fontWeight: "700",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  btn: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "#475569",
  },
  btnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
