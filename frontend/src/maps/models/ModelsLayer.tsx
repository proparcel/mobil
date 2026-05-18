/**
 * ModelsLayer
 * Mapbox ShapeSource + ModelLayer ile GLB/GLTF instance render
 * Her instance için modelScale ve modelRotation kullanılır.
 */
import React, { useMemo, useEffect } from "react";
import { MIN_MODEL_SCALE, type ModelInstance } from "./ModelManager";
import type { ModelCatalogFlatItem } from "./modelCatalog";

type ModelsLayerProps = {
  Mapbox: any;
  instances: ModelInstance[];
  /** Mapbox.Models'e verilen string mapping */
  modelsProp?: Record<string, string | number>;
  /** Seçili instance id - mavi halka gösterilir */
  selectedModelId?: string | null;
  /** Katalog: ağaç modelleri (groupId tree) için hafif bulutumsu arka plan */
  modelCatalogFlat?: ModelCatalogFlatItem[];
};

const MODELS_PICK_LAYER_ID = "models-pick";

/** Ekran px — model ölçeği büyüdükçe hit alanı büyür (merkez dışına basışta da seçim). */
function pickRadiusPxForInstance(m: ModelInstance): number {
  const sc = (m.modelScale || [1, 1, 1]) as [number, number, number];
  const s = Math.max(
    Number.isFinite(sc[0]) ? sc[0] : 1,
    Number.isFinite(sc[1]) ? sc[1] : 1,
    Number.isFinite(sc[2]) ? sc[2] : 1
  );
  const r = 48 + 52 * Math.sqrt(Math.max(MIN_MODEL_SCALE, s));
  return Math.round(Math.min(240, Math.max(44, r)));
}

function isTreeModelId(modelId: string, catalog: ModelCatalogFlatItem[] | undefined): boolean {
  if (!catalog?.length) return false;
  const item = catalog.find(
    (x) => x.modelId === modelId || (x.id != null && String(x.id) === String(modelId))
  );
  return item?.groupId === "tree";
}

/**
 * Ağaç için ekrana dönük yumuşak bulut (px) — harita düzlemine yapışık daire değil;
 * viewport hizalı + yüksek blur ile genel siluet arkasında kalır.
 */
function treeCloudRadiusPx(m: ModelInstance): number {
  const sc = (m.modelScale || [1, 1, 1]) as [number, number, number];
  const s = Math.max(
    Number.isFinite(sc[0]) ? sc[0] : 1,
    Number.isFinite(sc[1]) ? sc[1] : 1,
    Number.isFinite(sc[2]) ? sc[2] : 1
  );
  const r = 36 + 22 * Math.sqrt(Math.max(MIN_MODEL_SCALE, s));
  return Math.round(Math.min(120, Math.max(36, r)));
}

