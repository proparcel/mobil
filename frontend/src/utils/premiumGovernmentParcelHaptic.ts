import type { User } from '../types/auth';
import type { AdaparselParcelLookupParams } from '../../services/adaparselAlertService';
import { fetchGovernmentParcelAlert } from '../../services/adaparselAlertService';
import { prefetchAdaparselParcelDetail } from './adaparselDetailCache';
import { triggerGovernmentParcelAlertHaptic } from './hapticFeedback';
import { isGovernmentHapticEligible, isPremiumCustomer } from './membership';
import { logSimpleQuery } from './simpleQueryLogger';
import { resolveTkgmParcelLookupParams, type TkgmParcelLookupParams } from './tkgmParcelIdentifiers';

export type GovernmentParcelHapticInput = TkgmParcelLookupParams;

const GOVERNMENT_KEYWORDS = ['devlet', 'kamu', 'tc', 't.c.', 'tck', 'tcdd'] as const;
const inflightAdaparselKeys = new Set<string>();

function adaparselDedupeKey(input: GovernmentParcelHapticInput): string {
  return `${input.proparcelValue}:${input.ada.trim()}:${input.parsel.trim()}:${(input.il ?? '').trim()}:${input.townId ?? ''}`;
}

function shouldSkipAdaparselRun(key: string): boolean {
  return inflightAdaparselKeys.has(key);
}

function markAdaparselRunStart(key: string): void {
  inflightAdaparselKeys.add(key);
}

function markAdaparselRunDone(key: string): void {
  inflightAdaparselKeys.delete(key);
}

/** Form payload — TKGM beklemeden adaparsel API paralel başlatılabilir. */
export function buildGovernmentHapticInputFromSubmitPayload(payload: {
  proparcelValue?: number | null;
  ada?: string | null;
  parsel?: string | null;
  mahalle?: string | null;
  city?: string | null;
  townId?: number | null;
}): GovernmentParcelHapticInput | null {
  const proparcelValue = Number(payload.proparcelValue);
  const ada = String(payload.ada ?? '').trim();
  const parsel = String(payload.parsel ?? '').trim();
  if (!Number.isFinite(proparcelValue) || proparcelValue <= 0 || !ada || !parsel) {
    return null;
  }
  const il = String(payload.city ?? '').trim();
  const townId =
    payload.townId != null && Number(payload.townId) > 0 ? Number(payload.townId) : undefined;
  return {
    proparcelValue,
    ada,
    parsel,
    mahalle: String(payload.mahalle ?? '').trim() || undefined,
    il: il || undefined,
    townId,
  };
}

/** Form payload + TKGM properties — kayıtlı sorgu / ada-parsel formu. */
export function resolveHapticInputForSubmit(
  payload: {
    proparcelValue?: number | null;
    ada?: string | null;
    parsel?: string | null;
    mahalle?: string | null;
    city?: string | null;
    townId?: number | null;
  },
  properties?: Record<string, unknown> | null,
): GovernmentParcelHapticInput | null {
  return resolveGovernmentHapticInput(properties, {
    proparcelValue: payload.proparcelValue,
    ada: payload.ada,
    parsel: payload.parsel,
    mahalle: payload.mahalle,
    il: payload.city,
    townId: payload.townId,
  });
}

