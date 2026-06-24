/**
 * Aranacaklar kişi intent'inden gelen portal-filters yanıtını mobil Son 30 Gün taslak alanlarına çevirir.
 * Web: `AranacaklarQuickFilter.mapPortalFiltersToPatch`
 */
export type Son30ListMode = 'proSorgular' | 'ilanlar';

export type Son30MobileDraftPatch = {
  cityId?: number | null;
  townId?: number | null;
  quarterId?: number | null;
  categoryMain?: string;
  categoryTypeIds?: string[];
  categoryLeafIds?: string[];
  hisseli?: boolean;
  unitPriceMin?: string;
  unitPriceMax?: string;
  totalPriceMin?: string;
  totalPriceMax?: string;
  proExpertAnswered?: boolean;
  listingExpertAnswered?: boolean;
  proPriceAdvantageOnly?: boolean;
  listingPriceAdvantageOnly?: boolean;
  areaM2Min?: string;
  areaM2Max?: string;
  proRoadMinM?: string;
  proRoadMaxM?: string;
  gmMin?: string;
  gmMax?: string;
  metaMax?: string;
  puanMin?: string;
  puanMax?: string;
  proHasRoad?: string;
  proHasWater?: string;
  proHasPower?: string;
  listingAreaMin?: string;
  listingAreaMax?: string;
  listingRoadMin?: string;
  listingRoadMax?: string;
  listingGmMin?: string;
  listingGmMax?: string;
  listingPuanMin?: string;
  listingPuanMax?: string;
  listingHasRoad?: string;
  listingHasWater?: string;
  listingHasPower?: string;
  listingUnitPriceMin?: string;
  listingUnitPriceMax?: string;
  listingMetaMax?: string;
  listingHisseli?: boolean;
  maxNavCityM?: string;
  maxNavTownM?: string;
  listingAttrJson?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  expandedCategoryRootId?: string | null;
};

