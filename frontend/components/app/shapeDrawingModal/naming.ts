import type { ShapeType, ShapeProperties } from "@/src/maps/drawing/types";
import type { MeasurementFeature } from "@/src/utils/measurementManager";

export function getShapeName(shapes: ShapeProperties[], shape: ShapeProperties): string {
  const typeNames: Record<ShapeType, string> = {
    rectangle: "Kare",
    triangle: "Üçgen",
    circle: "Yuvarlak",
    ellipse: "Elips",
    polygon: "Çokgen",
    line: "Çizgi",
    arrow: "Ok",
    marker: "Nokta",
    textbox: "Metin",
    pen: "Kalem",
    freehand: "Serbest",
  };
  return `${typeNames[shape.type]} ${shapes.indexOf(shape) + 1}`;
}

export function getMeasurementName(feature: MeasurementFeature, index: number): string {
  if (feature.properties.measurementType === "ruler") {
    const label = feature.properties.label || "";
    return label ? `Mesafe: ${label}` : `Mesafe ${index + 1}`;
  } else if (feature.properties.measurementType === "area") {
    const label = feature.properties.label || "";
    return label ? `Alan: ${label}` : `Alan ${index + 1}`;
  }
  return `Ölçüm ${index + 1}`;
}

export function getParcelName(parcels: any[], parcel: any): string {
  const props = parcel?.properties || {};
  if (props.mahalleAd && props.adaNo && props.parselNo) {
    return `${props.mahalleAd} - Ada: ${props.adaNo}, Parsel: ${props.parselNo}`;
  }
  return `Parsel ${parcels.indexOf(parcel) + 1}`;
}

