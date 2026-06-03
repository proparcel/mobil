import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Dimensions, Image, Platform, Alert } from 'react-native';

/** ViewShot çıktısı — paylaşım için JPEG yeterli, encode daha hızlı */
export const CAPTURE_VIEW_SHOT_OPTIONS = {
  format: 'jpg' as const,
  quality: 0.9,
  result: 'tmpfile' as const,
};

/** Görsel decode beklemesi üst sınırı (offscreen Image) */
export const CAPTURE_IMAGE_LOAD_TIMEOUT_MS = 380;

function normalizeFileUri(uri: string): string {
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

export function mimeTypeForCaptureUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

/** Dosya var mı ve anlamlı boyutta mı (~5ms) */
export async function verifyCaptureFile(uri: string | null): Promise<boolean> {
  if (!uri) return false;
  const path = normalizeFileUri(uri).replace(/^file:\/\//, '');
  try {
    const exists = await RNFS.exists(path);
    if (!exists) return false;
    const stat = await RNFS.stat(path);
    return stat.size > 2048;
  } catch {
    return false;
  }
}

export async function isCaptureImageUriUsable(uri: string | null): Promise<boolean> {
  return verifyCaptureFile(uri);
}

/** React layout için kısa frame beklemesi */
export async function waitCaptureLayoutFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

/**
 * ViewShot öncesi dosya doğrulama + isteğe bağlı prefetch.
 * Sabit 220ms bekleme yok — görsel hazırlığı captureWithMapUri içinde onLoadEnd ile yapılır.
 */
export async function prepareCaptureImageUri(uri: string | null): Promise<void> {
  if (!uri) return;
  await verifyCaptureFile(uri);
  const normalized = normalizeFileUri(uri);
  try {
    await Image.prefetch(normalized);
  } catch {
    /* file:// prefetch bazı platformlarda desteklenmez */
  }
}

/**
 * Görüntüyü paylaşır
 */
export const shareImage = async (imageUri: string): Promise<boolean> => {
  try {
    await Share.open({
      url: imageUri,
      type: mimeTypeForCaptureUri(imageUri),
      title: 'Paylaş',
    });
    return true;
  } catch (error: any) {
    if (error?.message === 'User did not share') {
      return false; // Kullanıcı iptal etti
    }
    console.error('Error sharing image:', error);
    return false;
  }
};

/**
 * Görüntü ve metin (link) paylaşır
 */
export const shareImageWithText = async (imageUri: string, text: string): Promise<{ success: boolean; linkText: string }> => {
  try {
    await Share.open({
      url: imageUri,
      type: mimeTypeForCaptureUri(imageUri),
      title: 'ProParcel',
      message: text,
    });
    return { success: true, linkText: text };
  } catch (error: any) {
    if (error?.message === 'User did not share') {
      return { success: false, linkText: text };
    }
    console.error('[shareImageWithText] Paylaşma hatası:', error);
    return { success: false, linkText: text };
  }
};

/**
 * Geçici dosyaları temizler
 */
export const cleanupTempFiles = async (uris: (string | null)[]): Promise<void> => {
  try {
    for (const uri of uris) {
      if (uri && (uri.startsWith('file://') || uri.startsWith(RNFS.DocumentDirectoryPath) || uri.startsWith(RNFS.CachesDirectoryPath))) {
        try {
          const path = uri.replace('file://', '');
          const exists = await RNFS.exists(path);
          if (exists) {
            await RNFS.unlink(path);
          }
        } catch (error) {
          console.warn('Error deleting temp file:', uri, error);
        }
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

/**
 * Görüntü boyutlarını hesaplar (A4 formatı için dikey düzen)
 */
export function getCombinedImageDimensions() {
  const { width: sw } = Dimensions.get('window');
  
  const baseWidth = Math.min(sw * 0.95, 800);
  const baseHeight = Math.floor(baseWidth * 1.7); // A4 oranından daha yüksek (1.414 -> 1.7)
  
  // Bilgi alanını ve harita alanını sayfa büyütme oranına göre ayarlıyoruz
  // Önceki: infoHeight = 140 (1.414 oranında), şimdi 1.7 oranında orantılı olarak artırıyoruz
  // Bilgi alanını daha yukarı çekmek için biraz daha fazla artırıyoruz
  const infoHeight = Math.floor(140 * (1.7 / 1.414) * 1.15); // ≈ 168 * 1.15 ≈ 193
  const mapHeight = baseHeight - infoHeight; 
  
  const width = baseWidth;

  return {
    mapWidth: width,
    mapHeight: mapHeight,
    modalWidth: width,
    modalHeight: infoHeight,
    height: baseHeight,
    totalWidth: baseWidth,
  };
}

/** takeSnap süresini düşürmek için en uzun kenarı sınırlar (oran korunur). */
export function capSnapDimensions(
  dims: { mapWidth: number; mapHeight: number },
  maxEdge = 1280,
): { mapWidth: number; mapHeight: number } {
  const w = Math.max(1, dims.mapWidth);
  const h = Math.max(1, dims.mapHeight);
  const longest = Math.max(w, h);
  if (longest <= maxEdge) {
    return { mapWidth: Math.round(w), mapHeight: Math.round(h) };
  }
  const scale = maxEdge / longest;
  return {
    mapWidth: Math.round(w * scale),
    mapHeight: Math.round(h * scale),
  };
}
