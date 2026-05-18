/**
 * EdgeRoadDraft: Kenara paralel yol çizgisi (kaydırılabilir).
 */
import React from "react";
import { G, Line, Circle } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";
import type { RoadMergePreview } from "../../../src/utils/roadMerge";

type Props = {
  baseLine: [Point, Point];
  currentLine: [Point, Point];
  previewDelta?: number;
  roadMergePreview?: RoadMergePreview | null;
  activeEnd?: 0 | 1 | null;
};

export function LayerEdgeRoadDraft({ baseLine, currentLine, previewDelta = 0, roadMergePreview, activeEnd = null }: Props) {
  const [p1, p2] = currentLine;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  const half = previewDelta / 2;
  const previewP1 = { x: p1.x - tx * half, y: p1.y - ty * half };
  const previewP2 = { x: p2.x + tx * half, y: p2.y + ty * half };

  return (
    <G>
      <Line
        x1={previewP1.x}
        y1={previewP1.y}
        x2={previewP2.x}
        y2={previewP2.y}
        stroke="#06b6d4"
        strokeWidth={3}
        strokeDasharray="6 4"
      />
      <Circle cx={previewP1.x} cy={previewP1.y} r={activeEnd === 0 ? 6 : 4} fill={activeEnd === 0 ? "#0ea5e9" : "#06b6d4"} stroke={activeEnd === 0 ? "#fff" : "none"} strokeWidth={activeEnd === 0 ? 2 : 0} />
      <Circle cx={previewP2.x} cy={previewP2.y} r={activeEnd === 1 ? 6 : 4} fill={activeEnd === 1 ? "#0ea5e9" : "#06b6d4"} stroke={activeEnd === 1 ? "#fff" : "none"} strokeWidth={activeEnd === 1 ? 2 : 0} />
      {roadMergePreview && roadMergePreview.targetPoint && (
        <G>
          <Circle
            cx={roadMergePreview.targetPoint.x}
            cy={roadMergePreview.targetPoint.y}
            r={10}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={2.5}
            opacity={0.7}
          />
          {roadMergePreview.draftEndpointIndex === 0 ? (
            <Line
              x1={previewP1.x}
              y1={previewP1.y}
              x2={roadMergePreview.targetPoint.x}
              y2={roadMergePreview.targetPoint.y}
              stroke="#06b6d4"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          ) : (
            <Line
              x1={previewP2.x}
              y1={previewP2.y}
              x2={roadMergePreview.targetPoint.x}
              y2={roadMergePreview.targetPoint.y}
              stroke="#06b6d4"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          )}
        </G>
      )}
    </G>
  );
}
