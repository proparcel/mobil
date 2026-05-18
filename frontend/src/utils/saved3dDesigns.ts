/**
 * 3D Tasarımlar - kullanıcı tarafında kaydedilen 3D tasarım çıktıları listesi.
 * Hisseli parsel projeleri ile aynı pattern: AsyncStorage / FileSystem fallback.
 *
 * Bu listede sadece metadata tutulur; görseller `captureGallery` altında zaten dosya olarak durur.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";

export type Saved3dDesign = {
  id: string;
  /** Örn: mahalle_ada_parsel veya mahalle_ada_parsel (2) */
  name: string;
  createdAt: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
  /** Paylaşım/Kayıt için görsel URI listesi (file://...) */
  imageUris: string[];
};

const STORAGE_KEY = "pp_saved_3d_designs_v1";
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
      console.warn("[saved3dDesigns] AsyncStorage fallback to FileSystem.");
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
      console.warn("[saved3dDesigns] AsyncStorage fallback to FileSystem.");
    }
    await writeToFile(value);
  }
}

export async function loadSaved3dDesigns(): Promise<Saved3dDesign[]> {
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Saved3dDesign[];
  } catch {
    return [];
  }
}

function normalizeBaseName(input: string): string {
  return String(input || "").trim() || "3D_Tasarim";
}

function pickUniqueName(existing: Saved3dDesign[], base: string): string {
  const b = normalizeBaseName(base);
  if (!existing.some((x) => String(x.name) === b)) return b;
  let i = 2;
  while (existing.some((x) => String(x.name) === `${b} (${i})`)) i++;
  return `${b} (${i})`;
}

export async function addSaved3dDesign(input: {
  nameBase: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
  imageUris: string[];
}): Promise<{ list: Saved3dDesign[]; saved: Saved3dDesign }> {
  const list = await loadSaved3dDesigns();
  const nowIso = new Date().toISOString();
  const name = pickUniqueName(list, input.nameBase);
  const saved: Saved3dDesign = {
    id: String(Date.now()),
    name,
    createdAt: nowIso,
    mahalle: input.mahalle != null ? String(input.mahalle).trim() : undefined,
    ada: input.ada != null ? String(input.ada).trim() : undefined,
    parsel: input.parsel != null ? String(input.parsel).trim() : undefined,
    imageUris: Array.isArray(input.imageUris) ? input.imageUris.filter(Boolean) : [],
  };
  const merged = [saved, ...list];
  await setItem(STORAGE_KEY, JSON.stringify(merged));
  return { list: merged, saved };
}

export async function removeSaved3dDesign(id: string): Promise<Saved3dDesign[]> {
  const list = await loadSaved3dDesigns();
  const next = list.filter((x) => String(x.id) !== String(id));
  await setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

