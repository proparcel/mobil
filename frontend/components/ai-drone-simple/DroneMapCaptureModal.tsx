import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MAPBOX_ACCESS_TOKEN } from "../../config/mapbox";
import {
  HomeIndexMap3DLayers,
  homeIndexMap3DLayersAvailable,
  homeIndexMapStyleURL,
} from "../map/HomeIndexMap3DLayers";
import { tryMapboxSnap } from "../../src/utils/mapboxSnapshot";
import { calculateBoundsAndCamera, normalizeGeometryCoordinates } from "../../src/utils/parcelUtils";
import type { TkgmParcelResponse } from "../../src/utils/tkgmParcelQuery";
import type { MobileUploadImage } from "../../services/imageAnimationService";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";

const RECORD_PITCH = 80;
const BEARINGS = [0, 120, 240];
const CAPTURE_SIZE = { mapWidth: 720, mapHeight: 1280 };
/** Android modal MapView: onDidFinishLoadingMap sık gelmez; idle / fallback ile devam */
const MAP_READY_FALLBACK_MS = 2800;
const CAMERA_SETTLE_MS = 1600;
const FRAME_RENDER_MS = 900;

let Mapbox: any = null;
try {
  const mod = require("@rnmapbox/maps");
  Mapbox = mod.default || mod;
  if (Mapbox?.setAccessToken && MAPBOX_ACCESS_TOKEN) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  }
} catch {
  Mapbox = null;
}

type ParcelFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};

function extractParcelFeature(tkgm: TkgmParcelResponse | null): ParcelFeature | null {
  const raw = tkgm?.geometry;
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const props = (tkgm?.properties || {}) as Record<string, unknown>;

  try {
    if (g.type === "Feature" && g.geometry && typeof g.geometry === "object") {
      const geom = normalizeGeometryCoordinates(g.geometry);
      if (!geom?.coordinates) return null;
      return {
        type: "Feature",
        geometry: geom,
        properties: (g.properties as Record<string, unknown>) || props,
      };
    }
    if (g.type === "FeatureCollection" && Array.isArray(g.features) && g.features[0]) {
      const f = g.features[0] as ParcelFeature;
      const geom = normalizeGeometryCoordinates(f.geometry);
      if (!geom?.coordinates) return null;
      return { type: "Feature", geometry: geom, properties: f.properties || props };
    }
    if (typeof g.type === "string" && g.coordinates) {
      const geom = normalizeGeometryCoordinates(g);
      if (!geom?.coordinates) return null;
      return { type: "Feature", geometry: geom, properties: props };
    }
  } catch {
    return null;
  }
  return null;
}

type Props = {
  visible: boolean;
  tkgmData: TkgmParcelResponse | null;
  onClose: () => void;
  onCancel: () => void;
  onCaptured: (images: MobileUploadImage[]) => void;
  onStatusChange?: (status: string) => void;
};

