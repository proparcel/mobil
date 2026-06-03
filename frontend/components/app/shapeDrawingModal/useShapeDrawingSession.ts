import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MAP_PIN_VARIANT, type MapPinVariant } from "@/src/maps/drawing/mapPinStyles";
import { DEFAULT_MAP_ARROW_VARIANT, type MapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";
import { shapeNeedsOverlayRelayout } from "@/src/maps/drawing/overlayShapePolicy";
import {
  DEFAULT_MAP_OVERLAY_VIEWPORT,
  type MapOverlayViewport,
} from "@/src/maps/drawing/mapOverlayViewport";
import type { ShapeProperties, ShapeType } from "@/src/maps/drawing/types";
import { createPenFreehandShape } from "@/src/maps/drawing/ShapeDrawingManager";
import { useShapeDrawingHandlers } from "./useShapeDrawingHandlers";
import { useShapeEditGestures, type RotationMode } from "./useShapeEditGestures";

export type ShapeDraftPreview = {
  pointFeatures: Array<{ type: string; geometry: { type: string; coordinates: [number, number] }; properties: Record<string, unknown> }>;
  lineFeature: { type: string; geometry: { type: string; coordinates: [number, number][] }; properties: Record<string, unknown> } | null;
  polygonFeature: { type: string; geometry: { type: string; coordinates: [number, number][][] }; properties: Record<string, unknown> } | null;
} | null;

export type UseShapeDrawingSessionOptions = {
  mapRef?: React.RefObject<any>;
  initialShapes?: ShapeProperties[];
  defaultOutlineColor?: string;
  defaultFillColor?: string;
  defaultOutlineWidth?: number;
  /** Ölçüm vb. aktifken şekil seçimini engelle */
  isShapeTapBlocked?: () => boolean;
  /** 3D editör: model/ölçüm seçimini temizle */
  onBeforeShapeSelect?: (shapeId: string) => void;
  /** Edit jestleri devre dışı (captureMode vb.) */
  blockEditGestures?: () => boolean;
  /** Kalem stroke bitince modu kapat (eski ana harita davranışı: false = 3D gibi mod açık kalır) */
  closeModeAfterPenCommit?: boolean;
  enableEditGestures?: boolean;
};

export function useShapeDrawingSession(options: UseShapeDrawingSessionOptions = {}) {
  const {
    mapRef,
    initialShapes = [],
    defaultOutlineColor = "#2563eb",
    defaultFillColor = "#3b82f6",
    defaultOutlineWidth = 4,
    isShapeTapBlocked,
    onBeforeShapeSelect,
    blockEditGestures,
    closeModeAfterPenCommit = false,
    enableEditGestures = Boolean(mapRef),
  } = options;

  const [shapes, setShapes] = useState<ShapeProperties[]>(initialShapes);
  const [shapeDrawingMode, setShapeDrawingMode] = useState<ShapeType | null>(null);
  const [shapeDrawingPoints, setShapeDrawingPoints] = useState<[number, number][]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapeEditPanelVisible, setShapeEditPanelVisible] = useState(false);
  const [shapeEditPanelMinimized, setShapeEditPanelMinimized] = useState(false);
  const [textBoxLayoutTick, setTextBoxLayoutTick] = useState(0);
  const [mapOverlayViewport, setMapOverlayViewport] = useState<MapOverlayViewport>(
    DEFAULT_MAP_OVERLAY_VIEWPORT
  );
  const [textBoxEditVisible, setTextBoxEditVisible] = useState(false);
  const [textBoxEditShapeId, setTextBoxEditShapeId] = useState<string | null>(null);
  const [textBoxEditInitialText, setTextBoxEditInitialText] = useState("");
  const [drawOutlineColor, setDrawOutlineColor] = useState(defaultOutlineColor);
  const [drawFillColor, setDrawFillColor] = useState(defaultFillColor);
  const [drawOutlineWidth, setDrawOutlineWidth] = useState(defaultOutlineWidth);
  const [drawPinVariant, setDrawPinVariant] = useState<MapPinVariant>(DEFAULT_MAP_PIN_VARIANT);
  const [drawArrowVariant, setDrawArrowVariant] = useState<MapArrowVariant>(DEFAULT_MAP_ARROW_VARIANT);
  const [drawSurface, setDrawSurface] = useState<"map" | "screen">("map");
  const [resizeMode, setResizeMode] = useState<{ shapeId: string } | null>(null);
  const [moveMode, setMoveMode] = useState<{ shapeId: string; lastTouchPos: [number, number] } | null>(null);
  const [rotationMode, setRotationMode] = useState<RotationMode>(null);

  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const overlayRelayoutPendingRef = useRef(false);

  const bumpTextBoxLayout = useCallback(() => {
    setTextBoxLayoutTick((t) => t + 1);
  }, []);

  /** Kamera hareketi — rAF ile tek karede bir projeksiyon (sonsuz setState döngüsünü önler). */
  const bumpTextBoxLayoutOnCamera = useCallback(() => {
    if (!shapeNeedsOverlayRelayout(shapesRef.current)) return;
    if (overlayRelayoutPendingRef.current) return;
    overlayRelayoutPendingRef.current = true;
    requestAnimationFrame(() => {
      overlayRelayoutPendingRef.current = false;
      setTextBoxLayoutTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (shapeNeedsOverlayRelayout(shapes)) bumpTextBoxLayout();
  }, [shapes, bumpTextBoxLayout]);

  const drawOptionsMemo = useMemo(
    () => ({
      outlineColor: drawOutlineColor,
      fillColor: drawFillColor,
      outlineWidth: drawOutlineWidth,
      fillOpacity: 0.45 as const,
      pinVariant: drawPinVariant,
      arrowVariant: drawArrowVariant,
    }),
    [drawOutlineColor, drawFillColor, drawOutlineWidth, drawPinVariant, drawArrowVariant]
  );

  const shapeTapDedupeRef = useRef<{ id: string; at: number } | null>(null);
  const suppressShapeTapUntilRef = useRef(0);
  const lastInstantPlacedShapeIdRef = useRef<string | null>(null);

  const suppressShapeTapBriefly = useCallback((ms = 1200) => {
    suppressShapeTapUntilRef.current = Date.now() + ms;
  }, []);

  const clearShapeSelection = useCallback(() => {
    setSelectedShapeId(null);
    setShapeEditPanelVisible(false);
    setShapeEditPanelMinimized(true);
    setResizeMode(null);
    setRotationMode(null);
    setMoveMode(null);
  }, []);

  const onInstantShapePlaced = useCallback(
    (shapeId: string) => {
      lastInstantPlacedShapeIdRef.current = shapeId;
      suppressShapeTapBriefly(450);
      clearShapeSelection();
    },
    [clearShapeSelection, suppressShapeTapBriefly]
  );

  useEffect(() => {
    if (!selectedShapeId) return;
    const selected = shapes.find((s) => s.id === selectedShapeId);
    if (!selected) clearShapeSelection();
  }, [selectedShapeId, shapes, clearShapeSelection]);

  const { handleShapeDrawingPress, openTextBoxEditor, finalizePolygonOrLine } = useShapeDrawingHandlers({
    shapeDrawingMode,
    shapeDrawingPoints,
    setShapeDrawingPoints,
    setShapeDrawingMode,
    shapes,
    setShapes,
    setTextBoxEditVisible,
    setTextBoxEditShapeId,
    setTextBoxEditInitialText,
    drawOptions: drawOptionsMemo,
    onAfterInstantPlaced: onInstantShapePlaced,
  });

  const handleDeleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) return;
    setShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
    clearShapeSelection();
  }, [selectedShapeId, clearShapeSelection]);

  const handleShapeTap = useCallback(
    (shapeId: string) => {
      if (isShapeTapBlocked?.()) return;

      const tapped = shapes.find((s) => s.id === shapeId);
      if (!tapped) return;

      if (
        lastInstantPlacedShapeIdRef.current === shapeId &&
        Date.now() < suppressShapeTapUntilRef.current
      ) {
        return;
      }

      const now = Date.now();
      if (shapeTapDedupeRef.current?.id === shapeId && now - shapeTapDedupeRef.current.at < 400) {
        return;
      }
      shapeTapDedupeRef.current = { id: shapeId, at: now };

      if (resizeMode || rotationMode) {
        setResizeMode(null);
        setRotationMode(null);
        return;
      }

      if (selectedShapeId === shapeId) {
        clearShapeSelection();
        return;
      }

      onBeforeShapeSelect?.(shapeId);
      setSelectedShapeId(shapeId);
      setResizeMode(null);
      setRotationMode(null);
      setMoveMode(null);
      setShapeEditPanelVisible(true);
      setShapeEditPanelMinimized(false);
    },
    [isShapeTapBlocked, shapes, resizeMode, rotationMode, clearShapeSelection, selectedShapeId, onBeforeShapeSelect]
  );

  const handleFinishActiveDrawing = useCallback(() => {
    const mode = shapeDrawingMode;
    if (mode === "polygon") {
      if (shapeDrawingPoints.length >= 3) {
        finalizePolygonOrLine("polygon");
      } else {
        setShapeDrawingPoints([]);
      }
    } else if (mode === "line") {
      if (shapeDrawingPoints.length >= 2) {
        finalizePolygonOrLine("line");
      } else {
        setShapeDrawingPoints([]);
      }
    } else {
      setShapeDrawingPoints([]);
    }
    setShapeDrawingMode(null);
  }, [shapeDrawingMode, shapeDrawingPoints.length, finalizePolygonOrLine]);

  const handleFreehandCommitMap = useCallback(
    (coords: [number, number][]) => {
      const mode = shapeDrawingMode;
      if (mode !== "pen" && mode !== "freehand") return;
      const shape = createPenFreehandShape(
        coords,
        mode,
        { outlineColor: drawOutlineColor, outlineWidth: drawOutlineWidth },
        false
      );
      setShapes((prev) => [...prev, shape]);
      setShapeDrawingPoints([]);
      if (closeModeAfterPenCommit) setShapeDrawingMode(null);
    },
    [shapeDrawingMode, drawOutlineColor, drawOutlineWidth, closeModeAfterPenCommit]
  );

  const handleFreehandCommitScreen = useCallback(
    (norm: [number, number][]) => {
      const mode = shapeDrawingMode;
      if (mode !== "pen" && mode !== "freehand") return;
      const shape = createPenFreehandShape(
        norm,
        mode,
        { outlineColor: drawOutlineColor, outlineWidth: drawOutlineWidth },
        true
      );
      setShapes((prev) => [...prev, shape]);
      setShapeDrawingPoints([]);
      if (closeModeAfterPenCommit) setShapeDrawingMode(null);
    },
    [shapeDrawingMode, drawOutlineColor, drawOutlineWidth, closeModeAfterPenCommit]
  );

  const selectDrawTool = useCallback(
    (next: ShapeType | null) => {
      setShapeDrawingMode(next);
      setShapeDrawingPoints([]);
      clearShapeSelection();
      if (next === "marker" || next === "arrow") {
        setShapeEditPanelVisible(false);
        setSelectedShapeId(null);
      }
    },
    [clearShapeSelection]
  );

  const exitDrawToolMode = useCallback(() => {
    setShapeDrawingMode(null);
    setShapeDrawingPoints([]);
  }, []);

  const clearAllShapes = useCallback(() => {
    setShapes([]);
    setShapeDrawingMode(null);
    setShapeDrawingPoints([]);
    clearShapeSelection();
  }, [clearShapeSelection]);

  const freehandActive = shapeDrawingMode === "pen" || shapeDrawingMode === "freehand";

  const shapeSheetMinimizedDrag = useMemo(
    () =>
      shapeEditPanelVisible &&
      shapeEditPanelMinimized &&
      Boolean(selectedShapeId) &&
      !blockEditGestures?.(),
    [shapeEditPanelVisible, shapeEditPanelMinimized, selectedShapeId, blockEditGestures]
  );

  const editGestures = useShapeEditGestures({
    mapRef: mapRef ?? { current: null },
    shapes,
    setShapes,
    resizeMode,
    setResizeMode,
    rotationMode,
    setRotationMode,
    moveMode,
    setMoveMode,
    sheetMinimizedDragEnabled: enableEditGestures && shapeSheetMinimizedDrag,
    selectedShapeId,
  });

  const shapeDraftPreview = useMemo((): ShapeDraftPreview => {
    if (!shapeDrawingMode || shapeDrawingPoints.length === 0) return null;

    const points = shapeDrawingPoints;
    const pointFeatures = points.map((p, idx) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: { kind: "shapeDraftPoint", idx },
    }));

    const lineFeature =
      (shapeDrawingMode === "line" || shapeDrawingMode === "polygon") && points.length >= 2
        ? {
            type: "Feature",
            geometry: { type: "LineString", coordinates: points },
            properties: { kind: "shapeDraftLine" },
          }
        : null;

    const polygonFeature =
      shapeDrawingMode === "polygon" && points.length >= 3
        ? {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
            properties: { kind: "shapeDraftPolygon" },
          }
        : null;

    return { pointFeatures, lineFeature, polygonFeature };
  }, [shapeDrawingMode, shapeDrawingPoints]);

  const selectedShape = useMemo(
    () => shapes.find((s) => s.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId]
  );

  return {
    shapes,
    setShapes,
    shapeDrawingMode,
    setShapeDrawingMode,
    shapeDrawingPoints,
    setShapeDrawingPoints,
    selectedShapeId,
    setSelectedShapeId,
    selectedShape,
    shapeEditPanelVisible,
    setShapeEditPanelVisible,
    shapeEditPanelMinimized,
    setShapeEditPanelMinimized,
    textBoxLayoutTick,
    bumpTextBoxLayout,
    bumpTextBoxLayoutOnCamera,
    mapOverlayViewport,
    setMapOverlayViewport,
    textBoxEditVisible,
    setTextBoxEditVisible,
    textBoxEditShapeId,
    setTextBoxEditShapeId,
    textBoxEditInitialText,
    setTextBoxEditInitialText,
    drawOutlineColor,
    setDrawOutlineColor,
    drawFillColor,
    setDrawFillColor,
    drawOutlineWidth,
    setDrawOutlineWidth,
    drawPinVariant,
    setDrawPinVariant,
    drawArrowVariant,
    setDrawArrowVariant,
    drawSurface,
    setDrawSurface,
    drawOptionsMemo,
    resizeMode,
    setResizeMode,
    moveMode,
    setMoveMode,
    rotationMode,
    setRotationMode,
    freehandActive,
    shapeDraftPreview,
    shapeSheetMinimizedDrag,
    handleShapeDrawingPress,
    openTextBoxEditor,
    finalizePolygonOrLine,
    handleShapeTap,
    handleFinishActiveDrawing,
    handleFreehandCommitMap,
    handleFreehandCommitScreen,
    handleDeleteSelectedShape,
    clearShapeSelection,
    selectDrawTool,
    exitDrawToolMode,
    clearAllShapes,
    handleHandlePress: editGestures.handleHandlePress,
    handleHandleDrag: editGestures.handleHandleDrag,
    dragPanResponder: editGestures.dragPanResponder,
  };
}

export type ShapeDrawingSession = ReturnType<typeof useShapeDrawingSession>;
