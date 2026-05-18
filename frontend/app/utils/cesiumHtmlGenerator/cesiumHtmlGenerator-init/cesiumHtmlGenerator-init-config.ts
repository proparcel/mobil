/**
 * Cesium HTML Generator - Configuration Setup
 * Global değişkenler ve konfigürasyon ayarları
 */

interface ConfigOptions {
  cesiumIonToken: string;
  googleMapsApiKey: string;
  mapboxAccessToken: string;
  backendUrl: string;
}

/**
 * Configuration JavaScript kodunu oluştur
 * @param options - Configuration options
 * @returns Configuration JavaScript string'i
 */
export function generateConfigScript(options: ConfigOptions): string {
  const { cesiumIonToken, googleMapsApiKey, mapboxAccessToken, backendUrl } = options;

  // Escape values for safe insertion into JavaScript
  const escapedBackendUrl = JSON.stringify(backendUrl);
  
  return `
        // Cesium Ion token
        ${cesiumIonToken ? `window.CESIUM_ION_TOKEN = ${JSON.stringify(cesiumIonToken)};` : ''}
        
        // Google Maps API key
        ${googleMapsApiKey ? `window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(googleMapsApiKey)};` : ''}
        
        // Mapbox Access Token
        ${mapboxAccessToken ? `window.MAPBOX_ACCESS_TOKEN = ${JSON.stringify(mapboxAccessToken)};` : ''}
        
        // Backend URL
        window.BACKEND_URL = ${escapedBackendUrl};
        window.STATIC_URL = ${escapedBackendUrl} + '/static';
        
        console.log('[Cesium] 🔧 Configuration:', {
            backendUrl: window.BACKEND_URL,
            staticUrl: window.STATIC_URL,
            hasMapboxToken: !!window.MAPBOX_ACCESS_TOKEN,
            hasGoogleMapsKey: !!window.GOOGLE_MAPS_API_KEY,
            hasCesiumIonToken: !!window.CESIUM_ION_TOKEN
        });
  `;
}
