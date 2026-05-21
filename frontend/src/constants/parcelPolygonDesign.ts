import { landingColors } from '../../components/landing/landingTheme';
import { parcelMapStyle } from './parcelMapStyle';

export type ParcelFillPatternId =
  | 'none'
  | 'heart'
  | 'star'
  | 'sun'
  | 'tree'
  | 'dollar'
  | 'lira'
  | 'home'
  | 'leaf'
  | 'diamond'
  | 'cloud'
  | 'water'
  | 'flower'
  | 'mountain';

export type ParcelPolygonDesignConfig = {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  patternId: ParcelFillPatternId;
  /** Desen glif boyutu çarpanı (1 = varsayılan) */
  patternSizeScale: number;
};

export const DEFAULT_PATTERN_SIZE_SCALE = 1;

export const PARCEL_PATTERN_SIZE_OPTIONS = [
  { scale: 0.65, label: 'Küçük' },
  { scale: 1, label: 'Orta' },
  { scale: 1.35, label: 'Büyük' },
  { scale: 1.75, label: 'Çok büyük' },
] as const;

export function resolvePatternSizeScale(scale?: number | null): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return DEFAULT_PATTERN_SIZE_SCALE;
  return Math.max(0.5, Math.min(2.2, scale));
}

/** Harita SymbolLayer textSize (ekran pikseli) */
export function getPatternMapTextSize(scale?: number | null): number {
  const s = resolvePatternSizeScale(scale);
  return Math.max(8, Math.min(32, Math.round(10 + 12 * s)));
}

/** Izgara aralığı glif boyutuyla birlikte büyür (ters orantı değil) */
export function getPatternGridSpacingDeg(scale?: number | null, base = 0.0001): number {
  const s = resolvePatternSizeScale(scale);
  return base * s * 1.2;
}

/** Kenardan içe tampon — metre */
export function getPatternInsetMeters(scale?: number | null): number {
  const s = resolvePatternSizeScale(scale);
  return 2.5 + 3.5 * s;
}

/** Glif yarıçapı — kenar kontrolü (derece, yaklaşık) */
export function getPatternGlyphRadiusDeg(scale?: number | null, lat = 39): number {
  const s = resolvePatternSizeScale(scale);
  const cosLat = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  return (0.000028 + 0.000022 * s) / cosLat;
}

export const PARCEL_DESIGN_FILL_OPACITY_OPTIONS = [0.15, 0.25, 0.38, 0.5, 0.65, 0.8] as const;

export function resolveFillOpacity(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return parcelMapStyle.fillOpacity;
  }
  return Math.max(0.08, Math.min(0.92, value));
}

export function isFillOpacityOptionActive(current: number, option: number): boolean {
  return Math.abs(resolveFillOpacity(current) - option) < 0.02;
}

export const DEFAULT_PARCEL_POLYGON_DESIGN: ParcelPolygonDesignConfig = {
  fillColor: parcelMapStyle.fill,
  fillOpacity: parcelMapStyle.fillOpacity,
  strokeColor: parcelMapStyle.stroke,
  strokeWidth: parcelMapStyle.strokeWidth,
  patternId: 'none',
  patternSizeScale: DEFAULT_PATTERN_SIZE_SCALE,
};

export const PARCEL_DESIGN_FILL_SWATCHES = [
  landingColors.bgPanel,
  landingColors.bgMid,
  '#1d4ed8',
  '#0e7490',
  '#047857',
  '#7c3aed',
  '#b45309',
  '#be123c',
] as const;

export const PARCEL_DESIGN_STROKE_SWATCHES = [
  landingColors.electricBlue,
  landingColors.cyan,
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#ffffff',
  '#94a3b8',
] as const;

export const PARCEL_FILL_PATTERNS: Array<{
  id: ParcelFillPatternId;
  label: string;
  glyph: string;
  iconLib: 'ion' | 'mci';
  iconName: string;
}> = [
  { id: 'none', label: 'Düz', glyph: '', iconLib: 'ion', iconName: 'color-fill-outline' },
  { id: 'heart', label: 'Kalp', glyph: '♥', iconLib: 'ion', iconName: 'heart-outline' },
  { id: 'star', label: 'Yıldız', glyph: '★', iconLib: 'ion', iconName: 'star-outline' },
  { id: 'sun', label: 'Güneş', glyph: '☀', iconLib: 'ion', iconName: 'sunny-outline' },
  { id: 'tree', label: 'Ağaç', glyph: '♣', iconLib: 'mci', iconName: 'pine-tree' },
  { id: 'dollar', label: 'Dolar', glyph: '$', iconLib: 'ion', iconName: 'logo-usd' },
  { id: 'lira', label: 'TL', glyph: '₺', iconLib: 'mci', iconName: 'currency-try' },
  { id: 'home', label: 'Ev', glyph: '⌂', iconLib: 'ion', iconName: 'home-outline' },
  { id: 'leaf', label: 'Yaprak', glyph: '❧', iconLib: 'mci', iconName: 'leaf' },
  { id: 'diamond', label: 'Elmas', glyph: '◆', iconLib: 'ion', iconName: 'diamond-outline' },
  { id: 'cloud', label: 'Bulut', glyph: '☁', iconLib: 'ion', iconName: 'cloud-outline' },
  { id: 'water', label: 'Su', glyph: '≋', iconLib: 'ion', iconName: 'water-outline' },
  { id: 'flower', label: 'Çiçek', glyph: '✿', iconLib: 'mci', iconName: 'flower' },
  { id: 'mountain', label: 'Dağ', glyph: '▲', iconLib: 'mci', iconName: 'image-filter-hdr' },
];

export function getPatternGlyph(patternId: ParcelFillPatternId): string {
  if (patternId === 'none') return '';
  return PARCEL_FILL_PATTERNS.find((p) => p.id === patternId)?.glyph ?? '';
}

export const MAP_TOOLS_SHEET_BACKGROUND = {
  backgroundColor: '#1e293b',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderTopWidth: 4,
  borderTopColor: '#3b82f6',
} as const;
