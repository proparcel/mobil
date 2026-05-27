/**
 * Parsel paylaşım görseli — poligon üzeri etiket satırları.
 */

import type { PortalQueryDetail } from '../types/portal';

export function formatParcelShareArea(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return (
    new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n)) +
    ' m²'
  );
}

export function formatParcelSharePrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function resolveParcelSharePriceLine(data: PortalQueryDetail): string | null {
  const listingPrice = data.listing_price_amount;
  if (listingPrice != null && Number.isFinite(Number(listingPrice))) {
    return formatParcelSharePrice(Number(listingPrice));
  }
  const total = data.total_price;
  if (total != null && Number.isFinite(Number(total))) {
    return formatParcelSharePrice(Number(total));
  }
  const unit = data.unit_price;
  if (unit != null && Number.isFinite(Number(unit))) {
    return `${Math.round(Number(unit)).toLocaleString('tr-TR')} ₺/m²`;
  }
  return null;
}

/** Poligon ortası: ada/parsel, alan, varsa fiyat (alt satırlar). */
export function buildPortalParcelShareLabelLines(data: PortalQueryDetail): string[] {
  const ada = String(data.ada ?? '0').trim() || '0';
  const parsel = String(data.parsel ?? '0').trim() || '0';
  const lines: string[] = [`${ada} / ${parsel}`];

  const areaRaw = data.arazi_m2 ?? data.area_m2 ?? data.listing_area_m2;
  const areaLine = formatParcelShareArea(areaRaw != null ? Number(areaRaw) : null);
  if (areaLine) lines.push(areaLine);

  const priceLine = resolveParcelSharePriceLine(data);
  if (priceLine) lines.push(priceLine);

  return lines;
}

/** Mapbox SymbolLayer `label` alanı (\\n ile çok satır). */
export function buildPortalParcelMapLabelProperty(data: PortalQueryDetail): string {
  return buildPortalParcelShareLabelLines(data).join('\n');
}
