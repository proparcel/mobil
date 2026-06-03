/**
 * 3D Model Editör – Capture Compose Container
 * Ekran dışında render edilen ViewShot: snapshot Image + overlay (ok/iğne/metin/ekran çizimi) + ProParcel badge
 */

import React, { useCallback, useImperativeHandle, useRef, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import ViewShot from "react-native-view-shot";
import { MapCaptureOverlayOnMap } from "../MapCaptureOverlayOnMap";
import type { MapOverlayCapturePayload } from "@/src/utils/mapOverlayCaptureProjection";
import {
  CAPTURE_IMAGE_LOAD_TIMEOUT_MS,
  CAPTURE_VIEW_SHOT_OPTIONS,
  prepareCaptureImageUri,
  verifyCaptureFile,
  waitCaptureLayoutFrames,
} from "@/src/utils/screenshotManager";

interface Props {
  capturedMapUri: string | null;
  width: number;
  height: number;
}

export type CaptureComposeOptions = {
  overlay?: MapOverlayCapturePayload | null;
  sourceViewport?: { width: number; height: number } | null;
};

export type CaptureComposeRef = {
  capture: () => Promise<string>;
  captureWithMapUri: (mapUri: string, options?: CaptureComposeOptions) => Promise<string>;
};

export const CaptureComposeContainer = React.forwardRef<CaptureComposeRef, Props>(
  ({ capturedMapUri: capturedMapUriProp, width, height }, ref) => {
    const viewShotRef = useRef<ViewShot>(null);
    const [displayMapUri, setDisplayMapUri] = useState<string | null>(capturedMapUriProp);
    const [captureOverlay, setCaptureOverlay] = useState<MapOverlayCapturePayload | null>(null);
    const [captureSourceViewport, setCaptureSourceViewport] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const imageReadyResolveRef = useRef<(() => void) | null>(null);

    React.useEffect(() => {
      setDisplayMapUri(capturedMapUriProp);
    }, [capturedMapUriProp]);

    const waitForDisplayedImage = useCallback(async (uri: string) => {
      await prepareCaptureImageUri(uri);
      await new Promise<void>((resolve) => {
        const finish = () => {
          imageReadyResolveRef.current = null;
          resolve();
        };
        imageReadyResolveRef.current = finish;
        setTimeout(finish, CAPTURE_IMAGE_LOAD_TIMEOUT_MS);
      });
    }, []);

    const runViewShotCapture = useCallback(async (): Promise<string> => {
      if (!viewShotRef.current?.capture) {
        throw new Error("ViewShot hazır değil");
      }
      const uri = await viewShotRef.current.capture();
      if (!uri) {
        throw new Error("ViewShot capture başarısız");
      }
      return uri;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        capture: runViewShotCapture,
        captureWithMapUri: async (mapUri: string, options?: CaptureComposeOptions) => {
          const ok = await verifyCaptureFile(mapUri);
          if (!ok) throw new Error("Harita görüntüsü geçersiz");
          setDisplayMapUri(mapUri);
          setCaptureOverlay(options?.overlay ?? null);
          setCaptureSourceViewport(options?.sourceViewport ?? null);
          await waitCaptureLayoutFrames(2);
          await waitForDisplayedImage(mapUri);
          return runViewShotCapture();
        },
      }),
      [runViewShotCapture, waitForDisplayedImage],
    );

    const handleMapImageLoad = useCallback(() => {
      imageReadyResolveRef.current?.();
      imageReadyResolveRef.current = null;
    }, []);

    if (!width || !height) return null;

    return (
      <ViewShot
        ref={viewShotRef}
        options={CAPTURE_VIEW_SHOT_OPTIONS}
        style={[styles.offscreen, { width, height }]}
      >
        <View style={[styles.container, { width, height }]}>
          {displayMapUri ? (
            <Image
              source={{ uri: displayMapUri }}
              fadeDuration={0}
              style={[styles.image, { width, height }]}
              resizeMode="cover"
              onLoadEnd={handleMapImageLoad}
            />
          ) : null}
          <MapCaptureOverlayOnMap
            overlay={captureOverlay}
            width={width}
            height={height}
            sourceViewport={captureSourceViewport}
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ProParcel</Text>
          </View>
        </View>
      </ViewShot>
    );
  },
);

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -10000,
    top: -10000,
    opacity: 0,
    pointerEvents: "none",
  },
  container: {
    backgroundColor: "#0f172a",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.5)",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
