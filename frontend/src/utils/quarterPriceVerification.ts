import type { User } from '../types/auth';
import type { TkgmViewResponse } from '../types/parcelResponse';
import { canUseQuarterVerification } from './customerFeatureGates';

export type QuarterVerificationStatus = 'verified' | 'unverified' | 'missing';

export type QuarterVerificationPropertyKey = 'arsa' | 'tarla' | 'ticari';

export type QuarterPriceVerificationStatusResponse = {
  success: true;
  proparcel_value?: number;
  properties: Partial<
    Record<QuarterVerificationPropertyKey, { status?: QuarterVerificationStatus | string }>
  >;
};

export function quarterVerificationStatusLabel(
  status: string | null | undefined
): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'verified') return 'Doğrulandı';
  if (s === 'unverified') return 'Doğrulanmadı';
  if (s === 'missing') return 'Veri yok';
  return 'Durum alınamadı';
}

export function shouldShowVerification(
  user: User | null | undefined,
  toggleOn: boolean
): boolean {
  return canUseQuarterVerification(user) && toggleOn === true;
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/** API body — öncelik: proparcel_value → mahalleId → properties. */
export function buildQuarterVerificationRequestBody(
  tkgmData: TkgmViewResponse | null | undefined
): Record<string, unknown> {
  const props = (tkgmData?.properties || {}) as Record<string, unknown>;
  const proparcelValue = toPositiveInt(
    props.Proparcel_value ?? props.proparcel_value ?? props.ProparcelValue
  );
  const mahalleId = toPositiveInt(
    props.mahalleId ??
      props.mahalleTkgmValue ??
      props.mahalle_tkgm_value ??
      props.tkgm_value ??
      props.Tkgm_value
  );

  if (proparcelValue != null) {
    return { proparcel_value: proparcelValue };
  }
  if (mahalleId != null) {
    return { mahalleId };
  }

  return {
    properties: {
      Proparcel_value: props.Proparcel_value ?? props.proparcel_value ?? null,
      mahalleId: props.mahalleId ?? null,
      mahalleAd: props.mahalleAd ?? props.mahalle ?? null,
      ilAd: props.ilAd ?? props.il ?? null,
      ilceAd: props.ilceAd ?? props.ilce ?? null,
    },
  };
}
