import type { DfaRow } from '../types/reportPayload';

const PARCEL_AREA_KEYS = [
  'alan',
  'Alan',
  'ALAN',
  'area',
  'Area',
  'area_m2',
  'arazi_m2',
  'areaM2',
  'yuzolcum',
  'Yuzolcum',
  'YUZOLCUM',
] as const;

/** TKGM / parsel özelliklerinden alan ham değerini seçer. */
export function pickParcelAreaRaw(source: Record<string, unknown> | null | undefined): unknown {
  if (!source) return null;
  for (const key of PARCEL_AREA_KEYS) {
    const v = source[key];
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Alan metnini m² sayısına çevirir.
 * TR: "2.450,00" / "1.556" (binlik nokta) — EN/API: "500.00" (ondalık nokta).
 */
export function parseAreaM2(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let s = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/m²|m2/gi, '')
    .replace(/[^\d.,\-+]/g, '');

  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma) {
    // TR: nokta binlik, virgül ondalık (ör. 2.450,00)
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    const lastPart = parts[parts.length - 1] ?? '';
    // Son parça 1–2 hane → ondalık nokta (500.00); aksi halde binlik nokta (1.556)
    const isDecimalDot = parts.length === 2 && lastPart.length <= 2;
    if (!isDecimalDot) {
      s = s.replace(/\./g, '');
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ParselModal bottom sheet ile aynı sayısal çözümleme:
 * önce doğrudan sayı / basit metin, sonra TKGM metin formatı.
 */
export function resolveParcelAreaM2(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.trim().replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return parseAreaM2(value);
}

/** ParselModal bottom sheet ile aynı alan gösterimi. */
export function formatParcelAreaDisplay(value: unknown, empty = ''): string {
  if (value === null || value === undefined || value === '') return empty;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const n = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
      return `${n.toLocaleString('tr-TR')} m²`;
    }
    const parsed = parseAreaM2(trimmed);
    if (parsed > 0) {
      return `${parsed.toLocaleString('tr-TR')} m²`;
    }
    return trimmed ? `${trimmed} m²` : empty;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return empty;
  return `${n.toLocaleString('tr-TR')} m²`;
}

/** @deprecated formatParcelAreaDisplay kullanın */
export function formatAreaM2Display(value: unknown, empty = ''): string {
  return formatParcelAreaDisplay(value, empty);
}

export function pctTextFromFactors(appliedFactor: unknown): string {
  const f = Number(appliedFactor);
  if (!Number.isFinite(f) || f === 1) return '%0';
  const pct = Math.abs((f - 1) * 100);
  const sign = f > 1 ? '+' : '-';
  const abs0 = Math.round(pct);
  const abs1 = Math.round(pct * 10) / 10;
  const showDecimal = Math.abs(abs1 - abs0) >= 0.1;
  return (
    sign +
    '%' +
    (showDecimal
      ? abs1.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : abs0.toLocaleString('tr-TR', { maximumFractionDigits: 0 }))
  );
}

/** valuation_steps (backend) → DfaRow[] (mobil rapor tablosu) */
export function buildDfaRowsFromValuationSteps(
  steps: unknown[] | null | undefined,
  areaM2: number = 0
): DfaRow[] {
  if (!Array.isArray(steps) || steps.length === 0) return [];
  const rows: DfaRow[] = [];

  const first = steps[0] as Record<string, unknown> | undefined;
  const initAvg = Number(first?.prev_avg);
  if (Number.isFinite(initAvg)) {
    const initDesc = String(first?.note ?? first?.title ?? 'Başlangıç');
    rows.push({ desc: initDesc, kind: 'initial', details: null });
  }

  for (let i = 1; i < steps.length; i++) {
    const it = (steps[i] ?? {}) as Record<string, unknown>;
    const desc = String(it.note ?? it.title ?? it.key ?? 'Adım');
    const pct = pctTextFromFactors(it.applied_factor);
    const newAvg = Number(it.new_avg);
    let newTotal = it.new_total != null ? Number(it.new_total) : Number.NaN;
    if (!Number.isFinite(newTotal) && Number.isFinite(areaM2) && areaM2 > 0 && Number.isFinite(newAvg)) {
      newTotal = newAvg * areaM2;
    }
    const f = Number(it.applied_factor);
    let kind: DfaRow['kind'] = 'neutral';
    const dl = desc.toLowerCase();
    if (dl.includes('uyarı') || dl.includes('sarı')) kind = 'warn';
    else if (Number.isFinite(f) && f > 1) kind = 'inc';
    else if (Number.isFinite(f) && f < 1) kind = 'dec';
    else if (pct.startsWith('+')) kind = 'inc';
    else if (pct.startsWith('-')) kind = 'dec';

    let details: string[] | null = null;
    try {
      const d = it.details;
      if (Array.isArray(d) && d.length > 0) {
        const msgs = d
          .map((x: unknown) => {
            if (x && typeof x === 'object') return String((x as Record<string, unknown>).message ?? (x as Record<string, unknown>).code ?? JSON.stringify(x));
            return String(x);
          })
          .map((s: string) => s.trim())
          .filter(Boolean);
        details = msgs.length ? msgs : null;
      }
    } catch {
      // ignore
    }
    rows.push({ desc, kind, details });
  }
  return rows;
}
