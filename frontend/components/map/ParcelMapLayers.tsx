/**

 * Parsel: lacivert dolgu + mavi/lacivert kenar.

 * ShapeSource içinde: {createParcelMapLayers(Mapbox, idPrefix, selected)}

 */

import React from "react";

import type { ParcelPolygonDesignConfig } from "../../src/constants/parcelPolygonDesign";
import { getParcelMapLayerStyle } from "../../src/constants/parcelMapStyle";



type MapboxLayerModule = {
  FillLayer: React.ComponentType<{ id: string; style: object }>;
  LineLayer: React.ComponentType<{ id: string; style: object }>;
};

export function createParcelFillLayer(
  Mapbox: MapboxLayerModule,
  idPrefix: string,
  selected: boolean,
  customStyle?: ParcelPolygonDesignConfig | null
): React.ReactElement {
  const layer = getParcelMapLayerStyle(selected, customStyle);
  return (
    <Mapbox.FillLayer
      key={`${idPrefix}-fill`}
      id={`${idPrefix}-fill`}
      style={{ fillColor: layer.fillColor, fillOpacity: layer.fillOpacity }}
    />
  );
}

/** Desen katmanının üstünde — kenar taşmasını görsel olarak keser */
export function createParcelStrokeLayer(
  Mapbox: MapboxLayerModule,
  idPrefix: string,
  selected: boolean,
  customStyle?: ParcelPolygonDesignConfig | null
): React.ReactElement {
  const layer = getParcelMapLayerStyle(selected, customStyle);
  return (
    <Mapbox.LineLayer
      key={`${idPrefix}-stroke`}
      id={`${idPrefix}-stroke`}
      style={{ lineColor: layer.lineColor, lineWidth: layer.lineWidth }}
    />
  );
}

export function createParcelMapLayers(
  Mapbox: MapboxLayerModule,
  idPrefix: string,
  selected: boolean,
  customStyle?: ParcelPolygonDesignConfig | null
): React.ReactElement[] {
  return [
    createParcelFillLayer(Mapbox, idPrefix, selected, customStyle),
    createParcelStrokeLayer(Mapbox, idPrefix, selected, customStyle),
  ];
}


