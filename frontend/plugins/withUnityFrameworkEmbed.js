const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const UNITY_EXPORT_REL = path.join("..", "unity", "vrParcel", "builds", "ios");
const FRAMEWORK_NAME = "UnityFramework.framework";
const DATA_DIR_NAME = "UnityData";

function resolveUnityExportRoot(projectRoot) {
  return path.resolve(projectRoot, UNITY_EXPORT_REL);
}

function unityExportReady(projectRoot) {
  const exportRoot = resolveUnityExportRoot(projectRoot);
  return fs.existsSync(path.join(exportRoot, FRAMEWORK_NAME));
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function syncUnityArtifacts(projectRoot, iosRoot) {
  const exportRoot = resolveUnityExportRoot(projectRoot);
  const frameworksDir = path.join(iosRoot, "Frameworks");
  const dataDest = path.join(iosRoot, DATA_DIR_NAME);

  fs.mkdirSync(frameworksDir, { recursive: true });
  copyRecursiveSync(path.join(exportRoot, FRAMEWORK_NAME), path.join(frameworksDir, FRAMEWORK_NAME));

  const dataSrc = path.join(exportRoot, "Data");
  if (fs.existsSync(dataSrc)) {
    if (fs.existsSync(dataDest)) {
      fs.rmSync(dataDest, { recursive: true, force: true });
    }
    copyRecursiveSync(dataSrc, dataDest);
  }
}

function appendBuildSetting(buildSettings, key, value) {
  const current = buildSettings[key];
  if (Array.isArray(current)) {
    if (!current.includes(value)) current.push(value);
    return;
  }
  if (typeof current === "string") {
    if (current.includes(value)) return;
    buildSettings[key] = [current, value];
    return;
  }
  buildSettings[key] = ["$(inherited)", value];
}

function patchXcodeForUnity(cfg) {
  const projectRoot = cfg.modRequest.projectRoot;
  if (!unityExportReady(projectRoot)) {
    console.warn(
      `[withUnityFrameworkEmbed] Unity export bulunamadi (${UNITY_EXPORT_REL}). ` +
        "VR_UNITY_LINKED ve embed atlandi. Mac'te Unity export sonrasi prebuild tekrar calistirin.",
    );
    return cfg;
  }

  const project = cfg.modResults;
  const iosRoot = cfg.modRequest.platformProjectRoot;
  const frameworkRel = "Frameworks/UnityFramework.framework";
  const frameworkAbs = path.join(iosRoot, frameworkRel);

  if (!fs.existsSync(frameworkAbs)) {
    console.warn("[withUnityFrameworkEmbed] UnityFramework.framework ios/Frameworks icinde yok.");
    return cfg;
  }

  const targetUuid = project.getFirstTarget().uuid;
  project.addFramework(frameworkRel, {
    customFramework: true,
    embed: true,
    sign: true,
    link: true,
  });

  const copyDataPhase = project.addBuildPhase(
    [],
    "PBXShellScriptBuildPhase",
    "Copy Unity Data",
    targetUuid,
  );
  if (copyDataPhase) {
    const phase = project.hash.project.objects.PBXShellScriptBuildPhase[copyDataPhase.uuid];
    phase.shellPath = "/bin/sh";
    phase.shellScript = JSON.stringify(
      [
        'UNITY_DATA="${SRCROOT}/UnityData"',
        'if [ -d "$UNITY_DATA" ]; then',
        '  DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/Data"',
        '  rm -rf "$DEST"',
        '  cp -R "$UNITY_DATA" "$DEST"',
        "fi",
      ].join("\n"),
    );
    phase.runOnlyForDeploymentPostprocessing = 0;
  }

  const configurations = project.pbxXCBuildConfigurationSection();
  for (const configUuid of Object.keys(configurations)) {
    const item = configurations[configUuid];
    if (!item || !item.buildSettings) continue;
    const settings = item.buildSettings;
    const productName = settings.PRODUCT_NAME;
    if (!productName || productName.includes("Tests")) continue;

    appendBuildSetting(settings, "SWIFT_ACTIVE_COMPILATION_CONDITIONS", "VR_UNITY_LINKED");
    appendBuildSetting(settings, "GCC_PREPROCESSOR_DEFINITIONS", "VR_UNITY_LINKED=1");
    appendBuildSetting(settings, "FRAMEWORK_SEARCH_PATHS", "$(PROJECT_DIR)/Frameworks");
    appendBuildSetting(settings, "OTHER_LDFLAGS", "-framework UnityFramework");
  }

  console.log("[withUnityFrameworkEmbed] UnityFramework embed + VR_UNITY_LINKED uygulandi.");
  return cfg;
}

module.exports = function withUnityFrameworkEmbed(config) {
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      if (!unityExportReady(projectRoot)) return cfg;
      syncUnityArtifacts(projectRoot, iosRoot);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, patchXcodeForUnity);
  return config;
};

module.exports.UNITY_EXPORT_REL = UNITY_EXPORT_REL;
module.exports.unityExportReady = unityExportReady;
