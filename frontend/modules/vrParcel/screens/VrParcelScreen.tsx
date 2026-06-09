import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { buildVrParcelPayload } from "../utils/parcelPayloadAdapter";
import { getEffectiveParcelForVr } from "../store/lastParcelStore";
import { closeVrUnitySession } from "../native/VrUnityModule";
import VrParcelScreenContent from "./VrParcelScreenContent";
import VrMapFallbackScreen from "./VrMapFallbackScreen";
import { VrUnsupportedPanel } from "../components/VrUnsupportedPanel";
import { VrArCoreInstallPanel } from "../components/VrArCoreInstallPanel";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import { detectVrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import type { VrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import { isArCalibrationMode } from "../utils/vrModeSelector";

type RootStackParamList = {
  "vr-parcel": undefined;
  index: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "vr-parcel">;
type ScreenView = "loading" | "ar" | "map_fallback" | "unsupported" | "arcore_install";

function needsArCoreInstall(caps: VrDeviceCapabilities): boolean {
  const status = caps.arCoreInstallStatus;
  return (
    caps.platform === "android" &&
    Boolean(caps.supportsARCore) &&
    status != null &&
    status !== "SUPPORTED_INSTALLED" &&
    status !== "ALREADY_INSTALLED"
  );
}

export default function VrParcelScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [payload, setPayload] = useState<VrParcelPayload | null>(null);
  const [capabilities, setCapabilities] = useState<VrDeviceCapabilities | null>(null);
  const [view, setView] = useState<ScreenView>("loading");

  const refreshCapabilities = useCallback(async () => {
    const caps = await detectVrDeviceCapabilities();
    setCapabilities(caps);
    if (caps.recommendedMode === "map_only_fallback") {
      setView("map_fallback");
    } else if (caps.recommendedMode === "unsupported") {
      setView("unsupported");
    } else if (needsArCoreInstall(caps)) {
      setView("arcore_install");
    } else if (isArCalibrationMode(caps.recommendedMode)) {
      setView("ar");
    } else {
      setView("unsupported");
    }
    return caps;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const source = getEffectiveParcelForVr();
      const built = source ? buildVrParcelPayload(source) : null;
      if (cancelled) return;
      setPayload(built);
      if (built) await refreshCapabilities();
      else setView("unsupported");
    })();
    return () => {
      cancelled = true;
      closeVrUnitySession();
    };
  }, [refreshCapabilities]);

  const handleClose = useCallback(() => {
    closeVrUnitySession();
    navigation.goBack();
  }, [navigation]);

  if (view === "loading" || !payload || !capabilities) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>VR oturumu hazırlanıyor…</Text>
      </View>
    );
  }

  const mode = capabilities.recommendedMode;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VR Parsel</Text>
        <TouchableOpacity onPress={handleClose} style={styles.headerClose}>
          <Text style={styles.headerCloseText}>Kapat</Text>
        </TouchableOpacity>
      </View>

      {view === "map_fallback" ? (
        <VrMapFallbackScreen payload={payload} onClose={handleClose} />
      ) : view === "arcore_install" ? (
        <VrArCoreInstallPanel
          capabilities={capabilities}
          onInstalled={() => void refreshCapabilities()}
          onUseMapFallback={() => setView("map_fallback")}
          onClose={handleClose}
        />
      ) : view === "unsupported" ? (
        <VrUnsupportedPanel
          mode={mode}
          onClose={handleClose}
          onOpenMapFallback={() => setView("map_fallback")}
        />
      ) : (
        <VrParcelScreenContent
          payload={payload}
          capabilities={capabilities}
          mode={mode}
          onClose={handleClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  centered: {
    flex: 1,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, color: "#94a3b8", fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#334155",
  },
  headerTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "700" },
  headerClose: { paddingHorizontal: 12, paddingVertical: 6 },
  headerCloseText: { color: "#3b82f6", fontSize: 15, fontWeight: "600" },
});
