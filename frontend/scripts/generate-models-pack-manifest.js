/**
 * Build-time manifest generator: veritabanına göre model listesi.
 *
 * Kaynak: Backend GET /api/3d-models-list/?platform=mobil (Model3DObject kayıtları)
 * Çıktı: assets/packs/models_manifest.json
 *
 * id = Model3DObject.id (veritabanı primary key). Pack/APK içinde dosya adı model_<id>.glb.
 * path/filename API'den gelir (mobil_path / web_path). Her şey veritabanına göre ilerler.
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outFile = path.join(projectRoot, "assets", "packs", "models_manifest.json");

const DEFAULT_API_BASE = "https://www.proparcel.com";

function resolveApiBase() {
  require("./load-env-file").loadEnvFile();
  return (
    normalizeBaseUrl(process.env.PP_API_BASE) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_MODELS_URL) ||
    DEFAULT_API_BASE
  );
}

function normalizeBaseUrl(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

function packNameFromId(id) {
  return `pp_model_${id}`;
}

function modelFileNameFromId(id) {
  return `model_${id}.glb`;
}

function normalizeStaticPath(p) {
  let s = String(p || "").trim();
  if (!s) return "";
  s = s.replace(/^\/+/, "");
  // Backend sometimes returns paths like "myapp/static/models/..."
  s = s.replace(/^myapp\/static\//i, "");
  // Defensive: avoid duplicating "static/static/..."
  s = s.replace(/^static\//i, "");
  // mobil_path often: assets/models/car/foo.glb -> models/car/foo.glb
  s = s.replace(/^assets\/models\//i, "models/");
  s = s.replace(/^assets\//i, "");
  return s;
}

async function fetchJson(url, token) {
  const headers = { "ngrok-skip-browser-warning": "true" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok || !json) {
    throw new Error(`fetch failed: ${url} status=${res.status} bodyPrefix=${text.slice(0, 200)}`);
  }
  return json;
}

function categoryTitle(groupId) {
  switch (groupId) {
    case "car":
      return "Araba";
    case "house":
      return "Ev";
    case "tree":
      return "Ağaç";
    case "grass":
      return "Çim";
    default:
      return groupId;
  }
}

// Modeller APK'ya gömülsün, telefon indirmesin (veritabanındaki tüm modeller için)
function computeAndroidDelivery(role) {
  return "install-time";
}

async function main() {
  const apiBase = resolveApiBase();
  const token = process.env.PP_BEARER_TOKEN || "";
  const url = `${apiBase}/api/3d-models-list/?platform=mobil`;

  console.warn(`[gen:model-packs-manifest] fetching ${url} ...`);

  const data = await fetchJson(url, token);

  const out = {
    generatedAt: new Date().toISOString(),
    apiBase,
    android: {
      packGranularity: "per_model",
      deliveryRule: "install-time (paketler build'e gömülür, veritabanına göre)",
    },
    ios: {
      odrGranularity: "per_model",
    },
    models: [],
  };

  const categories = Object.keys(data || {});
  for (const groupId of categories) {
    const arr = Array.isArray(data[groupId]) ? data[groupId] : [];
    for (const item of arr) {
      const id = Number(item?.id);
      if (!Number.isFinite(id)) continue;
      const relPathRaw = String(item?.path || "").trim(); // e.g. models/tree/tree3.glb
      const relPath = normalizeStaticPath(relPathRaw);
      const filenameFromPath = relPath ? relPath.split("/").pop() : null;
      const filename = filenameFromPath || String(item?.file || "").trim() || modelFileNameFromId(id);
      const role = item?.role;
      const programmaticId = item?.model_id || `model_${id}`;
      out.models.push({
        id,
        model_id: programmaticId,
        groupId,
        groupTitle: categoryTitle(groupId),
        name: item?.name ?? null,
        filename,
        path: relPath || null,
        staticUrl: relPath ? `${apiBase}/static/${relPath}` : null,
        role: role ?? null,
        // Build-time identifiers
        packName: packNameFromId(id),
        odrTag: packNameFromId(id),
        // Delivery policy
        androidDelivery: computeAndroidDelivery(role),
      });
    }
  }

  out.models.sort((a, b) => a.id - b.id);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");

  console.warn(`[gen:model-packs-manifest] wrote ${path.relative(projectRoot, outFile)} count=${out.models.length}`);
}

main().catch((e) => {
  console.error("[gen:model-packs-manifest] FAILED:", e?.message || e);
  process.exitCode = 1;
});

