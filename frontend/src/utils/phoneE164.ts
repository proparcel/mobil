/**
 * Best-effort E.164 for Turkey (rehber import). Avoids libphonenumber-js — Metro
 * cannot resolve that package's ESM .js subpaths reliably on Windows.
 */
export function normalizePhoneToE164TR(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  // TR: 0 5xx xxx xx xx
  if (d.length === 11 && d.startsWith('0') && d[1] === '5') {
    return `+90${d.slice(1)}`;
  }
  // TR: 5xx xxx xx xx (10 digits national mobile)
  if (d.length === 10 && d.startsWith('5')) {
    return `+90${d}`;
  }
  // Already 90 5xxxxxxxxxxx
  if (d.length >= 12 && d.startsWith('90')) {
    return `+${d}`;
  }
  // Long international without +
  if (d.length >= 11) {
    return `+${d}`;
  }
  return `+${d}`;
}
