const fs = require("fs");
const path = require("path");
const { withDangerousMod, withAppBuildGradle, withSettingsGradle } = require("expo/config-plugins");
const { validateUnityArExport } = require("../scripts/validate-unity-export.js");

const UNITY_EXPORT_FROM_FRONTEND = path.join("..", "unity", "vrParcel", "builds", "android", "unityLibrary");
const UNITY_EXPORT_FROM_ANDROID = path.join("..", "..", "unity", "vrParcel", "builds", "android", "unityLibrary");
const UNITY_MARKER = "pp-unity-library-embed";
const UNITY_MANIFEST_MARKER = "pp-unity-activity-no-launcher";

function resolveUnityLibraryRoot(projectRoot) {
  return path.resolve(projectRoot, UNITY_EXPORT_FROM_FRONTEND);
}

function unityExportReady(projectRoot) {
  const libraryRoot = resolveUnityLibraryRoot(projectRoot);
  return (
    fs.existsSync(path.join(libraryRoot, "build.gradle")) ||
    fs.existsSync(path.join(libraryRoot, "build.gradle.kts"))
  );
}

function detectUnityAbis(libraryRoot) {
  const jniRoot = path.join(libraryRoot, "src", "main", "jniLibs");
  if (!fs.existsSync(jniRoot)) return ["armeabi-v7a"];
  return fs
    .readdirSync(jniRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(jniRoot, name, "libunity.so")));
}

function patchSettingsGradle(settingsGradle) {
  let next = settingsGradle;
  const libraryDir = UNITY_EXPORT_FROM_ANDROID.replace(/\\/g, "/");
  const xrManifestDir = `${libraryDir}/xrmanifest.androidlib`.replace(/\\/g, "/");

  if (!next.includes(UNITY_MARKER)) {
    const block = `
// ${UNITY_MARKER}
include ':unityLibrary'
project(':unityLibrary').projectDir = new File(settingsDir, '${libraryDir}')
`;
    next = `${next.trimEnd()}\n${block}\n`;
  }

  if (!next.includes("pp-unity-xrmanifest")) {
    next += `
// pp-unity-xrmanifest — ARCore XR manifest (Unity export alt modulu)
include ':unityLibrary:xrmanifest.androidlib'
project(':unityLibrary:xrmanifest.androidlib').projectDir = new File(settingsDir, '${xrManifestDir}')
`;
  }

  return next;
}

