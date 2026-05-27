/**
 * android/ gitignore'da; expo prebuild sonrasi:
 * - AndroidX / Support Library cakismasi
 * - RN CLI giris noktasi (index.js + ProParcel), Expo Dev Client menusu degil
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const androidRoot = path.join(root, "android");
const appConfig = require("../app.config.js");
const androidPackage =
  appConfig.expo?.android?.package || "com.proparcel.mobile";
const packagePathParts = androidPackage.split(".");
const gradlePropsPath = path.join(androidRoot, "gradle.properties");
const buildGradlePath = path.join(androidRoot, "build.gradle");
const mainAppPath = path.join(
  androidRoot,
  "app",
  "src",
  "main",
  "java",
  ...packagePathParts,
  "MainApplication.kt"
);
const mainActivityPath = path.join(
  androidRoot,
  "app",
  "src",
  "main",
  "java",
  ...packagePathParts,
  "MainActivity.kt"
);
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
const appBuildGradlePath = path.join(androidRoot, "app", "build.gradle");
const settingsGradlePath = path.join(androidRoot, "settings.gradle");
const packageJsonPath = path.join(root, "package.json");

const GRADLE_PROPS_LINES = [
  "android.enableJetifier=true",
  "android.jetifier.ignorelist=react-android,hermes-android,react-native",
];

const EXCLUDE_BLOCK = `
  // AndroidX + eski com.android.support ayni siniflari getirir (duplicate class)
  configurations.all {
    exclude group: 'com.android.support'
  }`;

const ANDROID_DEV_CLIENT_EXCLUDE = [
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
];

function ensureGradleProperties() {
  if (!fs.existsSync(gradlePropsPath)) {
    console.warn("[android-native-fix] android/gradle.properties yok");
    return false;
  }
  let text = fs.readFileSync(gradlePropsPath, "utf8");
  if (!text.includes("android.useAndroidX=true")) {
    text += "\nandroid.useAndroidX=true\n";
  }
  let changed = false;
  for (const line of GRADLE_PROPS_LINES) {
    const key = line.split("=")[0];
    if (text.includes(`${key}=`)) continue;
    const insertAfter = "android.useAndroidX=true";
    if (text.includes(insertAfter)) {
      text = text.replace(insertAfter, `${insertAfter}\n${line}`);
    } else {
      text += `\n${line}\n`;
    }
    changed = true;
  }
  if (/^EX_DEV_CLIENT_NETWORK_INSPECTOR=/m.test(text)) {
    text = text.replace(/^EX_DEV_CLIENT_NETWORK_INSPECTOR=.*\r?\n?/m, "");
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(gradlePropsPath, text);
    console.warn("[android-native-fix] gradle.properties guncellendi");
  }
  return true;
}

function ensureBuildGradleExclude() {
  if (!fs.existsSync(buildGradlePath)) {
    console.warn("[android-native-fix] android/build.gradle yok");
    return false;
  }
  let text = fs.readFileSync(buildGradlePath, "utf8");
  if (text.includes("exclude group: 'com.android.support'")) {
    return true;
  }
  const marker = "allprojects {";
  const idx = text.indexOf(marker);
  if (idx === -1) {
    console.warn("[android-native-fix] allprojects blogu bulunamadi");
    return false;
  }
  const closeIdx = text.indexOf("\n}", idx);
  if (closeIdx === -1) {
    console.warn("[android-native-fix] allprojects kapanisi bulunamadi");
    return false;
  }
  text = text.slice(0, closeIdx) + EXCLUDE_BLOCK + text.slice(closeIdx);
  fs.writeFileSync(buildGradlePath, text);
  console.warn("[android-native-fix] build.gradle exclude eklendi");
  return true;
}

function ensureRnCliNativeEntry() {
  let ok = true;
  if (fs.existsSync(mainAppPath)) {
    let text = fs.readFileSync(mainAppPath, "utf8");
    const from = 'override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"';
    const to = 'override fun getJSMainModuleName(): String = "index"';
    if (text.includes(from)) {
      text = text.replace(from, to);
      fs.writeFileSync(mainAppPath, text);
      console.warn("[android-native-fix] MainApplication -> index.js");
    }
  } else {
    ok = false;
  }

  if (fs.existsSync(mainActivityPath)) {
    let text = fs.readFileSync(mainActivityPath, "utf8");
    const from = 'override fun getMainComponentName(): String = "main"';
    const to = 'override fun getMainComponentName(): String = "ProParcel"';
    if (text.includes(from)) {
      text = text.replace(from, to);
      fs.writeFileSync(mainActivityPath, text);
      console.warn("[android-native-fix] MainActivity -> ProParcel");
    }
  } else {
    ok = false;
  }
  return ok;
}

function ensurePackageJsonAndroidScript() {
  if (!fs.existsSync(packageJsonPath)) return true;
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (pkg.scripts?.android === "react-native run-android") return true;
  if (pkg.scripts?.android === "expo run:android") {
    pkg.scripts.android = "react-native run-android";
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.warn("[android-native-fix] package.json android -> react-native run-android");
  }
  return true;
}

const APP_LINK_INTENT_MARKER = "pp-app-links-autoVerify";

function ensureAndroidAppLinkIntentFilters() {
  if (!fs.existsSync(manifestPath)) return true;
  let text = fs.readFileSync(manifestPath, "utf8");
  if (text.includes(APP_LINK_INTENT_MARKER)) return true;

  const block = `
      <!-- ${APP_LINK_INTENT_MARKER}: https Universal / App Links (proparcel.com) -->
      <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" android:host="proparcel.com" android:pathPrefix="/portal/recent-queries" />
        <data android:scheme="https" android:host="www.proparcel.com" android:pathPrefix="/portal/recent-queries" />
        <data android:scheme="https" android:host="proparcel.com" android:pathPrefix="/query" />
        <data android:scheme="https" android:host="www.proparcel.com" android:pathPrefix="/query" />
        <data android:scheme="https" android:host="proparcel.com" android:pathPrefix="/go" />
        <data android:scheme="https" android:host="www.proparcel.com" android:pathPrefix="/go" />
      </intent-filter>`;

  const mainActivityRe =
    /(<activity[^>]*android:name="[^"]*MainActivity"[^>]*>)([\s\S]*?)(<\/activity>)/m;
  const m = text.match(mainActivityRe);
  if (!m) {
    console.warn("[android-native-fix] MainActivity bulunamadi, App Links intent-filter eklenemedi");
    return false;
  }
  const updated = `${m[1]}${m[2]}${block}\n    ${m[3]}`;
  text = text.replace(mainActivityRe, updated);
  fs.writeFileSync(manifestPath, text);
  console.warn("[android-native-fix] Android App Links intent-filter eklendi");
  return true;
}

function ensureManifestNoExpoDevScheme() {
  if (!fs.existsSync(manifestPath)) return true;
  let text = fs.readFileSync(manifestPath, "utf8");
  const before = text;
  text = text.replace(/\s*<data android:scheme="exp\+[^"]+"\/>\r?\n?/g, "\n");
  text = text.replace(/\s*<data android:scheme="expo-dev-launcher"[^/]*\/>\r?\n?/gi, "\n");
  // expo-dev-launcher AuthActivity (Expo gelistirme menusu) — RN CLI debug icin gerekmez
  text = text.replace(
    /\s*<activity[^>]*expo\.modules\.devlauncher[^>]*>[\s\S]*?<\/activity>\s*/gi,
    "\n"
  );
  if (text !== before) {
    fs.writeFileSync(manifestPath, text);
    console.warn("[android-native-fix] AndroidManifest Expo dev launcher temizlendi");
  }
  return true;
}

