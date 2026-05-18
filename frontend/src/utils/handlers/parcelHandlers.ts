/**
 * Parsel Sorgusu Handler Fonksiyonları
 * 
 * Bu dosya, parsel sorgusu ile ilgili handler fonksiyonlarını içerir:
 * - handleAdaParselSubmit: Ada/Parsel JSON sorgusu
 * - handleMapPress: Harita tıklama ile parsel sorgusu
 * - handlePropertyTypeSelect: Pro Mode property type seçimi
 */

import { Alert } from 'react-native';
import { 
  ProParcelResponse, 
  TkgmViewResponse, 
  ParcelResponse, 
  GeoJSONGeometry,
  ParcelData 
} from '../../../src/types/parcelResponse';
import { normalizeGeometryCoordinates, calculateBoundsAndCamera, isPointInParcel } from '../parcelUtils';
import { extractNitelikText, generatePropertyTypeTitle } from '../propertyTypeUtils';
import { API_URL } from "../../../config/api";

/**
 * Camera ref interface
 */
interface CameraRef {
  current: {
    fitBounds?: (
      min: [number, number],
      max: [number, number],
      padding: number,
      duration: number
    ) => void;
    setCamera?: (settings: {
      centerCoordinate: [number, number];
      zoomLevel: number;
      pitch: number;
      animationDuration: number;
      animationMode: string;
    }) => void;
  } | null;
}

/**
 * Cam ref interface
 */
interface CamRef {
  current: {
    pitch?: number;
  };
}

/**
 * Programmatic move ref interface
 */
interface ProgrammaticMoveRef {
  current: boolean;
}

/**
 * Programmatic timer ref interface
 */
interface ProgrammaticTimerRef {
  current: ReturnType<typeof setTimeout> | null;
}

/**
 * Create handleAdaParselSubmit handler factory
 */
