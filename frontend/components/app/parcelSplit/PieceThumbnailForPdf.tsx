/**
 * Tek bir parsel poligonunu küçük kutu içinde çizer (PDF parsel kartı görseli için).
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Polygon as SvgPolygon } from "react-native-svg";
import type { Piece } from "../../../src/types/parcelSplit";
import { getBbox } from "../../../src/utils/parcelSplitTransform";
import { parcelSplitTheme } from "./theme";

const PAD = 4;

type Props = {
  piece: Piece;
  width: number;
  height: number;
};

export function PieceThumbnailForPdf({ piece, width, height }: Props) {
  const ring = piece.polygon.ring;
  if (!ring || ring.length < 3) {
    return <View style={[styles.box, { width, height }]} />;
  }
  const bbox = getBbox(ring);
  const spanX = bbox.maxX - bbox.minX || 1;
  const spanY = bbox.maxY - bbox.minY || 1;
  const minX = bbox.minX - PAD;
  const minY = bbox.minY - PAD;
  const vbW = spanX + 2 * PAD;
  const vbH = spanY + 2 * PAD;
  const viewBox = `${minX} ${minY} ${vbW} ${vbH}`;
  const points = ring.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={[styles.box, { width, height }]}>
      <Svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <SvgPolygon
          points={points}
          fill={parcelSplitTheme.pieceFill}
          stroke={parcelSplitTheme.pieceStroke}
          strokeWidth={Math.max(0.5, (spanX + spanY) / 100)}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: parcelSplitTheme.canvasBg,
    overflow: "hidden",
  },
});
