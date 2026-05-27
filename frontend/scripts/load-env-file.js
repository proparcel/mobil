/**
 * ProParcel mobile env loader.
 *
 * Source order:
 * 1) %USERPROFILE%/.proparcel/mobile.env  (machine-wide, shared by clones/build folders)
 * 2) frontend/.env                        (repo-local override)
 * 3) real process.env                     (CI/EAS shell always wins)
 */
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");
const USER_HOME_ENV_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".proparcel",
  "mobile.env",
);

function parseEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvFile(envPath) {
  const paths = envPath ? [envPath] : [USER_HOME_ENV_PATH, ENV_PATH];
  const merged = {};
  for (const filePath of paths) {
    Object.assign(merged, parseEnvFile(filePath));
  }
  for (const [key, value] of Object.entries(merged)) {
    if (!process.env[key]) process.env[key] = value;
  }
  return merged;
}

module.exports = { loadEnvFile, ENV_PATH, USER_HOME_ENV_PATH };
