import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export type VrUnityEventName =
  | "calibration_complete"
  | "parcel_drawn"
  | "ar_step_changed"
  | "ar_readiness_changed"
  | "ar_tap_received"
  | "ar_tap_success"
  | "ar_tap_failed"
  | "unity_error";

export type VrUnityEventPayload = {
  event: VrUnityEventName;
  qualityScore?: number;
  step?: string;
  message?: string;
  ready?: boolean;
  planeCount?: number;
  tracking?: string;
  probeHit?: boolean;
  x?: number;
  y?: number;
  viewW?: number;
  viewH?: number;
  stage?: string;
};

const eventModule = NativeModules.VrUnityEventEmitter as object | undefined;

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!eventModule) return null;
  if (!emitter) emitter = new NativeEventEmitter(eventModule);
  return emitter;
}

export function subscribeVrUnityEvents(
  handler: (payload: VrUnityEventPayload) => void,
): () => void {
  const em = getEmitter();
  if (!em) return () => {};
  const sub = em.addListener("VrUnityEvent", handler);
  return () => sub.remove();
}
