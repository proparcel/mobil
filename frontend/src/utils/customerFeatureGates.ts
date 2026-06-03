import { Alert } from 'react-native';
import type { CustomerFeatureFlags, User } from '../types/auth';

const SMART_QUERY_ALLOWED_TYPES = ['business', 'silver', 'gold', 'premium'] as const;

export const SMART_QUERY_UPGRADE_MESSAGE =
  'Bu özellik abonelik paketine dahildir. Paketinizi yükselterek metin, ses ve görsel ile Akıllı Sorgu kullanabilirsiniz.';

export function canUseSmartQuery(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.features?.smart_query === true) return true;
  const ct = (user.customer_type || 'basic').toLowerCase();
  return (SMART_QUERY_ALLOWED_TYPES as readonly string[]).includes(ct);
}

export function parseCustomerFeatureFlags(raw: unknown): CustomerFeatureFlags | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.smart_query !== 'boolean') return undefined;
  return { smart_query: obj.smart_query };
}

export function promptSmartQueryUpgrade(onViewPricing?: () => void): void {
  Alert.alert('Akıllı Sorgu', SMART_QUERY_UPGRADE_MESSAGE, [
    { text: 'İptal', style: 'cancel' },
    ...(onViewPricing
      ? [{ text: 'Paketleri İncele', onPress: onViewPricing }]
      : []),
  ]);
}

export function isSmartQueryFeatureLockedError(
  status: number | undefined,
  body: { error?: string; feature?: string; message?: string } | null | undefined
): boolean {
  return status === 403 && body?.error === 'feature_locked' && body?.feature === 'smart_query';
}

export function smartQueryFeatureLockedMessage(
  body: { message?: string } | null | undefined
): string {
  return String(body?.message || '').trim() || SMART_QUERY_UPGRADE_MESSAGE;
}
