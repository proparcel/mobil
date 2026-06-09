/**
 * Portal detay özet kartı — risk çipleri ve eğim/mesafe çözümlemesi (web portal-insight-helpers parity).
 */

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
