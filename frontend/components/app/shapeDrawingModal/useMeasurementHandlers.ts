import { useCallback } from "react";
import type { MeasurementFeature } from "@/src/utils/measurementManager";
import { calculateArea, createAreaFeatures, createRulerFeatures } from "@/src/utils/measurementManager";

type Mode = "distance" | "area" | null;

type Args = {
  measurementMode: Mode;
  measurementPoints: [number, number][];
  setMeasurementPoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setMeasurementFeatures: React.Dispatch<React.SetStateAction<MeasurementFeature[]>>;
  setMeasurementMode: (m: Mode) => void;
  /** Toolbox’tan — cetvel çizgisi rengi */
  rulerColor: string;
  /** Toolbox’tan — alan kontur/dolgu tonu */
  areaColor: string;
};

function extractCoordinate(e: any): [number, number] | null {
  return (
    e?.geometry?.coordinates ||
    e?.coordinates ||
    (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null)
  );
}

export function useMeasurementHandlers({
  measurementMode,
  measurementPoints,
  setMeasurementPoints,
  setMeasurementFeatures,
  setMeasurementMode,
  rulerColor,
  areaColor,
}: Args) {
  const handleMeasurementPress = useCallback(
    (e: any) => {
      const c = extractCoordinate(e);
      if (!c || !measurementMode) return;

      if (measurementMode === "distance") {
        if (measurementPoints.length === 0) {
          setMeasurementPoints([c]);
          setMeasurementFeatures((prev) => [
            ...prev.filter((f) => !(f as any)?.properties?.isTemporary),
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: c },
              properties: { measurementType: "ruler", isTemporary: true },
            } as any,
          ]);
        } else {
          const measurementGroupId = `meas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const newPoints = [...measurementPoints, c];
          const measureColor = rulerColor || "#3B82F6";
          const newFeatures = createRulerFeatures(newPoints).map((f) => ({
            ...f,
            properties: { ...(f as any).properties, measurementGroupId, measureColor },
          }));
          setMeasurementFeatures((prev) => [...prev.filter((f) => !(f as any)?.properties?.isTemporary), ...(newFeatures as any)]);
          setMeasurementPoints([]);
          // Mesafe modu Ölçüm Kapat ile kapanana kadar açık kalır (ardışık çizgiler)
        }
      } else if (measurementMode === "area") {
        const newPoints = [...measurementPoints, c];
        setMeasurementPoints(newPoints);
        const newFeatures = createAreaFeatures(newPoints, undefined, true);
        setMeasurementFeatures((prev) => [...prev.filter((f) => !(f as any)?.properties?.isTemporary), ...(newFeatures as any)]);
      }
    },
    [measurementMode, measurementPoints, setMeasurementFeatures, setMeasurementPoints, rulerColor]
  );

  const finalizeAreaMeasurement = useCallback(() => {
    if (measurementMode !== "area") return false;
    if (measurementPoints.length < 3) return false;

    const measurementGroupId = `meas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const area = calculateArea(measurementPoints);
    const measureColor = areaColor || "#F97316";
    const newFeatures = createAreaFeatures(measurementPoints, area, false).map((f) => ({
      ...f,
      properties: { ...(f as any).properties, measurementGroupId, measureColor },
    }));
    setMeasurementFeatures((prev) => [...prev.filter((f) => !(f as any)?.properties?.isTemporary), ...(newFeatures as any)]);
    setMeasurementPoints([]);
    // Alan modu Ölçüm Kapat ile kapanana kadar açık kalır (birden fazla poligon)
    return true;
  }, [measurementMode, measurementPoints, setMeasurementFeatures, setMeasurementPoints, areaColor]);

  /** Web “Mevcut ölçümü bitir”: alanı kaydet veya yarım cetvel/alan taslağını temizle */
  const finishPendingMeasurement = useCallback((): boolean => {
    if (measurementMode === "area") {
      if (measurementPoints.length >= 3) {
        const measurementGroupId = `meas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const area = calculateArea(measurementPoints);
        const measureColor = areaColor || "#F97316";
        const newFeatures = createAreaFeatures(measurementPoints, area, false).map((f) => ({
          ...f,
          properties: { ...(f as any).properties, measurementGroupId, measureColor },
        }));
        setMeasurementFeatures((prev) => [...prev.filter((f) => !(f as any)?.properties?.isTemporary), ...(newFeatures as any)]);
        setMeasurementPoints([]);
        return true;
      }
      setMeasurementPoints([]);
      setMeasurementFeatures((prev) => prev.filter((f) => !(f as any)?.properties?.isTemporary));
      return true;
    }
    if (measurementMode === "distance" && measurementPoints.length === 1) {
      setMeasurementPoints([]);
      setMeasurementFeatures((prev) => prev.filter((f) => !(f as any)?.properties?.isTemporary));
      return true;
    }
    return false;
  }, [
    measurementMode,
    measurementPoints,
    areaColor,
    setMeasurementFeatures,
    setMeasurementPoints,
  ]);

  return { handleMeasurementPress, finalizeAreaMeasurement, finishPendingMeasurement };
}

