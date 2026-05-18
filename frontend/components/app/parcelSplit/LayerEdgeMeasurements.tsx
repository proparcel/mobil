/**
 * Kenar ölçüleri SVG katmanı (local metre koordinatları).
 * Sadece segment etiketleri (örn. "25m") ve segment köşelerinde kırmızı X.
 */

import React from "react";
import Svg, { Text, Line } from "react-native-svg";
import type { Point, Piece } from "../../../src/types/parcelSplit";

export type MetreEdgeFeatureLine = {
  kind: "bbox" | "segment";
  type: "LineString";
  coords: Point[];
  color?: string;
};

export type MetreEdgeFeaturePoint = {
  kind: "segment" | "main_edge";
  type: "Point";
  coords: Point;
  text: string;
  color?: string;
  /** Kenara paralel yazı için derece (0 = yatay, 90 = dikey). */
  angle?: number;
  /** Ring'deki segment indeksi (placement + doğru kenar eşlemesi için). */
  edgeIndex?: number;
  /** Çakışma çözümünde etiket uzakta seçilirse: çizgi ile kenara bağla. */
  leaderLine?: { from: Point; to: Point };
};

export type MetreEdgeFeature = MetreEdgeFeatureLine | MetreEdgeFeaturePoint;

const VERTEX_X_COLOR = "#dc2626";
const VERTEX_X_SIZE = 0.4;

type Props = {
  features: MetreEdgeFeature[];
  /** Varsa segment köşelerine küçük kırmızı X çizilir. */
  ring?: Point[] | null;
  /** false ise köşe X'leri çizilmez (PDF render için). */
  showVertexX?: boolean;
};

export function LayerEdgeMeasurements({ features, ring, showVertexX = true }: Props) {
  if (!features || features.length === 0) return null;

  return (
    <>
      {features.map((f, i) => {
        if (f.type === "LineString") return null;
        if (f.type === "Point" && f.text && f.kind === "segment") {
          const t = String(f.text).trim();
          if (t === "0m" || t === "0mt" || t === "0") return null;
          const { coords, text, color, angle, leaderLine } = f;
          const fill = color ?? "#2563eb";
          const fontSize = 3;
          const origin = `${coords.x} ${coords.y}`;
          return (
            <React.Fragment key={`edge-pt-${i}`}>
              {leaderLine && (
                <Line
                  x1={leaderLine.from.x}
                  y1={leaderLine.from.y}
                  x2={leaderLine.to.x}
                  y2={leaderLine.to.y}
                  stroke={fill}
                  strokeWidth={0.12}
                  strokeOpacity={0.7}
                />
              )}
              <Text
                x={coords.x}
                y={coords.y}
                fontSize={fontSize}
                fontWeight="600"
                fill={fill}
                textAnchor="middle"
                transform={angle != null ? `rotate(${angle} ${origin})` : undefined}
              >
                {text}
              </Text>
            </React.Fragment>
          );
        }
        return null;
      })}
      {/* Segment köşelerinde küçük kırmızı X */}
      {showVertexX && ring && ring.length >= 2 && (() => {
        const n = ring[ring.length - 1]?.x === ring[0]?.x && ring[ring.length - 1]?.y === ring[0]?.y
          ? ring.length - 1
          : ring.length;
        const s = VERTEX_X_SIZE;
        return ring.slice(0, n).map((p, i) => (
          <React.Fragment key={`vertex-x-${i}`}>
            <Line x1={p.x - s} y1={p.y - s} x2={p.x + s} y2={p.y + s} stroke={VERTEX_X_COLOR} strokeWidth={0.15} />
            <Line x1={p.x + s} y1={p.y - s} x2={p.x - s} y2={p.y + s} stroke={VERTEX_X_COLOR} strokeWidth={0.15} />
          </React.Fragment>
        ));
      })()}
    </>
  );
}

function centroid(ring: Point[]): Point {
  let cx = 0, cy = 0;
  const n = ring.length - 1;
  if (n <= 0) return ring[0] ?? { x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    cx += ring[i].x;
    cy += ring[i].y;
  }
  return { x: cx / n, y: cy / n };
}

/** Kenar etiketleri parsel DIŞINDA: kenar orta noktasından dış normale bu kadar (m) offset. (6–8 m spec.) */
export const LABEL_OFFSET_M = 6;

/** Piece ring (local metre) → segment LineString + Point labels; etiketler kenar dışında, kenara paralel 2pt. */
export function pieceToEdgeFeaturesMetre(piece: Piece): MetreEdgeFeature[] {
  const ring = piece.polygon.ring;
  if (!ring || ring.length < 2) return [];
  const out: MetreEdgeFeature[] = [];
  const n = ring.length;
  const cent = centroid(ring);
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    out.push({ kind: "segment", type: "LineString", coords: [a, b], color: "#2563eb" });
    const edgeAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const perpX = -dy;
    const perpY = dx;
    const toMidX = mid.x - cent.x;
    const toMidY = mid.y - cent.y;
    const dot = toMidX * perpX + toMidY * perpY;
    const sign = dot >= 0 ? 1 : -1;
    const nx = (sign * perpX) / (len || 1);
    const ny = (sign * perpY) / (len || 1);
    const roundedLen = Math.round(len);
    if (roundedLen <= 0) continue;
    const labelPos = {
      x: mid.x + nx * LABEL_OFFSET_M,
      y: mid.y + ny * LABEL_OFFSET_M,
    };
    out.push({
      kind: "segment",
      type: "Point",
      coords: labelPos,
      text: `${roundedLen}m`,
      color: "#2563eb",
      angle: edgeAngleDeg,
    });
  }
  return out;
}

/** Parent ring (metre) + segment Point feature'ları: etiket konumlarını kenar dışına taşır (aynı offset kuralı). */
export function moveSegmentLabelsOutside(
  ring: Point[],
  features: MetreEdgeFeature[],
  offsetM: number = LABEL_OFFSET_M
): MetreEdgeFeature[] {
  if (!ring || ring.length < 2) return features;
  const cent = centroid(ring);
  const n = ring.length;
  return features.map((f) => {
    if (f.type !== "Point" || f.kind !== "segment" || f.edgeIndex == null) return f;
    const edgeIndex = f.edgeIndex % n;
    const a = ring[edgeIndex];
    const b = ring[(edgeIndex + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const perpX = -dy;
    const perpY = dx;
    const toMidX = mid.x - cent.x;
    const toMidY = mid.y - cent.y;
    const dot = toMidX * perpX + toMidY * perpY;
    const sign = dot >= 0 ? 1 : -1;
    const nx = (sign * perpX) / len;
    const ny = (sign * perpY) / len;
    const labelPos = {
      x: mid.x + nx * offsetM,
      y: mid.y + ny * offsetM,
    };
    return { ...f, coords: labelPos };
  });
}
