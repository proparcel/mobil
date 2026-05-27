import { DJANGO_API_URL } from '../../config/api';

const MEDIA_BASE = DJANGO_API_URL.replace(/\/$/, '');

export type SlopeInfo = { desc: string; iconUri: string };

/** 0–1 kesir veya yüzde — terrain kartı her zaman yüzde bekler (PDF / web ile aynı). */
export function normalizeSlopePercentValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 0 && n <= 1) return n * 100;
  return n;
}

/** Web DetailSlopeTab.enrichMorphologyForDisplay — grid yoksa slope_avg_poly ile doldur. */
export function enrichMorphologyForDisplay(
  morphology: Record<string, unknown> | null | undefined,
  parcelSlope: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const morph = morphology && typeof morphology === 'object' ? { ...morphology } : {};
  const ps = parcelSlope && typeof parcelSlope === 'object' ? parcelSlope : {};
  const desc = String(morph.description || '');
  const isFallback = desc.includes('bulunamadı') || desc.includes('varsayılan');
  const avgSlope = ps.slope_avg_poly;
  if (!isFallback || avgSlope == null || avgSlope === '' || Number.isNaN(Number(avgSlope))) {
    return morph;
  }
  const avg = Number(avgSlope);
  let typeLabel = 'Eğimli Arazi';
  let typeCode = 'egimli';
  if (avg < 15) {
    typeLabel = 'Düz Arazi';
    typeCode = 'duz';
  } else if (avg < 30) {
    typeLabel = 'Hafif Eğimli';
    typeCode = 'hafif_egimli';
  }
  return {
    ...morph,
    type: typeCode,
    type_label: typeLabel,
    avg_slope: avg,
    description: `Yükseklik morfolojisi grid verisi kayıtlı değil; parsel eğim analizi ortalama %${Math.round(avg)} olarak mevcut.`,
    confidence: Math.max(Number(morph.confidence) || 0, 0.65),
  };
}

/**
 * Portal slope section / PDF ile aynı öncelik: slope_avg_poly → morphology.avg_slope.
 */
export function resolvePortalAvgSlopePercent(slopeElevationRoot: unknown): number | null {
  const se = slopeElevationRoot && typeof slopeElevationRoot === 'object'
    ? slopeElevationRoot as Record<string, unknown>
    : null;
  if (!se) return null;

  const parcelSlope = (
    se.parcel_slope_values && typeof se.parcel_slope_values === 'object'
      ? se.parcel_slope_values
      : se.slope_values && typeof se.slope_values === 'object'
        ? se.slope_values
        : {}
  ) as Record<string, unknown>;

  const morphology = enrichMorphologyForDisplay(
    se.elevation_morphology as Record<string, unknown> | undefined,
    parcelSlope,
  );

  const raw = parcelSlope.slope_avg_poly ?? morphology.avg_slope ?? parcelSlope.avg_slope;
  return normalizeSlopePercentValue(raw);
}

/** Section API yanıtı veya doğrudan slope_elevation_json. */
export function resolvePortalAvgSlopeFromSectionPayload(
  sectionPayload: Record<string, unknown> | null | undefined,
  detailSlopeElevation?: Record<string, unknown> | null,
): number | null {
  const fromSection = sectionPayload?.slope_elevation_json;
  if (fromSection) {
    const pct = resolvePortalAvgSlopePercent(fromSection);
    if (pct != null) return pct;
  }
  if (detailSlopeElevation) {
    return resolvePortalAvgSlopePercent(detailSlopeElevation);
  }
  return null;
}

export function getSlopeInfo(v: number | null | undefined): SlopeInfo {
  const icon = (name: string) => `${MEDIA_BASE}/media/avatars/EgimAvatars/${name}`;
  if (v == null || (typeof v === 'string' && v === '')) {
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
