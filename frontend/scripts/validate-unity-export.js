/**
 * unityLibrary export'unun terrain viewer scriptlerini icerip icermedigini dogrular.
 */
const fs = require("fs");
const path = require("path");

const defaultLibraryRoot = path.join(
  __dirname,
  "..",
  "..",
  "unity",
  "vrParcel",
  "builds",
  "android",
  "unityLibrary",
);

const TERRAIN_SCENE = "ParcelTerrain3dScene";

/** Google Play / gizlilik acisindan Unity export'ta olmamasi gereken assembly kalıplari */
const FORBIDDEN_ASSEMBLY_PATTERNS = [
  "UnityEngine.Advertisements",
  "UnityEngine.Purchasing",
  "Unity.Services.Analytics",
  "Firebase.App",
  "Firebase.Analytics",
  "Firebase.Messaging",
  "GooglePlayGames",
  "Google.Play.AssetDelivery",
  "Google.Play.Review",
];

function validateForbiddenUnityAssemblies(json) {
  const hits = FORBIDDEN_ASSEMBLY_PATTERNS.filter((pattern) => json.includes(pattern));
  if (hits.length === 0) return null;
  return {
    ok: false,
    reason: "forbidden_assemblies",
    message:
      "Unity export'ta izin gerektiren veya politika riski tasiyan SDK assembly'leri bulundu: " +
      hits.join(", ") +
      ". Unity Package Manager'dan kaldirin ve yeniden export alin.",
  };
}

function readMetadataText(libraryRoot = defaultLibraryRoot) {
  const metadataPath = path.join(
    libraryRoot,
    "src",
    "main",
    "assets",
    "bin",
    "Data",
    "Managed",
    "Metadata",
    "global-metadata.dat",
  );
  if (!fs.existsSync(metadataPath)) return null;
  return fs.readFileSync(metadataPath).toString("utf8");
}

function validateUnityArExport(libraryRoot = defaultLibraryRoot) {
  const jsonPath = path.join(
    libraryRoot,
    "src",
    "main",
    "assets",
    "bin",
    "Data",
    "ScriptingAssemblies.json",
  );
  if (!fs.existsSync(jsonPath)) {
    return {
      ok: false,
      reason: "missing_scripting_assemblies",
      message: "ScriptingAssemblies.json yok — Unity Android export alinmamis.",
    };
  }

  const json = fs.readFileSync(jsonPath, "utf8");
  const forbidden = validateForbiddenUnityAssemblies(json);
  if (forbidden) return forbidden;

  const hasGameScripts = json.includes("Assembly-CSharp");
  const hasArFoundation =
    json.includes("Unity.XR.ARFoundation") ||
    json.includes("Unity.XR.ARCore") ||
    json.includes("Unity.XR.ARSubsystems");

  if (!hasGameScripts && !hasArFoundation) {
    return {
      ok: false,
      reason: "empty_export",
      message:
        "unityLibrary bos export: Assembly-CSharp ve AR Foundation yok. Unity Editor'de export alin.",
    };
  }
  if (!hasGameScripts) {
    return {
      ok: false,
      reason: "missing_game_scripts",
      message:
        "VrParcel C# scriptleri export'a girmemis (Assembly-CSharp yok). Build listesini kontrol edin.",
    };
  }
  if (!hasArFoundation) {
    return {
      ok: false,
      reason: "missing_ar_foundation",
      message:
        "AR Foundation / ARCore paketleri export'a girmemis. " +
        "Project Settings → XR Plug-in Management → Android → ARCore etkinlestirin.",
    };
  }

  return { ok: true, reason: "ready", message: "Unity AR export hazir." };
}

