import locationsJson from '../data/locations.json';
import type { SmartQueryExtractResult } from '../types/smartQuery';
import type { SidebarSavedQuery } from './sidebarSavedQueries';
import {
  findLocationByIds,
  findQuarterByIdInLocations,
  type LocationCity,
  type LocationQuarter,
  type LocationTown,
} from './locationLookup';
import {
  resolveVoiceLocationFromExtract,
  resolveVoiceCityTownFromExtract,
  type VoiceLocationExtractInput,
  type VoiceLocationResolveDebug,
} from './voiceLocationResolve';
import type { SmartQueryDebugChannel } from './smartQueryDebugLog';
import {
  logSmartQueryResolveFailed,
  logSmartQueryResolveStart,
  logSmartQueryResolveSuccess,
  appendSmartQueryDebugLog,
} from './smartQueryDebugLog';

export type SmartQueryParcelPayload = {
  mahalleTkgmValue: number;
  mahalle: string;
  ada: string;
  parsel: string;
  proparcelValue?: number;
  city?: string;
  town?: string;
  cityId?: number;
  townId?: number;
  quarterId?: number;
};

type Quarter = LocationQuarter;
type Town = LocationTown;
type City = LocationCity;

type LocationsResponse = {
  cities: City[];
};

const LOCATIONS = locationsJson as unknown as LocationsResponse;

export const buildSmartQuerySummary = (
  result: SmartQueryExtractResult,
  city?: City,
  town?: Town,
  quarter?: Quarter,
): string => {
  const parts = [
    city?.Proparcel_text || result.il || '',
    town?.Proparcel_text || result.ilce || '',
    quarter?.Proparcel_text || quarter?.Tkgm_text || result.mahalle || '',
  ].filter(Boolean);

  const adaParsel = [
    normalizeParcelDigits(String(result.ada_no || '')),
    normalizeParcelDigits(String(result.parsel_no || '')),
  ]
    .filter(Boolean)
    .join('/');

  return [parts.join(' / '), adaParsel].filter(Boolean).join(' - ');
};

