import type { VrGpsSnapshot } from "./vrGpsStream";

export type VrGpsReadinessPhase = "point_a" | "point_b";

export type VrGpsReadinessStatus =
  | "waiting_signal"
  | "warming_up"
  | "moving"
  | "unstable"
  | "acceptable"
  | "stable"
  | "poor_accuracy";

export type VrGpsReadiness = {
  canCapture: boolean;
  canCaptureRecommended: boolean;
  status: VrGpsReadinessStatus;
  suggestedAction: string;
  accuracyMedianM: number;
  positionStdDevM: number;
  stableForMs: number;
  sampleCount: number;
  qualityColor: "red" | "yellow" | "green";
};

export const VR_MIN_WALK_DISTANCE_M = 3;
export const VR_RECOMMENDED_WALK_DISTANCE_M = 5;

const STABLE_MS = 3000;
const MIN_SAMPLES = 5;
const POOR_ACCURACY_M = 35;

export function evaluateGpsReadiness(
  snapshot: VrGpsSnapshot | null,
  _phase: VrGpsReadinessPhase,
): VrGpsReadiness {
  const empty: VrGpsReadiness = {
    canCapture: false,
    canCaptureRecommended: false,
    status: "waiting_signal",
    suggestedAction: "GPS sinyali alınıyor. Lütfen bekleyin.",
    accuracyMedianM: 999,
    positionStdDevM: 999,
    stableForMs: 0,
    sampleCount: 0,
    qualityColor: "red",
  };

  if (!snapshot || snapshot.sampleCount < 3) {
    return { ...empty, status: "warming_up", suggestedAction: "GPS sinyali alınıyor. Lütfen bekleyin." };
  }

  const {
    accuracyMedianM,
    positionStdDevM,
    stableForMs,
    sampleCount,
  } = snapshot;

  const base = {
    accuracyMedianM,
    positionStdDevM,
    stableForMs,
    sampleCount,
  };

  if (accuracyMedianM > POOR_ACCURACY_M) {
    return {
      ...base,
      canCapture: false,
      canCaptureRecommended: false,
      status: "poor_accuracy",
      suggestedAction: "Konum hassasiyeti düşük. Açık alana çıkın ve birkaç saniye bekleyin.",
      qualityColor: "red",
    };
  }

  if (positionStdDevM > 8) {
    return {
      ...base,
      canCapture: false,
      canCaptureRecommended: false,
      status: "unstable",
      suggestedAction: "Telefonu sabit tutun. Konum dengeleniyor.",
      qualityColor: "red",
    };
  }

  if (sampleCount < MIN_SAMPLES || stableForMs < STABLE_MS) {
    const remain = Math.max(0, Math.ceil((STABLE_MS - stableForMs) / 1000));
    return {
      ...base,
      canCapture: snapshot.confidence === "fair",
      canCaptureRecommended: false,
      status: "warming_up",
      suggestedAction:
        remain > 0
          ? `Telefonu sabit tutun. Dengeleniyor: ${remain} sn`
          : "Konum dengeleniyor…",
      qualityColor: "yellow",
    };
  }

  if (accuracyMedianM <= 15 && positionStdDevM <= 3) {
    return {
      ...base,
      canCapture: true,
      canCaptureRecommended: true,
      status: "stable",
      suggestedAction: "Şimdi kaydedebilirsiniz.",
      qualityColor: "green",
    };
  }

  return {
    ...base,
    canCapture: true,
    canCaptureRecommended: false,
    status: "acceptable",
    suggestedAction: "Kaydedilebilir. Daha hassas sonuç için biraz daha bekleyebilirsiniz.",
    qualityColor: "yellow",
  };
}

export type WalkDistanceQuality = "too_short" | "low" | "good" | "excellent";

export function evaluateWalkDistance(distanceM: number): {
  quality: WalkDistanceQuality;
  message: string;
  canProceed: boolean;
  needsOverride: boolean;
} {
  if (distanceM < VR_MIN_WALK_DISTANCE_M) {
    return {
      quality: "too_short",
      message: `Yürünen mesafe: ${distanceM.toFixed(1)} m — en az ${VR_MIN_WALK_DISTANCE_M} m yürüyün.`,
      canProceed: false,
      needsOverride: false,
    };
  }
  if (distanceM < VR_RECOMMENDED_WALK_DISTANCE_M) {
    return {
      quality: "low",
      message: `${distanceM.toFixed(1)} m — kabul edilebilir; 5–10 m daha doğru sonuç verir.`,
      canProceed: true,
      needsOverride: false,
    };
  }
  if (distanceM < 10) {
    return {
      quality: "good",
      message: `${distanceM.toFixed(1)} m — iyi mesafe.`,
      canProceed: true,
      needsOverride: false,
    };
  }
  return {
    quality: "excellent",
    message: `${distanceM.toFixed(1)} m — çok iyi mesafe.`,
    canProceed: true,
    needsOverride: false,
  };
}

export function validateSecondReferenceWithMotion(
  walkDistanceM: number,
  gpsDistanceM: number,
  refAAccuracy: number,
  refBAccuracy: number,
  userOverride: boolean,
): { ok: boolean; message: string; warning?: string } {
  const walk = evaluateWalkDistance(walkDistanceM);

  if (!walk.canProceed && !userOverride) {
    return { ok: false, message: walk.message };
  }

  if (!walk.canProceed && userOverride) {
    return {
      ok: true,
      message: "Kullanıcı onayı ile kaydedildi.",
      warning: "Yürüme mesafesi kısa; kalibrasyon hassasiyeti düşük olabilir.",
    };
  }

  let warning: string | undefined;
  if (Math.abs(gpsDistanceM - walkDistanceM) > 8 && gpsDistanceM < VR_MIN_WALK_DISTANCE_M) {
    warning =
      "GPS ölçümü kararsız. Kalibrasyon hareket takibine göre yapılacak.";
  }

  const maxAcc = Math.max(refAAccuracy, refBAccuracy);
  if (maxAcc > 25) {
    warning = (warning ? `${warning} ` : "") + `GPS hassasiyeti ±${Math.round(maxAcc)} m.`;
  }

  return {
    ok: true,
    message: walk.message,
    warning,
  };
}

/** GPS yalnızca saha doğrulama — kalibrasyon kaynağı değil */
export function evaluateGpsValidationHint(snapshot: VrGpsSnapshot | null): string | undefined {
  const readiness = evaluateGpsReadiness(snapshot, "point_a");
  if (readiness.status === "poor_accuracy" || readiness.status === "unstable") {
    return readiness.suggestedAction;
  }
  if (readiness.status === "waiting_signal" || readiness.status === "warming_up") {
    return "GPS sinyali alınıyor; harita referansları ana kaynak olarak kullanılacak.";
  }
  return undefined;
}
