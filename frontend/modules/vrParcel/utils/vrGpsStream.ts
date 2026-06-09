import { haversineMetres } from "./calibrationEngine";
import type { VrLocationReading } from "./VrLocationProvider";
import { getVrLocationOnce, watchVrLocation } from "./VrLocationProvider";

export type VrGpsSample = {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;
};

export type VrGpsSnapshot = {
  lat: number;
  lon: number;
  accuracyMedianM: number;
  positionStdDevM: number;
  sampleCount: number;
  stableForMs: number;
  confidence: "poor" | "fair" | "good";
  rawSamples: VrGpsSample[];
};

export type VrGpsReference = {
  latitude: number;
  longitude: number;
  gpsAccuracyM: number;
  positionStdDevM: number;
  stableForMs: number;
  sampleCount: number;
  capturedAt: string;
  confidence: VrGpsSnapshot["confidence"];
};

const BUFFER_WINDOW_MS = 15000;
const MAX_SAMPLES = 30;
const STALE_MS = 5000;
const FILTER_MAX_ACCURACY_M = 30;
const STABLE_STD_DEV_M = 6;
const GOOD_STD_DEV_M = 3;
const STABLE_DURATION_MS = 3000;
const UNSTABLE_RESET_MS = 2000;

let samples: VrGpsSample[] = [];
let stopWatch: (() => void) | null = null;
let stableSince: number | null = null;
let unstableSince: number | null = null;
let lastStableSnapshot: VrGpsSnapshot | null = null;
const snapshotListeners = new Set<(snapshot: VrGpsSnapshot | null) => void>();

function notifyListeners(): void {
  const snap = computeSnapshot() ?? lastStableSnapshot;
  snapshotListeners.forEach((fn) => fn(snap));
}

export function subscribeVrGpsSnapshot(
  listener: (snapshot: VrGpsSnapshot | null) => void,
): () => void {
  snapshotListeners.add(listener);
  listener(getVrGpsSnapshot());
  return () => {
    snapshotListeners.delete(listener);
  };
}

function pushSample(reading: VrLocationReading): void {
  const now = Date.now();
  samples.push({
    lat: reading.latitude,
    lon: reading.longitude,
    accuracy: reading.accuracyM,
    timestamp: reading.timestamp || now,
    speed: reading.speed,
    heading: reading.heading,
  });
  const cutoff = now - BUFFER_WINDOW_MS;
  samples = samples.filter((s) => s.timestamp >= cutoff).slice(-MAX_SAMPLES);
}

function median(values: number[]): number {
  if (!values.length) return 999;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(values: number[], med: number): number {
  if (!values.length) return 999;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations) || 0.001;
}

function filterSamples(raw: VrGpsSample[]): VrGpsSample[] {
  const now = Date.now();
  let list = raw.filter(
    (s) => now - s.timestamp <= STALE_MS && s.accuracy <= FILTER_MAX_ACCURACY_M,
  );
  if (list.length < 3) return list;

  const lats = list.map((s) => s.lat);
  const lons = list.map((s) => s.lon);
  const latMed = median(lats);
  const lonMed = median(lons);
  const latMad = mad(lats, latMed);
  const lonMad = mad(lons, lonMed);
  const threshold = 2.5;

  list = list.filter((s) => {
    const latOk = Math.abs(s.lat - latMed) <= threshold * latMad * 1e-5 + 1e-7;
    const lonOk = Math.abs(s.lon - lonMed) <= threshold * lonMad * 1e-5 + 1e-7;
    return latOk && lonOk;
  });

  return list;
}

function weightedMean(samplesFiltered: VrGpsSample[]): { lat: number; lon: number } {
  let wSum = 0;
  let lat = 0;
  let lon = 0;
  for (const s of samplesFiltered) {
    const w = 1 / Math.max(1, s.accuracy * s.accuracy);
    wSum += w;
    lat += s.lat * w;
    lon += s.lon * w;
  }
  if (wSum <= 0) {
    return { lat: samplesFiltered[0].lat, lon: samplesFiltered[0].lon };
  }
  return { lat: lat / wSum, lon: lon / wSum };
}

