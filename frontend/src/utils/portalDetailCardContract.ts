/**
 * Portal detay kart sözleşmesi — web `portal-detail-card-contract.js` ile aynı parsel / yapı / fiyat ayrımı.
 */
import type { PortalQueryDetail, PortalStructurePriceSummary } from '../types/portal';
import { formatListingAttributeValueTr, listingAttributeLabelTr } from './listingAttributeLabels';

export const STRUCTURE_PORTAL_QUERY_TYPES = new Set([
  'bina',
  'villa',
  'mustakil_ev',
  'ciftlik_ev',
  'fabrika',
  'konut',
  'konut_daire',
  'ticari',
  'commercial',
]);

export function isStructurePortalQueryType(qt: unknown): boolean {
  return STRUCTURE_PORTAL_QUERY_TYPES.has(String(qt || '').trim().toLowerCase());
}

/** Parsel (arazi) kartında gösterilecek listing_attributes anahtarları */
export const LISTING_ATTR_KEYS_PARCEL_CARD = new Set([
  'open_area_m2',
  'land_plot_type',
  'kaks_emsal',
  'gabari',
  'pafta_no',
  'has_road',
  'has_power_line',
  'has_municipal_water',
  'has_well_water',
  'has_drilling',
  'has_planted_trees',
  'planted_tree_species',
  'parcel_altitude_m',
  'parcel_slope_percent',
  'title_deed_status',
  'deed_status',
  'seller_type',
  'barter',
  'exchange',
  'credit_eligible',
  'zoning_status',
]);

/** Yapı bilgileri kartında gösterilecek listing_attributes anahtarları */
export const LISTING_ATTR_KEYS_STRUCTURE_CARD = new Set([
  'building_gross_m2',
  'dwelling_gross_m2',
  'dwelling_net_m2',
  'floor_count',
  'closed_area_m2',
  'building_age',
  'building_age_years',
  'heating',
  'property_condition',
  'floor_level',
  'structural_condition',
  'usage_status',
  'ground_survey',
  'tenanted',
  'dues_tl',
  'entrance_height_m',
  'building_count',
  'table_count',
  'person_capacity',
  'energy_plant_subtype',
  'section_room_count',
  'room_count_label',
  'pump_count',
  'daily_sales_liters',
  'building_permitted',
  'building_title_deed_status',
  'factory_type_code',
  'factory_ceiling_height_m',
  'factory_mep_level',
  'factory_span_class',
  'factory_floor_class',
  'factory_has_crane',
  'factory_crane_ton',
  'factory_is_cold_storage',
  'factory_cold_temp_class',
  'factory_fire_system',
  'factory_office_ratio_pct',
  'factory_age_years',
  'parking_type',
]);

/** Alt konfor kartına / ilan özelliklerine taşınan anahtarlar — yapı kartında gösterilmez */
export const LISTING_ATTR_KEYS_BOTTOM_COMFORT = new Set([
  'has_swimming_pool',
  'has_sauna',
  'has_elevator',
  'facade_cladding',
  'has_turkish_bath',
  'has_gym',
  'has_cinema_room',
  'has_fireplace',
]);

/** Detay kartlarında gösterilmeyecek listing_attributes */
export const LISTING_ATTR_KEYS_SUPPRESS_DETAIL = new Set(['has_landscaping']);

const BUILDING_PARAMS_SKIP_STRUCTURE = new Set(['Bina Yaşı', 'İnşaat Alanı (m²)', 'Arazi Tipi']);

const BUILDING_PARAM_COST_FACTOR_LABELS: Record<string, string[]> = {
  Kalite: ['Kalite çarpanı', 'quality_multiplier'],
  Peyzaj: ['Peyzaj çarpanı', 'landscape_multiplier'],
  Havuz: ['Havuz çarpanı', 'pool_multiplier'],
};

export type PortalDetailRow = [string, string];
export type PortalDetailPriceRow = [string, string, boolean?];

export interface BuildPortalDetailRowsOptions {
  queryTypeLabel?: string;
  parcelShapeText?: string | null;
  totalRoadFrontageLength?: number | null;
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatArea(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n))} m²`;
}

function formatMeters(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n))} m`;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (nn: number) => String(nn).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '—';
  }
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function structureCostLabel(queryType: string): string {
  const qt = String(queryType || '').trim().toLowerCase();
  if (qt === 'villa') return 'Villa maliyeti';
  if (qt === 'fabrika') return 'Fabrika maliyeti';
  return 'Yapı maliyeti';
}

