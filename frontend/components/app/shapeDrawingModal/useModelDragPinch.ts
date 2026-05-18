/**
 * Model düzenleme: döndürme butonları (useModelTransformBar).
 * Konum: haritaya dokunma (useMapPressHandler) + uzun basışla seçim.
 * Harita kaydırma/zoom ile çakışmaması için ayrı pan jesti yok.
 */
import { useRef, useCallback, useEffect } from "react";
import {
  modelRotationToRotationDeg,
  normalizeRotationDeg,
  offsetCoordinateMeters,
} from "@/src/maps/models/ModelManager";

const STEP_DEG = 2;
const INTERVAL_MS = 80;
const NUDGE_METERS = 1;
const NUDGE_INTERVAL_MS = 120;

type Args = {
  selectedModelId: string | null;
  selectedInstance: {
    id: string;
    coordinate: [number, number];
    modelScale: [number, number, number];
    modelRotation: [number, number, number];
  } | null;
  updateModelInstance: (id: string, patch: { coordinate?: [number, number]; scale?: number; rotationDeg?: number }) => void;
};

export function useModelTransformBar({
  selectedModelId,
  selectedInstance,
  updateModelInstance,
}: Args) {
  const rotateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nudgeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Basılı tutmalı kaydırma: her adımda güncel konum */
  const nudgeCoordRef = useRef<[number, number] | null>(null);
  /** Sürekli açı (normalize edilmemiş); 0/360 atlamasında ani tam tur olmaması için sadece gönderirken normalize. */
  const rotationAccumRef = useRef<number>(0);

  /** Ref'i her zaman güncel instance açısı ile senkronize et (stale 0 ile başlayıp ani tam tur olmasın). */
  useEffect(() => {
    const deg = modelRotationToRotationDeg(selectedInstance?.modelRotation ?? [0, 0, 0]);
    rotationAccumRef.current = deg;
  }, [selectedInstance?.modelRotation]);

  useEffect(() => {
    if (selectedInstance?.coordinate) {
      nudgeCoordRef.current = selectedInstance.coordinate;
    }
  }, [selectedInstance?.coordinate]);

  const clearRotateInterval = useCallback(() => {
    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    }
  }, []);

  const clearNudgeInterval = useCallback(() => {
    if (nudgeIntervalRef.current) {
      clearInterval(nudgeIntervalRef.current);
      nudgeIntervalRef.current = null;
    }
  }, []);

  const onRotateLeftPressIn = useCallback(() => {
    clearNudgeInterval();
    clearRotateInterval();
    rotationAccumRef.current = modelRotationToRotationDeg(selectedInstance?.modelRotation ?? [0, 0, 0]);
    rotateIntervalRef.current = setInterval(() => {
      if (!selectedModelId) return;
      rotationAccumRef.current -= STEP_DEG;
      updateModelInstance(selectedModelId, { rotationDeg: normalizeRotationDeg(rotationAccumRef.current) });
    }, INTERVAL_MS);
  }, [selectedModelId, selectedInstance?.modelRotation, updateModelInstance, clearRotateInterval, clearNudgeInterval]);

  const onRotateLeftPressOut = clearRotateInterval;

  const onRotateRightPressIn = useCallback(() => {
    clearNudgeInterval();
    clearRotateInterval();
    rotationAccumRef.current = modelRotationToRotationDeg(selectedInstance?.modelRotation ?? [0, 0, 0]);
    rotateIntervalRef.current = setInterval(() => {
      if (!selectedModelId) return;
      rotationAccumRef.current += STEP_DEG;
      updateModelInstance(selectedModelId, { rotationDeg: normalizeRotationDeg(rotationAccumRef.current) });
    }, INTERVAL_MS);
  }, [selectedModelId, selectedInstance?.modelRotation, updateModelInstance, clearRotateInterval, clearNudgeInterval]);

  const onRotateRightPressOut = clearRotateInterval;

  const onNudgePressIn = useCallback(
    (eastM: number, northM: number) => {
      clearRotateInterval();
      clearNudgeInterval();
      if (!selectedModelId) return;
      if (!nudgeCoordRef.current && selectedInstance?.coordinate) {
        nudgeCoordRef.current = selectedInstance.coordinate;
      }
      if (!nudgeCoordRef.current) return;
      const e = eastM * NUDGE_METERS;
      const n = northM * NUDGE_METERS;
      const first = offsetCoordinateMeters(nudgeCoordRef.current, e, n);
      nudgeCoordRef.current = first;
      updateModelInstance(selectedModelId, { coordinate: first });
      nudgeIntervalRef.current = setInterval(() => {
        if (!selectedModelId || !nudgeCoordRef.current) return;
        const next = offsetCoordinateMeters(nudgeCoordRef.current, e, n);
        nudgeCoordRef.current = next;
        updateModelInstance(selectedModelId, { coordinate: next });
      }, NUDGE_INTERVAL_MS);
    },
    [selectedModelId, selectedInstance?.coordinate, updateModelInstance, clearNudgeInterval, clearRotateInterval]
  );

  const onNudgePressOut = useCallback(() => {
    clearNudgeInterval();
  }, [clearNudgeInterval]);

  useEffect(() => {
    return () => {
      clearNudgeInterval();
    };
  }, [clearNudgeInterval]);

  const onDelete = useCallback(() => {
    if (!selectedModelId) return;
    console.log("[ModelEdit] Model silindi:", selectedModelId);
  }, [selectedModelId]);

  return {
    onRotateLeftPressIn,
    onRotateLeftPressOut,
    onRotateRightPressIn,
    onRotateRightPressOut,
    onNudgePressIn,
    onNudgePressOut,
    onDelete,
    clearRotateInterval,
  };
}
