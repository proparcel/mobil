/**
 * Mapbox ModelLayer için GLB optimizasyonu (upload anında mobil “lite” üretmek).
 * Texture downscale, simplify, dedup, prune. Kategoriye göre parametreler config’ten.
 *
 * Usage: node scripts/optimize_glb.js --in <input.glb> --out <output_mb.glb> --category car [--config <path>]
 * Exit: 0 success, 1 usage/error.
 */
const path = require("path");
const fs = require("fs");

const COMPONENT_TYPE = { 5120: "i8", 5121: "u8", 5122: "i16", 5123: "u16", 5125: "u32", 5126: "f32" };

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { in: null, out: null, category: "car", config: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--in" && args[i + 1]) { out.in = args[++i]; continue; }
    if (args[i] === "--out" && args[i + 1]) { out.out = args[++i]; continue; }
    if (args[i] === "--category" && args[i + 1]) { out.category = String(args[++i]).toLowerCase(); continue; }
    if (args[i] === "--config" && args[i + 1]) { out.config = args[++i]; continue; }
  }
  return out;
}

function parseGLB(buffer) {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (dv.byteLength < 12) throw new Error("GLB too short");
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error("Invalid GLB magic");
  let offset = 12;
  let jsonChunk = null;
  const totalLength = dv.getUint32(8, true);
  while (offset < totalLength && offset + 8 <= dv.byteLength) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > dv.byteLength) break;
    if (chunkType === 0x4e4f534a) {
      const raw = new Uint8Array(buffer.buffer, buffer.byteOffset + chunkStart, chunkLength);
      jsonChunk = JSON.parse(new TextDecoder().decode(raw));
      break;
    }
    offset = chunkEnd;
  }
  if (!jsonChunk) throw new Error("GLB JSON chunk not found");
  return jsonChunk;
}

function metricsFromGLB(filePath) {
  const buf = fs.readFileSync(filePath);
  const json = parseGLB(buf);
  const accessors = json.accessors || [];
  const meshes = json.meshes || [];
  const textures = json.textures || [];
  let maxVertexCount = 0;
  const indexTypes = new Set();
  for (const mesh of meshes) {
    for (const p of mesh.primitives || []) {
      const posAcc = p.attributes?.POSITION;
      if (typeof posAcc === "number" && accessors[posAcc]) {
        const c = accessors[posAcc].count ?? 0;
        maxVertexCount = Math.max(maxVertexCount, c);
      }
      const idx = p.indices;
      if (typeof idx === "number" && accessors[idx]) {
        const ct = accessors[idx].componentType;
        indexTypes.add(COMPONENT_TYPE[ct] || `0x${ct}`);
      }
    }
  }
  return {
    byteLength: buf.length,
    extensionsUsed: json.extensionsUsed || [],
    extensionsRequired: json.extensionsRequired || [],
    maxVertexCountPerMesh: maxVertexCount,
    textureCount: textures.length,
    indexTypes: [...indexTypes].sort(),
  };
}

function logMetrics(label, m) {
  const format = (n) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
  console.warn(`[optimize_glb] ${label} byteLength=${format(m.byteLength)}`);
  console.warn(`[optimize_glb] ${label} extensionsUsed=${JSON.stringify(m.extensionsUsed)} extensionsRequired=${JSON.stringify(m.extensionsRequired)}`);
  console.warn(`[optimize_glb] ${label} maxVertexCountPerMesh=${m.maxVertexCountPerMesh} textureCount=${m.textureCount} indexTypes=${JSON.stringify(m.indexTypes)}`);
}

