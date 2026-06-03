import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Geometry, Point } from 'geojson';
import type { ParcelFillPatternId } from '../../src/constants/parcelPolygonDesign';
import { projectLngLatsBatch } from '../../src/maps/drawing/shapeScreenProjection';
import {
  buildParcelPatternPointCollection,
  buildParcelPatternScreenGrid,
  collectGeometryRingCoords,
} from '../../src/utils/parcelPatternGrid';

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
  mapRef?: React.RefObject<any>;
  /** Kamera/zoom değişince artırılır — ekran ızgarası yeniden hesaplanır */
  layoutTick?: number;
};

export function ParcelPatternLayer({
  Mapbox,
  idPrefix,
  geometry,
  patternId,
  tintColor,
  patternSizeScale = 1,
  mapRef,
  layoutTick = 0,
}: Props) {
  const [collection, setCollection] = useState<FeatureCollection<Point>>(() =>
    buildParcelPatternPointCollection(geometry, patternId, { patternSizeScale })
  );
  const projectSeqRef = useRef(0);

  const fallbackCollection = useMemo(
    () => buildParcelPatternPointCollection(geometry, patternId, { patternSizeScale }),
    [geometry, patternId, patternSizeScale]
  );

  useEffect(() => {
    let cancelled = false;
    const seq = ++projectSeqRef.current;

    void (async () => {
      const ring = collectGeometryRingCoords(geometry);
      let next = fallbackCollection;

      if (mapRef?.current && ring.length > 0) {
        const projected = await projectLngLatsBatch(mapRef, ring);
        const valid = projected.filter(
          (p): p is [number, number] => p != null && Number.isFinite(p[0]) && Number.isFinite(p[1])
        );
        if (valid.length > 0) {
          next = await buildParcelPatternScreenGrid(
            mapRef,
            geometry,
            patternId,
            patternSizeScale,
            valid
          );
        }
      }

      if (!cancelled && seq === projectSeqRef.current) {
        setCollection(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geometry, patternId, patternSizeScale, mapRef, layoutTick, fallbackCollection]);

  const activeCollection =
    collection.features.length > 0 ? collection : fallbackCollection;

  if (!activeCollection.features.length) return null;

  return (
    <Mapbox.ShapeSource id={`${idPrefix}-pattern-src`} shape={activeCollection}>
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
