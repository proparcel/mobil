// Mapbox public token — .env: EXPO_PUBLIC_MAPBOX_TOKEN=pk....
// pk token client-side'dir; URL kısıtlaması Mapbox panelinden yapılır.
import { EXPO_PUBLIC_MAPBOX_TOKEN as DOTENV_MAPBOX_TOKEN } from "@env";

function readToken(): string {
  const fromProcess = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim();
  if (fromProcess) return fromProcess;
  const fromDotenv = (DOTENV_MAPBOX_TOKEN || "").trim();
  if (fromDotenv) return fromDotenv;
  return "";
}

export const MAPBOX_ACCESS_TOKEN = readToken();

if (__DEV__ && !MAPBOX_ACCESS_TOKEN) {
  console.warn(
    "[mapbox] Token bos. frontend/.env icinde EXPO_PUBLIC_MAPBOX_TOKEN=pk... tanimlayin ve Metro'yu --reset-cache ile yeniden baslatin.",
  );
}
