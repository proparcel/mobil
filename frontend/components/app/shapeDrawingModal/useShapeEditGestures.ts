import { useCallback, useMemo, useRef } from "react";
import { PanResponder } from "react-native";
import type { ShapeProperties } from "@/src/maps/drawing/types";
import {
  getShapeBounds,
  normalizeAngleDeg,
  resizeShape,
  rotateShapeAround,
  translateShape,
} from "@/src/maps/drawing/shapeResizeUtils";

type ResizeMode = { shapeId: string } | null;
export type RotationMode =
  | {
      shapeId: string;
      /** textbox.rotation başlangıcı */
      startAngle: number;
      startCenter: [number, number];
      /** Parmak vektörü referansı (yeşil handle konumu) — atan2 farkı için */
      startTouchPos: [number, number];
      /** Jest başındaki geometri; her karede buradan Δ ile döndürülür (birikimli sapma önlenir) */
      initialShapeSnapshot: ShapeProperties;
    }
  | null;
type MoveMode = { shapeId: string; lastTouchPos: [number, number] } | null;

type Args = {
  mapRef: React.RefObject<any>;
  shapes: ShapeProperties[];
  setShapes: React.Dispatch<React.SetStateAction<ShapeProperties[]>>;
  resizeMode: ResizeMode;
  setResizeMode: React.Dispatch<React.SetStateAction<ResizeMode>>;
  rotationMode: RotationMode;
  setRotationMode: React.Dispatch<React.SetStateAction<RotationMode>>;
  moveMode: MoveMode;
  setMoveMode: React.Dispatch<React.SetStateAction<MoveMode>>;
  /** Bottom sheet küçültülmüşken haritada parmağı şekli taşımak için */
  sheetMinimizedDragEnabled: boolean;
  selectedShapeId: string | null;
};

