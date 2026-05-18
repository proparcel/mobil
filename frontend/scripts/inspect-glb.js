/**
 * GLB inspect: extensions, textures, vertex attributes, skinning/morph/animation.
 * Outputs JSON report for Mapbox compatibility check (see doc/GLB_DIAGNOSTICS_CHECKLIST.md).
 *
 * Usage: node scripts/inspect-glb.js <input.glb> [output.json]
 *   output.json default: inspect-glb-report.json (same dir as input)
 * Exit: 0 success, 1 usage/error.
 */
const path = require("path");
const fs = require("fs");

function parseGLB(buffer) {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (dv.byteLength < 12) throw new Error("GLB too short");
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error("Invalid GLB magic");
  const version = dv.getUint32(4, true);
  const totalLength = dv.getUint32(8, true);
  let offset = 12;
  let jsonChunk = null;
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
  return { version, json: jsonChunk };
}

function inspectFromJSON(json, byteLength) {
  const extUsed = json.extensionsUsed || [];
  const extReq = json.extensionsRequired || [];
  const images = json.images || [];
  const textures = json.textures || [];
  const accessors = json.accessors || [];
  const meshes = json.meshes || [];
  const animations = json.animations || [];
  const skins = json.skins || [];

  const textureInfos = textures.map((t, i) => {
    const src = t.source;
    const img = src != null && images[src] ? images[src] : {};
    return {
      index: i,
      mimeType: img.mimeType || null,
      uri: img.uri || null,
    };
  });

  const vertexAttributes = new Set();
  let hasMorph = false;
  const meshSummary = [];
  let maxVertexCount = 0;

  for (const mesh of meshes) {
    const prims = mesh.primitives || [];
    let meshVertexMax = 0;
    const primSummary = [];
    for (const p of prims) {
      const attrs = p.attributes || {};
      Object.keys(attrs).forEach((k) => vertexAttributes.add(k));
      const posAcc = attrs.POSITION;
      let count = 0;
      if (typeof posAcc === "number" && accessors[posAcc]) {
        count = accessors[posAcc].count ?? 0;
        meshVertexMax = Math.max(meshVertexMax, count);
      }
      hasMorph = hasMorph || !!(p.targets && p.targets.length > 0);
      primSummary.push({
        attributes: Object.keys(attrs),
        vertexCount: count,
        targets: (p.targets || []).length,
      });
    }
    maxVertexCount = Math.max(maxVertexCount, meshVertexMax);
    meshSummary.push({
      name: mesh.name || null,
      primitiveCount: prims.length,
      primitives: primSummary,
      maxVertexCountPerPrimitive: meshVertexMax,
    });
  }

  const mapboxBlockers = [];
  const unsupportedExt = [
    "KHR_materials_transmission",
    "KHR_materials_clearcoat",
    "KHR_materials_ior",
    "KHR_materials_specular",
    "KHR_materials_sheen",
    "KHR_materials_volume",
    "EXT_texture_webp",
    "KHR_texture_basisu",
  ];
  for (const e of extUsed) {
    if (unsupportedExt.includes(e)) mapboxBlockers.push(e);
  }
  if (animations.length > 0) mapboxBlockers.push("hasAnimation");
  if (skins.length > 0) mapboxBlockers.push("hasSkinning");
  if (hasMorph) mapboxBlockers.push("hasMorph");
  for (const m of meshSummary) {
    if (m.maxVertexCountPerPrimitive > 65536) {
      mapboxBlockers.push("vertexCount>65536");
      break;
    }
  }
  for (const ti of textureInfos) {
    const m = (ti.mimeType || "").toLowerCase();
    if (m.includes("webp") || m.includes("basis")) {
      mapboxBlockers.push("textureWebPOrBasis");
      break;
    }
  }

  return {
    byteLength,
    extensionsUsed: extUsed,
    extensionsRequired: extReq,
    textures: textureInfos,
    vertexAttributes: [...vertexAttributes].sort(),
    hasSkinning: skins.length > 0,
    hasMorph,
    hasAnimation: animations.length > 0,
    meshes: meshSummary,
    maxVertexCountPerMesh: maxVertexCount,
    mapboxFriendly: mapboxBlockers.length === 0,
    mapboxBlockers: [...new Set(mapboxBlockers)],
  };
}

async function run() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || path.join(path.dirname(path.resolve(inputPath)), "inspect-glb-report.json");
  if (!inputPath) {
    console.error("[inspect-glb] Usage: node scripts/inspect-glb.js <input.glb> [output.json]");
    process.exit(1);
  }
  const absIn = path.resolve(inputPath);
  if (!fs.existsSync(absIn)) {
    console.error("[inspect-glb] Input not found:", absIn);
    process.exit(1);
  }
  const buf = fs.readFileSync(absIn);
  const { json } = parseGLB(buf);
  const report = inspectFromJSON(json, buf.length);
  report.file = path.basename(inputPath);

  const outDir = path.dirname(path.resolve(outputPath));
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    console.error("[inspect-glb] mkdir failed:", outDir, e.message);
    process.exit(1);
  }
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.warn("[inspect-glb] OK", path.basename(inputPath), "->", path.basename(outputPath));
  console.warn("[inspect-glb] mapboxFriendly:", report.mapboxFriendly, "mapboxBlockers:", report.mapboxBlockers);
}

run().catch((e) => {
  console.error("[inspect-glb] FAIL:", e.message || e);
  process.exit(1);
});
