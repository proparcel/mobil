import type { RefObject } from 'react';
import { Dimensions } from 'react-native';
import { normalizeGeometryCoordinates } from './geoCoordNormalize';
export { normalizeGeometryCoordinates, shouldSwapLatLonForTurkey } from './geoCoordNormalize';
import { projectLngLatsBatch } from '../maps/drawing/shapeScreenProjection';
import {
  isFiniteScreenPoint,
  isScreenPointInsideViewport,
} from '../maps/drawing/mapOverlayProjection';
import {
  isMapOverlayViewportReady,
  type MapOverlayViewport,
} from '../maps/drawing/mapOverlayViewport';

const PARCEL_VIEWPORT_PADDING_PX = 32;
const WORLD_DIM_PX = 256;
const ZOOM_ABSOLUTE_MAX = 22;

/** Basit sorgu sonrası kamera: çok uzaklaşmayı önler, çok yakınlaşmayı sınırlar */
export const SIMPLE_QUERY_MIN_ZOOM = 14;
export const SIMPLE_QUERY_MAX_ZOOM = 16;

/** Paylaşım ekran görüntüsü: arazi her zaman kadraj içinde, mümkün olduğunca yakın */
export const SHARE_CAPTURE_MIN_ZOOM = 2;
export const SHARE_CAPTURE_MAX_ZOOM = 20;
export const SHARE_CAPTURE_PADDING_PX = 56;
export const SHARE_CAPTURE_BBOX_MARGIN = 1.18;

/** Pratik drone harita kareleri — 60° pitch + dikey kadraj (720×1280) */
export const DRONE_CAPTURE_MIN_ZOOM = 2;
export const DRONE_CAPTURE_MAX_ZOOM = 18;
export const DRONE_CAPTURE_PADDING_PX = 88;
export const DRONE_CAPTURE_BBOX_MARGIN = 1.5;

export type CalculateBoundsOptions = {
  viewport?: MapOverlayViewport;
  paddingPx?: number;
  minZoom?: number;
  maxZoom?: number;
  bboxMargin?: number;
};

function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
}

function zoomFromBboxFraction(mapPx: number, worldPx: number, fraction: number): number {
  if (fraction <= 0 || mapPx <= 0) return ZOOM_ABSOLUTE_MAX;
  return Math.floor(Math.log2(mapPx / worldPx / fraction));
}

function clampSimpleQueryZoom(zoom: number): number {
  return Math.max(SIMPLE_QUERY_MIN_ZOOM, Math.min(zoom, SIMPLE_QUERY_MAX_ZOOM));
}

function resolveMapViewport(viewport: MapOverlayViewport): MapOverlayViewport {
  if (isMapOverlayViewportReady(viewport)) return viewport;
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

/**
 * Bir noktanın parsel polygon içinde olup olmadığını kontrol et (ray-casting algoritması)
 */
export const isPointInParcel = (point: [number, number], geometry: any): boolean => {
  if (!geometry || !point || !point[0] || !point[1]) return false;
  
  try {
    const [x, y] = point; // [lon, lat]
    let inside = false;
    
    if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
      const ring = geometry.coordinates[0]; // Dış halka
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        // Ray-casting algoritması
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
      // MultiPolygon için her polygon'u kontrol et
      for (const polygon of geometry.coordinates) {
        if (polygon && polygon[0]) {
          const ring = polygon[0];
          let polygonInside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) polygonInside = !polygonInside;
          }
          if (polygonInside) {
            inside = true;
            break;
          }
        }
      }
    }
    
    return inside;
  } catch (e) {
    console.error('[parcelUtils.ts:48] Point in polygon kontrolü hatası:', e);
    return false;
  }
};

/**
 * Parsel geometrisinin dış halka koordinatlarını toplar.
 */
export function collectParcelRingCoords(geometry: any): [number, number][] {
  const allCoords: [number, number][] = [];
  if (geometry?.type === 'Polygon' && geometry.coordinates?.[0]) {
    for (const coord of geometry.coordinates[0]) {
      if (coord && coord.length >= 2) allCoords.push([coord[0], coord[1]]);
    }
  } else if (geometry?.type === 'MultiPolygon' && geometry.coordinates) {
    for (const polygon of geometry.coordinates) {
      const ring = polygon?.[0];
      if (!ring) continue;
      for (const coord of ring) {
        if (coord && coord.length >= 2) allCoords.push([coord[0], coord[1]]);
      }
    }
  }
  return allCoords;
}

