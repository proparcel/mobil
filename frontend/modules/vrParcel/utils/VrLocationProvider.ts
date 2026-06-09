/**
 * VR modülü konum sağlayıcısı — expo-location (Android/iOS).
 * react-native-geolocation-service, yeni Play Services sürümlerinde çöküyordu.
 */
import * as Location from "expo-location";

export type VrLocationReading = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;
};

const watchOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
};

const singleOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
};

function mapLocation(location: Location.LocationObject): VrLocationReading {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyM: location.coords.accuracy ?? 999,
    timestamp: location.timestamp,
    speed: location.coords.speed ?? null,
    heading: location.coords.heading ?? null,
  };
}

export async function requestVrLocationAuthorization(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}

export function watchVrLocation(
  onReading: (reading: VrLocationReading) => void,
  onError?: (err: unknown) => void,
): { stop: () => void } {
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;

  void (async () => {
    try {
      subscription = await Location.watchPositionAsync(watchOptions, (location) => {
        onReading(mapLocation(location));
      });
      if (stopped) {
        subscription.remove();
        subscription = null;
      }
    } catch (err) {
      onError?.(err);
    }
  })();

  return {
    stop: () => {
      stopped = true;
      subscription?.remove();
      subscription = null;
    },
  };
}

export async function getVrLocationOnce(): Promise<VrLocationReading> {
  const location = await Location.getCurrentPositionAsync(singleOptions);
  return mapLocation(location);
}
