/**
 * Canonical env -> android/gradle.properties (local Android/AAB build).
 */
const fs = require("fs");
const path = require("path");
const { DOWNLOAD_TOKEN_KEY, printMapboxTokenStatus } = require("./mapbox-token-config");

const GRADLE_PROPS = path.join(__dirname, "..", "android", "gradle.properties");

function main() {
  const strict = process.argv.includes("--strict");
  const status = printMapboxTokenStatus({ requirePublic: false, requireDownload: strict });
  if (status.errors.length) {
    process.exit(1);
  }
  if (!status.validDownload) {
    console.warn("[sync-android-mapbox] sk.* token yok; local dev build uyarip devam eder.");
    console.warn("[sync-android-mapbox] Google Play/AAB icin: node ./scripts/sync-android-mapbox-token.js --strict");
    return;
  }
  if (!fs.existsSync(GRADLE_PROPS)) {
    console.log("[sync-android-mapbox] android/gradle.properties yok (prebuild sonrasi tekrar calistirin).");
    return;
  }
  let text = fs.readFileSync(GRADLE_PROPS, "utf8");
  const line = `MAPBOX_DOWNLOADS_TOKEN=${status.downloadToken}`;
  if (/^MAPBOX_DOWNLOADS_TOKEN=/m.test(text)) {
    text = text.replace(/^MAPBOX_DOWNLOADS_TOKEN=.*$/m, line);
  } else {
    text = text.trimEnd() + "\n" + line + "\n";
  }
  fs.writeFileSync(GRADLE_PROPS, text, "utf8");
  console.log(`[sync-android-mapbox] android/gradle.properties guncellendi (${DOWNLOAD_TOKEN_KEY}).`);
}

main();
