import { NativeModules, Platform } from "react-native";
import type { VrSessionPayload } from "../types/mapReferencePoints";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import type { CalibrationTransform } from "../types/calibrationTransform";

type VrUnityNativeModule = {
  isAvailable: () => Promise<boolean>;
  getLinkStatus?: () => Promise<VrUnityLinkStatus>;
  openParcelSession: (jsonPayload: string) => Promise<void>;
  closeParcelSession: () => Promise<void>;
  sendUnityMessage?: (objectName: string, methodName: string, message: string) => void;
};

const nativeModule: VrUnityNativeModule | undefined =
  NativeModules.VrUnityModule as VrUnityNativeModule | undefined;

export type VrUnityLinkStatus = "missing_bridge" | "bridge_only" | "linked_stale_export" | "linked";

export function hasVrUnityNativeBridge(): boolean {
  return Boolean(nativeModule?.isAvailable);
}

export async function getVrUnityLinkStatus(): Promise<VrUnityLinkStatus> {
  if (!nativeModule?.isAvailable) return "missing_bridge";
  try {
    if (nativeModule.getLinkStatus) {
      const status = await nativeModule.getLinkStatus();
      if (
        status === "linked" ||
        status === "linked_stale_export" ||
        status === "bridge_only"
      ) {
        return status;
      }
    }
    return (await nativeModule.isAvailable()) ? "linked" : "bridge_only";
  } catch {
    return "missing_bridge";
  }
}

export async function isVrUnityAvailable(): Promise<boolean> {
  return (await getVrUnityLinkStatus()) === "linked";
}

export function buildVrSessionJson(payload: VrSessionPayload): string {
  return JSON.stringify(payload);
}

export async function openVrUnitySession(session: VrSessionPayload): Promise<boolean> {
  if (!nativeModule?.openParcelSession) {
    if (__DEV__) console.log("[VrUnityModule.ts] Native module yok");
    return false;
  }
  try {
    await nativeModule.openParcelSession(buildVrSessionJson(session));
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[VrUnityModule.ts:openVrUnitySession]", err);
    return false;
  }
}

/** @deprecated openVrUnitySession(session) kullanın */
export async function openVrUnitySessionLegacy(payload: VrParcelPayload): Promise<boolean> {
  return openVrUnitySession({
    parcel: payload,
    mode: Platform.OS === "ios" ? "arkit_standard" : "arcore_standard",
    mapReferences: {
      userPoint: payload.center,
      referenceA: payload.polygon[0] ?? payload.center,
      referenceB: payload.polygon[1] ?? payload.center,
    },
  });
}

export async function closeVrUnitySession(): Promise<void> {
  if (!nativeModule?.closeParcelSession) return;
  try {
    await nativeModule.closeParcelSession();
  } catch (err) {
    if (__DEV__) console.warn("[VrUnityModule.ts:closeVrUnitySession]", err);
  }
}

export function sendUnityMessage(objectName: string, methodName: string, message: string): void {
  nativeModule?.sendUnityMessage?.(objectName, methodName, message);
}

export function sendUnityFineTune(dx: number, dz: number, dyaw: number): void {
  sendUnityMessage("VrParcelBridge", "ApplyFineTune", `${dx},${dz},${dyaw}`);
}

export function sendUnityScaleFineTune(factor: number): void {
  sendUnityMessage("VrParcelBridge", "ApplyScaleFineTune", factor.toFixed(4));
}

export function sendUnityDrawParcel(): void {
  sendUnityMessage("VrParcelBridge", "DrawParcel", "");
}

export function sendUnityComputeCalibration(): void {
  sendUnityMessage("VrParcelBridge", "ComputeCalibrationFromThreePoints", "");
}

export function sendUnityScreenTap(x: number, y: number): void {
  sendUnityMessage("VrParcelBridge", "OnScreenTap", `${x},${y}`);
}

export type { CalibrationTransform };

export function getVrUnityPlatformLabel(): string {
  return Platform.OS === "ios" ? "ARKit" : "ARCore";
}

export function getUnityRequiredMessage(status: VrUnityLinkStatus = "bridge_only"): string {
  if (status === "missing_bridge") {
    return Platform.OS === "android"
      ? "VR native köprüsü bu APK'da yok. npm run android ile güncel development build kurun."
      : "VR native köprüsü bu uygulamada yok. Expo Go veya eski IPA ile çalışmaz; npm run eas:build:ios ile development IPA kurun.";
  }
  if (status === "linked_stale_export") {
    return Platform.OS === "android"
      ? "unityLibrary bağlı ama export AR içermiyor (Assembly-CSharp / AR Foundation eksik). Unity Editor'de VrParcelScene oluşturup Android export alın; aksi halde sanal zemin görünür, gerçek kamera açılmaz."
      : "UnityFramework bağlı ama export AR scriptlerini içermiyor. Unity iOS export + VrParcelScene yeniden alın.";
  }
  if (Platform.OS === "android") {
    return "unityLibrary henüz Gradle build'e bağlanmadı (VR_UNITY_LINKED=false). Unity Android export + npm run prebuild:android:safe gerekir.";
  }
  return "UnityFramework henüz Xcode build'e embed edilmedi (VR_UNITY_LINKED=0). Unity iOS export + Mac Xcode build gerekir.";
}
