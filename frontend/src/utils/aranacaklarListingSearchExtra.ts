/**
 * Aranacaklar kişi intent’inde saklanan vitrin (public search) parametreleri.
 */
import type { VitrinListingSearchParams } from '../types/vitrin';

const EXCLUDED_FROM_INTENT = new Set(['page', 'page_size', 'cursor_updated_at', 'cursor_listing_id', 'bbox']);

/** Ana ekranda zaten konum, kategori, fiyat/alan/tür kaydı var — vitrin ekstra ile çift yazılmasın */
const KEYS_COVERED_BY_ARANACAKLAR_MAIN_FORM = new Set([
  'city_id',
  'district_id',
  'quarter_id',
  'category_main',
  'category_type',
  'category_leaf_id',
  'listing_type',
  'price_min_amount',
  'price_max_amount',
  'area_min_m2',
  'area_max_m2',
  'unit_price_min',
  'unit_price_max',
]);

export function stripVitrinParamsOverlappingMainScreen<T extends Partial<VitrinListingSearchParams>>(p: T): T {
  const out = { ...p } as Record<string, unknown>;
  for (const k of KEYS_COVERED_BY_ARANACAKLAR_MAIN_FORM) {
    delete out[k];
  }
  return out as T;
}

export function pruneAranacaklarListingSearchExtra(
  p: Partial<VitrinListingSearchParams>,
): Record<string, string | number> {
  const stripped = stripVitrinParamsOverlappingMainScreen(p);
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(stripped)) {
    if (v === undefined || v === null || v === '') continue;
    if (EXCLUDED_FROM_INTENT.has(k)) continue;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue;
      out[k] = v;
    } else {
      const s = String(v).trim();
      if (!s) continue;
      out[k] = s;
    }
  }
  return out;
}

/** API’den gelen intent + listing_search_extra → vitrin taslak state (ana sayfa alanları hariç) */
export function vitrinFiltersFromIntent(intent: Record<string, unknown> | null | undefined): Partial<VitrinListingSearchParams> {
  if (!intent) return {};
  const raw = intent.listing_search_extra;
  const base: Partial<VitrinListingSearchParams> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Partial<VitrinListingSearchParams>) } : {};
  return stripVitrinParamsOverlappingMainScreen(base);
}
