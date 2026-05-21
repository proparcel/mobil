import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import type { DfaRow } from '../types/reportPayload';

export type PriceSnapshot = {
  unit_price: number | null;
  total_price: number | null;
  area_m2?: number | null;
};

export type LocationHeader = {
  ilAd?: string | null;
  ilceAd?: string | null;
  mahalleAd?: string | null;
  adaNo?: string | null;
  parselNo?: string | null;
};

export type QueryMode = "simple" | "pro";

export type SavedQuery = {
  id: string;
  createdAt: string;
  proparcel_value: number | null;
  tkgm_value: number;
  ada: string;
  parsel: string;
  /** Web sidebar `mode` — Basit / Pro rozeti */
  mode?: QueryMode;
  price_snapshot: PriceSnapshot;
  /** DFA tablosu satırları (tüm detay); rapor kaydında saklanır */
  dfaRows?: DfaRow[];
  /** Konum başlığı: il, ilçe, mahalle, ada, parsel */
  location_header?: LocationHeader;
};

const STORAGE_KEY = 'pp_saved_queries_mobile_v1';
/** Web sidebar `MAX_ITEMS` ile uyumlu */
const MAX_QUERIES = 30;
// Some TS environments fail to pick up these exports; keep runtime behavior but avoid hard typing.
const FILE_PATH = `${RNFS.DocumentDirectoryPath}/${STORAGE_KEY}.json`;
let warnedAsyncStorageNull = false;

function isAsyncStorageNullError(e: unknown): boolean {
  const msg = String((e as any)?.message || e || '');
  return msg.includes('AsyncStorage is null') || msg.includes('NativeModule: AsyncStorage is null');
}

async function readFromFile(): Promise<string | null> {
  try {
    const exists = await RNFS.exists(FILE_PATH);
    if (!exists) return null;
    return await RNFS.readFile(FILE_PATH, 'utf8');
  } catch {
    return null;
  }
}

async function writeToFile(value: string): Promise<void> {
  try {
    await RNFS.writeFile(FILE_PATH, value, 'utf8');
  } catch {
    // ignore
  }
}

async function deleteFile(): Promise<void> {
  try {
    const exists = await RNFS.exists(FILE_PATH);
    if (exists) {
      await RNFS.unlink(FILE_PATH);
    }
  } catch {
    // ignore
  }
}

async function getItem(key: string): Promise<string | null> {
  let fromStorage: string | null = null;
  try {
    fromStorage = await AsyncStorage.getItem(key);
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
      console.warn("[savedQueries] AsyncStorage okunamadı; dosyadan okunacak.");
    }
  }
  if (fromStorage) return fromStorage;
  return await readFromFile();
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
      console.warn("[savedQueries] AsyncStorage yazılamadı; yalnızca dosyaya yazılıyor.");
    }
  }
  await writeToFile(value);
}

async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
      console.warn('[savedQueries] AsyncStorage native module missing; falling back to FileSystem persistence.');
    }
    await deleteFile();
  }
}

function normalizeStr(v: unknown): string {
  return String(v ?? '').trim();
}

export function makeSavedQueryKey(q: Pick<SavedQuery, 'tkgm_value' | 'ada' | 'parsel'>): string {
  return `${String(q.tkgm_value)}|${normalizeStr(q.ada)}|${normalizeStr(q.parsel)}`;
}

function clampList(list: SavedQuery[]): SavedQuery[] {
  return list.slice(0, MAX_QUERIES);
}

export async function loadSavedQueries(): Promise<SavedQuery[]> {
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedQuery[];
  } catch {
    return [];
  }
}

export async function writeSavedQueries(list: SavedQuery[]): Promise<void> {
  const safe = clampList(Array.isArray(list) ? list : []);
  await setItem(STORAGE_KEY, JSON.stringify(safe));
}

export async function upsertSavedQuery(input: Omit<SavedQuery, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<SavedQuery[]> {
  const list = await loadSavedQueries();

  const nowIso = new Date().toISOString();
  const next: SavedQuery = {
    id: input.id ? String(input.id) : String(Date.now()),
    createdAt: input.createdAt ? String(input.createdAt) : nowIso,
    proparcel_value: input.proparcel_value ?? null,
    tkgm_value: Number(input.tkgm_value),
    ada: normalizeStr(input.ada),
    parsel: normalizeStr(input.parsel),
    price_snapshot: input.price_snapshot ?? { unit_price: null, total_price: null },
    dfaRows: Array.isArray(input.dfaRows) ? input.dfaRows : undefined,
    location_header: input.location_header ?? undefined,
    mode: input.mode,
  };

  const key = makeSavedQueryKey(next);
  const existing = list.find((x) => makeSavedQueryKey(x) === key);
  if (!next.mode) {
    next.mode = input.mode ?? existing?.mode ?? "simple";
  }
  const filtered = list.filter((x) => makeSavedQueryKey(x) !== key);
  const merged = [next, ...filtered];

  await writeSavedQueries(merged);
  return clampList(merged);
}

export async function removeSavedQuery(id: string): Promise<SavedQuery[]> {
  const list = await loadSavedQueries();
  const next = list.filter((x) => String(x.id) !== String(id));
  await writeSavedQueries(next);
  return next;
}

export async function clearSavedQueries(): Promise<void> {
  await removeItem(STORAGE_KEY);
}

