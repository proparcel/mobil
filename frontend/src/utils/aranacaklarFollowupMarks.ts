import type { FollowupScheduleInput } from './aranacaklarFollowupSchedule';

export type FollowupActionMark = 'none' | 'due_red' | 'called_green';

function parseTs(value: unknown): number | null {
  if (value == null || value === '') return null;
  const t = new Date(String(value)).getTime();
  return Number.isNaN(t) ? null : t;
}

function lastCallMs(
  contact?: Record<string, unknown> | null,
  followup?: FollowupScheduleInput,
): number | null {
  const phone = parseTs(contact?.last_phone_call_at);
  const fu = parseTs((followup as Record<string, unknown> | null)?.last_called_at);
  const max = Math.max(phone ?? 0, fu ?? 0);
  return max > 0 ? max : null;
}

/** Ham `next_due_at` geçmiş ve o tarihten sonra arama yok → kırmızı; arama yapıldıysa → yeşil. */
export function getFollowupActionMark(
  followup: FollowupScheduleInput,
  contact?: Record<string, unknown> | null,
  now: Date = new Date(),
): FollowupActionMark {
  const rawDueMs = parseTs(followup?.next_due_at);
  if (rawDueMs == null) return 'none';
  const calledMs = lastCallMs(contact, followup);
  if (calledMs != null && calledMs >= rawDueMs) return 'called_green';
  if (rawDueMs <= now.getTime()) return 'due_red';
  return 'none';
}

export function formatContactCreatedAtTr(contact?: Record<string, unknown> | null): string | null {
  const raw = contact?.created_at;
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function followupMarkChipColors(mark: FollowupActionMark): {
  bg: string;
  border: string;
  fg: string;
  dot: string;
} {
  if (mark === 'due_red') {
    return { bg: '#fef2f2', border: '#ef4444', fg: '#991b1b', dot: '#ef4444' };
  }
  if (mark === 'called_green') {
    return { bg: '#f0fdf4', border: '#22c55e', fg: '#14532d', dot: '#22c55e' };
  }
  return { bg: '#f1f5f9', border: '#cbd5e1', fg: '#334155', dot: '#94a3b8' };
}

export function followupMarkStatusLabel(mark: FollowupActionMark): string | null {
  if (mark === 'due_red') return 'Arama zamanı geçti — henüz aranmadı';
  if (mark === 'called_green') return 'Bu dönem için arama yapıldı';
  return null;
}
