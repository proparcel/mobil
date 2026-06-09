#!/usr/bin/env node
/**
 * Terrain 3D deneme loglarini okur (Metro sync -> frontend/logs/terrain3d/).
 * Cihaz bagliysa once adb'den en guncel log cekilir.
 *
 * Kullanim:
 *   node scripts/read-terrain-logs.js
 *   node scripts/read-terrain-logs.js ta_20260608_180012_abcd
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_DIR = path.join(__dirname, '..', 'logs', 'terrain3d');
const PACKAGE = 'com.proparcel.mobile';

/** Windows PowerShell utf8 BOM veya baska prefix — JSON.parse kirilmasin. */
function readText(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function summarize(log) {
  const events = log.events || [];
  const errors = events.filter((e) => e.level === 'error');
  const unity = events.filter((e) => e.source === 'unity');
  const kotlin = events.filter((e) => e.source === 'kotlin');
  return {
    attemptId: log.attemptId,
    status: log.status,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    meta: log.meta,
    eventCount: events.length,
    errorCount: errors.length,
    unityEvents: unity.length,
    kotlinEvents: kotlin.length,
    lastEvents: events.slice(-8),
    errors: errors.slice(-5),
  };
}

function listLocalAttemptFiles() {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith('ta_') && f.endsWith('.json'))
    .sort()
    .reverse();
}

function tryPullLatestFromDevice() {
  try {
    execSync('adb get-state', { stdio: 'pipe' });
    const listRaw = execSync(
      `adb shell run-as ${PACKAGE} ls files/terrain3d-logs/`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const remoteFiles = listRaw
      .split(/\s+/)
      .filter((f) => f.startsWith('ta_') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (remoteFiles.length === 0) return null;

    const remoteName = remoteFiles[0];
    const jsonRaw = execSync(
      `adb exec-out run-as ${PACKAGE} cat files/terrain3d-logs/${remoteName}`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    let text = jsonRaw;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const parsed = JSON.parse(text);

    fs.mkdirSync(LOG_DIR, { recursive: true });
    const localPath = path.join(LOG_DIR, remoteName);
    writeJson(localPath, parsed);
    writeJson(path.join(LOG_DIR, 'latest.json'), {
      attemptId: parsed.attemptId,
      file: localPath,
      savedAt: new Date().toISOString(),
      source: 'adb',
    });
    return remoteName;
  } catch {
    return null;
  }
}

function resolveLatestLocalFile() {
  const files = listLocalAttemptFiles();
  return files.length > 0 ? path.join(LOG_DIR, files[0]) : null;
}

function main() {
  const attemptArg = process.argv[2];
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const pulled = tryPullLatestFromDevice();
  if (pulled) {
    console.log(`[read-terrain-logs] adb sync ${pulled}`);
  }

  if (attemptArg) {
    const file = path.join(LOG_DIR, `${attemptArg}.json`);
    if (!fs.existsSync(file)) {
      console.error('[read-terrain-logs] Dosya yok:', file);
      process.exit(1);
    }
    console.log(JSON.stringify(summarize(readJson(file)), null, 2));
    return;
  }

  const latestFile = resolveLatestLocalFile();
  if (!latestFile) {
    console.error('[read-terrain-logs] Henuz log yok. 3D demo acip kapat; Metro acik olsun veya adb bagli olsun.');
    process.exit(1);
  }

  const log = readJson(latestFile);
  console.log('[read-terrain-logs]', path.basename(latestFile));
  console.log(JSON.stringify(summarize(log), null, 2));
}

main();
