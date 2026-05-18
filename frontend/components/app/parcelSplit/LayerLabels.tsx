/**
 * Piece labels: parça içinde m² (alan); parça bbox'ına göre boyut ve yatay/dikey konum.
 */

import React from "react";
import Svg, { Text } from "react-native-svg";
import type { Piece } from "../../../src/types/parcelSplit";
import { parcelSplitTheme } from "./theme";

function centroid(ring: { x: number; y: number }[]): { x: number; y: number } {
  let cx = 0, cy = 0;
  const n = ring.length - 1;
  if (n <= 0) return ring[0] ?? { x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    cx += ring[i].x;
    cy += ring[i].y;
  }
  return { x: cx / n, y: cy / n };
}

function bbox(ring: { x: number; y: number }[]): { w: number; h: number } {
  if (!ring.length) return { w: 0, h: 0 };
  let minX = ring[0].x, maxX = ring[0].x, minY = ring[0].y, maxY = ring[0].y;
  for (let i = 1; i < ring.length; i++) {
    minX = Math.min(minX, ring[i].x);
    maxX = Math.max(maxX, ring[i].x);
    minY = Math.min(minY, ring[i].y);
    maxY = Math.max(maxY, ring[i].y);
  }
  return { w: maxX - minX, h: maxY - minY };
}

/** m² etiket font boyutu (metre, SVG birimi) — sabit. */
const LABEL_FONT_SIZE = 3;

/** Parça yatay mı (geniş) dikey mi (uzun)? Dikeyse metni 90° döndürerek sığdırırız. */
function isVerticalPiece(ring: { x: number; y: number }[]): boolean {
  const { w, h } = bbox(ring);
  return h > w;
}

type Props = {
  pieces: Piece[];
};

export function LayerLabels({ pieces }: Props) {
  return (
    <>
      {pieces.map((p) => {
        const ring = p.polygon.ring;
        const c = centroid(ring);
        const label = `${Math.round(p.area)} m²`;
        const vertical = isVerticalPiece(ring);
        const rot = vertical ? -90 : 0;
        const origin = `${c.x} ${c.y}`;
        return (
          <Text
            key={p.id}
            x={c.x}
            y={c.y}
            fontSize={LABEL_FONT_SIZE}
            fontWeight="700"
            fill={parcelSplitTheme.brandNavy}
            textAnchor="middle"
            transform={rot !== 0 ? `rotate(${rot} ${origin})` : undefined}
          >
            {label}
          </Text>
        );
      })}
    </>
  );
}
