const fs = require("fs");
const path = require("path");
const { withDangerousMod, withAppBuildGradle, withSettingsGradle } = require("expo/config-plugins");
const { validateUnityTerrainExport } = require("../scripts/validate-unity-export.js");
const {
  patchAppManifestOptionalHardware,
  patchUnityLibraryManifestOptionalHardware,
} = require("./androidOptionalHardware.js");

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

function patchSettingsGradle(settingsGradle, libraryRoot) {
  let next = settingsGradle;
  const libraryDir = UNITY_EXPORT_FROM_ANDROID.replace(/\\/g, "/");

  if (!next.includes(UNITY_MARKER)) {
    const block = `
// ${UNITY_MARKER}
include ':unityLibrary'
project(':unityLibrary').projectDir = new File(settingsDir, '${libraryDir}')
`;
    next = `${next.trimEnd()}\n${block}\n`;
  }

  const xrManifestDir = `${libraryDir}/xrmanifest.androidlib`.replace(/\\/g, "/");
  const hasXrManifest = libraryRoot && fs.existsSync(path.join(libraryRoot, "xrmanifest.androidlib"));
  if (hasXrManifest && !next.includes("pp-unity-xrmanifest")) {
    next += `
// pp-unity-xrmanifest — ARCore XR manifest (yalnizca AR export'ta)
include ':unityLibrary:xrmanifest.androidlib'
project(':unityLibrary:xrmanifest.androidlib').projectDir = new File(settingsDir, '${xrManifestDir}')
`;
  }
  if (!hasXrManifest) {
    next = next.replace(
      /\n\/\/ pp-unity-xrmanifest[\s\S]*?xrmanifest\.androidlib'\)\n/g,
      "\n",
    );
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

function patchAppBuildGradle(buildGradle, linked, terrainReady) {
  let next = ensureBuildConfigField(buildGradle, "VR_UNITY_LINKED", linked);
  next = ensureBuildConfigField(next, "TERRAIN_UNITY_READY", terrainReady);

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

    if (!next.includes("pp-unity-min-sdk")) {
      next = next.replace(
        /minSdkVersion rootProject\.ext\.minSdkVersion/,
        "minSdkVersion Math.max(rootProject.ext.minSdkVersion as Integer, 25) // pp-unity-min-sdk",
      );
    }
  }

  return next;
}

function resolveUnityExportGradleProperties(projectRoot) {
  return path.resolve(projectRoot, "..", "unity", "vrParcel", "builds", "android", "gradle.properties");
}

function ensureUnityGradleProperties(gradlePropsPath, projectRoot) {
  if (!fs.existsSync(gradlePropsPath)) return;
  let text = fs.readFileSync(gradlePropsPath, "utf8");
  let changed = false;

  if (!/^unityStreamingAssets=/m.test(text)) {
    text += `\nunityStreamingAssets=\n`;
    changed = true;
  }

  const unityExportPropsPath = resolveUnityExportGradleProperties(projectRoot);
  if (fs.existsSync(unityExportPropsPath)) {
    const unityText = fs.readFileSync(unityExportPropsPath, "utf8");
    for (const line of unityText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith("unity.")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      const regex = new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m");
      if (regex.test(text)) {
        const current = text.match(regex)[0];
        if (current !== trimmed) {
          text = text.replace(regex, trimmed);
          changed = true;
        }
      } else {
        text += `\n${trimmed}`;
        changed = true;
      }
    }
  }

  // Unity .so dosyalari: AGP 8+ extractNativeLibs manifest yerine legacy packaging
  if (!/^expo\.useLegacyPackaging=true/m.test(text)) {
    if (/^expo\.useLegacyPackaging=/m.test(text)) {
      text = text.replace(/^expo\.useLegacyPackaging=.*$/m, "expo.useLegacyPackaging=true");
    } else {
      text += `\nexpo.useLegacyPackaging=true\n`;
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(gradlePropsPath, text);
  }
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

  if (!text.includes("def getUnityAndroidNdkPath()")) {
    const helper = `
def getUnityAndroidNdkPath() {
    if (project.hasProperty('unity.androidNdkPath')) {
        return getProperty('unity.androidNdkPath').replace('\\\\', '/')
    }
    def sdk = getSdkDir()
    def preferred = "\${sdk}/ndk/27.2.12479018"
    if (file(preferred).exists()) return preferred
    throw new GradleException("unity.androidNdkPath yok. npm run fix:android-native calistirin.")
}

def getUnityAndroidSdkPath() {
    if (project.hasProperty('unity.androidSdkPath')) {
        return getProperty('unity.androidSdkPath').replace('\\\\', '/')
    }
    return getSdkDir()
}
`;
    text = text.replace(/def getSdkDir\(\)/, `${helper}\ndef getSdkDir()`);
    text = text.replace(/getProperty\("unity\.androidNdkPath"\)/g, "getUnityAndroidNdkPath()");
    text = text.replace(/getProperty\("unity\.androidSdkPath"\)/g, "getUnityAndroidSdkPath()");
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
      '<uses-feature android:name="android.hardware.camera.ar" android:required="false" />\n  <uses-feature android:glEsVersion',
    );
    changed = true;
  } else {
    text = text.replace(
      /android\.hardware\.camera\.ar" android:required="true"/g,
      'android.hardware.camera.ar" android:required="false"',
    );
    changed = true;
  }

  if (!text.includes("pp-unity-library-mode")) {
    text = text.replace(
      /<activity[^>]*android:name="com\.unity3d\.player\.UnityPlayerActivity"[\s\S]*?<\/activity>/,
      `<activity android:name="com.unity3d.player.UnityPlayerActivity" android:exported="false" android:enabled="true">
      <!-- pp-unity-library-mode: RN MainActivity tek launcher -->
      <meta-data android:name="unityplayer.UnityActivity" android:value="true" />
    </activity>`,
    );
    changed = true;
  } else if (/UnityPlayerActivity[^>]*android:exported="true"/.test(text)) {
    text = text.replace(
      /(android:name="com\.unity3d\.player\.UnityPlayerActivity"[^>]*?)android:exported="true"/,
      '$1android:exported="false"',
    );
    changed = true;
  }

  // pp-unity-permissions-min: VR modulu ag kullanmiyor; INTERNET iznini Unity manifest'ten cikar
  if (!text.includes("pp-unity-permissions-min")) {
    text = text.replace(/\s*<uses-permission android:name="android\.permission\.INTERNET"\s*\/?>\s*/g, "\n");
    if (!text.includes("pp-unity-permissions-min")) {
      text = text.replace(
        /<manifest([^>]*)>/,
        '<manifest$1>\n  <!-- pp-unity-permissions-min: INTERNET kaldirildi (RN ana uygulama yonetir) -->',
      );
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(manifestPath, text);
  }
  patchUnityLibraryManifestOptionalHardware(libraryRoot);
}

function patchAppManifestUnityActivity(manifestPath) {
  if (!fs.existsSync(manifestPath)) return;
  let text = fs.readFileSync(manifestPath, "utf8");
  let changed = false;

  if (text.includes('android:extractNativeLibs="true"')) {
    text = text.replace(/\s*android:extractNativeLibs="true"/g, "");
    text = text.replace(
      /tools:replace="android:enableOnBackInvokedCallback,android:extractNativeLibs"/g,
      'tools:replace="android:enableOnBackInvokedCallback"',
    );
    changed = true;
  }

  if (!text.includes(UNITY_MANIFEST_MARKER)) {
    const block = `
    <!-- ${UNITY_MANIFEST_MARKER}: UnityPlayerActivity yalnizca embedded view icin -->
    <activity
        android:name="com.unity3d.player.UnityPlayerActivity"
        android:exported="false"
        tools:node="merge"
        tools:replace="android:exported">
      <intent-filter tools:node="removeAll" />
    </activity>`;
    text = text.replace(/(\s*<\/application>)/, `${block}\n$1`);
    changed = true;
  }

  if (text.includes(UNITY_MANIFEST_MARKER) && !text.includes('tools:replace="android:exported"')) {
    text = text.replace(
      /(<activity[\s\S]*?com\.unity3d\.player\.UnityPlayerActivity[\s\S]*?tools:node="merge")/,
      '$1\n        tools:replace="android:exported"',
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(manifestPath, text);
  }
}

function stripMainActivityVrUnityHost(mainActivityPath) {
  if (!fs.existsSync(mainActivityPath)) return;
  let text = fs.readFileSync(mainActivityPath, "utf8");
  if (!text.includes("VrUnityHost")) return;
  text = text.replace(/\nimport com\.proparcel\.mobile\.vrparcel\.VrUnityHost/, "");
  text = text.replace(
    /\n  override fun onPause\(\) \{\s*\n\s*super\.onPause\(\)\s*\n\s*VrUnityHost\.pause\(this\)\s*\n\s*\}\s*\n\s*override fun onResume\(\) \{\s*\n\s*super\.onResume\(\)\s*\n\s*VrUnityHost\.resume\(this\)\s*\n\s*\}\s*\n\s*override fun onDestroy\(\) \{\s*\n\s*super\.onDestroy\(\)\s*\n\s*VrUnityHost\.destroy\(\)\s*\n\s*\}\s*\n/,
    "\n",
  );
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
    const next = patchSettingsGradle(fs.readFileSync(settingsGradlePath, "utf8"), libraryRoot);
    fs.writeFileSync(settingsGradlePath, next);
  }

  const exportValidation = validateUnityTerrainExport(libraryRoot);
  if (!exportValidation.ok) {
    console.warn(`[withUnityLibraryEmbed] ${exportValidation.message}`);
  }

  const appBuildGradlePath = path.join(androidRoot, "app", "build.gradle");
  if (fs.existsSync(appBuildGradlePath)) {
    const next = patchAppBuildGradle(fs.readFileSync(appBuildGradlePath, "utf8"), true, exportValidation.ok);
    fs.writeFileSync(appBuildGradlePath, next);
  }

  ensureUnityGradleProperties(path.join(androidRoot, "gradle.properties"), projectRoot);
  ensureUnityGameViewString(libraryRoot);
  patchUnityLibraryGradle(libraryRoot);
  patchUnityLibraryGradleAgp(libraryRoot);
  patchXrManifestAndroidLib(libraryRoot);
  patchAndroidRootBuildGradle(androidRoot, libraryRoot);
  patchUnityLibraryManifest(libraryRoot);
  const appManifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
  patchAppManifestUnityActivity(appManifestPath);
  patchAppManifestOptionalHardware(appManifestPath);

  stripMainActivityVrUnityHost(
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
    `[withUnityLibraryEmbed] unityLibrary baglandi → VR_UNITY_LINKED=true, TERRAIN_UNITY_READY=${exportValidation.ok}`,
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
    cfg.modResults.contents = patchSettingsGradle(cfg.modResults.contents, resolveUnityLibraryRoot(projectRoot));
    console.log("[withUnityLibraryEmbed] settings.gradle → :unityLibrary");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    const linked = unityExportReady(cfg.modRequest.projectRoot);
    const terrainReady = linked
      ? validateUnityTerrainExport(resolveUnityLibraryRoot(cfg.modRequest.projectRoot)).ok
      : false;
    cfg.modResults.contents = patchAppBuildGradle(cfg.modResults.contents, linked, terrainReady);
    if (linked) {
      console.log(
        `[withUnityLibraryEmbed] app/build.gradle → unityLibrary + VR_UNITY_LINKED=true, TERRAIN_UNITY_READY=${terrainReady}`,
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
module.exports.resolveUnityLibraryRoot = resolveUnityLibraryRoot;
module.exports.ensureUnityLibraryEmbed = ensureUnityLibraryEmbed;