export const ModelsLayer: React.FC<ModelsLayerProps> = ({
  Mapbox,
  instances,
  modelsProp,
  selectedModelId = null,
  modelCatalogFlat,
}) => {
  useEffect(() => {
    if (__DEV__ && instances.length > 0) {
      console.log('[ModelsLayer] Mount/update:', {
        instancesCount: instances.length,
        modelIds: instances.map((i) => i.modelId),
        modelsPropKeys: Object.keys(modelsProp || {}),
      });
    }
  }, [instances.length, modelsProp, instances]);

  // ModelLayer component kontrolü - JS paketi 10.x, native SDK v11 gerekir
  if (!Mapbox || !Mapbox.ShapeSource) {
    if (__DEV__) {
      console.warn("[ModelsLayer] Missing Mapbox components:", {
        hasMapbox: Boolean(Mapbox),
        hasShapeSource: Boolean(Mapbox?.ShapeSource),
        hasModelLayer: Boolean(Mapbox?.ModelLayer),
      });
    }
    return null;
  }

  // ModelLayer yoksa render etme (null hatası önleme)
  // KRİTİK: ModelLayer native Mapbox SDK v11 gerektirir (JS paketi 10.x kalır)
  // app.config.js'de RNMapboxMapsVersion: "11.0.0" ayarlı olmalı ve native rebuild yapılmalı
  if (!Mapbox.ModelLayer) {
    if (__DEV__) {
      console.warn("[ModelsLayer] ModelLayer component not available - requires native Mapbox SDK v11 (check app.config.js RNMapboxMapsVersion and rebuild native)");
    }
    return null;
  }

  // Her instance için ayrı ModelLayer (per-instance scale/rotation)
  const pickShape = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: instances.map((m) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: m.coordinate },
        properties: { instanceId: m.id, pickRadius: pickRadiusPxForInstance(m) },
      })),
    }),
    [instances]
  );

  const selectionRingShape = useMemo(() => {
    const sel = instances.find((m) => m.id === selectedModelId);
    if (!sel) return { type: "FeatureCollection" as const, features: [] };
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: sel.coordinate },
          properties: {},
        },
      ],
    };
  }, [instances, selectedModelId]);

  const treeHaloShape = useMemo(() => {
    const features = instances
      .filter((m) => isTreeModelId(m.modelId, modelCatalogFlat))
      .map((m) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: m.coordinate },
        properties: { cloudR: treeCloudRadiusPx(m) },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [instances, modelCatalogFlat]);

  return (
    <>
      {/* Ağaçlar: kök noktasından viewport’ta yukarı kaydırılmış yumuşak bulut (taç/gövde hizası) */}
      {treeHaloShape.features.length > 0 && Mapbox.CircleLayer && (
        <Mapbox.ShapeSource id="models-tree-cloud-source" shape={treeHaloShape}>
          <Mapbox.CircleLayer
            id="models-tree-cloud-ambient"
            style={{
              circleRadius: ["get", "cloudR"] as unknown as number,
              circleColor: "rgba(255,255,255,0.2)",
              circleOpacity: 1,
              circleBlur: 1.25,
              circlePitchAlignment: "viewport",
              circlePitchScale: "viewport",
              circleTranslateAnchor: "viewport",
              /** Kök koordinatı ekranda ağacın altında kalır; [x,y] negatif y = yukarı (px), taç/gövde hizası */
              circleTranslate: [0, -78],
            }}
          />
        </Mapbox.ShapeSource>
      )}

      {instances.map((m) => {
        const modelEntry = modelsProp?.[m.modelId];
        const hasModel = modelEntry !== undefined && modelEntry !== null && String(modelEntry).trim() !== "";
        if (!hasModel) {
          if (__DEV__) {
            console.warn("[ModelsLayer] Mapbox.Models kaydında yok, ModelLayer atlanıyor:", {
              instanceId: m.id,
              modelId: m.modelId,
              registryKeys: Object.keys(modelsProp || {}),
            });
          }
          return null;
        }
        const shape = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: m.coordinate },
              properties: {
                id: m.id,
                modelId: m.modelId,
              },
            },
          ],
        };
        const scale = (m.modelScale || [1, 1, 1]) as [number, number, number];
        const translation = (m.modelTranslation ?? [0, 0, 0]) as [number, number, number];
        const rotation = (m.modelRotation ?? [0, 0, 0]) as [number, number, number];
        const opacity = typeof m.modelOpacity === "number" && Number.isFinite(m.modelOpacity) ? m.modelOpacity : 1;
        return (
          <React.Fragment key={`models-inst-${m.id}`}>
            <Mapbox.ShapeSource id={`models-source-${m.id}`} shape={shape}>
              {Mapbox.ModelLayer && (
                <Mapbox.ModelLayer
                  id={`models-layer-${m.id}`}
                  style={{
                    modelId: m.modelId,
                    modelScale: scale,
                    modelTranslation: translation,
                    modelRotation: rotation,
                    modelOpacity: opacity,
                  }}
                />
              )}
            </Mapbox.ShapeSource>
          </React.Fragment>
        );
      })}

      {/* Pick layer - hit-test için, queryRenderedFeaturesAtPoint ile instanceId alınır */}
      {instances.length > 0 && Mapbox.CircleLayer && (
        <Mapbox.ShapeSource id="models-pick-source" shape={pickShape}>
          <Mapbox.CircleLayer
            id={MODELS_PICK_LAYER_ID}
            style={{
              circleRadius: ["get", "pickRadius"] as unknown as number,
              circleColor: "#000000",
              circleOpacity: 0.01,
              circleStrokeWidth: 0,
            }}
          />
        </Mapbox.ShapeSource>
      )}

      {/* Selection ring - seçili model etrafında mavi halka */}
      {selectedModelId && Mapbox.CircleLayer && selectionRingShape.features.length > 0 && (
        <Mapbox.ShapeSource id="models-selection-source" shape={selectionRingShape}>
          <Mapbox.CircleLayer
            id="models-selection-ring"
            style={{
              circleRadius: 14,
              circleColor: "transparent",
              circleStrokeWidth: 4,
              circleStrokeColor: "#3b82f6",
            }}
          />
        </Mapbox.ShapeSource>
      )}
    </>
  );
};

