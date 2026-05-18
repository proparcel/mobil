/**
 * Copy model GLB files from asset-packs into the app so they are embedded in the APK (no download).
 * Run after: npm run gen:android-asset-packs
 *
 * Outputs:
 * - android/app/src/main/assets/models/model_<id>.glb  (her build'de APK'da, indirme yok)
 * - android/app/src/debug/assets/models/model_<id>.glb (debug variant override, isteğe bağlı)
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "assets", "packs", "models_manifest.json");
const packsRoot = path.join(projectRoot, "android", "asset-packs");
const mainAssetsModels = path.join(projectRoot, "android", "app", "src", "main", "assets", "models");
const debugAssetsModels = path.join(projectRoot, "android", "app", "src", "debug", "assets", "models");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!exists(manifestPath)) {
    console.warn("[copy-models-to-app-assets] No manifest, skip:", manifestPath);
    return;
  }
  const manifest = readJson(manifestPath);
  const models = Array.isArray(manifest?.models) ? manifest.models : [];
  ensureDir(mainAssetsModels);
  ensureDir(debugAssetsModels);

  let copied = 0;
  let skipped = 0;
  for (const m of models) {
    const id = Number(m?.id);
    if (!Number.isFinite(id)) continue;
    const packName = `pp_model_${id}`;
    const src = path.join(packsRoot, packName, "src", "main", "assets", "models", `model_${id}.glb`);
    if (!exists(src)) {
      console.warn("[copy-models-to-app-assets] skip id=" + id + " (missing: " + src + ")");
      skipped++;
      continue;
    }
    const destMain = path.join(mainAssetsModels, `model_${id}.glb`);
    const destDebug = path.join(debugAssetsModels, `model_${id}.glb`);
    fs.copyFileSync(src, destMain);
    fs.copyFileSync(src, destDebug);
    copied++;
  }
  console.warn("[copy-models-to-app-assets] done: " + copied + " models -> main + debug assets (APK'ya gömüldü, indirme yok)");
}

main();
