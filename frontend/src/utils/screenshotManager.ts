import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Dimensions, Platform, Alert } from 'react-native';

/**
 * Görüntüyü paylaşır
 */
export const shareImage = async (imageUri: string): Promise<boolean> => {
  try {
    await Share.open({
      url: imageUri,
      type: 'image/png',
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
      type: 'image/png',
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
