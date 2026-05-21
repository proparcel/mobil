// Mapbox public token — set EXPO_PUBLIC_MAPBOX_TOKEN in .env (never commit secrets)
// Ornek: cp .env.example .env  &&  EXPO_PUBLIC_MAPBOX_TOKEN=pk....
export const MAPBOX_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() || "";

if (__DEV__ && !MAPBOX_ACCESS_TOKEN) {
  console.warn(
    "[mapbox] EXPO_PUBLIC_MAPBOX_TOKEN bos. frontend/.env dosyasini .env.example'dan olusturun.",
  );
}
