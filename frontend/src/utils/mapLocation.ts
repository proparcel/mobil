import {
  Alert,
  InteractionManager,
  Linking,
  PermissionsAndroid,
  Platform,
} from "react-native";

/** Mapbox [longitude, latitude] — Türkiye merkezi */
export const TURKEY_MAP_CENTER: [number, number] = [35.0, 39.0];
/** Ülke geneli */
export const TURKEY_MAP_ZOOM = 5.5;
/** Açılış: konuma git, mavi nokta yok */
export const USER_BOOTSTRAP_ZOOM = 8.5;
/** Menü → Konumum: yakın zoom + mavi nokta */
export const USER_MENU_LOCATION_ZOOM = 14;

function getGeolocationModule(): typeof import("react-native-geolocation-service").default | null {
  try {
    return require("react-native-geolocation-service").default;
  } catch {
    return null;
  }
}

/** Android: fused location yerine RN community (daha az native çökme) */
function getPositionProvider(): {
  getCurrentPosition: (
    success: (pos: { coords: { longitude: number; latitude: number } }) => void,
    error?: (e: unknown) => void,
    options?: Record<string, unknown>,
  ) => void;
} | null {
  if (Platform.OS === "android") {
    try {
      return require("@react-native-community/geolocation").default;
    } catch {
      /* fallback */
    }
  }
  return getGeolocationModule();
}

export async function hasAppLocationPermission(): Promise<boolean> {
  if (Platform.OS === "ios") return true;
  return hasAndroidLocationPermission();
}

export type LocationAuthStatus = "granted" | "denied" | "restricted" | "disabled";

/** İzin diyaloğu / activity resume sonrası native çağrıları güvene al */
export function waitForUiSettled(delayMs = 300): Promise<void> {
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

let androidPermissionRequestInFlight = false;

export async function requestAppLocationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    if (await hasAndroidLocationPermission()) {
      return true;
    }
    if (androidPermissionRequestInFlight) {
      return hasAndroidLocationPermission();
    }
    androidPermissionRequestInFlight = true;
    try {
      // rationale vermeyin — RN önce kendi Alert'ini açar, sonra sistem diyaloğu (çift modal)
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (fine === PermissionsAndroid.RESULTS.GRANTED) {
        await waitForUiSettled(200);
        return true;
      }
      return false;
    } finally {
      androidPermissionRequestInFlight = false;
    }
  }

  const Geolocation = getGeolocationModule();
  if (!Geolocation) return false;

  if (Platform.OS === "ios") {
    try {
      const status = (await Geolocation.requestAuthorization(
        "whenInUse",
      )) as LocationAuthStatus;
      if (status === "granted") return true;
      if (status === "disabled") {
        Alert.alert(
          "Konum servisleri kapalı",
          "Konum Servisleri kapalı. Ayarlar > Gizlilik ve Güvenlik > Konum Servisleri üzerinden açabilirsiniz.",
          [
            { text: "İptal", style: "cancel" },
            { text: "Ayarlar", onPress: () => Linking.openSettings() },
          ],
        );
      }
      return false;
    } catch (err) {
      if (__DEV__) console.warn("[mapLocation] iOS requestAuthorization:", err);
      return false;
    }
  }

  return false;
}

export async function getCurrentCoordinates(): Promise<{
  longitude: number;
  latitude: number;
}> {
  const Geolocation = getPositionProvider();
  if (!Geolocation) {
    return Promise.reject(new Error("Geolocation modülü yok"));
  }

  if (Platform.OS === "android") {
    const allowed = await hasAndroidLocationPermission();
    if (!allowed) {
      return Promise.reject(new Error("Konum izni yok"));
    }
    await waitForUiSettled(500);
  }

  const options: Record<string, unknown> = {
    enableHighAccuracy: Platform.OS === "ios",
    timeout: 20000,
    maximumAge: 15000,
  };

  if (Platform.OS === "android") {
    const fused = getGeolocationModule();
    if (fused && Geolocation === fused) {
      options.showLocationDialog = false;
      options.forceRequestLocation = false;
    }
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        });
      },
      (error) => reject(error),
      options,
    );
  });
}

export function showLocationPermissionAlert(): void {
  Alert.alert(
    "Konum izni",
    "Konumunuzu haritada göstermek için ayarlardan konum iznini açın.",
    [
      { text: "İptal", style: "cancel" },
      { text: "Ayarlar", onPress: () => Linking.openSettings() },
    ],
  );
}

export function isReasonableMapCenter(center: unknown): center is [number, number] {
  if (!Array.isArray(center) || center.length !== 2) return false;
  const [lng, lat] = center;
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (Math.abs(lng) < 0.05 && Math.abs(lat) < 0.05) return false;
  return true;
}
