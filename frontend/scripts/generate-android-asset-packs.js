/**
 * Generate Android Play Asset Delivery (PAD) asset pack modules per model.
 *
 * Input:
 * - assets/packs/models_manifest.json
 *
 * Output:
 * - android/asset-packs/<packName>/build.gradle (+ assets)
 * - android/asset-packs/asset-packs.gradle (list for app/build.gradle)
 * - android/asset-packs/generated-settings.gradle (include + projectDir)
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(projectRoot, "android");
const packsRoot = path.join(androidRoot, "asset-packs");
const manifestPath = path.join(projectRoot, "assets", "packs", "models_manifest.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function sanitizePackName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
}

function assetPackBuildGradle({ packName, deliveryType }) {
  // deliveryType: "fast-follow" | "on-demand" | "install-time"
  return `apply plugin: 'com.android.asset-pack'

assetPack {
  packName = '${packName}'
  dynamicDelivery {
    deliveryType = '${deliveryType}'
  }
}
`;
}

async function downloadTo(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  ensureDir(path.dirname(outPath));
  const file = fs.createWriteStream(outPath);
  await new Promise((resolve, reject) => {
    // Node fetch may return a WHATWG ReadableStream; convert to Node stream when needed.
    const body = res.body;
    let nodeStream = body;
    try {
      if (body && typeof body.getReader === "function") {
        const { Readable } = require("stream");
        nodeStream = Readable.fromWeb(body);
      }
    } catch {
      nodeStream = body;
    }

    if (!nodeStream || typeof nodeStream.pipe !== "function") {
      reject(new Error("response body is not streamable"));
      return;
    }

    nodeStream.pipe(file);
    nodeStream.on("error", reject);
    file.on("finish", resolve);
    file.on("error", reject);
  });
}

function modelTargetPath(packDir, id) {
  return path.join(packDir, "src", "main", "assets", "models", `model_${id}.glb`);
}

// Manifest'teki path projede assets altına işaret eder; önce path, sonra groupId+filename, sonra klasörde herhangi .glb.
function findLocalSourceFile(m) {
  const groupId = String(m?.groupId || "").trim();
  const filename = String(m?.filename || "").trim();
  const pathFromManifest = String(m?.path || "").trim();

  const candidates = [];
  if (pathFromManifest && !path.isAbsolute(pathFromManifest)) {
    candidates.push(path.join(projectRoot, pathFromManifest));
  }
  candidates.push(
    path.join(projectRoot, "assets", "models", groupId, filename),
    path.join(projectRoot, "assets", "temp", groupId, filename),
    path.join(projectRoot, "assets", "models", filename),
    path.join(projectRoot, "assets", "temp", filename)
  );
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  const groupDir = path.join(projectRoot, "assets", "models", groupId);
  if (groupId && exists(groupDir)) {
    try {
      const names = fs.readdirSync(groupDir);
      const glb = names.find((n) => n.toLowerCase().endsWith(".glb"));
      if (glb) return path.join(groupDir, glb);
    } catch (_) {}
  }
  return null;
}

async function main() {
  if (!exists(manifestPath)) {
    throw new Error(`missing manifest: ${manifestPath}`);
  }
  if (!exists(androidRoot)) {
    throw new Error(`missing android folder: ${androidRoot}`);
  }

  const manifest = readJson(manifestPath);
  const models = Array.isArray(manifest?.models) ? manifest.models : [];

  ensureDir(packsRoot);

  const includeLines = [];
  const assetPacksList = [];

  const packResults = [];

  for (const m of models) {
    const id = Number(m?.id);
    if (!Number.isFinite(id)) continue;

    const packName = sanitizePackName(m?.packName || `pp_model_${id}`);
    const deliveryType = String(m?.androidDelivery || "on-demand");
    const groupId = String(m?.groupId || "").trim();
    const filename = String(m?.filename || "").trim();

    const packModulePath = `:asset-packs:${packName}`;
    const packDir = path.join(packsRoot, packName);

    ensureDir(packDir);
    fs.writeFileSync(path.join(packDir, "build.gradle"), assetPackBuildGradle({ packName, deliveryType }), "utf8");

    // Pack içinde model dosyası olacak klasör
    ensureDir(path.join(packDir, "src", "main", "assets", "models"));

    const target = modelTargetPath(packDir, id);
    const local = findLocalSourceFile(m);
    const targetSize = exists(target) ? fs.statSync(target).size : 0;
    const needCopy = local || !exists(target) || targetSize === 0;

    if (local) {
      ensureDir(path.dirname(target));
      fs.copyFileSync(local, target);
      console.warn(`[gen:android-asset-packs] copied id=${id} ${path.basename(local)} (assets) -> ${toPosix(path.relative(projectRoot, target))}`);
    } else if (needCopy && m?.staticUrl) {
      console.warn(`[gen:android-asset-packs] downloading id=${id} from ${m.staticUrl}`);
      try {
        await downloadTo(m.staticUrl, target);
      } catch (err) {
        console.error(`[gen:android-asset-packs] DOWNLOAD FAILED id=${id} (${m?.name || filename}): ${err?.message || err}`);
        throw err;
      }
    } else if (needCopy) {
      const pathHint = String(m?.path || "").trim() || "(yok)";
      console.error(
        `[gen:android-asset-packs] MISSING SOURCE id=${id} (path=${pathHint}, groupId=${groupId}, filename=${filename}). Put .glb in assets/models/${groupId}/ or set path in manifest; or ensure staticUrl is reachable.`
      );
      throw new Error(`Model source missing: id=${id} ${filename}`);
    }

    packResults.push({ id, packName, target, name: m?.name || filename });
    includeLines.push(`include '${packModulePath}'`);
    includeLines.push(`project('${packModulePath}').projectDir = new File(rootProject.projectDir, 'asset-packs/${packName}')`);
    assetPacksList.push(packModulePath);
  }

  // generated-settings.gradle for settings.gradle to apply
  const settingsOut = path.join(packsRoot, "generated-settings.gradle");
  fs.writeFileSync(settingsOut, `// AUTO-GENERATED. DO NOT EDIT.\n${includeLines.join("\n")}\n`, "utf8");

  // asset-packs.gradle for app/build.gradle
  const appOut = path.join(packsRoot, "asset-packs.gradle");
  fs.writeFileSync(
    appOut,
    `// AUTO-GENERATED. DO NOT EDIT.\n` +
      `rootProject.ext.ppAssetPacks = [\n` +
      assetPacksList.map((x) => `  '${x}',`).join("\n") +
      `\n]\n`,
    "utf8"
  );

  console.warn(`[gen:android-asset-packs] wrote ${toPosix(path.relative(projectRoot, settingsOut))}`);
  console.warn(`[gen:android-asset-packs] wrote ${toPosix(path.relative(projectRoot, appOut))}`);

  // Her pack'ta model dosyası var ve boş değil mi doğrula (Car.glb vb. çizilebilsin)
  let hasError = false;
  for (const { id, packName, target, name } of packResults) {
    if (!exists(target)) {
      console.error(`[gen:android-asset-packs] VERIFY FAIL: pack ${packName} has no file ${path.basename(target)} (id=${id} ${name})`);
      hasError = true;
    } else {
      const size = fs.statSync(target).size;
      if (size === 0) {
        console.error(`[gen:android-asset-packs] VERIFY FAIL: pack ${packName} file is empty (id=${id} ${name})`);
        hasError = true;
      } else {
        console.warn(`[gen:android-asset-packs] ok id=${id} ${name} -> ${path.basename(target)} (${size} bytes)`);
      }
    }
  }
  if (hasError) {
    throw new Error(
      "Bazı pack'lerde model dosyası eksik veya boş. assets/models/<car|house|tree|grass>/ dosyası koyun veya staticUrl'nin erişilebilir olduğundan emin olun, sonra tekrar çalıştırın."
    );
  }
}

main().catch((e) => {
  console.error("[gen:android-asset-packs] FAILED:", e?.message || e);
  process.exitCode = 1;
});

