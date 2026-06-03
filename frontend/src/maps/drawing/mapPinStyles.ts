import type { ComponentProps } from "react";
import type MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { ShapeProperties } from "./types";

export type MapPinVariant = "classic" | "round" | "flag" | "star";

export type MapPinStyleDef = {
  id: MapPinVariant;
  label: string;
  /** Menü + harita overlay — aynı ikon */
  previewIcon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

/** Sabit ekran boyutu (px) — zoom'dan bağımsız billboard. */
export const PIN_BASE_WIDTH = 32;
export const PIN_BASE_HEIGHT = 40;

export const MAP_PIN_STYLES: MapPinStyleDef[] = [
  { id: "classic", label: "Klasik", previewIcon: "map-marker" },
  { id: "round", label: "Yuvarlak", previewIcon: "map-marker-radius" },
  { id: "flag", label: "Bayrak", previewIcon: "flag-variant" },
  { id: "star", label: "Yıldız", previewIcon: "star" },
];

export const DEFAULT_MAP_PIN_VARIANT: MapPinVariant = "classic";

export function normalizeMapPinVariant(v: unknown): MapPinVariant {
  if (typeof v === "string" && MAP_PIN_STYLES.some((s) => s.id === v)) {
    return v as MapPinVariant;
  }
  return DEFAULT_MAP_PIN_VARIANT;
}

export function getMapPinStyleDef(variant: unknown): MapPinStyleDef {
  const id = normalizeMapPinVariant(variant);
  return MAP_PIN_STYLES.find((s) => s.id === id) ?? MAP_PIN_STYLES[0];
}

export function getPinDisplaySize(
  shapeSizePercent: number | undefined,
  selected: boolean
): { width: number; height: number; iconSize: number } {
  const pct = (typeof shapeSizePercent === "number" ? shapeSizePercent : 100) / 100;
  const sel = selected ? 1.12 : 1;
  const width = PIN_BASE_WIDTH * pct * sel;
  const height = PIN_BASE_HEIGHT * pct * sel;
  return { width, height, iconSize: Math.round(height * 0.92) };
}

export function pinHitSizePx(shape: ShapeProperties): { width: number; height: number } {
  const { width, height } = getPinDisplaySize(shape.shapeSizePercent, false);
  return { width: width + 12, height: height + 12 };
}

/** İğneler her zaman opak hex — rgba / saydam değer kullanılmaz. */
export function toOpaqueColor(input: unknown, fallback: string): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return fallback;

  if (s.startsWith("#")) {
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
  }

  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }

  return fallback;
}
