import locationsJson from '../data/locations.json';
import {
  fetchGeoCities,
  fetchGeoQuartersByTown,
  fetchGeoTownsByCity,
} from '../../services/portalService';

export type LocationQuarter = {
  Id: number;
  Tkgm_text?: string;
  Tkgm_value: number;
  Proparcel_text: string;
  Proparcel_value?: number | string;
  Inactive?: boolean;
};

export type LocationTown = {
  Id: number;
  Tkgm_value?: number;
  Proparcel_text: string;
  Quarters: LocationQuarter[];
};

export type LocationCity = {
  Id: number;
  Tkgm_value?: number;
  Proparcel_text: string;
  Towns: LocationTown[];
};

type LocationsResponse = {
  cities: LocationCity[];
};

const LOCATIONS = locationsJson as unknown as LocationsResponse;

/** locations.json — yalnızca Id ile eşleştir (isim araması yok). */
export function findLocationByIds(
  cityId: number,
  townId: number,
  quarterId: number,
): { city: LocationCity; town: LocationTown; quarter: LocationQuarter } | null {
  const city = (LOCATIONS.cities || []).find((c) => Number(c.Id) === Number(cityId));
  if (!city) return null;

  const town = (city.Towns || []).find((t) => Number(t.Id) === Number(townId));
  if (!town) return null;

  const quarter = (town.Quarters || [])
    .filter((q) => !q?.Inactive)
    .find((q) => Number(q.Id) === Number(quarterId));
  if (!quarter) return null;

  return { city, town, quarter };
}

/** quarter_id tek başına — JSON içinde global arama. */
export function findQuarterByIdInLocations(
  quarterId: number,
): { city: LocationCity; town: LocationTown; quarter: LocationQuarter } | null {
  for (const city of LOCATIONS.cities || []) {
    for (const town of city.Towns || []) {
      const quarter = (town.Quarters || [])
        .filter((q) => !q?.Inactive)
        .find((q) => Number(q.Id) === Number(quarterId));
      if (quarter) {
        return { city, town, quarter };
      }
    }
  }
  return null;
}

/** JSON'da yoksa /api/cities|towns|quarters ile Id eşleştir. */
export async function findLocationByIdsOnline(
  cityId: number,
  townId: number,
  quarterId: number,
): Promise<{ city: LocationCity; town: LocationTown; quarter: LocationQuarter } | null> {
  const citiesRes = await fetchGeoCities();
  if (!citiesRes.ok || !Array.isArray(citiesRes.data)) return null;

  const cityRow = citiesRes.data.find((c) => Number(c.Id) === Number(cityId));
  if (!cityRow) return null;

  const townsRes = await fetchGeoTownsByCity(cityId);
  if (!townsRes.ok || !Array.isArray(townsRes.data)) return null;

  const townRow = townsRes.data.find((t) => Number(t.Id) === Number(townId));
  if (!townRow) return null;

  const quartersRes = await fetchGeoQuartersByTown(townId);
  if (!quartersRes.ok || !Array.isArray(quartersRes.data)) return null;

  const quarterRow = quartersRes.data.find(
    (q) => Number(q.Id ?? q.id) === Number(quarterId),
  );
  if (!quarterRow) return null;

  const tkgmValue = Number((quarterRow as { Tkgm_value?: number }).Tkgm_value);
  if (!Number.isFinite(tkgmValue)) return null;

  const quarter: LocationQuarter = {
    Id: Number(quarterId),
    Tkgm_text: quarterRow.Tkgm_text,
    Tkgm_value: tkgmValue,
    Proparcel_text:
      quarterRow.Proparcel_text ||
      quarterRow.Tkgm_text ||
      String(quarterId),
    Proparcel_value: (quarterRow as { Proparcel_value?: number }).Proparcel_value,
    Inactive: false,
  };

  const town: LocationTown = {
    Id: Number(townId),
    Proparcel_text: townRow.Proparcel_text || String(townId),
    Quarters: [quarter],
  };

  const city: LocationCity = {
    Id: Number(cityId),
    Proparcel_text: cityRow.Proparcel_text || String(cityId),
    Towns: [town],
  };

  return { city, town, quarter };
}
