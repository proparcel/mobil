// Street View — .env: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
import { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as DOTENV_GOOGLE_KEY } from "@env";

function readGoogleMapsKey(): string {
  const fromProcess = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (fromProcess) return fromProcess;
  const fromDotenv = (DOTENV_GOOGLE_KEY || "").trim();
  if (fromDotenv) return fromDotenv;
  return "";
}

export const GOOGLE_MAPS_API_KEY = readGoogleMapsKey();
