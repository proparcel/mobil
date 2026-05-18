/**
 * Yol kaydırma handle'ları: köşe noktaları (daire) + her segment ortasında bir kısa çizgi.
 */

import React from "react";
import Svg, { Circle, Line } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";
import type { RoadHandleSelection } from "../../../src/types/parcelSplit";

const VERTEX_R = 0.8;
const SEGMENT_HANDLE_LEN = 0.6;
const HANDLE_STROKE = "#ea580c";
const HANDLE_STROKE_SELECTED = "#f97316";
const HANDLE_STROKE_WIDTH = 1.5;
const HANDLE_STROKE_WIDTH_SELECTED = 3;

type Props = {
  points: Point[];
  selectedHandle: RoadHandleSelection;
};

export function LayerRoadHandles({ points, selectedHandle }: Props) {
  if (!points || points.length < 2) return null;

  return (
    <>
      {points.map((p, i) => {
        const sel = selectedHandle?.type === "vertex" && selectedHandle.index === i;
        return (
          <Circle
            key={`v-${i}`}
            cx={p.x}
            cy={p.y}
            r={VERTEX_R}
            fill="#fff"
            stroke={sel ? HANDLE_STROKE_SELECTED : HANDLE_STROKE}
            strokeWidth={sel ? HANDLE_STROKE_WIDTH_SELECTED : HANDLE_STROKE_WIDTH}
          />
        );
      })}
      {points.length >= 2 &&
        points.slice(0, -1).map((_, i) => {
          const a = points[i];
          const b = points[i + 1];
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const half = Math.min(SEGMENT_HANDLE_LEN / 2, len / 2);
          const p1 = { x: mid.x - ux * half, y: mid.y - uy * half };
          const p2 = { x: mid.x + ux * half, y: mid.y + uy * half };
          const sel = selectedHandle?.type === "segment" && selectedHandle.index === i;
          return (
            <Line
              key={`s-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={sel ? HANDLE_STROKE_SELECTED : HANDLE_STROKE}
              strokeWidth={sel ? HANDLE_STROKE_WIDTH_SELECTED : HANDLE_STROKE_WIDTH}
              strokeLinecap="round"
            />
          );
        })}
    </>
  );
}
