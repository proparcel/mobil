import { toOpaqueColor } from "./mapPinStyles";
import type { ShapeProperties } from "./types";

export type OverlayShapeColors = {
  fill: string;
  outline: string;
  shadow: string;
  halo: string;
};

export function getOverlayShapeColors(
  shape: ShapeProperties,
  selected: boolean
): OverlayShapeColors {
  if (selected) {
    return {
      fill: toOpaqueColor("#f87171", "#f87171"),
      outline: toOpaqueColor("#ef4444", "#ef4444"),
      shadow: "rgba(0,0,0,0.35)",
      halo: "#ffffff",
    };
  }
  return {
    fill: toOpaqueColor(shape.fillColor, "#3b82f6"),
    outline: toOpaqueColor(shape.outlineColor, "#2563eb"),
    shadow: "rgba(0,0,0,0.32)",
    halo: "#ffffff",
  };
}

export function getOverlayStrokeWidth(shape: ShapeProperties, selected: boolean): number {
  const base = typeof shape.outlineWidth === "number" ? shape.outlineWidth : 2;
  const pct = (typeof shape.shapeSizePercent === "number" ? shape.shapeSizePercent : 100) / 100;
  const w = Math.max(2, Math.round(base * pct));
  return selected ? w + 1 : w;
}

export function getOverlayFillOpacity(shape: ShapeProperties, isArrowHead = false): number {
  if (isArrowHead) return 1;
  if (typeof shape.fillOpacity === "number") return Math.max(0, Math.min(1, shape.fillOpacity));
  if (shape.geometry?.type === "LineString") return 0;
  return 0.45;
}
