import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";
import type { VrCalibrationStep } from "../types/vrCalibrationStep";
import type { MapReferencePointKey, MapReferencePoints, VrSessionPayload } from "../types/mapReferencePoints";
import type { CalibrationTransform } from "../types/calibrationTransform";
import type { VrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import { VrModeGate } from "./VrModeGate";
import { VrMapReferencePicker } from "./VrMapReferencePicker";
import { VrManualAdjustmentPanel } from "./VrManualAdjustmentPanel";
import { VrUnsupportedPanel } from "./VrUnsupportedPanel";
import { VrStepOverlay } from "./VrStepOverlay";
import { VrArStatusOverlay, type VrArReadinessState } from "./VrArStatusOverlay";
import { VrUnityRequiredPanel } from "./VrUnityRequiredPanel";
import VrUnityView from "../native/VrUnityView.native";
import {
  closeVrUnitySession,
  getVrUnityLinkStatus,
  sendUnityDrawParcel,
  sendUnityFineTune,
  sendUnityScaleFineTune,
} from "../native/VrUnityModule";
import { subscribeVrUnityEvents } from "../native/VrUnityEvents";
import { validateMapReferenceTriangle } from "../utils/vrMapReferenceSelection";
import { validateGpsRegionHint } from "../utils/vrGpsRegionValidation";
import { getExternalGnssHint } from "../utils/vrExternalGnss";
import { getVrStepMeta } from "../utils/vrCalibrationSteps";
import { isArCalibrationMode } from "../utils/vrModeSelector";
import { startVrGpsStream, stopVrGpsStream, getVrGpsSnapshot } from "../utils/vrGpsCapture";

export type { VrCalibrationStep };

type Props = {
  payload: VrParcelPayload;
  capabilities: VrDeviceCapabilities;
  mode: VrCalibrationMode;
  onClose: () => void;
};

const MAP_STEP_MAP: Record<string, MapReferencePointKey> = {
  map_user: "userPoint",
  map_ref_a: "referenceA",
  map_ref_b: "referenceB",
};

const UNITY_STEP_MAP: Record<string, VrCalibrationStep> = {
  ar_user: "ar_user",
  ar_ref_a: "ar_ref_a",
  ar_ref_b: "ar_ref_b",
  review: "review",
};

export function VrCalibrationFlow({ payload, capabilities, mode, onClose }: Props): React.ReactElement {
  const [step, setStep] = useState<VrCalibrationStep>("mode_intro");
  const [mapRefs, setMapRefs] = useState<Partial<MapReferencePoints>>({});
  const [calibration, setCalibration] = useState<CalibrationTransform | null>(null);
  const [unityOpened, setUnityOpened] = useState(false);
  const [unityAvailable, setUnityAvailable] = useState<boolean | null>(null);
  const [unityLinkStatus, setUnityLinkStatus] = useState<
    "missing_bridge" | "bridge_only" | "linked_stale_export" | "linked"
  >("bridge_only");
  const [busy, setBusy] = useState(false);
  const [gpsHint, setGpsHint] = useState<string | undefined>();
  const [gnssHint, setGnssHint] = useState<string | undefined>();
  const [locked, setLocked] = useState(false);
  const [arTapFeedback, setArTapFeedback] = useState<string | undefined>();
  const [arTapPulse, setArTapPulse] = useState<string | undefined>();
  const [arReadiness, setArReadiness] = useState<VrArReadinessState | null>(null);
  const [arReadinessSeen, setArReadinessSeen] = useState(false);
  const [activeUnitySession, setActiveUnitySession] = useState<VrSessionPayload | null>(null);

  useEffect(() => {
    startVrGpsStream();
    void getVrUnityLinkStatus().then((status) => {
      setUnityLinkStatus(status);
      setUnityAvailable(status === "linked");
    });
    if (capabilities.supportsExternalGnss) {
      setGnssHint(getExternalGnssHint({ connected: true, source: capabilities.externalGnssSource }));
    }
    const unsub = subscribeVrUnityEvents((event) => {
      if (event.event === "ar_readiness_changed") {
        setArReadinessSeen(true);
        setArReadiness({
          ready: Boolean(event.ready),
          planeCount: Number(event.planeCount ?? 0),
          tracking: event.tracking ?? "none",
          message: event.message ?? "",
        });
      }
      if (event.event === "ar_tap_received") {
        const x = event.x != null ? Math.round(event.x) : "?";
        const y = event.y != null ? Math.round(event.y) : "?";
        setArTapPulse(`Dokunuldu (${x}, ${y})`);
        if (event.stage !== "unity") {
          setArTapFeedback(undefined);
        }
      }
      if (event.event === "ar_tap_success" && event.message) {
        setArTapFeedback(undefined);
        setArTapPulse(event.message);
      }
      if (event.event === "ar_step_changed" && event.step && UNITY_STEP_MAP[event.step]) {
        setArTapFeedback(undefined);
        setArTapPulse(undefined);
        setStep(UNITY_STEP_MAP[event.step]);
      }
      if (event.event === "ar_tap_failed" && event.message) {
        setArTapFeedback(event.message);
      }
      if (event.event === "calibration_complete") {
        setCalibration((prev) =>
          prev ?? {
            originLat: mapRefs.userPoint?.lat ?? payload.center.lat,
            originLon: mapRefs.userPoint?.lon ?? payload.center.lon,
            rotationYaw: 0,
            translationX: 0,
            translationY: 0,
            translationZ: 0,
            scale: 1,
            qualityScore: event.qualityScore ?? 0.5,
            accuracyScore: event.qualityScore ?? 0.5,
            mode,
            createdAt: new Date().toISOString(),
          },
        );
        setStep("review");
      }
      if (event.event === "parcel_drawn") {
        setStep("drawn");
      }
    });
    return () => {
      stopVrGpsStream();
      unsub();
    };
  }, [
    capabilities.externalGnssSource,
    capabilities.supportsExternalGnss,
    mapRefs.userPoint,
    mode,
    payload.center.lat,
    payload.center.lon,
  ]);

  const mapStepKey = MAP_STEP_MAP[step];
  const isMapStep = Boolean(mapStepKey);
  const isUnityPhase = !isMapStep && step !== "mode_intro" && step !== "unity_required";
  const isArCameraStep = step === "ar_user" || step === "ar_ref_a" || step === "ar_ref_b";

  useEffect(() => {
    if (!isArCameraStep) return;
    const timer = setTimeout(() => setArTapPulse(undefined), 1800);
    return () => clearTimeout(timer);
  }, [arTapPulse, isArCameraStep]);

  useEffect(() => {
    if (!isArCameraStep || arReadinessSeen) return;
    const timer = setTimeout(() => {
      setArReadiness((prev) =>
        prev ?? {
          ready: false,
          planeCount: 0,
          tracking: "none",
          message: "Unity export güncellenmeli — yine de dokunmayı deneyin",
        },
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, [arReadinessSeen, isArCameraStep]);

  const mapTriangleValidation = useMemo(() => validateMapReferenceTriangle(mapRefs), [mapRefs]);

  const canContinueMapStep = useMemo(() => {
    if (step === "map_user") return Boolean(mapRefs.userPoint);
    if (step === "map_ref_a") return Boolean(mapRefs.referenceA);
    if (step === "map_ref_b") {
      return (
        Boolean(mapRefs.userPoint && mapRefs.referenceA && mapRefs.referenceB) &&
        mapTriangleValidation.ok
      );
    }
    return false;
  }, [mapRefs, mapTriangleValidation.ok, step]);

  const buildSessionPayload = useCallback(
    (refs: MapReferencePoints) => ({
      parcel: payload,
      mode,
      mapReferences: {
        userPoint: refs.userPoint,
        referenceA: refs.referenceA,
        referenceB: refs.referenceB,
      },
    }),
    [mode, payload],
  );

  const handleMapStepComplete = useCallback(
    (key: MapReferencePointKey, point: { lat: number; lon: number }) => {
      setMapRefs((prev) => ({ ...prev, [key]: point }));
      if (key === "userPoint") {
        const hint = validateGpsRegionHint(point, payload.center, getVrGpsSnapshot());
        setGpsHint(hint.level === "warn" ? hint.message : undefined);
      }
    },
    [payload.center],
  );

  const handleMapConfirm = useCallback(
    async (refs: MapReferencePoints) => {
      setMapRefs(refs);
      setBusy(true);
      try {
        const validation = validateMapReferenceTriangle(refs);
        if (!validation.ok) {
          Alert.alert("Harita referansı", validation.message ?? "Noktalar geçersiz.");
          return;
        }
        const session = buildSessionPayload(refs);
        const status = await getVrUnityLinkStatus();
        setUnityLinkStatus(status);
        const available = status === "linked";
        setUnityAvailable(available);
        if (status === "linked_stale_export" || !available) {
          setStep("unity_required");
          return;
        }
        setActiveUnitySession(session);
        setUnityOpened(true);
        setStep("ar_user");
      } finally {
        setBusy(false);
      }
    },
    [buildSessionPayload],
  );

  const handleMapContinue = useCallback(() => {
    if (step === "map_user") {
      if (!mapRefs.userPoint) return;
      setStep("map_ref_a");
      return;
    }
    if (step === "map_ref_a") {
      if (!mapRefs.referenceA) return;
      setStep("map_ref_b");
      return;
    }
    if (step === "map_ref_b") {
      if (!mapRefs.userPoint || !mapRefs.referenceA || !mapRefs.referenceB) return;
      if (!mapTriangleValidation.ok) {
        Alert.alert("Harita referansı", mapTriangleValidation.message ?? "Noktalar geçersiz.");
        return;
      }
      void handleMapConfirm({
        userPoint: mapRefs.userPoint,
        referenceA: mapRefs.referenceA,
        referenceB: mapRefs.referenceB,
      });
    }
  }, [handleMapConfirm, mapRefs, mapTriangleValidation.message, mapTriangleValidation.ok, step]);

  const handleDrawParcel = useCallback(() => {
    sendUnityDrawParcel();
  }, []);

  const handleFineTune = useCallback(
    (dx: number, dz: number, dyaw: number) => {
      if (locked) return;
      sendUnityFineTune(dx, dz, dyaw);
    },
    [locked],
  );

  const handleScaleFineTune = useCallback(
    (factor: number) => {
      if (locked) return;
      sendUnityScaleFineTune(factor);
    },
    [locked],
  );

  const handleRecalibrate = useCallback(() => {
    closeVrUnitySession();
    setMapRefs({});
    setCalibration(null);
    setUnityOpened(false);
    setActiveUnitySession(null);
    setLocked(false);
    setArTapFeedback(undefined);
    setArTapPulse(undefined);
    setArReadiness(null);
    setArReadinessSeen(false);
    setStep("mode_intro");
  }, []);

  if (!isArCalibrationMode(mode)) {
    return <VrUnsupportedPanel mode={mode} onClose={onClose} />;
  }

  if (step === "unity_required") {
    return (
      <VrUnityRequiredPanel
        linkStatus={unityLinkStatus}
        onBack={() => setStep("map_ref_b")}
        onClose={onClose}
      />
    );
  }

  return (
    <VrModeGate capabilities={capabilities} compact={isUnityPhase}>
      <View style={styles.root} pointerEvents="box-none">
        {isUnityPhase && unityOpened && activeUnitySession && unityLinkStatus === "linked" ? (
          <VrUnityView
            payloadJson={JSON.stringify(activeUnitySession)}
            style={styles.unityView}
          />
        ) : null}

        {isArCameraStep ? (
          <VrArStatusOverlay
            step={step}
            readiness={arReadiness}
            tapFeedback={arTapFeedback}
            tapPulse={arTapPulse}
            waitingUnity={!arReadinessSeen && unityOpened}
          />
        ) : isUnityPhase ? (
          <VrStepOverlay step={step} mode={mode} unityLinked={unityAvailable ?? false} />
        ) : null}

        {isMapStep && mapStepKey ? (
          <VrMapReferencePicker
            payload={payload}
            step={mapStepKey}
            partial={mapRefs}
            gpsHint={gpsHint ?? gnssHint}
            onStepComplete={handleMapStepComplete}
          />
        ) : null}

        {step === "mode_intro" ? (
          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{getVrStepMeta(step).title}</Text>
            <Text style={styles.infoText}>{getVrStepMeta(step).hint}</Text>
            <Text style={styles.unityNote}>
              AR kalibrasyon ve parsel çizimi Unity + {mode === "lidar_precise" ? "LiDAR ARKit" : "ARKit"} world
              içinde yapılır. Telefonu çevirince parsel sahnede sabit kalır.
            </Text>
          </View>
        ) : null}

        {step === "review" && !unityOpened ? (
          <View style={styles.infoPanel}>
            <Text style={styles.infoText}>Unity oturumu bekleniyor…</Text>
          </View>
        ) : null}

        {isMapStep ? (
          <View style={styles.footer}>
            {busy ? <ActivityIndicator color="#3b82f6" style={{ marginBottom: 8 }} /> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, !canContinueMapStep && styles.btnDisabled]}
              disabled={!canContinueMapStep || busy}
              onPress={handleMapContinue}
            >
              <Text style={styles.primaryBtnText}>Devam</Text>
            </TouchableOpacity>
          </View>
        ) : !isArCameraStep ? (
        <View style={styles.footer}>
          {step === "mode_intro" ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("map_user")}>
              <Text style={styles.primaryBtnText}>Harita Referanslarına Başla</Text>
            </TouchableOpacity>
          ) : null}

          {step === "review" ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleDrawParcel}>
              <Text style={styles.primaryBtnText}>Parseli Çiz (AR World)</Text>
            </TouchableOpacity>
          ) : null}

          {(step === "drawn" || step === "review") && unityOpened ? (
            <VrManualAdjustmentPanel
              onMove={handleFineTune}
              onScale={handleScaleFineTune}
              onLock={() => setLocked(true)}
              onRecalibrate={handleRecalibrate}
            />
          ) : null}

          {calibration && step === "review" ? (
            <Text style={styles.meta}>
              Kalite: {Math.round(calibration.qualityScore * 100)}% · Unity world sabit çizim
            </Text>
          ) : null}

          {busy ? <ActivityIndicator color="#3b82f6" style={{ marginTop: 8 }} /> : null}

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
        ) : null}
      </View>
    </VrModeGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  unityView: { ...StyleSheet.absoluteFillObject },
  infoPanel: { flex: 1, padding: 20, justifyContent: "center", gap: 10 },
  infoTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  infoText: { color: "#e2e8f0", fontSize: 15, lineHeight: 22 },
  unityNote: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  meta: { color: "#64748b", fontSize: 12, textAlign: "center" },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#334155",
    backgroundColor: "#0f172a",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  secondaryBtn: { paddingVertical: 10, alignItems: "center" },
  secondaryBtnText: { color: "#94a3b8", fontWeight: "600" },
});

export default VrCalibrationFlow;
