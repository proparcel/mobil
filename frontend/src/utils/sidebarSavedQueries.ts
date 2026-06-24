import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { DeviceEventEmitter } from "react-native";
import locationsJson from "../data/locations.json";
import { SIDEBAR_SAVED_QUERIES_CHANGED } from "../constants/sidebarSavedQueriesEvents";
import type { QueryMode, QuerySubmitPayload } from "./persistSimpleQuery";

/** Web `pp_sidebar_saved_queries_v1` kayıt yapısı */
export type SidebarSavedQuery = {
  id: string;
  mode: QueryMode;
  il_id?: string;
  ilce_id?: string;
  mahalle_id?: string;
  il_tkgm_value?: string;
  ilce_tkgm_value?: string;
  mahalle_tkgm_value?: string;
  mahalle_proparcel_value?: string;
  il: string;
  ilce: string;
  mahalle: string;
  ada: string;
  parsel: string;
  alan?: string;
  createdAt?: string;
  updatedAt: string;
  /** Sesli/akıllı sorgu — il/ilçe/ada/parsel dolu, mahalle kullanıcı seçer */
  partialMahalle?: boolean;
};

const STORAGE_KEY = "pp_sidebar_saved_queries_v1";
const MAX_ITEMS = 30;
const FILE_PATH = `${RNFS.DocumentDirectoryPath}/${STORAGE_KEY}.json`;

type Quarter = {
  Id: number;
  Tkgm_value: number;
  Proparcel_text: string;
  Tkgm_text?: string;
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

let warnedAsyncStorageNull = false;

function isAsyncStorageNullError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message || e || "");
  return msg.includes("AsyncStorage is null") || msg.includes("NativeModule: AsyncStorage is null");
}

async function readFromFile(): Promise<string | null> {
  try {
    const exists = await RNFS.exists(FILE_PATH);
    if (!exists) return null;
    return await RNFS.readFile(FILE_PATH, "utf8");
  } catch {
    return null;
  }
}

async function writeToFile(value: string): Promise<void> {
  try {
    await RNFS.writeFile(FILE_PATH, value, "utf8");
  } catch {
    // ignore
  }
}

async function getItem(): Promise<string | null> {
  try {
    const fromStorage = await AsyncStorage.getItem(STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
    }
  }
  return readFromFile();
}

async function setItem(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
    }
  }
  await writeToFile(value);
}

function normalizeKeyPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

export function buildSidebarQueryKey(item: Pick<SidebarSavedQuery, "mahalle_tkgm_value" | "ada" | "parsel">): string {
  return [
    normalizeKeyPart(item.mahalle_tkgm_value),
    normalizeKeyPart(item.ada),
    normalizeKeyPart(item.parsel),
  ].join("|");
}

function extractArea(props?: Record<string, unknown> | null): string {
  const raw =
    props &&
    (props.yuzolcum ||
      props.Yuzolcum ||
      props.YUZOLCUM ||
      props.alan ||
      props.Alan ||
      props.ALAN ||
      props.area ||
      props.Area ||
      props.area_m2 ||
      props.areaM2);
  if (raw == null || raw === "") return "";
  return String(raw).trim();
}

export async function clearSidebarSavedQueries(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    const exists = await RNFS.exists(FILE_PATH);
    if (exists) await RNFS.unlink(FILE_PATH);
  } catch {
    // ignore
  }
}

export async function loadSidebarSavedQueries(): Promise<SidebarSavedQuery[]> {
  try {
    const raw = await getItem();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SidebarSavedQuery[]) : [];
  } catch {
    return [];
  }
}

async function writeSidebarSavedQueries(list: SidebarSavedQuery[]): Promise<void> {
  await setItem(JSON.stringify(list.slice(0, MAX_ITEMS)));
  DeviceEventEmitter.emit(SIDEBAR_SAVED_QUERIES_CHANGED);
}

export async function upsertSidebarSavedQuery(item: Omit<SidebarSavedQuery, "id" | "updatedAt"> & Partial<Pick<SidebarSavedQuery, "id" | "createdAt" | "updatedAt">>): Promise<SidebarSavedQuery[]> {
  const key = buildSidebarQueryKey({
    mahalle_tkgm_value: item.mahalle_tkgm_value,
    ada: item.ada,
    parsel: item.parsel,
  });
  const list = await loadSidebarSavedQueries();
  const existing = list.find((row) => buildSidebarQueryKey(row) === key);
  const now = new Date().toISOString();
  const merged: SidebarSavedQuery = {
    ...(existing || {}),
    ...item,
    id: key,
    createdAt: existing?.createdAt || item.createdAt || now,
    updatedAt: item.updatedAt || now,
  } as SidebarSavedQuery;
  const next = [merged, ...list.filter((row) => buildSidebarQueryKey(row) !== key)].slice(0, MAX_ITEMS);
  await writeSidebarSavedQueries(next);
  return next;
}

