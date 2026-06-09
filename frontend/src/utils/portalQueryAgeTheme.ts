/** Portal sorgu yaşı — oluşturma tarihine göre dinamik görsel tema (web `portal-query-age-theme.js` ile aynı). */

export type QueryAgeVisualTier = 'default' | 'yellow' | 'red';

const TR_TIMEZONE = 'Europe/Istanbul';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toTrCalendarKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function calendarKeyToUtcMs(key: string): number {
  const [y, m, day] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

/**
 * Oluşturulma günü = 1. gün (elapsedDays 0).
 * Takvim günü farkı Europe/Istanbul saat diliminde hesaplanır.
 */
export function computeQueryAgeElapsedDays(
  createdAtIso: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!createdAtIso) return -1;
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return -1;

  const createdMs = calendarKeyToUtcMs(toTrCalendarKey(created));
  const nowMs = calendarKeyToUtcMs(toTrCalendarKey(now));
  return Math.round((nowMs - createdMs) / MS_PER_DAY);
}

/** Gün 1–10: default; 11–20: sarı; 21–30: kırmızı; 30+ : default */
export function getQueryAgeVisualTier(
  createdAtIso: string | null | undefined,
  now: Date = new Date(),
): QueryAgeVisualTier {
  const elapsedDays = computeQueryAgeElapsedDays(createdAtIso, now);
  if (elapsedDays < 0) return 'default';
  if (elapsedDays >= 30) return 'default';
  if (elapsedDays >= 20) return 'red';
  if (elapsedDays >= 10) return 'yellow';
  return 'default';
}
