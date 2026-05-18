import React, { useMemo } from "react";

export type BuildingPolyFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    height: number;
    opacity: number;
    id: string;
    cr?: number;
    cg?: number;
    cb?: number;
    /** UI renk seçimi */
    colorHex?: string;
    frameTemplate?: string;
    roofTemplate?: string;
    floorCount?: number;
    floorHeightM?: number;
    windowGlassColor?: string;
    windowBorderColor?: string;
    windowBorderThicknessM?: number;
    windowCrossMullion?: boolean;
  };
};

type Props = {
  Mapbox: any;
  /** Bina polygon özellikleri: height (m), opacity (0–1), cr/cg/cb (0–255) */
  features: BuildingPolyFeature[];
  visible?: boolean;
  /** Seçili binanın taban çerçevesi (vurgu) */
  selectionOutlineRing?: [number, number][] | null;
};

/**
 * Parsel üzerinde web ile uyumlu bina kütlesi (FillExtrusion).
 */
export const BuildingExtrusionLayer: React.FC<Props> = ({
  Mapbox,
  features,
  visible = true,
  selectionOutlineRing = null,
}) => {
  const shape = useMemo(() => {
    if (!visible || !features?.length) return null;
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [features, visible]);

  const outlineShape = useMemo(() => {
    if (!visible || !selectionOutlineRing || selectionOutlineRing.length < 3) return null;
    return {
      type: "Feature" as const,
      properties: { kind: "building-selection" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [selectionOutlineRing],
      },
    };
  }, [selectionOutlineRing, visible]);

  if (!shape || !Mapbox?.ShapeSource || !Mapbox?.FillExtrusionLayer) return null;

  return (
    <>
      <Mapbox.ShapeSource id="building-extrusion-src" shape={shape as any}>
        <Mapbox.FillExtrusionLayer
          id="building-extrusion-fill"
          style={{
            fillExtrusionColor: [
              "rgba",
              ["coalesce", ["get", "cr"], 156],
              ["coalesce", ["get", "cg"], 163],
              ["coalesce", ["get", "cb"], 175],
              ["coalesce", ["get", "opacity"], 0.85],
            ],
            fillExtrusionHeight: ["get", "height"],
            fillExtrusionVerticalGradient: false,
          }}
        />
      </Mapbox.ShapeSource>
      {outlineShape && Mapbox?.LineLayer ? (
        <Mapbox.ShapeSource id="building-selection-outline-src" shape={outlineShape as any}>
          <Mapbox.LineLayer
            id="building-selection-outline"
            style={{
              lineColor: "#38bdf8",
              lineWidth: 3,
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}
    </>
  );
};
