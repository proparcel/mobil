import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { MAPBOX_ACCESS_TOKEN } from "../../config/mapbox";
import {
  HomeIndexMap3DLayers,
  homeIndexMap3DLayersAvailable,
  homeIndexMapSatelliteStyleURL,
} from "../map/HomeIndexMap3DLayers";
import { tryDroneMapReferenceSnap } from "../../src/utils/mapboxSnapshot";
import {
  applyDroneCaptureCameraFit,
  calculateBoundsAndCamera,
  DRONE_CAPTURE_BBOX_MARGIN,
  DRONE_CAPTURE_MULTI_BEARING_PADDING_SCALE,
  DRONE_CAPTURE_PADDING_PX,
  normalizeGeometryCoordinates,
} from "../../src/utils/parcelUtils";
import type { TkgmParcelResponse } from "../../src/utils/tkgmParcelQuery";
import type { MobileUploadImage } from "../../services/imageAnimationService";
import {
  RUNWAY_PORTRAIT_REF_HEIGHT,
  RUNWAY_PORTRAIT_REF_WIDTH,
} from "../../services/runwayPortraitClient";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import {
  DRONE_SCENE_INITIAL_COUNT,
  DRONE_SCENE_MAX_CAPTURE_PER_PURCHASE,
  DRONE_SCENE_PACKAGE_ALLOWANCE,
} from "../../services/droneSceneService";

const RECORD_PITCH = 60;
const DEFAULT_MIN_FRAMES = 2;
const INITIAL_CAPTURE_BEARINGS = [0, 90, 180, 270] as const;
const CAMERA_SETTLE_MS = 450;
const SCENE_LIMIT_ALERT_MESSAGE =
  "En fazla 5 sahne görseli alınabilir. Sahnelerin üretiminden sonra ek sahneler üretebilirsiniz.";
const CAPTURE_VIEWPORT = { width: RUNWAY_PORTRAIT_REF_WIDTH, height: RUNWAY_PORTRAIT_REF_HEIGHT };
const CAPTURE_SIZE = { mapWidth: RUNWAY_PORTRAIT_REF_WIDTH, mapHeight: RUNWAY_PORTRAIT_REF_HEIGHT };
const MAP_READY_FALLBACK_MS = 2800;
const FRAME_RENDER_MS = 900;
const BOTTOM_PANEL_HEIGHT = 168;
const TOP_BAR_CONTENT_HEIGHT = 48;
const MAP_STAGE_TOP_GAP = 10;
const STATUS_LINE_HEIGHT = 28;

type CapturedFrame = MobileUploadImage & { id: string };

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

