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

function buildLocationIndexes(): void {
  if (quarterIdIndex && tkgmValueIndex) return;

  quarterIdIndex = new Map();
  tkgmValueIndex = new Map();

  for (const city of LOCATIONS.cities || []) {
    for (const town of city.Towns || []) {
      for (const quarter of town.Quarters || []) {
        if (quarter?.Inactive) continue;

        const loc: ResolvedSavedQueryLocation = {
          il: nonEmpty(city.Proparcel_text),
          ilce: nonEmpty(town.Proparcel_text),
          mahalle: nonEmpty(quarter.Proparcel_text || quarter.Tkgm_text),
        };

        const qId = Number(quarter.Id);
        if (Number.isFinite(qId) && qId > 0 && !quarterIdIndex.has(qId)) {
          quarterIdIndex.set(qId, { city, town, quarter });
        }

        const tkgm = Number(quarter.Tkgm_value);
        if (Number.isFinite(tkgm) && tkgm > 0 && !tkgmValueIndex.has(tkgm)) {
          tkgmValueIndex.set(tkgm, loc);
        }
      }
    }
  }
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

  if (q._fromApi && q.quarter_id != null && Number(q.quarter_id) > 0) {
    const found = findQuarterByIdInLocations(Number(q.quarter_id));
    if (found) {
      if (!il) il = nonEmpty(found.city.Proparcel_text);
      if (!ilce) ilce = nonEmpty(found.town.Proparcel_text);
      if (!mahalle) mahalle = nonEmpty(found.quarter.Proparcel_text || found.quarter.Tkgm_text);
    }
  }

  const tkgm = Number(q.tkgm_value);
  const pp =
    local?.proparcel_value ??
    ("proparcel_value" in q ? q.proparcel_value : null);

  if ((!il || !ilce || !mahalle) && Number.isFinite(tkgm) && tkgm > 0) {
    const fromTkgm = resolveLocationFromTkgmValue(tkgm, pp);
    if (fromTkgm) {
      if (!il) il = fromTkgm.il;
      if (!ilce) ilce = fromTkgm.ilce;
      if (!mahalle) mahalle = fromTkgm.mahalle;
    }
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
  const ilAd = nonEmpty(lh.ilAd) || resolved.il || null;
  const ilceAd = nonEmpty(lh.ilceAd) || resolved.ilce || null;
  const mahalleAd = nonEmpty(lh.mahalleAd) || resolved.mahalle || null;

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
