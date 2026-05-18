/**
 * PDF için off-screen render: ana parsel veya tek parça.
 * Kenar ölçüleri, alan etiketi, parça numarası (daire içinde) ile çizilir.
 * Viewport fit: bbox + padding ile hedef piksel boyutuna sığdırılır (kırpma/fit).
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, ClipPath, Polygon as SvgPolygon, G, Circle, Text } from "react-native-svg";
import type { Point, Piece } from "../../../src/types/parcelSplit";
import { getBbox, ringToWorldPoints } from "../../../src/utils/parcelSplitTransform";
import { LayerParentPolygon } from "./LayerParentPolygon";
import { LayerPieces } from "./LayerPieces";
import { LayerLabels } from "./LayerLabels";
import { LayerRoadPolygon } from "./LayerRoadPolygon";
import {
  LayerEdgeMeasurements,
  pieceToEdgeFeaturesMetre,
  ringToEdgeFeaturesMetre,
  type MetreEdgeFeature,
} from "./LayerEdgeMeasurements";
import { LayerSplitLines } from "./LayerSplitLines";
import { parcelSplitTheme } from "./theme";
import type { LineString } from "../../../src/types/parcelSplit";

const PAD_M = 8;
/** Kenar etiketleri ring dışında; ViewBox tüm çizimi kapsasın diye ekstra padding. */
const VIEWBOX_EXTRA_PAD_M = 6;
const PIECE_NUMBER_RADIUS_M = 2.5;
const PIECE_NUMBER_FONT_M = 2.2;
/** Parsel numarası badge: sağ iç köşe için bbox’tan padding (m). */
const PIECE_NUMBER_PAD_M = 4;

export type PdfRenderMode = "parent" | "piece";

export interface PdfRenderCanvasProps {
  mode: PdfRenderMode;
  parentRing: Point[];
  pieces: Piece[];
  splitLines?: LineString[];
  roadPolygon?: Point[] | null;
  edgeMeasurementsMetre: MetreEdgeFeature[];
  /** mode="piece" için hangi parça (pieces[ind]) */
  pieceIndex?: number;
  widthPx: number;
  heightPx: number;
}

function centroid(ring: Point[]): Point {
  let cx = 0, cy = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    cx += ring[i].x;
    cy += ring[i].y;
  }
  return { x: cx / n, y: cy / n };
}

/** Basit point-in-polygon (ray casting). Ring kapalı değilse son nokta ilk ile birleştirilir. */
function pointInRing(ring: Point[], p: Point): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  const x = p.x;
  const y = p.y;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x, yi = ring[i].y;
    const xj = ring[j].x, yj = ring[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Parsel numarası badge: sağ iç köşe (bbox’a göre sağ + üstten padding, parsel içinde). */
function getRightInnerCorner(ring: Point[], paddingM: number): Point {
  if (!ring || ring.length < 2) return centroid(ring);
  let minX = ring[0].x, maxX = ring[0].x, minY = ring[0].y, maxY = ring[0].y;
  for (let i = 1; i < ring.length; i++) {
    minX = Math.min(minX, ring[i].x);
    maxX = Math.max(maxX, ring[i].x);
    minY = Math.min(minY, ring[i].y);
    maxY = Math.max(maxY, ring[i].y);
  }
  const cand = { x: maxX - paddingM, y: minY + paddingM };
  if (pointInRing(ring, cand)) return cand;
  for (const dx of [0, paddingM, paddingM * 2]) {
    for (const dy of [0, paddingM]) {
      const p = { x: maxX - paddingM - dx, y: minY + paddingM + dy };
      if (pointInRing(ring, p)) return p;
    }
  }
  return centroid(ring);
}

function bboxUnion(rings: Point[][]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  }
  return { minX, maxX, minY, maxY };
}

