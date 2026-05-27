import { useCallback } from "react";
import { Alert } from "react-native";
import type { ShapeProperties } from "@/src/maps/drawing/types";
import { trySelectShapeAtLngLat, screenPointFromMapPressEvent } from "@/src/maps/drawing/shapePickAtLngLat";

type Args = {
  shapeDrawingMode: any;
  measurementMode: any;
  parcelSelectMode: boolean;
  resizeMode: { shapeId: string } | null;
  rotationMode:
    | { shapeId: string; startAngle: number; startCenter: [number, number]; startTouchPos: [number, number] }
    | null;

  handleShapeDrawingPress: (e: any) => void;
  handleMeasurementPress: (e: any) => void;
  handleParcelSelect: (e: any) => void;
  handleHandleDrag: (e: any) => void;

  mapRef: React.RefObject<any>;
  placingModelId: string | null;
  instancesCount: number;
  instances: Array<{ modelId: string }>;
  modelsProp: any;
  /** Seçili 3D model (varsa tıklanan noktaya taşınır; tıklama seçimi kapatmaz). */
  selectedModelId?: string | null;
  updateModelInstance?: (id: string, patch: { coordinate?: [number, number] }) => void;

  modelActions: {
    addModelInstance: (c: [number, number], modelId: string, overrides?: object) => void;
    setSelectedModelId: (id: string | null) => void;
  };
  /** Kategoriye göre scale (CATEGORY_SCALE); gerçek ölçülerde çizim için hepsi [1,1,1]. */
  getScaleForModelId?: (modelId: string) => [number, number, number] | undefined;
  /** Kategoriye göre Z offset (ev: 2.5 m pivot zeminde, diğer: 0.8 m). */
  getTranslationForModelId?: (modelId: string) => [number, number, number] | undefined;

  // Usage count management
  getModelIdFromStringId?: (stringId: string) => number | undefined;
  onBeforeAddModel?: (modelId: number) => Promise<{ success: boolean; remainingUses: number | null }>;
  /** Model boyut limiti kontrolü (500KB). allowed: false ise model eklenmez. */
  onCheckModelSizeLimit?: (
    instances: Array<{ modelId: string }>,
    newModelId: string
  ) => Promise<{ allowed: boolean; message?: string }>;

  /** Çizim şekillerine dokunma (metin kutusu MarkerView üstünde harita onPress ile) */
  shapes?: ShapeProperties[];
  onShapePress?: (shapeId: string) => void;
};

export function normalizeLngLat(coord: [number, number]): [number, number] | null {
  const a = Number(coord[0]);
  const b = Number(coord[1]);
  
  // NaN, Infinity ve çok büyük değerleri kontrol et
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    console.error("[useMapPressHandler] Geçersiz koordinat (NaN/Infinity):", { coord, a, b });
    return null;
  }
  
  // Çok büyük değerleri kontrol et (dünya dışı koordinatlar)
  if (Math.abs(a) > 180 || Math.abs(b) > 90) {
    console.error("[useMapPressHandler] Geçersiz koordinat (çok büyük değer):", { coord, a, b });
    return null;
  }

  const isLat = (v: number) => Math.abs(v) <= 90;
  const isLng = (v: number) => Math.abs(v) <= 180;

  if (isLng(a) && isLat(b)) return [a, b];
  if (isLat(a) && isLng(b)) return [b, a];
  return [a, b];
}

const MODELS_PICK_LAYER_ID = "models-pick";

/** Piksel ofsetleri: küçükten büyüğe; tek nokta kaçırınca da büyük model / kenar seçimi gelsin. */
const PICK_PROBE_OFFSETS_PX: [number, number][] = (() => {
  const out: [number, number][] = [[0, 0]];
  const ring = (d: number) => {
    const p: [number, number][] = [
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
      [d, d],
      [d, -d],
      [-d, d],
      [-d, -d],
    ];
    for (const x of p) out.push(x);
  };
  ring(16);
  ring(32);
  ring(48);
  ring(64);
  ring(88);
  ring(112);
  return out;
})();

/**
 * Harita koordinatında model pick katmanında instance var mı (uzun basış ile seçim için).
 * Tek piksel yerine birkaç komşu nokta sorgulanır (büyük ölçekli modeller / kenar).
 */
export async function trySelectModelInstanceAtLngLat(
  mapRef: React.RefObject<any>,
  lngLat: [number, number]
): Promise<string | null> {
  const map = mapRef?.current;
  if (!map || typeof map.getPointInView !== "function" || typeof map.queryRenderedFeaturesAtPoint !== "function") {
    return null;
  }
  try {
    const point = await map.getPointInView(lngLat);
    if (!point || point.length < 2) return null;
    const px = Number(point[0]);
    const py = Number(point[1]);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

    for (const [ox, oy] of PICK_PROBE_OFFSETS_PX) {
      const fc = await map.queryRenderedFeaturesAtPoint([px + ox, py + oy], [], [MODELS_PICK_LAYER_ID]);
      const instanceId = fc?.features?.[0]?.properties?.instanceId;
      if (instanceId && (typeof instanceId === "string" || typeof instanceId === "number")) {
        return String(instanceId);
      }
    }
    return null;
  } catch (err) {
    if (__DEV__) console.warn("[trySelectModelInstanceAtLngLat] hit-test:", err);
    return null;
  }
}