function structureCostLabelPriceBlock(queryType: string): string {
  const qt = String(queryType || '').trim().toLowerCase();
  if (qt === 'villa') return 'Villa Maliyeti';
  if (qt === 'fabrika') return 'Fabrika Maliyeti';
  return 'Yapı Maliyeti';
}

function formatCostFactorMultiplier(mult: number): string {
  return `×${mult.toFixed(mult >= 1.01 ? 2 : 4)}`;
}

function activeCostFactorLabels(factors: PortalStructurePriceSummary['cost_factors']): Set<string> {
  const out = new Set<string>();
  const list = Array.isArray(factors) ? factors : [];
  for (const f of list) {
    const mult = numOrNull(f?.multiplier);
    if (mult == null || Math.abs(mult - 1) < 1e-6) continue;
    if (f?.label) out.add(String(f.label));
    if (f && typeof f === 'object' && 'key' in f && f.key) out.add(String(f.key));
  }
  return out;
}

function shouldSkipBuildingParamForCostFactor(
  paramLabel: string,
  activeFactors: Set<string>,
): boolean {
  const aliases = BUILDING_PARAM_COST_FACTOR_LABELS[paramLabel];
  if (!aliases) return false;
  return aliases.some((a) => activeFactors.has(a));
}

function resolveRoadFrontageM(data: PortalQueryDetail, override?: number | null): number | null {
  if (override != null && Number.isFinite(Number(override))) return Number(override);
  const rf = data.road_frontage_values?.total_road_frontage_edge_length_m;
  if (rf != null && Number.isFinite(Number(rf))) return Number(rf);
  const em = data.edge_measure_data;
  if (em && typeof em === 'object') {
    const t = (em as { total_road_frontage_edge_length_m?: unknown }).total_road_frontage_edge_length_m;
    if (t != null && Number.isFinite(Number(t))) return Number(t);
  }
  return null;
}

function appendListingAttrRows(
  rows: PortalDetailRow[],
  data: PortalQueryDetail,
  allowedKeys: Set<string>,
): void {
  const la =
    data.listing_attributes && typeof data.listing_attributes === 'object'
      ? (data.listing_attributes as Record<string, unknown>)
      : null;
  if (!la) return;

  const seen = new Set(rows.map(([label]) => label));
  for (const [k, v] of Object.entries(la)) {
    if (!allowedKeys.has(k)) continue;
    if (LISTING_ATTR_KEYS_SUPPRESS_DETAIL.has(k)) continue;
    if (LISTING_ATTR_KEYS_BOTTOM_COMFORT.has(k)) continue;
    if (v == null || String(v).trim() === '') continue;
    const label = listingAttributeLabelTr(k);
    if (seen.has(label)) continue;
    seen.add(label);
    rows.push([label, formatListingAttributeValueTr(v)]);
  }
}

export function buildParcelInfoRows(
  data: PortalQueryDetail,
  options: BuildPortalDetailRowsOptions = {},
): PortalDetailRow[] {
  const rows: PortalDetailRow[] = [];
  const queryType = String(data.query_type || 'arsa').trim().toLowerCase();
  const typeLabel =
    options.queryTypeLabel ||
    (queryType.charAt(0).toUpperCase() + queryType.slice(1));

  rows.push(['Konum', data.quarter_name || '—']);
  rows.push(['Ada / Parsel', `${data.ada || '0'}/${data.parsel || '0'}`]);
  rows.push(['Tip', typeLabel]);

  const parcelShapeText = options.parcelShapeText;
  if (parcelShapeText) rows.push(['Parsel Formu', String(parcelShapeText)]);

  rows.push(['Arazi Alanı', formatArea(data.arazi_m2 ?? data.area_m2)]);

  const roadFrontage = resolveRoadFrontageM(data, options.totalRoadFrontageLength);
  if (roadFrontage != null && !data.listing_id) {
    rows.push(['Toplam Yola Cephe', formatMeters(roadFrontage)]);
  }

  appendListingAttrRows(rows, data, LISTING_ATTR_KEYS_PARCEL_CARD);

  const bp = data.building_params;
  if (bp && typeof bp === 'object') {
    const araziTipi = bp['Arazi Tipi'];
    if (araziTipi != null && String(araziTipi).trim() !== '') {
      rows.push(['Arazi Tipi', String(araziTipi)]);
    }
  }

  rows.push(['Tarih', formatDate(data.created_at)]);
  return rows;
}