export const createHandleAdaParselSubmit = (
  isLoadingParcel: boolean,
  isProMode: boolean,
  is3DMode: boolean,
  setIsLoadingParcel: (loading: boolean) => void,
  setParcelData: (data: ParcelData | null) => void,
  setActiveScreen: (screen: string | null) => void,
  setParcelModalVisible: (visible: boolean) => void,
  cameraRef: CameraRef,
  camRef: CamRef,
  isProgrammaticMoveRef: ProgrammaticMoveRef,
  programmaticTimerRef: ProgrammaticTimerRef
) => {
  return async (payload: {
    mahalleTkgmValue: number;
    mahalle: string;
    ada: string;
    parsel: string;
  }) => {
    if (isLoadingParcel) return;

    setIsLoadingParcel(true);
    setParcelData(null);

    const backendUrl = (API_URL || "").replace(/\/$/, "");
    const endpoint = isProMode ? '/api/get_parcel_info' : '/api/tkgm_view';
    const fullUrl = `${backendUrl}${endpoint}`;

    const requestBody: any = {
      mahalle: payload.mahalle,
      mahalleTkgmValue: payload.mahalleTkgmValue,
      ada: payload.ada,
      parsel: payload.parsel,
      map_mode: '2d',
      is3D: is3DMode,
    };

    try {
      console.log('[parcelHandlers.ts:68] 🏠 Ada/Parsel sorgusu başlatılıyor...');
      console.log('[parcelHandlers.ts:69] API Request:', fullUrl);
      console.log('[parcelHandlers.ts:70] Request Body:', JSON.stringify(requestBody));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${txt}`);
      }

      const data: ParcelResponse = await response.json();

      // Geometry çıkar
      let geometry: GeoJSONGeometry | null = null;
      if (isProMode) {
        const proData = data as ProParcelResponse;
        if (proData.geometry) {
          geometry = proData.geometry;
        } else if (proData.parameters_polygons?.parcel_polygon) {
          const parcelPolygon: any = proData.parameters_polygons.parcel_polygon;
          if (parcelPolygon.type === 'Feature' && parcelPolygon.geometry) {
            geometry = parcelPolygon.geometry;
          } else if (parcelPolygon.type && parcelPolygon.coordinates) {
            geometry = parcelPolygon as GeoJSONGeometry;
          } else {
            geometry = parcelPolygon as GeoJSONGeometry;
          }
        }
      } else {
        const tkgmData = data as TkgmViewResponse;
        if (tkgmData.geometry) geometry = tkgmData.geometry;
      }

      if (!geometry) {
        Alert.alert('Uyarı', 'Parsel geometrisi bulunamadı.');
        return;
      }

      const normalizedGeometry = isProMode
        ? normalizeGeometryCoordinates(geometry)
        : geometry;

      // properties seti (pro modda parcel_values dahil)
      let parcelProperties: Record<string, any> = {};
      if (isProMode) {
        const proData = data as ProParcelResponse;
        parcelProperties = {
          ...(proData.properties || {}),
          ...(proData.parameters_data?.parcel_values || {}),
        };
      } else {
        const tkgmData = data as TkgmViewResponse;
        parcelProperties = tkgmData.properties || {};
      }

      setParcelData({
        geometry: normalizedGeometry,
        properties: parcelProperties,
        analysisData: isProMode ? (data as ProParcelResponse) : null,
      });

      // Kamerayı parsele "zoom" olacak şekilde odakla (fitBounds varsa öncelikli)
      try {
        const bbox = (() => {
          let allCoords: [number, number][] = [];
          const g: any = normalizedGeometry as any;
          if (g?.type === 'Polygon' && g.coordinates?.[0]) {
            for (const coord of g.coordinates[0]) {
              if (coord && coord.length >= 2) allCoords.push([coord[0], coord[1]]);
            }
          } else if (g?.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
            for (const polygon of g.coordinates) {
              const ring = polygon?.[0];
              if (!ring) continue;
              for (const coord of ring) {
                if (coord && coord.length >= 2) allCoords.push([coord[0], coord[1]]);
              }
            }
          }
          if (!allCoords.length) return null;
          let minLon = allCoords[0][0], maxLon = allCoords[0][0];
          let minLat = allCoords[0][1], maxLat = allCoords[0][1];
          for (const [lon, lat] of allCoords) {
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          }
          return { minLon, minLat, maxLon, maxLat };
        })();

        // Bir tick bekle: source/layer render ile daha stabil
        setTimeout(() => {
          if (!cameraRef.current) return;
          isProgrammaticMoveRef.current = true;
          if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);

          // @rnmapbox/maps Camera ref'i bazı sürümlerde fitBounds destekliyor
          if (bbox && typeof cameraRef.current.fitBounds === 'function') {
            try {
              cameraRef.current.fitBounds(
                [bbox.minLon, bbox.minLat],
                [bbox.maxLon, bbox.maxLat],
                60,
                900
              );
            } catch {
              // fallback: setCamera
              const cameraSettings = calculateBoundsAndCamera(normalizedGeometry as any);
              if (cameraSettings && cameraRef.current?.setCamera) {
                cameraRef.current.setCamera({
                  centerCoordinate: cameraSettings.center,
                  zoomLevel: cameraSettings.zoom,
                  pitch: camRef.current.pitch ?? 0,
                  animationDuration: 900,
                  animationMode: 'easeTo',
                });
              }
            }
          } else {
            const cameraSettings = calculateBoundsAndCamera(normalizedGeometry as any);
            if (cameraSettings && cameraRef.current?.setCamera) {
              cameraRef.current.setCamera({
                centerCoordinate: cameraSettings.center,
                zoomLevel: cameraSettings.zoom,
                pitch: camRef.current.pitch ?? 0,
                animationDuration: 900,
                animationMode: 'easeTo',
              });
            }
          }

          programmaticTimerRef.current = setTimeout(() => {
            isProgrammaticMoveRef.current = false;
          }, 950);
        }, 50);
      } catch {
        // sessiz fallback
      }

      // Search modalı kapat, sonucu göstermek için parsel modalını aç
      setActiveScreen(null);
      setParcelModalVisible(true);
    } catch (e: any) {
      console.error('[parcelHandlers.ts:217] ❌ Ada/Parsel sorgu hatası:', e);
      Alert.alert('Hata', e?.message || 'Sorgu hatası');
    } finally {
      setIsLoadingParcel(false);
    }
  };
};
