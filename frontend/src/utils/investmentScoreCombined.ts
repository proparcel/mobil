/** Web `investment-score-combined.js` — birleşik mülk skoru */

export const LAND_WEIGHT = 0.7;
export const STRUCT_WEIGHT = 0.3;

export function getStructureScoreNumber(data: {
  structure_score?: { empty_reason?: string | null; structure_score?: number | string | null } | null;
} | null): number | null {
  const ss = data?.structure_score;
  if (!ss) return null;
  if (ss.empty_reason != null && ss.structure_score == null) return null;
  const s = ss.structure_score;
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : null;
}

export function normalizeLandInvestmentScore(analysis: Record<string, unknown> | null | undefined): number | null {
  const landRaw = analysis?.normalized_score;
  if (landRaw == null || landRaw === "" || Number.isNaN(Number(landRaw))) return null;
  return Math.round(Math.min(100, Math.max(0, Number(landRaw))));
}

export function computeCombinedMulkScore(landN: number | null, structN: number | null): number | null {
  if (landN != null && structN != null) return Math.round(LAND_WEIGHT * landN + STRUCT_WEIGHT * structN);
  if (landN != null) return landN;
  if (structN != null) return structN;
  return null;
}
