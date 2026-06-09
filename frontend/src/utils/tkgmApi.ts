/**
 * TKGM API doğrudan çağrıları (mobil).
 * Basit sorgu TKGM istekleri yalnızca cbsapi.tkgm.gov.tr üzerinden yapılır; backend proxy yok.
 */

import {
  isPassiveParcelPayload,
  normalizeAndConfirm,
  type PassiveConfirmFn,
} from './tkgmPassiveParcel';

export { isPassiveParcelPayload } from './tkgmPassiveParcel';
export type { PassiveConfirmFn } from './tkgmPassiveParcel';

const TKGM_API_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel';
const TKGM_TIMEOUT = 20000;

const TKGM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  Origin: 'https://parselsorgu.tkgm.gov.tr',
  Referer: 'https://parselsorgu.tkgm.gov.tr/',
};

export interface TkgmError {
  type: string;
  status?: number;
  message: string;
  detail?: unknown;
  originalError?: unknown;
}

export interface TkgmData {
  geometry: unknown;
  properties: unknown;
}

function normalizeTkgmFetchError(error: unknown): TkgmError {
  const err = error as { name?: string; type?: string; message?: string; status?: number; detail?: unknown; originalError?: unknown };
  if (err?.type) return err as TkgmError;

  if (err?.name === 'AbortError') {
    return { type: 'TIMEOUT', message: 'TKGM API zaman aşımı' };
  }

  if (
    err?.name === 'TypeError' ||
    err?.message?.includes('Failed to fetch') ||
    err?.message?.includes('NetworkError')
  ) {
    return {
      type: 'CORS_OR_NETWORK_ERROR',
      message: 'TKGM sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.',
      originalError: err,
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    message: err?.message || 'Bilinmeyen hata',
    originalError: err,
  };
}

/**
 * Pasif/toplulaştırılmış parsel ise onay (modal) sonrası normalize feature döndürür.
 * Pasif değilse data'yı olduğu gibi döner.
 */
export async function applyPassiveParcelIfNeeded(
  data: unknown,
  confirm?: PassiveConfirmFn,
): Promise<unknown> {
  if (isPassiveParcelPayload(data)) {
    return normalizeAndConfirm(data, confirm);
  }
  return data;
}

async function parseTkgmResponse(
  response: Response,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  if (response.status === 404) {
    let errorData: Record<string, unknown> | null = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { Message: 'Parsel Bulunamadı' };
    }
    // 404 yanıtı aslında pasif parsel payload'ı olabilir → kurtar (hata fırlatma).
    if (isPassiveParcelPayload(errorData)) {
      const normalized = await applyPassiveParcelIfNeeded(errorData, confirm);
      return normalized as TkgmData;
    }
    const msg =
      (errorData?.Message as string) ||
      (errorData?.message as string) ||
      'Parsel Bulunamadı';
    throw {
      type: 'TKGM_PARCEL_NOT_FOUND',
      status: 404,
      message: msg,
      detail: errorData,
    } as TkgmError;
  }

  if (response.status === 403) {
    let errorData: Record<string, unknown> | null = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { Message: 'Günlük sorgu limitini aştınız.' };
    }
    const msg =
      (errorData?.Message as string) ||
      (errorData?.message as string) ||
      (errorData?.error as string) ||
      'Günlük sorgu limitini aştınız.';
    throw {
      type: 'TKGM_RATE_LIMIT',
      status: 403,
      message: msg,
      detail: errorData,
    } as TkgmError;
  }

  if (!response.ok) {
    throw {
      type: 'TKGM_ERROR',
      status: response.status,
      message: `HTTP ${response.status}`,
    } as TkgmError;
  }

  let data = await response.json();
  // 200 yanıtında geometry yok ama gittigiParselListe/pp_tkgm_passive_redirect varsa pasif parsel.
  data = await applyPassiveParcelIfNeeded(data, confirm);
  if (!data?.geometry || !data?.properties) {
    throw {
      type: 'TKGM_INVALID_DATA',
      message: 'Geçersiz veri formatı',
    } as TkgmError;
  }

  return data as TkgmData;
}

async function fetchTkgmDirect(
  url: string,
  signal?: AbortSignal,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TKGM_TIMEOUT);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: TKGM_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await parseTkgmResponse(response, confirm);
  } catch (error) {
    clearTimeout(timeoutId);
    throw normalizeTkgmFetchError(error);
  }
}

/** Koordinat ile doğrudan TKGM sorgusu */
export async function fetchTkgmByCoords(
  lat: number,
  lon: number,
  signal?: AbortSignal,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  return fetchTkgmDirect(`${TKGM_API_BASE}/${lat}/${lon}/`, signal, confirm);
}

/** Ada/parsel ile doğrudan TKGM sorgusu */
export async function fetchTkgmByIds(
  mahalleTkgmValue: string | number,
  ada: string | number,
  parsel: string | number,
  signal?: AbortSignal,
  confirm?: PassiveConfirmFn,
): Promise<TkgmData> {
  const mahalle = String(mahalleTkgmValue).trim();
  const adaStr = String(ada).trim();
  const parselStr = String(parsel).trim();
  return fetchTkgmDirect(
    `${TKGM_API_BASE}/${mahalle}/${encodeURIComponent(adaStr)}/${encodeURIComponent(parselStr)}`,
    signal,
    confirm,
  );
}
