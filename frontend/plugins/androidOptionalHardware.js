/**
 * Play cihaz kataloğunda AR/VR/kamera/mikrofon zorunluluğunu kaldırır.
 * Birleşik manifest'te kütüphane required=true bildirse bile app manifest tools:node="replace" ile override eder.
 */
const fs = require("fs");
const path = require("path");

const MARKER = "pp-optional-hardware";

const OPTIONAL_FEATURES = [
  "android.hardware.camera",
  "android.hardware.camera.ar",
  "android.hardware.microphone",
  "com.google.ar.core.depth",
  "android.software.home_screen",
];

function ensureToolsNamespace(manifest) {
  if (manifest.includes("xmlns:tools=")) return manifest;
  return manifest.replace(/<manifest([^>]*)>/, '<manifest$1 xmlns:tools="http://schemas.android.com/tools">');
}

function buildOptionalFeatureBlock() {
  const lines = OPTIONAL_FEATURES.map(
    (name) =>
      `  <uses-feature android:name="${name}" android:required="false" tools:node="replace" />`,
  );
  return `\n  <!-- ${MARKER}: AR/VR/camera/mic optional for Play device catalog -->\n${lines.join("\n")}\n`;
}

function dedupeOptionalFeatures(text) {
  for (const name of OPTIONAL_FEATURES) {
    const escaped = name.replace(/\./g, "\\.");
    const pattern = new RegExp(`\\s*<uses-feature android:name="${escaped}"[^>]*/>\\s*`, "g");
    let count = 0;
    text = text.replace(pattern, (match) => {
      count += 1;
      return count === 1 ? match : "";
    });
  }
  return text;
}

function patchArCoreMetaOptional(manifest) {
  manifest = manifest.replace(
    /(<meta-data android:name="com\.google\.ar\.core"[^>]*)\s*tools:replace="android:value"(?:\s*tools:replace="android:value")*/g,
    "$1",
  );
  if (manifest.includes('android:name="com.google.ar.core"')) {
    return manifest.replace(
      /<meta-data android:name="com\.google\.ar\.core" android:value="[^"]*"([^/]*)\/>/,
      '<meta-data android:name="com.google.ar.core" android:value="optional" tools:replace="android:value"$1/>',
    );
  }
  return manifest.replace(
    /<application([^>]*)>/,
    `<application$1>\n    <meta-data android:name="com.google.ar.core" android:value="optional" tools:replace="android:value"/>`,
  );
}

/**
 * @param {string} manifestPath app/src/main/AndroidManifest.xml
 */
function patchAppManifestOptionalHardware(manifestPath) {
  if (!fs.existsSync(manifestPath)) return false;

  let text = fs.readFileSync(manifestPath, "utf8");
  text = ensureToolsNamespace(text);

  if (!text.includes(MARKER)) {
    text = text.replace(/(<manifest[^>]*>\s*)/, `$1${buildOptionalFeatureBlock()}`);
  }

  text = dedupeOptionalFeatures(text);
  text = patchArCoreMetaOptional(text);
  fs.writeFileSync(manifestPath, text);
  return true;
}

/**
 * Unity export manifest — kaynak dosyada required=true gelir; export sonrası false yapılır.
 * @param {string} libraryRoot unityLibrary kök dizini
 */
function patchUnityLibraryManifestOptionalHardware(libraryRoot) {
  const manifestPath = path.join(libraryRoot, "src", "main", "AndroidManifest.xml");
  if (!fs.existsSync(manifestPath)) return false;

  let text = fs.readFileSync(manifestPath, "utf8");
  let changed = false;

  const replacements = [
    [/android\.software\.home_screen" android:required="true"/g, 'android.software.home_screen" android:required="false"'],
    [/android\.hardware\.camera\.ar" android:required="true"/g, 'android.hardware.camera.ar" android:required="false"'],
    [/com\.google\.ar\.core\.depth" android:required="true"/g, 'com.google.ar.core.depth" android:required="false"'],
    [/android:name="com\.google\.ar\.core" android:value="required"/g, 'android:name="com.google.ar.core" android:value="optional"'],
  ];

  for (const [pattern, replacement] of replacements) {
    const next = text.replace(pattern, replacement);
    if (next !== text) {
      text = next;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(manifestPath, text);
  }
  return true;
}

module.exports = {
  MARKER,
  OPTIONAL_FEATURES,
  patchAppManifestOptionalHardware,
  patchUnityLibraryManifestOptionalHardware,
};