export function useShapeEditGestures({
  mapRef,
  shapes,
  setShapes,
  resizeMode,
  setResizeMode,
  rotationMode,
  setRotationMode,
  moveMode,
  setMoveMode,
  sheetMinimizedDragEnabled,
  selectedShapeId,
}: Args) {
  /** moveMode state bir frame gecikmeli kalabildiği için sürüklemeyi sürdürmek için */
  const moveInitRef = useRef<{ shapeId: string; lastTouchPos: [number, number] } | null>(null);

  const handleHandlePress = useCallback(
    (shapeId: string, handleIndex: number) => {
      console.log("[ShapeDrawingModal] Handle press:", { shapeId, handleIndex });
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape) {
        console.warn("[ShapeDrawingModal] Shape bulunamadı:", shapeId);
        return;
      }

      if (handleIndex === -1) {
        const bounds = getShapeBounds(shape);
        const handlePos: [number, number] = [bounds.center[0], bounds.maxLat + 0.0008];
        console.log("[ShapeDrawingModal] Rotation mode aktif");
        let snapshot: ShapeProperties;
        try {
          snapshot = JSON.parse(JSON.stringify(shape)) as ShapeProperties;
        } catch {
          snapshot = { ...shape, geometry: JSON.parse(JSON.stringify(shape.geometry)) } as ShapeProperties;
        }
        setRotationMode({
          shapeId,
          startAngle: (shape as any).rotation || 0,
          startCenter: bounds.center,
          startTouchPos: handlePos,
          initialShapeSnapshot: snapshot,
        });
        setResizeMode(null);
        setMoveMode(null);
      } else if (handleIndex === 0) {
        console.log("[ShapeDrawingModal] Resize mode aktif");
        setResizeMode({ shapeId });
        setRotationMode(null);
        setMoveMode(null);
      } else if (handleIndex === 1) {
        console.log("[ShapeDrawingModal] Move mode aktif");
        const startPos =
          shape.geometry.type === "Point"
            ? (shape.geometry.coordinates as [number, number])
            : getShapeBounds(shape).center;
        const next = { shapeId, lastTouchPos: startPos };
        moveInitRef.current = next;
        setMoveMode(next);
        setResizeMode(null);
        setRotationMode(null);
      }
    },
    [setMoveMode, setResizeMode, setRotationMode, shapes]
  );

  const handleHandleDrag = useCallback(
    (e: any) => {
      const c: [number, number] | null =
        e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
      if (!c) {
        console.warn("[ShapeDrawingModal] handleHandleDrag: coordinates bulunamadı", e);
        return;
      }

      console.log("[ShapeDrawingModal] handleHandleDrag called:", {
        resizeMode: !!resizeMode,
        rotationMode: !!rotationMode,
        coordinates: c,
      });

      if (resizeMode) {
        const shape = shapes.find((s) => s.id === resizeMode.shapeId);
        if (!shape) {
          console.warn("[ShapeDrawingModal] Resize: Shape bulunamadı", resizeMode.shapeId);
          return;
        }

        console.log("[ShapeDrawingModal] Resize:", c);
        if (shape.type === "textbox" && shape.geometry.type === "Point") {
          const center = shape.geometry.coordinates as [number, number];
          const rot = (((shape as any).rotation || 0) * Math.PI) / 180;
          const dx = c[0] - center[0];
          const dy = c[1] - center[1];
          const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot);
          const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot);
          const nextW = Math.max(0.0001, Math.abs(lx) * 2);
          const nextH = Math.max(0.0001, Math.abs(ly) * 2);
          setShapes((prev) => prev.map((s) => (s.id === resizeMode.shapeId ? { ...s, boxWidth: nextW, boxHeight: nextH } : s)));
        } else {
          const resizedShape = resizeShape(shape as any, c);
          setShapes((prev) => prev.map((s) => (s.id === resizeMode.shapeId ? (resizedShape as any) : s)));
        }
        return;
      }

      // Bottom sheet küçükken: ilk dokunuşta taşıma moduna geç (handle gerekmez)
      if (
        !resizeMode &&
        !rotationMode &&
        !moveMode &&
        sheetMinimizedDragEnabled &&
        selectedShapeId &&
        !moveInitRef.current
      ) {
        moveInitRef.current = { shapeId: selectedShapeId, lastTouchPos: c };
        setMoveMode({ shapeId: selectedShapeId, lastTouchPos: c });
        return;
      }

      if (rotationMode) {
        const { shapeId, startCenter, startTouchPos, initialShapeSnapshot, startAngle } = rotationMode;
        const cx = startCenter[0];
        const cy = startCenter[1];

        const angleStart = Math.atan2(startTouchPos[1] - cy, startTouchPos[0] - cx);
        const angleNow = Math.atan2(c[1] - cy, c[0] - cx);
        let deltaRad = angleNow - angleStart;
        while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
        while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
        const deltaDeg = (deltaRad * 180) / Math.PI;
        /** 1 = parmak açısı ile birebir; düşük değer daha yavaş döner */
        const ROTATION_SENSITIVITY = 1;
        const appliedDelta = deltaDeg * ROTATION_SENSITIVITY;

        if (initialShapeSnapshot.type === "textbox") {
          const finalRot = normalizeAngleDeg(startAngle + appliedDelta);
          setShapes((prev) => prev.map((s) => (s.id === shapeId ? { ...s, rotation: finalRot } : s)));
          return;
        }

        const rotated = rotateShapeAround(initialShapeSnapshot, startCenter, appliedDelta);
        const baseRot =
          typeof (initialShapeSnapshot as any).rotation === "number" ? (initialShapeSnapshot as any).rotation : 0;
        const nextShape = {
          ...rotated,
          rotation: normalizeAngleDeg(baseRot + appliedDelta),
        };
        setShapes((prev) => prev.map((s) => (s.id === shapeId ? (nextShape as any) : s)));
        return;
      }

      const activeMove = moveMode ?? moveInitRef.current;
      if (activeMove) {
        const shape = shapes.find((s) => s.id === activeMove.shapeId);
        if (!shape) return;
        const prevTouch = activeMove.lastTouchPos;
        const dx = c[0] - prevTouch[0];
        const dy = c[1] - prevTouch[1];
        const moved = translateShape(shape as ShapeProperties, [dx, dy]);
        setShapes((prev) => prev.map((s) => (s.id === activeMove.shapeId ? (moved as ShapeProperties) : s)));
        const nextMove = { shapeId: activeMove.shapeId, lastTouchPos: c };
        moveInitRef.current = nextMove;
        setMoveMode(nextMove);
        return;
      }

      console.warn("[ShapeDrawingModal] handleHandleDrag: Ne resizeMode ne de rotationMode aktif");
    },
    [
      moveMode,
      resizeMode,
      rotationMode,
      shapes,
      setMoveMode,
      setShapes,
      sheetMinimizedDragEnabled,
      selectedShapeId,
    ]
  );

  const handleDragFromScreenPoint = useCallback(
    async (x: number, y: number) => {
      const map = mapRef.current;
      if (!map || typeof map.getCoordinateFromView !== "function") return;
      try {
        const res = await map.getCoordinateFromView([x, y]);
        let coord: [number, number] | null = null;

        if (Array.isArray(res) && res.length >= 2) {
          coord = [Number(res[0]), Number(res[1])];
        } else if (res && typeof res === "object") {
          const lng = (res as any).lng ?? (res as any).longitude ?? (res as any)[0];
          const lat = (res as any).lat ?? (res as any).latitude ?? (res as any)[1];
          if (typeof lng === "number" && typeof lat === "number") coord = [lng, lat];
        }

        if (!coord || Number.isNaN(coord[0]) || Number.isNaN(coord[1])) return;
        handleHandleDrag({ geometry: { coordinates: coord }, lngLat: { lng: coord[0], lat: coord[1] } });
      } catch (err) {
        console.warn("[ShapeDrawingModal] getCoordinateFromView failed:", err);
      }
    },
    [handleHandleDrag, mapRef]
  );

  const endResizeRotation = useCallback(() => {
    if (resizeMode || rotationMode || moveMode) {
      console.log("[ShapeDrawingModal] Resize/Rotation bitti");
    }
    moveInitRef.current = null;
    setResizeMode(null);
    setRotationMode(null);
    setMoveMode(null);
  }, [moveMode, resizeMode, rotationMode, setMoveMode, setResizeMode, setRotationMode]);

  const dragPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !!(resizeMode || rotationMode || moveMode || sheetMinimizedDragEnabled),
      onMoveShouldSetPanResponder: () =>
        !!(resizeMode || rotationMode || moveMode || sheetMinimizedDragEnabled),
      onPanResponderGrant: (evt) => {
        if (!(resizeMode || rotationMode || moveMode || sheetMinimizedDragEnabled)) return;
        const { locationX, locationY } = evt.nativeEvent;
        handleDragFromScreenPoint(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        if (!(resizeMode || rotationMode || moveMode || sheetMinimizedDragEnabled)) return;
        const { locationX, locationY } = evt.nativeEvent;
        handleDragFromScreenPoint(locationX, locationY);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => endResizeRotation(),
      onPanResponderTerminate: () => endResizeRotation(),
    });
  }, [
    endResizeRotation,
    handleDragFromScreenPoint,
    moveMode,
    resizeMode,
    rotationMode,
    sheetMinimizedDragEnabled,
  ]);

  return { handleHandlePress, handleHandleDrag, dragPanResponder, endResizeRotation };
}

