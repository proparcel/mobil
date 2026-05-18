/**
 * 2D Canvas: gesture (pan, pinch, tap) + viewTransform + layer compositing.
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, ClipPath, Polygon as SvgPolygon, G } from "react-native-svg";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import type { Point, PolygonEdge, Piece, LineString, EdgeRoadDraft } from "../../../src/types/parcelSplit";
import { getBbox, ringToWorldPoints } from "../../../src/utils/parcelSplitTransform";
import {
  pickNearestEdge,
  pointInPolygon,
  buildEdges,
  pickNearestRoadSegment,
  pickNearestVertex,
  pickNearestSegmentHandle,
} from "../../../src/utils/parcelSplitEngine";
import { getSegmentNormal } from "../../../src/utils/roadSlideGeometry";
import { computeMergeCandidate } from "../../../src/utils/roadMerge";
import { useViewTransform } from "./useViewTransform";
import { LayerParentPolygon } from "./LayerParentPolygon";
import { LayerEdgeOverlay } from "./LayerEdgeOverlay";
import { LayerSplitLines } from "./LayerSplitLines";
import { LayerPieces } from "./LayerPieces";
import { LayerLabels } from "./LayerLabels";
import { LayerWarnings } from "./LayerWarnings";
import { LayerEdgeMeasurements, type MetreEdgeFeature } from "./LayerEdgeMeasurements";
import { LayerRoadDraft } from "./LayerRoadDraft";
import { LayerRoadPolygon } from "./LayerRoadPolygon";
import { LayerEdgeSlidePreview } from "./LayerEdgeSlidePreview";
import { LayerRoadHandles } from "./LayerRoadHandles";
import { LayerRoadSlidePreview } from "./LayerRoadSlidePreview";
import { LayerParentEdgePick } from "./LayerParentEdgePick";
import { LayerEdgeRoadDraft } from "./LayerEdgeRoadDraft";
import { parcelSplitTheme } from "./theme";

const PADDING = 24;
const TAP_TOLERANCE_PX = 16;
/** true = LayerParentPolygon bypass, doğrudan SvgPolygon ile "çiziyorum mu?" testi (kırmızı stroke). */
const BYPASS_LAYER_TEST = false;

type Props = {
  ring: Point[] | null;
  width: number;
  height: number;
  uiMode: string;
  roadDrawSubMode?: "none" | "vertical" | "horizontal" | "edge" | "freehand";
  edges?: PolygonEdge[];
  selectedRoadEdges?: Set<string>;
  onToggleRoadEdge?: (edgeId: string) => void;
  pieces?: Piece[];
  splitLines?: LineString[];
  selectedPieceId?: string | null;
  onPieceSelect?: (id: string | null) => void;
  fixedCuts?: number[];
  axis?: "x" | "y";
  onHandleDrag?: (handleIndex: number, worldDelta: number) => void;
  onTap?: (world: Point) => void;
  showEdgeMeasurements?: boolean;
  edgeMeasurementsMetre?: MetreEdgeFeature[];
  selectedEdgeId?: string | null;
  onSelectEdge?: (edgeId: string | null) => void;
  onEdgeSlideDrag?: (offsetMeters: number) => void;
  roadDraftPoints?: Point[];
  roadDraftSelectedVertex?: number | null;
  roadPolygon?: Point[] | null;
  onRoadDraftPoint?: (world: Point) => void;
  onRoadDraftVertexSelect?: (index: number | null) => void;
  onRoadDraftVertexMove?: (index: number, dx: number, dy: number) => void;
  roadSelected?: boolean;
  onRoadSelect?: (selected: boolean) => void;
  roadCenterline?: Point[] | null;
  selectedRoadId?: string | null;
  selectedRoadHandle?: import("../../../src/types/parcelSplit").RoadHandleSelection;
  selectedRoadHandleRef?: React.MutableRefObject<import("../../../src/types/parcelSplit").RoadHandleSelection | null>;
  roadSlideReadySV?: import("react-native-reanimated").SharedValue<number>;
  onRoadSelectId?: (id: string | null, defaultSegmentIndex?: number) => void;
  onRoadHandleSelect?: (handle: import("../../../src/types/parcelSplit").RoadHandleSelection) => void;
  onRoadSlideDragSegment?: (offsetMeters: number) => void;
  onRoadSlideDragVertex?: (dx: number, dy: number) => void;
  selectedParentEdgeForRoad?: number | null;
  onSelectParentEdgeForRoad?: (edgeIndex: number | null) => void;
  roadMergePreview?: import("../../../src/utils/roadMerge").RoadMergePreview | null;
  onMergePreviewChange?: (preview: import("../../../src/utils/roadMerge").RoadMergePreview | null) => void;
  edgeRoadDraft?: EdgeRoadDraft | null;
  edgeRoadActiveEnd?: 0 | 1 | null;
  onSelectEdgeRoadEnd?: (endIndex: 0 | 1) => void;
  onEdgeRoadSlide?: (deltaMeters: number) => void;
  onCompleteEdgeRoad?: () => void;
};