async function main() {
  const args = parseArgs();
  if (!args.in || !args.out) {
    console.error("[optimize_glb] Usage: node scripts/optimize_glb.js --in <input.glb> --out <output_mb.glb> [--category car|tree|grass|house] [--config <path>]");
    process.exit(1);
  }
  const absIn = path.resolve(args.in);
  const absOut = path.resolve(args.out);
  if (!fs.existsSync(absIn)) {
    console.error("[optimize_glb] Input not found:", absIn);
    process.exit(1);
  }
  const configPath = args.config
    ? path.resolve(args.config)
    : path.join(__dirname, "optimize_glb_config.json");
  let config = { car: { width: 1024, height: 1024, ratio: 0.25 } };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {
      console.warn("[optimize_glb] Config load failed, using defaults:", e.message);
    }
  }
  const params = config[args.category] || config.car;
  const width = Math.max(1, params.width | 0) || 1024;
  const height = Math.max(1, params.height | 0) || 1024;
  const ratio = Math.max(0, Math.min(1, params.ratio ?? 0.25));

  const startMs = Date.now();
  let metricsIn;
  try {
    metricsIn = metricsFromGLB(absIn);
  } catch (e) {
    console.error("[optimize_glb] Input metrics failed:", e.message);
    process.exit(1);
  }
  logMetrics("input", metricsIn);

  let sharp;
  let MeshoptSimplifier;
  try {
    sharp = require("sharp");
    MeshoptSimplifier = require("meshoptimizer").MeshoptSimplifier;
  } catch (e) {
    console.error("[optimize_glb] Missing deps. Install: npm i meshoptimizer sharp", e.message);
    process.exit(1);
  }

  const ext = require("@gltf-transform/extensions");
  const { NodeIO } = require("@gltf-transform/core");
  const { weld, simplify, dedup, prune, center, getBounds } = require("@gltf-transform/functions");
  const exts = [
    ext.KHRTextureTransform,
    ext.KHRMaterialsClearcoat,
    ext.KHRMaterialsTransmission,
    ext.KHRMaterialsSpecular,
    ext.KHRMaterialsIOR,
    ext.KHRMaterialsSheen,
    ext.KHRMaterialsVolume,
    ext.KHRMaterialsEmissiveStrength,
  ].filter(Boolean);
  const io = new NodeIO().registerExtensions(exts);

  let doc;
  try {
    doc = await io.read(absIn);
  } catch (e) {
    console.error("[optimize_glb] Read failed:", e.message);
    process.exit(1);
  }
  const root = doc.getRoot();
  const textures = root.listTextures();

  // Pivot sadece merkezde (center) olan modellerde zemine al; zaten bottom/below olanlara dokunma.
  const PIVOT_CENTER_THRESHOLD = 0.05; // minY < -0.05 ise geometry origin altında = pivot center
  let needsPivotBelow = false;
  const scenes = root.listScenes();
  if (scenes.length > 0) {
    try {
      const bbox = getBounds(scenes[0]);
      if (bbox && bbox.min != null) {
        const minY = Array.isArray(bbox.min) ? bbox.min[1] : (bbox.min.y != null ? bbox.min.y : null);
        if (typeof minY === "number" && minY < -PIVOT_CENTER_THRESHOLD) {
          needsPivotBelow = true;
          console.warn("[optimize_glb] Pivot center tespit edildi (minY=" + minY.toFixed(3) + "), center(pivot:below) uygulanacak.");
        }
      }
    } catch (e) {
      console.warn("[optimize_glb] getBounds atlandı:", e.message);
    }
  }

  for (const tex of textures) {
    const img = tex.getImage();
    if (!img || img.byteLength === 0) continue;
    const mime = (tex.getMimeType() || "").toLowerCase();
    const fmt = mime.includes("png") ? "png" : "jpeg";
    try {
      const buf = Buffer.from(img);
      let pipeline = sharp(buf).resize(width, height, { fit: "inside", withoutEnlargement: true });
      pipeline = fmt === "jpeg" ? pipeline.jpeg({ quality: 0.85 }) : pipeline.png();
      const resized = await pipeline.toBuffer();
      tex.setImage(new Uint8Array(resized));
      tex.setMimeType(fmt === "jpeg" ? "image/jpeg" : "image/png");
    } catch (e) {
      console.warn("[optimize_glb] Texture resize skip:", e.message);
    }
  }

  const transformSteps = [];
  if (needsPivotBelow) {
    transformSteps.push(center({ pivot: "below" }));
  }
  transformSteps.push(
    weld({}),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }),
    dedup(),
    prune()
  );
  try {
    await doc.transform(...transformSteps);
  } catch (e) {
    console.error("[optimize_glb] Transform failed:", e.message);
    process.exit(1);
  }

  const outDir = path.dirname(absOut);
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    console.error("[optimize_glb] mkdir failed:", outDir, e.message);
    process.exit(1);
  }
  try {
    await io.write(absOut, doc);
  } catch (e) {
    console.error("[optimize_glb] Write failed:", e.message);
    process.exit(1);
  }

  const durationMs = Date.now() - startMs;
  const statOut = fs.statSync(absOut);
  let metricsOut;
  try {
    metricsOut = metricsFromGLB(absOut);
  } catch (_) {
    metricsOut = { byteLength: statOut.size, extensionsUsed: [], extensionsRequired: [], maxVertexCountPerMesh: 0, textureCount: 0, indexTypes: [] };
  }
  logMetrics("output", metricsOut);
  const format = (n) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
  console.warn(`[optimize_glb] OK ${path.basename(absIn)} -> ${path.basename(absOut)} ${format(metricsIn.byteLength)} -> ${format(metricsOut.byteLength)} (${durationMs} ms) category=${args.category} width=${width} height=${height} ratio=${ratio}`);
}

main().catch((e) => {
  console.error("[optimize_glb] FAIL:", e.message || e);
  process.exit(1);
});
