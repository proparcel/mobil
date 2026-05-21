import React from 'react';

/** Parsel ada/parsel yazısı — tüm desenlerin üstünde */
export const PARCEL_LABEL_SYMBOL_SORT_KEY = 50000;

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
  centroid: [number, number];
  labelText: string;
};

export function ParcelLabelLayer({ Mapbox, idPrefix, centroid, labelText }: Props) {
  return (
    <Mapbox.ShapeSource
      id={`${idPrefix}-label-src`}
      shape={{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: { label: labelText },
      }}
    >
      <Mapbox.SymbolLayer
        id={`${idPrefix}-label-sym`}
        style={{
          textField: ['get', 'label'],
          textSize: 12,
          textColor: '#ffffff',
          textHaloColor: '#000000',
          textHaloWidth: 2.5,
          textAnchor: 'center',
          textAllowOverlap: true,
          textIgnorePlacement: true,
          symbolSortKey: PARCEL_LABEL_SYMBOL_SORT_KEY,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
