import React from 'react';

/** Parsel ada/parsel yazısı — tüm desenlerin üstünde */
export const PARCEL_LABEL_SYMBOL_SORT_KEY = 50000;

/** 3D pitch'te yazıyı ekranda yukarı kaydırır (ems; negatif = yukarı). Anchor centroid'te kalır. */
export const PARCEL_LABEL_3D_TEXT_OFFSET: [number, number] = [0, -3.2];

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
  /** 3D modda yazı parselin üstüne binmesin diye ekranda yukarı offset uygulanır */
  is3DMode?: boolean;
};

export function ParcelLabelLayer({ Mapbox, idPrefix, centroid, labelText, is3DMode = false }: Props) {
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
          ...(is3DMode ? { textOffset: PARCEL_LABEL_3D_TEXT_OFFSET } : {}),
          textAllowOverlap: true,
          textIgnorePlacement: true,
          symbolSortKey: PARCEL_LABEL_SYMBOL_SORT_KEY,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
