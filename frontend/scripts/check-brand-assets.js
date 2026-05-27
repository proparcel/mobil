/**
 * EAS oncesi: icon / favicon dosyalari var mi?
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const required = ["icon.png", "favicon.png", "adaptive-icon.png", "splash-icon.png"];
let ok = true;
for (const f of required) {
  const p = path.join(root, "assets", "images", f);
  if (!fs.existsSync(p)) {
    console.error("[check-brand-assets] Eksik:", p);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log("[check-brand-assets] OK:", required.join(", "));
