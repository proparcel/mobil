/**
 * GLB sıkıştırma: Draco + quantize + prune.
 * Admin model eklerken mobil için küçültülmüş versiyon üretmek için kullanılır.
 *
 * Usage: node compress-glb-for-mobile.js <input.glb> <output.glb>
 * Exit: 0 success, 1 usage/error.
 */
const path = require("path");
const fs = require("fs");

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error("[compress-glb-for-mobile] Usage: node compress-glb-for-mobile.js <input.glb> <output.glb>");
    process.exit(1);
  }
  const absIn = path.resolve(inputPath);
  const absOut = path.resolve(outputPath);
  if (!fs.existsSync(absIn)) {
    console.error("[compress-glb-for-mobile] Input not found:", absIn);
    process.exit(1);
  }
  const outDir = path.dirname(absOut);
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    console.error("[compress-glb-for-mobile] mkdir failed:", outDir, e.message);
    process.exit(1);
  }

  const { NodeIO } = require("@gltf-transform/core");
  const { KHRDracoMeshCompression, KHRTextureTransform } = require("@gltf-transform/extensions");
  const { draco, quantize, prune } = require("@gltf-transform/functions");
  const draco3d = require("draco3dgltf");

  const encoder = await draco3d.createEncoderModule();
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, KHRTextureTransform])
    .registerDependencies({ "draco3d.encoder": encoder });

  const doc = await io.read(absIn);
  await doc.transform(prune(), quantize(), draco({ method: "edgebreaker" }));
  await io.write(absOut, doc);

  const stat = fs.statSync(absOut);
  const mb = (stat.size / (1024 * 1024)).toFixed(2);
  console.warn(`[compress-glb-for-mobile] OK ${path.basename(absIn)} -> ${path.basename(absOut)} (${mb} MB)`);
}

main().catch((e) => {
  console.error("[compress-glb-for-mobile] FAIL:", e.message || e);
  process.exit(1);
});
