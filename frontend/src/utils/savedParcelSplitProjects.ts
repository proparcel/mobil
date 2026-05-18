/**
 * Hisseli Parsel Projeleri - kullanıcı tarafında kaydedilen PDF projeleri listesi.
 * savedQueries.ts ile aynı pattern: AsyncStorage / FileSystem fallback.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";

export type SavedParcelSplitProject = {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
};

const STORAGE_KEY = "pp_saved_parcel_split_projects_v1";
const FILE_PATH = `${RNFS.DocumentDirectoryPath}/${STORAGE_KEY}.json`;
let warnedAsyncStorageNull = false;

function isAsyncStorageNullError(e: unknown): boolean {
  const msg = String((e as any)?.message || e || "");
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

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
      console.warn("[savedParcelSplitProjects] AsyncStorage fallback to FileSystem.");
    }
    return await readFromFile();
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    if (!warnedAsyncStorageNull && isAsyncStorageNullError(e)) {
      warnedAsyncStorageNull = true;
      console.warn("[savedParcelSplitProjects] AsyncStorage fallback to FileSystem.");
    }
    await writeToFile(value);
  }
}

export async function loadSavedParcelSplitProjects(): Promise<SavedParcelSplitProject[]> {
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedParcelSplitProject[];
  } catch {
    return [];
  }
}

export async function addSavedParcelSplitProject(
  input: Omit<SavedParcelSplitProject, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<SavedParcelSplitProject[]> {
  const list = await loadSavedParcelSplitProjects();
  const nowIso = new Date().toISOString();
  const next: SavedParcelSplitProject = {
    id: input.id ?? String(Date.now()),
    fileName: String(input.fileName ?? "").trim() || "parcel_split.pdf",
    filePath: String(input.filePath ?? "").trim(),
    createdAt: input.createdAt ?? nowIso,
    mahalle: input.mahalle != null ? String(input.mahalle).trim() : undefined,
    ada: input.ada != null ? String(input.ada).trim() : undefined,
    parsel: input.parsel != null ? String(input.parsel).trim() : undefined,
  };
  const merged = [next, ...list];
  await setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export async function removeSavedParcelSplitProject(id: string): Promise<SavedParcelSplitProject[]> {
  const list = await loadSavedParcelSplitProjects();
  const next = list.filter((x) => String(x.id) !== String(id));
  await setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
