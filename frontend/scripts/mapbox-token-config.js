const fs = require("fs");
const path = require("path");
const { ENV_PATH, USER_HOME_ENV_PATH, loadEnvFile } = require("./load-env-file");

const PUBLIC_TOKEN_KEY = "EXPO_PUBLIC_MAPBOX_TOKEN";
const DOWNLOAD_TOKEN_KEY = "RNMAPBOX_MAPS_DOWNLOAD_TOKEN";
const LEGACY_DOWNLOAD_TOKEN_KEY = "MAPBOX_DOWNLOADS_TOKEN";

function sourceFor(key) {
  const sources = [USER_HOME_ENV_PATH, ENV_PATH];
  for (let i = sources.length - 1; i >= 0; i -= 1) {
    const filePath = sources[i];
    if (!filePath || !fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf8");
    const re = new RegExp(`^\\s*${key}\\s*=`, "m");
    if (re.test(raw)) return path.relative(process.cwd(), filePath) || filePath;
  }
  return "process.env";
}

function readMapboxTokens() {
  loadEnvFile();
  const publicToken = (process.env[PUBLIC_TOKEN_KEY] || "").trim();
  const downloadToken = (
    process.env[DOWNLOAD_TOKEN_KEY] ||
    process.env[LEGACY_DOWNLOAD_TOKEN_KEY] ||
    ""
  ).trim();
  return {
    publicToken,
    downloadToken,
    publicSource: publicToken ? sourceFor(PUBLIC_TOKEN_KEY) : "",
    downloadSource: downloadToken
      ? sourceFor(process.env[DOWNLOAD_TOKEN_KEY] ? DOWNLOAD_TOKEN_KEY : LEGACY_DOWNLOAD_TOKEN_KEY)
      : "",
  };
}

function maskToken(token) {
  if (!token) return "(missing)";
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function validateMapboxTokens({ requirePublic = true, requireDownload = true } = {}) {
  const tokens = readMapboxTokens();
  const errors = [];
  const validPublic = tokens.publicToken.startsWith("pk.") && tokens.publicToken.length > 40;
  const validDownload =
    tokens.downloadToken.startsWith("sk.eyJ") &&
    tokens.downloadToken.length > 40 &&
    !/your|placeholder|token_here|\.\.\./i.test(tokens.downloadToken);
  if (requirePublic && !validPublic) {
    errors.push(`${PUBLIC_TOKEN_KEY}=pk... eksik`);
  }
  if (requireDownload && !validDownload) {
    errors.push(`${DOWNLOAD_TOKEN_KEY}=sk... eksik`);
  }
  return { ...tokens, errors, validPublic, validDownload };
}

function printMapboxTokenStatus({ requirePublic = true, requireDownload = true } = {}) {
  const status = validateMapboxTokens({ requirePublic, requireDownload });
  console.log(`[mapbox-env] ${PUBLIC_TOKEN_KEY}: ${maskToken(status.publicToken)}${status.publicSource ? ` (${status.publicSource})` : ""}`);
  console.log(`[mapbox-env] ${DOWNLOAD_TOKEN_KEY}: ${maskToken(status.downloadToken)}${status.downloadSource ? ` (${status.downloadSource})` : ""}`);
  if (status.errors.length) {
    console.error("[mapbox-env] HATA:", status.errors.join("; "));
    console.error(`[mapbox-env] Tek kalici kaynak: ${USER_HOME_ENV_PATH}`);
    console.error("[mapbox-env] Ornek:");
    console.error(`  ${PUBLIC_TOKEN_KEY}=pk...`);
    console.error(`  ${DOWNLOAD_TOKEN_KEY}=sk...`);
  }
  return status;
}

module.exports = {
  DOWNLOAD_TOKEN_KEY,
  LEGACY_DOWNLOAD_TOKEN_KEY,
  PUBLIC_TOKEN_KEY,
  readMapboxTokens,
  validateMapboxTokens,
  printMapboxTokenStatus,
  maskToken,
};
