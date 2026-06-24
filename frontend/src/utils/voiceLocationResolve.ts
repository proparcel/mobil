import locationsJson from '../data/locations.json';
import {
  findLocationByIds,
  findLocationByIdsOnline,
  findQuarterByIdInLocations,
  type LocationCity,
  type LocationQuarter,
  type LocationTown,
} from './locationLookup';

type LocationsResponse = {
  cities: LocationCity[];
};

const LOCATIONS = locationsJson as unknown as LocationsResponse;

export type VoiceLocationExtractInput = {
  il?: string;
  ilce?: string;
  mahalle?: string;
  city_id?: number | null;
  town_id?: number | null;
  quarter_id?: number | null;
  tkgm_value?: number | null;
  proparcel_value?: number | null;
  /** Whisper transkripti — API mahalle/ID yanlışsa doğrulama için. */
  transcript?: string;
};

export type ResolvedVoiceLocationNodes = {
  city: LocationCity;
  town: LocationTown;
  quarter: LocationQuarter;
};

export type ResolvedVoiceLocation = ResolvedVoiceLocationNodes & {
  cityId: number;
  townId: number;
  quarterId: number;
  cityName: string;
  townName: string;
  quarterName: string;
  tkgmValue: number | null;
  proparcelValue: number | null;
};

export const VOICE_LOCATION_ID_MISMATCH_ERROR =
  'Konum ID eşleşmedi (city_id/town_id/quarter_id). Uygulamadaki locations.json güncel olmayabilir; internet bağlantısıyla tekrar deneyin.';

export const VOICE_LOCATION_NAME_MISMATCH_ERROR =
  'Konum bilgisi eşleştirilemedi. İl, ilçe ve mahalle bilgilerinizi tekrar söyleyin.';

export const VOICE_LOCATION_SPEECH_MISMATCH_ERROR =
  'Söylediğiniz mahalle ile eşleşen kayıt bulunamadı. Lütfen il, ilçe ve mahalle bilgisini tekrar söyleyin.';

export type VoiceLocationResolvePhase = 'id_mismatch' | 'speech_mismatch' | 'name_mismatch';

export type VoiceLocationResolveDebug = {
  phase: VoiceLocationResolvePhase;
  minScoreThreshold: number;
  spokenMahalleQuery: string;
  apiMahalle: string;
  city_id: number | null;
  town_id: number | null;
  quarter_id: number | null;
  il: string;
  ilce: string;
  transcriptPreview: string;
  resolvedQuarter?: {
    id: number;
    name: string;
    score: number;
  };
  bestQuarterInTown?: {
    id: number;
    name: string;
    score: number;
  };
  cityFound: boolean;
  townFound: boolean;
};

const SKIP_MAHALLE_TOKENS = new Set([
  'mahallesi',
  'mahalle',
  'mh',
  'koyu',
  'koy',
  'ilcesi',
  'ilce',
  'nin',
  'nın',
  'nun',
  'nün',
  'da',
  'de',
  'den',
  'dan',
  've',
  'ile',
]);

const QUARTER_MATCH_MIN_SCORE = 0.85;

export function normalizeTr(value: string): string {
  return String(value ?? '')
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
}

