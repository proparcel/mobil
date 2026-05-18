// debug-parse.js
const fs = require("fs");
const acorn = require("acorn");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node debug-parse.js <path-to-generated-handlers.js>");
  process.exit(1);
}

const code = fs.readFileSync(file, "utf8");

try {
  acorn.parse(code, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowReturnOutsideFunction: true,
  });
  console.log("OK: parse passed");
} catch (e) {
  console.error("PARSE FAIL:", e.message);
  console.error("Location:", { line: e.loc?.line, col: e.loc?.column });

  const lines = code.split("\n");
  const L = (e.loc?.line || 1) - 1;

  const start = Math.max(0, L - 15);
  const end = Math.min(lines.length, L + 10);

  console.error("\n--- Context ---");
  for (let i = start; i < end; i++) {
    const mark = i === L ? ">>" : "  ";
    console.error(`${mark} ${(i + 1).toString().padStart(4, " ")}: ${lines[i]}`);
  }

  // 200-char window around error position
  const idx = e.pos || 0;
  const w0 = Math.max(0, idx - 200);
  const w1 = Math.min(code.length, idx + 200);
  console.error("\n--- Window ---");
  console.error(code.slice(w0, w1));
  process.exit(2);
}
