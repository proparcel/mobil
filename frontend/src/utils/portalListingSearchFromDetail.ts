/**
 * Web `seedPortalListingFiltersFromSummary` / vitrin arama ile uyumlu — mobil detaydan başlangıç parametreleri.
 */

import type { PortalQueryDetail } from '../types/portal';
import type { VitrinListingSearchParams } from '../types/vitrin';
import { mapPortalQueryTypeToListingCategory } from './portalListingCategory';

export function seedVitrinSearchParamsFromDetail(d: PortalQueryDetail | null): VitrinListingSearchParams {
  if (!d) {
    return { page: 1, page_size: 20 };
  }
  const cityId = d.city_id != null && d.city_id !== '' ? Number(d.city_id) : undefined;
  const districtId = d.town_id != null && d.town_id !== '' ? Number(d.town_id) : undefined;
  const quarterId = d.quarter_id != null && d.quarter_id !== '' ? Number(d.quarter_id) : undefined;

  let category_main = String(d.listing_category_main || '').trim();
  let category_type = '';
  const category_leaf_id = String(d.category_leaf_id || d.listing_category_leaf_id || '').trim();

  const qt = String(d.query_type || '').trim().toLowerCase();
  const hasTree = Boolean(category_main || category_leaf_id);
  if (!hasTree && qt) {
    const cat = mapPortalQueryTypeToListingCategory(qt);
    if (cat.category_main) category_main = cat.category_main;
    if (cat.category_type) category_type = cat.category_type;
  }

  return {
    page: 1,
    page_size: 20,
    city_id: Number.isFinite(cityId as number) ? (cityId as number) : undefined,
    district_id: Number.isFinite(districtId as number) ? (districtId as number) : undefined,
    quarter_id: Number.isFinite(quarterId as number) ? (quarterId as number) : undefined,
    category_main: category_main || undefined,
    category_type: category_type || undefined,
    category_leaf_id: category_leaf_id || undefined,
  };
}
