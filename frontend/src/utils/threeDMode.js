/**
 * 3D (Terrain + pitch) kontrol yardımcıları (JS).
 * index.tsx buradaki helper'ları kullanır.
 */

const TURKEY_MAP_CENTER = [35.0, 39.0];
const TURKEY_MAP_ZOOM = 5.5;

function isReasonableMapCenter(center) {
  if (!Array.isArray(center) || center.length !== 2) return false;
  const [lng, lat] = center;
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (Math.abs(lng) < 0.05 && Math.abs(lat) < 0.05) return false;
  return true;
}

/**
 * Mapbox `onCameraChanged` event'inden camRef'i günceller.
 * Gate açıkken bile zoom/pitch/heading güncellenir; sadece center kesilir.
 *
 * @param {any} e
 * @param {{ current: { center: number[], zoom: number, pitch: number, heading: number } }} camRef
 * @param {{ current: boolean }=} isProgrammaticMoveRef
 */
export function updateCamRefFromCameraChanged(e, camRef, isProgrammaticMoveRef) {
  const { properties, geometry } = e ?? {};

  const zoom = properties?.zoom ?? properties?.zoomLevel;
  const pitch = properties?.pitch;
  const heading = properties?.heading ?? properties?.bearing;

  const center =
    geometry?.coordinates ??
    properties?.centerCoordinate ??
    properties?.center;

  // Zoom/pitch/heading her zaman güncellensin (gate açıkken bile)
  if (typeof zoom === "number") camRef.current.zoom = zoom;
  if (typeof pitch === "number") camRef.current.pitch = pitch;
  if (typeof heading === "number") camRef.current.heading = heading;

  // Programmatik animasyonda center güncellemesini kes (geri besleme riskli kısım bu)
  if (isProgrammaticMoveRef?.current) return;

  if (
    Array.isArray(center) &&
    center.length === 2 &&
    typeof center[0] === "number" &&
    typeof center[1] === "number"
  ) {
    // any[] -> tuple
    camRef.current.center = [center[0], center[1]];
  }
}

/**
 * 3D modunu aç/kapatır.
 * - enable=true: pitch verip kamerayı eğerek 3D moduna geçer
 * - enable=false: önce pitch'i 0'a indirir, sonra terrain yükünü temizlemek için MapView remount eder
 *
 * @param {{
 *   enable: boolean,
 *   camRef: { current: { center: number[], zoom: number, pitch: number, heading: number } },
 *   cameraRef: { current: any },
 *   setIs3DMode: (v: boolean) => void,
 *   setMapDefaultSettings: (v: any) => void,
 *   setMapViewKey: (fn: (k: number) => number) => void,
 *   pitch3D?: number,
 *   isProgrammaticMoveRef?: { current: boolean },
 *   programmaticTimerRef?: { current: any },
 * }} args
 */
export function apply3DMode({
  enable,
  camRef,
  cameraRef,
  setIs3DMode,
  setMapDefaultSettings,
  setMapViewKey,
  pitch3D = 75,
  isProgrammaticMoveRef,
  programmaticTimerRef,
}) {
  const current = camRef.current;
  const targetPitch = enable ? pitch3D : 0;

  // Programmatik hareket gate
  if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = true;
  if (programmaticTimerRef?.current) clearTimeout(programmaticTimerRef.current);

  const releaseGate = (ms = 650) => {
    if (!programmaticTimerRef) return;
    programmaticTimerRef.current = setTimeout(() => {
      if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = false;
    }, ms);
  };

  // Pitch'i animasyonla uygula (tek kanal: cameraRef.setCamera)
  if (cameraRef?.current?.setCamera) {
    cameraRef.current.setCamera({
      pitch: targetPitch,
      animationDuration: 450,
      animationMode: "easeTo",
    });
  }

  // Ref’i güncel tut
  camRef.current.pitch = targetPitch;

  if (enable) {
    setIs3DMode(true);
    releaseGate(650);
    return;
  }

  // disable: 3D modundan çıkış
  setIs3DMode(false);

  const preservedCenter = isReasonableMapCenter(current.center)
    ? [...current.center]
    : [...TURKEY_MAP_CENTER];
  const preservedZoom =
    typeof current.zoom === "number" && Number.isFinite(current.zoom)
      ? current.zoom
      : TURKEY_MAP_ZOOM;

  // remount öncesi güncel konum bilgisini koru (geçersiz [0,0] → Türkiye)
  setMapDefaultSettings({
    centerCoordinate: preservedCenter,
    zoomLevel: preservedZoom,
    heading: current.heading,
    pitch: 0,
  });
  camRef.current.center = preservedCenter;
  camRef.current.zoom = preservedZoom;

  // Pitch animasyonu bittikten sonra haritayı remount et
  if (programmaticTimerRef) {
    programmaticTimerRef.current = setTimeout(() => {
      setMapViewKey((k) => k + 1);
      releaseGate(400);
    }, 480);
  } else {
    setMapViewKey((k) => k + 1);
    if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = false;
  }
}
