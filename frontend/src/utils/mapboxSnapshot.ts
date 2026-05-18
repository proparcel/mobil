/**
 * Mapbox Snapshot Utilities
 * 
 * Mapbox haritasından snapshot alma fonksiyonları ve map idle yönetimi
 */

import React from 'react';

export interface MapReadyState {
  didFinishLoadingMap: boolean;
  didFinishLoadingStyle: boolean;
  isIdle: boolean;
}

/**
 * Mapbox map idle durumunu bekler
 * Map tamamen yüklenip render edilene kadar bekler
 */
export const waitForMapIdle = async (
  mapReadyRef: React.MutableRefObject<MapReadyState>,
  timeoutMs = 4000
): Promise<boolean> => {
  const start = Date.now();
  mapReadyRef.current.isIdle = false; // Share öncesi reset önemli
  while (Date.now() - start < timeoutMs) {
    const r = mapReadyRef.current;
    if (r.didFinishLoadingMap && r.didFinishLoadingStyle && r.isIdle) {
      console.log('[mapboxSnapshot.ts:22] ✅ Map is idle');
      return true;
    }
    await new Promise(res => setTimeout(res, 50));
  }
  console.warn('[mapboxSnapshot.ts:27] ⚠️ Map idle timeout');
  return false;
};

/**
 * Mapbox snapshot alma fonksiyonu
 * takeSnap veya takeSnapshot metodunu dener, farklı parametre formatlarını test eder
 */
export const tryMapboxSnap = async (
  mapRef: React.RefObject<any>,
  dimensions: { mapWidth: number; mapHeight: number }
): Promise<string | null> => {
  const map = mapRef.current;
  if (!map) {
    console.warn('[mapboxSnapshot.ts:39] ❌ MapView ref yok');
    return null;
  }

  const fn =
    (typeof map.takeSnap === 'function' && map.takeSnap) ||
    (typeof map.takeSnapshot === 'function' && map.takeSnapshot) ||
    null;

  if (!fn) {
    console.warn('[mapboxSnapshot.ts:47] ❌ MapView snapshot fonksiyonu yok (takeSnap/takeSnapshot bulunamadı)');
    return null;
  }

  try {
    console.log('[mapboxSnapshot.ts:52] 📸 Mapbox takeSnap/takeSnapshot deneniyor...', { 
      width: dimensions.mapWidth, 
      height: dimensions.mapHeight 
    });
    
    // Önce frame bekleyelim
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    await new Promise(resolve => setTimeout(resolve, 150)); // Kısa "settle" payı
    
    // Bazı Mapbox sürümlerinde takeSnap sadece boolean alır (writeToDisk)
    // Önce object formatını dene, başarısız olursa boolean formatını dene
    let res: any;
    try {
      // Önce object formatını dene
      res = await fn.call(map, {
        width: dimensions.mapWidth,
        height: dimensions.mapHeight,
        format: 'png',
        quality: 1,
        writeToDisk: true,
      });
    } catch (objError: any) {
      // Object formatı başarısız olduysa, boolean formatını dene
      if (objError?.message?.includes('Expected argument 1') || objError?.message?.includes('boolean')) {
        console.log('[mapboxSnapshot.ts:75] 📸 Object format başarısız, boolean format deneniyor...');
        try {
          res = await fn.call(map, true); // writeToDisk = true
        } catch (boolError) {
          console.error('[mapboxSnapshot.ts:79] ❌ Boolean format da başarısız:', boolError);
          throw objError; // Orijinal hatayı fırlat
        }
      } else {
        throw objError; // Diğer hatalar için orijinal hatayı fırlat
      }
    }

    const uri =
      typeof res === 'string' ? res :
      res?.uri || res?.path || null;

    if (uri) {
      let finalUri = uri;
      if (!uri.startsWith('file://') && !uri.startsWith('http')) {
        finalUri = uri.startsWith('/') ? `file://${uri}` : `file://${uri}`;
      }
      console.log('[mapboxSnapshot.ts:98] ✅ Mapbox snapshot başarılı:', finalUri);
      return finalUri;
    }
    
    console.warn('[mapboxSnapshot.ts:102] ⚠️ Mapbox snapshot URI alınamadı');
    return null;
  } catch (error: any) {
    // Eğer başarılı bir URI dönmüşse ama hata da oluşmuşsa, URI'yi kullan
    // (Bazı Mapbox sürümlerinde snapshot başarılı ama internal event conflict oluşabiliyor)
    if (error?.message?.includes('Call Stack')) {
      console.warn('[mapboxSnapshot.ts:108] ⚠️ Mapbox snapshot internal event conflict (snapshot başarılı olabilir)');
    } else {
      console.error('[mapboxSnapshot.ts:110] ❌ Mapbox takeSnap/takeSnapshot hatası:', error);
    }
    return null;
  }
};
