import React, { useCallback, useState } from "react";
import { Platform, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { VR_PARCEL_ENABLED } from "../featureFlag";
import { getEffectiveParcelForVr } from "../store/lastParcelStore";
import { buildVrParcelPayload, hasValidVrPolygon } from "../utils/parcelPayloadAdapter";
import {
  requestVrPermissions,
  showVrCameraDeniedAlert,
  showVrCameraNativeMissingAlert,
  showVrLocationDeniedAlert,
  waitForVrUiSettled,
} from "../utils/vrPermissions";
import { VrPermissionSheet } from "../components/VrPermissionSheet";
import {
  showLocationRequiredAlert,
  showNoParcelAlert,
  showNoPolygonAlert,
} from "../components/VrGuardAlerts";

type PillBarStyle = {
  pillButton: object;
  pillButtonEven: object;
};

type Props = {
  styles: PillBarStyle;
  onInteraction?: () => void;
};

export function VrPillBarButton({ styles: pillStyles, onInteraction }: Props): React.ReactElement | null {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [permissionSheetVisible, setPermissionSheetVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const openVrScreen = useCallback(() => {
    navigation.navigate("vr-parcel" as never);
  }, [navigation]);

  const runPermissionFlow = useCallback(async () => {
    setBusy(true);
    try {
      const { camera, location } = await requestVrPermissions();
      await waitForVrUiSettled(400);
      if (!location) {
        showVrLocationDeniedAlert();
        showLocationRequiredAlert();
        return;
      }
      if (!camera.ok) {
        if (camera.reason === "native_missing") {
          showVrCameraNativeMissingAlert();
        } else {
          showVrCameraDeniedAlert(camera.reason === "blocked");
        }
        return;
      }
      openVrScreen();
    } finally {
      setBusy(false);
    }
  }, [openVrScreen]);

  const handlePress = useCallback(() => {
    onInteraction?.();
    const source = getEffectiveParcelForVr();
    if (!source) {
      showNoParcelAlert();
      return;
    }
    if (!hasValidVrPolygon(source)) {
      showNoPolygonAlert();
      return;
    }
    if (__DEV__) {
      const payload = buildVrParcelPayload(source);
      console.log("[VrPillBarButton.tsx:handlePress] VR payload hazır:", payload?.parcelId);
    }
    setPermissionSheetVisible(true);
  }, [onInteraction]);

  const handleContinue = useCallback(() => {
    setPermissionSheetVisible(false);
    void runPermissionFlow();
  }, [runPermissionFlow]);

  const handleCancel = useCallback(() => {
    setPermissionSheetVisible(false);
  }, []);

  if (!VR_PARCEL_ENABLED || Platform.OS === "ios") return null;

  return (
    <>
      <TouchableOpacity
        testID="vr-parcel-button"
        onPress={handlePress}
        disabled={busy}
        style={[pillStyles.pillButton, pillStyles.pillButtonEven, busy && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialCommunityIcons name="augmented-reality" size={18} color="#fff" />
        )}
      </TouchableOpacity>
      <VrPermissionSheet
        visible={permissionSheetVisible}
        onContinue={handleContinue}
        onCancel={handleCancel}
      />
    </>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.6,
  },
});