function validateUnitySmokeExport(libraryRoot = defaultLibraryRoot) {
  const jsonPath = path.join(
    libraryRoot,
    "src",
    "main",
    "assets",
    "bin",
    "Data",
    "ScriptingAssemblies.json",
  );
  if (!fs.existsSync(jsonPath)) {
    return {
      ok: false,
      reason: "missing_scripting_assemblies",
      message: "ScriptingAssemblies.json yok — Unity Android export alinmamis.",
    };
  }

  const json = fs.readFileSync(jsonPath, "utf8");
  const forbidden = validateForbiddenUnityAssemblies(json);
  if (forbidden) return forbidden;

  if (!json.includes("Assembly-CSharp")) {
    return {
      ok: false,
      reason: "missing_game_scripts",
      message: "Assembly-CSharp yok — UnitySmokeTest.cs export'a girmemis.",
    };
  }

  const text = readMetadataText(libraryRoot);
  if (!text) {
    return {
      ok: false,
      reason: "missing_metadata",
      message: "global-metadata.dat yok — Unity export eksik.",
    };
  }

  if (!text.includes("UnitySmokeTest")) {
    return {
      ok: false,
      reason: "stale_smoke_export",
      message:
        "Smoke export eski (UnitySmokeTest yok). Unity Editor: " +
        "ProParcel → Smoke Test → Create UnitySmokeTest Scene, Build Settings smoke only, Export.",
    };
  }
  if (!text.includes("UnitySmokeTestScene")) {
    return {
      ok: false,
      reason: "missing_smoke_scene",
      message: "UnitySmokeTestScene export'ta yok — Build Settings index 0 smoke scene olmali.",
    };
  }

  return { ok: true, reason: "smoke_ready", message: "Unity Smoke Test export hazir." };
}

function validateUnityTerrainExport(libraryRoot = defaultLibraryRoot) {
  const jsonPath = path.join(
    libraryRoot,
    "src",
    "main",
    "assets",
    "bin",
    "Data",
    "ScriptingAssemblies.json",
  );
  if (!fs.existsSync(jsonPath)) {
    return {
      ok: false,
      reason: "missing_scripting_assemblies",
      message: "ScriptingAssemblies.json yok — Unity Android export alinmamis.",
    };
  }

  const json = fs.readFileSync(jsonPath, "utf8");
  const forbidden = validateForbiddenUnityAssemblies(json);
  if (forbidden) return forbidden;

  if (!json.includes("Assembly-CSharp")) {
    return {
      ok: false,
      reason: "missing_game_scripts",
      message: "Assembly-CSharp yok — Terrain C# scriptleri export'a girmemis.",
    };
  }

  const text = readMetadataText(libraryRoot);
  if (!text) {
    return {
      ok: false,
      reason: "missing_metadata",
      message: "global-metadata.dat yok — Unity export eksik veya IL2CPP metadata bulunamadi.",
    };
  }

  if (!text.includes(TERRAIN_SCENE)) {
    return {
      ok: false,
      reason: "missing_terrain_scene",
      message: `${TERRAIN_SCENE} export'ta yok — Build Settings index 0 olmali.`,
    };
  }
  if (!text.includes("ParcelTerrain3dBridge")) {
    return {
      ok: false,
      reason: "missing_terrain_bridge",
      message: "ParcelTerrain3dBridge export'ta yok — sahne ve scriptler build listesinde mi?",
    };
  }
  if (!text.includes("TerrainPayloadIO")) {
    return {
      ok: false,
      reason: "stale_terrain_export",
      message: "Terrain export eski (TerrainPayloadIO yok). Unity'de yeniden export alin.",
    };
  }
  if (!text.includes("TerrainSlopeColorPalette")) {
    return {
      ok: false,
      reason: "stale_terrain_palette",
      message: "TerrainSlopeColorPalette export'ta yok — son C# degisiklikleri export edilmemis.",
    };
  }
  if (
    !text.includes("TerrainVertexColor") &&
    !text.includes("ProParcel/TerrainVertexColor")
  ) {
    return {
      ok: false,
      reason: "missing_vertex_shader",
      message:
        "ProParcel/TerrainVertexColor shader export metadata'da yok. " +
        "Unity: ProParcel → Terrain3D → Ensure Vertex Color Shader Included, sonra export.",
    };
  }

  return { ok: true, reason: "terrain_ready", message: "Unity Terrain export hazir." };
}

if (require.main === module) {
  const mode = process.env.UNITY_EXPORT_VALIDATE_MODE || "terrain";
  const result =
    mode === "terrain"
      ? validateUnityTerrainExport()
      : mode === "ar" || mode === "vr"
        ? validateUnityArExport()
        : validateUnitySmokeExport();
  if (result.ok) {
    console.log(`[validate-unity-export] ${result.message}`);
    process.exit(0);
  }
  console.error(`[validate-unity-export] HATA: ${result.message}`);
  process.exit(1);
}

module.exports = {
  validateUnityArExport,
  validateUnityTerrainExport,
  validateUnitySmokeExport,
  validateForbiddenUnityAssemblies,
  FORBIDDEN_ASSEMBLY_PATTERNS,
};
