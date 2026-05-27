/**
 * ScreenShield – ParcelSplit ekran koruma (3 katman).
 * JS API: enable/disable, setOverlayVisible.
 * Native event'leri dinler: captureChanged, screenshotDetected.
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { ScreenShield: ScreenShieldNative } = NativeModules;

export type ScreenShieldMode = "parcelSplit";

export interface ScreenShieldEnableOptions {
  mode: ScreenShieldMode;
}

type CaptureChangedListener = (active: boolean) => void;
type ScreenshotDetectedListener = () => void;

let eventEmitter: NativeEventEmitter | null = null;
let captureSub: { remove: () => void } | null = null;
let screenshotSub: { remove: () => void } | null = null;

const CAPTURE_CHANGED = "ScreenShieldCaptureChanged";
const SCREENSHOT_DETECTED = "ScreenShieldScreenshotDetected";

function getEmitter(): NativeEventEmitter | null {
  if (!ScreenShieldNative || eventEmitter) {
    return eventEmitter;
  }
  const hasListeners =
    typeof ScreenShieldNative.addListener === 'function' &&
    (typeof ScreenShieldNative.removeListeners === 'function' ||
      typeof ScreenShieldNative.removeListener === 'function');
  if (!hasListeners) {
    return null;
  }
  eventEmitter = new NativeEventEmitter(ScreenShieldNative);
  return eventEmitter;
}

/**
 * ParcelSplit odaktayken çağrılır. FLAG_SECURE (Android) + overlay dinleyicileri aktif edilir.
 */
export function enable(options: ScreenShieldEnableOptions): void {
  if (ScreenShieldNative && typeof ScreenShieldNative.enable === "function") {
    ScreenShieldNative.enable(options);
  }
}

/**
 * ParcelSplit'tan çıkınca çağrılır. FLAG_SECURE kaldırılır, overlay kapatılır.
 */
export function disable(): void {
  if (ScreenShieldNative && typeof ScreenShieldNative.disable === "function") {
    ScreenShieldNative.disable();
  }
  if (captureSub) {
    captureSub.remove();
    captureSub = null;
  }
  if (screenshotSub) {
    screenshotSub.remove();
    screenshotSub = null;
  }
}

/**
 * Fake screen overlay'ı göster/gizle (ProParcel sayfası).
 */
export function setOverlayVisible(visible: boolean): void {
  if (ScreenShieldNative && typeof ScreenShieldNative.setOverlayVisible === "function") {
    ScreenShieldNative.setOverlayVisible(visible);
  }
}

/**
 * Ekran kaydı / mirroring aktif mi değişimini dinle (iOS isCaptured, Android casting).
 * Listener (active: boolean) çağrılır.
 */
export function addCaptureChangedListener(listener: CaptureChangedListener): () => void {
  const emitter = getEmitter();
  if (!emitter) return () => {};
  const sub = emitter.addListener(CAPTURE_CHANGED, (payload: { active?: boolean }) => {
    listener(Boolean(payload?.active));
  });
  return () => sub.remove();
}

/**
 * Screenshot alındığında tetiklenir (Android 14+, iOS).
 * Overlay 1–2 sn gösterilecek.
 */
export function addScreenshotDetectedListener(listener: ScreenshotDetectedListener): () => void {
  const emitter = getEmitter();
  if (!emitter) return () => {};
  const sub = emitter.addListener(SCREENSHOT_DETECTED, listener);
  return () => sub.remove();
}

export const isAvailable = Boolean(ScreenShieldNative);