function ensurePackageJsonAutolinkingExclude() {
  if (!fs.existsSync(packageJsonPath)) return true;
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  pkg.expo = pkg.expo || {};
  pkg.expo.autolinking = pkg.expo.autolinking || {};
  pkg.expo.autolinking.android = pkg.expo.autolinking.android || {};
  const current = pkg.expo.autolinking.android.exclude || [];
  const merged = [...new Set([...current, ...ANDROID_DEV_CLIENT_EXCLUDE])];
  const same =
    merged.length === current.length &&
    merged.every((name) => current.includes(name));
  if (!same) {
    pkg.expo.autolinking.android.exclude = merged;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.warn(
      "[android-native-fix] package.json expo.autolinking.android.exclude guncellendi"
    );
  }
  return true;
}

function upsertGradleJvmHeap() {
  if (!fs.existsSync(gradlePropsPath)) return true;
  let text = fs.readFileSync(gradlePropsPath, "utf8");
  const target = "org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8";
  if (/^org\.gradle\.jvmargs=/m.test(text)) {
    if (!text.includes("-Xmx8192m")) {
      text = text.replace(/^org\.gradle\.jvmargs=.*$/m, target);
      fs.writeFileSync(gradlePropsPath, text);
      console.warn("[android-native-fix] gradle JVM heap 8192m (buyuk AAB icin)");
    }
  } else {
    text += `\n${target}\n`;
    fs.writeFileSync(gradlePropsPath, text);
    console.warn("[android-native-fix] gradle JVM heap eklendi");
  }
  return true;
}

