/**
 * Eğim sekmesi / özet kart ortak eğim çözümlemesi.
 */

import { DJANGO_API_URL } from '../../config/api';
import { formatMorphologyTypeLabel, resolveSlopePercentForInsight } from './portalInsightHelpers';

const MEDIA_BASE = DJANGO_API_URL.replace(/\/$/, '');

export type SlopeInfo = { desc: string; iconUri: string };

/** Slope section API + snapshot yedek — ortalama eğim %. */
export function resolvePortalAvgSlopeFromSectionPayload(
  slopeSectionPayload: Record<string, unknown> | null | undefined,
  fallbackSlopeJson: Record<string, unknown> | null | undefined,
): number | null {
  const fromSection = resolveSlopePercentForInsight(slopeSectionPayload, null, null);
  if (fromSection != null) return fromSection;

  if (fallbackSlopeJson && typeof fallbackSlopeJson === 'object') {
    const parcelSlope = (fallbackSlopeJson.parcel_slope_values ||
      fallbackSlopeJson.slope_values ||
      {}) as Record<string, unknown>;
    const morphology = (fallbackSlopeJson.elevation_morphology || {}) as Record<string, unknown>;
    const raw = parcelSlope.slope_avg_poly ?? morphology.avg_slope;
    if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) {
      return Number(raw);
    }
  }
  return null;
}

export function enrichMorphologyForDisplay(
  morphology: Record<string, unknown> | undefined,
  slopeValues: Record<string, unknown>,
): Record<string, unknown> {
  const m = morphology && typeof morphology === 'object' ? { ...morphology } : {};
  if (!m.type_label && m.type) {
    m.type_label = m.type;
  }
  if (m.avg_slope == null && slopeValues.slope_avg_poly != null) {
    m.avg_slope = slopeValues.slope_avg_poly;
  }
  return m;
}

export type ContextMorphologyDisplay = {
  type_label: string;
  type: string;
  confidence: number | null;
  parcel_mean_m: number | null;
  height_spread: number | null;
};

/** Web DetailSlopeTab.buildContextMorphologyDisplay — context_morphology_json öncelikli. */
export function buildContextMorphologyDisplay(
  contextMorphology: Record<string, unknown> | null | undefined,
  legacyElevationMorphology: Record<string, unknown> | null | undefined,
): ContextMorphologyDisplay {
  let ctx = contextMorphology && typeof contextMorphology === 'object' ? contextMorphology : null;
  let morph =
    ctx?.morphology && typeof ctx.morphology === 'object'
      ? { ...(ctx.morphology as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  if (!morph.type && ctx?.type) {
    morph = {
      ...morph,
      type: ctx.type,
      type_label: ctx.type_label,
    };
  }

  if (
    !morph.type &&
    !morph.type_label &&
    legacyElevationMorphology &&
    typeof legacyElevationMorphology === 'object'
  ) {
    morph = {
      type: legacyElevationMorphology.type || legacyElevationMorphology.morphology_type,
      type_label: legacyElevationMorphology.type_label || legacyElevationMorphology.label,
      confidence: legacyElevationMorphology.confidence,
      reason: legacyElevationMorphology.reason,
    };
  }

  const elev =
    ctx?.elevations && typeof ctx.elevations === 'object'
      ? (ctx.elevations as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const sides = Array.isArray(elev.sides) ? elev.sides : [];
  const deltas = sides
    .map((side) => Math.abs(Number((side as { delta_m?: unknown })?.delta_m)))
    .filter((value) => Number.isFinite(value));
  const heightSpread = deltas.length ? Math.max(...deltas) * 2 : null;

  const typeRaw = String(morph.type || '');
  const typeLabel = formatMorphologyTypeLabel(typeRaw, String(morph.type_label || morph.type || ''));

  if (!ctx && !legacyElevationMorphology) {
    return {
      type_label: '—',
      type: '—',
      confidence: null,
      parcel_mean_m: null,
      height_spread: null,
    };
  }

  const confidenceRaw = morph.confidence;
  const confidence =
    confidenceRaw != null && confidenceRaw !== '' && Number.isFinite(Number(confidenceRaw))
      ? Number(confidenceRaw)
      : null;
  const parcelMeanRaw = elev.parcel_mean_m;
  const parcelMeanM =
    parcelMeanRaw != null && parcelMeanRaw !== '' && Number.isFinite(Number(parcelMeanRaw))
      ? Number(parcelMeanRaw)
      : null;

  return {
    type_label: typeLabel,
    type: typeRaw || '—',
    confidence,
    parcel_mean_m: parcelMeanM,
    height_spread: heightSpread,
  };
}

export function formatSlopeMeters(value: unknown): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.ceil(Number(value)))} m`;
}

export function getSlopeInfo(v: number | null | undefined): SlopeInfo {
  const icon = (name: string) => `${MEDIA_BASE}/media/avatars/EgimAvatars/${name}`;
  if (v == null || v === ('' as unknown)) {
    return { desc: 'Veri yok', iconUri: icon('adam.png') };
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return { desc: 'Veri yok', iconUri: icon('adam.png') };
  }
  if (n < 5) return { desc: 'Düz yürüyüş', iconUri: icon('adam.png') };
  if (n < 10) return { desc: 'Hafif yokuş', iconUri: icon('adam2.png') };
  if (n < 20) return { desc: 'Belirgin yokuş', iconUri: icon('adam3.png') };
  if (n < 30) return { desc: 'Çoğu insan zorlanır', iconUri: icon('adam4.png') };
  if (n < 40) return { desc: 'Araç çıkamaz', iconUri: icon('arabaX.png') };
  return { desc: 'İş makinesi çıkamaz', iconUri: icon('traktorX.png') };
}

/** 0–10 yeşil, 10–20 sarı, 20–30 turuncu, 30+ kırmızı */
export function getSlopeHeatColor(slope: number | null | undefined): string {
  const s = Number(slope);
  if (!Number.isFinite(s)) return '#94a3b8';
  let color = '#22c55e';
  if (s > 10) color = '#eab308';
  if (s > 20) color = '#f97316';
  if (s > 30) color = '#ef4444';
  return color;
}

export function getMobilityHints(slope: number | null | undefined): {
  walk: string;
  car: string;
  tractor: string;
} {
  const s = Number(slope);
  if (!Number.isFinite(s)) {
    return { walk: '—', car: '—', tractor: '—' };
  }
  const walk =
    s < 10 ? 'Rahat' : s < 20 ? 'Hafif zorlanır' : s < 30 ? 'Yürüyüş zorlaşır' : 'Çok zor';
  const car =
    s < 15 ? 'Çıkabilir' : s < 28 ? 'Dikkat' : s < 38 ? 'Genelde çıkamaz' : 'Çıkamaz';
  const tractor = s < 22 ? 'Rahat' : s < 35 ? 'Dikkat' : 'Zorlanır / çıkamaz';
  return { walk, car, tractor };
}

/** Web SlopeTerrainCard clip-path ile aynı tepe noktaları (0–100 koordinat, y aşağı). */
export function getSlopeHillPoints(slope: number | null | undefined): string {
  const s = Number(slope);
  const rise = Number.isFinite(s) ? Math.min(Math.max(s * 1.15, 8), 78) : 18;
  const yLeft = 100 - rise;
  const yMid = 100 - rise * 0.35;
  return `0,100 0,${yLeft} 58,${yMid} 100,100`;
}

export function formatSlopePercentLabel(slope: number | null | undefined): string {
  if (slope == null || !Number.isFinite(Number(slope))) return '—';
  return `%${Number(slope).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}
