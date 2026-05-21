import React, { useMemo } from 'react';
import type { Geometry } from 'geojson';
import type { ParcelFillPatternId } from '../../src/constants/parcelPolygonDesign';
import { buildParcelPatternPointCollection } from '../../src/utils/parcelPatternGrid';

/** Desen glifleri — parsel yazısının altında */
export const PARCEL_PATTERN_SYMBOL_SORT_KEY = 1;

type MapboxModule = {
  ShapeSource: React.ComponentType<{
    id: string;
    shape: object;
    children?: React.ReactNode;
  }>;
  SymbolLayer: React.ComponentType<{ id: string; style: object }>;
};

type Props = {
  Mapbox: MapboxModule;
  idPrefix: string;
  geometry: Geometry;
  patternId: ParcelFillPatternId;
  tintColor: string;
  patternSizeScale?: number;
};

export function ParcelPatternLayer({
  Mapbox,
  idPrefix,
  geometry,
  patternId,
  tintColor,
  patternSizeScale = 1,
}: Props) {
  const collection = useMemo(
    () => buildParcelPatternPointCollection(geometry, patternId, patternSizeScale),
    [geometry, patternId, patternSizeScale]
  );

  if (!collection.features.length) return null;

  return (
    <Mapbox.ShapeSource id={`${idPrefix}-pattern-src`} shape={collection}>
      <Mapbox.SymbolLayer
        id={`${idPrefix}-pattern-sym`}
        style={{
          textField: ['get', 'glyph'],
          textSize: ['get', 'textSize'],
          textColor: tintColor,
          textOpacity: 0.42,
          textHaloColor: 'rgba(0,0,0,0.12)',
          textHaloWidth: 0.5,
          textAllowOverlap: true,
          textIgnorePlacement: true,
          symbolSortKey: PARCEL_PATTERN_SYMBOL_SORT_KEY,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
