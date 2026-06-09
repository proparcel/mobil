import { NativeModules } from "react-native";

type ExternalGnssNative = {
  detectExternalGnss?: () => Promise<{ connected?: boolean; source?: string }>;
};

const native = NativeModules.VrArCapabilitiesModule as ExternalGnssNative | undefined;

export type ExternalGnssStatus = {
  connected: boolean;
  source?: "bluetooth_nmea" | "usb" | "unknown";
};

/** Faz 4: harici GNSS yalnızca harita UserPoint doğrulaması için */
export async function detectExternalGnssStatus(): Promise<ExternalGnssStatus> {
  if (!native?.detectExternalGnss) {
    return { connected: false };
  }
  try {
    const raw = await native.detectExternalGnss();
    return {
      connected: Boolean(raw?.connected),
      source:
        raw?.source === "bluetooth_nmea" || raw?.source === "usb"
          ? raw.source
          : raw?.connected
            ? "unknown"
            : undefined,
    };
  } catch {
    return { connected: false };
  }
}

export function getExternalGnssHint(status: ExternalGnssStatus): string | undefined {
  if (!status.connected) return undefined;
  return "Harici GNSS bağlı — harita konum doğrulaması daha hassas olabilir.";
}
