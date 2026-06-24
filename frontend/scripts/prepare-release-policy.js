/**
 * AAB/IPA yayını öncesi güncelleme politikasını üretir.
 *
 * Kullanım:
 *   node ./scripts/prepare-release-policy.js --optional
 *   node ./scripts/prepare-release-policy.js --force
 *   node ./scripts/prepare-release-policy.js   (interaktif soru)
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const root = path.join(__dirname, "..");

function loadAppConfig() {
  delete require.cache[require.resolve(path.join(root, "app.config.js"))];
  return require(path.join(root, "app.config.js"));
}

function parseModeArg() {
  if (process.argv.includes("--force")) return "force";
  if (process.argv.includes("--optional")) return "optional";
  return null;
}

function loadExistingPolicy() {
  const serverDefault = path.join(root, "config", "app_version_policy.default.json");
  if (fs.existsSync(serverDefault)) {
    return JSON.parse(fs.readFileSync(serverDefault, "utf8"));
  }
  return {
    ios: { min_version: "0.0.0", latest_version: "0.0.0" },
    android: { min_version: "0.0.0", min_build: 0, latest_version: "0.0.0", latest_build: 0 },
  };
}

async function promptUpdateMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    console.log("");
    console.log("Guncelleme tipi secin:");
    console.log("  [1] Zorunlu  - bu surumun altindakiler uygulamayi acamaz");
    console.log("  [2] Istege bagli - sadece bilgi verilir (varsayilan)");
    rl.question("Secim (1/2) [2]: ", (value) => resolve((value || "2").trim()));
  });
  rl.close();
  return answer === "1" ? "force" : "optional";
}

async function main() {
  const appConfig = loadAppConfig();
  const version = String(appConfig.version || appConfig.expo?.version || "0.0.0");
  const versionCode = Number(appConfig.expo?.android?.versionCode || 0);
  const buildNumber = Number(appConfig.expo?.ios?.buildNumber || 0);

  let mode = parseModeArg();
  if (!mode) {
    mode = process.stdin.isTTY ? await promptUpdateMode() : "optional";
  }

  const existing = loadExistingPolicy();
  const policy = {
    version,
    versionCode,
    buildNumber,
    updateMode: mode,
    builtAt: new Date().toISOString(),
    ios: {
      min_version: mode === "force" ? version : existing.ios?.min_version || "0.0.0",
      latest_version: version,
      force_message:
        existing.ios?.force_message ||
        "Güvenlik veya uyumluluk nedeniyle uygulamayı güncellemeniz gerekiyor.",
      optional_message:
        existing.ios?.optional_message || "Yeni sürüm mevcut. Güncellemek ister misiniz?",
    },
    android: {
      min_version: mode === "force" ? version : existing.android?.min_version || "0.0.0",
      min_build: mode === "force" ? versionCode : Number(existing.android?.min_build || 0),
      latest_version: version,
      latest_build: versionCode,
      force_message:
        existing.android?.force_message ||
        "Güvenlik veya uyumluluk nedeniyle uygulamayı güncellemeniz gerekiyor.",
      optional_message:
        existing.android?.optional_message || "Yeni sürüm mevcut. Güncellemek ister misiniz?",
    },
  };

  const outDir = path.join(root, "release_builds");
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, `ProParcel-${version}-policy.json`);
  fs.writeFileSync(dest, JSON.stringify(policy, null, 2), "utf8");

  console.log("[prepare-release-policy] Tamam");
  console.log("  Mod:", mode === "force" ? "ZORUNLU" : "ISTEGE_BAGLI");
  console.log("  Surum:", version, `(versionCode=${versionCode})`);
  console.log("  Policy:", dest);
  if (mode === "force") {
    console.log("  UYARI: Play onayindan sonra deploy edin: npm run deploy:release-policy");
  }
}

main().catch((err) => {
  console.error("[prepare-release-policy] Hata:", err);
  process.exit(1);
});
