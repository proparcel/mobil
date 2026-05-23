/**
 * android/ gitignore'da; expo prebuild sonrasi AndroidX/Support cakismasini onler.
 * prebuild:android script'i bunu otomatik calistirir; elle: node ./scripts/apply-androidx-gradle-fix.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const androidRoot = path.join(root, "android");
const gradlePropsPath = path.join(androidRoot, "gradle.properties");
const buildGradlePath = path.join(androidRoot, "build.gradle");

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
    console.warn("[androidx-fix] android/gradle.properties yok; once npm run prebuild:android");
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
  if (changed) {
    fs.writeFileSync(gradlePropsPath, text);
    console.warn("[androidx-fix] gradle.properties guncellendi");
  }
  return true;
}

function ensureBuildGradleExclude() {
  if (!fs.existsSync(buildGradlePath)) {
    console.warn("[androidx-fix] android/build.gradle yok");
    return false;
  }
  let text = fs.readFileSync(buildGradlePath, "utf8");
  if (text.includes("exclude group: 'com.android.support'")) {
    return true;
  }
  const marker = "allprojects {";
  const idx = text.indexOf(marker);
  if (idx === -1) {
    console.warn("[androidx-fix] allprojects blogu bulunamadi");
    return false;
  }
  const closeIdx = text.indexOf("\n}", idx);
  if (closeIdx === -1) {
    console.warn("[androidx-fix] allprojects kapanisi bulunamadi");
    return false;
  }
  text = text.slice(0, closeIdx) + EXCLUDE_BLOCK + text.slice(closeIdx);
  fs.writeFileSync(buildGradlePath, text);
  console.warn("[androidx-fix] build.gradle exclude eklendi");
  return true;
}

if (!fs.existsSync(androidRoot)) {
  console.warn("[androidx-fix] android/ yok, atlaniyor");
  process.exit(0);
}

const ok = ensureGradleProperties() && ensureBuildGradleExclude();
process.exit(ok ? 0 : 1);
