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

  /** Seçili kenar — lacivert, kalın */

  strokeHighlight: landingColors.bgMid,

  strokeWidthHighlight: 3.5,

} as const;



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

export function getParcelStaticMapFeatureProps(selected = true) {

  return {

    stroke: selected ? parcelMapStyle.strokeHighlight : parcelMapStyle.stroke,

    "stroke-width": selected ? parcelMapStyle.strokeWidthHighlight : parcelMapStyle.strokeWidth,

    "stroke-opacity": 1,

    fill: selected ? parcelMapStyle.fillHighlight : parcelMapStyle.fill,

    "fill-opacity": selected ? parcelMapStyle.fillOpacityHighlight : parcelMapStyle.fillOpacity,

  };

}


