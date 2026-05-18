/**
 * Yol taslağı: draft noktaları (daireler) + polyline.
 * 2+ nokta varken seçili vertex vurgulanır; sürükleme önizlemesi gösterilir.
 * Sınıra yakın noktalarda snap hedefi gösterilir; sınırda birleşen noktalar yeşil çizilir.
 */

import React, { useMemo } from "react";
import Svg, { Circle, Polyline, Line } from "react-native-svg";
import type { Point } from "../../../src/types/parcelSplit";
import { closestPointOnRing } from "../../../src/utils/roadGeometry";
import { parcelSplitTheme } from "./theme";

/** Nokta işaretçisi yarıçapı (metre, dünya koordinatı) – küçük nokta görünümü. */
const MARKER_R = 0.35;
/** 2+ nokta varken handle boyutu (sürükleme için daha kolay tutulur) */
const HANDLE_R = 0.6;
const ROAD_STROKE = parcelSplitTheme.splitLineStroke;
/** Bu mesafeden yakınsa nokta "sınırda" sayılır (yeşil) */
const ON_BOUNDARY_TOL_SQ = 0.25; // 0.5m
/** Snap hedefi gösterme mesafesi (metre kare) */
const SNAP_TARGET_TOL_SQ = 25; // 5m
/** İki nokta bu mesafede ise "birleşecek" vurgusu (metre kare) */
const MERGE_HIGHLIGHT_TOL_SQ = 4; // 2m

type Props = {
  points: Point[];
  selectedVertexIndex?: number | null;
  /** Sürükleme önizlemesi: { index, dx, dy } - bu nokta (x+dx, y+dy) konumunda çizilir */
  previewOffset?: { index: number; dx: number; dy: number } | null;
  /** Parsel sınırı - snap hedefi ve sınırda birleşme gösterimi için */
  ring?: Point[] | null;
  /** Yol birleştirme önizlemesi - merge noktası ve snap hint */
  roadMergePreview?: {
    draftEndpointIndex: 0 | 1;
    targetPoint: Point;
    targetType: "boundary" | "road";
  } | null;
};

export function LayerRoadDraft({
  points,
  selectedVertexIndex = null,
  previewOffset = null,
  ring = null,
  roadMergePreview = null,
}: Props) {
  if (!points || points.length === 0) return null;

  const hasHandles = points.length >= 1;
  const r = hasHandles ? HANDLE_R : MARKER_R;

  const effectivePoints = useMemo(
    () =>
      points.map((p, i) => {
        if (previewOffset && previewOffset.index === i) {
          return { x: p.x + previewOffset.dx, y: p.y + previewOffset.dy };
        }
        return p;
      }),
    [points, previewOffset]
  );
  const pointsStr = effectivePoints.map((p) => `${p.x},${p.y}`).join(" ");

  const { onBoundary, snapTarget, mergeHighlightIndices } = useMemo(() => {
    const onBoundary: boolean[] = points.map((p, i) => {
      if (!ring || ring.length < 3) return false;
      const { distSq } = closestPointOnRing(p, ring);
      return distSq <= ON_BOUNDARY_TOL_SQ;
    });
    let snapTarget: Point | null = null;
    const mergeHighlightIndices: Set<number> = new Set();
    if (ring && ring.length >= 3 && previewOffset) {
      const p = effectivePoints[previewOffset.index];
      if (p && (previewOffset.index === 0 || previewOffset.index === points.length - 1)) {
        const { point: closest, distSq } = closestPointOnRing(p, ring);
        if (distSq <= SNAP_TARGET_TOL_SQ && distSq > ON_BOUNDARY_TOL_SQ) {
          snapTarget = closest;
        }
      }
    }
    if (previewOffset) {
      const draggedPos = effectivePoints[previewOffset.index];
      if (draggedPos) {
        effectivePoints.forEach((other, i) => {
          if (i !== previewOffset.index) {
            const dx = draggedPos.x - other.x;
            const dy = draggedPos.y - other.y;
            if (dx * dx + dy * dy <= MERGE_HIGHLIGHT_TOL_SQ) {
              mergeHighlightIndices.add(i);
              mergeHighlightIndices.add(previewOffset.index);
            }
          }
        });
      }
    }
    return { onBoundary, snapTarget, mergeHighlightIndices };
  }, [points, effectivePoints, ring, previewOffset]);

  return (
    <>
      {points.length >= 2 && (
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={ROAD_STROKE}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}
      {snapTarget && (
        <Circle
          cx={snapTarget.x}
          cy={snapTarget.y}
          r={r * 0.8}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      )}
      {roadMergePreview && (
        <>
          <Circle
            cx={roadMergePreview.targetPoint.x}
            cy={roadMergePreview.targetPoint.y}
            r={HANDLE_R * 1.8}
            fill="rgba(34,211,238,0.2)"
            stroke="#06b6d4"
            strokeWidth={2.5}
          />
          <Line
            x1={
              roadMergePreview.draftEndpointIndex === 0
                ? effectivePoints[0].x
                : effectivePoints[effectivePoints.length - 1].x
            }
            y1={
              roadMergePreview.draftEndpointIndex === 0
                ? effectivePoints[0].y
                : effectivePoints[effectivePoints.length - 1].y
            }
            x2={roadMergePreview.targetPoint.x}
            y2={roadMergePreview.targetPoint.y}
            stroke="#06b6d4"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </>
      )}
      {effectivePoints.map((p, i) => {
        const sel = selectedVertexIndex === i;
        const onBnd = ring && onBoundary[i];
        const mergeHighlight = mergeHighlightIndices.has(i);
        const fill = mergeHighlight
          ? "#a855f7"
          : sel
            ? "#f97316"
            : onBnd
              ? "#22c55e"
              : parcelSplitTheme.accentBlue;
        const stroke = mergeHighlight
          ? "#7c3aed"
          : sel
            ? "#ea580c"
            : onBnd
              ? "#16a34a"
              : parcelSplitTheme.brandNavy;
        return (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={mergeHighlight ? r * 1.2 : r}
            fill={fill}
            stroke={stroke}
            strokeWidth={sel || onBnd || mergeHighlight ? 2.5 : 1}
          />
        );
      })}
    </>
  );
}
