/**
 * bundleRelease sonrası AAB'yi release_builds/ altına kopyalar.
 * Kullanım: node ./scripts/copy-release-aab.js [--variant=no-models|with-models]
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "android", "app", "build", "outputs", "bundle", "release", "app-release.aab");

const variantArg = process.argv.find((a) => a.startsWith("--variant="));
const variant = variantArg?.split("=")[1] === "with-models" ? "with-models" : "no-models";

let version = "1.0.7";
let packageName = "com-proparcel-mobile";
try {
  const appConfig = require(path.join(root, "app.config.js"));
  if (appConfig?.version) version = String(appConfig.version);
  const androidPackage = appConfig?.expo?.android?.package || appConfig?.android?.package;
  if (androidPackage) packageName = String(androidPackage).replace(/\./g, "-");
} catch {
  /* fallback */
}

if (!fs.existsSync(src)) {
  console.error("[copy-release-aab] AAB bulunamadi:", src);
  console.error("[copy-release-aab] Once: npm run build:bundle:no-models (gradle kismi) calistirin.");
  process.exit(1);
}

const outDir = path.join(root, "release_builds");
fs.mkdirSync(outDir, { recursive: true });

const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const destName = `ProParcel-${version}-${packageName}-${variant}-${timestamp}.aab`;
const dest = path.join(outDir, destName);

fs.copyFileSync(src, dest);
const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);

console.log("[copy-release-aab] Tamam");
console.log("  Hedef:", dest);
console.log("  Boyut:", `${sizeMb} MB`);
console.log("  Kaynak:", src);
