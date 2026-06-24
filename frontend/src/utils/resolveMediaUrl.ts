import { API_URL } from '../../config/api';

/**
 * Relative media path → absolute URL (avatar, logo vb.).
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const base = API_URL.replace(/\/$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
}
