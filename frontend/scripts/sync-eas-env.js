/**
 * Canonical env -> eas.json build profillerinin public env bloklari.
 *
 * Not: Mapbox sk.* download token repo icindeki eas.json'a yazilmaz.
 * Cloud EAS icin RNMAPBOX_MAPS_DOWNLOAD_TOKEN bir EAS secret/env olarak tanimli olmalidir.
 * Calistirma: node scripts/sync-eas-env.js (eas build oncesi npm script ile otomatik).
 */
const fs = require("fs");
const path = require("path");
const { loadEnvFile } = require("./load-env-file");
const { printMapboxTokenStatus } = require("./mapbox-token-config");

const ROOT = path.join(__dirname, "..");
const EAS_PATH = path.join(ROOT, "eas.json");

const KEYS_FROM_DOTENV = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_AUTH_API_URL",
  "EXPO_PUBLIC_MODELS_URL",
  "EXPO_PUBLIC_DJANGO_API_URL",
  "EXPO_PUBLIC_MAPBOX_TOKEN",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
  "EXPO_PUBLIC_NGROK_URL",
];

const PROFILE_NAMES = [
  "development",
  "development-simulator",
  "preview",
  "production",
];

function main() {
  const dot = loadEnvFile();
  printMapboxTokenStatus({ requirePublic: true, requireDownload: false });
  if (!fs.existsSync(EAS_PATH)) {
    console.error("[sync-eas-env] eas.json bulunamadi:", EAS_PATH);
    process.exit(1);
  }
  const eas = JSON.parse(fs.readFileSync(EAS_PATH, "utf8"));
  const inject = {};
  for (const key of KEYS_FROM_DOTENV) {
    const v = dot[key];
    if (v) inject[key] = v;
  }
  if (Object.keys(inject).length === 0) {
    console.warn("[sync-eas-env] .env bos veya anahtar yok; eas.json degismedi.");
    return;
  }
  for (const name of PROFILE_NAMES) {
    const profile = eas.build?.[name];
    if (!profile) continue;
    profile.env = { ...(profile.env || {}), ...inject };
  }
  fs.writeFileSync(EAS_PATH, JSON.stringify(eas, null, 2) + "\n", "utf8");
  console.log("[sync-eas-env] eas.json guncellendi:", Object.keys(inject).join(", "));
  console.log("[sync-eas-env] RNMAPBOX_MAPS_DOWNLOAD_TOKEN secret kalir; eas.json'a yazilmaz.");
}

main();
