import { useCallback, useMemo, useState } from "react";
import type { MeasurementFeature, MeasurementMode } from "@/src/utils/measurementManager";
import { useMeasurementHandlers } from "../shapeDrawingModal/useMeasurementHandlers";

export type UseMeasurementSessionOptions = {
  defaultRulerColor?: string;
  defaultAreaColor?: string;
};

export function useMeasurementSession(options: UseMeasurementSessionOptions = {}) {
  const { defaultRulerColor = "#3b82f6", defaultAreaColor = "#fbbf24" } = options;

  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(null);
  const [measurementPoints, setMeasurementPoints] = useState<[number, number][]>([]);
  const [measurementFeatures, setMeasurementFeatures] = useState<MeasurementFeature[]>([]);
  const [rulerColor, setRulerColor] = useState(defaultRulerColor);
  const [areaColor, setAreaColor] = useState(defaultAreaColor);

  const { handleMeasurementPress, finalizeAreaMeasurement, finishPendingMeasurement } = useMeasurementHandlers({
    measurementMode,
    measurementPoints,
    setMeasurementPoints,
    setMeasurementFeatures,
    setMeasurementMode,
    rulerColor,
    areaColor,
  });

  const isActive = measurementMode === "distance" || measurementMode === "area";

  const measurementFinishBarLabel = useMemo(() => {
    if (!isActive) return "Ölçümü bitir";
    return measurementPoints.length > 0 ? "Ölçümü bitir" : "Ölçümden Çık";
  }, [isActive, measurementPoints.length]);

  const clearTemporaryDraft = useCallback(() => {
    setMeasurementPoints([]);
    setMeasurementFeatures((prev) => prev.filter((f) => !f.properties.isTemporary));
  }, []);

  const selectMeasurementMode = useCallback(
    (next: MeasurementMode) => {
      if (next !== measurementMode) {
        setMeasurementPoints([]);
        setMeasurementFeatures((prev) => prev.filter((f) => !f.properties.isTemporary));
      }
      setMeasurementMode(next);
    },
    [measurementMode]
  );

  const clearMeasurements = useCallback(() => {
    setMeasurementFeatures([]);
    setMeasurementPoints([]);
    setMeasurementMode(null);
  }, []);

  const closeMeasurementMode = useCallback(() => {
    setMeasurementMode(null);
    clearTemporaryDraft();
  }, [clearTemporaryDraft]);

  /** Üst bar “Ölçümü bitir”: taslağı kaydet/iptal; bekleyen yoksa ölçüm modundan çık. */
  const finishActiveMeasurement = useCallback(() => {
    if (finishPendingMeasurement()) return;
    closeMeasurementMode();
  }, [finishPendingMeasurement, closeMeasurementMode]);

  return useMemo(
    () => ({
      measurementMode,
      setMeasurementMode,
      measurementPoints,
      setMeasurementPoints,
      measurementFeatures,
      setMeasurementFeatures,
      rulerColor,
      setRulerColor,
      areaColor,
      setAreaColor,
      isActive,
      measurementFinishBarLabel,
      handleMeasurementPress,
      finalizeAreaMeasurement,
      finishPendingMeasurement,
      finishActiveMeasurement,
      selectMeasurementMode,
      clearTemporaryDraft,
      clearMeasurements,
      closeMeasurementMode,
    }),
    [
      measurementMode,
      measurementPoints,
      measurementFeatures,
      rulerColor,
      areaColor,
      isActive,
      measurementFinishBarLabel,
      handleMeasurementPress,
      finalizeAreaMeasurement,
      finishPendingMeasurement,
      finishActiveMeasurement,
      selectMeasurementMode,
      clearTemporaryDraft,
      clearMeasurements,
      closeMeasurementMode,
    ]
  );
}

export type MeasurementSession = ReturnType<typeof useMeasurementSession>;
