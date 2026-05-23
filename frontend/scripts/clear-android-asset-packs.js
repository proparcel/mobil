/**
 * Clear Play Asset Delivery packs for a models-free release build.
 *
 * - Empties android/asset-packs/asset-packs.gradle (ppAssetPacks = [])
 * - Empties android/asset-packs/generated-settings.gradle
 * - Removes .glb files under android/asset-packs/pp_model_* / ... / assets/models/
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packsRoot = path.join(projectRoot, "android", "asset-packs");

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

function removeGlbFilesUnderPacks() {
  if (!exists(packsRoot)) return 0;
  let removed = 0;
  const entries = fs.readdirSync(packsRoot, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory() || !ent.name.startsWith("pp_model_")) continue;
    const modelsDir = path.join(packsRoot, ent.name, "src", "main", "assets", "models");
    if (!exists(modelsDir)) continue;
    for (const name of fs.readdirSync(modelsDir)) {
      if (!name.toLowerCase().endsWith(".glb")) continue;
      const file = path.join(modelsDir, name);
      try {
        fs.unlinkSync(file);
        removed += 1;
        console.warn(`[clear:android-asset-packs] removed ${path.relative(projectRoot, file)}`);
      } catch (e) {
        console.error(`[clear:android-asset-packs] failed to remove ${file}:`, e?.message || e);
      }
    }
  }
  return removed;
}

function main() {
  if (!exists(path.join(projectRoot, "android"))) {
    throw new Error(`missing android folder: ${path.join(projectRoot, "android")}`);
  }

  ensureDir(packsRoot);

  const assetPacksGradle = path.join(packsRoot, "asset-packs.gradle");
  fs.writeFileSync(
    assetPacksGradle,
    "// AUTO-GENERATED (cleared for no-models release). DO NOT EDIT.\n" +
      "rootProject.ext.ppAssetPacks = [\n]\n",
    "utf8"
  );

  const generatedSettings = path.join(packsRoot, "generated-settings.gradle");
  fs.writeFileSync(generatedSettings, "// AUTO-GENERATED (cleared for no-models release). DO NOT EDIT.\n", "utf8");

  const removed = removeGlbFilesUnderPacks();

  console.warn(`[clear:android-asset-packs] wrote empty ${path.relative(projectRoot, assetPacksGradle)}`);
  console.warn(`[clear:android-asset-packs] wrote empty ${path.relative(projectRoot, generatedSettings)}`);
  console.warn(`[clear:android-asset-packs] removed ${removed} .glb file(s) from asset-packs`);
}

main();
