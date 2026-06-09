const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const SMOKE_NATIVE = "modules/unitySmokeTest/native";

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(from, to);
    else fs.copyFileSync(from, to);
  }
}

function ensureAndroidSmokeNative(projectRoot, androidRoot) {
  const src = path.join(projectRoot, SMOKE_NATIVE, "android");
  const dest = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    "com",
    "proparcel",
    "mobile",
    "unitysmoketest",
  );
  if (!fs.existsSync(src)) return;
  copyDirSync(src, dest);

  const mainAppPath = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    "com",
    "proparcel",
    "mobile",
    "MainApplication.kt",
  );
  if (fs.existsSync(mainAppPath)) {
    let text = fs.readFileSync(mainAppPath, "utf8");
    if (!text.includes("UnitySmokeTestPackage")) {
      if (!text.includes("import com.proparcel.mobile.unitysmoketest.UnitySmokeTestPackage")) {
        text = text.replace(
          /^package com\.proparcel\.mobile/m,
          "package com.proparcel.mobile\n\nimport com.proparcel.mobile.unitysmoketest.UnitySmokeTestPackage",
        );
      }
      text = text.replace(
        /PackageList\(this\)\.packages\.apply \{/,
        "PackageList(this).packages.apply {\n              add(UnitySmokeTestPackage())",
      );
      fs.writeFileSync(mainAppPath, text);
    }
  }
}

module.exports = function withUnitySmokeTestNativeModules(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      ensureAndroidSmokeNative(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
};
