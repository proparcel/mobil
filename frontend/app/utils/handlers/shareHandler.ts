/**
 * Share Handler
 * 
 * Paylaşım işlemlerini yöneten handler fonksiyonu
 */

import React from 'react';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { getCombinedImageDimensions, shareImage, cleanupTempFiles } from '../screenshotManager';
import { waitForMapIdle, tryMapboxSnap, MapReadyState } from '../mapboxSnapshot';

export interface ShareHandlerParams {
  parcelData: any;
  mapRef: React.RefObject<any>;
  combinedContainerRef: React.RefObject<any>;
  mapReadyRef: React.MutableRefObject<MapReadyState>;
  isSharingRef: React.MutableRefObject<boolean>;
  setIsProcessingShare: (processing: boolean) => void;
  setCapturedMapUri: (uri: string | null) => void;
  setCapturedModalUri: (uri: string | null) => void;
  setShareModalVisible: (visible: boolean) => void;
}

/**
 * Paylaşım handler fonksiyonunu oluşturur
 */
export const createShareHandler = (params: ShareHandlerParams) => {
  return async () => {
    const {
      parcelData,
      mapRef,
      combinedContainerRef,
      mapReadyRef,
      isSharingRef,
      setIsProcessingShare,
      setCapturedMapUri,
      setCapturedModalUri,
      setShareModalVisible,
    } = params;

    if (!parcelData) {
      Alert.alert('Hata', 'Parsel bilgisi bulunamadı.');
      return;
    }
    
    setIsProcessingShare(true);
    isSharingRef.current = true; // Share sırasında kamera değişikliklerini durdur
    let mapUri: string | null = null;
    let combinedUri: string | null = null;

    try {
      const dimensions = getCombinedImageDimensions();
      
      // 1. Harita görüntüsünü yakala - Mapbox takeSnapshot öncelikli
      console.log('[shareHandler.ts:42] 📸 Harita yakalama başlatılıyor...', { 
        width: dimensions.mapWidth, 
        height: dimensions.mapHeight,
        mapRefExists: !!mapRef?.current,
      });
      
      // MapView ref'inin hazır olmasını bekle
      if (!mapRef.current) {
        console.warn('[shareHandler.ts:55] ⚠️ MapView ref henüz hazır değil, bekleniyor...');
        let mapRetries = 0;
        while (!mapRef.current && mapRetries < 20) {
          await new Promise(r => setTimeout(r, 100));
          mapRetries++;
        }
        if (!mapRef.current) {
          throw new Error('MapView ref bulunamadı - map henüz yüklenmedi');
        }
      }
      
      // MapView'ın tamamen render olmasını bekle
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
      await new Promise(resolve => setTimeout(resolve, 150)); // Kısa "settle" payı
      
      // KRİTİK: Map idle durumunu bekle (style/annotation apply bitene kadar)
      console.log('[shareHandler.ts:69] ⏳ Map idle durumu bekleniyor...');
      await waitForMapIdle(mapReadyRef, 5000);
      
      // 2. Combined container'ı önce render et (placeholder ile)
      // Böylece container ref'i hazır olur
      // NOT: isProcessingShare zaten true olduğu için container render edilmeli
      // Ama ref'in bağlanması için biraz bekle
      setCapturedMapUri(null); // Placeholder göstermek için
      
      // Container'ın render edilmesi için React render cycle'ını bekle
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await new Promise(r => setTimeout(r, 200)); // Container'ın render olması için bekle
      
      // 3. Mapbox snapshot'ı dene
      mapUri = await tryMapboxSnap(mapRef, dimensions);
      if (mapUri) {
        console.log('[shareHandler.ts:64] ✅ Mapbox snapshot başarılı, görüntü set ediliyor...');
        setCapturedMapUri(mapUri);
        // State update'inin render edilmesi için bekle
        await new Promise(r => setTimeout(r, 500));
      } else {
        console.warn('[shareHandler.ts:70] ⚠️ Mapbox snapshot başarısız - placeholder ile devam ediliyor');
        // Placeholder zaten gösteriliyor, sadece log at
      }
      
      // 4. Combined container'ı yakala (bilgilerin render olması için biraz daha bekle)
      // Container'ın render edilmesi ve ref'in bağlanması için bekle
      await new Promise(r => setTimeout(r, 500));
      
      // Ref'in bağlanması için biraz daha bekle (birkaç render cycle)
      let retries = 0;
      while (!combinedContainerRef.current && retries < 10) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
      }
      
      if (!combinedContainerRef.current) {
        console.error('[shareHandler.ts:88] ❌ Combined container ref bulunamadı', {
          isProcessingShare: true, // Bu state'e direkt erişim yok, ama log için
          refExists: !!combinedContainerRef.current,
          retries,
        });
        throw new Error('Combined container ref bulunamadı - container render edilmedi');
      }

      try {
        console.log('[shareHandler.ts:83] 📸 Combined container yakalanıyor...');
        // KRİTİK: captureRef'e ref.current geçilmeli (ref objesi değil)
        combinedUri = await captureRef(combinedContainerRef.current, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
        });
        
        if (!combinedUri) {
          console.error('[shareHandler.ts:93] ❌ Combined container yakalanamadı - boş sonuç');
          throw new Error('Combined container yakalanamadı');
        }
        
        console.log('[shareHandler.ts:97] ✅ Combined görüntü hazır:', combinedUri);
      } catch (combineError: any) {
        console.error('[shareHandler.ts:100] ❌ Combined container yakalama hatası:', combineError);
        throw new Error('Görüntü birleştirilemedi: ' + (combineError?.message || 'Bilinmeyen hata'));
      }

      // 5. Paylaş
      if (!combinedUri) {
        throw new Error('Paylaşılacak görüntü bulunamadı');
      }

      const shared = await shareImage(combinedUri);
      if (!shared) {
        throw new Error('Paylaşma başarısız oldu');
      }

      setShareModalVisible(false);
      console.log('[shareHandler.ts:116] ✅ Görüntü başarıyla paylaşıldı');
    } catch (error: any) {
      console.error('[shareHandler.ts:119] ❌ Paylaşma hatası:', error);
      Alert.alert('Hata', error.message || 'Görüntü paylaşılırken bir hata oluştu.');
    } finally {
      // State'i temizle
      setCapturedMapUri(null);
      setCapturedModalUri(null);
      // Geçici dosyaları temizle
      await cleanupTempFiles([mapUri, combinedUri]);
      isSharingRef.current = false; // Share bitti, kamera değişikliklerini tekrar aktif et
      setIsProcessingShare(false);
    }
  };
};
