/**
 * Metro / dev client deep link -> Enter URL manually metni
 * Ornek:
 *   node scripts/decode-metro-url.js "proparcel://expo-development-client/?url=https%3A%2F%2Fxxx.exp.direct"
 */
const input = process.argv.slice(2).join(" ").trim();
if (!input) {
  console.log("");
  console.log("Kullanim:");
  console.log('  node scripts/decode-metro-url.js "proparcel://expo-development-client/?url=..."');
  console.log("");
  console.log("Metro terminalindeki proparcel:// satirini tirnak icinde yapistirin.");
  process.exit(1);
}

const match = input.match(/[?&]url=([^&\s]+)/i);
if (!match) {
  console.error("url= parametresi bulunamadi.");
  process.exit(1);
}

const manualUrl = decodeURIComponent(match[1]);
console.log("");
console.log("Telefonda Enter URL manually -> su adresi YAZIN:");
console.log("");
console.log(`  ${manualUrl}`);
console.log("");
console.log("(proparcel:// degil, yalnizca https://... veya http://...)");
console.log("");
