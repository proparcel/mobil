import { useCallback } from "react";
import { Alert } from "react-native";
import {
  createArrowShape,
  createCircleShape,
  createEllipseShape,
  createLineShape,
  createMarkerShape,
  createPolygonShape,
  createRectangleShape,
  createTextBoxShape,
  createTriangleShape,
} from "@/src/maps/drawing/ShapeDrawingManager";
import type { ShapeType, ShapeProperties, DrawShapeOptions } from "@/src/maps/drawing/types";

type Args = {
  shapeDrawingMode: ShapeType | null;
  shapeDrawingPoints: [number, number][];
  setShapeDrawingPoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setShapeDrawingMode: React.Dispatch<React.SetStateAction<ShapeType | null>>;
  shapes: ShapeProperties[];
  setShapes: React.Dispatch<React.SetStateAction<ShapeProperties[]>>;

  setTextBoxEditVisible: (v: boolean) => void;
  setTextBoxEditShapeId: (id: string | null) => void;
  setTextBoxEditInitialText: (t: string) => void;

  /** Web Araç Takımı ile aynı: renk + kontur kalınlığı yeni şekillere uygulanır */
  drawOptions: DrawShapeOptions;
};

function extractCoordinate(e: any): [number, number] | null {
  return (
    e?.geometry?.coordinates ||
    e?.coordinates ||
    (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null)
  );
}

function fillFromOutline(outlineHex: string | undefined, fillOpacity: number | undefined): string | undefined {
  const o = (outlineHex || "#2563eb").replace("#", "");
  if (o.length !== 6) return outlineHex;
  const op = Math.round(Math.max(0, Math.min(1, fillOpacity ?? 0.45)) * 255);
  const a = op.toString(16).padStart(2, "0");
  return `#${o}${a}`;
}

export function useShapeDrawingHandlers(args: Args) {
  const {
    shapeDrawingMode,
    shapeDrawingPoints,
    setShapeDrawingPoints,
    setShapeDrawingMode,
    setShapes,
    shapes,
    setTextBoxEditVisible,
    setTextBoxEditShapeId,
    setTextBoxEditInitialText,
    drawOptions,
  } = args;

  const opts = (): DrawShapeOptions => {
    const outlineColor = drawOptions.outlineColor || "#2563eb";
    const outlineWidth = drawOptions.outlineWidth ?? 4;
    const fillOpacity = drawOptions.fillOpacity ?? 0.45;
    return {
      outlineColor,
      outlineWidth,
      fillColor: drawOptions.fillColor || fillFromOutline(outlineColor, fillOpacity),
      fillOpacity,
    };
  };

  const handleShapeDrawingPress = useCallback(
    (e: any) => {
      const c = extractCoordinate(e);
      if (!c || !shapeDrawingMode) return;

      const mode = shapeDrawingMode;

      try {
        if (mode === "pen" || mode === "freehand") {
          return;
        }

        if (mode === "rectangle") {
          if (shapeDrawingPoints.length === 0) setShapeDrawingPoints([c]);
          else {
            const shape = createRectangleShape(shapeDrawingPoints[0], c, opts());
            setShapes((prev) => [...prev, shape]);
            setShapeDrawingPoints([]);
            setShapeDrawingMode(null);
          }
          return;
        }

        if (mode === "triangle") {
          if (shapeDrawingPoints.length < 2) setShapeDrawingPoints((prev) => [...prev, c]);
          else {
            const shape = createTriangleShape(shapeDrawingPoints[0], shapeDrawingPoints[1], c, opts());
            setShapes((prev) => [...prev, shape]);
            setShapeDrawingPoints([]);
            setShapeDrawingMode(null);
          }
          return;
        }

        if (mode === "circle") {
          if (shapeDrawingPoints.length === 0) setShapeDrawingPoints([c]);
          else {
            const shape = createCircleShape(shapeDrawingPoints[0], c, opts());
            setShapes((prev) => [...prev, shape]);
            setShapeDrawingPoints([]);
            setShapeDrawingMode(null);
          }
          return;
        }

        if (mode === "ellipse") {
          if (shapeDrawingPoints.length < 2) setShapeDrawingPoints((prev) => [...prev, c]);
          else {
            const shape = createEllipseShape(shapeDrawingPoints[0], shapeDrawingPoints[1], c, opts());
            setShapes((prev) => [...prev, shape]);
            setShapeDrawingPoints([]);
            setShapeDrawingMode(null);
          }
          return;
        }

        if (mode === "polygon") {
          setShapeDrawingPoints((prev) => [...prev, c]);
          return;
        }

        if (mode === "line") {
          setShapeDrawingPoints((prev) => [...prev, c]);
          return;
        }

        if (mode === "arrow") {
          if (shapeDrawingPoints.length === 0) setShapeDrawingPoints([c]);
          else {
            const shape = createArrowShape(shapeDrawingPoints[0], c, opts());
            setShapes((prev) => [...prev, shape]);
            setShapeDrawingPoints([]);
            setShapeDrawingMode(null);
          }
          return;
        }

        if (mode === "marker") {
          const shape = createMarkerShape(c, opts());
          setShapes((prev) => [...prev, shape]);
          setShapeDrawingMode(null);
          return;
        }

        if (mode === "textbox") {
          const defaultText = "Metin";
          const shape = createTextBoxShape(c, defaultText, opts());
          setShapes((prev) => [...prev, shape]);
          setShapeDrawingMode(null);
          return;
        }
      } catch (error) {
        console.error("[handleShapeDrawingPress] Hata:", error);
        Alert.alert("Hata", "Şekil çizilirken bir hata oluştu.");
        setShapeDrawingPoints([]);
        setShapeDrawingMode(null);
      }
    },
    [shapeDrawingMode, shapeDrawingPoints, setShapeDrawingMode, setShapeDrawingPoints, setShapes, drawOptions]
  );

  const openTextBoxEditor = useCallback(
    (shapeId: string) => {
      const s = shapes.find((x) => x.id === shapeId);
      if (!s || s.type !== "textbox") return;
      setTextBoxEditShapeId(shapeId);
      setTextBoxEditInitialText(String((s as any).text ?? ""));
      setTextBoxEditVisible(true);
    },
    [setTextBoxEditInitialText, setTextBoxEditShapeId, setTextBoxEditVisible, shapes]
  );

  const finalizePolygonOrLine = useCallback(
    (mode: "polygon" | "line") => {
      const pts = shapeDrawingPoints;
      if (mode === "polygon" && pts.length >= 3) {
        const shape = createPolygonShape(pts, opts());
        setShapes((prev) => [...prev, shape]);
      }
      if (mode === "line" && pts.length >= 2) {
        const shape = createLineShape(pts, {
          outlineColor: drawOptions.outlineColor,
          outlineWidth: drawOptions.outlineWidth,
        });
        setShapes((prev) => [...prev, shape]);
      }
      setShapeDrawingPoints([]);
      setShapeDrawingMode(null);
    },
    [shapeDrawingPoints, setShapeDrawingMode, setShapeDrawingPoints, setShapes, drawOptions]
  );

  return { handleShapeDrawingPress, openTextBoxEditor, finalizePolygonOrLine };
}

