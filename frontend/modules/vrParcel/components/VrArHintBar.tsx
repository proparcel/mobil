import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  hint: string;
  variant?: "default" | "warning";
};

/** AR kamera adimlarinda yalnizca tek satirlik yonlendirme. */
export function VrArHintBar({ hint, variant = "default" }: Props): React.ReactElement {
  const isWarning = variant === "warning";
  return (
    <View style={[styles.root, isWarning && styles.rootWarning]} pointerEvents="none">
      <Text style={[styles.hint, isWarning && styles.hintWarning]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
  },
  hint: {
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  rootWarning: {
    backgroundColor: "rgba(120, 53, 15, 0.88)",
  },
  hintWarning: {
    color: "#fde68a",
  },
});

export default VrArHintBar;
