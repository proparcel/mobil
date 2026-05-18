/**
 * Web `quarter_info/layers.js` ile aynı katmanların Mapbox RN üzerinde çizimi.
 */
import React from "react";
import {
  LAYER_PAINT,
  QUARTER_LAYER_DEFS,
  normalizeQuarterLayerGeoJson,
  type QuarterLayerDef,
} from "../../src/utils/quarterInfoMapLayers";

type Props = {
  Mapbox: any;
  layers: Record<string, unknown> | undefined;
  visibility: Record<string, boolean>;
};

function renderLayer(Mapbox: any, def: QuarterLayerDef, shape: object, layerId: string) {
  const paint = LAYER_PAINT[def.layerId];
  if (!paint) return null;

  if (def.kind === "circle" && paint.circle) {
    return (
      <Mapbox.ShapeSource id={`pml-src-${layerId}`} shape={shape}>
        <Mapbox.CircleLayer
          id={`pml-circ-${layerId}`}
          style={{
            circleColor: paint.circle.circleColor,
            circleRadius: paint.circle.circleRadius ?? 8,
            circleOpacity: paint.circle.circleOpacity ?? 0.9,
          }}
        />
      </Mapbox.ShapeSource>
    );
  }

  if (def.kind === "line" && paint.line) {
    return (
      <Mapbox.ShapeSource id={`pml-src-${layerId}`} shape={shape}>
        <Mapbox.LineLayer
          id={`pml-line-${layerId}`}
          style={{
            lineColor: paint.line.lineColor,
            lineWidth: paint.line.lineWidth ?? 2,
            lineOpacity: paint.line.lineOpacity ?? 0.85,
          }}
        />
      </Mapbox.ShapeSource>
    );
  }

  if (def.kind === "fill" && paint.fill) {
    return (
      <Mapbox.ShapeSource id={`pml-src-${layerId}`} shape={shape}>
        <Mapbox.FillLayer
          id={`pml-fill-${layerId}`}
          style={{
            fillColor: paint.fill.fillColor,
            fillOpacity: paint.fill.fillOpacity ?? 0.4,
          }}
        />
        <Mapbox.LineLayer
          id={`pml-fill-border-${layerId}`}
          style={{
            lineColor: paint.fill.fillColor,
            lineWidth: 2,
            lineOpacity: 0.85,
          }}
        />
      </Mapbox.ShapeSource>
    );
  }

  if (def.kind === "gridFill" && paint.fill) {
    const gridStyle: Record<string, unknown> = {
      fillOpacity: 0.3,
      fillColor: [
        "case",
        ["<=", ["get", "score"], 4],
        "#FF0000",
        ["<=", ["get", "score"], 7],
        "#FFFF00",
        ["<=", ["get", "score"], 9],
        "#00FF00",
        ["==", ["get", "score"], 10],
        "#0066FF",
        "#CCCCCC",
      ],
    };
    return (
      <Mapbox.ShapeSource id={`pml-src-${layerId}`} shape={shape}>
        <Mapbox.FillLayer id={`pml-grid-${layerId}`} style={gridStyle as object} />
      </Mapbox.ShapeSource>
    );
  }

  if (def.kind === "fillSlope") {
    const slopeStyle: Record<string, unknown> = {
      fillOpacity: 0.38,
      fillColor: [
        "match",
        ["get", "band"],
        "below_20",
        "#22c55e",
        "between_20_30",
        "#facc15",
        "over_30",
        "#ef4444",
        "#94a3b8",
      ],
    };
    return (
      <Mapbox.ShapeSource id={`pml-src-${layerId}`} shape={shape}>
        <Mapbox.FillLayer id={`pml-slope-${layerId}`} style={slopeStyle as object} />
      </Mapbox.ShapeSource>
    );
  }

  return null;
}

export function PromahalleMapLayers({ Mapbox, layers, visibility }: Props) {
  if (!Mapbox || !layers) return null;

  return (
    <>
      {QUARTER_LAYER_DEFS.map((def) => {
        const on = visibility[def.layerId];
        if (!on) return null;
        const raw = layers[def.layerId];
        const shape = normalizeQuarterLayerGeoJson(raw);
        if (!shape) return null;
        const node = renderLayer(Mapbox, def, shape, def.layerId);
        return node ? <React.Fragment key={def.layerId}>{node}</React.Fragment> : null;
      })}
    </>
  );
}