function ensureSettingsIncludesAssetPacks() {
  if (!fs.existsSync(settingsGradlePath)) return true;
  let text = fs.readFileSync(settingsGradlePath, "utf8");
  const block = `
def generatedAssetPacks = file("asset-packs/generated-settings.gradle")
if (generatedAssetPacks.exists()) {
  apply from: generatedAssetPacks
}`;
  if (text.includes('asset-packs/generated-settings.gradle')) return true;
  text = `${text.trimEnd()}\n${block}\n`;
  fs.writeFileSync(settingsGradlePath, text);
  console.warn("[android-native-fix] settings.gradle asset pack include eklendi");
  return true;
}

function ensureAppBuildGradlePlayRelease() {
  if (!fs.existsSync(appBuildGradlePath)) return true;
  let text = fs.readFileSync(appBuildGradlePath, "utf8");
  let changed = false;

  if (!text.includes("def keystoreProperties = new Properties()")) {
    const anchor = "def enableMinifyInReleaseBuilds";
    const block = `def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("app/keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

def assetPacksFile = rootProject.file("asset-packs/asset-packs.gradle")
if (assetPacksFile.exists()) {
    apply from: assetPacksFile
}

`;
    if (text.includes(anchor)) {
      text = text.replace(anchor, block + anchor);
      changed = true;
    }
  }

  if (text.includes("applicationId ") && !text.includes(`applicationId '${androidPackage}'`)) {
    text = text.replace(/applicationId\s+'[^']+'/, `applicationId '${androidPackage}'`);
    changed = true;
  }

  const workletsPickFirst = [
    "pickFirst 'lib/x86/libworklets.so'",
    "pickFirst 'lib/x86_64/libworklets.so'",
    "pickFirst 'lib/arm64-v8a/libworklets.so'",
    "pickFirst 'lib/armeabi-v7a/libworklets.so'",
  ];
  for (const line of workletsPickFirst) {
    if (!text.includes(line)) {
      text = text.replace(
        /pickFirst 'lib\/armeabi-v7a\/libc\+\+_shared\.so'/,
        `pickFirst 'lib/armeabi-v7a/libc++_shared.so'\n        ${line}`
      );
      changed = true;
      break;
    }
  }

  if (!text.includes("signingConfigs {") || !text.includes("signingConfigs.release")) {
    if (text.includes("signingConfigs {") && text.includes("signingConfig signingConfigs.debug") && text.includes("release {")) {
      if (!text.match(/signingConfigs\s*\{[\s\S]*?release\s*\{/)) {
        text = text.replace(
          /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\}\s*)/,
          `$1        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`
        );
        text = text.replace(
          /release\s*\{\s*\n\s*\/\/ Caution! In production[\s\S]*?signingConfig signingConfigs\.debug/,
          "release {\n            signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug"
        );
        changed = true;
      }
    }
  }

  if (!text.includes("assetPacks = rootProject.ext.has")) {
    text = text.replace(
      /(\s*androidResources\s*\{[\s\S]*?\}\s*)/,
      `$1    assetPacks = rootProject.ext.has("ppAssetPacks") ? rootProject.ext.ppAssetPacks : []\n`
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(appBuildGradlePath, text);
    console.warn("[android-native-fix] app/build.gradle Play release (package, PAD, signing) guncellendi");
  }
  return true;
}

if (!fs.existsSync(androidRoot)) {
  console.warn("[android-native-fix] android/ yok, atlaniyor");
  process.exit(0);
}

const ok =
  ensurePackageJsonAutolinkingExclude() &&
  ensureGradleProperties() &&
  upsertGradleJvmHeap() &&
  ensureBuildGradleExclude() &&
  ensureRnCliNativeEntry() &&
  ensureManifestNoExpoDevScheme() &&
  ensureAndroidAppLinkIntentFilters() &&
  ensureSettingsIncludesAssetPacks() &&
  ensureAppBuildGradlePlayRelease() &&
  ensurePackageJsonAndroidScript();
process.exit(ok ? 0 : 1);
