/**
 * Sunucudan guncel .glb indirmek icin eski PAD pack klasorlerini siler,
 * ardindan gen:android-asset-packs calistirir.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const packsRoot = path.join(projectRoot, "android", "asset-packs");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function removeOldPackDirs() {
  if (!exists(packsRoot)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(packsRoot)) {
    if (!name.startsWith("pp_model_")) continue;
    const dir = path.join(packsRoot, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    removed += 1;
    console.warn(`[refresh:android-asset-packs] removed ${path.relative(projectRoot, dir)}`);
  }
  return removed;
}

function main() {
  if (!exists(path.join(projectRoot, "android"))) {
    throw new Error("android/ yok. Once npm run prebuild:android calistirin.");
  }
  const removed = removeOldPackDirs();
  console.warn(`[refresh:android-asset-packs] cleared ${removed} pack dir(s)`);

  const res = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "gen:android-asset-packs"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  });
  process.exit(res.status ?? 1);
}

main();
