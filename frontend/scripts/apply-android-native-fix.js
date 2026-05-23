/**
 * android/ gitignore'da; expo prebuild sonrasi:
 * - AndroidX / Support Library cakismasi
 * - RN CLI giris noktasi (index.js + ProParcel), Expo Dev Client menusu degil
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const androidRoot = path.join(root, "android");
const gradlePropsPath = path.join(androidRoot, "gradle.properties");
const buildGradlePath = path.join(androidRoot, "build.gradle");
const mainAppPath = path.join(
  androidRoot,
  "app",
  "src",
  "main",
  "java",
  "com",
  "proparcel",
  "app",
  "MainApplication.kt"
);
const mainActivityPath = path.join(
  androidRoot,
  "app",
  "src",
  "main",
  "java",
  "com",
  "proparcel",
  "app",
  "MainActivity.kt"
);
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
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

function ensureManifestNoExpoDevScheme() {
  if (!fs.existsSync(manifestPath)) return true;
  let text = fs.readFileSync(manifestPath, "utf8");
  const before = text;
  text = text.replace(/\s*<data android:scheme="exp\+[^"]+"\/>\r?\n?/g, "\n");
  if (text !== before) {
    fs.writeFileSync(manifestPath, text);
    console.warn("[android-native-fix] AndroidManifest exp+ scheme kaldirildi");
  }
  return true;
}

if (!fs.existsSync(androidRoot)) {
  console.warn("[android-native-fix] android/ yok, atlaniyor");
  process.exit(0);
}

const ok =
  ensureGradleProperties() &&
  ensureBuildGradleExclude() &&
  ensureRnCliNativeEntry() &&
  ensureManifestNoExpoDevScheme() &&
  ensurePackageJsonAndroidScript();
process.exit(ok ? 0 : 1);
