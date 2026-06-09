import { Linking, NativeModules, Platform } from "react-native";

const PLAY_STORE_ARCORE =
  "https://play.google.com/store/apps/details?id=com.google.ar.core";

type NativeCapsModule = {
  requestArCoreInstall?: () => Promise<string>;
};

const native = NativeModules.VrArCapabilitiesModule as NativeCapsModule | undefined;

export type ArCoreInstallResult = "installed" | "requested" | "unavailable" | "play_store";

export async function requestArCoreInstall(): Promise<ArCoreInstallResult> {
  if (Platform.OS !== "android") return "unavailable";

  if (native?.requestArCoreInstall) {
    try {
      const status = await native.requestArCoreInstall();
      if (status === "INSTALLED" || status === "ALREADY_INSTALLED") return "installed";
      if (status === "REQUESTED") return "requested";
    } catch {
      // fall through to Play Store
    }
  }

  try {
    await Linking.openURL(PLAY_STORE_ARCORE);
    return "play_store";
  } catch {
    return "unavailable";
  }
}

export function getArCoreInstallMessage(status?: string): string {
  switch (status) {
    case "SUPPORTED_APK_TOO_OLD":
      return "Google Play Services for AR güncellenmeli.";
    case "SUPPORTED_NOT_INSTALLED":
      return "ARCore yüklü değil. Play Store'dan kurun.";
    case "UNSUPPORTED_DEVICE_NOT_CAPABLE":
      return "Bu cihaz ARCore desteklemiyor.";
    default:
      return "AR için Google Play Services for AR gerekli.";
  }
}
