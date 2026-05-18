/**
 * GLB → "minimal PBR" for Mapbox compatibility testing.
 * - prune, dedup, flatten; optional quantize.
 * - Does NOT strip clearcoat/transmission/ior/specular (re-export without those extensions).
 * - Does NOT split >65k vertex primitives (use simplify + meshoptimizer or re-export).
 *
 * Usage: node scripts/glb-to-minimal-pbr.js <input.glb> <output.glb> [--quantize]
 * Exit: 0 success, 1 usage/error.
 *
 * See doc/GLB_DIAGNOSTICS_CHECKLIST.md for full recipe.
 */
const path = require("path");
const fs = require("fs");

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const outputPath = args.filter((a) => !a.startsWith("--"))[1];
  const quantize = args.includes("--quantize");
  if (!inputPath || !outputPath) {
    console.error("[glb-to-minimal-pbr] Usage: node scripts/glb-to-minimal-pbr.js <input.glb> <output.glb> [--quantize]");
    process.exit(1);
  }
  const absIn = path.resolve(inputPath);
  const absOut = path.resolve(outputPath);
  if (!fs.existsSync(absIn)) {
    console.error("[glb-to-minimal-pbr] Input not found:", absIn);
    process.exit(1);
  }
  const outDir = path.dirname(absOut);
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    console.error("[glb-to-minimal-pbr] mkdir failed:", outDir, e.message);
    process.exit(1);
  }

  const { NodeIO } = require("@gltf-transform/core");
  const ext = require("@gltf-transform/extensions");
  const { prune, dedup, flatten, quantize: quantizeFn } = require("@gltf-transform/functions");

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
  const doc = await io.read(absIn);

  const steps = [prune(), dedup(), flatten()];
  if (quantize) steps.push(quantizeFn());
  await doc.transform(...steps);

  await io.write(absOut, doc);

  const stat = fs.statSync(absOut);
  const mb = (stat.size / (1024 * 1024)).toFixed(2);
  console.warn("[glb-to-minimal-pbr] OK", path.basename(absIn), "->", path.basename(absOut), `(${mb} MB)`);
  console.warn("[glb-to-minimal-pbr] Run inspect-glb on output; clearcoat/transmission/ior/specular and >65k vertices require re-export or simplify.");
}

main().catch((e) => {
  console.error("[glb-to-minimal-pbr] FAIL:", e.message || e);
  process.exit(1);
});
