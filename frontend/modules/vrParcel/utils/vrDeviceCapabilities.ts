import { NativeModules, Platform } from "react-native";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";

export type VrDeviceCapabilities = {
  platform: "ios" | "android" | "unknown";
  supportsAR: boolean;
  supportsARKit?: boolean;
  supportsARCore?: boolean;
  supportsLiDAR?: boolean;
  supportsSceneDepth?: boolean;
  supportsSmoothedSceneDepth?: boolean;
  supportsPlaneDetection?: boolean;
  supportsRaycast?: boolean;
  supportsAnchors?: boolean;
  supportsExternalGnss?: boolean;
  externalGnssSource?: "bluetooth_nmea" | "usb" | "unknown";
  arCoreInstallStatus?: string;
  recommendedMode: VrCalibrationMode;
  reason?: string;
};

type NativeCaps = {
  platform?: string;
  supportsARKit?: boolean;
  supportsARCore?: boolean;
  supportsLiDAR?: boolean;
  supportsSceneDepth?: boolean;
  supportsSmoothedSceneDepth?: boolean;
  supportsPlaneDetection?: boolean;
  supportsRaycast?: boolean;
  supportsAnchors?: boolean;
  supportsExternalGnss?: boolean;
  externalGnssSource?: string;
  arCoreInstallStatus?: string;
};

const nativeModule = NativeModules.VrArCapabilitiesModule as
  | { detectCapabilities?: () => Promise<NativeCaps> }
  | undefined;

function fallbackCapabilities(): VrDeviceCapabilities {
  const platform =
    Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
  const supportsAR = platform === "ios" || platform === "android";
  return {
    platform,
    supportsAR,
    supportsARKit: platform === "ios",
    supportsARCore: platform === "android",
    supportsPlaneDetection: supportsAR,
    supportsRaycast: supportsAR,
    supportsAnchors: supportsAR,
    recommendedMode: platform === "android" ? "arcore_standard" : platform === "ios" ? "arkit_standard" : "unsupported",
    reason: "Native capability modülü yok; ARCore/ARKit varsayılan modu.",
  };
}

export async function detectVrDeviceCapabilities(): Promise<VrDeviceCapabilities> {
  if (!nativeModule?.detectCapabilities) {
    return fallbackCapabilities();
  }
  try {
    const raw = await nativeModule.detectCapabilities();
    const { selectVrCalibrationMode } = await import("./vrModeSelector");
    const { detectExternalGnssStatus } = await import("./vrExternalGnss");
    const externalGnss = await detectExternalGnssStatus();
    const caps: VrDeviceCapabilities = {
      platform:
        raw.platform === "ios" || raw.platform === "android"
          ? raw.platform
          : Platform.OS === "ios"
            ? "ios"
            : Platform.OS === "android"
              ? "android"
              : "unknown",
      supportsAR: Boolean(raw.supportsARKit || raw.supportsARCore),
      supportsARKit: raw.supportsARKit,
      supportsARCore: raw.supportsARCore,
      supportsLiDAR: raw.supportsLiDAR,
      supportsSceneDepth: raw.supportsSceneDepth,
      supportsSmoothedSceneDepth: raw.supportsSmoothedSceneDepth,
      supportsPlaneDetection: raw.supportsPlaneDetection ?? Boolean(raw.supportsARKit || raw.supportsARCore),
      supportsRaycast: raw.supportsRaycast ?? Boolean(raw.supportsARKit || raw.supportsARCore),
      supportsAnchors: raw.supportsAnchors ?? Boolean(raw.supportsARKit || raw.supportsARCore),
      supportsExternalGnss: Boolean(raw.supportsExternalGnss || externalGnss.connected),
      externalGnssSource: externalGnss.source,
      arCoreInstallStatus: raw.arCoreInstallStatus,
      recommendedMode: "unsupported",
      reason: raw.arCoreInstallStatus,
    };
    caps.recommendedMode = selectVrCalibrationMode(caps);
    return caps;
  } catch (err) {
    if (__DEV__) console.warn("[vrDeviceCapabilities.ts] detect failed:", err);
    return fallbackCapabilities();
  }
}