function computeStdDevM(center: { lat: number; lon: number }, list: VrGpsSample[]): number {
  if (list.length < 2) return 999;
  const dists = list.map((s) => haversineMetres(center.lat, center.lon, s.lat, s.lon));
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const variance = dists.reduce((a, d) => a + (d - mean) ** 2, 0) / dists.length;
  return Math.sqrt(variance);
}

function computeSnapshot(): VrGpsSnapshot | null {
  const filtered = filterSamples(samples);
  if (filtered.length < 3) return null;

  const center = weightedMean(filtered);
  const accuracyMedianM = median(filtered.map((s) => s.accuracy));
  const positionStdDevM = computeStdDevM(center, filtered);

  let confidence: VrGpsSnapshot["confidence"] = "poor";
  if (accuracyMedianM <= 15 && positionStdDevM <= GOOD_STD_DEV_M) confidence = "good";
  else if (accuracyMedianM <= 25 && positionStdDevM <= STABLE_STD_DEV_M) confidence = "fair";

  const isStableNow =
    positionStdDevM <= STABLE_STD_DEV_M && accuracyMedianM <= 35 && filtered.length >= 5;

  const now = Date.now();
  if (isStableNow) {
    if (stableSince == null) stableSince = now;
    unstableSince = null;
  } else {
    if (unstableSince == null) unstableSince = now;
    if (unstableSince && now - unstableSince >= UNSTABLE_RESET_MS) {
      stableSince = null;
    }
  }

  const stableForMs = stableSince != null ? now - stableSince : 0;

  const snapshot: VrGpsSnapshot = {
    lat: center.lat,
    lon: center.lon,
    accuracyMedianM,
    positionStdDevM,
    sampleCount: filtered.length,
    stableForMs,
    confidence,
    rawSamples: filtered,
  };

  if (stableForMs >= STABLE_DURATION_MS) {
    lastStableSnapshot = snapshot;
  }

  return snapshot;
}

export function startVrGpsStream(): void {
  if (stopWatch) return;
  samples = [];
  stableSince = null;
  unstableSince = null;
  lastStableSnapshot = null;

  const handle = watchVrLocation((reading) => {
    pushSample(reading);
    computeSnapshot();
    notifyListeners();
  });
  stopWatch = handle.stop;
}

export function stopVrGpsStream(): void {
  stopWatch?.();
  stopWatch = null;
  samples = [];
  stableSince = null;
  unstableSince = null;
  lastStableSnapshot = null;
}

export function getVrGpsSnapshot(): VrGpsSnapshot | null {
  return computeSnapshot() ?? lastStableSnapshot;
}

export async function captureVrGpsReferenceStable(): Promise<VrGpsReference> {
  let snapshot = getVrGpsSnapshot();
  if (!snapshot) {
    try {
      const reading = await getVrLocationOnce();
      pushSample(reading);
      snapshot = computeSnapshot();
    } catch {
      /* fallback below */
    }
  }

  if (!snapshot) {
    throw new Error("GPS sinyali henüz hazır değil. Telefonu birkaç saniye sabit tutun.");
  }

  return {
    latitude: snapshot.lat,
    longitude: snapshot.lon,
    gpsAccuracyM: snapshot.accuracyMedianM,
    positionStdDevM: snapshot.positionStdDevM,
    stableForMs: snapshot.stableForMs,
    sampleCount: snapshot.sampleCount,
    capturedAt: new Date().toISOString(),
    confidence: snapshot.confidence,
  };
}

/** @deprecated captureVrGpsReferenceStable kullanın */
export async function captureVrGpsReferenceBest(): Promise<VrGpsReference> {
  return captureVrGpsReferenceStable();
}

export type VrGpsLiveReading = VrGpsReference & {
  distanceFromRefM: number | null;
};

export function formatGpsQualityLabel(snapshot: VrGpsSnapshot | null): string {
  if (!snapshot) return "Sinyal bekleniyor";
  if (snapshot.confidence === "good") return "İyi";
  if (snapshot.confidence === "fair") return "Orta";
  return "Zayıf";
}