export function useMapPressHandler({
  shapeDrawingMode,
  measurementMode,
  parcelSelectMode,
  resizeMode,
  rotationMode,
  handleShapeDrawingPress,
  handleMeasurementPress,
  handleParcelSelect,
  handleHandleDrag,
  mapRef,
  placingModelId,
  instancesCount,
  instances,
  modelsProp,
  modelActions,
  getScaleForModelId,
  getTranslationForModelId,
  getModelIdFromStringId,
  onBeforeAddModel,
  onCheckModelSizeLimit,
  selectedModelId,
  updateModelInstance,
  shapes,
  onShapePress,
}: Args) {
  return useCallback(
    async (e: any) => {
      let c: [number, number] | null =
        e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
      if (!c) return;

      const before = c;
      const normalized = normalizeLngLat(c);
      if (!normalized) {
        console.error("[ShapeDrawingModal] Koordinat normalizasyonu başarısız:", { before });
        return;
      }
      c = normalized;
      if (before?.[0] !== c?.[0] || before?.[1] !== c?.[1]) {
        console.warn("[ShapeDrawingModal] Coordinate swapped (lat/lon fix):", { before, after: c });
      }

      if (resizeMode || rotationMode) {
        console.log("[ShapeDrawingModal] handleMapPress: resize/rotation mode aktif, calling handleHandleDrag");
        handleHandleDrag(e);
        return;
      }

      if (measurementMode) {
        handleMeasurementPress(e);
        return;
      }
      if (parcelSelectMode) {
        handleParcelSelect(e);
        return;
      }
      if (shapeDrawingMode) {
        handleShapeDrawingPress(e);
        return;
      }

      if (onShapePress && shapes?.length) {
        const screenPoint = screenPointFromMapPressEvent(e);
        const hitId = await trySelectShapeAtLngLat(mapRef, c, shapes, screenPoint);
        if (hitId) {
          onShapePress(hitId);
          return;
        }
      }

      if (placingModelId) {
        // Önce model boyut limiti kontrolü (500KB)
        if (onCheckModelSizeLimit) {
          try {
            const sizeResult = await onCheckModelSizeLimit(instances, placingModelId);
            if (!sizeResult.allowed) {
              Alert.alert(
                "Boyut Limiti Aşıldı",
                sizeResult.message || "Modellerin toplam boyutu 500 KB'ı geçemez. Lütfen bazı modelleri kaldırın."
              );
              return;
            }
          } catch (err) {
            if (__DEV__) console.warn("[useMapPressHandler] Model boyut kontrolü hatası:", err);
          }
        }

        // Check if we need to decrement usage before adding model
        if (getModelIdFromStringId && onBeforeAddModel) {
          const modelId = getModelIdFromStringId(placingModelId);
          if (modelId !== undefined) {
            // Call decrement API before adding model (optimistic update)
            onBeforeAddModel(modelId)
              .then((result) => {
                if (result.success) {
                  const scale = getScaleForModelId?.(placingModelId);
                  const translation = getTranslationForModelId?.(placingModelId);
                  const overrides = { ...(scale ? { modelScale: scale } : {}), ...(translation ? { modelTranslation: translation } : {}) };
                  modelActions.addModelInstance(c, placingModelId, Object.keys(overrides).length ? overrides : undefined);
                  console.log("[useMapPressHandler] Model usage decremented, instance added:", {
                    modelId,
                    remainingUses: result.remainingUses,
                  });
                } else {
                  // Failed: Show alert, don't add model
                  Alert.alert(
                    "Model Eklenemedi",
                    "Kullanım sayısı güncellenemedi. Lütfen tekrar deneyin."
                  );
                  console.error("[useMapPressHandler] Usage decrement failed:", result);
                }
              })
              .catch((error) => {
                const msg = String(error?.message || "");
                const isUsageExhausted = /tükenmiş|Yeni paket satın alın/i.test(msg);
                if (isUsageExhausted) {
                  // Beklenen durum: 0 kalmış, tekrar yerleştirme denemesi. Alert yok, sadece warn.
                  console.warn("[useMapPressHandler] Kullanım hakkı tükenmiş, model eklenmedi:", msg);
                  return;
                }
                console.error("[useMapPressHandler] Usage decrement error:", error);
                Alert.alert(
                  "Model Eklenemedi",
                  `Kullanım sayısı güncellenirken bir hata oluştu: ${msg || "Bilinmeyen hata"}`
                );
              });
            return; // Don't add model synchronously, wait for API response
          }
        }
        
        const scale = getScaleForModelId?.(placingModelId);
        const translation = getTranslationForModelId?.(placingModelId);
        const overrides = { ...(scale ? { modelScale: scale } : {}), ...(translation ? { modelTranslation: translation } : {}) };
        modelActions.addModelInstance(c, placingModelId, Object.keys(overrides).length ? overrides : undefined);
        return;
      }

      // Model seçimi yalnızca uzun basışta. Tek tık: seçili modeli bu noktaya taşır; seçim kapanmaz (kapatma alt bardaki X).
      if (!placingModelId && !shapeDrawingMode && !measurementMode && !parcelSelectMode && !resizeMode && !rotationMode && instancesCount > 0) {
        if (selectedModelId && updateModelInstance) {
          updateModelInstance(selectedModelId, { coordinate: c });
          return;
        }
      }
    },
    [
      handleHandleDrag,
      handleMeasurementPress,
      handleParcelSelect,
      handleShapeDrawingPress,
      instances,
      instancesCount,
      mapRef,
      measurementMode,
      modelActions,
      modelsProp,
      getScaleForModelId,
      getTranslationForModelId,
      onCheckModelSizeLimit,
      parcelSelectMode,
      placingModelId,
      resizeMode,
      rotationMode,
      shapeDrawingMode,
      getModelIdFromStringId,
      onBeforeAddModel,
      selectedModelId,
      updateModelInstance,
      shapes,
      onShapePress,
    ]
  );
}

