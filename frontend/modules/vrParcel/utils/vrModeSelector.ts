import type { VrCalibrationMode } from "../types/vrCalibrationMode";
import type { VrDeviceCapabilities } from "./vrDeviceCapabilities";

export function selectVrCalibrationMode(
  capabilities: Pick<
    VrDeviceCapabilities,
    | "platform"
    | "supportsAR"
    | "supportsARKit"
    | "supportsARCore"
    | "supportsLiDAR"
    | "supportsSceneDepth"
    | "supportsSmoothedSceneDepth"
  >,
): VrCalibrationMode {
  if (
    capabilities.platform === "ios" &&
    capabilities.supportsARKit &&
    (capabilities.supportsLiDAR ||
      capabilities.supportsSceneDepth ||
      capabilities.supportsSmoothedSceneDepth)
  ) {
    return "lidar_precise";
  }

  if (capabilities.platform === "ios" && capabilities.supportsARKit) {
    return "arkit_standard";
  }

  if (capabilities.platform === "android" && capabilities.supportsARCore) {
    return "arcore_standard";
  }

  if (!capabilities.supportsAR) {
    return "map_only_fallback";
  }

  return "unsupported";
}

export function isArCalibrationMode(mode: VrCalibrationMode): boolean {
  return mode === "lidar_precise" || mode === "arkit_standard" || mode === "arcore_standard";
}
