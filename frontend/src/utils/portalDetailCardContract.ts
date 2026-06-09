/**
 * Portal detay kart sözleşmesi — web `portal-detail-card-contract.js` ile aynı parsel / yapı / fiyat ayrımı.
 */
import type { PortalQueryDetail, PortalStructurePriceSummary } from '../types/portal';
import { formatTotalAppliedPercent } from './portalDfaHelpers';
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

/** Parsel (arazi) kartında gösterilecek listing_attributes — web ile aynı whitelist */
export const LISTING_ATTR_KEYS_PARCEL_CARD = new Set([
  'land_plot_type',
  'has_road',
  'has_power_line',
  'has_municipal_water',
  'has_well_water',
  'has_drilling',
  'parcel_slope_percent',
  'parcel_altitude_m',
  'has_planted_trees',
  'planted_tree_species',
  'pafta_no',
  'kaks_emsal',
  'gabari',
  'open_area_m2',
]);

export const LISTING_ATTR_KEYS_STRUCTURE_CARD = new Set([
  'building_gross_m2',
  'dwelling_gross_m2',
  'dwelling_net_m2',
  'floor_count',
  'closed_area_m2',
  'building_age',
  'building_age_years',
  'building_permitted',
  'parking_type',
  'heating',
  'title_deed_status',
  'building_title_deed_status',
  'room_count_label',
  'property_condition',
  'structural_condition',
  'usage_status',
  'floor_level',
  'tenanted',
  'credit_eligible',
  'dues_tl',
  'entrance_height_m',
  'building_count',
  'section_room_count',
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
  'pump_count',
  'daily_sales_liters',
  'table_count',
  'person_capacity',
  'energy_plant_subtype',
  'ground_survey',
  'seller_type',
  'barter',
]);

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

export const LISTING_ATTR_KEYS_SUPPRESS_DETAIL = new Set(['has_landscaping']);

const BUILDING_PARAMS_SKIP_WHEN_COST_FACTOR = new Set([
  'kalite',
  'peyzaj',
  'havuz',
  'alt tip / maliyet',
]);

const BP_SKIP_ALWAYS = new Set(['bina yaşı', 'inşaat alanı (m²)']);

export type PortalDetailRow = [string, string];
/** [label, value, prominent?, sublineLabel?, sublineValue?] */
export type PortalDetailPriceRow = [string, string, boolean?, string?, string?];

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

function formatFxUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function formatFxEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n);
}

