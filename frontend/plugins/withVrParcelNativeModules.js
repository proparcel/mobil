const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const VR_NATIVE = "modules/vrParcel/native";

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

function ensureAndroidVrNative(projectRoot, androidRoot) {
  const src = path.join(projectRoot, VR_NATIVE, "android");
  const dest = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    "com",
    "proparcel",
    "mobile",
    "vrparcel",
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
    if (!text.includes("VrArCapabilitiesPackage")) {
      if (!text.includes("import com.proparcel.mobile.vrparcel.VrArCapabilitiesPackage")) {
        text = text.replace(
          /^package com\.proparcel\.mobile/m,
          "package com.proparcel.mobile\n\nimport com.proparcel.mobile.vrparcel.VrArCapabilitiesPackage",
        );
      }
      text = text.replace(
        /PackageList\(this\)\.packages\.apply \{/,
        "PackageList(this).packages.apply {\n              add(VrArCapabilitiesPackage())",
      );
      fs.writeFileSync(mainAppPath, text);
    }
  }

  const appGradle = path.join(androidRoot, "app", "build.gradle");
  if (fs.existsSync(appGradle)) {
    let gradle = fs.readFileSync(appGradle, "utf8");
    // Unity export arcore_client icerir; app'e ayri com.google.ar:core eklemek manifest birlestirmeyi bozar.
    // VrArCapabilitiesModule reflection kullanir — compileOnly/implementation gerekmez.
    if (gradle.includes("com.google.ar:core")) {
      gradle = gradle.replace(/\n\s*(compileOnly|implementation) 'com\.google\.ar:core:[^']+'/g, "");
      fs.writeFileSync(appGradle, gradle);
    }
  }

  const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
  if (fs.existsSync(manifestPath)) {
    let manifest = fs.readFileSync(manifestPath, "utf8");
    const arCoreMeta =
      '<meta-data android:name="com.google.ar.core" android:value="required" tools:replace="android:value"/>';
    if (manifest.includes('android:name="com.google.ar.core"')) {
      manifest = manifest.replace(
        /<meta-data android:name="com\.google\.ar\.core" android:value="[^"]*"[^/]*\/>/,
        arCoreMeta,
      );
    } else {
      manifest = manifest.replace(/<application([^>]*)>/, `<application$1>\n    ${arCoreMeta}`);
    }
    // min_apk_version: Unity arcore_client ile cakismasin diye app modulune ayri com.google.ar:core eklenmez.
    fs.writeFileSync(manifestPath, manifest);
  }
}

function ensureIosVrNative(projectRoot, iosRoot, projectName) {
  const src = path.join(projectRoot, VR_NATIVE, "ios");
  const dest = path.join(iosRoot, projectName, "VrParcel");
  if (!fs.existsSync(src)) return;
  copyDirSync(src, dest);
}

module.exports = function withVrParcelNativeModules(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      ensureAndroidVrNative(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectName = resolveIosProjectName(cfg);
      ensureIosVrNative(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot, projectName);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const iosRoot = cfg.modRequest.platformProjectRoot;
    const projectName = resolveIosProjectName(cfg);
    const vrRelDir = `${projectName}/VrParcel`;
    const vrDir = path.join(iosRoot, projectName, "VrParcel");
    if (!fs.existsSync(vrDir)) return cfg;

    const files = [
      "VrArCapabilitiesModule.swift",
      "VrArCapabilitiesModule.m",
      "VrUnityHost.swift",
      "VrUnityEmitBridge.swift",
      "VrUnityModule.swift",
      "VrUnityModule.m",
      "VrUnityEventEmitter.m",
      "VrUnityViewManager.swift",
      "VrUnityViewManager.m",
      "VrParcelNativeEmit.m",
      "VrParcelNativeEmit.h",
    ];
    const existing = files.filter((f) => fs.existsSync(path.join(vrDir, f)));
    if (existing.length === 0) return cfg;

    const targetUuid = project.getFirstTarget().uuid;
    const groupKey = project.pbxCreateGroup("VrParcel", vrRelDir);

    for (const file of existing) {
      const filePath = `${vrRelDir}/${file}`;
      if (project.hasFile(filePath)) continue;
      project.addSourceFile(filePath, { target: targetUuid }, groupKey);
    }

    return cfg;
  });

  return config;
};
