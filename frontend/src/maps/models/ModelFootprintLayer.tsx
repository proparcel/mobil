/**
 * Seçili yapı modeli: taban poligonu + kenar uzunluk etiketleri (kare yaklaşımı).
 */
import React, { useMemo } from "react";
import { modelRotationToRotationDeg, type ModelInstance } from "./ModelManager";
import type { ModelCatalogFlatItem } from "./modelCatalog";
import { buildSquareFootprintGeometry, computeFootprintAreaM2 } from "./modelFootprint";

type Props = {
  Mapbox: any;
  selectedInstance: ModelInstance | null;
  catalogItem: ModelCatalogFlatItem | undefined;
};

export const ModelFootprintLayer: React.FC<Props> = ({ Mapbox, selectedInstance, catalogItem }) => {
  const shapes = useMemo(() => {
    if (!selectedInstance || !catalogItem?.isYapi) return null;
    const area = computeFootprintAreaM2(selectedInstance, catalogItem);
    if (area == null || !(area > 0)) return null;
    const rot = (selectedInstance.modelRotation || [0, 0, 0]) as [number, number, number];
    const deg = modelRotationToRotationDeg(rot);
    const geo = buildSquareFootprintGeometry(selectedInstance.coordinate, area, deg);
    const polyFc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [geo.polygonRing] },
          properties: {},
        },
      ],
    };
    const labelFc = {
      type: "FeatureCollection" as const,
      features: geo.labelFeatures,
    };
    return { polyFc, labelFc };
  }, [selectedInstance, catalogItem]);

  if (!shapes || !Mapbox?.ShapeSource) return null;
  const { FillLayer, LineLayer, SymbolLayer } = Mapbox;

  return (
    <>
      <Mapbox.ShapeSource id="model-footprint-poly" shape={shapes.polyFc}>
        {FillLayer ? (
          <FillLayer
            id="model-footprint-fill"
            style={{
              fillColor: "rgba(59, 130, 246, 0.18)",
              fillOpacity: 0.85,
            }}
          />
        ) : null}
        {LineLayer ? (
          <LineLayer
            id="model-footprint-line"
            style={{
              lineColor: "#3b82f6",
              lineWidth: 2,
              lineOpacity: 0.95,
            }}
          />
        ) : null}
      </Mapbox.ShapeSource>
      {SymbolLayer && (
        <Mapbox.ShapeSource id="model-footprint-labels" shape={shapes.labelFc}>
          <SymbolLayer
            id="model-footprint-symbols"
            style={{
              textField: ["get", "label"] as unknown as string,
              textSize: 12,
              textColor: "#f8fafc",
              textHaloColor: "#0f172a",
              textHaloWidth: 2,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </Mapbox.ShapeSource>
      )}
    </>
  );
};
