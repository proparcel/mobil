import React from "react";
import type { ShapeDraftPreview } from "./useShapeDrawingSession";

type Props = {
  Mapbox: any;
  preview: ShapeDraftPreview;
  idPrefix?: string;
  outlineColor?: string;
};

/** Çizim taslağı: ilk/ara noktalar + kesik çizgi (tamamlanınca session noktaları temizler). */
export function ShapeDraftPreviewLayers({
  Mapbox,
  preview,
  idPrefix = "shape-draft",
  outlineColor = "#3b82f6",
}: Props) {
  if (!Mapbox || !preview) return null;

  return (
    <>
      {preview.polygonFeature ? (
        <Mapbox.ShapeSource id={`${idPrefix}-poly`} shape={preview.polygonFeature as any}>
          <Mapbox.FillLayer
            id={`${idPrefix}-poly-fill`}
            style={{
              fillColor: outlineColor,
              fillOpacity: 0.15,
            }}
          />
          <Mapbox.LineLayer
            id={`${idPrefix}-poly-line`}
            style={{
              lineColor: outlineColor,
              lineWidth: 2,
              lineDasharray: [1.5, 1.5],
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}

      {preview.lineFeature ? (
        <Mapbox.ShapeSource id={`${idPrefix}-line`} shape={preview.lineFeature as any}>
          <Mapbox.LineLayer
            id={`${idPrefix}-line-layer`}
            style={{
              lineColor: outlineColor,
              lineWidth: 2.5,
              lineOpacity: 0.9,
              lineDasharray: [1.2, 1.2],
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}

      {preview.pointFeatures.length > 0 ? (
        <Mapbox.ShapeSource
          id={`${idPrefix}-points`}
          shape={{
            type: "FeatureCollection",
            features: preview.pointFeatures,
          }}
        >
          <Mapbox.CircleLayer
            id={`${idPrefix}-points-layer`}
            style={{
              circleRadius: 7,
              circleColor: outlineColor,
              circleStrokeWidth: 2,
              circleStrokeColor: "#ffffff",
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}
    </>
  );
}
