const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const TERRAIN_NATIVE = "modules/parcelTerrain3d/native";
const TERRAIN_ANDROID_RES = "modules/parcelTerrain3d/native/androidRes";

function resolveIosProjectName(cfg) {
  return cfg.modRequest.projectName || cfg.name || "ProParcel";
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(from, to);
    else fs.copyFileSync(from, to);
  }
}

function ensureAndroidTerrainNative(projectRoot, androidRoot) {
  const src = path.join(projectRoot, TERRAIN_NATIVE, "android");
  const dest = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    "com",
    "proparcel",
    "mobile",
    "parcelterrain3d",
  );
  if (!fs.existsSync(src)) return;
  copyDirSync(src, dest);

  ensureAndroidTerrainResources(projectRoot, androidRoot);
  ensureAndroidManifestTerrainActivity(androidRoot);

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
    if (!text.includes("TerrainUnityPackage")) {
      if (!text.includes("import com.proparcel.mobile.parcelterrain3d.TerrainUnityPackage")) {
        text = text.replace(
          /^package com\.proparcel\.mobile/m,
          "package com.proparcel.mobile\n\nimport com.proparcel.mobile.parcelterrain3d.TerrainUnityPackage",
        );
      }
      text = text.replace(
        /PackageList\(this\)\.packages\.apply \{/,
        "PackageList(this).packages.apply {\n              add(TerrainUnityPackage())",
      );
      fs.writeFileSync(mainAppPath, text);
    }
  }
}

function ensureAndroidTerrainResources(projectRoot, androidRoot) {
  // TerrainUnityActivity drawable kaynaklari (R.drawable.terrain_*). Prebuild android/ klasorunu
  // yeniden uretse de bu kopyalama sayesinde drawable'lar tekrar yerine konur.
  const src = path.join(projectRoot, TERRAIN_ANDROID_RES);
  const dest = path.join(androidRoot, "app", "src", "main", "res");
  if (!fs.existsSync(src)) return;
  copyDirSync(src, dest);
}

function ensureAndroidManifestTerrainActivity(androidRoot) {
  const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
  if (!fs.existsSync(manifestPath)) return;
  let manifest = fs.readFileSync(manifestPath, "utf8");
  if (manifest.includes("TerrainUnityActivity")) return;
  const activityBlock = `
    <activity
        android:name=".parcelterrain3d.TerrainUnityActivity"
        android:exported="false"
        android:theme="@style/AppTheme"
        android:launchMode="standard"
        android:parentActivityName=".MainActivity"
        android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode"
        android:screenOrientation="portrait" />`;
  manifest = manifest.replace("</application>", `${activityBlock}\n  </application>`);
  fs.writeFileSync(manifestPath, manifest);
}

function ensureIosTerrainNative(projectRoot, iosRoot, projectName) {
  const src = path.join(projectRoot, TERRAIN_NATIVE, "ios");
  const dest = path.join(iosRoot, projectName, "ParcelTerrain3d");
  if (!fs.existsSync(src)) return;
  copyDirSync(src, dest);
}

module.exports = function withParcelTerrain3dNativeModules(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      ensureAndroidTerrainNative(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectName = resolveIosProjectName(cfg);
      ensureIosTerrainNative(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot, projectName);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const iosRoot = cfg.modRequest.platformProjectRoot;
    const projectName = resolveIosProjectName(cfg);
    const relDir = `${projectName}/ParcelTerrain3d`;
    const absDir = path.join(iosRoot, projectName, "ParcelTerrain3d");
    if (!fs.existsSync(absDir)) return cfg;

    const files = [
      "TerrainUnityModule.swift",
      "TerrainUnityModule.m",
      "TerrainUnityViewManager.swift",
      "TerrainUnityViewManager.m",
    ];
    const existing = files.filter((f) => fs.existsSync(path.join(absDir, f)));
    if (existing.length === 0) return cfg;

    const targetUuid = project.getFirstTarget().uuid;
    const groupKey = project.pbxCreateGroup("ParcelTerrain3d", relDir);

    for (const file of existing) {
      const filePath = `${relDir}/${file}`;
      if (project.hasFile(filePath)) continue;
      project.addSourceFile(filePath, { target: targetUuid }, groupKey);
    }

    return cfg;
  });

  return config;
};
