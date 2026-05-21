import { resolveNextSearchDueAt } from './aranacaklarFollowupSchedule';

export type FollowupTone = 'none' | 'waiting' | 'soon' | 'called' | 'overdue';

export function followupTone(
  fu: Record<string, unknown> | null | undefined,
  contact?: Record<string, unknown> | null,
): FollowupTone {
  const resolved = resolveNextSearchDueAt(fu as { next_due_at?: string; interval_months?: number });
  if (!resolved) return 'none';
  const nd = resolved.getTime();
  const now = Date.now();
  if (nd <= now) return 'overdue';
  if (nd <= now + 72 * 3600 * 1000) return 'soon';
  const lp = contact?.last_phone_call_at ? new Date(String(contact.last_phone_call_at)).getTime() : 0;
  if (!Number.isNaN(lp) && lp > 0 && now - lp < 7 * 24 * 3600 * 1000) return 'called';
  return 'waiting';
}

export function followupToneLabel(tone: FollowupTone): string {
  switch (tone) {
    case 'overdue':
      return 'Kaçırıldı';
    case 'soon':
      return 'Sırada';
    case 'called':
      return 'Son arama (Ara)';
    case 'waiting':
      return 'Beklemede';
    default:
      return 'Takip yok';
  }
}
