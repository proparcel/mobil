/**
 * Sağ alt overlay: Zoom +/-, Fit-to-view.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { parcelSplitTheme } from "./theme";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  visible: boolean;
};

export function FloatingTools({ onZoomIn, onZoomOut, onFitToView, visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.root} pointerEvents="box-none">
      <TouchableOpacity style={styles.btn} onPress={onZoomIn} accessibilityLabel="Yakınlaştır">
        <Ionicons name="add" size={22} color={parcelSplitTheme.brandNavy} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onZoomOut} accessibilityLabel="Uzaklaştır">
        <Ionicons name="remove" size={22} color={parcelSplitTheme.brandNavy} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onFitToView} accessibilityLabel="Sığdır">
        <Ionicons name="scan-outline" size={18} color={parcelSplitTheme.brandNavy} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "column",
  },
  btn: {
    marginBottom: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
});