export function getGeometryBoundingBox(
  geometry: any
): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
  const allCoords = collectParcelRingCoords(geometry);
  if (!allCoords.length) return null;
  let minLon = allCoords[0][0];
  let maxLon = allCoords[0][0];
  let minLat = allCoords[0][1];
  let maxLat = allCoords[0][1];
  for (const [lon, lat] of allCoords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Parsel poligonunun tüm köşeleri harita görünümünde mi?
 * null = harita/projeksiyon hazır değil (kamera dokunma).
 */
export async function isParcelGeometryFullyVisible(
  mapRef: RefObject<any>,
  geometry: any,
  viewport: MapOverlayViewport,
  paddingPx = PARCEL_VIEWPORT_PADDING_PX
): Promise<boolean | null> {
  if (!geometry) return null;
  const coords = collectParcelRingCoords(geometry);
  if (!coords.length) return null;

  const resolvedViewport = resolveMapViewport(viewport);
  const projected = await projectLngLatsBatch(mapRef, coords);
  const insetViewport: MapOverlayViewport = {
    width: Math.max(0, resolvedViewport.width - paddingPx * 2),
    height: Math.max(0, resolvedViewport.height - paddingPx * 2),
  };
  if (insetViewport.width <= 0 || insetViewport.height <= 0) return null;

  let validCount = 0;
  for (const p of projected) {
    if (!isFiniteScreenPoint(p)) continue;
    validCount += 1;
    const adjusted: [number, number] = [p[0] - paddingPx, p[1] - paddingPx];
    if (!isScreenPointInsideViewport(adjusted, insetViewport)) return false;
  }
  if (validCount === 0) return null;
  return true;
}

export type FitParcelInViewIfNeededArgs = {
  mapRef: RefObject<any>;
  cameraRef: RefObject<any>;
  camRef?: RefObject<{ pitch?: number; zoom?: number }>;
  geometry: any;
  viewport: MapOverlayViewport;
  currentZoom: number;
  currentPitch?: number;
  animationDuration?: number;
  paddingPx?: number;
  isProgrammaticMoveRef?: RefObject<boolean>;
  programmaticTimerRef?: RefObject<ReturnType<typeof setTimeout> | null>;
};

function applySimpleQueryCamera(
  cameraRef: RefObject<any>,
  center: [number, number],
  zoom: number,
  pitch: number,
  animationDuration: number,
  camRef?: RefObject<{ pitch?: number; zoom?: number }>,
  isProgrammaticMoveRef?: RefObject<boolean>,
  programmaticTimerRef?: RefObject<ReturnType<typeof setTimeout> | null>
): void {
  if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = true;
  if (programmaticTimerRef?.current) clearTimeout(programmaticTimerRef.current);

  cameraRef.current.setCamera({
    centerCoordinate: center,
    zoomLevel: zoom,
    pitch,
    animationDuration,
  });

  if (camRef?.current) {
    camRef.current.zoom = zoom;
  }

  if (programmaticTimerRef) {
    programmaticTimerRef.current = setTimeout(() => {
      if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = false;
    }, animationDuration + 80);
  }
}

/**
 * Basit sorgu sonrası kamera:
 * - Parsel ekrandaysa ve zoom ≥ 14 ise dokunma.
 * - Zoom < 14 ise parsele odaklanıp en az 14'e getir (16'dan fazla yakınlaşmaz).
 * - Parsel ekran dışındaysa parsele odaklan; zoom 14–16 aralığında sığdır.
 */
export async function fitParcelInViewIfNeeded({
  mapRef,
  cameraRef,
  camRef,
  geometry,
  viewport,
  currentZoom,
  currentPitch = 0,
  animationDuration = 900,
  paddingPx = PARCEL_VIEWPORT_PADDING_PX,
  isProgrammaticMoveRef,
  programmaticTimerRef,
}: FitParcelInViewIfNeededArgs): Promise<boolean> {
  if (!geometry || !cameraRef?.current?.setCamera) return false;

  const normalizedGeometry = normalizeGeometryCoordinates(geometry);
  const fullyVisible = await isParcelGeometryFullyVisible(
    mapRef,
    normalizedGeometry,
    viewport,
    paddingPx
  );

  const fitSettings = calculateBoundsAndCamera(normalizedGeometry);
  if (!fitSettings) return false;

  const safeCurrentZoom =
    typeof currentZoom === 'number' && Number.isFinite(currentZoom) ? currentZoom : fitSettings.zoom;
  const fitZoom = clampSimpleQueryZoom(fitSettings.zoom);

  // null = belirsiz → kameraya dokunma
  if (fullyVisible === null) return false;

  let targetZoom: number | null = null;
  if (fullyVisible === true) {
    if (safeCurrentZoom >= SIMPLE_QUERY_MIN_ZOOM) return false;
    targetZoom = SIMPLE_QUERY_MIN_ZOOM;
  } else {
    targetZoom =
      safeCurrentZoom < fitZoom ? fitZoom : Math.min(safeCurrentZoom, fitZoom);
  }

  applySimpleQueryCamera(
    cameraRef,
    fitSettings.center,
    targetZoom,
    currentPitch,
    animationDuration,
    camRef,
    isProgrammaticMoveRef,
    programmaticTimerRef
  );

  return true;
}

export type ZoomMapToParcelGeometryArgs = {
  cameraRef: RefObject<any>;
  camRef?: RefObject<{ pitch?: number; zoom?: number }>;
  geometry: any;
  animationDuration?: number;
  isProgrammaticMoveRef?: RefObject<boolean>;
  programmaticTimerRef?: RefObject<ReturnType<typeof setTimeout> | null>;
};

/** Parsel geometrisine merkezlenir ve bbox'a göre zoom in yapar. */
export function zoomMapToParcelGeometry({
  cameraRef,
  camRef,
  geometry,
  animationDuration = 900,
  isProgrammaticMoveRef,
  programmaticTimerRef,
}: ZoomMapToParcelGeometryArgs): boolean {
  if (!geometry || !cameraRef?.current?.setCamera) return false;

  const normalizedGeometry = normalizeGeometryCoordinates(geometry);
  const fitSettings = calculateBoundsAndCamera(normalizedGeometry);
  if (!fitSettings) return false;

  if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = true;
  if (programmaticTimerRef?.current) clearTimeout(programmaticTimerRef.current);

  cameraRef.current.setCamera({
    centerCoordinate: fitSettings.center,
    zoomLevel: fitSettings.zoom,
    pitch: camRef?.current?.pitch ?? 0,
    animationDuration,
  });

  if (camRef?.current) {
    camRef.current.zoom = fitSettings.zoom;
  }

  if (programmaticTimerRef) {
    programmaticTimerRef.current = setTimeout(() => {
      if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = false;
    }, animationDuration + 80);
  }

  return true;
}

/**
 * Parsel polygon için bounding box hesapla ve kamera ayarlarını döndür.
 * Viewport verildiğinde en/boy oranına göre zoom hesaplanır (paylaşım kadrajı için).
 */
export const calculateBoundsAndCamera = (
  geometry: any,
  options?: CalculateBoundsOptions,
): { center: [number, number]; zoom: number } | null => {
  try {
    const bbox = getGeometryBoundingBox(geometry);
    if (!bbox) return null;

    const { minLon, maxLon, minLat, maxLat } = bbox;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const viewport = resolveMapViewport(options?.viewport ?? { width: 0, height: 0 });
    const paddingPx = options?.paddingPx ?? PARCEL_VIEWPORT_PADDING_PX;
    const minZoom = options?.minZoom ?? 2;
    const maxZoom = options?.maxZoom ?? 20;

    const bboxMargin = options?.bboxMargin ?? 1;

    const mapWidth = Math.max(1, viewport.width - paddingPx * 2);
    const mapHeight = Math.max(1, viewport.height - paddingPx * 2);

    const latFraction =
      ((latRad(maxLat) - latRad(minLat)) / Math.PI) * bboxMargin;
    const lngDiff = maxLon - minLon;
    const lngSpan = lngDiff < 0 ? lngDiff + 360 : lngDiff;
    const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
    const lngFraction = (lngSpan / 360 / cosLat) * bboxMargin;

    const latZoom = zoomFromBboxFraction(mapHeight, WORLD_DIM_PX, Math.max(latFraction, 1e-8));
    const lngZoom = zoomFromBboxFraction(mapWidth, WORLD_DIM_PX, Math.max(lngFraction, 1e-8));

    const zoom = Math.max(minZoom, Math.min(maxZoom, Math.min(latZoom, lngZoom)));

    return {
      center: [centerLon, centerLat],
      zoom,
    };
  } catch (error) {
    console.error('[parcelUtils] Bounds hesaplama hatası:', error);
    return null;
  }
};

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finishProgrammaticMove(
  isProgrammaticMoveRef?: RefObject<boolean>,
  programmaticTimerRef?: RefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (programmaticTimerRef) {
    programmaticTimerRef.current = setTimeout(() => {
      if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = false;
    }, 80);
  } else if (isProgrammaticMoveRef) {
    isProgrammaticMoveRef.current = false;
  }
}

/**
 * Paylaşım ekran görüntüsü öncesi kamerayı araziye sığdırır.
 * Kadraj boyutları (mapWidth x mapHeight) snapshot ile aynı oranda kullanılır.
 */
export async function fitParcelForShareCapture({
  mapRef,
  cameraRef,
  camRef,
  geometry,
  viewport,
  animationDuration = 600,
  isProgrammaticMoveRef,
  programmaticTimerRef,
}: {
  mapRef: RefObject<any>;
  cameraRef: RefObject<any>;
  camRef?: RefObject<{ pitch?: number; zoom?: number; heading?: number }>;
  geometry: any;
  viewport: MapOverlayViewport;
  animationDuration?: number;
  isProgrammaticMoveRef?: RefObject<boolean>;
  programmaticTimerRef?: RefObject<ReturnType<typeof setTimeout> | null>;
}): Promise<boolean> {
  if (!geometry || !cameraRef?.current) return false;

  const normalizedGeometry = normalizeGeometryCoordinates(geometry);
  const padding = SHARE_CAPTURE_PADDING_PX;
  const liveViewport = resolveMapViewport({ width: 0, height: 0 });

  if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = true;
  if (programmaticTimerRef?.current) clearTimeout(programmaticTimerRef.current);

  const settings = calculateBoundsAndCamera(normalizedGeometry, {
    viewport,
    paddingPx: padding,
    minZoom: SHARE_CAPTURE_MIN_ZOOM,
    maxZoom: SHARE_CAPTURE_MAX_ZOOM,
    bboxMargin: SHARE_CAPTURE_BBOX_MARGIN,
  });
  if (!settings || !cameraRef.current?.setCamera) {
    if (isProgrammaticMoveRef) isProgrammaticMoveRef.current = false;
    return false;
  }

  let targetZoom = settings.zoom;
  const center = settings.center;
  const heading = camRef?.current?.heading ?? 0;

  const applyShareCamera = async (zoom: number, animMs: number) => {
    cameraRef.current?.setCamera?.({
      centerCoordinate: center,
      zoomLevel: zoom,
      pitch: 0,
      heading,
      animationDuration: animMs,
    });
    if (camRef?.current) {
      camRef.current.zoom = zoom;
      camRef.current.pitch = 0;
    }
    await delayMs(animMs + 80);
  };

  await applyShareCamera(targetZoom, animationDuration);

  while (targetZoom > SHARE_CAPTURE_MIN_ZOOM) {
    const fullyVisible = await isParcelGeometryFullyVisible(
      mapRef,
      normalizedGeometry,
      liveViewport,
      padding,
    );
    if (fullyVisible !== false) break;
    targetZoom -= 1;
    await applyShareCamera(targetZoom, 220);
  }

  finishProgrammaticMove(isProgrammaticMoveRef, programmaticTimerRef);
  return true;
}

export type ApplyDroneCaptureCameraFitArgs = {
  cameraRef: RefObject<any>;
  mapRef: RefObject<any>;
  geometry: any;
  /** Snapshot hedef boyutu (ör. 720×1280) */
  captureViewport: MapOverlayViewport;
  /** MapView ekrandaki gerçek boyutu — projeksiyon doğrulaması için */
  mapViewport: MapOverlayViewport;
  pitch?: number;
  heading?: number;
  paddingPx?: number;
  animationDuration?: number;
};

/**
 * Pratik drone referans kareleri: parsel sınırları kadraj içinde (60° pitch, dikey oran).
 */
export async function applyDroneCaptureCameraFit({
  cameraRef,
  mapRef,
  geometry,
  captureViewport,
  mapViewport,
  pitch = 60,
  heading = 0,
  paddingPx = DRONE_CAPTURE_PADDING_PX,
  animationDuration = 0,
}: ApplyDroneCaptureCameraFitArgs): Promise<{ center: [number, number]; zoom: number } | null> {
  if (!geometry || !cameraRef?.current) return null;

  const normalizedGeometry = normalizeGeometryCoordinates(geometry);
  const bbox = getGeometryBoundingBox(normalizedGeometry);
  if (!bbox) return null;

  const fallbackSettings = calculateBoundsAndCamera(normalizedGeometry, {
    viewport: captureViewport,
    paddingPx,
    minZoom: DRONE_CAPTURE_MIN_ZOOM,
    maxZoom: DRONE_CAPTURE_MAX_ZOOM,
    bboxMargin: DRONE_CAPTURE_BBOX_MARGIN,
  });

  const sw: [number, number] = [bbox.minLon, bbox.minLat];
  const ne: [number, number] = [bbox.maxLon, bbox.maxLat];
  const setCamera =
    typeof cameraRef.current?.setCamera === 'function'
      ? cameraRef.current.setCamera.bind(cameraRef.current)
      : null;

  const buildPadding = (base: number) => ({
    paddingTop: Math.round(base * 1.3),
    paddingBottom: Math.round(base * 0.9),
    paddingLeft: base,
    paddingRight: base,
  });

  const fitWithPadding = (base: number, animMs: number) => {
    const pad = buildPadding(base);
    if (setCamera) {
      setCamera({
        bounds: { ne, sw },
        padding: pad,
        pitch,
        heading,
        animationDuration: animMs,
        animationMode: 'easeTo',
      });
      return;
    }
    if (typeof cameraRef.current?.fitBounds === 'function') {
      cameraRef.current.fitBounds(sw, ne, base, animMs);
      cameraRef.current.setCamera?.({ pitch, heading, animationDuration: 0 });
    }
  };

  let activePadding = paddingPx;
  fitWithPadding(activePadding, animationDuration);

  await delayMs(animationDuration + 120);

  const resolvedMapViewport = resolveMapViewport(mapViewport);
  const layoutScale =
    captureViewport.width > 0 ? resolvedMapViewport.width / captureViewport.width : 1;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const layoutPadding = Math.max(12, Math.round(activePadding * layoutScale));
    const fullyVisible = await isParcelGeometryFullyVisible(
      mapRef,
      normalizedGeometry,
      resolvedMapViewport,
      layoutPadding,
    );
    if (fullyVisible !== false) break;
    activePadding = Math.round(activePadding * 1.12);
    fitWithPadding(activePadding, 220);
    await delayMs(260);
  }

  return fallbackSettings
    ? { center: fallbackSettings.center, zoom: fallbackSettings.zoom }
    : null;
}

/**
 * Backend durum kontrolü
 */
export const checkBackendStatus = async (): Promise<boolean> => {
  try {
    const { API_URL } = await import("../../config/api");
    const backendUrl = (API_URL || "").replace(/\/$/, "");
    // FastAPI health check endpoint'i (eğer yoksa root endpoint'i deneriz)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 saniye timeout
    
    const response = await fetch(`${backendUrl}/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    // Herhangi bir yanıt alırsak backend çalışıyor demektir
    return response.ok || response.status < 500;
  } catch (error: any) {
    // Network hatası veya timeout
    console.log('[parcelUtils.ts:176] Backend durum kontrolü başarısız:', error.message);
    return false;
  }
};
