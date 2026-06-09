import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import type { CameraView as CameraViewType } from "expo-camera";
import {
  isExpoCameraNativeAvailable,
  showVrCameraNativeMissingAlert,
} from "../utils/vrPermissions";

type Props = {
  active: boolean;
};

type CameraModule = {
  CameraView: typeof CameraViewType;
  useCameraPermissions: () => [
    { granted?: boolean; canAskAgain?: boolean } | null,
    () => Promise<{ granted?: boolean; canAskAgain?: boolean }>,
  ];
};

export function VrCameraPreview({ active }: Props): React.ReactElement {
  const [cameraMod, setCameraMod] = useState<CameraModule | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!active || cameraMod || loadError) return;
    if (!isExpoCameraNativeAvailable()) {
      setLoadError(true);
      return;
    }
    void import("expo-camera")
      .then((mod) => {
        setCameraMod({
          CameraView: mod.CameraView,
          useCameraPermissions: mod.useCameraPermissions,
        });
      })
      .catch(() => setLoadError(true));
  }, [active, cameraMod, loadError]);

  if (loadError || (active && !isExpoCameraNativeAvailable())) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.message}>Kamera modülü bu build'de yok</Text>
        <TouchableOpacity onPress={showVrCameraNativeMissingAlert}>
          <Text style={styles.sub}>Ne yapmalıyım?</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!cameraMod) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return <VrCameraPreviewInner active={active} cameraMod={cameraMod} />;
}

function VrCameraPreviewInner({
  active,
  cameraMod,
}: {
  active: boolean;
  cameraMod: CameraModule;
}): React.ReactElement {
  const { CameraView, useCameraPermissions } = cameraMod;
  const [permission, requestPermission] = useCameraPermissions();
  const [requested, setRequested] = useState(false);

  const askPermission = useCallback(async () => {
    setRequested(true);
    await requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (!active || permission?.granted || requested) return;
    void askPermission();
  }, [active, permission?.granted, requested, askPermission]);

  if (!permission) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.message}>Kamera izni gerekli</Text>
        <TouchableOpacity onPress={() => void askPermission()}>
          <Text style={styles.sub}>İzin iste</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <CameraView style={styles.camera} facing="back" />;
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    width: "100%",
  },
  placeholder: {
    flex: 1,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  message: {
    color: "#f8fafc",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  sub: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default VrCameraPreview;
