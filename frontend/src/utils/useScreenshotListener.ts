/**
 * Screenshot Listener Hook
 * 
 * Sistem ekran görüntüsü yakalama listener'ı için hook
 */

import { useEffect, useRef } from 'react';

// React Native'de native screenshot detection için
// alternatif bir paket gerekebilir veya bu özellik kaldırılabilir
// Şimdilik bu özellik devre dışı
let ScreenCapture: any = null;
/** Hook sayısını değiştirmemek için modül seviyesi (useRef eklemiyoruz). */
let didLogNoModule = false;

export interface UseScreenshotListenerParams {
  activeScreen: string | null;
  parcelData: any;
  parcelModalVisible: boolean;
  setShareModalVisible: (visible: boolean) => void;
}

/**
 * Sistem ekran görüntüsü yakalama listener hook'u
 * Ekran görüntüsü alındığında ShareModal'ı açar
 */
export const useScreenshotListener = (params: UseScreenshotListenerParams) => {
  const {
    activeScreen,
    parcelData,
    parcelModalVisible,
    setShareModalVisible,
  } = params;

  // Ref'ler ile güncel değerleri sakla (closure sorununu önlemek için)
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    // ScreenCapture modülü yüklenmemişse listener kurma (beklenen durum; LogBox uyarısı gösterme)
    if (!ScreenCapture) {
      if (__DEV__ && !didLogNoModule) {
        didLogNoModule = true;
        console.log('[useScreenshotListener] ScreenCapture modülü yok, listener kurulmayacak (normal).');
      }
      return;
    }

    let subscription: { remove: () => void } | null = null;

    const setupScreenshotListener = async () => {
      try {
        // Önce engellemeyi açıkça kaldır (önceden aktif olmuş olabilir)
        try {
          if (ScreenCapture.allowScreenCaptureAsync) {
            await ScreenCapture.allowScreenCaptureAsync();
            console.log('[useScreenshotListener.ts:50] ✅ Ekran görüntüsü engellemesi kaldırıldı (allowScreenCaptureAsync)');
          }
        } catch (allowError: any) {
          console.warn('[useScreenshotListener.ts:54] ⚠️ Ekran görüntüsü engellemesi kaldırılamadı:', allowError);
        }

        // Android'de bazı durumlarda izin gerekebilir
        if (ScreenCapture.getPermissionsAsync) {
          try {
            const permissionStatus = await ScreenCapture.getPermissionsAsync();
            console.log('[useScreenshotListener.ts:60] 📸 Screenshot permission status:', permissionStatus);
            
            if (!permissionStatus.granted && ScreenCapture.requestPermissionsAsync) {
              console.log('[useScreenshotListener.ts:63] 📸 Screenshot izni isteniyor...');
              const result = await ScreenCapture.requestPermissionsAsync();
              console.log('[useScreenshotListener.ts:65] 📸 Screenshot izin sonucu:', result);
            }
          } catch (permError: any) {
            console.warn('[useScreenshotListener.ts:68] 📸 Permission check failed (may not be required):', permError);
          }
        }

        console.log('[useScreenshotListener.ts:71] 📸 Screenshot listener kuruluyor...');
        console.log('[useScreenshotListener.ts:72] 📊 Listener kurulurken durum:', {
          activeScreen: paramsRef.current.activeScreen,
          hasParcel: paramsRef.current.parcelData !== null && paramsRef.current.parcelData.geometry !== null,
          parcelModalVisible: paramsRef.current.parcelModalVisible,
        });
        
        if (ScreenCapture.addScreenshotListener) {
          subscription = ScreenCapture.addScreenshotListener(() => {
            // Ref'lerden güncel değerleri al (closure sorununu önlemek için)
            const currentParams = paramsRef.current;
            
            console.log('[useScreenshotListener.ts:83] 📸 📸 📸 EKRAN GÖRÜNTÜSÜ ALGILANDI! 📸 📸 📸');
            console.log('[useScreenshotListener.ts:84] 📊 Callback çalışıyor - durum kontrolü:', {
              activeScreen: currentParams.activeScreen,
              hasParcel: currentParams.parcelData !== null && currentParams.parcelData.geometry !== null,
              parcelModalVisible: currentParams.parcelModalVisible,
              parcelDataExists: currentParams.parcelData !== null,
            });
            
            // Ana sayfada mı kontrol et (parsel kontrolü yok)
            const isOnMainScreen = currentParams.activeScreen === null;

            console.log('[useScreenshotListener.ts:95] 📊 Koşul kontrolü:', {
              isOnMainScreen,
              shouldOpenModal: isOnMainScreen,
            });

            if (isOnMainScreen) {
              console.log('[useScreenshotListener.ts:103] ✅ Ekran görüntüsü algılandı - Paylaşım modalı açılıyor...');
              // Ekran görüntüsü algılandı - ShareModal'ı aç
              setTimeout(() => {
                console.log('[useScreenshotListener.ts:106] 🔄 setShareModalVisible(true) çağrılıyor...');
                currentParams.setShareModalVisible(true);
              }, 300);
            } else {
              console.log('[useScreenshotListener.ts:110] ⚠️ Koşullar sağlanmadı - modal açılmayacak');
            }
          });

          console.log('[useScreenshotListener.ts:114] ✅ Screenshot listener başarıyla kuruldu');
        } else {
          console.warn('[useScreenshotListener.ts:116] addScreenshotListener fonksiyonu mevcut değil');
        }
      } catch (error: any) {
        console.error('[useScreenshotListener.ts:119] ❌ Screenshot listener kurulamadı:', error);
      }
    };

    setupScreenshotListener();

    return () => {
      console.log('[useScreenshotListener.ts:125] 📸 Screenshot listener kaldırılıyor...');
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (cleanupError: any) {
        console.warn('[useScreenshotListener.ts:130] ⚠️ Screenshot listener kaldırılırken hata:', cleanupError);
      }
    };
  }, [activeScreen, parcelData, parcelModalVisible, setShareModalVisible]);
};
