/**
 * Warnings overlay: invalid piece badge. World coords.
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

type Props = {
  pieces: Piece[];
};

export function LayerWarnings({ pieces }: Props) {
  const invalid = pieces.filter((p) => !p.valid);
  return (
    <>
      {invalid.map((p) => {
        const c = centroid(p.polygon.ring);
        return (
          <Text
            key={p.id}
            x={c.x}
            y={c.y}
            fontSize={9}
            fontWeight="700"
            fill={parcelSplitTheme.warningStroke}
            textAnchor="middle"
          >
            !
          </Text>
        );
      })}
    </>
  );
}
