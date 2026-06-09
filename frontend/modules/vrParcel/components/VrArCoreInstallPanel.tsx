import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import type { VrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import { getArCoreInstallMessage, requestArCoreInstall } from "../utils/vrArCoreInstall";

type Props = {
  capabilities: VrDeviceCapabilities;
  onInstalled: () => void;
  onUseMapFallback: () => void;
  onClose: () => void;
};

export function VrArCoreInstallPanel({
  capabilities,
  onInstalled,
  onUseMapFallback,
  onClose,
}: Props): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const message = getArCoreInstallMessage(capabilities.arCoreInstallStatus);

  const handleInstall = useCallback(async () => {
    setBusy(true);
    try {
      const result = await requestArCoreInstall();
      if (result === "installed") onInstalled();
    } finally {
      setBusy(false);
    }
  }, [onInstalled]);

  return (
    <View style={styles.root}>
      <Text style={styles.icon}>📱</Text>
      <Text style={styles.title}>ARCore gerekli</Text>
      <Text style={styles.body}>{message}</Text>
      {capabilities.arCoreInstallStatus ? (
        <Text style={styles.status}>Durum: {capabilities.arCoreInstallStatus}</Text>
      ) : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleInstall()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Google Play'den ARCore Kur</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onUseMapFallback}>
        <Text style={styles.secondaryBtnText}>Haritada Görüntüle</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkBtn} onPress={onClose}>
        <Text style={styles.linkBtnText}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b1220",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  icon: { fontSize: 42, marginBottom: 4 },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: "#94a3b8", fontSize: 15, lineHeight: 22, textAlign: "center" },
  status: { color: "#64748b", fontSize: 12 },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 240,
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  secondaryBtnText: { color: "#60a5fa", fontWeight: "600" },
  linkBtn: { paddingVertical: 8 },
  linkBtnText: { color: "#64748b", fontWeight: "600" },
});

export default VrArCoreInstallPanel;
