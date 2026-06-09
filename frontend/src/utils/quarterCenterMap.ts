/**
 * Mahalle merkezi — hero haritada parsel↔merkez çizgisi (web quarter-center-map.js parity).
 */

import { authDjangoJsonFetch } from '../../services/apiClient';

export type QuarterCenterLonLatResult = {
  lonLat: [number, number];
  label: string;
};

function normalizeLonLatPair(pair: unknown): [number, number] | null {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const a = Number(pair[0]);
  const b = Number(pair[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

export async function fetchQuarterCenterLonLat(
  summary: Record<string, unknown> | null | undefined,
): Promise<QuarterCenterLonLatResult | null> {
  if (!summary || typeof summary !== 'object') return null;

  const params = new URLSearchParams();
  if (summary.quarter_id != null && String(summary.quarter_id).trim() !== '') {
    params.set('quarter_id', String(summary.quarter_id));
  }
  if (summary.proparcel_value != null && String(summary.proparcel_value).trim() !== '') {
    params.set('proparcel_value', String(summary.proparcel_value));
  }
  if (summary.city_id != null && String(summary.city_id).trim() !== '') {
    params.set('city_id', String(summary.city_id));
  }
  if (summary.town_id != null && String(summary.town_id).trim() !== '') {
    params.set('town_id', String(summary.town_id));
  }
  if (summary.tkgm_value != null && String(summary.tkgm_value).trim() !== '') {
    params.set('mahalle', String(summary.tkgm_value));
  }

  if (!params.has('quarter_id') && !params.has('proparcel_value') && !params.has('mahalle')) {
    return null;
  }

  const res = await authDjangoJsonFetch<Record<string, unknown>>(
    `/api/drone-video-context/?${params.toString()}`,
  );
  if (!res.ok || res.data?.success === false) {
    throw new Error(String(res.data?.error || res.error || 'Mahalle merkezi alınamadı'));
  }

  const lonLat = normalizeLonLatPair(res.data?.quarter_center);
  if (!lonLat) return null;

  const label =
    String(res.data?.quarter_name || res.data?.display_label || 'Mahalle merkezi').trim() ||
    'Mahalle merkezi';

  return { lonLat, label };
}

export function buildQuarterCenterLineGeoJSON(
  parcelCenterLonLat: [number, number],
  quarterLonLat: [number, number],
  distanceM: number | null | undefined,
) {
  const distLabel =
    distanceM != null && !Number.isNaN(Number(distanceM))
      ? `${Math.round(Number(distanceM)).toLocaleString('tr-TR')} m`
      : '';

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: [parcelCenterLonLat, quarterLonLat],
    },
    properties: {
      label: distLabel ? `Mahalle merkezi · ${distLabel}` : 'Mahalle merkezi',
    },
  };
}

export function buildQuarterCenterPointGeoJSON(quarterLonLat: [number, number]) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: quarterLonLat,
    },
    properties: {
      label: 'Mahalle merkezi',
    },
  };
}
