import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";
import { getVrModeUiCopy } from "../types/vrCalibrationMode";
import type { VrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import { isArCalibrationMode } from "../utils/vrModeSelector";

type Props = {
  capabilities: VrDeviceCapabilities | null;
  loading?: boolean;
  /** AR kamera tam ekran: mod banner'i gizle */
  compact?: boolean;
  children: React.ReactNode;
};

export function VrModeGate({ capabilities, loading, compact, children }: Props): React.ReactElement {
  if (loading || !capabilities) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cihaz AR kabiliyeti kontrol ediliyor…</Text>
      </View>
    );
  }

  const mode = capabilities.recommendedMode;
  const copy = getVrModeUiCopy(mode);

  if (!isArCalibrationMode(mode)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        {capabilities.reason ? <Text style={styles.reason}>{capabilities.reason}</Text> : null}
      </View>
    );
  }

  if (compact) {
    return <View style={styles.root}>{children}</View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{copy.title}</Text>
        <Text style={styles.bannerSub}>{copy.subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

export function getActiveVrMode(capabilities: VrDeviceCapabilities | null): VrCalibrationMode {
  return capabilities?.recommendedMode ?? "unsupported";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0b1220",
  },
  loadingText: { marginTop: 12, color: "#94a3b8", fontSize: 14 },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 14, textAlign: "center", marginTop: 10, lineHeight: 20 },
  reason: { color: "#64748b", fontSize: 12, marginTop: 8, textAlign: "center" },
  banner: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerTitle: { color: "#3b82f6", fontSize: 13, fontWeight: "700" },
  bannerSub: { color: "#94a3b8", fontSize: 12, marginTop: 4, lineHeight: 17 },
});

export default VrModeGate;
