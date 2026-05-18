import React, { useMemo, useEffect } from "react";
import type { Feature, LineString, MultiLineString } from "geojson";
import { Platform } from "react-native";
import { ShapesLayer } from "@/src/maps/drawing/ShapesLayer";
import { ModelsLayer } from "@/src/maps/models/ModelsLayer";
import { ModelFootprintLayer } from "@/src/maps/models/ModelFootprintLayer";
import { BuildingExtrusionLayer } from "./BuildingExtrusionLayer";
import { BuildingGuideLayer } from "./BuildingGuideLayer";
import { BuildingWindowFrameLayer } from "./BuildingWindowFrameLayer";
import { BuildingRoofLayer } from "./BuildingRoofLayer";
import type { FeatureCollection, Geometry, Point } from "geojson";
import type { ModelCatalogFlatItem } from "@/src/maps/models/modelCatalog";
import { styles } from "./styles";

let SkyLayer: any = null;
let Atmosphere: any = null;
try {
  const mapboxModule = require("@rnmapbox/maps");
  if (mapboxModule.SkyLayer) SkyLayer = mapboxModule.SkyLayer;
  if (mapboxModule.Atmosphere) Atmosphere = mapboxModule.Atmosphere;
} catch {
  SkyLayer = null;
  Atmosphere = null;
}

const DEFAULT_RULER_HEX = "#3B82F6";
const DEFAULT_AREA_HEX = "#FBBF24";

function isValidMeasureColorHex(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("#") && /^#[0-9A-Fa-f]{6}$/i.test(v);
}

function lineColorForMeasureFeature(f: any, isSelected: boolean): string {
  const p = f?.properties;
  if (isValidMeasureColorHex(p?.measureColor)) return p.measureColor;
  const isRuler = p?.measurementType === "ruler";
  if (isRuler) return isSelected ? "#93c5fd" : DEFAULT_RULER_HEX;
  return isSelected ? "#fcd34d" : DEFAULT_AREA_HEX;
}

function labelTextColorForMeasureFeature(f: any): string {
  const p = f?.properties;
  if (isValidMeasureColorHex(p?.measureColor)) return p.measureColor;
  const isRuler = p?.measurementType === "ruler";
  return isRuler ? "#bfdbfe" : "#fef08a";
}

function fillColorForAreaFeature(f: any): string {
  const p = f?.properties;
  if (isValidMeasureColorHex(p?.measureColor)) return p.measureColor;
  return DEFAULT_AREA_HEX;
}

type Props = {
  Mapbox: any;
  RasterDemSource: any;
  Terrain: any;
  /** 2D başlangıç için false; kullanıcı 3D'ye geçince true (OOM riski azalır) */
  terrainEnabled?: boolean;
  mapRef: any;
  cameraRef: any;
  center: [number, number];
  zoom: number;
  /** Güncel zoom (kullanıcı zoom yaptığında sıçrama olmaması için) */
  cameraZoom?: number;
  /** Güncel merkez (kullanıcı pan yaptığında sıçrama olmaması için) */
  cameraCenter?: [number, number];
  /** Güncel yön / bearing (yön tuşu ile döndürmede sıçrama olmaması için) */
  cameraHeading?: number;
  scrollEnabled: boolean;
  zoomEnabled: boolean;
  pitchEnabled: boolean;
  rotateEnabled: boolean;
  onPress: (e: any) => void;
  onLongPress: (e: any) => void;
  onCameraChanged: (e: any) => void;
  modelsProp: Record<string, string | number>;
  modelInstances: any[];
  measurementFeatures: any[];
  shapeDraftPreview: any;
  orderedParcels: any[];
  selectedParcelId: any;
  shapes: any[];
  selectedShapeId: string | null;
  cameraZoom: number;
  onShapePress: (shapeId: string) => void;
  onHandlePress: (shapeId: string, handleIndex: number) => void;
  pitchValue?: number;
  mapReadyRef?: React.MutableRefObject<{ didFinishLoadingMap: boolean; didFinishLoadingStyle: boolean; isIdle: boolean }>;
  /** Harita render boşta (Mapbox onMapIdle); model görünürlük beklemesi vb. için */
  onMapIdle?: () => void;
  /** Hazırlık modunda: sis/fog kapatılır, kaydırma kolaylaştırılır */
  captureMode?: boolean;
  /** Seçili 3D model instance id - ModelsLayer'da mavi halka gösterilir */
  selectedModelId?: string | null;
  /** Ağaç modelleri için yerde beyaz hale (katalog groupId) */
  modelCatalogFlat?: ModelCatalogFlatItem[];
  /** Mesafe/alan ölçümü varken şekil dokunmalarını kapat */
  shapeInteractionLocked?: boolean;
  /** Seçili mesafe/alan ölçüm grubu (measurementGroupId) */
  selectedMeasurementGroupId?: string | null;
  /** Mesafe/alan grubuna dokunuldu (şekil seçimi gibi) */
  onMeasurementGroupPress?: (measurementGroupId: string) => void;
  /** Web Bina / Mapbox extrusion (FillExtrusion) */
  buildingExtrusionFeatures?: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: { height: number; opacity: number; id?: string };
  }>;
  buildingExtrusionVisible?: boolean;
  /** Bina sheet: web ile aynı çekme kılavuz çizgileri (LineString / MultiLineString) */
  buildingGuideFeature?: Feature<LineString | MultiLineString> | null;
  buildingGuideVisible?: boolean;
  /** Seçili bina taban çerçevesi */
  buildingSelectionOutlineRing?: [number, number][] | null;
  /** Pencere şablonu dikdörtgenleri (FillLayer + LineLayer, üstten görünüm) */
  buildingWindowFramePolygons?: import("geojson").FeatureCollection<import("geojson").Polygon> | null;
  /** Çatı şablonu (üstten görünüm: tabaka, parapet, mahya, pergola çizgileri) */
  buildingRoofGeoJSON?: FeatureCollection<Geometry, Record<string, unknown>> | null;
};