function formatFxGoldGrams(n: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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

function normLabelKey(label: string): string {
  return String(label || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ çarpanı$/i, '');
}

function hasRowLabel(rows: PortalDetailRow[], label: string): boolean {
  const key = normLabelKey(label);
  return rows.some(([l]) => normLabelKey(l) === key);
}

export function structureCostLabelTitleCase(queryType: string): string {
  const qt = String(queryType || '').toLowerCase();
  if (qt === 'villa') return 'Villa Maliyeti';
  if (qt === 'fabrika') return 'Fabrika Maliyeti';
  return 'Yapı Maliyeti';
}

function structureCostLabel(queryType: string): string {
  const qt = String(queryType || '').toLowerCase();
  if (qt === 'villa') return 'Villa maliyeti';
  if (qt === 'fabrika') return 'Fabrika maliyeti';
  return 'Yapı maliyeti';
}

function resolveStructureConstructionM2(data: PortalQueryDetail): number | null {
  const listingAttrs =
    data.listing_attributes && typeof data.listing_attributes === 'object'
      ? (data.listing_attributes as Record<string, unknown>)
      : {};
  let n = numOrNull(listingAttrs.building_gross_m2);
  if (n != null) return n;
  n = numOrNull(listingAttrs.closed_area_m2);
  if (n != null) return n;
  const bp = data.building_params;
  if (bp && typeof bp === 'object') {
    n = numOrNull(bp['İnşaat Alanı (m²)']);
    if (n != null) return n;
  }
  n = numOrNull(data.structure_price_summary?.construction_area_m2);
  return n;
}

function resolveStructureFloorCount(data: PortalQueryDetail): number | null {
  const listingAttrs =
    data.listing_attributes && typeof data.listing_attributes === 'object'
      ? (data.listing_attributes as Record<string, unknown>)
      : {};
  let n = numOrNull(listingAttrs.floor_count);
  if (n != null) return n;
  const bp = data.building_params;
  if (bp && typeof bp === 'object') {
    n = numOrNull(bp['Kat Sayısı']);
  }
  return n;
}

function costFactorRowsFromSps(sps: PortalStructurePriceSummary | null | undefined): PortalDetailRow[] {
  const rows: PortalDetailRow[] = [];
  const factors = Array.isArray(sps?.cost_factors) ? sps.cost_factors : [];
  const coveredLabels = new Set<string>();
  for (const f of factors) {
    if (!f?.label) continue;
    const baseLabel = String(f.label).replace(/ çarpanı$/i, '');
    coveredLabels.add(normLabelKey(baseLabel));
    const pct = f.applied_pct;
    if (pct && pct !== '—' && pct !== '%0') {
      rows.push([baseLabel, pct]);
      continue;
    }
    const mult = Number(f.multiplier);
    if (!Number.isFinite(mult) || Math.abs(mult - 1) < 1e-6) continue;
    const pctVal = Math.abs((mult - 1) * 100);
    const rounded = pctVal >= 1 ? Math.round(pctVal) : Number(pctVal.toFixed(1));
    const sign = mult > 1 ? '+' : '-';
    rows.push([baseLabel, `${sign}%${rounded}`]);
  }
  return rows;
}

function activeCostFactorLabelKeys(sps: PortalStructurePriceSummary | null | undefined): Set<string> {
  const out = new Set<string>();
  const factors = Array.isArray(sps?.cost_factors) ? sps.cost_factors : [];
  for (const f of factors) {
    if (!f?.label) continue;
    const mult = numOrNull(f.multiplier);
    if (mult == null || Math.abs(mult - 1) < 1e-6) continue;
    out.add(normLabelKey(String(f.label).replace(/ çarpanı$/i, '')));
    if (f.key) out.add(normLabelKey(String(f.key)));
  }
  return out;
}

function buildingParamsRows(
  bp: Record<string, string | number | boolean> | null | undefined,
  existingRows: PortalDetailRow[],
  costFactorCovered: Set<string>,
): PortalDetailRow[] {
  const rows: PortalDetailRow[] = [];
  if (!bp || typeof bp !== 'object') return rows;
  for (const [label, value] of Object.entries(bp)) {
    if (value == null || value === '') continue;
    const norm = normLabelKey(label);
    if (BP_SKIP_ALWAYS.has(norm)) continue;
    if (norm === 'arazi tipi') continue;
    if (costFactorCovered.has(norm)) continue;
    if (BUILDING_PARAMS_SKIP_WHEN_COST_FACTOR.has(norm)) continue;
    if (hasRowLabel(existingRows, label) || hasRowLabel(rows, label)) continue;
    rows.push([label, String(value)]);
  }
  return rows;
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

  const skipKeys = new Set(['building_gross_m2', 'dwelling_gross_m2', 'dwelling_net_m2', 'floor_count', 'closed_area_m2', 'area_m2']);
  const seen = new Set(rows.map(([label]) => label));
  for (const [k, v] of Object.entries(la)) {
    if (!allowedKeys.has(k)) continue;
    if (skipKeys.has(k)) continue;
    if (LISTING_ATTR_KEYS_SUPPRESS_DETAIL.has(k)) continue;
    if (LISTING_ATTR_KEYS_BOTTOM_COMFORT.has(k)) continue;
    if (LISTING_ATTR_KEYS_PARCEL_CARD.has(k) && allowedKeys !== LISTING_ATTR_KEYS_PARCEL_CARD) continue;
    if (v == null || String(v).trim() === '') continue;
    const label = listingAttributeLabelTr(k);
    if (seen.has(label)) continue;
    seen.add(label);
    rows.push([label, formatListingAttributeValueTr(v)]);
  }
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

/** Web getPortalValuationDisplay — canonical birim/toplam/alan */
export function getPortalValuationDisplay(data: PortalQueryDetail): {
  unit: number | null;
  total: number | null;
  area: number | null;
} {
  const vc = data.valuation_canonical;
  const sp = data.portal_summary_prices;

  const areaRaw =
    data.arazi_m2 ?? sp?.arazi_m2 ?? sp?.area_m2 ?? vc?.area_m2_used ?? data.area_m2;
  const area =
    areaRaw != null && areaRaw !== '' && !Number.isNaN(Number(areaRaw)) && Number(areaRaw) > 0
      ? Number(areaRaw)
      : null;

  let unit: number | null = null;
  if (vc?.final_unit_price_m2 != null && !Number.isNaN(Number(vc.final_unit_price_m2))) {
    unit = Number(vc.final_unit_price_m2);
  } else if (sp?.unit_price != null && !Number.isNaN(Number(sp.unit_price))) {
    unit = Number(sp.unit_price);
  } else if (data.unit_price != null && !Number.isNaN(Number(data.unit_price))) {
    unit = Number(data.unit_price);
  }

  let total: number | null = null;
  if (vc?.final_total_tl != null && !Number.isNaN(Number(vc.final_total_tl))) {
    total = Number(vc.final_total_tl);
  } else if (sp?.total_price != null && !Number.isNaN(Number(sp.total_price))) {
    total = Number(sp.total_price);
  } else if (data.total_price != null && !Number.isNaN(Number(data.total_price))) {
    total = Number(data.total_price);
  }

  return { unit, total, area };
}

export function getAraziLandUnitSubline(data: PortalQueryDetail): { label: string; value: string } | null {
  const { unit } = getPortalValuationDisplay(data);
  if (unit == null || !Number.isFinite(unit)) return null;
  return {
    label: 'Arazi birim fiyatı (TL/m²)',
    value: formatPrice(unit),
  };
}

function resolveStructureCostTl(data: PortalQueryDetail): number | null {
  const direct = numOrNull(data.bina_maliyeti);
  if (direct != null && direct > 0) return direct;
  const fromSummary = numOrNull(data.structure_price_summary?.structure_cost_tl);
  if (fromSummary != null && fromSummary > 0) return fromSummary;
  return null;
}

function resolveLandCostTl(data: PortalQueryDetail): number | null {
  const direct = numOrNull(data.arsa_fiyati);
  if (direct != null && direct > 0) return direct;
  const fromLand = numOrNull(data.land_price_summary?.total_tl);
  if (fromLand != null && fromLand > 0) return fromLand;
  const fromLayers = numOrNull(data.valuation_layers_summary?.land?.total_tl);
  if (fromLayers != null && fromLayers > 0) return fromLayers;
  return null;
}

export function buildFxPortalTotalsLine(fx: PortalQueryDetail['fx_portal']): string | null {
  if (!fx || typeof fx !== 'object') return null;
  const parts: string[] = [];
  if (fx.price_usd != null && fx.price_usd !== '' && !Number.isNaN(Number(fx.price_usd))) {
    parts.push(`USD ${formatFxUsd(Number(fx.price_usd))}`);
  }
  if (fx.price_eur != null && fx.price_eur !== '' && !Number.isNaN(Number(fx.price_eur))) {
    parts.push(`EUR ${formatFxEur(Number(fx.price_eur))}`);
  }
  if (fx.price_gold_grams != null && fx.price_gold_grams !== '' && !Number.isNaN(Number(fx.price_gold_grams))) {
    parts.push(`Altın ${formatFxGoldGrams(Number(fx.price_gold_grams))}`);
  }
  return parts.length ? parts.join(' · ') : null;
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

  rows.push(['Oluşturma Tarihi', formatDate(data.created_at)]);
  return rows;
}

export function buildStructureInfoRows(data: PortalQueryDetail): PortalDetailRow[] {
  if (!isStructurePortalQueryType(data.query_type)) return [];

  const rows: PortalDetailRow[] = [];
  const sps = data.structure_price_summary;
  const canSeeCost = data.viewer_can_see_structure_cost_breakdown === true;
  const qtLower = String(data.query_type || '').toLowerCase();
  const ageLabel = qtLower === 'fabrika' ? 'Fabrika yaşı' : 'Bina yaşı';

  if (sps?.structure_age != null && sps.structure_age !== '') {
    rows.push([ageLabel, `${sps.structure_age} yıl`]);
  } else {
    const bp = data.building_params;
    const fabAge = bp?.['Fabrika Yaşı'];
    if (fabAge != null && fabAge !== '') {
      rows.push(['Fabrika yaşı', `${fabAge} yıl`]);
    }
  }

  const constructionM2 =
    sps?.construction_area_m2 != null
      ? sps.construction_area_m2
      : resolveStructureConstructionM2(data);
  if (constructionM2 != null) {
    rows.push(['İnşaat m²', formatArea(constructionM2)]);
  }

  const listingAttrs =
    data.listing_attributes && typeof data.listing_attributes === 'object'
      ? (data.listing_attributes as Record<string, unknown>)
      : {};
  const dwellingGross = numOrNull(listingAttrs.dwelling_gross_m2);
  if (dwellingGross != null) {
    rows.push(['Daire Brüt m²', formatArea(dwellingGross)]);
  }
  const dwellingNet = numOrNull(listingAttrs.dwelling_net_m2);
  if (dwellingNet != null) {
    rows.push(['Daire Net m²', formatArea(dwellingNet)]);
  }

  const floorCount = resolveStructureFloorCount(data);
  if (floorCount != null) {
    rows.push(['Kat Sayısı', String(floorCount)]);
  }

  if (sps?.construction_unit_price_tl != null) {
    rows.push(['Yapı birim fiyatı (TL/m²)', formatPrice(sps.construction_unit_price_tl)]);
  }
  if (canSeeCost && sps?.structure_cost_tl != null) {
    rows.push([structureCostLabel(data.query_type), formatPrice(sps.structure_cost_tl)]);
  }

  rows.push(...costFactorRowsFromSps(sps));
  const covered = activeCostFactorLabelKeys(sps);
  rows.push(...buildingParamsRows(data.building_params, rows, covered));
  appendListingAttrRows(rows, data, LISTING_ATTR_KEYS_STRUCTURE_CARD);

  return rows;
}

export function buildPriceInfoRows(
  data: PortalQueryDetail,
  _options?: { canSeeExpertDetail?: boolean },
): PortalDetailPriceRow[] {
  const rows: PortalDetailPriceRow[] = [];
  const queryType = String(data.query_type || '').trim().toLowerCase();
  const isStructure = isStructurePortalQueryType(queryType);
  const canSeeStructureCost =
    !isStructure || data.viewer_can_see_structure_cost_breakdown === true;

  rows.push(['Uygulanan Toplam % Oran', formatTotalAppliedPercent(data)]);

  const structureCostTl = resolveStructureCostTl(data);
  if (isStructure && canSeeStructureCost && structureCostTl != null) {
    rows.push([structureCostLabelTitleCase(queryType), formatPrice(structureCostTl)]);
  }

  const landCostTl = resolveLandCostTl(data);
  if (isStructure && canSeeStructureCost && landCostTl != null && Number.isFinite(landCostTl)) {
    rows.push(['Arazi maliyeti', formatPrice(landCostTl)]);
  }

  const { total: displayTotal } = getPortalValuationDisplay(data);
  const landUnit = getAraziLandUnitSubline(data);
  rows.push([
    'Toplam fiyat (TL)',
    formatPrice(displayTotal ?? data.total_price),
    true,
    landUnit?.label,
    landUnit?.value,
  ]);

  return rows;
}

export function shouldRenderStructureInfoCard(data: PortalQueryDetail): boolean {
  return buildStructureInfoRows(data).length > 0;
}