export async function deleteSidebarSavedQuery(id: string): Promise<SidebarSavedQuery[]> {
  const target = String(id || "");
  const next = (await loadSidebarSavedQueries()).filter(
    (row) => String(row.id || buildSidebarQueryKey(row)) !== target
  );
  await writeSidebarSavedQueries(next);
  return next;
}

function findQuarterInTown(town: Town, mahalleTkgm: number, proparcelValue?: number): Quarter | undefined {
  const quarters = (town.Quarters || []).filter((q) => !q?.Inactive);
  let quarter = quarters.find((q) => Number(q.Tkgm_value) === mahalleTkgm);
  if (!quarter && proparcelValue != null && Number.isFinite(proparcelValue)) {
    quarter = quarters.find((q) => Number(q.Proparcel_value) === proparcelValue);
  }
  return quarter;
}

/** Form / TKGM payload → web sidebar kaydı */
export function buildSidebarSavedQueryFromPayload(
  payload: QuerySubmitPayload & { cityId?: number; townId?: number },
  mode: QueryMode,
  tkgmProperties?: Record<string, unknown> | null
): SidebarSavedQuery | null {
  const ada = String(payload.ada || "").trim();
  const parsel = String(payload.parsel || "").trim();
  const mahalleTkgm = Number(payload.mahalleTkgmValue);
  if (!ada || !parsel || !Number.isFinite(mahalleTkgm) || mahalleTkgm <= 0) return null;

  const cities = LOCATIONS.cities || [];
  let city: City | undefined =
    payload.cityId != null ? cities.find((c) => Number(c.Id) === Number(payload.cityId)) : undefined;
  let town: Town | undefined =
    city && payload.townId != null
      ? city.Towns.find((t) => Number(t.Id) === Number(payload.townId))
      : undefined;
  let quarter: Quarter | undefined = town
    ? findQuarterInTown(town, mahalleTkgm, payload.proparcelValue)
    : undefined;

  if (!quarter) {
    for (const cityItem of cities) {
      for (const townItem of cityItem.Towns || []) {
        const candidate = findQuarterInTown(townItem, mahalleTkgm, payload.proparcelValue);
        if (candidate) {
          city = cityItem;
          town = townItem;
          quarter = candidate;
          break;
        }
      }
      if (quarter) break;
    }
  }

  const props = tkgmProperties || {};
  const mahalleLabel =
    String(payload.mahalle || "").trim() ||
    String(quarter?.Proparcel_text || quarter?.Tkgm_text || props.mahalleAd || "").trim();

  return {
    id: "",
    mode,
    il_id: city ? String(city.Id) : undefined,
    ilce_id: town ? String(town.Id) : undefined,
    mahalle_id: quarter ? String(quarter.Id) : undefined,
    il_tkgm_value: city ? String(city.Tkgm_value) : undefined,
    ilce_tkgm_value: town ? String(town.Tkgm_value) : undefined,
    mahalle_tkgm_value: String(mahalleTkgm),
    mahalle_proparcel_value:
      payload.proparcelValue != null
        ? String(payload.proparcelValue)
        : quarter?.Proparcel_value != null
          ? String(quarter.Proparcel_value)
          : undefined,
    il: String(payload.city || city?.Proparcel_text || props.ilAd || "").trim(),
    ilce: String(payload.town || town?.Proparcel_text || props.ilceAd || "").trim(),
    mahalle: mahalleLabel,
    ada,
    parsel,
    alan: extractArea(props) || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertSidebarSavedQueryFromPayload(
  payload: QuerySubmitPayload & { cityId?: number; townId?: number },
  mode: QueryMode,
  tkgmProperties?: Record<string, unknown> | null
): Promise<boolean> {
  const item = buildSidebarSavedQueryFromPayload(payload, mode, tkgmProperties);
  if (!item) return false;
  await upsertSidebarSavedQuery(item);
  return true;
}
