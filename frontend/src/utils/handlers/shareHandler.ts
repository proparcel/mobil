/**
 * Share Handler
 * 
 * Paylaşım işlemlerini yöneten handler fonksiyonu
 */

import React from 'react';
import { Alert, Share, Platform } from 'react-native';
import { getCombinedImageDimensions, shareImage, shareImageWithText, cleanupTempFiles } from '../screenshotManager';
import { waitForMapIdle, tryMapboxSnap, MapReadyState } from '../mapboxSnapshot';
import { generateShareLink } from '../queryUrlGenerator';
import { screenshotShareCompleted } from '../../../services/coinEventService';

function hashString(input: string): string {
  // djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export interface ShareHandlerParams {
  parcelData: any;
  mapRef: React.RefObject<any>;
  combinedContainerRef: React.RefObject<any>; // ViewShot ref (CombinedScreenshotContainer içinde ViewShot ile sarılı)
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

    // Debug: parcelData içeriğini logla (opsiyonel - parsel olmadan da çalışabilir)
    console.log('[shareHandler.ts] 📋 parcelData debug:', {
      hasProperties: !!parcelData?.properties,
      hasAnalysisData: !!parcelData?.analysisData,
      'properties.alan': parcelData?.properties?.alan,
      'analysisData?.parameters_data?.parcel_values?.alan': parcelData?.analysisData?.parameters_data?.parcel_values?.alan,
      'properties keys': Object.keys(parcelData?.properties || {}),
    });
    
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
      
      // 2. Mapbox snapshot'ı al (başarısızsa null bırakacağız)
      mapUri = await tryMapboxSnap(mapRef, dimensions);
      
      // 3. Combined container'ın içeriğini güncelle ve render commit bekle
      // State update + 2 frame bekleme (React state commit garantisi)
      // Boş string yerine null kullan - CombinedScreenshotContainer'da kontrol daha iyi çalışır
      setCapturedMapUri(mapUri || null);
      
      if (mapUri) {
        console.log('[shareHandler.ts:87] ✅ Mapbox snapshot başarılı, görüntü set edildi');
      } else {
        console.warn('[shareHandler.ts:90] ⚠️ Mapbox snapshot başarısız - placeholder ile devam ediliyor');
      }
      
      // 4. Combined ViewShot capture - Image yükleme ve layout için yeterli bekleme
      // React state commit garantisi için multiple frame beklemek
      await new Promise(res => requestAnimationFrame(() => res(null)));
      await new Promise(res => requestAnimationFrame(() => res(null)));
      await new Promise(res => requestAnimationFrame(() => res(null))); // Ekstra frame
      
      // Image onLoadEnd ve layout settle için yeterli bekleme (Android fade-in süresi + render)
      // Android'de Image fadeDuration=0 olsa bile render ve layout settle için bekleme gerekir
      // Image yüklenmesi için daha uzun bekleme (özellikle büyük görüntüler için)
      if (mapUri) {
        console.log('[shareHandler.ts:100] ⏳ Image yüklenmesi bekleniyor...');
        await new Promise(r => setTimeout(r, 300)); // Image render + layout settle + yükleme
      } else {
        await new Promise(r => setTimeout(r, 150)); // Sadece layout settle
      }
      
      // ViewShot ref'inin bağlanmasını bekle
      let retries = 0;
      while (!combinedContainerRef.current?.capture && retries < 30) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
        // Her 5 retry'de log at
        if (retries % 5 === 0) {
          console.log(`[shareHandler.ts:97] ⏳ ViewShot ref bekleniyor... (${retries}/30)`, {
            refExists: !!combinedContainerRef.current,
            hasCapture: !!(combinedContainerRef.current?.capture),
          });
        }
      }
      
      if (!combinedContainerRef.current?.capture) {
        console.error('[shareHandler.ts:108] ❌ Combined ViewShot ref hazır değil', {
          refExists: !!combinedContainerRef.current,
          hasCapture: !!(combinedContainerRef.current?.capture),
          retries,
          refType: combinedContainerRef.current ? typeof combinedContainerRef.current : 'null',
        });
        throw new Error('Combined ViewShot ref hazır değil - container render edilmedi veya ViewShot mount olmadı');
      }

      try {
        console.log('[shareHandler.ts:105] 📸 Combined ViewShot yakalanıyor...');
        // ViewShot'un capture() metodunu kullan
        combinedUri = await combinedContainerRef.current.capture();
        
        if (!combinedUri) {
          console.error('[shareHandler.ts:109] ❌ Combined container yakalanamadı - boş sonuç');
          throw new Error('Combined container yakalanamadı');
        }
        
        console.log('[shareHandler.ts:113] ✅ Combined görüntü hazır:', combinedUri);
      } catch (combineError: any) {
        console.error('[shareHandler.ts:116] ❌ Combined container yakalama hatası:', combineError);
        throw new Error('Görüntü birleştirilemedi: ' + (combineError?.message || 'Bilinmeyen hata'));
      }

      // 5. Query URL oluştur (parsel varsa)
      const queryLink = parcelData ? generateShareLink(parcelData) : null;
      const shareText = queryLink 
        ? `ProParcel'de bu parseli görüntüle:\n${queryLink}`
        : null;

      // 6. Paylaş (görüntü + metin)
      if (!combinedUri) {
        throw new Error('Paylaşılacak görüntü bulunamadı');
      }

      // Görüntü ve metin ile paylaş
      const shareResult = shareText 
        ? await shareImageWithText(combinedUri, shareText)
        : await shareImage(combinedUri).then(success => ({ success, linkText: null }));

      // Kullanıcı iptal ettiyse sessizce çık (hata gösterme)
      if (!shareResult.success) {
        console.log('[shareHandler.ts] ℹ️ Kullanıcı paylaşımı iptal etti');
        setShareModalVisible(false);
        return; // Hata fırlatmadan çık
      }

      // Paylaşım sonrası link bilgisini göster (opsiyonel)
      // Kullanıcı paylaşım dialog'unda metni ekleyebilir veya sonrasında kopyalayabilir
      if (shareResult.linkText && Platform.OS === 'android') {
        // Android'de paylaşım sonrası linki ayrı olarak paylaşma seçeneği sun
        // Kullanıcı deneyimini bozmamak için şimdilik loglama yapıyoruz
        // İleride kullanıcıya seçenek sunulabilir: "Link'i de paylaş?" alert'i ile
        console.log('[shareHandler.ts] Link bilgisi:', shareResult.linkText);
      }

      setShareModalVisible(false);
      console.log('[shareHandler.ts:116] ✅ Görüntü başarıyla paylaşıldı');
      if (shareResult.linkText) {
        console.log('[shareHandler.ts] 📎 Paylaşım linki:', shareResult.linkText);
      }

      // Coin kazanım event (server-side) - paylaşım tamamlandı
      try {
        const parcelId = parcelData?.id != null ? String(parcelData.id) : undefined;
        const share_hash = hashString(`${combinedUri}|${shareText || ''}|${parcelId || ''}`);
        await screenshotShareCompleted({
          share_hash,
          parcel_id: parcelId,
          price_text: shareText || undefined,
        });
      } catch (e) {
        // Paylaşım akışını bozma
        console.log('[shareHandler.ts] coin-event gönderilemedi:', e);
      }
    } catch (error: any) {
      // Kullanıcı iptal ettiyse hata gösterme
      if (error?.message === 'User did not share' || error?.message?.includes('iptal')) {
        console.log('[shareHandler.ts] ℹ️ Kullanıcı paylaşımı iptal etti');
        setShareModalVisible(false);
        return;
      }
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
