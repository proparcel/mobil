/**
 * Backend API URL çözümlemesi
 *
 * Mobil uygulama MongoDB'ye doğrudan bağlanmaz.
 * Sunucu (178.210.168.33) üzerindeki Django API → MongoDB'ye backend tarafında erişir.
 *
 * Production: https://www.proparcel.com
 * Alternatif (doğrudan IP): http://178.210.168.33:8000
 * Not: 33789 SQL Server portudur; mobil API portu değildir.
 *
 * .env (Metro: npm run start -- --reset-cache):
 *   EXPO_PUBLIC_API_URL=https://www.proparcel.com
 *   EXPO_PUBLIC_AUTH_API_URL=https://www.proparcel.com
 *   EXPO_PUBLIC_MODELS_URL=https://www.proparcel.com
 *
 * Yerel geliştirme (adb reverse tcp:8000 tcp:8000):
 *   EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
 */

const PRODUCTION_API_URL = "https://www.proparcel.com";
const LEGACY_API_URL = "http://178.210.168.33:8000";

function pickEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Ana API base URL */
export const API_URL: string =
  pickEnv("EXPO_PUBLIC_API_URL", "API_URL") || PRODUCTION_API_URL;

/** Auth / accounts API (varsayılan: API_URL ile aynı) */
export const AUTH_API_URL: string =
  pickEnv("EXPO_PUBLIC_AUTH_API_URL", "AUTH_API_URL") || API_URL;

/** Django REST (portal, kredi, vitrin vb.) */
export const DJANGO_API_URL: string =
  pickEnv("EXPO_PUBLIC_DJANGO_API_URL", "DJANGO_API_URL") || API_URL;

/** 3D model dosyaları base URL */
export const MODELS_URL: string =
  pickEnv("EXPO_PUBLIC_MODELS_URL", "MODELS_URL") || API_URL;

/** Yedek / ngrok base URL */
export const FALLBACK_API_URL: string =
  pickEnv("EXPO_PUBLIC_NGROK_URL", "NGROK_URL") || LEGACY_API_URL;

if (__DEV__) {
  console.log("[config/api] URL çözümlendi:", {
    API_URL,
    AUTH_API_URL,
    DJANGO_API_URL,
    MODELS_URL,
    FALLBACK_API_URL,
  });
}
