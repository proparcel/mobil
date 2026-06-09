import { NativeModules } from "react-native";
import type { VrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import { detectVrDeviceCapabilities } from "../utils/vrDeviceCapabilities";

export type { VrDeviceCapabilities };

export async function getVrArCapabilities(): Promise<VrDeviceCapabilities> {
  return detectVrDeviceCapabilities();
}

export function isVrArCapabilitiesNativeLinked(): boolean {
  return Boolean(NativeModules.VrArCapabilitiesModule?.detectCapabilities);
}
