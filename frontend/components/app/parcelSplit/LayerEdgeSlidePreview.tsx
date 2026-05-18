/**
 * Kenar kaydırma sırasında parmakla sürüklerken önizleme çizgisi.
 */

import React from "react";
import Svg, { Line } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";

type Props = {
  a: Point;
  b: Point;
  offsetMeters: number;
};

function edgeUnitNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

export function LayerEdgeSlidePreview({ a, b, offsetMeters }: Props) {
  const n = edgeUnitNormal(a, b);
  const aPrime = { x: a.x + n.x * offsetMeters, y: a.y + n.y * offsetMeters };
  const bPrime = { x: b.x + n.x * offsetMeters, y: b.y + n.y * offsetMeters };

  return (
    <Line
      x1={aPrime.x}
      y1={aPrime.y}
      x2={bPrime.x}
      y2={bPrime.y}
      stroke="#06b6d4"
      strokeWidth={2.5}
      strokeDasharray="4 3"
      strokeLinecap="round"
    />
  );
}