export function adiContainsGovernmentKeyword(adi?: string | null): boolean {
  const text = String(adi ?? '').trim().toLowerCase();
  if (!text) return false;
  return GOVERNMENT_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function resolveGovernmentHapticInput(
  properties?: Record<string, unknown> | null,
  form?: {
    proparcelValue?: number | null;
    ada?: string | null;
    parsel?: string | null;
    mahalle?: string | null;
    il?: string | null;
    townId?: number | null;
  },
): GovernmentParcelHapticInput | null {
  const params = resolveTkgmParcelLookupParams(properties, form);
  if (!params) {
    const p = properties || {};
    logSimpleQuery('gov_haptic_resolve_missing', {
      ada: String(form?.ada ?? p.adaNo ?? p.ada ?? ''),
      parsel: String(form?.parsel ?? p.parselNo ?? p.parsel ?? ''),
      mahalleId: p.mahalleId,
      mahalleAd: p.mahalleAd,
    });
    return null;
  }
  return params;
}

function hasRequiredFields(input: GovernmentParcelHapticInput): boolean {
  const proparcelValue = Number(input.proparcelValue);
  const ada = String(input.ada ?? '').trim();
  const parsel = String(input.parsel ?? '').trim();
  return Number.isFinite(proparcelValue) && proparcelValue > 0 && !!ada && !!parsel;
}

function fireGovernmentHaptic(source: string, input: GovernmentParcelHapticInput, extra?: Record<string, unknown>): void {
  triggerGovernmentParcelAlertHaptic();
  logSimpleQuery('gov_haptic_triggered', { source, input, ...extra });
}

/** VIP / vip_limited — gov_alert API (tier kararı sunucuda). */
export async function maybeTriggerGovernmentParcelHaptic(
  user: User | null | undefined,
  input: GovernmentParcelHapticInput,
): Promise<void> {
  if (!user || !hasRequiredFields(input)) {
    logSimpleQuery('gov_haptic_check_skip', {
      hasUser: !!user,
      hasRequiredFields: hasRequiredFields(input),
      customerType: user?.customer_type,
    });
    return;
  }

  logSimpleQuery('gov_haptic_check_start', {
    eligibleClient: isGovernmentHapticEligible(user),
    customerType: user?.customer_type,
    userId: user?.id,
    input,
  });

  const apiStart = performance.now();
  try {
    const apiResult = await fetchGovernmentParcelAlert({
      proparcelValue: Number(input.proparcelValue),
      ada: String(input.ada).trim(),
      parsel: String(input.parsel).trim(),
      mahalle: input.mahalle?.trim() || undefined,
      il: input.il?.trim() || undefined,
      townId: input.townId,
    });
    const apiMs = Math.round(performance.now() - apiStart);
    const eligibleServer = apiResult.response?.eligible === true;
    logSimpleQuery('gov_haptic_api_result', {
      shouldVibrate: apiResult.shouldVibrate,
      eligibleServer,
      serverCustomerType: apiResult.response?.customer_type,
      found: apiResult.response?.found,
      response: apiResult.response,
      httpStatus: apiResult.httpStatus,
      error: apiResult.error,
      input,
      api_ms: apiMs,
    });
    if (apiResult.shouldVibrate) {
      fireGovernmentHaptic('gov_alert_api', input, { api_ms: apiMs });
    } else if (!eligibleServer) {
      logSimpleQuery('gov_haptic_server_ineligible', {
        customerType: apiResult.response?.customer_type,
        input,
      });
    }
  } catch (error) {
    logSimpleQuery('gov_haptic_api_error', {
      input,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Premium: tapu detayı fetch + titreşim (tek istek, Adi kaynağı).
 * VIP: yalnızca gov_alert API.
 */
export async function runAdaparselPostSimpleQuery(
  user: User | null | undefined,
  input: GovernmentParcelHapticInput,
): Promise<void> {
  if (!user || !hasRequiredFields(input)) {
    logSimpleQuery('adaparsel_post_query_skip', {
      hasUser: !!user,
      hasRequiredFields: hasRequiredFields(input),
      customerType: user?.customer_type,
    });
    return;
  }

  if (!isGovernmentHapticEligible(user)) {
    logSimpleQuery('adaparsel_post_query_skip', {
      reason: 'not_haptic_tier',
      customerType: user?.customer_type,
    });
    return;
  }

  const dedupeKey = adaparselDedupeKey(input);
  if (shouldSkipAdaparselRun(dedupeKey)) {
    logSimpleQuery('adaparsel_post_query_dedupe_skip', { dedupeKey, input });
    return;
  }
  markAdaparselRunStart(dedupeKey);

  try {
    if (isPremiumCustomer(user)) {
      const fetchStart = performance.now();
      try {
        const result = await prefetchAdaparselParcelDetail(input);
        const detailFetchMs = Math.round(performance.now() - fetchStart);
        const adi = result.detail?.Adi;
        const shouldVibrate = result.found && adiContainsGovernmentKeyword(adi);
        logSimpleQuery('gov_haptic_premium_detail_check', {
          found: result.found,
          adi,
          shouldVibrate,
          detailFetchMs,
          input,
        });
        if (shouldVibrate) {
          fireGovernmentHaptic('premium_detail_adi', input, { detailFetchMs, adi });
        } else if (!result.found) {
          await maybeTriggerGovernmentParcelHaptic(user, input);
        }
      } catch (error) {
        logSimpleQuery('gov_haptic_premium_detail_error', {
          input,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    await maybeTriggerGovernmentParcelHaptic(user, input);
  } finally {
    markAdaparselRunDone(dedupeKey);
  }
}
