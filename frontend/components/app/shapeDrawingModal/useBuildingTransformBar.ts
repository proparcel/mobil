import { useCallback, useEffect, useRef } from "react";
import { rotateRingDegrees, translateRingMeters, type LngLatRing } from "@/src/maps/building/buildingRingGeometry";
import type { BuildingPolyFeature } from "./BuildingExtrusionLayer";

const STEP_DEG = 2;
const INTERVAL_MS = 80;
const NUDGE_METERS = 1;
const NUDGE_INTERVAL_MS = 120;

type Args = {
  selectedBuildingId: string | null;
  buildingFeatures: BuildingPolyFeature[];
  patchBuildingRing: (id: string, ring: LngLatRing) => void;
};

function ringFromFeature(f: BuildingPolyFeature | undefined): LngLatRing | null {
  const c = f?.geometry?.coordinates?.[0];
  if (!c || c.length < 3) return null;
  return c.map(([lng, lat]) => [lng, lat] as [number, number]);
}

export function useBuildingTransformBar({
  selectedBuildingId,
  buildingFeatures,
  patchBuildingRing,
}: Args) {
  const rotateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nudgeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nudgeRingRef = useRef<LngLatRing | null>(null);

  const selectedFeature = buildingFeatures.find((f) => f.properties?.id === selectedBuildingId);

  useEffect(() => {
    const r = ringFromFeature(selectedFeature);
    if (r) nudgeRingRef.current = r;
  }, [selectedFeature]);

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

  const applyRing = useCallback(
    (id: string, ring: LngLatRing) => {
      patchBuildingRing(id, ring);
      nudgeRingRef.current = ring;
    },
    [patchBuildingRing]
  );

  const onRotateLeftPressIn = useCallback(() => {
    if (!selectedBuildingId) return;
    clearNudgeInterval();
    clearRotateInterval();
    rotateIntervalRef.current = setInterval(() => {
      if (!selectedBuildingId) return;
      const base = nudgeRingRef.current || ringFromFeature(selectedFeature);
      if (!base) return;
      const next = rotateRingDegrees(base, -STEP_DEG);
      applyRing(selectedBuildingId, next);
    }, INTERVAL_MS);
  }, [selectedBuildingId, selectedFeature, applyRing, clearRotateInterval, clearNudgeInterval]);

  const onRotateLeftPressOut = clearRotateInterval;

  const onRotateRightPressIn = useCallback(() => {
    if (!selectedBuildingId) return;
    clearNudgeInterval();
    clearRotateInterval();
    rotateIntervalRef.current = setInterval(() => {
      if (!selectedBuildingId) return;
      const base = nudgeRingRef.current || ringFromFeature(selectedFeature);
      if (!base) return;
      const next = rotateRingDegrees(base, STEP_DEG);
      applyRing(selectedBuildingId, next);
    }, INTERVAL_MS);
  }, [selectedBuildingId, selectedFeature, applyRing, clearRotateInterval, clearNudgeInterval]);

  const onRotateRightPressOut = clearRotateInterval;

  const onNudgePressIn = useCallback(
    (eastM: number, northM: number) => {
      if (!selectedBuildingId) return;
      clearRotateInterval();
      clearNudgeInterval();
      let base = nudgeRingRef.current || ringFromFeature(selectedFeature);
      if (!base) return;
      const e = eastM * NUDGE_METERS;
      const n = northM * NUDGE_METERS;
      const first = translateRingMeters(base, e, n);
      nudgeRingRef.current = first;
      applyRing(selectedBuildingId, first);
      nudgeIntervalRef.current = setInterval(() => {
        if (!selectedBuildingId || !nudgeRingRef.current) return;
        const next = translateRingMeters(nudgeRingRef.current, e, n);
        nudgeRingRef.current = next;
        applyRing(selectedBuildingId, next);
      }, NUDGE_INTERVAL_MS);
    },
    [selectedBuildingId, selectedFeature, applyRing, clearRotateInterval, clearNudgeInterval]
  );

  const onNudgePressOut = useCallback(() => {
    clearNudgeInterval();
  }, [clearNudgeInterval]);

  useEffect(() => {
    return () => {
      clearNudgeInterval();
      clearRotateInterval();
    };
  }, [clearNudgeInterval, clearRotateInterval]);

  return {
    onRotateLeftPressIn,
    onRotateLeftPressOut,
    onRotateRightPressIn,
    onRotateRightPressOut,
    onNudgePressIn,
    onNudgePressOut,
  };
}
