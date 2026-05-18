/**
 * Edge overlay: selectable parent edges, selected road edges highlighted. World coords.
 */

import React from "react";
import Svg, { Line } from "react-native-svg";
import type { PolygonEdge } from "../../../src/types/parcelSplit";
import { parcelSplitTheme } from "./theme";

type Props = {
  edges: PolygonEdge[];
  selectedRoadEdges: Set<string>;
};

export function LayerEdgeOverlay({ edges, selectedRoadEdges }: Props) {
  return (
    <>
      {edges.map((e) => {
        const selected = selectedRoadEdges.has(e.edgeId);
        const stroke = selected ? parcelSplitTheme.edgeStrokeSelected : parcelSplitTheme.edgeStroke;
        const strokeWidth = selected ? parcelSplitTheme.edgeStrokeWidthSelected : parcelSplitTheme.edgeStrokeWidth;
        return (
          <Line
            key={e.edgeId}
            x1={e.a.x}
            y1={e.a.y}
            x2={e.b.x}
            y2={e.b.y}
            stroke={stroke}
            strokeWidth={0.8}
            strokeDasharray="5 3"
          />
        );
      })}
    </>
  );
}
