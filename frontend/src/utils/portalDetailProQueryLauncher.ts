/**
 * Portal detay → yeni Pro Sorgu (tip seçimi ile yeniden başlatma) yardımcıları.
 *
 * Web parity:
 *  - frontend-web/src/lib/portal-detail-pro-query-launcher.js (buildTkgmFeature / queryTypeToSuggestedType)
 *
 * Portal detayın elindeki `parcel_coords_lonlat` (GeoJSON [lon, lat]) + il/ilçe/mahalle + ada/parsel
 * bilgisinden backend `/api/get_parcel_info/` için TKGM benzeri Feature üretir. Böylece detay
 * ekranından onay modalı OLMADAN doğrudan tip seçim modalı açılıp yeni bir Pro Sorgu çalıştırılabilir.
 */

import type { PortalQueryDetail } from '../types/portal';
import { generatePropertyTypeTitle } from './propertyTypeUtils';

/** Parsel geometrisi bulunamadığında atılır (anlamlı kullanıcı mesajı taşır). */
export class PortalDetailGeometryError extends Error {
  constructor(
    message = 'Parsel geometrisi bulunamadı. Bu sorgu için yeni Pro Sorgu başlatılamıyor.',
  ) {
    super(message);
    this.name = 'PortalDetailGeometryError';
  }
}

export type ProQueryTkgmFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties: Record<string, unknown>;
};

export type PortalDetailProQueryContext = {
  title: string;
  suggestedType: string | null;
  areaM2: number;
  nitelik: string;
};

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** PortalQueryDetail içinden TKGM nitelik metnini en iyi çabayla çıkarır (alan garanti değil). */
function extractNitelikFromDetail(data: PortalQueryDetail | null | undefined): string {
  if (!data) return '';
  const summary = (data.summary as Record<string, unknown> | null) || {};
  const candidates = [
    (data as Record<string, unknown>).nitelik,
    (data as Record<string, unknown>).Nitelik,
    summary.nitelik,
    summary.Nitelik,
  ];
  for (const c of candidates) {
    const text = String(c ?? '').trim();
    if (text) return text;
  }
  return '';
}

/** `[lon, lat]` halkasını geçerli sayısal noktalara süzer ve kapatır (ilk == son). */
function buildClosedRing(coords: number[][]): number[][] {
  const ring = coords
    .filter(
      (pt) =>
        Array.isArray(pt) &&
        pt.length >= 2 &&
        Number.isFinite(Number(pt[0])) &&
        Number.isFinite(Number(pt[1])),
    )
    .map((pt) => [Number(pt[0]), Number(pt[1])]);
  if (ring.length < 3) {
    throw new PortalDetailGeometryError();
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

/**
 * Portal detaydan backend get_parcel_info için TKGM Feature üretir.
 * Koordinatlar GeoJSON [lon, lat] (backend `polygon_utils` ile aynı varsayım).
 */
export function buildTkgmFeatureFromPortalDetail(data: PortalQueryDetail): ProQueryTkgmFeature {
  const coords = data?.parcel_coords_lonlat;
  if (!Array.isArray(coords) || coords.length < 3) {
    throw new PortalDetailGeometryError();
  }
  const ring = buildClosedRing(coords);

  const tkgmValue = toFiniteNumber(data.tkgm_value);
  const proparcelValue = toFiniteNumber(data.proparcel_value);
  const nitelik = extractNitelikFromDetail(data);

  const properties: Record<string, unknown> = {
    ilAd: data.city_name || null,
    ilceAd: data.town_name || null,
    mahalleAd: data.quarter_name || null,
    adaNo: data.ada || null,
    parselNo: data.parsel || null,
  };
  if (tkgmValue && tkgmValue > 0) {
    properties.mahalleId = tkgmValue;
    properties.tkgm_value = tkgmValue;
  }
  if (proparcelValue && proparcelValue > 0) {
    properties.Proparcel_value = proparcelValue;
    properties.proparcel_value = proparcelValue;
  }
  if (nitelik) {
    properties.nitelik = nitelik;
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties,
  };
}

/** Detay `query_type` değerini PropertyTypeSelectionModal seçeneğine eşler (önerilen tip). */
export function queryTypeToSuggestedType(queryType: string | null | undefined): string | null {
  const qt = String(queryType || '').toLowerCase().trim();
  if (!qt) return null;
  const map: Record<string, string> = {
    arsa: 'Arsa',
    tarla: 'Tarla',
    villa: 'Villa',
    fabrika: 'Fabrika',
    bina: 'Bina',
    mustakil_ev: 'Müstakil Ev',
    ciftlik_ev: 'Müstakil Ev',
    konut: 'Konut Arsası',
    konut_daire: 'Konut Maliyeti + Daire Satış Fiyatı Hesaplama',
    ticari: 'Ticari',
    commercial: 'Ticari',
  };
  return map[qt] || null;
}

/** Tip seçim modalı için başlık + önerilen tip + alan bilgisini hazırlar. */
export function buildPortalDetailProQueryContext(
  data: PortalQueryDetail,
): PortalDetailProQueryContext {
  const nitelik = extractNitelikFromDetail(data);
  const { title, suggestedType: nitelikSuggested } = generatePropertyTypeTitle(nitelik);
  const suggestedType = queryTypeToSuggestedType(data?.query_type) || nitelikSuggested || null;

  const areaRaw = data?.arazi_m2 ?? data?.area_m2;
  const areaNum = toFiniteNumber(areaRaw);
  const areaM2 = areaNum && areaNum > 0 ? areaNum : 0;

  return { title, suggestedType, areaM2, nitelik };
}
