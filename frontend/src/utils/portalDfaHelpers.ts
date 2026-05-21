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
};

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

    return {
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
    };
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
