/**
 * 3D Model Editör Capture Galerisi
 * DocumentDirectory/ProParcel/Captures/ + AsyncStorage (pp_capture_gallery_v1)
 * Max 50 item; aşınca en eskileri sil.
 */

import RNFS from "react-native-fs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dimensions } from "react-native";

export function getModelEditorCaptureDimensions(): { mapWidth: number; mapHeight: number } {
  const { width: sw } = Dimensions.get("window");
  const mapWidth = Math.min(sw * 0.95, 800);
  const mapHeight = Math.floor(mapWidth * 1.4);
  return { mapWidth, mapHeight };
}

const CAPTURE_DIR = "ProParcel/Captures";
const ASYNC_STORAGE_KEY = "pp_capture_gallery_v1";
const MAX_CAPTURES = 50;

export type CaptureItem = {
  id: string;
  fileUri: string;
  createdAt: number;
  width: number;
  height: number;
  context?: { screen: "ShapeDrawingModal"; parcelId?: string };
};

function getCaptureDirPath(): string {
  const base = RNFS.DocumentDirectoryPath;
  return `${base}/${CAPTURE_DIR}`;
}

export async function ensureCaptureDir(): Promise<string> {
  const dir = getCaptureDirPath();
  const exists = await RNFS.exists(dir);
  if (!exists) {
    await RNFS.mkdir(dir, { intermediateDirectories: true });
    console.log("[ShapeDrawingModal:CAPTURE] ensureCaptureDir: dizin oluşturuldu", dir);
  }
  return dir;
}

/**
 * tmp dosyayı kalıcı galeri klasörüne taşı.
 * Dosya adı: capture_<timestamp>_<random>.jpg
 */
export async function saveTmpToGallery(tmpUri: string): Promise<string> {
  const dir = await ensureCaptureDir();
  const fileName = `capture_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.jpg`;
  const destPath = `${dir}/${fileName}`;

  let srcPath = tmpUri;
  if (tmpUri.startsWith("file://")) {
    srcPath = tmpUri.replace("file://", "");
  }

  const exists = await RNFS.exists(srcPath);
  if (!exists) {
    throw new Error(`[ShapeDrawingModal:CAPTURE] Tmp dosya bulunamadı: ${srcPath}`);
  }

  await RNFS.copyFile(srcPath, destPath);
  const fileUri = `file://${destPath}`;
  console.log("[ShapeDrawingModal:CAPTURE] saveTmpToGallery: kaydedildi", fileUri);
  return fileUri;
}

export async function loadCaptures(): Promise<CaptureItem[]> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items: CaptureItem[] = Array.isArray(parsed) ? parsed : [];

    const valid: CaptureItem[] = [];
    for (const item of items) {
      const path = item.fileUri?.replace("file://", "") ?? "";
      if (!path) continue;
      try {
        const exists = await RNFS.exists(path);
        if (exists) {
          valid.push(item);
        } else {
          console.log("[ShapeDrawingModal:CAPTURE] loadCaptures: eksik dosya listeden çıkarıldı", item.id);
        }
      } catch {
        console.log("[ShapeDrawingModal:CAPTURE] loadCaptures: dosya kontrol hatası, listeden çıkarıldı", item.id);
      }
    }

    valid.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return valid.slice(0, MAX_CAPTURES);
  } catch (e) {
    console.error("[ShapeDrawingModal:CAPTURE] loadCaptures hata:", e);
    return [];
  }
}

export async function persistCaptures(items: CaptureItem[]): Promise<void> {
  try {
    const sorted = [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const trimmed = sorted.slice(0, MAX_CAPTURES);
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(trimmed));
    console.log("[ShapeDrawingModal:CAPTURE] persistCaptures: kaydedildi, count=", trimmed.length);
  } catch (e) {
    console.error("[ShapeDrawingModal:CAPTURE] persistCaptures hata:", e);
  }
}

/**
 * Seçilen id'lere ait dosyaları diskten sil ve listeden çıkar.
 */
export async function deleteCaptureFiles(items: CaptureItem[], idsToDelete: Set<string>): Promise<CaptureItem[]> {
  const remaining: CaptureItem[] = [];
  for (const item of items) {
    if (idsToDelete.has(item.id)) {
      const path = item.fileUri?.replace("file://", "") ?? "";
      if (path) {
        try {
          const exists = await RNFS.exists(path);
          if (exists) await RNFS.unlink(path);
        } catch (e) {
          console.warn("[ShapeDrawingModal:CAPTURE] deleteCaptureFiles: silinemedi", path, e);
        }
      }
    } else {
      remaining.push(item);
    }
  }
  return remaining;
}

/**
 * Max limit aşımında en eski kayıtları sil.
 */
export async function enforceMaxCaptures(items: CaptureItem[]): Promise<CaptureItem[]> {
  if (items.length <= MAX_CAPTURES) return items;
  const sorted = [...items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const toRemove = sorted.slice(0, items.length - MAX_CAPTURES);
  const toRemoveIds = new Set(toRemove.map((x) => x.id));
  return deleteCaptureFiles(items, toRemoveIds);
}
