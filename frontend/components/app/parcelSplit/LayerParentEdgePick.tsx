/**
 * Parent ring kenar seçimi modunda: tüm kenarlar ve seçili kenar highlight.
 */

import React from "react";
import Svg, { Line } from "react-native-svg";
import type { PolygonEdge } from "../../../src/types/parcelSplit";
import { parcelSplitTheme } from "./theme";

type Props = {
  edges: PolygonEdge[];
  selectedEdgeIndex: number | null;
};

export function LayerParentEdgePick({ edges, selectedEdgeIndex }: Props) {
  return (
    <>
      {edges.map((e) => {
        const selected = e.i === selectedEdgeIndex;
        const stroke = selected ? parcelSplitTheme.accentBlue : "rgba(100,116,139,0.5)";
        const strokeWidth = selected ? 3 : 1.5;
        return (
          <Line
            key={e.edgeId}
            x1={e.a.x}
            y1={e.a.y}
            x2={e.b.x}
            y2={e.b.y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={selected ? undefined : "6 4"}
          />
        );
      })}
    </>
  );
}
