import React, { useMemo } from "react";
import type { Feature, LineString, MultiLineString } from "geojson";

type Props = {
  Mapbox: any;
  /** Web drawInsetGuides ile uyumlu: iç buffer veya bbox kenar çizgileri (çizgi, dolgu yok) */
  guideFeature: Feature<LineString | MultiLineString> | null;
  visible?: boolean;
};

/**
 * Bina sheet: çekme kılavuz çizgileri (kesik mavi, web ile aynı anlamda).
 */
export const BuildingGuideLayer: React.FC<Props> = ({ Mapbox, guideFeature, visible = true }) => {
  const shape = useMemo(() => {
    if (!visible || !guideFeature?.geometry) return null;
    return {
      type: "Feature" as const,
      properties: { ...(guideFeature.properties || {}), kind: "building-inset-guide" },
      geometry: guideFeature.geometry,
    };
  }, [guideFeature, visible]);

  if (!shape || !Mapbox?.ShapeSource || !Mapbox?.LineLayer) return null;

  return (
    <Mapbox.ShapeSource id="building-guide-src" shape={shape as any}>
      <Mapbox.LineLayer
        id="building-guide-line"
        style={{
          lineColor: "rgba(59, 130, 246, 0.7)",
          lineWidth: 2,
          lineDasharray: [2, 2],
        }}
      />
    </Mapbox.ShapeSource>
  );
};