export function DroneMapCaptureModal({
  visible,
  tkgmData,
  onClose,
  onCancel,
  onCaptured,
  onStatusChange,
}: Props) {
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const idleCountRef = useRef(0);
  const captureStartedRef = useRef(false);
  const cancelledRef = useRef(false);
  const onCapturedRef = useRef(onCaptured);
  const onCloseRef = useRef(onClose);
  const runCaptureRef = useRef<(() => Promise<void>) | null>(null);

  const [status, setStatus] = useState("Harita hazırlanıyor…");
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [manualOffer, setManualOffer] = useState(false);

  onCapturedRef.current = onCaptured;
  onCloseRef.current = onClose;

  const feature = useMemo(() => extractParcelFeature(tkgmData), [tkgmData]);

  const cameraDefaults = useMemo(() => {
    if (!feature?.geometry) return null;
    return calculateBoundsAndCamera(feature.geometry);
  }, [feature]);

  const shape = useMemo(() => {
    if (!feature) return null;
    return { type: "FeatureCollection" as const, features: [feature] };
  }, [feature]);

  const reportStatus = useCallback(
    (msg: string) => {
      setStatus(msg);
      onStatusChange?.(msg);
    },
    [onStatusChange],
  );

  const markMapReady = useCallback(() => {
    if (mapReadyRef.current || cancelledRef.current) return;
    mapReadyRef.current = true;
    setMapReady(true);
    reportStatus("Harita hazır, kareler alınacak…");
  }, [reportStatus]);

  const resetSession = useCallback(() => {
    mapReadyRef.current = false;
    idleCountRef.current = 0;
    captureStartedRef.current = false;
    cancelledRef.current = false;
    setMapReady(false);
    setMapError(null);
    setBusy(false);
    setManualOffer(false);
    reportStatus("Harita hazırlanıyor…");
  }, [reportStatus]);

  useEffect(() => {
    if (!visible) {
      cancelledRef.current = true;
      return;
    }
    cancelledRef.current = false;
    resetSession();
  }, [visible, resetSession, retryToken]);

  const runCapture = useCallback(async () => {
    if (cancelledRef.current || captureStartedRef.current) return;
    captureStartedRef.current = true;

    if (!Mapbox || !feature) {
      captureStartedRef.current = false;
      reportStatus("Mapbox veya parsel geometrisi kullanılamıyor.");
      return;
    }

    let waitMs = 0;
    while (!mapRef.current && waitMs < 5000) {
      await new Promise((r) => setTimeout(r, 100));
      waitMs += 100;
    }
    if (!mapRef.current || cancelledRef.current) {
      captureStartedRef.current = false;
      reportStatus("Harita görünümü hazır değil. Tekrar deneyin.");
      return;
    }

    const cam = cameraDefaults || calculateBoundsAndCamera(feature.geometry);
    const center = cam?.center;
    if (!center) {
      captureStartedRef.current = false;
      reportStatus("Parsel merkezi hesaplanamadı.");
      return;
    }

    setBusy(true);
    setMapError(null);
    const images: MobileUploadImage[] = [];

    try {
      await new Promise((r) => setTimeout(r, 300));

      for (let i = 0; i < BEARINGS.length; i += 1) {
        if (cancelledRef.current) return;

        reportStatus(`Kare ${i + 1}/${BEARINGS.length} alınıyor…`);
        cameraRef.current?.setCamera?.({
          centerCoordinate: center,
          zoomLevel: cam?.zoom ?? 17,
          pitch: RECORD_PITCH,
          heading: BEARINGS[i],
          animationDuration: 0,
        });

        await new Promise((r) => setTimeout(r, CAMERA_SETTLE_MS + FRAME_RENDER_MS));

        let uri = await tryMapboxSnap(mapRef, CAPTURE_SIZE);
        if (!uri) {
          await new Promise((r) => setTimeout(r, 500));
          uri = await tryMapboxSnap(mapRef, CAPTURE_SIZE);
        }
        if (!uri) throw new Error(`Kare ${i + 1} alınamadı.`);

        images.push({
          uri,
          name: `reference_${String(i + 1).padStart(2, "0")}.jpg`,
          type: "image/jpeg",
        });
      }

      if (cancelledRef.current) return;
      reportStatus("Kareler alındı, devam ediliyor…");
      onCapturedRef.current(images);
      onCloseRef.current();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Görüntü yakalama başarısız.";
      setMapError(msg);
      reportStatus(msg);
      captureStartedRef.current = false;
    } finally {
      setBusy(false);
    }
  }, [feature, cameraDefaults, reportStatus]);

  runCaptureRef.current = runCapture;

  const scheduleCapture = useCallback(() => {
    if (captureStartedRef.current || cancelledRef.current) return;
    const timer = setTimeout(() => {
      void runCaptureRef.current?.();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const offer = setTimeout(() => setManualOffer(true), 3000);
    return () => clearTimeout(offer);
  }, [visible, retryToken]);

  useEffect(() => {
    if (!visible || !feature || !cameraDefaults || !mapReady) return;
    return scheduleCapture();
  }, [visible, feature, cameraDefaults, mapReady, retryToken, scheduleCapture]);

  useEffect(() => {
    if (!visible) return;
    const fallback = setTimeout(() => {
      if (!mapReadyRef.current && mapRef.current) {
        markMapReady();
      }
    }, MAP_READY_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [visible, retryToken, markMapReady]);

  const handleMapIdle = useCallback(() => {
    idleCountRef.current += 1;
    if (idleCountRef.current >= 1) {
      markMapReady();
    }
  }, [markMapReady]);

  const handleMapLoaded = useCallback(() => {
    markMapReady();
  }, [markMapReady]);

  const handleRetry = useCallback(() => {
    setRetryToken((n) => n + 1);
  }, []);

  const handleManualCapture = useCallback(() => {
    markMapReady();
    captureStartedRef.current = false;
    void runCaptureRef.current?.();
  }, [markMapReady]);

  const handleCancel = useCallback(() => {
    if (busy) return;
    cancelledRef.current = true;
    onCancel();
  }, [busy, onCancel]);

  if (!visible) return null;

  if (!Mapbox) {
    return (
      <Modal visible animationType="slide" onRequestClose={handleCancel}>
        <SafeAreaView style={styles.safe}>
          <Text style={styles.error}>Mapbox modülü kullanılamıyor.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={handleCancel}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  if (!feature || !shape || !cameraDefaults) {
    return (
      <Modal visible animationType="slide" onRequestClose={handleCancel}>
        <SafeAreaView style={styles.safe}>
          <Text style={styles.error}>Parsel geometrisi çözülemedi.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={handleCancel}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  const showManualStart = manualOffer && !busy;

  return (
    <Modal visible animationType="slide" onRequestClose={busy ? undefined : handleCancel}>
      <View style={styles.safe} collapsable={false}>
        <Mapbox.MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          styleURL={homeIndexMapStyleURL(Mapbox)}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          surfaceView={Platform.OS === "android" ? false : undefined}
          onDidFinishLoadingMap={handleMapLoaded}
          onDidFinishLoadingStyle={handleMapLoaded}
          onMapIdle={handleMapIdle}
          onMapLoadingError={() => {
            setMapError("Harita yüklenemedi.");
            reportStatus("Harita yüklenemedi.");
            markMapReady();
          }}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: cameraDefaults.center,
              zoomLevel: cameraDefaults.zoom,
              pitch: RECORD_PITCH,
              heading: 0,
            }}
            maxZoomLevel={20}
            minZoomLevel={2}
          />
          {homeIndexMap3DLayersAvailable() ? <HomeIndexMap3DLayers idPrefix="drone-capture" /> : null}
          <Mapbox.ShapeSource id="drone-capture-parcel" shape={shape}>
            <Mapbox.FillLayer id="drone-capture-fill" style={{ fillColor: "#ef4444", fillOpacity: 0.18 }} />
            <Mapbox.LineLayer id="drone-capture-line" style={{ lineColor: "#b91c1c", lineWidth: 3 }} />
          </Mapbox.ShapeSource>
        </Mapbox.MapView>

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          {!busy ? (
            <TouchableOpacity style={styles.closeFloating} onPress={handleCancel}>
              <Text style={styles.closeFloatingText}>İptal</Text>
            </TouchableOpacity>
          ) : null}
          {busy ? <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} size="large" /> : null}
          <Text style={styles.status}>{mapError || status}</Text>
          {showManualStart ? (
            <TouchableOpacity style={styles.closeBtn} onPress={handleManualCapture}>
              <Text style={styles.closeBtnText}>Kareleri al</Text>
            </TouchableOpacity>
          ) : null}
          {mapError && !busy ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRetry}>
              <Text style={styles.secondaryBtnText}>Tekrar dene</Text>
            </TouchableOpacity>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 48,
    gap: 12,
    paddingHorizontal: 20,
  },
  status: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  error: { color: "#f8fafc", padding: 24, fontSize: 16, textAlign: "center" },
  closeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 180,
  },
  closeBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.5)",
  },
  secondaryBtnText: { color: AI_DRONE_EDITOR_THEME.primaryBright, fontWeight: "700" },
  closeFloating: {
    position: "absolute",
    top: 8,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(15,23,42,0.75)",
    borderRadius: 8,
  },
  closeFloatingText: { color: "#f8fafc", fontWeight: "700" },
});
