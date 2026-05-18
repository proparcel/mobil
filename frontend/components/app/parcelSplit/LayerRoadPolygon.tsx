/**
 * Tamamlanmış yol polygon: tek mat renk (dolgu = çizgi), parsel renklerinden farklı.
 */

import React from "react";
import Svg, { Polygon as SvgPolygon } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";

/** Yol rengi: mat, tek ton; parsel gri/mavilerinden ayrılsın (sıcak gri / taş). */
const ROAD_COLOR = "#78716c";
const ROAD_COLOR_SELECTED = "#57534e";

type Props = {
  ring: Point[] | null;
  selected?: boolean;
};

export function LayerRoadPolygon({ ring, selected = false }: Props) {
  if (!ring || ring.length < 3) return null;

  const points = ring.map((p) => `${p.x},${p.y}`).join(" ");
  const color = selected ? ROAD_COLOR_SELECTED : ROAD_COLOR;

  return (
    <SvgPolygon
      points={points}
      fill={color}
      stroke={color}
      strokeWidth={selected ? 2 : 1.2}
    />
  );
}
