/**
 * Kalici signing/ dosyalarini android/ altina kopyalar (prebuild --clean sonrasi).
 * Kaynak: frontend/signing/
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const signingDir = path.join(root, "signing");
const keystoreSrc = path.join(signingDir, "proparcel-release.keystore");
const propsSrc = path.join(signingDir, "keystore.properties");
const androidRoot = path.join(root, "android");
const keystoreDestDir = path.join(androidRoot, "keystores");
const keystoreDest = path.join(keystoreDestDir, "proparcel-release.keystore");
const propsDest = path.join(androidRoot, "app", "keystore.properties");

function main() {
  if (!fs.existsSync(androidRoot)) {
    console.error("[sync-release-keystore] android/ yok. Once: npm run android:setup");
    process.exit(1);
  }
  if (!fs.existsSync(keystoreSrc) || !fs.existsSync(propsSrc)) {
    console.error("[sync-release-keystore] Release keystore bulunamadi.");
    console.error("  Beklenen:");
    console.error("    signing/proparcel-release.keystore");
    console.error("    signing/keystore.properties");
    console.error("  Not: android/ gitignore + prebuild --clean ile silinir; dosyalari signing/ altinda tutun.");
    process.exit(1);
  }

  fs.mkdirSync(keystoreDestDir, { recursive: true });
  fs.copyFileSync(keystoreSrc, keystoreDest);
  fs.copyFileSync(propsSrc, propsDest);

  let props = fs.readFileSync(propsDest, "utf8");
  if (!props.includes("storeFile=")) {
    console.error("[sync-release-keystore] keystore.properties gecersiz (storeFile yok).");
    process.exit(1);
  }
  if (props.includes("../keystores/")) {
    // android/app/ icinden goreli yol
  } else if (props.includes("keystores/")) {
    props = props.replace(/storeFile\s*=\s*.+/, "storeFile=../keystores/proparcel-release.keystore");
    fs.writeFileSync(propsDest, props, "utf8");
  }

  console.log("[sync-release-keystore] Tamam");
  console.log("  Keystore:", keystoreDest);
  console.log("  Properties:", propsDest);
}

main();
