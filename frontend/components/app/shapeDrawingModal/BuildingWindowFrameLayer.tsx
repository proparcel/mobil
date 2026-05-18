import React, { useMemo } from "react";
import type { FeatureCollection, Polygon } from "geojson";

/** Pencere bandı yarı yüksekliği (m); z = kat ortası, dikey aralık ~1.1 m */
const WIN_HALF_H = 0.55;

type Props = {
  Mapbox: any;
  /** Pencere cephe dikdörtgenleri (üstten görünüm, generateWindowFramePolygonsFeatureCollection) */
  polygons: FeatureCollection<Polygon> | null;
  visible?: boolean;
};

/**
 * Bina cephe pencereleri — FillExtrusion + yerden yükseltilmiş çerçeve (2D Fill yerine; 3D’de zeminde kalmaz).
 */
export const BuildingWindowFrameLayer: React.FC<Props> = ({ Mapbox, polygons, visible = true }) => {
  const shape = useMemo(() => {
    if (!visible || !polygons?.features?.length) return null;
    return polygons;
  }, [polygons, visible]);

  if (!shape || !Mapbox?.ShapeSource || !Mapbox?.FillExtrusionLayer) return null;

  return (
    <Mapbox.ShapeSource id="building-window-frames-src" shape={shape as any}>
      <Mapbox.FillExtrusionLayer
        id="building-window-frames-fill"
        aboveLayerID="building-extrusion-fill"
        style={{
          fillExtrusionBase: ["-", ["get", "z"], WIN_HALF_H] as any,
          fillExtrusionHeight: ["+", ["get", "z"], WIN_HALF_H] as any,
          fillExtrusionColor: ["coalesce", ["get", "glassColor"], "#475569"] as any,
          fillExtrusionOpacity: 0.88,
        }}
      />
      {Mapbox.LineLayer ? (
        <Mapbox.LineLayer
          id="building-window-frames-outline"
          aboveLayerID="building-window-frames-fill"
          style={{
            lineColor: ["coalesce", ["get", "borderColor"], "#0f172a"] as any,
            lineWidth: 2,
            lineOpacity: 0.95,
            lineZOffset: ["get", "z"] as any,
            lineElevationReference: "ground",
          }}
        />
      ) : null}
    </Mapbox.ShapeSource>
  );
};
