#!/usr/bin/env node
/**
 * Mac: ios/ varsa pod install.
 * Windows / ios yok: bilgi mesajı (EAS Build pod install'ı Mac builder'da yapar).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const iosDir = path.join(frontendRoot, "ios");

if (!fs.existsSync(iosDir)) {
  console.log("[pod-install] ios/ klasörü yok — Windows'ta normal. iOS build EAS üzerinden alınır.");
  console.log("[pod-install] Yerel Mac build: npx expo prebuild --platform ios && npm run pod-install");
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.log("[pod-install] pod install yalnızca macOS'ta çalışır. EAS Build kullanın.");
  process.exit(0);
}

const pod = spawnSync("pod", ["install"], { cwd: iosDir, stdio: "inherit", shell: true });
process.exit(pod.status ?? 0);
