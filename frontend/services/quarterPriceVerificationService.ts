import { authJsonFetch } from './apiClient';
import {
  buildQuarterVerificationRequestBody,
  type QuarterPriceVerificationStatusResponse,
} from '../src/utils/quarterPriceVerification';
import type { TkgmViewResponse } from '../src/types/parcelResponse';
import {
  isQuarterVerificationFeatureLockedError,
  quarterVerificationFeatureLockedMessage,
} from '../src/utils/customerFeatureGates';

export type QuarterVerificationFetchResult =
  | { ok: true; data: QuarterPriceVerificationStatusResponse }
  | {
      ok: false;
      error: string;
      status?: number;
      featureLocked?: boolean;
      payload?: Record<string, unknown>;
    };

/**
 * POST /api/quarter_price_verification_status/
 * Hata olsa bile çağıran modalda "Durum alınamadı" gösterir; akışı kilitlemez.
 */
export async function fetchQuarterPriceVerificationStatus(
  tkgmData: TkgmViewResponse | null | undefined
): Promise<QuarterVerificationFetchResult> {
  const body = buildQuarterVerificationRequestBody(tkgmData);
  const result = await authJsonFetch<QuarterPriceVerificationStatusResponse>(
    '/api/quarter_price_verification_status/',
    { method: 'POST', json: body }
  );

  if (!result.ok) {
    const payload = result.payload as
      | { error?: string; feature?: string; message?: string }
      | undefined;
    const featureLocked = isQuarterVerificationFeatureLockedError(result.status, payload);
    return {
      ok: false,
      error: featureLocked
        ? quarterVerificationFeatureLockedMessage(payload)
        : result.error || 'Durum alınamadı',
      status: result.status,
      featureLocked,
      payload: result.payload,
    };
  }

  if (!result.data || result.data.success !== true) {
    return { ok: false, error: 'Durum alınamadı' };
  }

  return { ok: true, data: result.data };
}
