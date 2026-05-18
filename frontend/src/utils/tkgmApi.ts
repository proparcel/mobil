/**
 * TKGM API direkt çağrı yardımcı fonksiyonları (Mobil uygulama için)
 * CORS hatası durumunda backend endpoint'ine fallback yapar
 */

const TKGM_API_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel';
const TKGM_TIMEOUT = 20000; // 20 saniye

const TKGM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://parselsorgu.tkgm.gov.tr",
  "Referer": "https://parselsorgu.tkgm.gov.tr/"
};

interface TkgmError {
  type: string;
  status?: number;
  message: string;
  detail?: any;
  originalError?: any;
}

interface TkgmData {
  geometry: any;
  properties: any;
}

/**
 * Koordinat ile TKGM verisi alır, başarısız olursa backend'e fallback yapar
 * @param lat - Enlem
 * @param lon - Boylam
 * @param backendUrl - Backend URL (fallback için)
 * @param signal - AbortSignal (opsiyonel)
 * @returns TKGM verisi
 */
export async function fetchTkgmByCoordsWithFallback(
  lat: number,
  lon: number,
  backendUrl: string,
  signal?: AbortSignal
): Promise<TkgmData> {
  try {
    // İlk deneme: Direkt TKGM API
    const url = `${TKGM_API_BASE}/${lat}/${lon}/`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TKGM_TIMEOUT);
    
    // Eğer dışarıdan signal verilmişse, onu da dinle
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: TKGM_HEADERS,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 404) {
        // Parsel bulunamadı durumu
        let errorData = null;
        try {
          errorData = await response.json();
        } catch(e) {
          errorData = { Message: "Parsel Bulunamadı" };
        }
        
        const msg = errorData?.Message || errorData?.message || "Parsel Bulunamadı";
        throw {
          type: 'TKGM_PARCEL_NOT_FOUND',
          status: 404,
          message: msg,
          detail: errorData
        } as TkgmError;
      }
      
      if (!response.ok) {
        throw {
          type: 'TKGM_ERROR',
          status: response.status,
          message: `HTTP ${response.status}`
        } as TkgmError;
      }
      
      const data = await response.json();
      
      // Veri doğrulama
      if (!data || !data.geometry || !data.properties) {
        throw {
          type: 'TKGM_INVALID_DATA',
          message: 'Geçersiz veri formatı'
        } as TkgmError;
      }
      
      return data;
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // AbortController abort (timeout) - fallback yap
      if (error.name === 'AbortError') {
        throw {
          type: 'TIMEOUT',
          message: 'TKGM API zaman aşımı'
        } as TkgmError;
      }
      
      // CORS hatası veya network hatası - fallback yap
      if (error.name === 'TypeError' || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw {
          type: 'CORS_OR_NETWORK_ERROR',
          message: 'CORS veya network hatası',
          originalError: error
        } as TkgmError;
      }
      
      // Zaten işlenmiş hata (PARCEL_NOT_FOUND, vb.)
      if (error.type) {
        throw error;
      }
      
      // Diğer hatalar
      throw {
        type: 'UNKNOWN_ERROR',
        message: error.message || 'Bilinmeyen hata',
        originalError: error
      } as TkgmError;
    }
  } catch (error: any) {
    // Parsel bulunamadı durumu - direkt fırlat (fallback yapma)
    if (error.type === 'TKGM_PARCEL_NOT_FOUND') {
      throw error;
    }
    
    // Diğer hatalar için backend'e fallback
    try {
      const response = await fetch(`${backendUrl}/api/tkgm_view/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
        signal: signal
      });
      
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        const code = json?.code || json?.error_code || json?.errorCode;
        const msg = json?.error || json?.Message || json?.message || json?.detail || '';
        
        if (response.status === 404 && (code === 'TKGM_PARCEL_NOT_FOUND' || msg.includes('Parsel Bulunamadı'))) {
          throw {
            type: 'TKGM_PARCEL_NOT_FOUND',
            status: 404,
            message: msg || 'Parsel Bulunamadı',
            detail: json?.detail
          } as TkgmError;
        }
        
        throw new Error(msg || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error || !data?.properties || !data?.geometry) {
        throw new Error(data.error || 'Geçersiz veri');
      }
      
      return data;
    } catch (fallbackError) {
      // Fallback de başarısız oldu - orijinal hatayı fırlat
      throw error;
    }
  }
}