export const ShapeDrawingMapView: React.FC<Props> = ({
  Mapbox,
  RasterDemSource,
  Terrain,
  terrainEnabled = false,
  mapRef,
  cameraRef,
  center,
  zoom,
  cameraZoom: cameraZoomProp,
  cameraCenter: cameraCenterProp,
  cameraHeading: cameraHeadingProp,
  scrollEnabled,
  zoomEnabled,
  pitchEnabled,
  rotateEnabled,
  onPress,
  onLongPress,
  onCameraChanged,
  modelsProp,
  modelInstances,
  measurementFeatures,
  shapeDraftPreview,
  orderedParcels,
  selectedParcelId,
  shapes,
  selectedShapeId,
  cameraZoom,
  onShapePress,
  onHandlePress,
  pitchValue = 60,
  mapReadyRef,
  onMapIdle,
  captureMode = false,
  selectedModelId = null,
  modelCatalogFlat,
  shapeInteractionLocked = false,
  selectedMeasurementGroupId = null,
  onMeasurementGroupPress,
  buildingExtrusionFeatures = [],
  buildingExtrusionVisible = true,
  buildingGuideFeature = null,
  buildingGuideVisible = true,
  buildingSelectionOutlineRing = null,
  buildingWindowFramePolygons = null,
  buildingRoofGeoJSON = null,
}) => {
  const styleURL = useMemo(() => {
    return "mapbox://styles/mapbox/satellite-streets-v12";
  }, []);

  const modelsPropKeys = useMemo(() => Object.keys(modelsProp || {}), [modelsProp]);
  const hasModelsProp = modelsPropKeys.length > 0;

  const selectedFootprintInstance = useMemo(() => {
    if (!selectedModelId || !Array.isArray(modelInstances) || modelInstances.length === 0) return null;
    return modelInstances.find((m: { id: string }) => m.id === selectedModelId) ?? null;
  }, [selectedModelId, modelInstances]);

  const selectedFootprintCatalog = useMemo(() => {
    if (!selectedFootprintInstance || !modelCatalogFlat?.length) return undefined;
    const mid = selectedFootprintInstance.modelId;
    return modelCatalogFlat.find((c) => c.modelId === mid || String(c.id) === String(mid));
  }, [selectedFootprintInstance, modelCatalogFlat]);

  useEffect(() => {
    console.log("[3DEDIT] ShapeDrawingMapView mount (MapView + children render edilecek)");
    return () => console.log("[3DEDIT] ShapeDrawingMapView unmount");
  }, []);

  console.log("[3DEDIT] ShapeDrawingMapView render", {
    hasRasterDem: !!RasterDemSource,
    hasTerrain: !!Terrain,
    hasModelsProp,
    modelInstancesCount: modelInstances?.length ?? 0,
  });

  /** Mapbox v10: scrollEnabled tek başına bazı cihazlarda tek parmak pan’i zayıflatıyor; jestleri açıkça eşleştirir. */
  const gestureSettings = useMemo(
    () => ({
      panEnabled: scrollEnabled,
      pinchPanEnabled: scrollEnabled,
      pinchZoomEnabled: zoomEnabled,
      rotateEnabled,
      pitchEnabled,
      doubleTapToZoomInEnabled: zoomEnabled,
      doubleTouchToZoomOutEnabled: zoomEnabled,
      quickZoomEnabled: zoomEnabled,
      simultaneousRotateAndPinchZoomEnabled: true,
    }),
    [scrollEnabled, zoomEnabled, pitchEnabled, rotateEnabled]
  );

  return (
    <Mapbox.MapView
      ref={mapRef}
      style={styles.map}
      styleURL={styleURL}
      logoEnabled={false}
      attributionEnabled={false}
      scaleBarEnabled={false}
      surfaceView={Platform.OS === "android" ? false : undefined}
      requestDisallowInterceptTouchEvent={false}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      pitchEnabled={pitchEnabled}
      rotateEnabled={rotateEnabled}
      gestureSettings={gestureSettings}
      onPress={onPress}
      onLongPress={onLongPress}
      onCameraChanged={onCameraChanged}
      onDidFinishLoadingMap={mapReadyRef ? () => { mapReadyRef.current.didFinishLoadingMap = true; } : undefined}
      onDidFinishLoadingStyle={mapReadyRef ? () => { mapReadyRef.current.didFinishLoadingStyle = true; } : undefined}
      onMapIdle={() => {
        if (mapReadyRef) mapReadyRef.current.isIdle = true;
        onMapIdle?.();
      }}
      onError={(error: any) => {
        console.error("[3DEDIT] MapView onError:", error);
      }}
    >
      {Mapbox.Camera && (
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: zoom,
            pitch: 0,
            heading: typeof cameraHeadingProp === 'number' ? cameraHeadingProp : 20,
          }}
          maxZoomLevel={22}
          minZoomLevel={2}
        />
      )}

        {/* Hazırlık modunda: sis kapatılır, sadece mavi gökyüzü gradient */}
        {captureMode && Atmosphere && (
          <Atmosphere
            style={{
              range: [0, 0],
              color: "rgba(0,0,0,0)",
              highColor: "rgba(0,0,0,0)",
              spaceColor: "rgba(0,0,0,0)",
            }}
          />
        )}
        {captureMode && SkyLayer && (
          <SkyLayer
            id="capture-sky-layer"
            style={{
              skyType: "gradient",
              skyGradientCenter: [0, 90],
              skyGradientRadius: 90,
              skyGradient: ["interpolate", ["linear"], ["sky-radial-progress"], 0, "rgba(135, 206, 235, 1)", 1, "rgba(176, 224, 230, 0.9)"],
            }}
          />
        )}

        {/* Terrain (DEM) - sadece terrainEnabled true iken (2D başlangıç, OOM azalır) */}
        {terrainEnabled && RasterDemSource && Terrain ? (
          <>
            {(() => {
              console.log("[3DEDIT] Terrain bloğu render ediliyor (RasterDemSource + Terrain)");
              return null;
            })()}
            <RasterDemSource
              id="terrain-source"
              url="mapbox://mapbox.mapbox-terrain-dem-v1"
              tileSize={512}
              maxZoomLevel={15}
            />
            <Terrain sourceID="terrain-source" style={{ exaggeration: 1.4 }} />
          </>
        ) : null}

        {/* Models registry */}
        {(() => {
          if (Mapbox?.Models && hasModelsProp) {
            console.log("[3DEDIT] Mapbox.Models registry render ediliyor, model sayısı:", modelsPropKeys.length);
          }
          return null;
        })()}
        {Mapbox?.Models && hasModelsProp && (
          <Mapbox.Models models={modelsProp as any} />
        )}

        {/* Models Layer */}
        {hasModelsProp && Array.isArray(modelInstances) && modelInstances.length > 0 && (
          <ModelsLayer
            Mapbox={Mapbox}
            instances={modelInstances}
            modelsProp={modelsProp as any}
            selectedModelId={selectedModelId}
            modelCatalogFlat={modelCatalogFlat}
          />
        )}

        {selectedFootprintInstance && selectedFootprintCatalog?.isYapi && (
          <ModelFootprintLayer
            Mapbox={Mapbox}
            selectedInstance={selectedFootprintInstance}
            catalogItem={selectedFootprintCatalog}
          />
        )}

        <BuildingGuideLayer Mapbox={Mapbox} guideFeature={buildingGuideFeature} visible={buildingGuideVisible} />

        <BuildingExtrusionLayer
          Mapbox={Mapbox}
          features={buildingExtrusionFeatures}
          visible={buildingExtrusionVisible}
          selectionOutlineRing={buildingSelectionOutlineRing}
        />

        <BuildingWindowFrameLayer
          Mapbox={Mapbox}
          polygons={buildingWindowFramePolygons}
          visible={buildingExtrusionVisible}
        />

        <BuildingRoofLayer Mapbox={Mapbox} geojson={buildingRoofGeoJSON} visible={buildingExtrusionVisible} />

        {/* Measurement Layer */}
        {(measurementFeatures || []).map((f: any, i: number) => {
          const edgeKind = f?.properties?.kind;
          const hasLabel = f?.properties?.label && !f?.properties?.isTemporary;
          const isLabelOnly = f?.properties?.isLabelOnly === true;
          const measGid = f?.properties?.measurementGroupId;
          const hasMeasGroup = typeof measGid === "string" && measGid.length > 0;
          const isMeasSelected = hasMeasGroup && selectedMeasurementGroupId === measGid;
          const pressMeasGroup = () => {
            if (shapeInteractionLocked || !hasMeasGroup || !onMeasurementGroupPress) return;
            onMeasurementGroupPress(String(measGid));
          };

          // Kenar ölçüleri: BBox çerçevesi
          if (edgeKind === "bbox" && f?.geometry?.type === "LineString") {
            return (
              <Mapbox.ShapeSource key={`edge-bbox-${i}`} id={`edge-bbox-${i}`} shape={f}>
                <Mapbox.LineLayer
                  id={`edge-bbox-line-${i}`}
                  style={{
                    lineColor: "#f59e0b",
                    lineWidth: 2,
                    lineDasharray: [2, 2],
                  }}
                />
              </Mapbox.ShapeSource>
            );
          }

          // Kenar ölçüleri: segment / ana kenar etiketi (metre)
          if ((edgeKind === "segment" || edgeKind === "main_edge") && f?.geometry?.type === "Point") {
            const t = String(f?.properties?.text ?? "");
            return (
              <Mapbox.ShapeSource key={`edge-lbl-${i}`} id={`edge-lbl-${i}`} shape={f}>
                <Mapbox.CircleLayer
                  id={`edge-pick-${i}`}
                  style={{
                    circleRadius: 40,
                    circleColor: "#000000",
                    circleOpacity: 0.01,
                  }}
                />
                <Mapbox.SymbolLayer
                  id={`edge-lbl-layer-${i}`}
                  style={{
                    textField: t.length > 0 ? t : "—",
                    textSize: 14,
                    textColor: String(f?.properties?.color ?? "#f1f5f9"),
                    textHaloColor: "#020617",
                    textHaloWidth: 2.5,
                    textAnchor: "center",
                    textAllowOverlap: true,
                  }}
                />
              </Mapbox.ShapeSource>
            );
          }

          // Point feature (nokta noktaları)
          if (f?.geometry?.type === "Point" && !hasLabel && !isLabelOnly) {
            return (
              <Mapbox.ShapeSource
                key={`meas-pt-${i}`}
                id={`meas-pt-${i}`}
                shape={f}
                onPress={hasMeasGroup ? pressMeasGroup : undefined}
              >
                <Mapbox.CircleLayer
                  id={`meas-pt-layer-${i}`}
                  style={{
                    circleRadius: isMeasSelected ? 9 : 6,
                    circleColor: lineColorForMeasureFeature(f, isMeasSelected),
                    circleStrokeWidth: isMeasSelected ? 2 : 0,
                    circleStrokeColor: "#ffffff",
                  }}
                />
              </Mapbox.ShapeSource>
            );
          }

          // LineString feature (mesafe çizgileri)
          if (f?.geometry?.type === "LineString") {
            return (
              <Mapbox.ShapeSource
                key={`meas-ln-${i}`}
                id={`meas-ln-${i}`}
                shape={f}
                onPress={hasMeasGroup ? pressMeasGroup : undefined}
              >
                <Mapbox.LineLayer
                  id={`meas-ln-layer-${i}`}
                  style={{
                    lineColor: lineColorForMeasureFeature(f, isMeasSelected),
                    lineWidth: isMeasSelected ? 5 : 3,
                  }}
                />
              </Mapbox.ShapeSource>
            );
          }

          // Polygon feature (alan polygon'ları)
          if (f?.geometry?.type === "Polygon") {
            return (
              <Mapbox.ShapeSource
                key={`meas-poly-${i}`}
                id={`meas-poly-${i}`}
                shape={f}
                onPress={hasMeasGroup ? pressMeasGroup : undefined}
              >
                <Mapbox.FillLayer
                  id={`meas-poly-fill-${i}`}
                  style={{
                    fillColor: fillColorForAreaFeature(f),
                    fillOpacity: isMeasSelected ? 0.42 : 0.3,
                  }}
                />
                <Mapbox.LineLayer
                  id={`meas-poly-line-${i}`}
                  style={{
                    lineColor: lineColorForMeasureFeature(f, isMeasSelected),
                    lineWidth: isMeasSelected ? 4 : 3,
                  }}
                />
              </Mapbox.ShapeSource>
            );
          }

          // Label feature (mesafe/alan etiketleri)
          if (hasLabel && isLabelOnly) {
            return (
              <Mapbox.ShapeSource
                key={`meas-label-${i}`}
                id={`meas-label-${i}`}
                shape={f}
                onPress={hasMeasGroup ? pressMeasGroup : undefined}
              >
                <Mapbox.SymbolLayer
                  id={`meas-label-layer-${i}`}
                  style={{
                    textField: ["get", "label"],
                    textSize: isMeasSelected ? 14 : 13,
                    textColor: labelTextColorForMeasureFeature(f),
                    textHaloColor: "#020617",
                    textHaloWidth: isMeasSelected ? 3 : 2.5,
                    textAnchor: "center",
                    textAllowOverlap: true,
                  }}
                />
              </Mapbox.ShapeSource>
            );
          }

          return null;
        })}

        {/* Shape drawing preview (dokunulan noktalar + polygon/line taslak çizgisi) */}
        {shapeDraftPreview?.polygonFeature && (
          <Mapbox.ShapeSource id="shape-draft-poly" shape={shapeDraftPreview.polygonFeature as any}>
            <Mapbox.FillLayer
              id="shape-draft-poly-fill"
              style={{
                fillColor: "#3b82f6",
                fillOpacity: 0.15,
              }}
            />
            <Mapbox.LineLayer
              id="shape-draft-poly-line"
              style={{
                lineColor: "#3b82f6",
                lineWidth: 2,
                lineDasharray: [1.5, 1.5],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {shapeDraftPreview?.lineFeature && (
          <Mapbox.ShapeSource id="shape-draft-line" shape={shapeDraftPreview.lineFeature as any}>
            <Mapbox.LineLayer
              id="shape-draft-line-layer"
              style={{
                lineColor: "#3b82f6",
                lineWidth: 2,
                lineDasharray: [1.5, 1.5],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {(() => {
          const pointFeatures = shapeDraftPreview?.pointFeatures;
          if (!pointFeatures?.length) return null;
          return (
            <Mapbox.ShapeSource
              id="shape-draft-points"
              shape={
                {
                  type: "FeatureCollection",
                  features: pointFeatures,
                } as any
              }
            >
              <Mapbox.CircleLayer
                id="shape-draft-points-layer"
                style={{
                  circleRadius: 5,
                  circleColor: "#3b82f6",
                  circleStrokeWidth: 2,
                  circleStrokeColor: "#ffffff",
                }}
              />
            </Mapbox.ShapeSource>
          );
        })()}

        {/* Parsel: yalnızca kırmızı sınır çizgisi (dolgu / çift hat yok) */}
      {(orderedParcels || []).map((parcel: any) => {
          if (!parcel?.geometry) return null;
          const isSelected = selectedParcelId != null && selectedParcelId === parcel.id;
          return (
            <Mapbox.ShapeSource
              key={parcel.id}
              id={`parcel-${parcel.id}`}
              shape={{
                type: "Feature",
                geometry: parcel.geometry,
                properties: {},
              }}
            >
              <Mapbox.LineLayer
                id={`parcel-boundary-${parcel.id}`}
                style={{
                  lineColor: "#D32F2F",
                  lineWidth: isSelected ? 3 : 2,
                  lineOpacity: isSelected ? 1 : 0.85,
                }}
              />
            </Mapbox.ShapeSource>
          );
        })}

        {/* Shapes Layer */}
      {Array.isArray(shapes) && shapes.length > 0 && (
        <ShapesLayer
          shapes={shapes}
          selectedShapeId={selectedShapeId}
          cameraZoom={cameraZoom}
          onShapePress={onShapePress}
          onHandlePress={onHandlePress}
          Mapbox={Mapbox}
          interactionLocked={shapeInteractionLocked}
        />
      )}
    </Mapbox.MapView>
  );
};

