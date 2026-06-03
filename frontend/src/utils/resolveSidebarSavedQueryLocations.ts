import locationsJson from "../data/locations.json";
import type { SidebarSavedQuery } from "./sidebarSavedQueries";

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

const normalizeTr = (value: string): string =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\bmahallesi\b/g, "")
    .replace(/\bmahalle\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const matchesName = (candidate: string, target?: string): boolean => {
  const left = normalizeTr(candidate);
  const right = normalizeTr(target || "");
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

export type ResolvedSidebarLocations = {
  city: City;
  town: Town;
  quarter: Quarter;
};

/** Web `setCombosForSavedQuery` — kayıtlı sorguyu forma aktarmak için il/ilçe/mahalle çöz */
export function resolveSidebarSavedQueryLocations(item: SidebarSavedQuery): ResolvedSidebarLocations | null {
  const cities = LOCATIONS.cities || [];
  const mahalleTkgm = Number(item.mahalle_tkgm_value);
  const ppVal = item.mahalle_proparcel_value != null ? Number(item.mahalle_proparcel_value) : NaN;

  if (item.il_id && item.ilce_id && item.mahalle_id) {
    const city = cities.find((c) => String(c.Id) === String(item.il_id));
    const town = city?.Towns.find((t) => String(t.Id) === String(item.ilce_id));
    const quarter = town?.Quarters.find((q) => String(q.Id) === String(item.mahalle_id) && !q?.Inactive);
    if (city && town && quarter) return { city, town, quarter };
  }

  if (item.il_tkgm_value && item.ilce_tkgm_value && item.mahalle_tkgm_value) {
    const city = cities.find((c) => String(c.Tkgm_value) === String(item.il_tkgm_value));
    const town = city?.Towns.find((t) => String(t.Tkgm_value) === String(item.ilce_tkgm_value));
    const quarter = town?.Quarters.filter((q) => !q?.Inactive).find(
      (q) => String(q.Tkgm_value) === String(item.mahalle_tkgm_value)
    );
    if (city && town && quarter) return { city, town, quarter };
  }

  if (Number.isFinite(mahalleTkgm) && mahalleTkgm > 0) {
    for (const city of cities) {
      for (const town of city.Towns || []) {
        const quarter = (town.Quarters || [])
          .filter((q) => !q?.Inactive)
          .find((q) => {
            if (Number(q.Tkgm_value) === mahalleTkgm) return true;
            if (Number.isFinite(ppVal) && Number(q.Proparcel_value) === ppVal) return true;
            return false;
          });
        if (quarter) return { city, town, quarter };
      }
    }
  }

  if (item.il || item.ilce || item.mahalle) {
    const city = cities.find((c) => matchesName(c.Proparcel_text, item.il));
    const town = city?.Towns.find((t) => matchesName(t.Proparcel_text, item.ilce));
    const quarter = town?.Quarters.filter((q) => !q?.Inactive).find(
      (q) =>
        matchesName(q.Tkgm_text || q.Proparcel_text, item.mahalle) ||
        matchesName(q.Proparcel_text, item.mahalle)
    );
    if (city && town && quarter) return { city, town, quarter };
  }

  return null;
}
