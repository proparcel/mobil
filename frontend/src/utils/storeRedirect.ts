/**
 * Store Redirect Utility
 * 
 * App Store ve Google Play yönlendirmesi için utility fonksiyonlar
 */

import { Platform, Linking, Alert } from 'react-native';

// App Store ve Play Store linkleri - gerçek linkler belirlendiğinde güncellenecek
const APP_STORE_URL = 'https://apps.apple.com/app/proparcel/idXXXXX'; // TODO: Gerçek App Store ID ile değiştir
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.proparcel.app'; // TODO: Gerçek package name ile doğrula

/**
 * Platform'a göre store URL'ini döndürür
 */
export function getStoreUrl(): string {
  if (Platform.OS === 'ios') {
    return APP_STORE_URL;
  } else if (Platform.OS === 'android') {
    return PLAY_STORE_URL;
  }
  // Web veya diğer platformlar için fallback
  return PLAY_STORE_URL;
}

/**
 * Store'a yönlendirme yapar
 */
export async function redirectToStore(): Promise<void> {
  try {
    const url = getStoreUrl();
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Uygulama Bulunamadı',
        'ProParcel uygulamasını indirmek için App Store veya Google Play\'i ziyaret edin.',
        [{ text: 'Tamam' }]
      );
    }
  } catch (error) {
    console.error('[storeRedirect] Store yönlendirme hatası:', error);
    Alert.alert('Hata', 'Store\'a yönlendirme yapılamadı.');
  }
}

/**
 * Universal link'i açmayı dener, başarısız olursa store'a yönlendirir
 */
export async function openLinkOrRedirect(link: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(link);
    
    if (canOpen) {
      await Linking.openURL(link);
      // Uygulama açıldı mı kontrol et (iOS için özellikle önemli)
      // Not: iOS'ta canOpenURL true dönerse ama app yüklü değilse, 
      // sistem otomatik olarak App Store'a yönlendirebilir
    } else {
      // Link açılamıyorsa (app yüklü değilse) store'a yönlendir
      await redirectToStore();
    }
  } catch (error) {
    console.error('[storeRedirect] Link açma hatası:', error);
    // Hata durumunda da store'a yönlendir
    await redirectToStore();
  }
}