function nextFrameId(): string {
  return `frame-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type CaptureMode = "initial" | "new_scene";

export type DroneMapCaptureContinuePayload = {
  images: MobileUploadImage[];
  promptText?: string;
  useOpenAiPreflight?: boolean;
};

type Props = {
  visible: boolean;
  tkgmData: TkgmParcelResponse | null;
  mode?: CaptureMode;
  /** Bu oturumda en fazla kaç kare (ek sahne: min(remaining, 2)). */
  sessionMaxFrames?: number;
  /** Paket üst sınırı (varsayılan 5). */
  totalMaxFrames?: number;
  minFrames?: number;
  onCancel: () => void;
  onContinue: (payload: DroneMapCaptureContinuePayload) => void;
  onStatusChange?: (status: string) => void;
  onNeedPurchase?: () => void;
};

export function DroneMapCaptureModal({
  visible,
  tkgmData,
  mode = "initial",
  sessionMaxFrames,
  totalMaxFrames = DRONE_SCENE_PACKAGE_ALLOWANCE,
  minFrames = DEFAULT_MIN_FRAMES,
  onCancel,
  onContinue,
  onStatusChange,
  onNeedPurchase,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const idleCountRef = useRef(0);
  const cancelledRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const autoCaptureStartedRef = useRef(false);
  const fittedCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  const [status, setStatus] = useState("Harita hazırlanıyor…");
  const [busy, setBusy] = useState(false);
  const [autoCaptureActive, setAutoCaptureActive] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [promptText, setPromptText] = useState("");
  const [useOpenAiPreflight, setUseOpenAiPreflight] = useState(false);

  const isNewSceneMode = mode === "new_scene";
  const effectiveSessionMax = Math.max(
    1,
    Math.min(
      sessionMaxFrames ?? DRONE_SCENE_MAX_CAPTURE_PER_PURCHASE,
      totalMaxFrames,
    ),
  );
  const effectiveMinFrames = Math.max(1, minFrames);
  const showPromptField = capturedFrames.length <= 1;

  const feature = useMemo(() => extractParcelFeature(tkgmData), [tkgmData]);

  const cameraDefaults = useMemo(() => {
    if (!feature?.geometry) return null;
    return calculateBoundsAndCamera(feature.geometry, {
      viewport: CAPTURE_VIEWPORT,
      paddingPx: Math.round(DRONE_CAPTURE_PADDING_PX * DRONE_CAPTURE_MULTI_BEARING_PADDING_SCALE),
      minZoom: 2,
      maxZoom: 18,
      bboxMargin: DRONE_CAPTURE_BBOX_MARGIN,
    });
  }, [feature]);

  const shape = useMemo(() => {
    if (!feature) return null;
    return { type: "FeatureCollection" as const, features: [feature] };
  }, [feature]);

  const portraitAspect = RUNWAY_PORTRAIT_REF_HEIGHT / RUNWAY_PORTRAIT_REF_WIDTH;
  const mapLayout = useMemo(() => {
    const topReserve =
      insets.top + TOP_BAR_CONTENT_HEIGHT + MAP_STAGE_TOP_GAP + STATUS_LINE_HEIGHT;
    const maxW = screenW - 16;
    const maxH =
      screenH - topReserve - BOTTOM_PANEL_HEIGHT - insets.bottom - MAP_STAGE_TOP_GAP;
    let width = maxW;
    let height = width * portraitAspect;
    if (height > maxH) {
      height = Math.max(120, maxH);
      width = height / portraitAspect;
    }
    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }, [screenW, screenH, insets.top, insets.bottom, portraitAspect]);

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
    reportStatus("Harita hazır, kare çekin…");
  }, [reportStatus]);

  const resetSession = useCallback(() => {
    mapReadyRef.current = false;
    idleCountRef.current = 0;
    cancelledRef.current = false;
    initialFitDoneRef.current = false;
    autoCaptureStartedRef.current = false;
    fittedCameraRef.current = null;
    setMapReady(false);
    setMapError(null);
    setBusy(false);
    setAutoCaptureActive(false);
    setCapturedFrames([]);
    setSelectedIds(new Set());
    setPromptText("");
    setUseOpenAiPreflight(false);
    reportStatus(isNewSceneMode ? "Harita hazır, kare çekin…" : "Harita hazır, kareler alınacak…");
  }, [reportStatus, isNewSceneMode]);

  const canCaptureMore = useMemo(
    () => capturedFrames.length < effectiveSessionMax,
    [capturedFrames.length, effectiveSessionMax],
  );

  const showSceneLimitAlert = useCallback(() => {
    Alert.alert("Sahne limiti", SCENE_LIMIT_ALERT_MESSAGE, [{ text: "Tamam" }]);
  }, []);

  useEffect(() => {
    if (!visible) {
      cancelledRef.current = true;
      return;
    }
    cancelledRef.current = false;
    resetSession();
  }, [visible, resetSession, retryToken]);

  const runInitialAutoCapture = useCallback(async () => {
    if (
      cancelledRef.current ||
      busy ||
      autoCaptureStartedRef.current ||
      isNewSceneMode ||
      !Mapbox ||
      !feature ||
      !cameraDefaults ||
      !mapReadyRef.current
    ) {
      return;
    }

    const fitted = fittedCameraRef.current ?? cameraDefaults;
    autoCaptureStartedRef.current = true;
    setAutoCaptureActive(true);
    setBusy(true);
    setMapError(null);

    const frames: CapturedFrame[] = [];

    try {
      for (let i = 0; i < INITIAL_CAPTURE_BEARINGS.length; i += 1) {
        if (cancelledRef.current) return;

        reportStatus(`Kare ${i + 1}/${INITIAL_CAPTURE_BEARINGS.length} alınıyor…`);
        cameraRef.current?.setCamera?.({
          centerCoordinate: fitted.center,
          zoomLevel: fitted.zoom,
          pitch: RECORD_PITCH,
          heading: INITIAL_CAPTURE_BEARINGS[i],
          animationDuration: 0,
        });

        await new Promise((r) => setTimeout(r, CAMERA_SETTLE_MS + FRAME_RENDER_MS));

        let uri = await tryDroneMapReferenceSnap(mapRef, CAPTURE_SIZE, { format: "jpeg" });
        if (!uri) {
          await new Promise((r) => setTimeout(r, 500));
          uri = await tryDroneMapReferenceSnap(mapRef, CAPTURE_SIZE, { format: "jpeg" });
        }
        if (!uri) throw new Error(`Kare ${i + 1} alınamadı.`);

        frames.push({
          id: nextFrameId(),
          uri,
          name: `reference_${String(i + 1).padStart(2, "0")}.jpg`,
          type: "image/jpeg",
        });
      }

      if (cancelledRef.current) return;

      setCapturedFrames(frames);
      setSelectedIds(new Set());
      reportStatus(`${INITIAL_CAPTURE_BEARINGS.length} kare alındı. Kontrol edip Devam'a basın.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Görüntü yakalama başarısız.";
      setMapError(msg);
      reportStatus(msg);
      autoCaptureStartedRef.current = false;
      if (frames.length > 0) {
        setCapturedFrames(frames);
      }
    } finally {
      setBusy(false);
      setAutoCaptureActive(false);
    }
  }, [
    busy,
    feature,
    cameraDefaults,
    isNewSceneMode,
    reportStatus,
  ]);

  const runManualCapture = useCallback(async () => {
    if (cancelledRef.current || busy) return;

    if (!Mapbox || !feature) {
      reportStatus("Harita veya parsel geometrisi kullanılamıyor.");
      return;
    }

    if (!mapReadyRef.current) {
      reportStatus("Harita henüz hazır değil.");
      return;
    }

    if (capturedFrames.length >= totalMaxFrames) {
      showSceneLimitAlert();
      return;
    }

    if (!canCaptureMore) {
      if (capturedFrames.length >= totalMaxFrames) {
        showSceneLimitAlert();
      } else if (isNewSceneMode && onNeedPurchase) {
        onNeedPurchase();
      } else {
        Alert.alert(
          "Kare limiti",
          "Tek seferde en fazla iki kare alınabilir. Devam ederek videoyu oluşturun; kalan sahneleri üretimden sonra ekleyebilirsiniz.",
          [{ text: "Tamam" }],
        );
      }
      return;
    }

    let waitMs = 0;
    while (!mapRef.current && waitMs < 5000) {
      await new Promise((r) => setTimeout(r, 100));
      waitMs += 100;
    }
    if (!mapRef.current || cancelledRef.current) {
      reportStatus("Harita görünümü hazır değil.");
      return;
    }

    setBusy(true);
    setMapError(null);

    try {
      reportStatus("Kare alınıyor…");
      await new Promise((r) => setTimeout(r, FRAME_RENDER_MS));

      let uri = await tryDroneMapReferenceSnap(mapRef, CAPTURE_SIZE, { format: "jpeg" });
      if (!uri) {
        await new Promise((r) => setTimeout(r, 500));
        uri = await tryDroneMapReferenceSnap(mapRef, CAPTURE_SIZE, { format: "jpeg" });
      }
      if (!uri) throw new Error("Kare alınamadı.");

      if (cancelledRef.current) return;

      const frame: CapturedFrame = {
        id: nextFrameId(),
        uri,
        name: `reference_manual_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
      setCapturedFrames((prev) => [...prev, frame]);
      setSelectedIds(new Set());
      reportStatus(`Kare eklendi (${Math.min(capturedFrames.length + 1, totalMaxFrames)}/${totalMaxFrames}).`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Görüntü yakalama başarısız.";
      setMapError(msg);
      reportStatus(msg);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    feature,
    reportStatus,
    canCaptureMore,
    capturedFrames.length,
    totalMaxFrames,
    isNewSceneMode,
    onNeedPurchase,
    showSceneLimitAlert,
  ]);

  useEffect(() => {
    if (!visible || !feature || !mapReady || initialFitDoneRef.current || cancelledRef.current) {
      return;
    }
    initialFitDoneRef.current = true;
    void (async () => {
      setBusy(true);
      try {
        const fitted = await applyDroneCaptureCameraFit({
          cameraRef,
          mapRef,
          geometry: feature.geometry,
          captureViewport: CAPTURE_VIEWPORT,
          mapViewport: mapLayout,
          pitch: RECORD_PITCH,
          heading: 0,
          paddingPx: DRONE_CAPTURE_PADDING_PX,
          verifyHeadings: [...INITIAL_CAPTURE_BEARINGS],
        });
        if (fitted) {
          fittedCameraRef.current = fitted;
        } else if (cameraDefaults) {
          fittedCameraRef.current = cameraDefaults;
        }
        if (cancelledRef.current || isNewSceneMode) return;
        if (!cancelledRef.current) {
          void runInitialAutoCapture();
          return;
        }
      } finally {
        if (cancelledRef.current || isNewSceneMode) {
          setBusy(false);
        }
      }
    })();
  }, [visible, feature, mapReady, mapLayout, retryToken, isNewSceneMode, runInitialAutoCapture, cameraDefaults]);

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

  const handleRetryAutoCapture = useCallback(() => {
    autoCaptureStartedRef.current = false;
    setAutoCaptureActive(false);
    setMapError(null);
    setCapturedFrames([]);
    setSelectedIds(new Set());
    void runInitialAutoCapture();
  }, [runInitialAutoCapture]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setCapturedFrames((prev) => prev.filter((f) => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    reportStatus("Seçili kareler silindi.");
  }, [selectedIds, reportStatus]);

  const handleContinue = useCallback(() => {
    if (capturedFrames.length < effectiveMinFrames) {
      reportStatus(`En az ${effectiveMinFrames} kare gerekli.`);
      return;
    }
    if (capturedFrames.length > totalMaxFrames) {
      showSceneLimitAlert();
      return;
    }
    if (capturedFrames.length > effectiveSessionMax) {
      showSceneLimitAlert();
      return;
    }
    const images: MobileUploadImage[] = capturedFrames.map((frame, index) => ({
      uri: frame.uri,
      name: `reference_${String(index + 1).padStart(2, "0")}.jpg`,
      type: frame.type,
    }));
    onContinue({
      images,
      promptText: showPromptField ? promptText.trim() : undefined,
      useOpenAiPreflight: useOpenAiPreflight || undefined,
    });
  }, [
    capturedFrames,
    effectiveMinFrames,
    effectiveSessionMax,
    totalMaxFrames,
    onContinue,
    promptText,
    reportStatus,
    showPromptField,
    useOpenAiPreflight,
    showSceneLimitAlert,
  ]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    onCancel();
  }, [onCancel]);

  if (!visible) return null;

  if (!Mapbox) {
    return (
      <Modal visible animationType="slide" onRequestClose={handleCancel}>
        <SafeAreaView style={styles.safe}>
          <Text style={styles.error}>Harita modülü kullanılamıyor.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCancel}>
            <Text style={styles.primaryBtnText}>Kapat</Text>
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
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCancel}>
            <Text style={styles.primaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  const canContinue = capturedFrames.length >= effectiveMinFrames && !busy;

  return (
    <Modal visible animationType="slide" onRequestClose={busy ? undefined : handleCancel}>
      <View style={styles.safe}>
        <SafeAreaView edges={["top"]} style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={handleCancel}>
            <Text style={styles.topBtnText}>İptal</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isNewSceneMode ? "Yeni sahne" : "Referans kareleri"}</Text>
          <View style={styles.topBtnPlaceholder} />
        </SafeAreaView>

        <View style={styles.mapStage}>
          <View style={[styles.mapFrame, { width: mapLayout.width, height: mapLayout.height }]}>
            <Mapbox.MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              styleURL={homeIndexMapSatelliteStyleURL(Mapbox)}
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
              scrollEnabled={!busy}
              zoomEnabled={!busy}
              rotateEnabled={!busy}
              pitchEnabled={!busy}
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

            {busy ? (
              <View style={styles.mapBusyOverlay} pointerEvents="none">
                <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} size="large" />
              </View>
            ) : null}
          </View>

          <Text style={styles.statusText}>{mapError || status}</Text>
        </View>

        <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.thumbHeader}>
            <Text style={styles.thumbTitle}>
              Kareler ({capturedFrames.length})
            </Text>
            {selectedIds.size > 0 ? (
              <TouchableOpacity style={styles.deleteBtn} onPress={deleteSelected}>
                <Ionicons name="trash-outline" size={16} color="#fecaca" />
                <Text style={styles.deleteBtnText}>Sil ({selectedIds.size})</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbRow}
            style={styles.thumbScroll}
          >
            {capturedFrames.length === 0 ? (
              <Text style={styles.thumbEmpty}>
                {autoCaptureActive
                  ? `${INITIAL_CAPTURE_BEARINGS.length} kare otomatik alınıyor…`
                  : "Kare çekin…"}
              </Text>
            ) : (
              capturedFrames.map((frame) => {
                const selected = selectedIds.has(frame.id);
                return (
                  <TouchableOpacity
                    key={frame.id}
                    style={[styles.thumbItem, selected && styles.thumbItemSelected]}
                    onPress={() => toggleSelect(frame.id)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: frame.uri }} style={styles.thumbImage} resizeMode="contain" />
                    {selected ? (
                      <View style={styles.thumbCheck}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {showPromptField ? (
            <TextInput
              style={styles.promptInput}
              value={promptText}
              onChangeText={setPromptText}
              placeholder="Runway prompt (isteğe bağlı)"
              placeholderTextColor="#64748b"
              multiline
            />
          ) : null}

          <TouchableOpacity
            style={styles.preflightRow}
            onPress={() => setUseOpenAiPreflight((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={useOpenAiPreflight ? "checkbox" : "square-outline"}
              size={18}
              color={useOpenAiPreflight ? AI_DRONE_EDITOR_THEME.primaryBright : "#94a3b8"}
            />
            <Text style={styles.preflightLabel}>Resim canlandır</Text>
          </TouchableOpacity>

          {!autoCaptureActive ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.captureBtn, (busy || !mapReady || !canCaptureMore) && styles.btnDisabled]}
                onPress={() => void runManualCapture()}
                disabled={busy || !mapReady || !canCaptureMore}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.captureBtnText}>Çek</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.continueBtn, !canContinue && styles.btnDisabled]}
                onPress={handleContinue}
                disabled={!canContinue}
              >
                <Text style={styles.continueBtnText}>Devam</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}

          {mapError && !busy ? (
            <>
              {!isNewSceneMode ? (
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetryAutoCapture}>
                  <Text style={styles.retryBtnText}>Kareleri tekrar al</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                <Text style={styles.retryBtnText}>Haritayı yenile</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 20,
    elevation: 20,
    backgroundColor: "#0b1220",
  },
  topBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 64,
  },
  topBtnText: { color: "#e2e8f0", fontWeight: "700", fontSize: 15 },
  topBtnPlaceholder: { minWidth: 64 },
  topTitle: { color: "#f8fafc", fontWeight: "800", fontSize: 16 },
  mapStage: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    paddingTop: MAP_STAGE_TOP_GAP,
    gap: 8,
  },
  mapFrame: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  mapBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  bottomPanel: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.2)",
    backgroundColor: "#0f172a",
    paddingTop: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  thumbHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  thumbTitle: { color: "#e2e8f0", fontWeight: "700", fontSize: 13 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(127,29,29,0.45)",
  },
  deleteBtnText: { color: "#fecaca", fontWeight: "700", fontSize: 12 },
  thumbScroll: { maxHeight: 72 },
  thumbRow: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    minHeight: 68,
  },
  thumbEmpty: { color: "#94a3b8", fontSize: 12, paddingVertical: 20 },
  thumbItem: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbItemSelected: {
    borderColor: AI_DRONE_EDITOR_THEME.primaryBright,
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbCheck: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  captureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
  },
  captureBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  continueBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#16a34a",
  },
  continueBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.45 },
  retryBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryBtnText: { color: AI_DRONE_EDITOR_THEME.primaryBright, fontWeight: "700" },
  promptInput: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e2e8f0",
    minHeight: 56,
    textAlignVertical: "top",
    fontSize: 13,
  },
  preflightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  preflightLabel: { color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  error: { color: "#f8fafc", padding: 24, fontSize: 16, textAlign: "center" },
  primaryBtn: {
    margin: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
});
