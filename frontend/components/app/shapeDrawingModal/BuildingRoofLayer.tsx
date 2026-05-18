import React, { useMemo } from "react";
import type { FeatureCollection, Geometry } from "geojson";

type Props = {
  Mapbox: any;
  geojson: FeatureCollection<Geometry, Record<string, unknown>> | null;
  visible?: boolean;
};

/**
 * Çatı şablonu — FillExtrusion + yerden yükseltilmiş çizgiler (3D haritada zemin düzleminde kalmaz).
 */
export const BuildingRoofLayer: React.FC<Props> = ({ Mapbox, geojson, visible = true }) => {
  const shape = useMemo(() => {
    if (!visible || !geojson?.features?.length) return null;
    return geojson;
  }, [geojson, visible]);

  if (!shape || !Mapbox?.ShapeSource || !Mapbox?.FillExtrusionLayer) return null;

  return (
    <Mapbox.ShapeSource id="building-roof-src" shape={shape as any}>
      <Mapbox.FillExtrusionLayer
        id="building-roof-extrusion"
        aboveLayerID="building-extrusion-fill"
        filter={["==", ["geometry-type"], "Polygon"]}
        style={{
          fillExtrusionBase: ["get", "extrusionBase"] as any,
          fillExtrusionHeight: ["get", "extrusionTop"] as any,
          fillExtrusionColor: ["get", "color"] as any,
          fillExtrusionOpacity: 0.82,
        }}
      />
      {Mapbox.LineLayer ? (
        <Mapbox.LineLayer
          id="building-roof-lines"
          aboveLayerID="building-roof-extrusion"
          filter={["==", ["geometry-type"], "LineString"]}
          style={{
            lineColor: ["get", "color"] as any,
            lineWidth: 2,
            lineOpacity: 0.95,
            lineZOffset: ["get", "lineZ"] as any,
            lineElevationReference: "ground",
          }}
        />
      ) : null}
    </Mapbox.ShapeSource>
  );
};
