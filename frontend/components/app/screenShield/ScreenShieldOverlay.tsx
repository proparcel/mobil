/**
 * Fake screen overlay: beyaz zemin, ortada "ProParcel", altta "Ekran korumalı".
 * Ekran kaydı veya screenshot anında içerik yerine bu sayfa gösterilir.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
    elevation: 999999,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
});

type Props = {
  visible: boolean;
};

export function ScreenShieldOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Text style={styles.title}>ProParcel</Text>
      <Text style={styles.subtitle}>Ekran korumalı</Text>
    </View>
  );
}
