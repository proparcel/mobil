import { useCallback } from "react";
import type { ModelInstance } from "@/src/maps/models/ModelManager";

type Args = {
  cameraRef: React.RefObject<any>;
  setPitchValue?: (pitch: number) => void;
  setCameraZoom?: (zoom: number) => void;
  setCameraCenter?: (center: [number, number]) => void;
  setCameraHeading?: (heading: number) => void;
};

/**
 * Calculate optimal zoom level for given bounds
 */
function calculateOptimalZoom(
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number
): number {
  const lonDiff = maxLon - minLon;
  const latDiff = maxLat - minLat;
  const maxDiff = Math.max(lonDiff, latDiff);

  // Zoom seviyesi hesaplama (basit yaklaşım)
  // maxDiff değerine göre zoom seviyesi belirlenir
  if (maxDiff > 0.1) return 10; // Çok geniş alan
  if (maxDiff > 0.05) return 12;
  if (maxDiff > 0.01) return 14;
  if (maxDiff > 0.005) return 16;
  if (maxDiff > 0.001) return 18;
  if (maxDiff > 0.0005) return 19;
  return 20; // Çok yakın
}

/**
 * Calculate bounds for all model instances
 */
function calculateModelBounds(instances: ModelInstance[]): {
  center: [number, number];
  zoom: number;
} {
  if (instances.length === 0) {
    return { center: [0, 0], zoom: 16 };
  }

  if (instances.length === 1) {
    // Tek model: çok yakın zoom seçimi zorlaştırır; biraz uzak
    return {
      center: instances[0].coordinate,
      zoom: 17,
    };
  }

  const lons = instances.map((i) => i.coordinate[0]);
  const lats = instances.map((i) => i.coordinate[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Padding ekle (~100m)
  const padding = 0.001;
  const paddedMinLon = minLon - padding;
  const paddedMaxLon = maxLon + padding;
  const paddedMinLat = minLat - padding;
  const paddedMaxLat = maxLat + padding;

  const center: [number, number] = [
    (paddedMinLon + paddedMaxLon) / 2,
    (paddedMinLat + paddedMaxLat) / 2,
  ];

  const zoom = calculateOptimalZoom(paddedMinLon, paddedMaxLon, paddedMinLat, paddedMaxLat);

  return { center, zoom };
}

export function useModelFocus({
  cameraRef,
  setPitchValue,
  setCameraZoom,
  setCameraCenter,
  setCameraHeading,
}: Args) {
  /**
   * Focus camera on all model instances
   */
  const focusOnAllModels = useCallback(
    (instances: ModelInstance[]) => {
      if (!cameraRef?.current?.setCamera) {
        console.warn("[useModelFocus] cameraRef.setCamera not available");
        return;
      }

      if (instances.length === 0) {
        console.warn("[useModelFocus] No instances to focus on");
        return;
      }

      const bounds = calculateModelBounds(instances);

      console.log("[useModelFocus] Focusing on all models:", {
        instanceCount: instances.length,
        center: bounds.center,
        zoom: bounds.zoom,
      });

      setPitchValue?.(45);
      setCameraZoom?.(bounds.zoom);
      setCameraCenter?.(bounds.center);
      setCameraHeading?.(0);

      cameraRef.current.setCamera({
        centerCoordinate: bounds.center,
        zoomLevel: bounds.zoom,
        pitch: 45,
        heading: 0,
        animationDuration: 2000,
      });
    },
    [cameraRef, setPitchValue, setCameraZoom, setCameraCenter, setCameraHeading]
  );

  /**
   * Focus camera on a single model instance
   */
  const focusOnModel = useCallback(
    (instance: ModelInstance) => {
      if (!cameraRef?.current?.setCamera) {
        console.warn("[useModelFocus] cameraRef.setCamera not available");
        return;
      }

      console.log("[useModelFocus] Focusing on model:", {
        modelId: instance.modelId,
        coordinate: instance.coordinate,
        targetPitch: 45,
      });

      setPitchValue?.(45);
      setCameraZoom?.(17);
      setCameraCenter?.(instance.coordinate);
      setCameraHeading?.(0);

      cameraRef.current.setCamera({
        centerCoordinate: instance.coordinate,
        zoomLevel: 17,
        pitch: 45,
        heading: 0,
        animationDuration: 2000,
      });
    },
    [cameraRef, setPitchValue, setCameraZoom, setCameraCenter, setCameraHeading]
  );

  return {
    focusOnAllModels,
    focusOnModel,
    calculateModelBounds,
  };
}