/** Yalnızca API id göndermediğinde — isim fallback. */
export function matchesLocationName(candidate: string, target?: string): boolean {
  const left = normalizeTr(candidate);
  const right = normalizeTr(target || '');
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** Mahalle için sıkı skor — gevşek includes yerine tam/kelime eşleşmesi. */
export function scoreQuarterNameMatch(candidate: string, query: string): number {
  const left = normalizeTr(candidate);
  const right = normalizeTr(query);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftCompact = left.replace(/\s/g, '');
  const rightCompact = right.replace(/\s/g, '');
  if (leftCompact === rightCompact) return 0.98;
  const words = left.split(' ').filter(Boolean);
  if (words.includes(right)) return 0.92;
  if (right.length >= 4 && (left.startsWith(`${right} `) || right.startsWith(`${left} `))) {
    return 0.88;
  }
  return 0;
}

function quarterRowScore(quarter: LocationQuarter, query: string): number {
  return Math.max(
    scoreQuarterNameMatch(quarter.Proparcel_text || '', query),
    scoreQuarterNameMatch(quarter.Tkgm_text || '', query),
  );
}

function activeQuarters(town: LocationTown): LocationQuarter[] {
  return (town.Quarters || []).filter((item) => !item?.Inactive);
}

export function extractMahalleCandidateFromTranscript(
  transcript: string,
  cityName?: string,
  townName?: string,
): string {
  let text = String(transcript || '').trim();
  if (!text) return '';

  text = text.split(/\bada\b|\bparsel\b/i)[0] || text;
  text = text.replace(/[-–—/\\]+/g, ' ');
  text = text.replace(/[,;]+/g, ' ');

  const tokens = text.split(/\s+/).filter(Boolean);
  const cityNorm = normalizeTr(cityName || '');
  const townNorm = normalizeTr(townName || '');
  const cityCompact = cityNorm.replace(/\s/g, '');
  const townCompact = townNorm.replace(/\s/g, '');

  const kept: string[] = [];
  for (const raw of tokens) {
    const norm = normalizeTr(raw);
    if (!norm || /^\d+$/.test(norm) || SKIP_MAHALLE_TOKENS.has(norm)) continue;
    if (norm === cityNorm || norm === townNorm) continue;
    if (cityCompact && norm === cityCompact) continue;
    if (townCompact && norm === townCompact) continue;
    kept.push(raw.trim());
  }

  return kept
    .join(' ')
    .replace(/\s*(mh\.?|mah\.?|mahallesi)\s*$/i, '')
    .trim();
}

function findTopQuarterInTown(
  town: LocationTown,
  query: string,
): { quarter: LocationQuarter; score: number } | null {
  const normalizedQuery = normalizeTr(query);
  if (!normalizedQuery) return null;

  let best: { quarter: LocationQuarter; score: number } | null = null;
  for (const quarter of activeQuarters(town)) {
    const score = quarterRowScore(quarter, normalizedQuery);
    if (!best || score > best.score) {
      best = { quarter, score };
    }
  }
  return best;
}

function findBestQuarterInTown(
  town: LocationTown,
  query: string,
): { quarter: LocationQuarter; score: number } | null {
  const best = findTopQuarterInTown(town, query);
  return best && best.score >= QUARTER_MATCH_MIN_SCORE ? best : null;
}

function quarterDebugEntry(
  quarter: LocationQuarter,
  score: number,
): { id: number; name: string; score: number } {
  return {
    id: quarter.Id,
    name: quarter.Proparcel_text || quarter.Tkgm_text || '',
    score: Math.round(score * 1000) / 1000,
  };
}

function buildVoiceLocationResolveDebug(
  input: VoiceLocationExtractInput,
  phase: VoiceLocationResolvePhase,
  located: ResolvedVoiceLocationNodes | null,
): VoiceLocationResolveDebug {
  const cities = LOCATIONS.cities || [];
  const cityFromId =
    input.city_id != null
      ? cities.find((item) => Number(item.Id) === Number(input.city_id))
      : undefined;
  const cityFromName =
    input.il != null
      ? cities.find((item) => matchesLocationName(item.Proparcel_text, input.il))
      : undefined;

  let town: LocationTown | undefined;
  const city = cityFromId || cityFromName;
  if (city) {
    if (input.town_id != null) {
      town = city.Towns.find((item) => Number(item.Id) === Number(input.town_id));
    }
    if (!town && input.ilce) {
      town = city.Towns.find((item) => matchesLocationName(item.Proparcel_text, input.ilce));
    }
  }

  if (!town && (input.town_id != null || input.ilce)) {
    for (const cityItem of cities) {
      const candidateTown =
        input.town_id != null
          ? cityItem.Towns.find((item) => Number(item.Id) === Number(input.town_id))
          : cityItem.Towns.find((item) => matchesLocationName(item.Proparcel_text, input.ilce));
      if (candidateTown) {
        town = candidateTown;
        break;
      }
    }
  }

  const spokenQuery = spokenMahalleQuery(
    input,
    located?.city.Proparcel_text || city?.Proparcel_text,
    located?.town.Proparcel_text || town?.Proparcel_text,
  );

  const debug: VoiceLocationResolveDebug = {
    phase,
    minScoreThreshold: QUARTER_MATCH_MIN_SCORE,
    spokenMahalleQuery: spokenQuery,
    apiMahalle: String(input.mahalle || '').trim(),
    city_id: input.city_id ?? null,
    town_id: input.town_id ?? null,
    quarter_id: input.quarter_id ?? null,
    il: String(input.il || '').trim(),
    ilce: String(input.ilce || '').trim(),
    transcriptPreview: String(input.transcript || '').slice(0, 280),
    cityFound: Boolean(located?.city || city),
    townFound: Boolean(located?.town || town),
  };

  const townForScoring = located?.town || town;
  if (townForScoring && spokenQuery) {
    const top = findTopQuarterInTown(townForScoring, spokenQuery);
    if (top) {
      debug.bestQuarterInTown = quarterDebugEntry(top.quarter, top.score);
    }
  }

  if (located?.quarter && spokenQuery) {
    debug.resolvedQuarter = quarterDebugEntry(
      located.quarter,
      quarterRowScore(located.quarter, spokenQuery),
    );
  }

  return debug;
}

function spokenMahalleQuery(
  input: VoiceLocationExtractInput,
  cityName?: string,
  townName?: string,
): string {
  const fromTranscript = extractMahalleCandidateFromTranscript(
    input.transcript || '',
    cityName || input.il,
    townName || input.ilce,
  );
  if (fromTranscript) return fromTranscript;
  return String(input.mahalle || '').trim();
}

function reconcileQuarterWithSpeech(
  located: ResolvedVoiceLocationNodes,
  input: VoiceLocationExtractInput,
): ResolvedVoiceLocationNodes | null {
  const spokenQuery = spokenMahalleQuery(
    input,
    located.city.Proparcel_text,
    located.town.Proparcel_text,
  );
  if (!spokenQuery) return located;

  const best = findBestQuarterInTown(located.town, spokenQuery);
  if (!best) {
    const resolvedScore = quarterRowScore(located.quarter, spokenQuery);
    return resolvedScore >= QUARTER_MATCH_MIN_SCORE ? located : null;
  }

  const resolvedScore = quarterRowScore(located.quarter, spokenQuery);
  if (
    best.quarter.Id !== located.quarter.Id &&
    best.score >= QUARTER_MATCH_MIN_SCORE &&
    best.score > resolvedScore + 0.05
  ) {
    return { ...located, quarter: best.quarter };
  }

  if (resolvedScore < QUARTER_MATCH_MIN_SCORE && best.score >= QUARTER_MATCH_MIN_SCORE) {
    return { ...located, quarter: best.quarter };
  }

  return located;
}

function resolveByNameFallback(
  input: VoiceLocationExtractInput,
): ResolvedVoiceLocationNodes | null {
  const cities = LOCATIONS.cities || [];

  let city: LocationCity | undefined =
    input.city_id != null
      ? cities.find((item) => Number(item.Id) === Number(input.city_id))
      : undefined;

  if (!city && input.il) {
    city = cities.find((item) => matchesLocationName(item.Proparcel_text, input.il));
  }

  let town: LocationTown | undefined =
    city && input.town_id != null
      ? city.Towns.find((item) => Number(item.Id) === Number(input.town_id))
      : undefined;

  if (!town && city && input.ilce) {
    town = city.Towns.find((item) => matchesLocationName(item.Proparcel_text, input.ilce));
  }

  if ((!city || !town) && (input.town_id != null || input.ilce)) {
    for (const cityItem of cities) {
      const candidateTown =
        input.town_id != null
          ? cityItem.Towns.find((item) => Number(item.Id) === Number(input.town_id))
          : cityItem.Towns.find((item) => matchesLocationName(item.Proparcel_text, input.ilce));

      if (candidateTown) {
        city = cityItem;
        town = candidateTown;
        break;
      }
    }
  }

  if (!town || !city) return null;

  let quarter: LocationQuarter | undefined =
    input.quarter_id != null
      ? (town.Quarters || [])
          .filter((item) => !item?.Inactive)
          .find((item) => Number(item.Id) === Number(input.quarter_id))
      : undefined;

  if (!quarter) {
    const spokenQuery = spokenMahalleQuery(input, city.Proparcel_text, town.Proparcel_text);
    if (spokenQuery) {
      quarter = findBestQuarterInTown(town, spokenQuery)?.quarter;
    }
  }

  if (!quarter && input.mahalle) {
    quarter = findBestQuarterInTown(town, input.mahalle)?.quarter;
  }

  if (!quarter) return null;
  return { city, town, quarter };
}

/** İl/ilçe çözümleme — mahalle zorunlu değil (kısmi sesli sorgu). */
export function resolveVoiceCityTownFromExtract(
  input: VoiceLocationExtractInput,
): { city: LocationCity; town: LocationTown; cityName: string; townName: string } | null {
  const cities = LOCATIONS.cities || [];

  let city: LocationCity | undefined =
    input.city_id != null
      ? cities.find((item) => Number(item.Id) === Number(input.city_id))
      : undefined;

  if (!city && input.il) {
    city = cities.find((item) => matchesLocationName(item.Proparcel_text, input.il));
  }

  let town: LocationTown | undefined =
    city && input.town_id != null
      ? city.Towns.find((item) => Number(item.Id) === Number(input.town_id))
      : undefined;

  if (!town && city && input.ilce) {
    town = city.Towns.find((item) => matchesLocationName(item.Proparcel_text, input.ilce));
  }

  if ((!city || !town) && (input.town_id != null || input.ilce)) {
    for (const cityItem of cities) {
      const candidateTown =
        input.town_id != null
          ? cityItem.Towns.find((item) => Number(item.Id) === Number(input.town_id))
          : cityItem.Towns.find((item) => matchesLocationName(item.Proparcel_text, input.ilce));

      if (candidateTown) {
        city = cityItem;
        town = candidateTown;
        break;
      }
    }
  }

  if (!city || !town) return null;

  return {
    city,
    town,
    cityName: city.Proparcel_text || String(input.il || '').trim(),
    townName: town.Proparcel_text || String(input.ilce || '').trim(),
  };
}

/**
 * quarter_id varsa önce ID tabanlı eşleştirme (locations.json + online),
 * yoksa isim fallback.
 */
async function resolveByIds(
  input: VoiceLocationExtractInput,
): Promise<ResolvedVoiceLocationNodes | null> {
  const cityId = Number(input.city_id);
  const townId = Number(input.town_id);
  const quarterId = Number(input.quarter_id);

  if (!Number.isFinite(quarterId)) return null;

  if (Number.isFinite(cityId) && Number.isFinite(townId)) {
    const local = findLocationByIds(cityId, townId, quarterId);
    if (local) return local;

    const byQuarter = findQuarterByIdInLocations(quarterId);
    if (byQuarter) return byQuarter;

    const online = await findLocationByIdsOnline(cityId, townId, quarterId);
    if (online) return online;

    return null;
  }

  return findQuarterByIdInLocations(quarterId);
}

function buildResolvedVoiceLocation(
  located: ResolvedVoiceLocationNodes,
  input: VoiceLocationExtractInput,
): ResolvedVoiceLocation {
  const apiTkgm = Number(input.tkgm_value);
  const quarterTkgm = Number(located.quarter.Tkgm_value);
  const apiPp = Number(input.proparcel_value);
  const quarterPp = Number(located.quarter.Proparcel_value);

  const tkgmValue = Number.isFinite(quarterTkgm)
    ? quarterTkgm
    : Number.isFinite(apiTkgm)
      ? apiTkgm
      : null;

  const proparcelValue = Number.isFinite(quarterPp)
    ? quarterPp
    : Number.isFinite(apiPp)
      ? apiPp
      : null;

  if (
    Number.isFinite(apiTkgm) &&
    Number.isFinite(quarterTkgm) &&
    apiTkgm !== quarterTkgm
  ) {
    console.warn('[VoiceLocation] tkgm_value uyuşmazlığı', {
      api: apiTkgm,
      locations: quarterTkgm,
      quarter_id: located.quarter.Id,
    });
  }

  return {
    ...located,
    cityId: located.city.Id,
    townId: located.town.Id,
    quarterId: located.quarter.Id,
    cityName: located.city.Proparcel_text || String(input.il || '').trim(),
    townName: located.town.Proparcel_text || String(input.ilce || '').trim(),
    quarterName:
      located.quarter.Proparcel_text ||
      located.quarter.Tkgm_text ||
      String(input.mahalle || '').trim(),
    tkgmValue,
    proparcelValue,
  };
}

/**
 * Sesli sorgu ve sesli üyelik için ortak il/ilçe/mahalle çözümleme.
 * Ada/parsel bu katmanda yok — akıllı sorgu üst katmanda ekler.
 */
export type VoiceLocationResolveResult =
  | { ok: true; location: ResolvedVoiceLocation }
  | { ok: false; error: string; debug: VoiceLocationResolveDebug };

export async function resolveVoiceLocationFromExtract(
  input: VoiceLocationExtractInput,
): Promise<VoiceLocationResolveResult> {
  const quarterId = Number(input.quarter_id);
  const hasQuarterId = input.quarter_id != null && Number.isFinite(quarterId);

  let located: ResolvedVoiceLocationNodes | null = null;

  if (hasQuarterId) {
    located = await resolveByIds(input);
    if (!located) {
      return {
        ok: false,
        error: VOICE_LOCATION_ID_MISMATCH_ERROR,
        debug: buildVoiceLocationResolveDebug(input, 'id_mismatch', null),
      };
    }
    const beforeReconcile = located;
    located = reconcileQuarterWithSpeech(located, input);
    if (!located) {
      return {
        ok: false,
        error: VOICE_LOCATION_SPEECH_MISMATCH_ERROR,
        debug: buildVoiceLocationResolveDebug(input, 'speech_mismatch', beforeReconcile),
      };
    }
  } else {
    located = resolveByNameFallback(input);
    if (!located) {
      return {
        ok: false,
        error: VOICE_LOCATION_NAME_MISMATCH_ERROR,
        debug: buildVoiceLocationResolveDebug(input, 'name_mismatch', null),
      };
    }
  }

  return { ok: true, location: buildResolvedVoiceLocation(located, input) };
}

/**
 * SPK uzmanlık ili — tam konum yoksa yalnızca il adı/ID ile eşleştirme.
 */
export async function resolveVoiceCityFromExtract(
  input: VoiceLocationExtractInput,
): Promise<{ ok: true; cityId: number; cityName: string } | { ok: false; error: string }> {
  const full = await resolveVoiceLocationFromExtract(input);
  if (full.ok) {
    return {
      ok: true,
      cityId: full.location.cityId,
      cityName: full.location.cityName,
    };
  }

  const cities = LOCATIONS.cities || [];
  let city: LocationCity | undefined =
    input.city_id != null
      ? cities.find((item) => Number(item.Id) === Number(input.city_id))
      : undefined;

  if (!city && input.il) {
    city = cities.find((item) => matchesLocationName(item.Proparcel_text, input.il));
  }

  if (!city) {
    return { ok: false, error: "İl eşleştirilemedi. Lütfen tekrar söyleyin." };
  }

  return {
    ok: true,
    cityId: city.Id,
    cityName: city.Proparcel_text || String(input.il || "").trim(),
  };
}

export function buildVoiceLocationSummary(
  input: VoiceLocationExtractInput,
  location: ResolvedVoiceLocation,
): string {
  return [
    location.cityName || input.il || '',
    location.townName || input.ilce || '',
    location.quarterName || input.mahalle || '',
  ]
    .filter(Boolean)
    .join(' / ');
}
