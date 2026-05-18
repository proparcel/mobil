/**
 * Yol kaydırma önizleme: kesikli cyan çizgi.
 * - Segment handle: tüm yol offset preview
 * - Vertex handle: etkilenen segment(ler) preview
 */

import React from "react";
import Svg, { Polyline, Line } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";
import type { RoadHandleSelection } from "../../../src/types/parcelSplit";

const PREVIEW_STROKE = "#06b6d4";
const PREVIEW_STROKE_WIDTH = 2.5;
const PREVIEW_DASH = "4 3";

function edgeUnitNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

type PropsSegment = {
  type: "segment";
  points: Point[];
  segmentIndex: number;
  offsetMeters: number;
};

type PropsVertex = {
  type: "vertex";
  points: Point[];
  vertexIndex: number;
  dx: number;
  dy: number;
};

export function LayerRoadSlidePreview(props: PropsSegment | PropsVertex) {
  if (props.type === "segment") {
    const { points, segmentIndex, offsetMeters } = props;
    if (!points || points.length < 2 || segmentIndex < 0 || segmentIndex >= points.length - 1)
      return null;
    const a = points[segmentIndex];
    const b = points[segmentIndex + 1];
    const n = edgeUnitNormal(a, b);
    const newPoints = points.map((p) => ({
      x: p.x + n.x * offsetMeters,
      y: p.y + n.y * offsetMeters,
    }));
    const pts = newPoints.map((p) => `${p.x},${p.y}`).join(" ");
    return (
      <Polyline
        points={pts}
        fill="none"
        stroke={PREVIEW_STROKE}
        strokeWidth={PREVIEW_STROKE_WIDTH}
        strokeDasharray={PREVIEW_DASH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  const { points, vertexIndex, dx, dy } = props;
  if (!points || points.length < 2 || vertexIndex < 0 || vertexIndex >= points.length)
    return null;
  const newPoints = points.map((p, i) =>
    i === vertexIndex ? { x: p.x + dx, y: p.y + dy } : p
  );
  const pts = newPoints.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <Polyline
      points={pts}
      fill="none"
      stroke={PREVIEW_STROKE}
      strokeWidth={PREVIEW_STROKE_WIDTH}
      strokeDasharray={PREVIEW_DASH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
