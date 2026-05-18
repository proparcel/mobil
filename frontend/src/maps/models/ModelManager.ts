/**
 * Model Manager
 * Mapbox ModelLayer instance yönetimi (ekle/temizle/seçim)
 */
import { useCallback, useMemo, useState } from "react";
import type { ModelType } from "./modelCatalog";

/** Kategoriye göre varsayılan scale (gerçek ölçülerde çizim: 1 = 1 birim). */
export const CATEGORY_SCALE: Record<ModelType, [number, number, number]> = {
  car: [1, 1, 1],
  house: [1, 1, 1],
  tree: [1, 1, 1],
  grass: [1, 1, 1],
};

export const MIN_MODEL_SCALE = 0.05;
export const MAX_MODEL_SCALE = 5.0;

/** rotationDeg (Z ekseni - harita düzleminde yatay dönüş) → modelRotation [lon, lat, z] - Mapbox derece bekler */
export function rotationDegToModelRotation(deg: number): [number, number, number] {
  return [0, 0, deg];
}

/** modelRotation [lon, lat, z] derece → rotationDeg (Z) */
export function modelRotationToRotationDeg(rot: [number, number, number]): number {
  return rot[2] ?? 0;
}

export function normalizeRotationDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function clampScale(s: number): number {
  return Math.max(MIN_MODEL_SCALE, Math.min(MAX_MODEL_SCALE, s));
}

/** ~1° enlem ≈ 111,32 km (WGS84 yaklaşık) */
export const METERS_PER_DEG_LAT = 111_320;

/**
 * Koordinatı doğu/kuzey yönünde metre cinsinden kaydırır (eastM: doğu +, northM: kuzey +).
 */
export function offsetCoordinateMeters(coord: [number, number], eastM: number, northM: number): [number, number] {
  const [lng, lat] = coord;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-9;
  const dLng = eastM / (METERS_PER_DEG_LAT * cosLat);
  const dLat = northM / METERS_PER_DEG_LAT;
  return [lng + dLng, lat + dLat];
}

/** Boyut kaydırıcısı [0,1]: log ölçek; orta = √(MIN·MAX) (MIN=0.05, MAX=5 → ~0.5×). */
export function scaleToSlider01(scale: number): number {
  const s = clampScale(scale);
  const ln = Math.log(MAX_MODEL_SCALE / MIN_MODEL_SCALE);
  if (!(ln > 0)) return 0.5;
  return Math.log(s / MIN_MODEL_SCALE) / ln;
}

export function slider01ToScale(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return clampScale(MIN_MODEL_SCALE * Math.pow(MAX_MODEL_SCALE / MIN_MODEL_SCALE, x));
}

export type ModelInstance = {
  id: string;
  coordinate: [number, number];
  /**
   * Mapbox Models root property içindeki key (ModelLayer style.modelId)
   */
  modelId: string;
  modelScale: [number, number, number];
  modelRotation: [number, number, number];
  modelTranslation: [number, number, number];
  modelOpacity: number;
};

export type ModelManagerState = {
  instances: ModelInstance[];
  placingModelId: string | null;
  selectedModelId: string | null;
};