export type Canvas2DHandle = {
  fitToView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export const Canvas2D = forwardRef<Canvas2DHandle, Props>(function Canvas2D({
  ring,
  width,
  height,
  uiMode,
  roadDrawSubMode = "none",
  edges = [],
  selectedRoadEdges = new Set(),
  onToggleRoadEdge,
  pieces = [],
  splitLines = [],
  selectedPieceId = null,
  onPieceSelect,
  fixedCuts = [],
  axis = "x",
  onHandleDrag,
  onTap,
  showEdgeMeasurements = false,
  edgeMeasurementsMetre,
  selectedEdgeId = null,
  onSelectEdge,
  onEdgeSlideDrag,
  roadDraftPoints,
  roadDraftSelectedVertex = null,
  roadPolygon,
  onRoadDraftPoint,
  onRoadDraftVertexSelect,
  onRoadDraftVertexMove,
  roadSelected = false,
  onRoadSelect,
  roadCenterline,
  selectedRoadId = null,
  selectedRoadHandle = null,
  selectedRoadHandleRef,
  roadSlideReadySV,
  onRoadSelectId,
  onRoadHandleSelect,
  onRoadSlideDragSegment,
  onRoadSlideDragVertex,
  selectedParentEdgeForRoad = null,
  onSelectParentEdgeForRoad,
  roadMergePreview = null,
  onMergePreviewChange,
  edgeRoadDraft = null,
  edgeRoadActiveEnd = null,
  onSelectEdgeRoadEnd,
  onEdgeRoadSlide,
  onCompleteEdgeRoad,
}, ref) {
  const { viewTransform, fitToView, setViewTransform, zoomIn, zoomOut } =
    useViewTransform(width, height, PADDING);

  const [edgeSlidePreviewOffset, setEdgeSlidePreviewOffset] = useState<number | null>(null);
  const [roadSlidePreviewOffset, setRoadSlidePreviewOffset] = useState<
    { type: "segment"; offset: number } | { type: "vertex"; dx: number; dy: number } | null
  >(null);

  const roadSlideApplyRef = useRef<{
    onSegment?: (offset: number) => void;
    onVertex?: (dx: number, dy: number) => void;
    compute: (tx: number, ty: number) => { type: "segment"; offset: number } | { type: "vertex"; dx: number; dy: number } | null;
  }>({ compute: () => null });
  useEffect(() => {
    const handleRef = selectedRoadHandleRef;
    const handle = selectedRoadHandle;
    roadSlideApplyRef.current = {
      onSegment: onRoadSlideDragSegment,
      onVertex: onRoadSlideDragVertex,
      compute: (tx: number, ty: number) => {
        const h = handleRef?.current ?? handle;
        if (!roadCenterline || !h) return null;
        const scale = viewTransform.scale;
        const worldDx = tx / scale;
        const worldDy = ty / scale;
        if (h.type === "segment") {
          const n = getSegmentNormal(roadCenterline, h.index);
          if (!n) return null;
          return { type: "segment" as const, offset: worldDx * n.x + worldDy * n.y };
        }
        return { type: "vertex" as const, dx: worldDx, dy: worldDy };
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedRoadHandleRef is stable, compute reads .current at call time
  }, [roadCenterline, selectedRoadHandle, viewTransform.scale, onRoadSlideDragSegment, onRoadSlideDragVertex]);

  /** Pan/pinch sıçramasını azaltmak: en fazla frame başına bir setState. */
  const pendingTransformRef = useRef<{ scale: number; translateX: number; translateY: number } | null>(null);
  const rafScheduledRef = useRef(false);
  const throttledSetViewTransform = useCallback(
    (t: { scale: number; translateX: number; translateY: number }) => {
      pendingTransformRef.current = t;
      if (!rafScheduledRef.current) {
        rafScheduledRef.current = true;
        requestAnimationFrame(() => {
          const next = pendingTransformRef.current;
          pendingTransformRef.current = null;
          rafScheduledRef.current = false;
          if (next) setViewTransform(next);
        });
      }
    },
    [setViewTransform]
  );

  useEffect(() => {
    if (!selectedEdgeId || uiMode !== "edge_slide") setEdgeSlidePreviewOffset(null);
  }, [selectedEdgeId, uiMode]);

  useEffect(() => {
    if (uiMode !== "road_slide" || !selectedRoadId || !selectedRoadHandle) setRoadSlidePreviewOffset(null);
  }, [uiMode, selectedRoadId, selectedRoadHandle]);

  const viewBoxString = React.useMemo(() => {
    const s = viewTransform.scale;
    const tx = viewTransform.translateX;
    const ty = viewTransform.translateY;
    const vbMinX = -tx / s;
    const vbMinY = -ty / s;
    const vbW = width / s;
    const vbH = height / s;
    return `${vbMinX} ${vbMinY} ${vbW} ${vbH}`;
  }, [viewTransform.scale, viewTransform.translateX, viewTransform.translateY, width, height]);

  const fitToViewRing = useCallback(() => {
    if (ring && ring.length >= 3) {
      const bbox = getBbox(ring);
      fitToView(bbox);
    }
  }, [ring, fitToView]);

  /** İlk açılışta poligon viewBox içinde görünsün; aksi halde (0,0)-(w,h) viewBox'ta lon/lat nokta gibi kalır. */
  const didInitialFit = useRef(false);
  const clipId = useRef(`parcelClip_${Math.random().toString(16).slice(2)}`).current;
  useEffect(() => {
    if (ring && ring.length >= 3 && width > 0 && height > 0 && !didInitialFit.current) {
      didInitialFit.current = true;
      const bbox = getBbox(ring);
      fitToView(bbox);
    }
  }, [ring, width, height, fitToView]);

  useImperativeHandle(
    ref,
    () => ({ fitToView: fitToViewRing, zoomIn, zoomOut }),
    [fitToViewRing, zoomIn, zoomOut]
  );

  const baseScale = useSharedValue(1);
  const baseTx = useSharedValue(0);
  const baseTy = useSharedValue(0);
  const dragHandleIndex = useSharedValue(-1);
  const pinchBaseScale = useSharedValue(1);
  const pinchBaseTx = useSharedValue(0);
  const pinchBaseTy = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const roadSlideDragActive = useSharedValue(0);
  const drawRoadDragActive = useSharedValue(0);

  const drawRoadDraftApplyRef = useRef<{
    index: number;
    scale: number;
    onMove: (index: number, dx: number, dy: number) => void;
  }>({ index: -1, scale: 1, onMove: () => {} });
  useEffect(() => {
    drawRoadDraftApplyRef.current = {
      index: roadDraftSelectedVertex ?? -1,
      scale: viewTransform.scale,
      onMove: onRoadDraftVertexMove ?? (() => {}),
    };
  }, [roadDraftSelectedVertex, viewTransform.scale, onRoadDraftVertexMove]);

  const handlePanStart = useCallback(
    (sx: number, sy: number) => {
      baseScale.value = viewTransform.scale;
      baseTx.value = viewTransform.translateX;
      baseTy.value = viewTransform.translateY;
      dragHandleIndex.value = -1;
      roadSlideDragActive.value = 0;
      drawRoadDragActive.value = 0;
    },
    [viewTransform.scale, viewTransform.translateX, viewTransform.translateY, baseScale, baseTx, baseTy, dragHandleIndex, roadSlideDragActive, drawRoadDragActive]
  );

  const handlePanEnd = useCallback(
    (hi: number, translationX: number, translationY: number, scale: number) => {
      if (hi < 0 || !onHandleDrag || !fixedCuts.length) return;
      const worldDelta = axis === "x" ? translationX / scale : translationY / scale;
      onHandleDrag(hi, worldDelta);
    },
    [onHandleDrag, fixedCuts.length, axis]
  );

  const handlePinchStart = useCallback((fx: number, fy: number) => {
    pinchBaseScale.value = viewTransform.scale;
    pinchBaseTx.value = viewTransform.translateX;
    pinchBaseTy.value = viewTransform.translateY;
    pinchFocalX.value = fx;
    pinchFocalY.value = fy;
  }, [viewTransform.scale, viewTransform.translateX, viewTransform.translateY, pinchBaseScale, pinchBaseTx, pinchBaseTy, pinchFocalX, pinchFocalY]);

  const handleTapEnd = useCallback(
    (sx: number, sy: number) => {
      const scale = viewTransform.scale;
      const tx = viewTransform.translateX;
      const ty = viewTransform.translateY;
      const pw = { x: (sx - tx) / scale, y: (sy - ty) / scale };
      // Yol dışında bir yere tıklanınca yol seçimini kaldır (tüm modlarda)
      if (roadPolygon && roadPolygon.length >= 3 && roadSelected && onRoadSelect && !pointInPolygon(pw, roadPolygon)) {
        onRoadSelect(false);
      }
      if (uiMode === "draw_road") {
        if (roadDrawSubMode === "edge" && edgeRoadDraft && onSelectEdgeRoadEnd && onCompleteEdgeRoad) {
          const tolW = TAP_TOLERANCE_PX / scale;
          const endTol = Math.max(3, tolW * 4);
          const [ep0, ep1] = edgeRoadDraft.currentLine;
          const d0 = Math.hypot(pw.x - ep0.x, pw.y - ep0.y);
          const d1 = Math.hypot(pw.x - ep1.x, pw.y - ep1.y);
          if (d0 < endTol || d1 < endTol) {
            onSelectEdgeRoadEnd(d0 < d1 ? 0 : 1);
            return;
          }
          onCompleteEdgeRoad();
          return;
        }
        if (roadDrawSubMode === "edge" && edges.length && onSelectParentEdgeForRoad) {
          const tolW = TAP_TOLERANCE_PX / scale;
          const picked = pickNearestEdge(pw, edges, Math.max(tolW * 2, 8));
          if (picked != null) {
            const idx = parseInt(picked, 10);
            onSelectParentEdgeForRoad(Number.isNaN(idx) ? null : idx);
          }
          return;
        }
        if (roadDrawSubMode === "freehand") {
          const tolW = TAP_TOLERANCE_PX / scale;
          const vertexTol = Math.max(tolW * 3, 1.5);
          if (roadDraftPoints && roadDraftPoints.length >= 1 && onRoadDraftVertexSelect) {
            const vIdx = pickNearestVertex(pw, roadDraftPoints, vertexTol);
            if (vIdx != null) {
              onRoadDraftVertexSelect(roadDraftSelectedVertex === vIdx ? null : vIdx);
              return;
            }
          }
          if (onRoadDraftPoint) {
            onRoadDraftPoint(pw);
            return;
          }
        }
      }
      if (uiMode === "road_slide" && roadCenterline && roadCenterline.length >= 2) {
        const tolW = TAP_TOLERANCE_PX / scale;
        const roadTol = Math.max(tolW * 4, 5);
        const polygonTapTol = Math.max(tolW * 6, 20);
        const middleSegment = Math.floor((roadCenterline.length - 1) / 2);
        if (!selectedRoadId && onRoadSelectId) {
          if (roadPolygon && roadPolygon.length >= 3 && pointInPolygon(pw, roadPolygon)) {
            const seg = pickNearestRoadSegment(pw, roadCenterline, polygonTapTol);
            onRoadSelectId("road-0", seg ?? middleSegment);
            return;
          }
          const seg = pickNearestRoadSegment(pw, roadCenterline, roadTol);
          if (seg != null) {
            onRoadSelectId("road-0", seg);
            return;
          }
          onRoadSelectId(null);
          return;
        }
        if (selectedRoadId && onRoadHandleSelect) {
          const vIdx = pickNearestVertex(pw, roadCenterline, tolW);
          if (vIdx != null) {
            onRoadHandleSelect({ type: "vertex", index: vIdx });
            return;
          }
          const sIdx = pickNearestSegmentHandle(pw, roadCenterline, tolW * 2);
          if (sIdx != null) {
            onRoadHandleSelect({ type: "segment", index: sIdx });
            return;
          }
          onRoadHandleSelect(null);
          return;
        }
      }
      if (uiMode === "pan_zoom" || uiMode === "select_piece") {
        if (roadPolygon && roadPolygon.length >= 3 && onRoadSelect) {
          if (pointInPolygon(pw, roadPolygon)) {
            onRoadSelect(true);
            return;
          }
          if (roadSelected) {
            onRoadSelect(false);
          }
        }
      }
      if (uiMode === "select_road_edges" && edges.length && onToggleRoadEdge) {
        const tolW = TAP_TOLERANCE_PX / scale;
        const picked = pickNearestEdge(pw, edges, tolW);
        if (picked) onToggleRoadEdge(picked);
        return;
      }
      if (uiMode === "edge_slide") {
        if (!selectedPieceId && pieces.length && onPieceSelect) {
          for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            if (pointInPolygon(pw, p.polygon.ring)) {
              onPieceSelect(selectedPieceId === p.id ? null : p.id);
              return;
            }
          }
          onPieceSelect(null);
          return;
        }
        if (selectedPieceId && onSelectEdge) {
          const piece = pieces.find((p) => p.id === selectedPieceId);
          if (piece) {
            const pieceEdges = buildEdges(piece.polygon.ring);
            const tolW = TAP_TOLERANCE_PX / scale;
            const picked = pickNearestEdge(pw, pieceEdges, tolW);
            onSelectEdge(picked);
            return;
          }
          onSelectEdge(null);
          return;
        }
      }
      if (uiMode === "select_piece" && pieces.length && onPieceSelect) {
        if (roadSelected && onRoadSelect) onRoadSelect(false);
        for (let i = pieces.length - 1; i >= 0; i--) {
          const p = pieces[i];
          if (pointInPolygon(pw, p.polygon.ring)) {
            onPieceSelect(selectedPieceId === p.id ? null : p.id);
            return;
          }
        }
        onPieceSelect(null);
        return;
      }
      onTap?.(pw);
    },
    [
      uiMode,
      roadDrawSubMode,
      edges,
      onSelectParentEdgeForRoad,
      roadDraftPoints,
      roadDraftSelectedVertex,
      onRoadDraftVertexSelect,
      onRoadDraftPoint,
      roadCenterline,
      selectedRoadId,
      onRoadSelectId,
      onRoadHandleSelect,
      roadPolygon,
      roadSelected,
      onRoadSelect,
      edges.length,
      onToggleRoadEdge,
      pieces,
      onPieceSelect,
      selectedPieceId,
      onSelectEdge,
      onTap,
      viewTransform.scale,
      viewTransform.translateX,
      viewTransform.translateY,
    ]
  );

  const computeEdgeSlideProjected = useCallback(
    (translationX: number, translationY: number): number | null => {
      if (!selectedEdgeId || !selectedPieceId) return null;
      const piece = pieces.find((p) => p.id === selectedPieceId);
      if (!piece) return null;
      const ring = piece.polygon.ring;
      const edgeIndex = parseInt(selectedEdgeId, 10);
      const nA = Math.max(0, ring.length - 1);
      if (Number.isNaN(edgeIndex) || edgeIndex < 0 || edgeIndex >= nA) return null;
      const a = ring[edgeIndex];
      const b = ring[(edgeIndex + 1) % ring.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const scale = viewTransform.scale;
      const worldDx = translationX / scale;
      const worldDy = translationY / scale;
      return worldDx * nx + worldDy * ny;
    },
    [selectedEdgeId, selectedPieceId, pieces, viewTransform.scale]
  );

  const handleEdgeSlidePreviewUpdate = useCallback(
    (translationX: number, translationY: number) => {
      if (uiMode !== "edge_slide") return;
      const projected = computeEdgeSlideProjected(translationX, translationY);
      setEdgeSlidePreviewOffset(projected != null ? projected : null);
    },
    [uiMode, computeEdgeSlideProjected]
  );

  const handlePanEndEdgeSlide = useCallback(
    (translationX: number, translationY: number) => {
      if (uiMode !== "edge_slide" || !selectedEdgeId || !selectedPieceId || !onEdgeSlideDrag) {
        setEdgeSlidePreviewOffset(null);
        return;
      }
      const projected = computeEdgeSlideProjected(translationX, translationY);
      setEdgeSlidePreviewOffset(null);
      if (projected != null) onEdgeSlideDrag(projected);
    },
    [uiMode, selectedEdgeId, selectedPieceId, onEdgeSlideDrag, computeEdgeSlideProjected]
  );

  const computeRoadSlideProjected = useCallback(
    (translationX: number, translationY: number) => {
      const h = selectedRoadHandleRef?.current ?? selectedRoadHandle;
      if (!roadCenterline || !h) return null;
      const scale = viewTransform.scale;
      const worldDx = translationX / scale;
      const worldDy = translationY / scale;
      if (h.type === "segment") {
        const n = getSegmentNormal(roadCenterline, h.index);
        if (!n) return null;
        return { type: "segment" as const, offset: worldDx * n.x + worldDy * n.y };
      }
      return { type: "vertex" as const, dx: worldDx, dy: worldDy };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref read at call time
    [roadCenterline, selectedRoadHandle, viewTransform.scale]
  );

  const handleRoadSlidePreviewUpdate = useCallback(
    (translationX: number, translationY: number) => {
      if (uiMode !== "road_slide") return;
      const proj = computeRoadSlideProjected(translationX, translationY);
      setRoadSlidePreviewOffset(proj);
    },
    [uiMode, computeRoadSlideProjected]
  );

  const handlePanEndRoadSlide = useCallback((translationX: number, translationY: number) => {
    setRoadSlidePreviewOffset(null);
    const ref = roadSlideApplyRef.current;
    const proj = ref.compute(translationX, translationY);
    if (!proj) return;
    if (proj.type === "segment" && ref.onSegment) ref.onSegment(proj.offset);
    if (proj.type === "vertex" && ref.onVertex) ref.onVertex(proj.dx, proj.dy);
  }, []);

  const [roadDraftPreviewOffset, setRoadDraftPreviewOffset] = useState<{
    index: number;
    dx: number;
    dy: number;
  } | null>(null);
  useEffect(() => {
    if (uiMode !== "draw_road" || roadDraftSelectedVertex == null)
      setRoadDraftPreviewOffset(null);
  }, [uiMode, roadDraftSelectedVertex]);

  useEffect(() => {
    if (
      !onMergePreviewChange ||
      uiMode !== "draw_road" ||
      roadDrawSubMode !== "freehand" ||
      !roadDraftPoints ||
      roadDraftPoints.length < 2 ||
      !ring ||
      ring.length < 3
    ) {
      onMergePreviewChange?.(null);
      return;
    }
    const effectiveDraft = roadDraftPoints.map((p, i) => {
      if (roadDraftPreviewOffset && roadDraftPreviewOffset.index === i) {
        return {
          x: p.x + roadDraftPreviewOffset.dx,
          y: p.y + roadDraftPreviewOffset.dy,
        };
      }
      return p;
    });
    const tolMeters = Math.max(1, Math.min(3, (TAP_TOLERANCE_PX / viewTransform.scale) * 2));
    const preview = computeMergeCandidate(
      effectiveDraft,
      roadCenterline ?? null,
      ring,
      tolMeters
    );
    onMergePreviewChange(preview);
  }, [
    onMergePreviewChange,
    uiMode,
    roadDrawSubMode,
    roadDraftPoints,
    roadDraftPreviewOffset,
    ring,
    roadCenterline,
    viewTransform.scale,
  ]);

  useEffect(() => {
    if (
      !onMergePreviewChange ||
      !edgeRoadDraft ||
      uiMode !== "draw_road" ||
      !ring ||
      ring.length < 3
    ) {
      return;
    }
    const [b1, b2] = edgeRoadDraft.baseLine;
    const [c1, c2] = edgeRoadDraft.currentLine;
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const baseLen = Math.hypot(dx, dy) || 1;
    const tx = dx / baseLen;
    const ty = dy / baseLen;
    const delta = edgeRoadSlidePreviewDelta;
    let effectiveP1 = c1;
    let effectiveP2 = c2;
    if (edgeRoadActiveEnd === 0) {
      effectiveP1 = { x: c1.x - tx * delta, y: c1.y - ty * delta };
      effectiveP2 = c2;
    } else if (edgeRoadActiveEnd === 1) {
      effectiveP1 = c1;
      effectiveP2 = { x: c2.x + tx * delta, y: c2.y + ty * delta };
    }
    const preview = computeMergeCandidate(
      [effectiveP1, effectiveP2],
      roadCenterline ?? null,
      ring
    );
    onMergePreviewChange(preview);
  }, [
    onMergePreviewChange,
    edgeRoadDraft,
    edgeRoadSlidePreviewDelta,
    edgeRoadActiveEnd,
    uiMode,
    ring,
    roadCenterline,
  ]);

  const handlePanEndDrawRoadVertex = useCallback((translationX: number, translationY: number) => {
    setRoadDraftPreviewOffset(null);
    const ref = drawRoadDraftApplyRef.current;
    if (ref.index < 0 || !ref.onMove) return;
    const worldDx = translationX / ref.scale;
    const worldDy = translationY / ref.scale;
    ref.onMove(ref.index, worldDx, worldDy);
  }, []);

  const handleDrawRoadPreviewUpdate = useCallback(
    (translationX: number, translationY: number) => {
      if (uiMode !== "draw_road" || roadDraftSelectedVertex == null) return;
      const scale = viewTransform.scale;
      setRoadDraftPreviewOffset({
        index: roadDraftSelectedVertex,
        dx: translationX / scale,
        dy: translationY / scale,
      });
    },
    [uiMode, roadDraftSelectedVertex, viewTransform.scale]
  );

  const [edgeRoadSlidePreviewDelta, setEdgeRoadSlidePreviewDelta] = useState<number>(0);

  const handleEdgeRoadSlidePreviewUpdate = useCallback(
    (translationX: number, translationY: number) => {
      if (!edgeRoadDraft) return;
      const scale = viewTransform.scale;
      const [p1, p2] = edgeRoadDraft.baseLine;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      const worldDx = translationX / scale;
      const worldDy = translationY / scale;
      const deltaMeters = worldDx * tx + worldDy * ty;
      setEdgeRoadSlidePreviewDelta(deltaMeters);
    },
    [edgeRoadDraft, viewTransform.scale]
  );

  const handlePanEndEdgeRoadSlide = useCallback(
    (translationX: number, translationY: number) => {
      if (!edgeRoadDraft || !onEdgeRoadSlide) return;
      const scale = viewTransform.scale;
      const [p1, p2] = edgeRoadDraft.baseLine;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      const worldDx = translationX / scale;
      const worldDy = translationY / scale;
      const deltaMeters = worldDx * tx + worldDy * ty;
      onEdgeRoadSlide(deltaMeters);
      setEdgeRoadSlidePreviewDelta(0);
    },
    [edgeRoadDraft, viewTransform.scale, onEdgeRoadSlide]
  );

  const pan = Gesture.Pan()
    .minDistance(8)
    .maxPointers(1)
    .onStart((e) => {
      runOnJS(handlePanStart)(e.x, e.y);
    })
    .onUpdate((e) => {
      if (dragHandleIndex.value >= 0) return;
      if (uiMode === "edge_slide" && selectedEdgeId != null) {
        runOnJS(handleEdgeSlidePreviewUpdate)(e.translationX, e.translationY);
      } else if (uiMode === "draw_road" && edgeRoadDraft != null && edgeRoadActiveEnd != null) {
        runOnJS(handleEdgeRoadSlidePreviewUpdate)(e.translationX, e.translationY);
      } else if (uiMode === "road_slide" && (roadSlideReadySV?.value === 1 || selectedRoadId != null)) {
        roadSlideDragActive.value = 1;
        runOnJS(handleRoadSlidePreviewUpdate)(e.translationX, e.translationY);
      } else if (uiMode === "draw_road" && roadDraftSelectedVertex != null) {
        drawRoadDragActive.value = 1;
        runOnJS(handleDrawRoadPreviewUpdate)(e.translationX, e.translationY);
      } else {
        roadSlideDragActive.value = 0;
        drawRoadDragActive.value = 0;
        runOnJS(throttledSetViewTransform)({
          scale: baseScale.value,
          translateX: baseTx.value + e.translationX,
          translateY: baseTy.value + e.translationY,
        });
      }
    })
    .onEnd((e) => {
      if (dragHandleIndex.value >= 0) {
        runOnJS(handlePanEnd)(dragHandleIndex.value, e.translationX, e.translationY, baseScale.value);
      } else if (uiMode === "draw_road" && edgeRoadDraft != null && edgeRoadActiveEnd != null) {
        runOnJS(handlePanEndEdgeRoadSlide)(e.translationX, e.translationY);
      } else if (roadSlideDragActive.value === 1) {
        roadSlideDragActive.value = 0;
        runOnJS(handlePanEndRoadSlide)(e.translationX, e.translationY);
      } else if (drawRoadDragActive.value === 1) {
        drawRoadDragActive.value = 0;
        runOnJS(handlePanEndDrawRoadVertex)(e.translationX, e.translationY);
      } else if (uiMode === "edge_slide" && selectedEdgeId != null) {
        runOnJS(handlePanEndEdgeSlide)(e.translationX, e.translationY);
      }
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      runOnJS(handlePinchStart)(e.focalX, e.focalY);
    })
    .onUpdate((e) => {
      const bScale = pinchBaseScale.value;
      const bTx = pinchBaseTx.value;
      const bTy = pinchBaseTy.value;
      const fx = pinchFocalX.value;
      const fy = pinchFocalY.value;
      const wx = (fx - bTx) / bScale;
      const wy = (fy - bTy) / bScale;
      const newScale = Math.min(1e6, Math.max(0.05, bScale * e.scale));
      const tx = fx - wx * newScale;
      const ty = fy - wy * newScale;
      runOnJS(throttledSetViewTransform)({ scale: newScale, translateX: tx, translateY: ty });
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      runOnJS(handleTapEnd)(e.x, e.y);
    });

  const panAndPinch = Gesture.Race(pan, pinch);
  const composed = Gesture.Exclusive(tap, panAndPinch);

  const hasValidRing = ring != null && ring.length >= 3;

  /** Guruplama/çakışma çözümü yok: etiketler backend/edgeFeaturesToMetre konumlarıyla doğrudan kullanılır. */
  const placedEdgeMeasurements = showEdgeMeasurements && edgeMeasurementsMetre?.length ? edgeMeasurementsMetre : undefined;

  if (__DEV__ && !hasValidRing) {
    console.log("[ParcelSplit] Canvas2D placeholder (ring yok)", {
      hasRing: !!ring,
      ringLength: ring?.length ?? 0,
    });
  }
  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.canvas, { width, height }]}>
        {hasValidRing ? (
          <Svg width={width} height={height} style={styles.svg} viewBox={viewBoxString}>
            {BYPASS_LAYER_TEST ? (
              <SvgPolygon
                points={ringToWorldPoints(ring)}
                fill="rgba(0,0,0,0.06)"
                stroke="red"
                strokeWidth={2}
              />
            ) : (
              <>
                <Defs>
                  <ClipPath id={clipId}>
                    <SvgPolygon points={ringToWorldPoints(ring)} />
                  </ClipPath>
                </Defs>
                <LayerParentPolygon ring={ring} />
                <G clipPath={`url(#${clipId})`}>
                  {edges.length > 0 && !(uiMode === "draw_road" && roadDrawSubMode === "edge") && (
                    <LayerEdgeOverlay edges={edges} selectedRoadEdges={selectedRoadEdges} />
                  )}
                  {splitLines.length > 0 && (
                    <LayerSplitLines
                      splitLines={splitLines}
                      showHandles={false}
                    />
                  )}
                  {roadPolygon && roadPolygon.length >= 3 && (
                    <LayerRoadPolygon ring={roadPolygon} selected={roadSelected} />
                  )}
                  {pieces.length > 0 && (
                    <>
                      <LayerPieces
                      pieces={pieces}
                      selectedPieceId={selectedPieceId}
                      selectedEdgeId={selectedEdgeId}
                    />
                      <LayerLabels pieces={pieces} roadPolygon={roadPolygon ?? null} />
                      <LayerWarnings pieces={pieces} />
                    </>
                  )}
                </G>
                {/* Yol taslağı clip dışında: arazi dışına tıklanan noktalar da marker olarak görünsün; Tamamla'da arazi içi kesilir */}
                {roadDraftPoints && roadDraftPoints.length > 0 && (
                  <LayerRoadDraft
                    points={roadDraftPoints}
                    selectedVertexIndex={roadDraftSelectedVertex}
                    previewOffset={roadDraftPreviewOffset}
                    ring={ring}
                    roadMergePreview={roadMergePreview ?? undefined}
                  />
                )}
                {/* Kenar ölçümü etiketleri clip dışında: poligon dışına taşan kısımlar kesilmesin */}
                {showEdgeMeasurements && placedEdgeMeasurements && placedEdgeMeasurements.length > 0 && (
                  <LayerEdgeMeasurements features={placedEdgeMeasurements} ring={ring} />
                )}
                {edgeSlidePreviewOffset != null &&
                  selectedPieceId &&
                  selectedEdgeId &&
                  (() => {
                    const piece = pieces.find((p) => p.id === selectedPieceId);
                    if (!piece) return null;
                    const ring = piece.polygon.ring;
                    const edgeIndex = parseInt(selectedEdgeId, 10);
                    const nA = Math.max(0, ring.length - 1);
                    if (edgeIndex < 0 || edgeIndex >= nA) return null;
                    const a = ring[edgeIndex];
                    const b = ring[(edgeIndex + 1) % ring.length];
                    return (
                      <LayerEdgeSlidePreview
                        a={a}
                        b={b}
                        offsetMeters={edgeSlidePreviewOffset}
                      />
                    );
                  })()}
                {uiMode === "road_slide" &&
                  selectedRoadId &&
                  roadCenterline &&
                  roadCenterline.length >= 2 && (
                    <LayerRoadHandles points={roadCenterline} selectedHandle={selectedRoadHandle} />
                  )}
                {roadSlidePreviewOffset != null &&
                  roadCenterline &&
                  roadCenterline.length >= 2 &&
                  selectedRoadHandle && (
                    <>
                      {roadSlidePreviewOffset.type === "segment" ? (
                        <LayerRoadSlidePreview
                          type="segment"
                          points={roadCenterline}
                          segmentIndex={selectedRoadHandle.index}
                          offsetMeters={roadSlidePreviewOffset.offset}
                        />
                      ) : (
                        <LayerRoadSlidePreview
                          type="vertex"
                          points={roadCenterline}
                          vertexIndex={selectedRoadHandle.index}
                          dx={roadSlidePreviewOffset.dx}
                          dy={roadSlidePreviewOffset.dy}
                        />
                      )}
                    </>
                  )}
                {uiMode === "draw_road" && roadDrawSubMode === "edge" && edges.length > 0 && (
                  <LayerParentEdgePick
                    edges={edges}
                    selectedEdgeIndex={selectedParentEdgeForRoad}
                  />
                )}
                {edgeRoadDraft && (
                  <LayerEdgeRoadDraft
                    baseLine={edgeRoadDraft.baseLine}
                    currentLine={edgeRoadDraft.currentLine}
                    previewDelta={edgeRoadSlidePreviewDelta}
                    roadMergePreview={roadMergePreview ?? undefined}
                    activeEnd={edgeRoadActiveEnd ?? undefined}
                  />
                )}
                <LayerParentPolygon ring={ring} strokeOnly />
              </>
            )}
          </Svg>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: parcelSplitTheme.canvasBg,
    overflow: "hidden",
  },
  svg: {
    backgroundColor: parcelSplitTheme.canvasBg,
  },
  placeholder: {
    flex: 1,
    backgroundColor: parcelSplitTheme.canvasBg,
  },
});
