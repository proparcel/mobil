/**
 * Parent polygon katmanı. World koordinatlarda çizilir; viewBox ile görüntülenir.
 */

import React from "react";
import Svg, { Polygon } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";
import { ringToWorldPoints } from "../../../src/utils/parcelSplitTransform";
import { parcelSplitTheme } from "./theme";

type Props = {
  ring: Point[];
  /** true = sadece dış sınır çizgisi (en üstte düz çizgi olarak görünsün) */
  strokeOnly?: boolean;
};

export function LayerParentPolygon({ ring, strokeOnly = false }: Props) {
  if (!ring.length) {
    if (__DEV__) console.log("[ParcelSplit] POLIGON YOK – LayerParentPolygon: ring boş (length=0)");
    return null;
  }
  const points = ringToWorldPoints(ring);
  if (__DEV__ && !strokeOnly) {
    console.log("[ParcelSplit] LayerParentPolygon draw", {
      ringLength: ring.length,
      pointsLength: points.length,
      pointsPreview: points.slice(0, 100),
      firstPoint: ring[0],
    });
  }
  return (
    <Polygon
      points={points}
      fill={strokeOnly ? "none" : parcelSplitTheme.polygonFill}
      stroke={strokeOnly ? parcelSplitTheme.splitLineStroke : parcelSplitTheme.polygonStroke}
      strokeWidth={1}
      strokeDasharray={strokeOnly ? "0.8 2" : undefined}
      strokeLinecap={strokeOnly ? "round" : undefined}
    />
  );
}
