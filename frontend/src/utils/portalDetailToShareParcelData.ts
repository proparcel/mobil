/**
 * Portal detay → CombinedScreenshotContainer parcelData sözleşmesi.
 */

import type { PortalQueryDetail } from '../types/portal';

function closeRing(coords: number[][]): number[][] {
  if (!coords?.length) return [];
  const ring = coords.map((c) => [Number(c[0]), Number(c[1])] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

export function portalDetailToShareParcelData(detail: PortalQueryDetail): any {
  const coords = detail.parcel_coords_lonlat;
  const ring = coords && coords.length >= 3 ? closeRing(coords) : null;
  const geometry = ring
    ? { type: 'Polygon' as const, coordinates: [ring] }
    : null;

  const area = detail.arazi_m2 ?? detail.area_m2 ?? detail.listing_area_m2;
  const summaryPrices = detail.portal_summary_prices;
  const unitPrice = detail.unit_price ?? summaryPrices?.unit_price ?? null;
  const totalPrice =
    detail.total_price ??
    summaryPrices?.total_price ??
    detail.listing_price_amount ??
    null;

  return {
    properties: {
      adaNo: detail.ada,
      parselNo: detail.parsel,
      mahalleAd: detail.quarter_name,
      ilAd: detail.city_name,
      ilceAd: detail.town_name,
      alan: area,
      area_m2: area,
      nitelik: detail.listing_category_leaf_label || detail.query_type,
      unite_price: unitPrice,
      unit_price: unitPrice,
      price_of_tarla: totalPrice,
      total_price: totalPrice,
      listing_price: detail.listing_price_amount,
    },
    analysisData: {
      parameters_data: {
        dfa_snapshot_id: detail.snapshot_id,
        snapshot_id: detail.snapshot_id,
        parcel_values: {
          adaNo: detail.ada,
          parselNo: detail.parsel,
          ada: detail.ada,
          parsel: detail.parsel,
          area_m2: area,
          alan: area,
        },
        proparcel_value: detail.proparcel_value,
      },
    },
    geometry,
    listing_id: detail.listing_id,
  };
}
