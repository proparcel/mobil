import { authJsonFetch } from './apiClient';
import { logSimpleQuery } from '../src/utils/simpleQueryLogger';

export type AdaparselParcelLookupParams = {
  proparcelValue: number;
  ada: string;
  parsel: string;
  mahalle?: string;
  il?: string;
  townId?: number;
};

export type GovernmentParcelAlertResponse = {
  eligible?: boolean;
  found?: boolean;
  should_vibrate?: boolean;
  customer_type?: string;
};

export type GovernmentParcelAlertResult = {
  shouldVibrate: boolean;
  response: GovernmentParcelAlertResponse | null;
  httpStatus?: number;
  error?: string;
};

export type AdaparselParcelDetailResponse = {
  eligible?: boolean;
  found?: boolean;
  customer_type?: string;
  detail?: {
    Adi?: string | null;
    HissePay?: string | null;
    HissePayda?: string | null;
    EdinmeSebebi?: string | null;
  } | null;
};

export type AdaparselParcelDetailResult = {
  found: boolean;
  detail: AdaparselParcelDetailResponse['detail'];
  response: AdaparselParcelDetailResponse | null;
  httpStatus?: number;
  error?: string;
};

function buildLookupSearch(params: AdaparselParcelLookupParams): URLSearchParams {
  const search = new URLSearchParams({
    proparcel_value: String(params.proparcelValue),
    ada: params.ada.trim(),
    parsel: params.parsel.trim(),
  });
  // Lookup proparcel_value + ada + parsel ile yapılır; mahalle isim filtresi gönderilmez.
  const il = params.il?.trim();
  if (il) {
    search.set('il', il);
  }
  if (params.townId != null && Number.isFinite(params.townId) && params.townId > 0) {
    search.set('town_id', String(params.townId));
  }
  return search;
}

export async function fetchGovernmentParcelAlert(
  params: AdaparselParcelLookupParams,
): Promise<GovernmentParcelAlertResult> {
  const endpoint = `/api/adaparsel/government_parcel_alert/?${buildLookupSearch(params).toString()}`;
  logSimpleQuery('gov_alert_api_request', { endpoint, params });

  const res = await authJsonFetch<GovernmentParcelAlertResponse>(endpoint, { method: 'GET' });

  logSimpleQuery('gov_alert_api_response', {
    ok: res.ok,
    status: res.status,
    error: res.ok ? undefined : res.error,
    data: res.ok ? res.data : res.payload,
  });

  if (!res.ok) {
    return {
      shouldVibrate: false,
      response: null,
      httpStatus: res.status,
      error: res.error,
    };
  }

  return {
    shouldVibrate: res.data?.should_vibrate === true,
    response: res.data ?? null,
    httpStatus: res.status,
  };
}

export async function fetchAdaparselParcelDetail(
  params: AdaparselParcelLookupParams,
): Promise<AdaparselParcelDetailResult> {
  const endpoint = `/api/adaparsel/parcel_detail/?${buildLookupSearch(params).toString()}`;
  logSimpleQuery('adaparsel_detail_api_request', { endpoint, params });

  const res = await authJsonFetch<AdaparselParcelDetailResponse>(endpoint, { method: 'GET' });

  logSimpleQuery('adaparsel_detail_api_response', {
    ok: res.ok,
    status: res.status,
    error: res.ok ? undefined : res.error,
    data: res.ok ? res.data : res.payload,
  });

  if (!res.ok) {
    return {
      found: false,
      detail: null,
      response: null,
      httpStatus: res.status,
      error: res.error,
    };
  }

  return {
    found: res.data?.found === true,
    detail: res.data?.detail ?? null,
    response: res.data ?? null,
    httpStatus: res.status,
  };
}
