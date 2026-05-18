/**
 * Sağ üst overlay: moda göre farklı özet. Tıklanınca parça listesi açar (split modunda).
 * draw_road: Genişlik + Nokta sayısı; edge_slide: A/B alan + delta; split: toplam, hedef, uygunsuz.
 */

import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { parcelSplitTheme } from "./theme";

type PropsSplit = {
  mode: "split";
  totalArea: number;
  targetLabel: string;
  invalidCount: number;
  onPress: () => void;
  visible: boolean;
};

type PropsDrawRoad = {
  mode: "draw_road";
  roadWidth: string;
  pointCount: number;
  onPress?: () => void;
  visible: boolean;
};

type PropsEdgeSlide = {
  mode: "edge_slide";
  areaA: number;
  areaB: number;
  deltaA: number;
  deltaB: number;
  onPress?: () => void;
  visible: boolean;
};

type Props = PropsSplit | PropsDrawRoad | PropsEdgeSlide;

export function StatsChip(props: Props) {
  const { visible } = props;
  if (!visible) return null;

  const handlePress = () => {
    if (props.mode === "split" && props.onPress) props.onPress();
    else if (props.mode === "draw_road" && props.onPress) props.onPress();
    else if (props.mode === "edge_slide" && props.onPress) props.onPress();
  };

  let content: React.ReactNode;
  let accessibilityLabel = "Özet";

  if (props.mode === "draw_road") {
    content = (
      <>
        <Text style={styles.line}>Genişlik: {props.roadWidth || "2"}m</Text>
        <Text style={styles.line}>Nokta: {props.pointCount}</Text>
      </>
    );
    accessibilityLabel = "Yol taslağı özeti";
  } else if (props.mode === "edge_slide") {
    content = (
      <>
        <Text style={styles.line}>
          A: {Math.round(props.areaA)} m² ({props.deltaA >= 0 ? "+" : ""}{Math.round(props.deltaA)})
        </Text>
        <Text style={styles.line}>
          B: {Math.round(props.areaB)} m² ({props.deltaB >= 0 ? "+" : ""}{Math.round(props.deltaB)})
        </Text>
      </>
    );
    accessibilityLabel = "Kenar kaydır özeti";
  } else {
    content = (
      <>
        <Text style={styles.line}>{Math.round(props.totalArea)} m²</Text>
        <Text style={styles.line}>{props.targetLabel}</Text>
        {props.invalidCount > 0 && (
          <Text style={[styles.line, styles.invalid]}>{props.invalidCount} uygunsuz</Text>
        )}
      </>
    );
    accessibilityLabel = "Parça listesi";
  }

  return (
    <TouchableOpacity
      style={styles.chip}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  line: {
    fontSize: 11,
    color: parcelSplitTheme.textOnDark,
    fontWeight: "500",
  },
  invalid: {
    color: "#fca5a5",
    marginTop: 2,
  },
});
