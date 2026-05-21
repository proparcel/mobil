export type ContactSide = 'alici' | 'satici';

export const CONTACT_SIDE_OPTIONS: { value: ContactSide; label: string }[] = [
  { value: 'alici', label: 'Alıcı' },
  { value: 'satici', label: 'Satıcı' },
];

export function normalizeContactSide(value: unknown): ContactSide | null {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'alici' || s === 'buyer') return 'alici';
  if (s === 'satici' || s === 'seller') return 'satici';
  return null;
}

export function formatContactSideLabel(value: unknown): string | null {
  const side = normalizeContactSide(value);
  if (side === 'alici') return 'Alıcı';
  if (side === 'satici') return 'Satıcı';
  return null;
}

export function contactSideBadgeColors(value: unknown): {
  bg: string;
  border: string;
  text: string;
} {
  const side = normalizeContactSide(value);
  if (side === 'alici') {
    return { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' };
  }
  if (side === 'satici') {
    return { bg: '#ffedd5', border: '#fdba74', text: '#9a3412' };
  }
  return { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b' };
}
