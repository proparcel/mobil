/**
 * Portal DFA — frontend-web/src/lib/dfaPortalSteps.js + PortalRecentQueryDetailApp özet fiyatları ile uyumlu.
 */

import type { PortalDfaStep, PortalQueryDetail } from '../types/portal';

export type PortalDfaRow = {
  key: string;
  stepKey: string | null;
  stepTitle: string;
  note: string;
  description: string;
  details: string[];
  hasDetails: boolean;
  percent: string;
  tone: 'neutral' | 'positive' | 'negative';
  factor: number | null;
  portalReportRoad?: boolean;
  portalReportElectric?: boolean;
};

const ROAD_REPORT_STEP_KEYS = new Set(['road_access', 'road_land', 'hotspot_road']);
const ELECTRIC_REPORT_STEP_KEY = 'electric';
const FACTOR_NEUTRAL_EPS = 1e-6;

function stepFactorFromRow(row: PortalDfaRow, step: PortalDfaStep | Record<string, unknown> | null): number {
  const raw = row?.factor ?? (step as PortalDfaStep)?.applied_factor;
  const f = Number(raw);
  return Number.isFinite(f) ? f : 1;
}

function stepTextBlob(row: PortalDfaRow, step: PortalDfaStep | Record<string, unknown> | null): string {
  const s = (step || {}) as PortalDfaStep;
  const parts = [row?.note, row?.description, row?.stepTitle, row?.stepKey, s?.note, s?.title, s?.key];
  return parts
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function factorIsNeutral(factor: number): boolean {
  return Math.abs(factor - 1) < FACTOR_NEUTRAL_EPS;
}

function textSuggestsNoRoadAccess(text: string): boolean {
  if (!text) return false;
  return (
    text.includes('yola bağlantısı yok') ||
    text.includes('yol: erişim yok') ||
    /yola\s+bağlantısı\s+yok/.test(text)
  );
}

function textSuggestsNoElectricLine(text: string): boolean {
  if (!text) return false;
  return (
    text.includes('elektrik hattı tespit edilmedi') ||
    text.includes('yüksek gerilim hattı tespit edilmedi') ||
    (text.includes('tespit edilmediği') && text.includes('yüksek gerilim'))
  );
}

/** Web canReportRoadOnDfaRow — portal_dfa_report.py ile aynı kurallar */
export function canReportRoadOnDfaRow(
  row: PortalDfaRow,
  step: PortalDfaStep | Record<string, unknown> | null = null,
): boolean {
  const s = (step || {}) as PortalDfaStep;
  if (s.portal_report_road === true || row.portalReportRoad === true) {
    return true;
  }
  if (s.portal_report_road === false || row.portalReportRoad === false) {
    return false;
  }

  const key = String(row?.stepKey || s?.key || '')
    .trim()
    .toLowerCase();
  const factor = stepFactorFromRow(row, step);
  const text = stepTextBlob(row, step);

  if (ROAD_REPORT_STEP_KEYS.has(key)) {
    return factor <= 1 + FACTOR_NEUTRAL_EPS;
  }
  if (textSuggestsNoRoadAccess(text)) {
    return factor <= 1 + FACTOR_NEUTRAL_EPS;
  }
  return false;
}

/** Web canReportElectricOnDfaRow */
export function canReportElectricOnDfaRow(
  row: PortalDfaRow,
  step: PortalDfaStep | Record<string, unknown> | null = null,
): boolean {
  const s = (step || {}) as PortalDfaStep;
  if (s.portal_report_electric === true || row.portalReportElectric === true) {
    return true;
  }
  if (s.portal_report_electric === false || row.portalReportElectric === false) {
    return false;
  }

  const key = String(row?.stepKey || s?.key || '')
    .trim()
    .toLowerCase();
  const factor = stepFactorFromRow(row, step);
  const text = stepTextBlob(row, step);

  if (key === ELECTRIC_REPORT_STEP_KEY) {
    return factorIsNeutral(factor);
  }
  if (textSuggestsNoElectricLine(text)) {
    return factorIsNeutral(factor);
  }
  return false;
}

export function formatDfaPercent(factor: unknown, isInitialRow: boolean): string {
  const numericFactor = Number(factor);
  if (isInitialRow || !Number.isFinite(numericFactor) || numericFactor === 1) {
    return '%0';
  }
  const percent = Math.abs((numericFactor - 1) * 100);
  const rounded = percent >= 1 ? Math.round(percent) : Number(percent.toFixed(1));
  return `${numericFactor > 1 ? '+' : '-'}%${rounded}`;
}

function normalizeDfaDetails(step: PortalDfaStep | Record<string, unknown>): string[] {
  const raw = (step as PortalDfaStep).details;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        return String(o.message || o.text || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

/** Web buildDfaRowsFromSteps — açıklama + yüzde satırları */
export function buildDfaRowsFromSteps(steps: PortalDfaStep[] | unknown[] | null | undefined): PortalDfaRow[] {
  const list = Array.isArray(steps) ? steps : [];

  return list.map((step, index) => {
    const s = (step || {}) as PortalDfaStep;
    const factor = Number(s.applied_factor);
    const stepTitle = s.title || s.key || (index === 0 ? 'Başlangıç' : 'Adım');
    const note = s.note ? String(s.note).trim() : '';
    const description = note || String(stepTitle);
    const details = normalizeDfaDetails(s);

    const row: PortalDfaRow = {
      key: `${s.key || stepTitle}-${index}`,
      stepKey: s.key || null,
      stepTitle: String(stepTitle),
      note,
      description,
      details,
      hasDetails: details.length > 0,
      percent: formatDfaPercent(factor, index === 0),
      tone:
        index === 0
          ? 'neutral'
          : factor > 1
            ? 'positive'
            : factor < 1
              ? 'negative'
              : 'neutral',
      factor: Number.isNaN(factor) ? null : factor,
      portalReportRoad:
        s.portal_report_road === true ? true : s.portal_report_road === false ? false : undefined,
      portalReportElectric:
        s.portal_report_electric === true
          ? true
          : s.portal_report_electric === false
            ? false
            : undefined,
    };
    if (row.portalReportRoad === undefined) {
      row.portalReportRoad = canReportRoadOnDfaRow(row, s);
    }
    if (row.portalReportElectric === undefined) {
      row.portalReportElectric = canReportElectricOnDfaRow(row, s);
    }
    return row;
  });
}

function getDfaEndUnitFromSteps(steps: PortalDfaStep[]): number | null {
  if (!steps.length) return null;
  const last = steps[steps.length - 1] || {};
  const candidates = [last.new_avg, last.prev_avg, last.final_avg];
  for (const c of candidates) {
    if (c != null && c !== '' && !Number.isNaN(Number(c))) {
      return Number(c);
    }
  }
  return null;
}

export type PortalDfaPriceFooter = {
  startUnit: number | null;
  endUnit: number | null;
  total: number | null;
};

export type PortalDfaSimulatedFooter = PortalDfaPriceFooter & {
  appliedPercent: string;
};

/** TR sayı girişi: 37.459 / 37459 / 37,459 */
export function parseMahalleOrtInput(raw: string): number | null {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Mahalle ortalama birim fiyatından DFA tablo çarpanları ile bitiş birim ve toplam tahmin.
 * Web `computeDfaPriceFromMahalleOrt` ile aynı.
 */
export function computeDfaPriceFromMahalleOrt(
  mahalleUnitPrice: number,
  dfaRows: PortalDfaRow[],
  areaM2: number | null | undefined,
): PortalDfaSimulatedFooter | null {
  const base = Number(mahalleUnitPrice);
  if (!Number.isFinite(base) || base <= 0) {
    return null;
  }

  const rows = Array.isArray(dfaRows) ? dfaRows : [];
  let multiplier = 1;
  rows.forEach((row, index) => {
    if (index === 0) return;
    const f = row?.factor;
    if (f != null && Number.isFinite(Number(f))) {
      multiplier *= Number(f);
    }
  });

  const endUnit = base * multiplier;
  const area = Number(areaM2);
  const total = Number.isFinite(area) && area > 0 ? endUnit * area : null;

  return {
    startUnit: base,
    endUnit,
    total,
    appliedPercent: formatDfaPercent(multiplier, false),
  };
}

/** Web getPortalDfaPriceFooter — valuation_canonical öncelikli özet fiyatlar */
export function getPortalDfaPriceFooter(summary: PortalQueryDetail | null | undefined): PortalDfaPriceFooter {
  if (!summary) {
    return { startUnit: null, endUnit: null, total: null };
  }

  const vc = summary.valuation_canonical;
  const steps = Array.isArray(summary.dfa_json) ? summary.dfa_json : [];
  const first = steps[0] || {};
  const rawStart = vc?.initial_unit_price_m2 ?? first.prev_avg ?? first.new_avg ?? null;
  const startUnit =
    rawStart != null && rawStart !== '' && !Number.isNaN(Number(rawStart)) ? Number(rawStart) : null;

  const sp = summary.portal_summary_prices;
  let up: number | null = null;
  if (vc?.final_unit_price_m2 != null && !Number.isNaN(Number(vc.final_unit_price_m2))) {
    up = Number(vc.final_unit_price_m2);
  }
  if (up == null) {
    const fromSteps = getDfaEndUnitFromSteps(steps);
    if (fromSteps != null) up = fromSteps;
  }
  if (
    up == null &&
    summary.unit_price != null &&
    summary.unit_price !== '' &&
    !Number.isNaN(Number(summary.unit_price))
  ) {
    up = Number(summary.unit_price);
  }

  let tp: number | null =
    summary.total_price != null && summary.total_price !== '' && !Number.isNaN(Number(summary.total_price))
      ? Number(summary.total_price)
      : null;
  if (vc?.final_total_tl != null && !Number.isNaN(Number(vc.final_total_tl))) {
    tp = Number(vc.final_total_tl);
  }
  if (sp && typeof sp === 'object') {
    if (up == null && sp.unit_price != null && sp.unit_price !== '' && !Number.isNaN(Number(sp.unit_price))) {
      up = Number(sp.unit_price);
    }
    if (tp == null && sp.total_price != null && sp.total_price !== '' && !Number.isNaN(Number(sp.total_price))) {
      tp = Number(sp.total_price);
    }
  }

  const endUnit = up != null && !Number.isNaN(up) ? up : null;
  const total = tp != null && !Number.isNaN(tp) ? tp : null;
  return { startUnit, endUnit, total };
}

/** Web formatTotalAppliedPercent — net_multiplier veya adım çarpanları ürünü */
export function formatTotalAppliedPercent(
  summary: PortalQueryDetail | null | undefined,
  _dfaRows?: PortalDfaRow[],
): string {
  if (!summary) return '—';

  const vc = summary.valuation_canonical;
  if (vc?.net_multiplier_vs_initial != null) {
    const n = Number(vc.net_multiplier_vs_initial);
    if (Number.isFinite(n) && n > 0) {
      return formatDfaPercent(n, false);
    }
  }

  const rows = _dfaRows?.length ? _dfaRows : buildDfaRowsFromSteps(summary.dfa_json);
  const totalFactor = rows.reduce((acc, row, index) => {
    if (index === 0 || row.factor === null) {
      return acc;
    }
    return acc * row.factor;
  }, 1);

  if (!rows.length || !Number.isFinite(totalFactor)) {
    return '—';
  }

  return formatDfaPercent(totalFactor, false);
}

/** Başlangıç → bitiş birim fiyat değişimi (web unitDeltaToAppliedPct). */
export function unitDeltaToAppliedPct(start: unknown, end: unknown): string {
  const s = Number(start);
  const e = Number(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || s <= 0) return '—';
  const ratio = e / s;
  return formatDfaPercent(ratio, false);
}

export type SimulatedLandFooter = {
  startUnit: number;
  endUnit: number;
  total: number | null;
};

/** Mahalle ort simülasyonu — arazi katmanını günceller (web applySimulatedLandToValuationLayers). */
export function applySimulatedLandToValuationLayers(
  baseLayers: NonNullable<PortalQueryDetail['valuation_layers_summary']>,
  simulatedLand: SimulatedLandFooter | null | undefined,
  opts: { structureCost?: number | null; deliveryTotal?: number | null } = {},
) {
  if (!baseLayers || typeof baseLayers !== 'object') return null;
  const out = JSON.parse(JSON.stringify(baseLayers)) as NonNullable<PortalQueryDetail['valuation_layers_summary']>;
  if (simulatedLand) {
    const land = { ...(out.land || {}) };
    land.start_unit_m2 = simulatedLand.startUnit;
    land.end_unit_m2 = simulatedLand.endUnit;
    if (simulatedLand.total != null) {
      land.total_tl = simulatedLand.total;
    }
    land.applied_pct = unitDeltaToAppliedPct(simulatedLand.startUnit, simulatedLand.endUnit);
    out.land = land;
    if (opts.deliveryTotal != null) {
      out.delivery = { ...(out.delivery || {}), total_tl: opts.deliveryTotal };
    }
  }
  if (opts.structureCost != null && out.structure) {
    out.structure = { ...out.structure, cost_tl: opts.structureCost };
  }
  return out;
}

/** Yapı sorgularında arazi DFA adımlarından clamp_final / birleştirme satırlarını filtrele. */
export function filterLandDfaStepsForStructureQuery(
  steps: PortalDfaStep[] | null | undefined,
  isStructure: boolean,
): PortalDfaStep[] {
  const list = Array.isArray(steps) ? steps : [];
  if (!isStructure) return list;
  return list.filter((step) => {
    const key = String(step?.key || '').trim().toLowerCase();
    if (key === 'clamp_final' || key === 'merge_structure_land') return false;
    const title = String(step?.title || step?.note || '').toLocaleLowerCase('tr-TR');
    if (title.includes('birleştir') && title.includes('bina yaşı')) return false;
    return true;
  });
}
