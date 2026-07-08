import locationsJson from "../data/locations.json";

type LocationHeader = {
  ilAd?: string | null;
  ilceAd?: string | null;
  mahalleAd?: string | null;
  adaNo?: string | null;
  parselNo?: string | null;
};

/** MyQueriesModal / savedQueries kayıtları — konum çözümlemesi girdisi */
export type SavedQueryLocationInput = {
  tkgm_value: number;
  ada: string;
  parsel: string;
  title?: string;
  quarter_id?: number | null;
  proparcel_value?: number | null;
  local?: {
    location_header?: LocationHeader;
    proparcel_value?: number | null;
    ada?: string;
    parsel?: string;
  } | null;
  _fromApi?: boolean;
};

type SavedQueryBackfillInput = {
  ada: string;
  parsel: string;
  location_header?: LocationHeader;
};

type Quarter = {
  Id: number;
  Tkgm_text?: string;
  Tkgm_value: number;
  Proparcel_text: string;
  Proparcel_value?: number | string;
  Inactive?: boolean;
};

type Town = {
  Id: number;
  Tkgm_value: number;
  Proparcel_text: string;
  Quarters: Quarter[];
};

type City = {
  Id: number;
  Tkgm_value: number;
  Proparcel_text: string;
  Towns: Town[];
};

const LOCATIONS = locationsJson as { cities: City[] };

type QuarterLocationNodes = { city: City; town: Town; quarter: Quarter };

let quarterIdIndex: Map<number, QuarterLocationNodes> | null = null;
let tkgmValueIndex: Map<number, ResolvedSavedQueryLocation> | null = null;
let tkgmQuarterIndex: Map<number, QuarterLocationNodes[]> | null = null;