const normalizeParcelDigits = (value: string): string =>
  String(value ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(/,/g, '');

export { normalizeParcelDigits };

function smartQueryResultToLocationInput(
  result: SmartQueryExtractResult,
): VoiceLocationExtractInput {
  return {
    il: result.il,
    ilce: result.ilce,
    mahalle: result.mahalle,
    city_id: result.city_id,
    town_id: result.town_id,
    quarter_id: result.quarter_id,
    tkgm_value: result.tkgm_value,
    proparcel_value: result.proparcel_value,
    transcript: result.transcribed_text,
  };
}

function buildPayloadFromLocations(
  result: SmartQueryExtractResult,
  city: City,
  town: Town,
  quarter: Quarter,
  ada: string,
  parsel: string,
): SmartQueryParcelPayload {
  const apiTkgm = Number(result.tkgm_value);
  const quarterTkgm = Number(quarter.Tkgm_value);
  const mahalleTkgmValue = Number.isFinite(quarterTkgm)
    ? quarterTkgm
    : Number.isFinite(apiTkgm)
      ? apiTkgm
      : NaN;

  if (!Number.isFinite(mahalleTkgmValue)) {
    throw new Error('Mahalle kodu bulunamadı.');
  }

  if (
    Number.isFinite(apiTkgm) &&
    Number.isFinite(quarterTkgm) &&
    apiTkgm !== quarterTkgm
  ) {
    console.warn('[SmartQuery] tkgm_value uyuşmazlığı', {
      api: apiTkgm,
      locations: quarterTkgm,
      quarter_id: result.quarter_id,
    });
  }

  const payload: SmartQueryParcelPayload = {
    mahalleTkgmValue,
    mahalle: quarter.Proparcel_text || quarter.Tkgm_text || String(result.mahalle || '').trim(),
    ada,
    parsel,
    city: city.Proparcel_text || String(result.il || '').trim(),
    town: town.Proparcel_text || String(result.ilce || '').trim(),
    cityId: city.Id,
    townId: town.Id,
    quarterId: quarter.Id,
  };

  const apiPp = Number(result.proparcel_value);
  const quarterPp = Number(quarter.Proparcel_value);
  const proparcelValue = Number.isFinite(quarterPp)
    ? quarterPp
    : Number.isFinite(apiPp)
      ? apiPp
      : NaN;

  if (Number.isFinite(proparcelValue)) {
    payload.proparcelValue = proparcelValue;
  }

  return payload;
}

/**
 * Akıllı sorgu API yanıtını forma aktarılabilir payload'a çevirir.
 * Konum çözümleme: voiceLocationResolve (ortak).
 */
export type SmartQueryResolveOptions = {
  channel?: SmartQueryDebugChannel;
  source?: 'orb' | 'modal' | 'resolve';
};

export const SMART_QUERY_PARTIAL_MAHALLE_MESSAGE =
  'Mahalle otomatik eşleşmedi. İl, ilçe, ada ve parsel dolduruldu — lütfen mahalleyi seçin.';

function isBackendMahalleOnlyFailure(result: SmartQueryExtractResult): boolean {
  if (result.ok !== false) return false;
  const err = String(result.error || '');
  if (!/mahalle/i.test(err)) return false;
  const ada = normalizeParcelDigits(String(result.ada_no || ''));
  const parsel = normalizeParcelDigits(String(result.parsel_no || ''));
  return Boolean(ada && parsel && result.il && result.ilce);
}

export function buildPartialSmartQueryFormSeed(
  result: SmartQueryExtractResult,
  cityTown: { city: City; town: Town; cityName: string; townName: string },
  ada: string,
  parsel: string,
): SidebarSavedQuery {
  const now = new Date().toISOString();
  const mahalleHint = String(result.mahalle || '').trim();
  return {
    id: `smart-partial-${Date.now()}`,
    mode: 'simple',
    il: cityTown.cityName,
    ilce: cityTown.townName,
    mahalle: mahalleHint,
    il_id: String(cityTown.city.Id),
    ilce_id: String(cityTown.town.Id),
    ada,
    parsel,
    partialMahalle: true,
    updatedAt: now,
  };
}

function tryBuildPartialSmartQuerySeed(
  result: SmartQueryExtractResult,
): SidebarSavedQuery | null {
  const ada = normalizeParcelDigits(String(result.ada_no || ''));
  const parsel = normalizeParcelDigits(String(result.parsel_no || ''));
  if (!ada || !parsel) return null;

  const cityTown = resolveVoiceCityTownFromExtract(smartQueryResultToLocationInput(result));
  if (!cityTown) return null;

  return buildPartialSmartQueryFormSeed(result, cityTown, ada, parsel);
}

export type SmartQueryFormResolution =
  | { status: 'complete'; seed: SidebarSavedQuery; summary: string; payload: SmartQueryParcelPayload }
  | { status: 'partial'; seed: SidebarSavedQuery; message: string }
  | { status: 'failed'; error: string };

/** API yanıtını forma aktarır; mahalle yoksa kısmi doldurma döner. */
export async function resolveSmartQueryForForm(
  result: SmartQueryExtractResult,
  options: SmartQueryResolveOptions = {},
): Promise<SmartQueryFormResolution> {
  const channel = options.channel ?? 'speech';
  const source = options.source ?? 'resolve';

  if (result.ok === false) {
    const partialSeed = isBackendMahalleOnlyFailure(result)
      ? tryBuildPartialSmartQuerySeed(result)
      : null;
    if (partialSeed) {
      await appendSmartQueryDebugLog('resolve_partial', source, {
        channel,
        message: SMART_QUERY_PARTIAL_MAHALLE_MESSAGE,
        il: partialSeed.il,
        ilce: partialSeed.ilce,
        ada: partialSeed.ada,
        parsel: partialSeed.parsel,
        apiError: result.error,
      });
      return {
        status: 'partial',
        seed: partialSeed,
        message: SMART_QUERY_PARTIAL_MAHALLE_MESSAGE,
      };
    }
    return {
      status: 'failed',
      error: result.error || 'Sorgu metni çözümlenemedi.',
    };
  }

  const resolved = await resolveSmartQueryPayload(result, options);
  if (resolved.ok) {
    return {
      status: 'complete',
      seed: smartQueryPayloadToFormSeed(resolved.payload),
      summary: resolved.summary,
      payload: resolved.payload,
    };
  }

  const partialSeed = tryBuildPartialSmartQuerySeed(result);
  if (partialSeed) {
    await appendSmartQueryDebugLog('resolve_partial', source, {
      channel,
      message: SMART_QUERY_PARTIAL_MAHALLE_MESSAGE,
      il: partialSeed.il,
      ilce: partialSeed.ilce,
      ada: partialSeed.ada,
      parsel: partialSeed.parsel,
      resolveError: resolved.error,
      locationDebug: resolved.debug ?? null,
    });
    return {
      status: 'partial',
      seed: partialSeed,
      message: SMART_QUERY_PARTIAL_MAHALLE_MESSAGE,
    };
  }

  return { status: 'failed', error: resolved.error };
}

export async function resolveSmartQueryPayload(
  result: SmartQueryExtractResult,
  options: SmartQueryResolveOptions = {},
): Promise<
  | { ok: true; payload: SmartQueryParcelPayload; summary: string }
  | { ok: false; error: string; debug?: VoiceLocationResolveDebug }
> {
  const channel = options.channel ?? 'speech';
  const source = options.source ?? 'resolve';

  const ada = normalizeParcelDigits(String(result.ada_no || ''));
  const parsel = normalizeParcelDigits(String(result.parsel_no || ''));

  if (!ada || !parsel) {
    const error = 'Metinden ada ve parsel bilgisi çıkarılamadı.';
    await logSmartQueryResolveFailed(source, channel, { error, result });
    return { ok: false, error };
  }

  await logSmartQueryResolveStart(source, channel, result);

  const locationInput = smartQueryResultToLocationInput(result);
  const locResult = await resolveVoiceLocationFromExtract(locationInput);
  if (!locResult.ok) {
    const error =
      result.quarter_id != null && Number.isFinite(Number(result.quarter_id))
        ? locResult.error
        : 'Akıllı sorgu alanları bulundu ama mobil lokasyon listesinde eşleşen il/ilçe/mahalle bulunamadı.';
    await logSmartQueryResolveFailed(source, channel, {
      error,
      result,
      debug: locResult.debug,
    });
    return { ok: false, error, debug: locResult.debug };
  }

  const { city, town, quarter } = locResult.location;

  try {
    const payload = buildPayloadFromLocations(result, city, town, quarter, ada, parsel);
    const summary = buildSmartQuerySummary(result, city, town, quarter);
    await logSmartQueryResolveSuccess(source, channel, {
      summary,
      mahalleTkgmValue: payload.mahalleTkgmValue,
      quarterId: payload.quarterId,
      cityName: payload.city,
      townName: payload.town,
      quarterName: payload.mahalle,
    });
    return {
      ok: true,
      payload,
      summary,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Konum bilgisi işlenemedi.';
    await logSmartQueryResolveFailed(source, channel, { error: message, result });
    return { ok: false, error: message };
  }
}

export function findLocationsForSmartQueryPayload(payload: SmartQueryParcelPayload): {
  city?: City;
  town?: Town;
  quarter?: Quarter;
} {
  if (payload.cityId != null && payload.townId != null && payload.quarterId != null) {
    const found = findLocationByIds(payload.cityId, payload.townId, payload.quarterId);
    if (found) return found;
  }

  if (payload.quarterId != null) {
    const byQuarter = findQuarterByIdInLocations(payload.quarterId);
    if (byQuarter) return byQuarter;
  }

  const tkgmValue = Number(payload.mahalleTkgmValue);
  if (Number.isFinite(tkgmValue)) {
    for (const city of LOCATIONS.cities || []) {
      for (const town of city.Towns || []) {
        const quarter = (town.Quarters || [])
          .filter((item) => !item?.Inactive)
          .find((item) => Number(item.Tkgm_value) === tkgmValue);
        if (quarter) {
          return { city, town, quarter };
        }
      }
    }
  }

  return {};
}

export function smartQueryPayloadToFormSeed(payload: SmartQueryParcelPayload): SidebarSavedQuery {
  const now = new Date().toISOString();
  return {
    id: `smart-${Date.now()}`,
    mode: 'simple',
    il: payload.city || '',
    ilce: payload.town || '',
    mahalle: payload.mahalle || '',
    il_id: payload.cityId != null ? String(payload.cityId) : undefined,
    ilce_id: payload.townId != null ? String(payload.townId) : undefined,
    mahalle_id: payload.quarterId != null ? String(payload.quarterId) : undefined,
    mahalle_tkgm_value:
      Number.isFinite(payload.mahalleTkgmValue) ? String(payload.mahalleTkgmValue) : undefined,
    mahalle_proparcel_value:
      payload.proparcelValue != null ? String(payload.proparcelValue) : undefined,
    ada: payload.ada,
    parsel: payload.parsel,
    updatedAt: now,
  };
}

export type { SmartQueryExtractResult };
