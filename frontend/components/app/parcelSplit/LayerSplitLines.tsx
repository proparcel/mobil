/**
 * Split lines layer; optional handle circles. World coords.
 */

import React from "react";
import Svg, { Line, Circle } from "react-native-svg";
import type { LineString } from "../../../src/types/parcelSplit";
import { parcelSplitTheme } from "./theme";

type Props = {
  splitLines: LineString[];
  showHandles?: boolean;
};

export function LayerSplitLines({ splitLines, showHandles }: Props) {
  return (
    <>
      {splitLines.map((ls, idx) => {
        const c = ls.coords;
        if (!c || c.length < 2) return null;
        const a = c[0];
        const b = c[c.length - 1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <React.Fragment key={`split-${idx}`}>
            <Line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={parcelSplitTheme.splitLineStroke}
              strokeWidth={0.5}
              strokeDasharray="0.8 2"
              strokeLinecap="round"
            />
            {showHandles && (
              <Circle
                cx={mid.x}
                cy={mid.y}
                r={6}
                fill={parcelSplitTheme.accentBlue}
                stroke="#fff"
                strokeWidth={1}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