function ensureBuildConfigField(buildGradle, fieldName, value) {
  const boolValue = value ? "true" : "false";
  if (buildGradle.includes(fieldName)) {
    return buildGradle.replace(
      new RegExp(`buildConfigField "boolean", "${fieldName}", "(true|false)"`),
      `buildConfigField "boolean", "${fieldName}", "${boolValue}"`,
    );
  }
  return buildGradle.replace(
    /(defaultConfig\s*\{[\s\S]*?versionName[^\n]*\n)/,
    `$1        buildConfigField "boolean", "${fieldName}", "${boolValue}"\n`,
  );
}

function patchAppBuildGradle(buildGradle, linked, arReady) {
  let next = ensureBuildConfigField(buildGradle, "VR_UNITY_LINKED", linked);
  next = ensureBuildConfigField(next, "VR_UNITY_AR_READY", arReady);

  if (linked && !next.includes("implementation project(':unityLibrary')")) {
    next = next.replace(
      /dependencies\s*\{/,
      "dependencies {\n    implementation project(':unityLibrary')",
    );
  }

  if (linked) {
    const unityPickFirst = [
      "pickFirst 'lib/armeabi-v7a/libunity.so'",
      "pickFirst 'lib/arm64-v8a/libunity.so'",
    ];
    for (const line of unityPickFirst) {
      if (next.includes(line)) continue;
      next = next.replace(
        /pickFirst 'lib\/armeabi-v7a\/libc\+\+_shared\.so'/,
        `pickFirst 'lib/armeabi-v7a/libc++_shared.so'\n        ${line}`,
      );
    }
  }

  return next;
}

function ensureUnityGradleProperties(gradlePropsPath) {
  if (!fs.existsSync(gradlePropsPath)) return;
  let text = fs.readFileSync(gradlePropsPath, "utf8");
  if (/^unityStreamingAssets=/m.test(text)) return;
  text += `\nunityStreamingAssets=\n`;
  fs.writeFileSync(gradlePropsPath, text);
}

function patchUnityLibraryGradle(libraryRoot) {
  const gradlePath = path.join(libraryRoot, "build.gradle");
  if (!fs.existsSync(gradlePath)) return;

  let text = fs.readFileSync(gradlePath, "utf8");
  let changed = false;
  const abis = detectUnityAbis(libraryRoot);
  const abiList = abis.map((abi) => `'${abi}'`).join(", ");

  if (!text.includes("def unityStreamingAssets =")) {
    text = `def unityStreamingAssets = findProperty("unityStreamingAssets") ?: ""\n\n${text}`;
    changed = true;
  }

  if (/ndkPath\s+"/.test(text)) {
    text = text.replace(/\s*ndkPath\s+"[^"]+"\s*\n/, "\n");
    changed = true;
  }

  if (abiList && !text.includes("// pp-unity-abi-detected")) {
    text = text.replace(
      /ndk\s*\{\s*\n\s*abiFilters[^\n]+\n\s*\}/,
      `ndk {\n            // pp-unity-abi-detected\n            abiFilters ${abiList}\n        }`,
    );
    changed = true;
  }

  if (text.includes('local.load(new FileInputStream("${rootDir}/local.properties"))')) {
    text = text.replace(
      /def getSdkDir\(\) \{[\s\S]*?\n\}/,
      `def getSdkDir() {
    def fromEnv = System.getenv("ANDROID_SDK_ROOT") ?: System.getenv("ANDROID_HOME")
    if (fromEnv) {
        return fromEnv.replace('\\\\', '/')
    }
    def candidates = [
        "\${rootDir}/local.properties",
        "\${projectDir}/../local.properties",
    ]
    for (def candidate : candidates) {
        def propsFile = file(candidate)
        if (!propsFile.exists()) continue
        Properties local = new Properties()
        local.load(new FileInputStream(propsFile))
        def sdk = local.getProperty('sdk.dir')
        if (sdk) return sdk
    }
    throw new GradleException("Android SDK bulunamadi. ANDROID_HOME ayarlayin veya frontend/android/local.properties olusturun.")
}`,
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(gradlePath, text);
  }
}

function patchXrManifestAndroidLib(libraryRoot) {
  const xrRoot = path.join(libraryRoot, "xrmanifest.androidlib");
  const gradlePath = path.join(xrRoot, "build.gradle");
  if (!fs.existsSync(gradlePath)) return;

  let text = fs.readFileSync(gradlePath, "utf8");
  let changed = false;

  if (text.includes("apply plugin: 'android-library'")) {
    text = text.replace(
      "apply plugin: 'android-library'",
      "apply plugin: 'com.android.library'",
    );
    changed = true;
  }

  if (!text.includes("// pp-unity-compile-sdk")) {
    text = text.replace(
      /android\s*\{\s*\n\s*namespace/,
      "android {\n    // pp-unity-compile-sdk\n    compileSdk 35\n    namespace",
    );
    changed = true;
  }

  if (/targetSdkVersion 22/.test(text)) {
    text = text.replace("targetSdkVersion 22", "targetSdkVersion 35");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(gradlePath, text);
  }
}

function patchAndroidRootBuildGradle(androidRoot, libraryRoot) {
  const buildGradlePath = path.join(androidRoot, "build.gradle");
  if (!fs.existsSync(buildGradlePath)) return;

  const libsDir = path.join(libraryRoot, "libs").replace(/\\/g, "/");
  let text = fs.readFileSync(buildGradlePath, "utf8");
  if (text.includes("pp-unity-flatdir")) return;

  const flatDirBlock = `
    // pp-unity-flatdir — Unity ARCore .aar dosyalari
    flatDir {
      dirs "\${rootDir}/${path.relative(androidRoot, path.join(libraryRoot, "libs")).replace(/\\/g, "/")}"
    }`;

  text = text.replace(
    /allprojects\s*\{\s*\n\s*repositories\s*\{\s*\n\s*google\(\)/,
    `allprojects {\n  repositories {\n    google()`,
  );

  // Ilk allprojects.repositories bloguna flatDir ekle
  text = text.replace(
    /(allprojects\s*\{\s*\n\s*repositories\s*\{\s*\n\s*google\(\)\s*\n\s*mavenCentral\(\))/,
    `$1${flatDirBlock}`,
  );

  fs.writeFileSync(buildGradlePath, text);
}

function patchUnityLibraryGradleAgp(libraryRoot) {
  const gradlePath = path.join(libraryRoot, "build.gradle");
  if (!fs.existsSync(gradlePath)) return;

  let text = fs.readFileSync(gradlePath, "utf8");
  if (text.includes("// pp-unity-compile-sdk")) return;

  text = text.replace(
    /android\s*\{\s*\n\s*namespace "com\.unity3d\.player"/,
    `android {
    // pp-unity-compile-sdk — AGP 8+ (Expo/RN) compileSdk zorunlu
    compileSdk 35
    namespace "com.unity3d.player"`,
  );
  fs.writeFileSync(gradlePath, text);
}

function ensureUnityGameViewString(libraryRoot) {
  const stringsPath = path.join(libraryRoot, "src", "main", "res", "values", "strings.xml");
  const marker = "game_view_content_description";
  const content = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <!-- pp-unity-game-view-string: UnityPlayer init crash on #0x0 without this -->
  <string name="${marker}" translatable="false">Game view</string>
</resources>
`;

  if (fs.existsSync(stringsPath)) {
    const existing = fs.readFileSync(stringsPath, "utf8");
    if (existing.includes(marker)) return;
    const next = existing.replace(
      /<\/resources>\s*$/,
      `  <string name="${marker}" translatable="false">Game view</string>\n</resources>\n`,
    );
    fs.writeFileSync(stringsPath, next);
    return;
  }

  fs.mkdirSync(path.dirname(stringsPath), { recursive: true });
  fs.writeFileSync(stringsPath, content);
}

function patchUnityLibraryManifest(libraryRoot) {
  const manifestPath = path.join(libraryRoot, "src", "main", "AndroidManifest.xml");
  if (!fs.existsSync(manifestPath)) return;

  let text = fs.readFileSync(manifestPath, "utf8");
  let changed = false;

  if (text.includes('android:enableOnBackInvokedCallback="true"')) {
    text = text.replace(/\s*android:enableOnBackInvokedCallback="true"/g, "");
    changed = true;
  }

  if (text.includes('android:extractNativeLibs="true"')) {
    text = text.replace(/\s*android:extractNativeLibs="true"/g, "");
    changed = true;
  }

  if (text.includes('unity.splash-enable" android:value="True"')) {
    text = text.replace(
      /unity\.splash-enable" android:value="True"/,
      'unity.splash-enable" android:value="False"',
    );
    changed = true;
  }

  if (!text.includes("android.hardware.camera.ar")) {
    text = text.replace(
      /<uses-feature android:glEsVersion/,
      '<uses-feature android:name="android.hardware.camera.ar" android:required="true" />\n  <uses-feature android:glEsVersion',
    );
    changed = true;
  }

  if (!text.includes("pp-unity-library-mode")) {
    text = text.replace(
      /<activity android:name="com\.unity3d\.player\.UnityPlayerActivity"([^>]*)android:exported="true">[\s\S]*?<\/activity>/,
      `<activity android:name="com.unity3d.player.UnityPlayerActivity"$1android:exported="false">\n      <!-- pp-unity-library-mode: RN MainActivity tek launcher -->\n      <meta-data android:name="unityplayer.UnityActivity" android:value="true" />\n    </activity>`,
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(manifestPath, text);
  }
}

function patchAppManifestUnityActivity(manifestPath) {
  if (!fs.existsSync(manifestPath)) return;
  let text = fs.readFileSync(manifestPath, "utf8");
  let changed = false;

  if (!text.includes("android:extractNativeLibs")) {
    text = text.replace(
      /<application([^>]*android:enableOnBackInvokedCallback="false")/,
      '<application$1 android:extractNativeLibs="true" tools:replace="android:enableOnBackInvokedCallback,android:extractNativeLibs"',
    );
    changed = true;
  }

  if (!text.includes(UNITY_MANIFEST_MARKER)) {
    const block = `
    <!-- ${UNITY_MANIFEST_MARKER}: UnityPlayerActivity yalnizca embedded view icin -->
    <activity
        android:name="com.unity3d.player.UnityPlayerActivity"
        android:exported="false"
        tools:node="merge">
      <intent-filter tools:node="removeAll" />
    </activity>`;
    text = text.replace(/(\s*<\/application>)/, `${block}\n$1`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(manifestPath, text);
  }
}

function patchMainActivity(mainActivityPath) {
  if (!fs.existsSync(mainActivityPath)) return;
  let text = fs.readFileSync(mainActivityPath, "utf8");
  if (text.includes("VrUnityHost.pause")) return;

  if (!text.includes("import com.proparcel.mobile.vrparcel.VrUnityHost")) {
    text = text.replace(
      /^package com\.proparcel\.mobile/m,
      "package com.proparcel.mobile\n\nimport com.proparcel.mobile.vrparcel.VrUnityHost",
    );
  }

  const lifecycleBlock = `
  override fun onPause() {
    super.onPause()
    VrUnityHost.pause(this)
  }

  override fun onResume() {
    super.onResume()
    VrUnityHost.resume(this)
  }

  override fun onDestroy() {
    super.onDestroy()
    VrUnityHost.destroy()
  }
`;

  text = text.replace(/\n}\s*$/, `${lifecycleBlock}\n}\n`);
  fs.writeFileSync(mainActivityPath, text);
}

function ensureUnityLibraryEmbed(projectRoot) {
  if (!unityExportReady(projectRoot)) {
    console.warn(
      `[withUnityLibraryEmbed] unityLibrary yok (${UNITY_EXPORT_FROM_FRONTEND}). Export sonrasi tekrar deneyin.`,
    );
    return false;
  }

  const androidRoot = path.join(projectRoot, "android");
  const libraryRoot = resolveUnityLibraryRoot(projectRoot);
  const appConfig = require(path.join(projectRoot, "app.config.js"));
  const androidPackage = appConfig.expo?.android?.package || "com.proparcel.mobile";

  const settingsGradlePath = path.join(androidRoot, "settings.gradle");
  if (fs.existsSync(settingsGradlePath)) {
    const next = patchSettingsGradle(fs.readFileSync(settingsGradlePath, "utf8"));
    fs.writeFileSync(settingsGradlePath, next);
  }

  const exportValidation = validateUnityArExport(libraryRoot);
  if (!exportValidation.ok) {
    console.warn(`[withUnityLibraryEmbed] ${exportValidation.message}`);
  }

  const appBuildGradlePath = path.join(androidRoot, "app", "build.gradle");
  if (fs.existsSync(appBuildGradlePath)) {
    const next = patchAppBuildGradle(fs.readFileSync(appBuildGradlePath, "utf8"), true, exportValidation.ok);
    fs.writeFileSync(appBuildGradlePath, next);
  }

  ensureUnityGradleProperties(path.join(androidRoot, "gradle.properties"));
  ensureUnityGameViewString(libraryRoot);
  patchUnityLibraryGradle(libraryRoot);
  patchUnityLibraryGradleAgp(libraryRoot);
  patchXrManifestAndroidLib(libraryRoot);
  patchAndroidRootBuildGradle(androidRoot, libraryRoot);
  patchUnityLibraryManifest(libraryRoot);
  patchAppManifestUnityActivity(path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml"));

  patchMainActivity(
    path.join(
      androidRoot,
      "app",
      "src",
      "main",
      "java",
      ...androidPackage.split("."),
      "MainActivity.kt",
    ),
  );

  console.log(
    `[withUnityLibraryEmbed] unityLibrary baglandi → VR_UNITY_LINKED=true, VR_UNITY_AR_READY=${exportValidation.ok}`,
  );
  return true;
}

module.exports = function withUnityLibraryEmbed(config) {
  config = withSettingsGradle(config, (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    if (!unityExportReady(projectRoot)) {
      console.warn(
        `[withUnityLibraryEmbed] unityLibrary yok (${UNITY_EXPORT_FROM_FRONTEND}). Export sonrasi prebuild tekrarlayin.`,
      );
      return cfg;
    }
    cfg.modResults.contents = patchSettingsGradle(cfg.modResults.contents);
    console.log("[withUnityLibraryEmbed] settings.gradle → :unityLibrary");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    const linked = unityExportReady(cfg.modRequest.projectRoot);
    const arReady = linked
      ? validateUnityArExport(resolveUnityLibraryRoot(cfg.modRequest.projectRoot)).ok
      : false;
    cfg.modResults.contents = patchAppBuildGradle(cfg.modResults.contents, linked, arReady);
    if (linked) {
      console.log(
        `[withUnityLibraryEmbed] app/build.gradle → unityLibrary + VR_UNITY_LINKED=true, VR_UNITY_AR_READY=${arReady}`,
      );
    } else {
      console.log("[withUnityLibraryEmbed] app/build.gradle → VR_UNITY_LINKED=false");
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      ensureUnityLibraryEmbed(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);

  return config;
};

module.exports.UNITY_EXPORT_FROM_FRONTEND = UNITY_EXPORT_FROM_FRONTEND;
module.exports.unityExportReady = unityExportReady;
module.exports.ensureUnityLibraryEmbed = ensureUnityLibraryEmbed;