const EXTRA_KEYS = [
  'meta_min',
  'meta_max',
  'sort_by',
  'sort_dir',
  'gm_min',
  'gm_max',
  'puan_min',
  'puan_max',
  'listing_attr',
  'expert_answered',
  'price_advantage_only',
  'max_nav_city_m',
  'max_nav_town_m',
  'min_nav_city_m',
  'min_nav_town_m',
  'road_frontage_min_m',
  'road_frontage_max_m',
  'listing_has_road',
  'listing_has_water',
  'listing_has_power_line',
  'unit_price_min',
  'unit_price_max',
  'hisseli',
  'category_type',
] as const;

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function optInt(v: unknown): number | null {
  const s = str(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitCsv(value: unknown): string[] {
  return str(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function boolFlag(v: unknown): boolean {
  const s = str(v).trim();
  return s === '1' || s === 'true';
}

function normalizeStarScoreMaxChoice(value: unknown): string {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const n = Math.min(100, Math.max(0, Number(value)));
  const match = [20, 40, 60, 80, 100].find((threshold) => n <= threshold);
  return match != null ? String(match) : '100';
}

function numOrEmpty(v: unknown): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : str(v);
}

/** API `filters` objesini web patch formatına yaklaştırır. */
function normalizePortalFilters(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: unknown) => {
    const s = str(v).trim();
    if (s) out[k] = s;
  };

  set('category_main', raw.category_main);
  set('category_leaf_id', raw.category_leaf_id);
  set('category_type', raw.category_type);
  set('city_id', raw.city_id);
  set('town_id', raw.town_id ?? raw.district_id);
  set('quarter_id', raw.quarter_id);
  set('town_ids', raw.town_ids);
  set('quarter_ids', raw.quarter_ids);
  set('area_m2_min', raw.area_m2_min ?? raw.area_min_m2);
  set('area_m2_max', raw.area_m2_max ?? raw.area_max_m2);
  set('total_price_min', raw.total_price_min ?? raw.price_min_amount);
  set('total_price_max', raw.total_price_max ?? raw.price_max_amount);
  set('listing_type', raw.listing_type);
  set('is_sale', raw.is_sale);

  for (const k of EXTRA_KEYS) {
    set(k, raw[k]);
  }

  if (!out.quarter_id && raw.quarter_ids) {
    const first = splitCsv(raw.quarter_ids)[0];
    if (first) out.quarter_id = first;
  }
  if (!out.town_id && raw.town_ids) {
    const first = splitCsv(raw.town_ids)[0];
    if (first) out.town_id = first;
  }

  if (raw.investment_score_min != null) out.gm_min = str(raw.investment_score_min);
  if (raw.investment_score_max != null) out.gm_max = str(raw.investment_score_max);
  if (raw.rating_score_min != null) out.puan_min = str(raw.rating_score_min);
  if (raw.rating_score_max != null) out.puan_max = str(raw.rating_score_max);

  return out;
}

export function mapPortalFiltersToMobileDraft(
  apiFilters: Record<string, unknown> | null | undefined,
  listMode: Son30ListMode,
): Son30MobileDraftPatch {
  const f = normalizePortalFilters((apiFilters || {}) as Record<string, unknown>);
  const patch: Son30MobileDraftPatch = {};

  const cityId = optInt(f.city_id);
  if (cityId != null) patch.cityId = cityId;

  const townId = optInt(f.town_id);
  if (townId != null) patch.townId = townId;

  const quarterId = optInt(f.quarter_id);
  if (quarterId != null) patch.quarterId = quarterId;

  if (f.category_main) {
    patch.categoryMain = f.category_main;
    patch.expandedCategoryRootId = f.category_main;
  }
  if (f.category_type) patch.categoryTypeIds = splitCsv(f.category_type);
  if (f.category_leaf_id) patch.categoryLeafIds = splitCsv(f.category_leaf_id);

  if (f.max_nav_city_m) patch.maxNavCityM = numOrEmpty(f.max_nav_city_m);
  if (f.max_nav_town_m) patch.maxNavTownM = numOrEmpty(f.max_nav_town_m);

  if (f.sort_by) patch.sortBy = f.sort_by;
  if (f.sort_dir === 'asc' || f.sort_dir === 'desc') patch.sortDir = f.sort_dir;

  if (f.listing_attr) patch.listingAttrJson = f.listing_attr;

  if (listMode === 'ilanlar') {
    if (f.area_m2_min) patch.listingAreaMin = numOrEmpty(f.area_m2_min);
    if (f.area_m2_max) patch.listingAreaMax = numOrEmpty(f.area_m2_max);
    if (f.total_price_min) patch.totalPriceMin = numOrEmpty(f.total_price_min);
    if (f.total_price_max) patch.totalPriceMax = numOrEmpty(f.total_price_max);
    if (f.unit_price_min) patch.listingUnitPriceMin = numOrEmpty(f.unit_price_min);
    if (f.unit_price_max) patch.listingUnitPriceMax = numOrEmpty(f.unit_price_max);
    if (f.gm_min) patch.listingGmMin = numOrEmpty(f.gm_min);
    if (f.gm_max) patch.listingGmMax = numOrEmpty(f.gm_max);
    if (f.puan_min) patch.listingPuanMin = numOrEmpty(f.puan_min);
    if (f.puan_max) patch.listingPuanMax = numOrEmpty(f.puan_max);
    if (f.road_frontage_min_m) patch.listingRoadMin = numOrEmpty(f.road_frontage_min_m);
    if (f.road_frontage_max_m) patch.listingRoadMax = numOrEmpty(f.road_frontage_max_m);
    if (f.listing_has_road) patch.listingHasRoad = f.listing_has_road;
    if (f.listing_has_water) patch.listingHasWater = f.listing_has_water;
    if (f.listing_has_power_line) patch.listingHasPower = f.listing_has_power_line;
    if (f.meta_max) patch.listingMetaMax = normalizeStarScoreMaxChoice(f.meta_max);
    if (f.hisseli) patch.listingHisseli = boolFlag(f.hisseli);
    if (f.expert_answered) patch.listingExpertAnswered = boolFlag(f.expert_answered);
    if (f.price_advantage_only) patch.listingPriceAdvantageOnly = boolFlag(f.price_advantage_only);
  } else {
    if (f.area_m2_min) patch.areaM2Min = numOrEmpty(f.area_m2_min);
    if (f.area_m2_max) patch.areaM2Max = numOrEmpty(f.area_m2_max);
    if (f.total_price_min) patch.totalPriceMin = numOrEmpty(f.total_price_min);
    if (f.total_price_max) patch.totalPriceMax = numOrEmpty(f.total_price_max);
    if (f.unit_price_min) patch.unitPriceMin = numOrEmpty(f.unit_price_min);
    if (f.unit_price_max) patch.unitPriceMax = numOrEmpty(f.unit_price_max);
    if (f.gm_min) patch.gmMin = numOrEmpty(f.gm_min);
    if (f.gm_max) patch.gmMax = numOrEmpty(f.gm_max);
    if (f.puan_min) patch.puanMin = numOrEmpty(f.puan_min);
    if (f.puan_max) patch.puanMax = numOrEmpty(f.puan_max);
    if (f.road_frontage_min_m) patch.proRoadMinM = numOrEmpty(f.road_frontage_min_m);
    if (f.road_frontage_max_m) patch.proRoadMaxM = numOrEmpty(f.road_frontage_max_m);
    if (f.listing_has_road) patch.proHasRoad = f.listing_has_road;
    if (f.listing_has_water) patch.proHasWater = f.listing_has_water;
    if (f.listing_has_power_line) patch.proHasPower = f.listing_has_power_line;
    if (f.meta_max) patch.metaMax = normalizeStarScoreMaxChoice(f.meta_max);
    if (f.hisseli) patch.hisseli = boolFlag(f.hisseli);
    if (f.expert_answered) patch.proExpertAnswered = boolFlag(f.expert_answered);
    if (f.price_advantage_only) patch.proPriceAdvantageOnly = boolFlag(f.price_advantage_only);
  }

  return patch;
}
