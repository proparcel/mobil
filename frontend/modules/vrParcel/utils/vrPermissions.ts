import {
  Alert,
  InteractionManager,
  Linking,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { requestVrLocationAuthorization } from "./VrLocationProvider";

export type VrCameraPermissionResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "blocked" | "native_missing" };

export function isExpoCameraNativeAvailable(): boolean {
  return requireOptionalNativeModule("ExpoCamera") != null;
}

function isNativeCameraModuleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cannot find native module|ExpoCamera|native module/i.test(msg);
}

export function waitForVrUiSettled(delayMs = 300): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    const maxWait = setTimeout(done, delayMs + 2000);
    InteractionManager.runAfterInteractions(() => {
      clearTimeout(maxWait);
      setTimeout(done, delayMs);
    });
  });
}

async function hasAndroidLocationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const fine = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (fine) return true;
    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
  } catch {
    return false;
  }
}

async function requestAndroidLocationPermission(): Promise<boolean> {
  if (await hasAndroidLocationPermission()) return true;
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestVrLocationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    const ok = await requestAndroidLocationPermission();
    if (ok) await waitForVrUiSettled(200);
    return ok;
  }
  return requestVrLocationAuthorization();
}

export async function requestVrCameraPermission(): Promise<VrCameraPermissionResult> {
  if (!isExpoCameraNativeAvailable()) {
    return { ok: false, reason: "native_missing" };
  }

  try {
    const { Camera } = await import("expo-camera");
    const current = await Camera.getCameraPermissionsAsync();
    if (current.granted) return { ok: true };

    if (current.canAskAgain === false) {
      return { ok: false, reason: "blocked" };
    }

    const result = await Camera.requestCameraPermissionsAsync();
    if (result.granted) {
      await waitForVrUiSettled(200);
      return { ok: true };
    }
    if (result.canAskAgain === false) {
      return { ok: false, reason: "blocked" };
    }
    return { ok: false, reason: "denied" };
  } catch (err) {
    if (__DEV__) console.warn("[vrPermissions.ts:requestVrCameraPermission]", err);
    if (isNativeCameraModuleError(err)) {
      return { ok: false, reason: "native_missing" };
    }
    if (Platform.OS === "android") {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      return result === PermissionsAndroid.RESULTS.GRANTED
        ? { ok: true }
        : { ok: false, reason: "denied" };
    }
    return { ok: false, reason: "denied" };
  }
}

export async function requestVrPermissions(): Promise<{
  camera: VrCameraPermissionResult;
  location: boolean;
}> {
  const camera = await requestVrCameraPermission();
  await waitForVrUiSettled(300);
  const location = await requestVrLocationPermission();
  return { camera, location };
}

export function showVrCameraNativeMissingAlert(): void {
  Alert.alert(
    "Kamera modülü eksik",
    "Telefondaki dev client eski; kamera native modülü yok. PC'de npm run eas:build:ios ile yeni build alıp tekrar kurun.",
    [{ text: "Tamam", style: "cancel" }],
  );
}

export function showVrCameraDeniedAlert(blocked = false): void {
  if (blocked) {
    Alert.alert(
      "Kamera izni kapalı",
      "Daha önce reddedildi. Ayarlar > ProParcel > Kamera'yı açın.",
      [
        { text: "Tamam", style: "cancel" },
        { text: "Ayarlar", onPress: () => Linking.openSettings() },
      ],
    );
    return;
  }

  Alert.alert(
    "Kamera izni",
    "VR için kamera izni gerekli. Devam Et'e basınca iOS izin penceresi açılır.",
    [{ text: "Tamam", style: "cancel" }],
  );
}

export function showVrLocationDeniedAlert(blocked = false): void {
  if (blocked) {
    Alert.alert(
      "Konum izni kapalı",
      "Ayarlar > ProParcel > Konum bölümünden izin verin.",
      [
        { text: "Tamam", style: "cancel" },
        { text: "Ayarlar", onPress: () => Linking.openSettings() },
      ],
    );
    return;
  }

  Alert.alert(
    "Konum izni",
    "Referans noktası için konum izni gerekli.",
    [{ text: "Tamam", style: "cancel" }],
  );
}
