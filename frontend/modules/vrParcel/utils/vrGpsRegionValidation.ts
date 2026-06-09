import type { VrGpsSnapshot } from "./vrGpsStream";
import { validateMapUserAgainstGps } from "./vrMapReferenceSelection";
import type { VrLatLon } from "../types/vrParcelPayload";

/** GPS yalnızca saha doğrulama — kalibrasyon kaynağı değil */
export function validateGpsRegionHint(
  mapUser: VrLatLon,
  parcelCenter: VrLatLon,
  snapshot: VrGpsSnapshot | null,
): { level: "ok" | "warn" | "none"; message?: string } {
  if (!snapshot) {
    return { level: "none", message: "GPS sinyali henüz yok; harita referansları kullanılacak." };
  }

  const userCheck = validateMapUserAgainstGps(
    mapUser,
    snapshot.lat,
    snapshot.lon,
    snapshot.accuracyMedianM,
  );
  if (!userCheck.ok) {
    return { level: "warn", message: userCheck.message };
  }

  const centerDist =
    Math.abs(mapUser.lat - parcelCenter.lat) + Math.abs(mapUser.lon - parcelCenter.lon);
  if (centerDist > 0.05) {
    return {
      level: "warn",
      message: "Seçtiğiniz konum parsel merkezinden uzak görünüyor. Doğru parselde olduğunuzdan emin olun.",
    };
  }

  return { level: "ok" };
}
