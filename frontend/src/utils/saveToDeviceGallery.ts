/**
 * Seçilen görüntü dosyalarını cihazın Fotoğraflar / Galeri uygulamasına kaydeder.
 */
import { Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";

export type SaveToGalleryResult = {
  ok: boolean;
  savedCount: number;
  error?: string;
};

function normalizeFileUri(uri: string): string {
  const u = String(uri || "").trim();
  if (!u) return u;
  if (u.startsWith("file://")) return u;
  return `file://${u.replace(/^file:\/*/, "/")}`;
}

/**
 * Yerel dosya URI'lerini (file://) sistem fotoğraf galerisine yazar.
 */
export async function saveImageUrisToPhotoLibrary(uris: string[]): Promise<SaveToGalleryResult> {
  if (uris.length === 0) {
    return { ok: true, savedCount: 0 };
  }
  if (Platform.OS === "web") {
    return { ok: false, savedCount: 0, error: "Web ortamında galeri kaydı desteklenmiyor." };
  }

  try {
    const available = await MediaLibrary.isAvailableAsync();
    if (!available) {
      return { ok: false, savedCount: 0, error: "Medya kütüphanesi bu cihazda kullanılamıyor." };
    }

    // Android: yalnizca yazma izni (READ_MEDIA_* yok). iOS: galeriye ekleme izni.
    const permissionResult = await MediaLibrary.requestPermissionsAsync(true);
    const { status } = permissionResult;
    if (status !== "granted") {
      return {
        ok: false,
        savedCount: 0,
        error: "Galeriye kaydetmek için izin vermeniz gerekiyor (Ayarlar > ProParcel).",
      };
    }

    let savedCount = 0;
    for (const raw of uris) {
      const path = normalizeFileUri(raw);
      if (!path.startsWith("file://")) {
        continue;
      }
      await MediaLibrary.saveToLibraryAsync(path);
      savedCount += 1;
    }

    if (savedCount === 0) {
      return { ok: false, savedCount: 0, error: "Kaydedilecek geçerli dosya bulunamadı." };
    }
    return { ok: true, savedCount };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[saveToDeviceGallery]", e);
    return { ok: false, savedCount: 0, error: msg || "Galeri kaydı başarısız." };
  }
}

/**
 * Yerel video dosyasını (file://) sistem fotoğraf galerisine yazar.
 */
export async function saveVideoFileToPhotoLibrary(fileUri: string): Promise<SaveToGalleryResult> {
  const path = normalizeFileUri(String(fileUri || "").trim());
  if (!path.startsWith("file://")) {
    return { ok: false, savedCount: 0, error: "Geçersiz video dosya yolu." };
  }
  return saveImageUrisToPhotoLibrary([path]);
}
