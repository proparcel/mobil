/**
 * Yalnızca TKGM / ProParcel mahalle kodu önbelleği (cihazda).
 * Lisans doğrulaması ve "3D Tasarımlarım" listesi sunucudan: /api/credit/3d-design-license(s)/).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const V1_KEY = "pp_parcel_3d_purchased_v1";
const V2_KEY = "pp_parcel_3d_purchased_v2";

export type Parcel3dEntry = {
  mahalle: string;
  ada: string;
  parsel: string;
  mahalleTkgmValue?: number;
  proparcelValue?: number;
};

function parcelKey(mahalle?: string, ada?: string, parsel?: string): string {
  const m = String(mahalle ?? "").trim() || "_";
  const a = String(ada ?? "").trim() || "_";
  const p = String(parsel ?? "").trim() || "_";
  return `${m}|${a}|${p}`;
}

function entryKey(e: Parcel3dEntry): string {
  return parcelKey(e.mahalle, e.ada, e.parsel);
}

function parseLegacyV1Key(key: string): Parcel3dEntry | null {
  const parts = String(key).split("|");
  if (parts.length < 3) return null;
  return {
    mahalle: parts[0] === "_" ? "" : parts[0],
    ada: parts[1] === "_" ? "" : parts[1],
    parsel: parts[2] === "_" ? "" : parts[2],
  };
}

async function loadEntries(): Promise<Parcel3dEntry[]> {
  try {
    const rawV2 = await AsyncStorage.getItem(V2_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        return parsed as Parcel3dEntry[];
      }
    }
    const rawV1 = await AsyncStorage.getItem(V1_KEY);
    if (!rawV1) return [];
    const list: string[] = JSON.parse(rawV1);
    if (!Array.isArray(list)) return [];
    const entries: Parcel3dEntry[] = [];
    for (const k of list) {
      const e = parseLegacyV1Key(k);
      if (e) entries.push(e);
    }
    if (entries.length > 0) {
      await AsyncStorage.setItem(V2_KEY, JSON.stringify(entries));
      await AsyncStorage.removeItem(V1_KEY);
    }
    return entries;
  } catch {
    return [];
  }
}

async function saveEntries(entries: Parcel3dEntry[]): Promise<void> {
  await AsyncStorage.setItem(V2_KEY, JSON.stringify(entries));
}

/**
 * Satın alma veya TKGM yanıtından sonra mahalle kodlarını cihazda tutar (liste sunucudan gelir).
 */
export async function cacheParcel3dTkgmAfterPurchase(
  mahalle?: string,
  ada?: string,
  parsel?: string,
  mahalleTkgmValue?: number,
  proparcelValue?: number
): Promise<void> {
  try {
    const list = await loadEntries();
    const nextVal =
      mahalleTkgmValue != null && Number.isFinite(Number(mahalleTkgmValue))
        ? Number(mahalleTkgmValue)
        : undefined;
    const nextPro =
      proparcelValue != null && Number.isFinite(Number(proparcelValue)) ? Number(proparcelValue) : undefined;
    const newEntry: Parcel3dEntry = {
      mahalle: String(mahalle ?? "").trim(),
      ada: String(ada ?? "").trim(),
      parsel: String(parsel ?? "").trim(),
      ...(nextVal != null ? { mahalleTkgmValue: nextVal } : {}),
      ...(nextPro != null ? { proparcelValue: nextPro } : {}),
    };
    const k = entryKey(newEntry);
    const idx = list.findIndex((x) => entryKey(x) === k);
    if (idx >= 0) {
      const cur = list[idx];
      list[idx] = {
        ...cur,
        ...newEntry,
        mahalleTkgmValue: nextVal != null ? nextVal : cur.mahalleTkgmValue,
        proparcelValue: nextPro != null ? nextPro : cur.proparcelValue,
      };
    } else {
      list.push(newEntry);
    }
    await saveEntries(list);
  } catch {
    // ignore
  }
}

/** Sunucudan gelen satırı TKGM sorgusu için zenginleştirir (varsa yerel önbellek). */
export async function getCachedTkgmForParcel(
  mahalle: string,
  ada: string,
  parsel: string
): Promise<Partial<Pick<Parcel3dEntry, "mahalleTkgmValue" | "proparcelValue">> | null> {
  try {
    const list = await loadEntries();
    const k = parcelKey(mahalle, ada, parsel);
    const hit = list.find((x) => entryKey(x) === k);
    if (!hit) return null;
    const o: Partial<Pick<Parcel3dEntry, "mahalleTkgmValue" | "proparcelValue">> = {};
    if (hit.mahalleTkgmValue != null) o.mahalleTkgmValue = hit.mahalleTkgmValue;
    if (hit.proparcelValue != null) o.proparcelValue = hit.proparcelValue;
    return Object.keys(o).length ? o : null;
  } catch {
    return null;
  }
}

export async function mergeParcel3dEntryFields(
  match: Pick<Parcel3dEntry, "mahalle" | "ada" | "parsel">,
  patch: Partial<Pick<Parcel3dEntry, "mahalleTkgmValue" | "proparcelValue">>
): Promise<void> {
  try {
    const list = await loadEntries();
    const k = entryKey(match as Parcel3dEntry);
    const idx = list.findIndex((x) => entryKey(x) === k);
    if (idx < 0) return;
    list[idx] = { ...list[idx], ...patch };
    await saveEntries(list);
  } catch {
    // ignore
  }
}
