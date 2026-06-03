import locationsJson from '../data/locations.json';

import type { SmartQueryExtractResult } from '../types/smartQuery';

import type { SidebarSavedQuery } from './sidebarSavedQueries';

import {

  findLocationByIds,

  findLocationByIdsOnline,

  findQuarterByIdInLocations,

  type LocationCity,

  type LocationQuarter,

  type LocationTown,

} from './locationLookup';



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



const normalizeTr = (value: string): string =>

  String(value ?? '')

    .toLowerCase()

    .normalize('NFKD')

    .replace(/[\u0300-\u036f]/g, '')

    .replace(/ı/g, 'i')

    .replace(/\bmahallesi\b/g, '')

    .replace(/\bmahalle\b/g, '')

    .replace(/\bkoyu\b/g, '')

    .replace(/\bkoy\b/g, '')

    .replace(/\s+/g, ' ')

    .trim();



/** Yalnızca API id göndermediğinde — isim fallback. */

const matchesLocationName = (candidate: string, target?: string): boolean => {

  const left = normalizeTr(candidate);

  const right = normalizeTr(target || '');

  if (!left || !right) return false;

  return left === right || left.includes(right) || right.includes(left);

};



export const buildSmartQuerySummary = (

  result: SmartQueryExtractResult,

  city?: City,

  town?: Town,

  quarter?: Quarter

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



function buildPayloadFromLocations(

  result: SmartQueryExtractResult,

  city: City,

  town: Town,

  quarter: Quarter,

  ada: string,

  parsel: string

): SmartQueryParcelPayload {

  const apiTkgm = Number(result.tkgm_value);

  const quarterTkgm = Number(quarter.Tkgm_value);

  const mahalleTkgmValue = Number.isFinite(quarterTkgm)

    ? quarterTkgm

    : Number.isFinite(apiTkgm)

      ? apiTkgm

      : NaN;



  if (!Number.isFinite(mahalleTkgmValue)) {

    throw new Error('Mahalle TKGM kodu bulunamadı.');

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



async function resolveByIdsStrict(

  result: SmartQueryExtractResult,

  ada: string,

  parsel: string

): Promise<{ city: City; town: Town; quarter: Quarter } | null> {

  const cityId = Number(result.city_id);

  const townId = Number(result.town_id);

  const quarterId = Number(result.quarter_id);



  if (!Number.isFinite(quarterId)) return null;



  if (Number.isFinite(cityId) && Number.isFinite(townId)) {

    const local = findLocationByIds(cityId, townId, quarterId);

    if (local) return local;

    const online = await findLocationByIdsOnline(cityId, townId, quarterId);

    if (online) return online;

    return null;

  }



  return findQuarterByIdInLocations(quarterId);

}



/** API id yoksa — eski isim eşleştirme (fallback). */

function resolveByNameFallback(

  result: SmartQueryExtractResult

): { city: City; town: Town; quarter: Quarter } | null {

  const cities = LOCATIONS.cities || [];



  let city: City | undefined = result.city_id != null

    ? cities.find((item) => Number(item.Id) === Number(result.city_id))

    : undefined;



  if (!city && result.il) {

    city = cities.find((item) => matchesLocationName(item.Proparcel_text, result.il));

  }



  let town: Town | undefined =

    city && result.town_id != null

      ? city.Towns.find((item) => Number(item.Id) === Number(result.town_id))

      : undefined;



  if (!town && city && result.ilce) {

    town = city.Towns.find((item) => matchesLocationName(item.Proparcel_text, result.ilce));

  }



  if ((!city || !town) && (result.town_id != null || result.ilce)) {

    for (const cityItem of cities) {

      const candidateTown =

        result.town_id != null

          ? cityItem.Towns.find((item) => Number(item.Id) === Number(result.town_id))

          : cityItem.Towns.find((item) => matchesLocationName(item.Proparcel_text, result.ilce));

      if (candidateTown) {

        city = cityItem;

        town = candidateTown;

        break;

      }

    }

  }



  if (!town || !city) return null;



  let quarter: Quarter | undefined =

    result.quarter_id != null

      ? (town.Quarters || [])

          .filter((item) => !item?.Inactive)

          .find((item) => Number(item.Id) === Number(result.quarter_id))

      : undefined;



  if (!quarter && result.mahalle) {

    quarter = (town.Quarters || [])

      .filter((item) => !item?.Inactive)

      .find(

        (item) =>

          matchesLocationName(item.Tkgm_text || item.Proparcel_text, result.mahalle) ||

          matchesLocationName(item.Proparcel_text, result.mahalle)

      );

  }



  if (!quarter) return null;

  return { city, town, quarter };

}



/**

 * Akıllı sorgu API yanıtını forma aktarılabilir payload'a çevirir.

 * quarter_id varsa yalnızca Id ile eşleştirir — isim fuzzy araması yapılmaz.

 */

export async function resolveSmartQueryPayload(

  result: SmartQueryExtractResult

): Promise<

  { ok: true; payload: SmartQueryParcelPayload; summary: string } | { ok: false; error: string }

> {

  const ada = normalizeParcelDigits(String(result.ada_no || ''));

  const parsel = normalizeParcelDigits(String(result.parsel_no || ''));



  if (!ada || !parsel) {

    return { ok: false, error: 'Metinden ada ve parsel bilgisi çıkarılamadı.' };

  }



  const hasQuarterId = result.quarter_id != null && Number.isFinite(Number(result.quarter_id));



  let located: { city: City; town: Town; quarter: Quarter } | null = null;



  if (hasQuarterId) {

    located = await resolveByIdsStrict(result, ada, parsel);

    if (!located) {

      return {

        ok: false,

        error:

          'Konum ID eşleşmedi (city_id/town_id/quarter_id). Uygulamadaki locations.json güncel olmayabilir; internet bağlantısıyla tekrar deneyin.',

      };

    }

  } else {

    located = resolveByNameFallback(result);

    if (!located) {

      return {

        ok: false,

        error:

          'Akıllı sorgu alanları bulundu ama mobil lokasyon listesinde eşleşen il/ilçe/mahalle bulunamadı.',

      };

    }

  }



  try {

    const payload = buildPayloadFromLocations(

      result,

      located.city,

      located.town,

      located.quarter,

      ada,

      parsel

    );

    return {

      ok: true,

      payload,

      summary: buildSmartQuerySummary(result, located.city, located.town, located.quarter),

    };

  } catch (error: any) {

    return { ok: false, error: error?.message || 'Konum bilgisi işlenemedi.' };

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

    mahalle_tkgm_value: String(payload.mahalleTkgmValue),

    mahalle_proparcel_value:

      payload.proparcelValue != null ? String(payload.proparcelValue) : undefined,

    ada: payload.ada,

    parsel: payload.parsel,

    updatedAt: now,

  };

}



export type { SmartQueryExtractResult };