export type ModelManagerActions = {
  setPlacingModelId: (modelId: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  addModelInstance: (
    coordinate: [number, number],
    modelId: string,
    overrides?: Partial<Omit<ModelInstance, "id" | "coordinate" | "modelId">>
  ) => void;
  updateModelInstance: (
    id: string,
    patch: Partial<Pick<ModelInstance, "coordinate" | "modelScale" | "modelRotation">> & {
      rotationDeg?: number;
      scale?: number;
    }
  ) => void;
  removeModelInstance: (id: string) => void;
  clearModelInstances: () => void;
};

/** Gerçek dünya ölçeği: 1 birim = 1 metre (GLB metre cinsinden ise 1:1). */
const DEFAULT_MODEL_SCALE: [number, number, number] = [1, 1, 1];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useModelManager(): [ModelManagerState, ModelManagerActions] {
  const [instances, setInstances] = useState<ModelInstance[]>([]);
  const [placingModelId, setPlacingModelId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const addModelInstance = useCallback<ModelManagerActions["addModelInstance"]>(
    (coordinate, modelId, overrides) => {
      // Scale validasyonu - pozitif değerler olmalı, [0,0,0] kontrolü
      let scale: [number, number, number] = overrides?.modelScale || DEFAULT_MODEL_SCALE;
      if (scale[0] <= 0 || scale[1] <= 0 || scale[2] <= 0 || (scale[0] === 0 && scale[1] === 0 && scale[2] === 0)) {
        console.warn("[ModelManager] Geçersiz scale değeri, varsayılan kullanılıyor:", scale);
        scale = DEFAULT_MODEL_SCALE;
      }
      
      const rotation: [number, number, number] = overrides?.modelRotation || [0, 0, 0];
      
      // Translation: varsayılan [0,0,0]; sadece pivot merkezde olanlar pipeline'da center(below) ile düzeltilir, uygulama tarafında ek offset yok.
      const translation: [number, number, number] = overrides?.modelTranslation ?? [0, 0, 0];


      // Opacity validasyonu - 0-1 aralığında olmalı
      let opacity = typeof overrides?.modelOpacity === "number" ? overrides.modelOpacity : 1;
      if (opacity < 0 || opacity > 1 || !Number.isFinite(opacity)) {
        console.warn("[ModelManager] Geçersiz opacity değeri, varsayılan kullanılıyor:", opacity);
        opacity = 1;
      }

      const next: ModelInstance = {
        id: newId("mdl"),
        coordinate,
        modelId,
        modelScale: scale,
        modelRotation: rotation,
        modelTranslation: translation,
        modelOpacity: opacity,
      };
      setInstances((prev) => [...prev, next]);
    },
    []
  );

  const updateModelInstance = useCallback<ModelManagerActions["updateModelInstance"]>(
    (id, patch) => {
      setInstances((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          let modelScale = patch.modelScale ?? m.modelScale;
          let modelRotation = patch.modelRotation ?? m.modelRotation;
          if (typeof patch.scale === "number") {
            const clamped = clampScale(patch.scale);
            modelScale = [clamped, clamped, clamped];
          } else if (patch.modelScale) {
            const s = Array.isArray(patch.modelScale)
              ? patch.modelScale[0]
              : patch.modelScale;
            const clamped = clampScale(typeof s === "number" ? s : 1);
            modelScale = [clamped, clamped, clamped];
          }
          if (typeof patch.rotationDeg === "number") {
            modelRotation = rotationDegToModelRotation(normalizeRotationDeg(patch.rotationDeg));
          } else if (patch.modelRotation) {
            const rot = patch.modelRotation;
            const deg = rot.length >= 2 ? modelRotationToRotationDeg(rot) : 0;
            modelRotation = rotationDegToModelRotation(normalizeRotationDeg(deg));
          }
          return {
            ...m,
            coordinate: patch.coordinate ?? m.coordinate,
            modelScale,
            modelRotation,
          };
        })
      );
    },
    []
  );

  const removeModelInstance = useCallback<ModelManagerActions["removeModelInstance"]>((id) => {
    setInstances((prev) => prev.filter((x) => x.id !== id));
    setSelectedModelId((prev) => (prev === id ? null : prev));
  }, []);

  const clearModelInstances = useCallback(() => {
    setInstances([]);
    setSelectedModelId(null);
  }, []);

  const state: ModelManagerState = useMemo(
    () => ({ instances, placingModelId, selectedModelId }),
    [instances, placingModelId, selectedModelId]
  );

  const actions: ModelManagerActions = useMemo(
    () => ({
      setPlacingModelId,
      setSelectedModelId,
      addModelInstance,
      updateModelInstance,
      removeModelInstance,
      clearModelInstances,
    }),
    [addModelInstance, clearModelInstances, removeModelInstance, updateModelInstance]
  );

  return [state, actions];
}

