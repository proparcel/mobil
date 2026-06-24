/**
 * release_builds/*-policy.json dosyasını pp33 backend'e uygular.
 *
 * Kullanım:
 *   node ./scripts/deploy-release-policy.js
 *   node ./scripts/deploy-release-policy.js release_builds/ProParcel-2.0.11-policy.json
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const SSH_HOST = process.env.PP33_SSH_HOST || "administrator@178.210.168.33";
const REMOTE_POLICY_PATH =
  process.env.PP33_POLICY_PATH || "C:/proparcel/data/mobile_app_version_policy.json";

function findLatestPolicyFile() {
  const outDir = path.join(root, "release_builds");
  if (!fs.existsSync(outDir)) return null;
  const files = fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith("-policy.json"))
    .map((name) => ({ name, mtime: fs.statSync(path.join(outDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? path.join(outDir, files[0].name) : null;
}

function toApiPayload(policy) {
  return {
    ios: {
      min_version: policy.ios.min_version,
      latest_version: policy.ios.latest_version,
      force_message: policy.ios.force_message,
      optional_message: policy.ios.optional_message,
    },
    android: {
      min_version: policy.android.min_version,
      min_build: policy.android.min_build,
      latest_version: policy.android.latest_version,
      latest_build: policy.android.latest_build,
      force_message: policy.android.force_message,
      optional_message: policy.android.optional_message,
    },
  };
}

function main() {
  const argPath = process.argv[2];
  const policyPath = argPath ? path.resolve(argPath) : findLatestPolicyFile();
  if (!policyPath || !fs.existsSync(policyPath)) {
    console.error("[deploy-release-policy] Policy dosyasi bulunamadi.");
    console.error("Once: node ./scripts/prepare-release-policy.js --optional|--force");
    process.exit(1);
  }

  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const apiPayload = toApiPayload(policy);
  const localTmp = path.join(root, "release_builds", ".deploy-policy.tmp.json");
  fs.writeFileSync(localTmp, JSON.stringify(apiPayload, null, 2), "utf8");

  const remoteDir = path.posix.dirname(REMOTE_POLICY_PATH.replace(/\\/g, "/"));
  const scpTarget = `${SSH_HOST}:${REMOTE_POLICY_PATH}`;

  console.log("[deploy-release-policy] Yukleniyor:", policyPath);
  console.log("[deploy-release-policy] Hedef:", REMOTE_POLICY_PATH);

  const mkdir = spawnSync(
    "ssh",
    ["-o", "ConnectTimeout=15", "-o", "BatchMode=yes", SSH_HOST, `if not exist "${remoteDir}" mkdir "${remoteDir}"`],
    { stdio: "inherit", shell: false },
  );
  if (mkdir.status !== 0) process.exit(mkdir.status || 1);

  const scp = spawnSync("scp", ["-o", "ConnectTimeout=15", "-o", "BatchMode=yes", localTmp, scpTarget], {
    stdio: "inherit",
    shell: false,
  });
  fs.unlinkSync(localTmp);
  if (scp.status !== 0) process.exit(scp.status || 1);

  console.log("[deploy-release-policy] Tamam");
  console.log("  Mod:", policy.updateMode);
  console.log("  Surum:", policy.version);
}

main();
