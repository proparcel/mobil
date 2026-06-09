import { Platform } from "react-native";

type Vec3 = { x: number; y: number; z: number };

let latestMag: Vec3 = { x: 0, y: 0, z: 0 };
let latestAcc: Vec3 = { x: 0, y: 1, z: 0 };
let headingDeg = 0;
let listeners = new Set<(heading: number) => void>();
let magSub: { remove: () => void } | null = null;
let accSub: { remove: () => void } | null = null;
let iosHeadingSub: { remove: () => void } | null = null;

function notify(): void {
  listeners.forEach((fn) => fn(headingDeg));
}

function setHeading(next: number): void {
  if (!Number.isFinite(next)) return;
  let h = next % 360;
  if (h < 0) h += 360;
  headingDeg = h;
  notify();
}

/** Android / yedek: manyetometre + ivmeölçer */
export function computeCompassHeadingDeg(magnetometer: Vec3, accelerometer: Vec3): number {
  const { x: mx, y: my, z: mz } = magnetometer;
  const { x: ax, y: ay, z: az } = accelerometer;
  const norm = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  const axn = ax / norm;
  const ayn = ay / norm;
  const azn = az / norm;

  const ex = ayn * mz - azn * my;
  const ey = azn * mx - axn * mz;
  const ez = axn * my - ayn * mx;

  const nx = my * ez - mz * ey;

  let heading = Math.atan2(ex, nx) * (180 / Math.PI);
  if (heading < 0) heading += 360;
  return heading;
}

function recomputeMagHeading(): void {
  setHeading(computeCompassHeadingDeg(latestMag, latestAcc));
}

async function startIosLocationHeading(): Promise<boolean> {
  try {
    const Location = await import("expo-location");
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      if (!req.granted) return false;
    }

    iosHeadingSub = await Location.watchHeadingAsync((event) => {
      const next = event.trueHeading >= 0 ? event.trueHeading : event.magHeading;
      setHeading(next);
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[vrDeviceHeading.ts] iOS heading baslatilamadi:", err);
    return false;
  }
}

function startMagnetometerHeading(): void {
  void (async () => {
    try {
      const { Magnetometer, Accelerometer } = await import("expo-sensors");
      const magAvailable = await Magnetometer.isAvailableAsync();
      const accAvailable = await Accelerometer.isAvailableAsync();
      if (!magAvailable || !accAvailable) return;

      Magnetometer.setUpdateInterval(100);
      Accelerometer.setUpdateInterval(100);
      magSub = Magnetometer.addListener((data) => {
        latestMag = data;
        recomputeMagHeading();
      });
      accSub = Accelerometer.addListener((data) => {
        latestAcc = data;
        recomputeMagHeading();
      });
    } catch (err) {
      if (__DEV__) console.warn("[vrDeviceHeading.ts] Manyetometre baslatilamadi:", err);
    }
  })();
}

export function getVrDeviceHeadingDeg(): number {
  return headingDeg;
}

export function startVrDeviceHeading(onUpdate?: (heading: number) => void): () => void {
  if (onUpdate) {
    listeners.add(onUpdate);
    onUpdate(headingDeg);
  }

  if (!magSub && !iosHeadingSub) {
    void (async () => {
      if (Platform.OS === "ios") {
        const ok = await startIosLocationHeading();
        if (ok) return;
      }
      startMagnetometerHeading();
    })();
  }

  return () => {
    if (onUpdate) listeners.delete(onUpdate);
    if (listeners.size === 0) {
      magSub?.remove();
      accSub?.remove();
      iosHeadingSub?.remove();
      magSub = null;
      accSub = null;
      iosHeadingSub = null;
    }
  };
}

export function stopVrDeviceHeading(): void {
  listeners.clear();
  magSub?.remove();
  accSub?.remove();
  iosHeadingSub?.remove();
  magSub = null;
  accSub = null;
  iosHeadingSub = null;
}
