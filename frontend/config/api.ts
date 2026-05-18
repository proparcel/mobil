/**
 * Backend API URL çözümlemesi
 *
 * "Network request failed" alıyorsanız: cihaz/emülatör bu URL'ye ulaşamıyor.
 * - Production: http://78.189.238.18:8000 (varsayılan)
 * - Android emülatör + Django bilgisayarda: API_URL=http://10.0.2.2:8000
 * - iOS simülatör + Django bilgisayarda: API_URL=http://127.0.0.1:8000
 * - Android gerçek cihaz + Django 0.0.0.0:8000 (aynı WiFi):
 *   Bilgisayarın yerel IP'sini kullanın (0.0.0.0 değil!). Örn: .env içinde
 *   API_URL=http://192.168.1.101:8000  (IP'yi ipconfig / ifconfig ile öğrenin)
 *
 * Environment variable'lar (öncelik sırasına göre):
 * - API_URL: Ana API base URL (varsa bu kullanılır, yoksa DEFAULT_API_URL)
 * - MODELS_URL: Model dosyaları için base URL
 * - NGROK_URL: Fallback API base URL
 */

// Default URL'ler - Production sunucu
// Production IP: 78.189.238.18
// Android emülatör için: 10.0.2.2 (local development)
// Gerçek cihaz için: 78.189.238.18 (production) veya Local network IP (local development)
const DEFAULT_API_URL = 'http://78.189.238.18:8000'; // Production Django backend
const DEFAULT_MODELS_URL = 'http://78.189.238.18:8000'; // Production Django backend

/**
 * Ana API base URL
 * - Öncelik: API_URL -> DEFAULT_API_URL
 */
const envApiUrl = process.env.API_URL?.trim();
export const API_URL: string = envApiUrl || DEFAULT_API_URL;

// Debug log
if (__DEV__) {
  console.log("[config/api] API_URL çözümlendi:", {
    apiUrl: process.env.API_URL,
    defaultUrl: DEFAULT_API_URL,
    final: API_URL
  });
}

/**
 * Model dosyaları için base URL
 * - Öncelik: MODELS_URL -> DEFAULT_MODELS_URL
 *
 * Not:
 * - Model dosyaları Django'dan servis edilir (8000 portu)
 */
const envModelsUrl = process.env.MODELS_URL?.trim();
export const MODELS_URL: string = envModelsUrl || DEFAULT_MODELS_URL;

// Debug log
if (__DEV__) {
  console.log("[config/api] MODELS_URL çözümlendi:", {
    modelsUrl: process.env.MODELS_URL,
    defaultUrl: DEFAULT_MODELS_URL,
    final: MODELS_URL
  });
}

/**
 * Fallback API base URL
 * - Öncelik: NGROK_URL -> DEFAULT_API_URL
 */
export const FALLBACK_API_URL: string =
  process.env.NGROK_URL?.trim() || DEFAULT_API_URL;
