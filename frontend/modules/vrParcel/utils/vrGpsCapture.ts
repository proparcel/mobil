import { Alert, Linking } from "react-native";

export {
  startVrGpsStream,
  stopVrGpsStream,
  getVrGpsSnapshot,
  subscribeVrGpsSnapshot,
  captureVrGpsReferenceStable,
  captureVrGpsReferenceBest,
  formatGpsQualityLabel,
  type VrGpsSnapshot,
  type VrGpsReference,
  type VrGpsSample,
} from "./vrGpsStream";

export {
  evaluateGpsReadiness,
  evaluateGpsValidationHint,
  evaluateWalkDistance,
  validateSecondReferenceWithMotion,
  VR_MIN_WALK_DISTANCE_M,
  VR_RECOMMENDED_WALK_DISTANCE_M,
  type VrGpsReadiness,
  type VrGpsReadinessPhase,
} from "./vrGpsReadiness";

export type VrGpsCapture = import("./vrGpsStream").VrGpsReference;

export function formatGpsCaptureLabel(ref: VrGpsCapture): string {
  return `±${Math.round(ref.gpsAccuracyM)} m · ${ref.confidence}`;
}

export function showVrGpsCaptureError(error: unknown, extra?: string): void {
  const base =
    error instanceof Error && error.message
      ? error.message
      : "Konum alınamadı. Açık alanda tekrar deneyin.";
  Alert.alert("Konum hatası", extra ? `${base}\n\n${extra}` : base, [
    { text: "Tamam", style: "cancel" },
    { text: "Ayarlar", onPress: () => Linking.openSettings() },
  ]);
}

/** Geriye dönük uyumluluk */
export const VR_MIN_REF_DISTANCE_M = 3;
