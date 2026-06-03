import type { ShapeProperties } from "./types";

export type MapArrowVariant = "classic" | "curvy" | "sharp" | "arc";

export type MapArrowStyleDef = {
  id: MapArrowVariant;
  label: string;
  /** Önizleme gradyanı (referans görsel) */
  previewLight: string;
  previewDark: string;
  previewBorder: string;
  headHalfAngleDeg: number;
  headLengthFactor: number;
};

export const MAP_ARROW_STYLES: MapArrowStyleDef[] = [
  {
    id: "classic",
    label: "Düz",
    previewLight: "#8FD3FF",
    previewDark: "#0066FF",
    previewBorder: "#0047B3",
    headHalfAngleDeg: 26,
    headLengthFactor: 1,
  },
  {
    id: "arc",
    label: "Yay",
    previewLight: "#FFE082",
    previewDark: "#F59E0B",
    previewBorder: "#B45309",
    headHalfAngleDeg: 22,
    headLengthFactor: 0.9,
  },
  {
    id: "curvy",
    label: "Kıvrımlı",
    previewLight: "#B9FF8A",
    previewDark: "#22C55E",
    previewBorder: "#15803D",
    headHalfAngleDeg: 24,
    headLengthFactor: 0.95,
  },
  {
    id: "sharp",
    label: "Keskin Dönüş",
    previewLight: "#FF8A80",
    previewDark: "#E11D48",
    previewBorder: "#991B1B",
    headHalfAngleDeg: 22,
    headLengthFactor: 1.15,
  },
];

export const DEFAULT_MAP_ARROW_VARIANT: MapArrowVariant = "classic";

export function normalizeMapArrowVariant(v: unknown): MapArrowVariant {
  if (typeof v === "string" && MAP_ARROW_STYLES.some((s) => s.id === v)) {
    return v as MapArrowVariant;
  }
  return DEFAULT_MAP_ARROW_VARIANT;
}

export function getMapArrowStyleDef(variant: unknown): MapArrowStyleDef {
  const id = normalizeMapArrowVariant(variant);
  return MAP_ARROW_STYLES.find((s) => s.id === id) ?? MAP_ARROW_STYLES[0];
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mixHexColor(hex: string, target: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(target);
  if (!a || !b) return hex;
  const t = Math.max(0, Math.min(1, amount));
  return toHex(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  );
}

export function getArrowGradientColors(outlineColor: string, selected: boolean): {
  light: string;
  dark: string;
  border: string;
} {
  const base = outlineColor.startsWith("#") ? outlineColor : "#2563eb";
  const light = mixHexColor(base, "#ffffff", selected ? 0.45 : 0.38);
  const dark = base;
  const border = mixHexColor(base, "#000000", 0.35);
  return { light, dark, border };
}

export function getShapeArrowVariant(shape: ShapeProperties): MapArrowVariant {
  return normalizeMapArrowVariant(shape.arrowVariant);
}
