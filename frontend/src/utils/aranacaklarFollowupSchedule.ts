/** Takip: `next_due_at` + `interval_months` — backend ile uyumlu ileri sarma. */

export type FollowupScheduleInput = {
  next_due_at?: string | Date | null;
  interval_months?: number | null;
} | null | undefined;

function parseDue(raw: string | Date): Date | null {
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Python `relativedelta(months=…)` ile uyumlu takvim ayı ekleme. */
export function addCalendarMonths(base: Date, months: number): Date {
  const y = base.getFullYear();
  const m = base.getMonth() + Number(months);
  const day = base.getDate();
  const h = base.getHours();
  const min = base.getMinutes();
  const sec = base.getSeconds();
  const ms = base.getMilliseconds();
  return new Date(y, m, day, h, min, sec, ms);
}

/**
 * Vadesi geçmiş `next_due_at` değerini `interval_months` ile ileri sararak
 * önümüzdeki (gelecek) arama tarihini döner.
 */
export function resolveNextSearchDueAt(
  followup: FollowupScheduleInput,
  now: Date = new Date(),
): Date | null {
  if (!followup?.next_due_at) return null;
  const first = parseDue(followup.next_due_at);
  if (!first) return null;
  const months = Math.max(1, Math.floor(Number(followup.interval_months) || 3));
  const nowMs = now.getTime();
  let due = first;
  let guard = 0;
  while (due.getTime() <= nowMs && guard < 120) {
    due = addCalendarMonths(due, months);
    guard += 1;
  }
  return due;
}

/** Yerel takvim günü farkı (bugün = 0, yarın = 1). */
export function calendarDaysUntilNextSearch(
  followup: FollowupScheduleInput,
  now: Date = new Date(),
): number | null {
  const due = resolveNextSearchDueAt(followup, now);
  if (!due) return null;
  const from = startOfLocalDay(now).getTime();
  const to = startOfLocalDay(due).getTime();
  return Math.round((to - from) / 86400000);
}

export function formatDaysUntilNextSearchLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return 'Önümüzdeki aramaya bugün';
  if (days === 1) return 'Önümüzdeki aramaya 1 gün kaldı';
  return `Önümüzdeki aramaya ${days} gün kaldı`;
}

export function getNextSearchCountdownLabel(
  followup: FollowupScheduleInput,
  now?: Date,
): string | null {
  return formatDaysUntilNextSearchLabel(calendarDaysUntilNextSearch(followup, now));
}

export function formatNextSearchDueDateTr(
  followup: FollowupScheduleInput,
  now?: Date,
): string | null {
  const due = resolveNextSearchDueAt(followup, now);
  if (!due) return null;
  return due.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
