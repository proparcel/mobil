/**

 * Parsel poligon stilleri — landingTheme: lacivert dolgu, açık mavi kenar.

 */

import { landingColors } from "../../components/landing/landingTheme";
import type { ParcelPolygonDesignConfig } from "./parcelPolygonDesign";



export const parcelMapStyle = {

  /** İç dolgu — lacivert, saydam */

  fill: landingColors.bgPanel,

  fillOpacity: 0.38,

  /** Seçili parsel — biraz daha koyu lacivert */

  fillHighlight: landingColors.bgMid,

  fillOpacityHighlight: 0.5,

  /** Kenar — açık mavi */

  stroke: landingColors.electricBlue,

  strokeWidth: 2,

  /** Seçili kenar — sistem kenar rengini korur, sadece kalınlaşır */

  strokeHighlight: landingColors.electricBlue,

  strokeWidthHighlight: 3.5,

} as const;

export type StaticMapRenderPurpose = 'thumbnail' | 'fullCapture';

/** Static API / liste thumbnail — @2x PNG küçük kartlarda kenar okunaklı kalsın */
export const parcelStaticThumbnailStroke = {
  min: 24,
  default: 32,
  customMultiplier: 5,
} as const;

/** Static API yedek tam boy capture — canlı harita lineWidth (~3.5px) ile uyumlu @2x */
export const parcelStaticFullCaptureStroke = {
  min: 4,
  max: 12,
  default: 7,
  customMultiplier: 2,
} as const;

/** @deprecated parcelStaticThumbnailStroke kullanın */
export const parcelStaticCaptureStroke = parcelStaticThumbnailStroke;

export function resolveStaticCaptureStrokeWidth(
  custom?: ParcelPolygonDesignConfig | null,
  selected = true,
  purpose: StaticMapRenderPurpose = 'thumbnail',
): number {
  if (purpose === 'fullCapture') {
    const cfg = parcelStaticFullCaptureStroke;
    if (custom) {
      const base = selected ? custom.strokeWidth + 1 : custom.strokeWidth;
      return Math.max(cfg.min, Math.min(cfg.max, Math.round(base * cfg.customMultiplier)));
    }
    return cfg.default;
  }

  const cfg = parcelStaticThumbnailStroke;
  if (custom) {
    const base = selected ? custom.strokeWidth + 1 : custom.strokeWidth;
    return Math.max(cfg.min, Math.round(base * cfg.customMultiplier));
  }
  return selected
    ? cfg.default
    : Math.max(cfg.min, Math.round(cfg.default * 0.85));
}

/** Mapbox FillLayer + LineLayer */

export function getParcelMapLayerStyle(
  selected: boolean,
  custom?: ParcelPolygonDesignConfig | null
) {
  if (custom) {
    const fillOpacity = Math.max(0, Math.min(1, custom.fillOpacity));
    const strokeWidth = custom.strokeWidth;
    return {
      fillColor: custom.fillColor,
      fillOpacity,
      lineColor: custom.strokeColor,
      lineWidth: selected ? strokeWidth + 1 : strokeWidth,
    };
  }
  return {
    fillColor: selected ? parcelMapStyle.fillHighlight : parcelMapStyle.fill,
    fillOpacity: selected ? parcelMapStyle.fillOpacityHighlight : parcelMapStyle.fillOpacity,
    lineColor: selected ? parcelMapStyle.strokeHighlight : parcelMapStyle.stroke,
    lineWidth: selected ? parcelMapStyle.strokeWidthHighlight : parcelMapStyle.strokeWidth,
  };
}



/** Mapbox Static API simplestyle */

export function getParcelStaticMapFeatureProps(
  selected = true,
  custom?: ParcelPolygonDesignConfig | null,
  purpose: StaticMapRenderPurpose = 'thumbnail',
) {
  const strokeWidth = resolveStaticCaptureStrokeWidth(custom, selected, purpose);

  if (custom) {
    return {
      stroke: custom.strokeColor,
      "stroke-width": strokeWidth,
      "stroke-opacity": 1,
      fill: custom.fillColor,
      "fill-opacity": Math.max(0, Math.min(1, custom.fillOpacity)),
    };
  }

  return {
    stroke: selected ? parcelMapStyle.strokeHighlight : parcelMapStyle.stroke,
    "stroke-width": strokeWidth,
    "stroke-opacity": 1,
    fill: selected ? parcelMapStyle.fillHighlight : parcelMapStyle.fill,
    "fill-opacity": selected ? parcelMapStyle.fillOpacityHighlight : parcelMapStyle.fillOpacity,
  };
}