/** Bbox'ı ek noktalarla genişletir (kenar etiketleri + parsel numarası); taşmayı önlemek için. */
function bboxExpandWithPoints(
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  points: Point[]
): { minX: number; maxX: number; minY: number; maxY: number } {
  let { minX, maxX, minY, maxY } = bbox;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

export function PdfRenderCanvas({
  mode,
  parentRing,
  pieces,
  splitLines = [],
  roadPolygon,
  edgeMeasurementsMetre,
  pieceIndex = 0,
  widthPx,
  heightPx,
}: PdfRenderCanvasProps) {
  const isParent = mode === "parent";
  const displayPieces = isParent ? pieces : (pieces[pieceIndex] ? [pieces[pieceIndex]] : []);
  const pieceNumber = pieceIndex + 1;

  const ringsForBbox: Point[][] = isParent ? [parentRing] : [];
  if (isParent && roadPolygon && roadPolygon.length >= 2) ringsForBbox.push(roadPolygon);
  for (const p of displayPieces) {
    if (p.polygon.ring?.length) ringsForBbox.push(p.polygon.ring);
  }
  if (ringsForBbox.length === 0) ringsForBbox.push(parentRing);
  let bbox = bboxUnion(ringsForBbox);

  const pieceEdgeFeatures = displayPieces.length === 1
    ? pieceToEdgeFeaturesMetre(displayPieces[0])
    : [];

  /** Ana parsel: backend kenar ölçüleri varsa onları kullan, yoksa ring’den hesapla (PDF’de her zaman göster). */
  const edgeFeatures = isParent
    ? (edgeMeasurementsMetre.length > 0 ? edgeMeasurementsMetre : ringToEdgeFeaturesMetre(parentRing))
    : pieceEdgeFeatures;

  const extraPoints: Point[] = [];
  for (const f of edgeFeatures) {
    if (f.type === "Point" && f.coords) extraPoints.push(f.coords);
  }
  if (displayPieces.length === 1 && displayPieces[0].polygon.ring?.length) {
    extraPoints.push(getRightInnerCorner(displayPieces[0].polygon.ring, PIECE_NUMBER_PAD_M));
  }
  if (extraPoints.length > 0) {
    bbox = bboxExpandWithPoints(bbox, extraPoints);
  }
  const pad = PAD_M + VIEWBOX_EXTRA_PAD_M;
  const spanX = bbox.maxX - bbox.minX || 1;
  const spanY = bbox.maxY - bbox.minY || 1;
  const viewBox = `${bbox.minX - pad} ${bbox.minY - pad} ${spanX + 2 * pad} ${spanY + 2 * pad}`;

  return (
    <View style={[styles.root, { width: widthPx, height: heightPx }]}>
      <Svg
        width={widthPx}
        height={heightPx}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={styles.svg}
      >
        <Defs>
          <ClipPath id="pdfClipParent">
            <SvgPolygon points={parentRing.length >= 3 ? parentRing.map((p) => `${p.x},${p.y}`).join(" ") : ""} />
          </ClipPath>
        </Defs>
        {isParent && parentRing.length >= 3 && (
          <LayerParentPolygon ring={parentRing} strokeOnly={false} />
        )}
        {isParent && roadPolygon && roadPolygon.length >= 3 && (
          <G clipPath="url(#pdfClipParent)">
            <LayerRoadPolygon ring={roadPolygon} selected={false} />
          </G>
        )}
        {isParent && splitLines.length > 0 && (
          <LayerSplitLines splitLines={splitLines} showHandles={false} />
        )}
        {displayPieces.length > 0 && (
          <LayerPieces
            pieces={displayPieces}
            selectedPieceId={null}
            selectedEdgeId={null}
          />
        )}
        {edgeFeatures.length > 0 && (
          <LayerEdgeMeasurements
            features={edgeFeatures}
            ring={isParent ? parentRing : (displayPieces[0]?.polygon.ring ?? null)}
            showVertexX={false}
          />
        )}
        {isParent
          ? pieces.map((p, idx) => {
              const ring = p.polygon.ring;
              if (!ring || ring.length < 2) return null;
              const pos = getRightInnerCorner(ring, PIECE_NUMBER_PAD_M);
              const num = idx + 1;
              return (
                <React.Fragment key={p.id}>
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={PIECE_NUMBER_RADIUS_M}
                    fill="#fff"
                    stroke={parcelSplitTheme.brandNavy}
                    strokeWidth={0.4}
                  />
                  <Text
                    x={pos.x}
                    y={pos.y}
                    fontSize={PIECE_NUMBER_FONT_M}
                    fontWeight="700"
                    fill={parcelSplitTheme.brandNavy}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {num}
                  </Text>
                </React.Fragment>
              );
            })
          : displayPieces.length === 1 && (() => {
              const ring = displayPieces[0].polygon.ring;
              if (!ring || ring.length < 2) return null;
              const pos = getRightInnerCorner(ring, PIECE_NUMBER_PAD_M);
              return (
                <>
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={PIECE_NUMBER_RADIUS_M}
                    fill="#fff"
                    stroke={parcelSplitTheme.brandNavy}
                    strokeWidth={0.4}
                  />
                  <Text
                    x={pos.x}
                    y={pos.y}
                    fontSize={PIECE_NUMBER_FONT_M}
                    fontWeight="700"
                    fill={parcelSplitTheme.brandNavy}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {pieceNumber}
                  </Text>
                </>
              );
            })()}
        {displayPieces.length > 0 && (
          <LayerLabels pieces={displayPieces} roadPolygon={isParent ? roadPolygon ?? null : null} />
        )}
        {isParent && parentRing.length >= 3 && (
          <LayerParentPolygon ring={parentRing} strokeOnly />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: parcelSplitTheme.canvasBg,
    overflow: "hidden",
  },
  svg: {
    backgroundColor: parcelSplitTheme.canvasBg,
  },
});
