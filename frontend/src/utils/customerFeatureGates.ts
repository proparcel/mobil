import { Alert } from 'react-native';
import type { User } from '../types/auth';

export { parseCustomerFeatureFlags } from './customerFeatureFlags';

export const SMART_QUERY_UPGRADE_MESSAGE =
  'Bu özellik abonelik paketine dahildir. Paketinizi yükselterek metin, ses ve görsel ile Akıllı Sorgu kullanabilirsiniz.';

function lower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function canUseSmartQuery(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.features?.smart_query === true) return true;
  const ct = lower(user.customer_type || 'basic');
  return ['business', 'silver', 'gold', 'premium', 'vip', 'vip_limited'].includes(ct);
}

export function promptSmartQueryUpgrade(onViewPricing?: () => void): void {
  Alert.alert('Akıllı Sorgu', SMART_QUERY_UPGRADE_MESSAGE, [
    { text: 'İptal', style: 'cancel' },
    ...(onViewPricing
      ? [{ text: 'Paketleri İncele', onPress: onViewPricing }]
      : []),
  ]);
}

export function promptSmartQueryLogin(onLogin?: () => void): void {
  Alert.alert('Giriş gerekli', 'Akıllı sorgu için giriş yapın.', [
    { text: 'İptal', style: 'cancel' },
    ...(onLogin ? [{ text: 'Giriş Yap', onPress: onLogin }] : []),
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

export const QUARTER_VERIFICATION_UPGRADE_MESSAGE =
  'Bu özellik abonelik paketine dahildir. Paketinizi yükselterek mahalle birim fiyat doğrulama durumunu görebilirsiniz.';

/** Yalnızca sunucu feature bayrağına güven — customer_type hardcode etme. */
export function canUseQuarterVerification(user: User | null | undefined): boolean {
  return user?.features?.quarter_verification === true;
}

export function promptQuarterVerificationUpgrade(onViewPricing?: () => void): void {
  Alert.alert('Doğrulama', QUARTER_VERIFICATION_UPGRADE_MESSAGE, [
    { text: 'İptal', style: 'cancel' },
    ...(onViewPricing
      ? [{ text: 'Paketleri İncele', onPress: onViewPricing }]
      : []),
  ]);
}

export function isQuarterVerificationFeatureLockedError(
  status: number | undefined,
  body: { error?: string; feature?: string; message?: string } | null | undefined
): boolean {
  return (
    status === 403 &&
    body?.error === 'feature_locked' &&
    body?.feature === 'quarter_verification'
  );
}

export function quarterVerificationFeatureLockedMessage(
  body: { message?: string } | null | undefined
): string {
  return String(body?.message || '').trim() || QUARTER_VERIFICATION_UPGRADE_MESSAGE;
}
