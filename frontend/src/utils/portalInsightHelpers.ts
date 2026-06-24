/**
 * Portal detay özet kartı — risk çipleri ve eğim/mesafe çözümlemesi (web portal-insight-helpers parity).
 */

import type { PortalQueryDetail, PortalRoadV2Frontage } from '../types/portal';

export type InsightRiskChip = {
  key: 'ramsar' | 'hv' | 'slope' | 'imar' | 'quarter-center';
  label: string;
  value: string;
  risk: boolean;
};

type SummaryLike = {
  quarter_center_distance_m?: number | string | null;
  parameters_data?: Record<string, unknown> | null;
  parametersData?: Record<string, unknown> | null;
  listing_attributes?: Record<string, unknown> | null;
} | null | undefined;

export function resolveSlopePercentForInsight(
  slopeSectionPayload: Record<string, unknown> | null | undefined,
  listingAttrs: Record<string, unknown> | null | undefined,
  summaryLike: SummaryLike,
): number | null {
  const se = slopeSectionPayload?.slope_elevation_json as Record<string, unknown> | undefined;
  const parcelSlope =
    se?.parcel_slope_values && typeof se.parcel_slope_values === 'object'
      ? (se.parcel_slope_values as Record<string, unknown>)
      : {};
  const morphology =
    se?.elevation_morphology && typeof se.elevation_morphology === 'object'
      ? (se.elevation_morphology as Record<string, unknown>)
      : {};
  const fromSlopeApi = parcelSlope.slope_avg_poly ?? morphology.avg_slope;
  if (fromSlopeApi != null && fromSlopeApi !== '' && !Number.isNaN(Number(fromSlopeApi))) {
    return Number(fromSlopeApi);
  }

  const pd = summaryLike?.parameters_data || summaryLike?.parametersData;
  if (pd && typeof pd === 'object') {
    const pdSlope = (pd.parcel_slope_values || pd.slope_values || {}) as Record<string, unknown>;
    const fromPd = pdSlope.slope_avg_poly;
    if (fromPd != null && fromPd !== '' && !Number.isNaN(Number(fromPd))) {
      return Number(fromPd);
    }
    const pdMorph = pd.elevation_morphology;
    if (
      pdMorph &&
      typeof pdMorph === 'object' &&
      (pdMorph as Record<string, unknown>).avg_slope != null &&
      (pdMorph as Record<string, unknown>).avg_slope !== ''
    ) {
      const n = Number((pdMorph as Record<string, unknown>).avg_slope);
      if (Number.isFinite(n)) return n;
    }
  }

  const raw = listingAttrs?.parcel_slope_percent;
  if (raw != null && raw !== '') {
    const n = Number(String(raw).replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function resolveQuarterCenterDistanceM(
  summaryLike: SummaryLike,
  analysis: Record<string, unknown> | null | undefined,
): number | null {
  const fromAnalysis = analysis?.quarter_center_distance_m;
  if (fromAnalysis != null && fromAnalysis !== '' && !Number.isNaN(Number(fromAnalysis))) {
    return Number(fromAnalysis);
  }
  const direct = summaryLike?.quarter_center_distance_m;
  if (direct != null && direct !== '' && !Number.isNaN(Number(direct))) {
    return Number(direct);
  }
  const pd = summaryLike?.parameters_data || summaryLike?.parametersData;
  if (pd && typeof pd === 'object') {
    const cv = pd.center_values;
    if (cv && typeof cv === 'object') {
      const d =
        (cv as Record<string, unknown>).centroid_dist ??
        (cv as Record<string, unknown>).center_dist;
      if (d != null && d !== '' && !Number.isNaN(Number(d))) {
        return Number(d);
      }
    }
    const flat = pd.centroid_dist ?? pd.center_dist;
    if (flat != null && flat !== '' && !Number.isNaN(Number(flat))) {
      return Number(flat);
    }
  }
  return null;
}

type RoadFrontageLike = PortalQueryDetail['road_frontage_values'];

export function resolveRoadV2Frontage(summaryLike: {
  road_v2_frontage?: PortalRoadV2Frontage | null;
} | null | undefined) {
  const roadV2Frontage = summaryLike?.road_v2_frontage;
  if (!roadV2Frontage || typeof roadV2Frontage !== 'object') return null;
  const faceRaw = roadV2Frontage.face_count;
  const faceCount =
    faceRaw != null && faceRaw !== '' && !Number.isNaN(Number(faceRaw))
      ? Math.min(Math.floor(Number(faceRaw)), 4)
      : null;
  const selectedRaw = roadV2Frontage.selected_length_m;
  const totalRaw = roadV2Frontage.total_length_m;
  const importantRaw = roadV2Frontage.important_length_m;
  const longestRaw = roadV2Frontage.longest_length_m;
  const selectedLengthM =
    selectedRaw != null && selectedRaw !== '' && !Number.isNaN(Number(selectedRaw))
      ? Number(selectedRaw)
      : null;
  const totalLengthM =
    totalRaw != null && totalRaw !== '' && !Number.isNaN(Number(totalRaw))
      ? Number(totalRaw)
      : null;
  const importantLengthM =
    importantRaw != null && importantRaw !== '' && !Number.isNaN(Number(importantRaw))
      ? Number(importantRaw)
      : null;
  const longestLengthM =
    longestRaw != null && longestRaw !== '' && !Number.isNaN(Number(longestRaw))
      ? Number(longestRaw)
      : null;
  return {
    raw: roadV2Frontage,
    faceCount,
    selectedLengthM,
    totalLengthM,
    importantLengthM,
    longestLengthM,
    edges: Array.isArray(roadV2Frontage.edges) ? roadV2Frontage.edges : [],
    edgeLabels: Array.isArray(roadV2Frontage.edge_labels) ? roadV2Frontage.edge_labels : [],
    activeCornerRoadPartIds: Array.isArray(roadV2Frontage.active_corner_road_part_ids)
      ? roadV2Frontage.active_corner_road_part_ids
      : [],
    cornerCount: roadV2Frontage.corner_count,
    coarseFallbackUsed: Boolean(roadV2Frontage.coarse_fallback_used),
  };
}

function resolveRoadFrontageFaceCountLegacy(roadFrontage: RoadFrontageLike): number | null {
  if (!roadFrontage || typeof roadFrontage !== 'object') return null;
  if (roadFrontage.road_v2) {
    const roadV2Raw = roadFrontage.road_v2_face_count;
    if (roadV2Raw != null && roadV2Raw !== '') {
      const n = Number(roadV2Raw);
      if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 4);
    }
    const accepted = roadFrontage.accepted_parallel_roads;
    if (Array.isArray(accepted)) {
      const labels = new Set<string>();
      accepted.forEach((item) => {
        const label =
          item && typeof item === 'object' && (item as { label?: unknown }).label != null
            ? String((item as { label?: unknown }).label).trim().toLowerCase()
            : '';
        if (label) labels.add(label);
      });
      if (labels.size > 0) return Math.min(labels.size, 4);
    }
    const fallbackRaw = roadFrontage.frontage_count ?? roadFrontage.frontage_tier;
    if (fallbackRaw != null && fallbackRaw !== '') {
      const n = Number(fallbackRaw);
      if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 4);
    }
    return null;
  }
  const rawU = roadFrontage.unique_road_count;
  const rawTpc = roadFrontage.total_parallel_road_count;
  if (rawU != null && rawU !== '') {
    const u = Number(rawU);
    if (Number.isFinite(u) && u >= 2) return Math.min(Math.floor(u), 4);
    if (Number.isFinite(u) && u === 1) {
      const tpc = rawTpc != null && rawTpc !== '' ? Number(rawTpc) : NaN;
      if (Number.isFinite(tpc) && tpc >= 2) return Math.min(Math.floor(tpc), 4);
      return 1;
    }
  }
  const tierRaw = roadFrontage.frontage_tier;
  if (tierRaw != null && tierRaw !== '') {
    const tv = Number(tierRaw);
    if (Number.isFinite(tv) && tv >= 1 && tv <= 4) return Math.floor(tv);
  }
  const fc = roadFrontage.frontage_count;
  if (fc != null && fc !== '') {
    const v = Number(fc);
    if (Number.isFinite(v) && v > 0) return Math.floor(v);
  }
  return null;
}

export function resolveRoadFrontageFaceCount(
  data: Pick<PortalQueryDetail, 'road_v2_frontage' | 'road_frontage_values' | 'road_v2'> | null | undefined,
): number | null {
  const roadV2Frontage = resolveRoadV2Frontage(data);
  if (roadV2Frontage?.faceCount != null && roadV2Frontage.faceCount > 0) {
    return roadV2Frontage.faceCount;
  }
  if (data?.road_v2) {
    return resolveRoadFrontageFaceCountLegacy(data.road_frontage_values);
  }
  return resolveRoadFrontageFaceCountLegacy(data?.road_frontage_values);
}

export function resolveRoadFrontageTotalLengthM(
  data: Pick<
    PortalQueryDetail,
    'road_v2_frontage' | 'road_frontage_values' | 'road_v2' | 'edge_measure_data'
  > | null | undefined,
  override?: number | null,
): number | null {
  if (override != null && Number.isFinite(Number(override))) return Number(override);
  const roadV2Frontage = resolveRoadV2Frontage(data);
  if (roadV2Frontage?.totalLengthM != null && Number.isFinite(roadV2Frontage.totalLengthM)) {
    return roadV2Frontage.totalLengthM;
  }
  if (data?.road_v2 || roadV2Frontage) {
    return null;
  }
  const rf = data?.road_frontage_values?.total_road_frontage_edge_length_m;
  if (rf != null && Number.isFinite(Number(rf))) return Number(rf);
  const em = data?.edge_measure_data;
  if (em && typeof em === 'object') {
    const t = (em as { total_road_frontage_edge_length_m?: unknown }).total_road_frontage_edge_length_m;
    if (t != null && Number.isFinite(Number(t))) return Number(t);
  }
  return null;
}

function finiteMeter(value: unknown): number | null {
  if (value == null || value === '' || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Web `formatRoadFrontageMeters` — tr-TR metre */
export function formatRoadFrontageMeters(value: unknown): string {
  const n = finiteMeter(value);
  if (n == null) return '—';
  const opts =
    n >= 100
      ? { maximumFractionDigits: 0 }
      : { maximumFractionDigits: 1, minimumFractionDigits: 0 };
  return `${new Intl.NumberFormat('tr-TR', opts).format(n)} m`;
}

export function resolveImportantFrontageM(
  summary: Pick<PortalQueryDetail, 'road_v2_frontage' | 'road_frontage_values'> | null | undefined,
): number | null {
  const roadV2Frontage = resolveRoadV2Frontage(summary);
  const rf = summary?.road_frontage_values;

  const fromV2Important = finiteMeter(summary?.road_v2_frontage?.important_length_m);
  if (fromV2Important != null) return fromV2Important;

  const fromV2Selected = finiteMeter(roadV2Frontage?.importantLengthM ?? roadV2Frontage?.selectedLengthM);
  if (fromV2Selected != null) return fromV2Selected;

  const fromRfImportant = finiteMeter(rf?.important_frontage_length_m);
  if (fromRfImportant != null) return fromRfImportant;

  for (const key of ['selected_road_frontage_length_m', 'selected_road_frontage_m', 'road_frontage_m'] as const) {
    const v = finiteMeter(rf?.[key]);
    if (v != null) return v;
  }

  return null;
}

export function resolveLongestFrontageM(
  summary: Pick<PortalQueryDetail, 'road_v2_frontage' | 'road_frontage_values'> | null | undefined,
): number | null {
  const rf = summary?.road_frontage_values;
  const roadV2Frontage = resolveRoadV2Frontage(summary);

  const fromV2 = finiteMeter(summary?.road_v2_frontage?.longest_length_m ?? roadV2Frontage?.longestLengthM);
  if (fromV2 != null) return fromV2;

  const fromRf = finiteMeter(rf?.longest_frontage_length_m);
  if (fromRf != null) return fromRf;

  const accepted = rf?.accepted_parallel_roads;
  if (Array.isArray(accepted)) {
    let max: number | null = null;
    for (const item of accepted) {
      if (!item || typeof item !== 'object') continue;
      const frontage = (item as { frontage?: Record<string, unknown> }).frontage;
      const len = finiteMeter(
        typeof frontage === 'object' && frontage
          ? frontage.length_m ?? frontage.frontage_length_m
          : (item as { length_m?: unknown }).length_m,
      );
      if (len != null && (max == null || len > max)) max = len;
    }
    if (max != null) return max;
  }

  if (roadV2Frontage?.edges?.length) {
    let max: number | null = null;
    for (const edge of roadV2Frontage.edges) {
      const len = finiteMeter(edge.length_m);
      if (len != null && (max == null || len > max)) max = len;
    }
    if (max != null) return max;
  }

  return null;
}

function roadFrontageKindLabel(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 4) return 'Ada Arazi';
  if (n === 3) return 'Yarım Ada';
  if (n === 2) return 'Köşe Arazi';
  if (n === 1) return 'Cephe';
  return null;
}

export function formatCepheSayisiInsight(
  roadFrontage: RoadFrontageLike,
  roadV2Frontage: ReturnType<typeof resolveRoadV2Frontage> = null,
): string {
  const n = resolveRoadFrontageFaceCount({
    road_v2_frontage: roadV2Frontage?.raw ?? null,
    road_frontage_values: roadFrontage,
    road_v2: roadFrontage?.road_v2,
  });
  const kind = roadFrontageKindLabel(n);
  if (n == null || n <= 0 || kind == null) return '—';
  return `${n} / ${kind}`;
}

export function isImarliArsaLandCategory(summary: {
  category_leaf_id?: string | null;
  listing_category_leaf_id?: string | null;
  listing_category_main?: string | null;
  query_type?: string | null;
} | null | undefined): boolean {
  const leaf = String(summary?.category_leaf_id || summary?.listing_category_leaf_id || '').trim();
  if (leaf) {
    if (leaf.startsWith('arazi_')) return false;
    if (leaf.startsWith('imarli_arsa_')) return true;
    return false;
  }
  const main = String(summary?.listing_category_main || '').trim().toLowerCase();
  if (main === 'arazi') return false;
  if (main === 'imarli_arsa') return true;
  const qt = String(summary?.query_type || '').toLowerCase();
  return qt === 'arsa';
}

export function insightPhysInfraAlwaysVar(summary: {
  listing_category_main?: string | null;
  category_leaf_id?: string | null;
  listing_category_leaf_id?: string | null;
  query_type?: string | null;
} | null | undefined): boolean {
  const main = String(summary?.listing_category_main || '').trim().toLowerCase();
  if (main === 'arazi') return false;

  const leaf = String(summary?.category_leaf_id || summary?.listing_category_leaf_id || '').trim().toLowerCase();
  if (leaf.startsWith('arazi_')) return false;
  if (leaf.startsWith('imarli_arsa_') || leaf.startsWith('yapi_') || leaf.startsWith('ticari_')) {
    return true;
  }
  if (main === 'imarli_arsa' || main === 'yapi' || main === 'ticari') return true;

  const qt = String(summary?.query_type || '').trim().toLowerCase();
  if (qt === 'bina' || qt === 'villa' || qt === 'mustakil_ev' || qt === 'ciftlik_ev' || qt === 'fabrika' || qt === 'konut' || qt === 'konut_daire' || qt === 'ticari' || qt === 'commercial') {
    return true;
  }
  if (qt === 'arsa') return true;
  return false;
}

export type PhysicalSupplementalRow = { label: string; value: string };

export function buildPhysicalSupplementalRows({
  summary,
  analysis,
  slopePct,
}: {
  summary: PortalQueryDetail;
  analysis: Record<string, unknown> | null | undefined;
  slopePct: number | null;
}): PhysicalSupplementalRow[] {
  const attrs =
    summary?.listing_attributes && typeof summary.listing_attributes === 'object'
      ? summary.listing_attributes
      : {};
  const roadFv = summary?.road_frontage_values;
  const roadV2Frontage = resolveRoadV2Frontage(summary);

  const importantM = resolveImportantFrontageM(summary);
  const longestM = resolveLongestFrontageM(summary);
  const totalRoadM =
    roadV2Frontage?.totalLengthM
    ?? finiteMeter(roadFv?.total_frontage_length_m)
    ?? resolveRoadFrontageTotalLengthM(summary);

  const waterFromInfra =
    analysis?.imarsiz_infrastructure_detail &&
    typeof analysis.imarsiz_infrastructure_detail === 'object' &&
    'water_any' in analysis.imarsiz_infrastructure_detail
      ? (analysis.imarsiz_infrastructure_detail as { water_any?: boolean }).water_any
      : null;
  const elecFromInfra =
    analysis?.imarsiz_infrastructure_detail &&
    typeof analysis.imarsiz_infrastructure_detail === 'object' &&
    'electric_line_user' in analysis.imarsiz_infrastructure_detail
      ? (analysis.imarsiz_infrastructure_detail as { electric_line_user?: boolean }).electric_line_user
      : null;
  const waterYes =
    waterFromInfra === true
    || (attrs.has_municipal_water && String(attrs.has_municipal_water).toLowerCase() === 'evet')
    || (attrs.has_well_water && String(attrs.has_well_water).toLowerCase() === 'evet')
    || (attrs.has_drilling && String(attrs.has_drilling).toLowerCase() === 'evet');
  const elecYes =
    elecFromInfra === true
    || (attrs.has_power_line && String(attrs.has_power_line).toLowerCase() === 'evet');

  const physInfraForcedVar = insightPhysInfraAlwaysVar(summary);
  const showPhysElectricWater = !isImarliArsaLandCategory(summary) || physInfraForcedVar;

  const rows: PhysicalSupplementalRow[] = [
    { label: 'Önemli Cephe', value: formatRoadFrontageMeters(importantM) },
    { label: 'Uzun Cephe', value: formatRoadFrontageMeters(longestM) },
    { label: 'Toplam Yol Cephesi', value: formatRoadFrontageMeters(totalRoadM) },
    { label: 'Cephe Sayısı', value: formatCepheSayisiInsight(roadFv, roadV2Frontage) },
  ];

  if (showPhysElectricWater) {
    rows.push({
      label: 'Elektrik',
      value: physInfraForcedVar
        ? 'Var'
        : elecYes
          ? 'var'
          : elecFromInfra === false
            ? 'yok'
            : '—',
    });
    rows.push({
      label: 'Su',
      value: physInfraForcedVar
        ? 'Var'
        : waterYes
          ? 'var'
          : waterFromInfra === false
            ? 'yok'
            : '—',
    });
  }

  if (slopePct != null) {
    rows.push({
      label: 'Eğim',
      value: `%${slopePct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`,
    });
  }

  return rows;
}

export function buildInsightRiskChips({
  summary,
  analysis,
  slopePct,
}: {
  summary: SummaryLike;
  analysis: Record<string, unknown> | null | undefined;
  slopePct: number | null;
}): InsightRiskChip[] {
  const slopeSteep = slopePct != null && slopePct > 20;
  const imarDist = analysis?.imar_boundary_distance_m;
  const imarFarRisk =
    imarDist != null && imarDist !== '' && !Number.isNaN(Number(imarDist)) && Number(imarDist) > 300;
  const quarterCenterM = resolveQuarterCenterDistanceM(summary, analysis);

  return [
    {
      key: 'ramsar',
      label: 'Sulak / RAMSAR',
      value: !analysis
        ? '—'
        : analysis.ramsar_wetland
          ? `Var${analysis.ramsar_name ? ` (${analysis.ramsar_name})` : ''}`
          : 'Yok',
      risk: Boolean(analysis?.ramsar_wetland),
    },
    {
      key: 'hv',
      label: 'Yüksek gerilim',
      value: !analysis
        ? '—'
        : analysis.high_voltage_line
          ? `Var${analysis.high_voltage_voltage_kv != null ? `, ${analysis.high_voltage_voltage_kv} kV` : ''}`
          : 'Yok',
      risk: Boolean(analysis?.high_voltage_line),
    },
    {
      key: 'slope',
      label: 'Eğim',
      value:
        slopePct != null
          ? `%${slopePct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}${slopeSteep ? ' — Çok dik' : ''}`
          : '—',
      risk: slopeSteep,
    },
    {
      key: 'imar',
      label: 'İmarlı alan mesafesi',
      value:
        imarDist != null && imarDist !== ''
          ? `${Number(imarDist).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m${imarFarRisk ? ' — Uzak' : ''}`
          : '—',
      risk: imarFarRisk,
    },
    {
      key: 'quarter-center',
      label: 'Mahalle merkezine uzaklık',
      value:
        quarterCenterM != null
          ? `${Number(quarterCenterM).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m`
          : '—',
      risk: quarterCenterM != null && quarterCenterM > 1500,
    },
  ];
}

/** Liste/detay yıldız yüzdesi — önce PG combined_meta_stars_pct. */
export function resolvePortalInsightStarScorePct(
  summary: Record<string, unknown> | null | undefined,
  invPayload: { meta_stars_denorm?: { combined_meta_stars_pct?: number | string | null } | null } | null,
): number | null {
  const pg = summary?.combined_meta_stars_pct;
  if (pg != null && pg !== '' && !Number.isNaN(Number(pg))) {
    return Number(pg);
  }
  const md = invPayload?.meta_stars_denorm?.combined_meta_stars_pct;
  if (md != null && md !== '' && !Number.isNaN(Number(md))) {
    return Number(md);
  }
  return null;
}