export function buildStructureInfoRows(data: PortalQueryDetail): PortalDetailRow[] {
  if (!isStructurePortalQueryType(data.query_type)) return [];

  const rows: PortalDetailRow[] = [];
  const sps = data.structure_price_summary;
  const canSeeCost = data.viewer_can_see_structure_cost_breakdown === true;
  const activeFactors = activeCostFactorLabels(sps?.cost_factors);

  if (sps?.structure_age != null && sps.structure_age !== '') {
    rows.push(['Bina yaşı', `${sps.structure_age} yıl`]);
  }
  if (sps?.construction_area_m2 != null) {
    rows.push(['İnşaat m²', formatArea(sps.construction_area_m2)]);
  }
  if (sps?.construction_unit_price_tl != null) {
    rows.push(['Yapı birim fiyatı (TL/m²)', formatPrice(sps.construction_unit_price_tl)]);
  }
  if (canSeeCost && sps?.structure_cost_tl != null) {
    rows.push([structureCostLabel(data.query_type), formatPrice(sps.structure_cost_tl)]);
  }
  if (sps?.structure_final_total_tl != null) {
    rows.push(['Nihai yapı değeri (TL)', formatPrice(sps.structure_final_total_tl)]);
  }

  const factors = Array.isArray(sps?.cost_factors) ? sps!.cost_factors! : [];
  for (const f of factors) {
    if (!f?.label || f.multiplier == null) continue;
    const mult = numOrNull(f.multiplier);
    if (mult == null || Math.abs(mult - 1) < 1e-6) continue;
    rows.push([String(f.label), formatCostFactorMultiplier(mult)]);
  }

  const bp = data.building_params;
  if (bp && typeof bp === 'object') {
    const seen = new Set(rows.map(([label]) => label));
    for (const [label, value] of Object.entries(bp)) {
      if (value == null || value === '') continue;
      if (BUILDING_PARAMS_SKIP_STRUCTURE.has(label)) continue;
      if (shouldSkipBuildingParamForCostFactor(label, activeFactors)) continue;
      if (seen.has(label)) continue;
      seen.add(label);
      rows.push([label, String(value)]);
    }
  }

  appendListingAttrRows(rows, data, LISTING_ATTR_KEYS_STRUCTURE_CARD);
  return rows;
}

export function buildPriceInfoRows(
  data: PortalQueryDetail,
  options: { canSeeExpertDetail: boolean },
): PortalDetailPriceRow[] {
  const rows: PortalDetailPriceRow[] = [];
  const queryType = String(data.query_type || '').trim().toLowerCase();
  const isStructure = isStructurePortalQueryType(queryType);

  if (isStructure && data.arsa_fiyati != null && data.arsa_fiyati > 0) {
    rows.push(['Arsa Fiyatı', formatPrice(data.arsa_fiyati)]);
  }
  if (isStructure && data.bina_maliyeti != null && data.bina_maliyeti > 0) {
    rows.push([structureCostLabelPriceBlock(queryType), formatPrice(data.bina_maliyeti)]);
  }

  if (options.canSeeExpertDetail && data.expert_price_detail && typeof data.expert_price_detail === 'object') {
    const expertPriceDetail = data.expert_price_detail as Record<string, unknown>;
    const details = ((expertPriceDetail.price_selection as Record<string, unknown> | undefined)?.details ||
      {}) as Record<string, unknown>;
    const parcelValues = (expertPriceDetail.parcel_values || {}) as Record<string, unknown>;
    const formatExpertPrice = (v: unknown) => {
      if (v == null || v === '') return '—';
      const n = Number(v);
      return Number.isFinite(n) ? formatPrice(n) : String(v);
    };
    if (details.db_price != null || details.db_unit_price != null) {
      rows.push(['DB Birim Fiyat', formatExpertPrice(details.db_price ?? details.db_unit_price)]);
    }
    if (details.km_price != null || details.km_recommended_price != null) {
      rows.push(['KM Birim Fiyat', formatExpertPrice(details.km_price ?? details.km_recommended_price)]);
    }
    if (details.prediction_price != null || details.prediction_first_price != null) {
      rows.push([
        'Tahmin Birim Fiyat',
        formatExpertPrice(details.prediction_price ?? details.prediction_first_price),
      ]);
    }
    const parcelUnit =
      parcelValues.parcel_unit_from_dfa ?? parcelValues.unite_price ?? parcelValues.parcel_uniteprice;
    if (parcelUnit != null) {
      rows.push(['Parsel Birim Fiyat', formatExpertPrice(parcelUnit)]);
    }
  }

  if (options.canSeeExpertDetail || !isStructure) {
    rows.push(['Birim Fiyat', formatPrice(data.unit_price)]);
  }

  rows.push(['ProParcel Tahmin', formatPrice(data.total_price), true]);

  if (data.listing_price_amount != null && Number.isFinite(Number(data.listing_price_amount))) {
    rows.push(['İlan fiyatı', formatPrice(data.listing_price_amount)]);
  }

  return rows;
}
