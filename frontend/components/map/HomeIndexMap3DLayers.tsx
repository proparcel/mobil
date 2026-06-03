/**
 * Ana sayfa (index) 3D modunda kullanılan terrain + mavi atmosfer gökyüzü.
 * index.tsx içindeki `is3DMode` blokunun tek kaynağı — başka ekranlar buradan tüketir.
 */
import React from "react";

let RasterDemSource: React.ComponentType<any> | null = null;
let Terrain: React.ComponentType<any> | null = null;
let SkyLayer: React.ComponentType<any> | null = null;

try {
  const mapboxModule = require("@rnmapbox/maps");
  if (mapboxModule.RasterDemSource) RasterDemSource = mapboxModule.RasterDemSource;
  if (mapboxModule.Terrain) Terrain = mapboxModule.Terrain;
  if (mapboxModule.SkyLayer) SkyLayer = mapboxModule.SkyLayer;
} catch {
  /* Mapbox yok */
}

/** index.tsx MapView `styleURL` */
export function homeIndexMapStyleURL(Mapbox: { StyleURL?: { SatelliteStreet?: string; Default?: string } } | null) {
  return Mapbox?.StyleURL?.SatelliteStreet || Mapbox?.StyleURL?.Default || "";
}

/** index.tsx `is3DMode && SkyLayer` paint — atmosphere mavi gökyüzü */
export const HOME_INDEX_MAP_3D_SKY_STYLE = {
  skyType: "atmosphere" as const,
  skyAtmosphereSun: [0.0, 0.0] as [number, number],
  skyAtmosphereSunIntensity: 15.0,
  skyAtmosphereColor: "rgba(135, 206, 235, 1)",
  skyAtmosphereHaloColor: "rgba(255, 223, 186, 0.5)",
};

/** index.tsx terrain DEM */
export const HOME_INDEX_MAP_3D_TERRAIN = {
  demUrl: "mapbox://mapbox.mapbox-terrain-dem-v1",
  tileSize: 512,
  maxZoomLevel: 15,
  exaggeration: 1.2,
};

type Props = {
  /** Aynı MapView içinde birden fazla kullanımda katman id çakışmasını önler */
  idPrefix?: string;
};

export function HomeIndexMap3DLayers({ idPrefix = "home-index" }: Props) {
  if (!RasterDemSource || !Terrain || !SkyLayer) return null;

  const demId = `${idPrefix}-mapbox-dem`;
  const skyId = `${idPrefix}-sky-layer`;

  return (
    <>
      <RasterDemSource
        id={demId}
        url={HOME_INDEX_MAP_3D_TERRAIN.demUrl}
        tileSize={HOME_INDEX_MAP_3D_TERRAIN.tileSize}
        maxZoomLevel={HOME_INDEX_MAP_3D_TERRAIN.maxZoomLevel}
      >
        <Terrain style={{ exaggeration: HOME_INDEX_MAP_3D_TERRAIN.exaggeration }} />
      </RasterDemSource>
      <SkyLayer id={skyId} style={HOME_INDEX_MAP_3D_SKY_STYLE} />
    </>
  );
}

export function homeIndexMap3DLayersAvailable(): boolean {
  return !!(RasterDemSource && Terrain && SkyLayer);
}