function normalizeMahalleHint(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\b(mh\.?|mah\.?|mahallesi|mahalle|koy)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMahalleHint(target: string, quarter: Quarter): number {
  const mahalleTarget = normalizeMahalleHint(target.split('(')[0]?.trim() || target);
  if (mahalleTarget.length < 2) return 0;
  const tt = normalizeMahalleHint(String(quarter.Tkgm_text || ''));
  const pt = normalizeMahalleHint(String(quarter.Proparcel_text || ''));
  let score = 0;
  if (tt && (mahalleTarget === tt || mahalleTarget.includes(tt) || tt.includes(mahalleTarget))) score = 85;
  if (pt && (mahalleTarget === pt || mahalleTarget.includes(pt) || pt.includes(mahalleTarget))) {
    score = Math.max(score, 75);
  }
  return score;
}

function buildLocationIndexes(): void {
  if (quarterIdIndex && tkgmValueIndex && tkgmQuarterIndex) return;

  quarterIdIndex = new Map();
  tkgmValueIndex = new Map();
  tkgmQuarterIndex = new Map();

  for (const city of LOCATIONS.cities || []) {
    for (const town of city.Towns || []) {
      for (const quarter of town.Quarters || []) {
        if (quarter?.Inactive) continue;

        const loc: ResolvedSavedQueryLocation = {
          il: nonEmpty(city.Proparcel_text),
          ilce: nonEmpty(town.Proparcel_text),
          mahalle: nonEmpty(quarter.Proparcel_text || quarter.Tkgm_text),
        };

        const nodes: QuarterLocationNodes = { city, town, quarter };

        const qId = Number(quarter.Id);
        if (Number.isFinite(qId) && qId > 0 && !quarterIdIndex.has(qId)) {
          quarterIdIndex.set(qId, nodes);
        }

        const tkgm = Number(quarter.Tkgm_value);
        if (Number.isFinite(tkgm) && tkgm > 0) {
          if (!tkgmValueIndex.has(tkgm)) {
            tkgmValueIndex.set(tkgm, loc);
          }
          const list = tkgmQuarterIndex.get(tkgm) ?? [];
          list.push(nodes);
          tkgmQuarterIndex.set(tkgm, list);
        }
      }
    }
  }
}

export type ResolvedQuarterContext = {
  proparcelValue: number;
  townId: number;
  quarterId: number;
  il: string;
  ilce: string;
  mahalle: string;
};

/** TKGM mahalle kodu → proparcel_value + town_id (önbellekli indeks). */
export function resolveQuarterByTkgmValue(
  mahalleTkgm: number,
  hint?: { mahalleAd?: string | null; proparcelValue?: number | null },
): ResolvedQuarterContext | null {
  const tkgm = Number(mahalleTkgm);
  if (!Number.isFinite(tkgm) || tkgm <= 0) return null;

  buildLocationIndexes();
  const candidates = tkgmQuarterIndex?.get(tkgm) ?? [];
  if (candidates.length === 0) return null;

  const ppHint = hint?.proparcelValue != null ? Number(hint.proparcelValue) : NaN;
  if (Number.isFinite(ppHint) && ppHint > 0) {
    const byPp = candidates.find((n) => Number(n.quarter.Proparcel_value) === ppHint);
    if (byPp) {
      return toQuarterContext(byPp);
    }
  }

  if (candidates.length === 1) {
    return toQuarterContext(candidates[0]);
  }

  const mahalleAd = String(hint?.mahalleAd ?? '').trim();
  if (mahalleAd) {
    let best: { nodes: QuarterLocationNodes; score: number } | null = null;
    for (const nodes of candidates) {
      const score = scoreMahalleHint(mahalleAd, nodes.quarter);
      if (score > 0 && (!best || score > best.score)) {
        best = { nodes, score };
      }
    }
    if (best) return toQuarterContext(best.nodes);
  }

  return toQuarterContext(candidates[0]);
}

function toQuarterContext(nodes: QuarterLocationNodes): ResolvedQuarterContext | null {
  const pp = Number(nodes.quarter.Proparcel_value);
  const townId = Number(nodes.town.Id);
  const quarterId = Number(nodes.quarter.Id);
  if (!Number.isFinite(pp) || pp <= 0) return null;
  if (!Number.isFinite(townId) || townId <= 0) return null;
  return {
    proparcelValue: pp,
    townId,
    quarterId: Number.isFinite(quarterId) ? quarterId : 0,
    il: nonEmpty(nodes.city.Proparcel_text),
    ilce: nonEmpty(nodes.town.Proparcel_text),
    mahalle: nonEmpty(nodes.quarter.Proparcel_text || nodes.quarter.Tkgm_text),
  };
}

export function resolveQuarterContextById(quarterId: number): ResolvedQuarterContext | null {
  const nodes = findQuarterByIdInLocations(quarterId);
  if (!nodes) return null;
  return toQuarterContext(nodes);
}

function findQuarterByIdInLocations(quarterId: number): QuarterLocationNodes | null {
  buildLocationIndexes();
  return quarterIdIndex?.get(Number(quarterId)) ?? null;
}

export type ResolvedSavedQueryLocation = {
  il: string;
  ilce: string;
  mahalle: string;
};

function nonEmpty(v?: string | null): string {
  return String(v ?? "").trim();
}

/** location_header'da isim yerine DB id yazılmış mı (ör. "34", "1234") */
export function isLikelyLocationIdField(value?: string | null): boolean {
  const s = nonEmpty(value);
  if (!s) return false;
  if (!/^\d{1,6}$/.test(s)) return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}

function findCityById(cityId: number): City | undefined {
  return LOCATIONS.cities.find((c) => Number(c.Id) === cityId);
}

function findTownById(cityId: number, townId: number): Town | undefined {
  return findCityById(cityId)?.Towns.find((t) => Number(t.Id) === townId);
}

function resolveCityNameById(cityId: number): string {
  const city = findCityById(cityId);
  return city ? nonEmpty(city.Proparcel_text) : "";
}

function resolveTownNameById(cityId: number, townId: number): string {
  const town = findTownById(cityId, townId);
  return town ? nonEmpty(town.Proparcel_text) : "";
}

function pickResolvedLocationName(
  raw: string,
  resolved: string,
  idLookup?: () => string,
): string {
  if (raw && !isLikelyLocationIdField(raw)) return raw;
  if (idLookup) {
    const fromId = idLookup();
    if (fromId) return fromId;
  }
  return resolved || "";
}

export type LocationHeaderLike = {
  ilAd?: string | null;
  ilceAd?: string | null;
  mahalleAd?: string | null;
  adaNo?: string | null;
  parselNo?: string | null;
};

/** Pro sorgu API yanıtından Sorgularım location_header — id yerine il/ilçe adı */
export function buildLocationHeaderFromProQueryData(
  data: any,
  opts?: { ada?: string | null; parsel?: string | null },
): LocationHeaderLike {
  const pd = data?.parameters_data || {};
  const pv = pd?.parcel_values || {};
  const props = data?.properties || pd?.tkgm_data?.properties || {};

  const adaNo = opts?.ada ?? pv?.adaNo ?? pv?.ada ?? pd?.ada ?? null;
  const parselNo = opts?.parsel ?? pv?.parselNo ?? pv?.parsel ?? pd?.parsel ?? null;

  const tkgm = Number(
    props.mahalleId ?? props.tkgm_value ?? pv.mahalleId ?? pv.tkgm_value ?? pd.tkgm_value ?? 0,
  );
  const pp = Number(
    props.Proparcel_value ?? props.proparcel_value ?? pv.Proparcel_value ?? pv.proparcel_value ?? 0,
  );

  let ilAd = nonEmpty(props.ilAd ?? pv.ilAd);
  let ilceAd = nonEmpty(props.ilceAd ?? pv.ilceAd);
  let mahalleAd = nonEmpty(props.mahalleAd ?? pv.mahalleAd);

  const fromCatalog =
    Number.isFinite(tkgm) && tkgm > 0 ? resolveLocationFromTkgmValue(tkgm, pp) : null;
  if (fromCatalog) {
    ilAd = pickResolvedLocationName(ilAd, fromCatalog.il);
    ilceAd = pickResolvedLocationName(ilceAd, fromCatalog.ilce);
    mahalleAd = pickResolvedLocationName(mahalleAd, fromCatalog.mahalle);
  }

  const cityId = Number(
    pd.city_id ?? data.city_id ?? props.city_id ?? props.cityId ?? pv.city_id ?? pv.cityId ?? 0,
  );
  const townId = Number(
    pd.town_id ?? data.town_id ?? props.town_id ?? props.townId ?? pv.town_id ?? pv.townId ?? 0,
  );

  if ((!ilAd || isLikelyLocationIdField(ilAd)) && Number.isFinite(cityId) && cityId > 0) {
    const name = resolveCityNameById(cityId);
    if (name) ilAd = name;
  }
  if (
    (!ilceAd || isLikelyLocationIdField(ilceAd)) &&
    Number.isFinite(cityId) &&
    cityId > 0 &&
    Number.isFinite(townId) &&
    townId > 0
  ) {
    const name = resolveTownNameById(cityId, townId);
    if (name) ilceAd = name;
  }

  return {
    ilAd: ilAd || null,
    ilceAd: ilceAd || null,
    mahalleAd: mahalleAd || null,
    adaNo: adaNo != null ? String(adaNo) : null,
    parselNo: parselNo != null ? String(parselNo) : null,
  };
}

function normalizeHeaderField(v?: string | null): string {
  return nonEmpty(v);
}

/** location_header alan birleştirme — boş incoming mevcut değeri silmez */
export function mergeLocationHeader(
  existing?: LocationHeader,
  incoming?: LocationHeader,
): LocationHeader | undefined {
  if (!existing && !incoming) return undefined;
  const e = existing ?? {};
  const i = incoming ?? {};
  const merged: LocationHeader = {
    ilAd: normalizeHeaderField(i.ilAd) || e.ilAd || null,
    ilceAd: normalizeHeaderField(i.ilceAd) || e.ilceAd || null,
    mahalleAd: normalizeHeaderField(i.mahalleAd) || e.mahalleAd || null,
    adaNo: normalizeHeaderField(i.adaNo) || e.adaNo || null,
    parselNo: normalizeHeaderField(i.parselNo) || e.parselNo || null,
  };
  const hasAny = Object.values(merged).some((v) => v != null && normalizeHeaderField(v) !== "");
  return hasAny ? merged : undefined;
}

/** locations.json — mahalle TKGM kodundan il/ilçe/mahalle adları (önbellekli indeks) */
export function resolveLocationFromTkgmValue(
  tkgmValue: number,
  proparcelValue?: number | null,
): ResolvedSavedQueryLocation | null {
  const mahalleTkgm = Number(tkgmValue);
  if (!Number.isFinite(mahalleTkgm) || mahalleTkgm <= 0) return null;

  buildLocationIndexes();
  const fromTkgm = tkgmValueIndex?.get(mahalleTkgm);
  if (fromTkgm) return fromTkgm;

  const ppVal = proparcelValue != null ? Number(proparcelValue) : NaN;
  if (!Number.isFinite(ppVal) || ppVal <= 0) return null;

  for (const city of LOCATIONS.cities || []) {
    for (const town of city.Towns || []) {
      const quarter = (town.Quarters || [])
        .filter((q) => !q?.Inactive)
        .find((q) => Number(q.Proparcel_value) === ppVal);
      if (quarter) {
        return {
          il: nonEmpty(city.Proparcel_text),
          ilce: nonEmpty(town.Proparcel_text),
          mahalle: nonEmpty(quarter.Proparcel_text || quarter.Tkgm_text),
        };
      }
    }
  }

  return null;
}

export function parseMahalleFromApiTitle(title: string): string {
  const t = String(title ?? "").trim();
  if (!t) return "";
  if (t.includes(" - ")) return t.split(" - ")[0]?.trim() || "";
  return t;
}

function pickLocal(q: SavedQueryLocationInput): SavedQueryLocationInput["local"] {
  if (q._fromApi) return q.local ?? null;
  return {
    location_header: (q as { location_header?: LocationHeader }).location_header,
    proparcel_value: q.proparcel_value ?? null,
    ada: q.ada,
    parsel: q.parsel,
  };
}

/** Sorgularım kartı — il/ilçe/mahalle çözümleme zinciri */
export function resolveLocationForSavedQueryItem(q: SavedQueryLocationInput): ResolvedSavedQueryLocation {
  const local = pickLocal(q);
  const lh = local?.location_header;

  let il = nonEmpty(lh?.ilAd);
  let ilce = nonEmpty(lh?.ilceAd);
  let mahalle = nonEmpty(lh?.mahalleAd);

  let catalogResolved: ResolvedSavedQueryLocation | null = null;

  if (q._fromApi && q.quarter_id != null && Number(q.quarter_id) > 0) {
    const found = findQuarterByIdInLocations(Number(q.quarter_id));
    if (found) {
      catalogResolved = {
        il: nonEmpty(found.city.Proparcel_text),
        ilce: nonEmpty(found.town.Proparcel_text),
        mahalle: nonEmpty(found.quarter.Proparcel_text || found.quarter.Tkgm_text),
      };
    }
  }

  const tkgm = Number(q.tkgm_value);
  const pp =
    local?.proparcel_value ??
    ("proparcel_value" in q ? q.proparcel_value : null);

  if (!catalogResolved && Number.isFinite(tkgm) && tkgm > 0) {
    catalogResolved = resolveLocationFromTkgmValue(tkgm, pp);
  }

  if (catalogResolved) {
    il = pickResolvedLocationName(il, catalogResolved.il);
    ilce = pickResolvedLocationName(ilce, catalogResolved.ilce);
    mahalle = pickResolvedLocationName(mahalle, catalogResolved.mahalle);
  }

  const rawCityId = isLikelyLocationIdField(il) ? Number(il) : NaN;
  if (isLikelyLocationIdField(il)) {
    il = pickResolvedLocationName(il, "", () => resolveCityNameById(Number(il)));
  }
  if (isLikelyLocationIdField(ilce)) {
    const cityIdForTown =
      Number.isFinite(rawCityId) && rawCityId > 0
        ? rawCityId
        : isLikelyLocationIdField(lh?.ilAd)
          ? Number(lh?.ilAd)
          : NaN;
    ilce = pickResolvedLocationName(
      ilce,
      catalogResolved?.ilce || "",
      () =>
        Number.isFinite(cityIdForTown) && cityIdForTown > 0
          ? resolveTownNameById(cityIdForTown, Number(ilce))
          : "",
    );
  }

  const apiTitle = q.title ? String(q.title).trim() : "";
  if (!mahalle && apiTitle) {
    mahalle = parseMahalleFromApiTitle(apiTitle);
  }

  return { il, ilce, mahalle };
}

/** Yerel kayıt backfill — eksik location_header alanlarını doldur */
export function buildBackfilledLocationHeader(
  sq: SavedQueryBackfillInput,
  resolved: ResolvedSavedQueryLocation,
): LocationHeader | null {
  const lh = sq.location_header ?? {};
  const pickName = (raw: string | null | undefined, resolvedName: string) => {
    const rawNorm = nonEmpty(raw);
    if (rawNorm && !isLikelyLocationIdField(rawNorm)) return rawNorm;
    return nonEmpty(resolvedName) || null;
  };
  const ilAd = pickName(lh.ilAd, resolved.il);
  const ilceAd = pickName(lh.ilceAd, resolved.ilce);
  const mahalleAd = pickName(lh.mahalleAd, resolved.mahalle);

  const changed =
    ilAd !== (lh.ilAd ?? null) ||
    ilceAd !== (lh.ilceAd ?? null) ||
    mahalleAd !== (lh.mahalleAd ?? null);

  if (!changed) return null;

  return {
    ilAd,
    ilceAd,
    mahalleAd,
    adaNo: lh.adaNo ?? sq.ada ?? null,
    parselNo: lh.parselNo ?? sq.parsel ?? null,
  };
}
