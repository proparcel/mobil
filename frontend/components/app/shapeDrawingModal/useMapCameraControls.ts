import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Args = {
  center: [number, number];
  zoom: number;
  /** 2D başlangıç için 0; 3D için 60. Varsayılan 60. */
  initialPitch?: number;
};

export function useMapCameraControls({ center, zoom, initialPitch }: Args) {
  const initialPitchVal = initialPitch ?? 60;
  const cameraRef = useRef<any>(null);
  const camRef = useRef({ center, zoom, pitch: initialPitchVal, heading: INITIAL_HEADING });
  const INITIAL_HEADING = 20;
  const [cameraZoom, setCameraZoom] = useState<number>(zoom);
  const [cameraCenter, setCameraCenter] = useState<[number, number]>(center);
  const [cameraHeading, setCameraHeading] = useState<number>(INITIAL_HEADING);
  const [pitchValue, setPitchValue] = useState(initialPitchVal);
  const isProgrammaticMoveRef = useRef(false);

  const zoomIntervalRef = useRef<any>(null);
  const headingIntervalRef = useRef<any>(null);
  const pitchIntervalRef = useRef<any>(null);

  // keep defaults in sync if props change (e.g. modal opened with new center/zoom)
  useEffect(() => {
    camRef.current.center = center;
    camRef.current.zoom = zoom;
    camRef.current.heading = INITIAL_HEADING;
    setCameraZoom(zoom);
    setCameraCenter(center);
    setCameraHeading(INITIAL_HEADING);
  }, [center, zoom]);

  // Interval cleanup
  useEffect(() => {
    return () => {
      if (zoomIntervalRef.current) {
        clearInterval(zoomIntervalRef.current);
        zoomIntervalRef.current = null;
      }
      if (headingIntervalRef.current) {
        clearInterval(headingIntervalRef.current);
        headingIntervalRef.current = null;
      }
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
    };
  }, []);

  const handleZoomChange = useCallback(
    (delta: number) => {
      if (!cameraRef?.current?.setCamera) return;
      const current = typeof camRef.current.zoom === "number" ? camRef.current.zoom : zoom;
      const next = Math.max(2, Math.min(22, current + delta));
      isProgrammaticMoveRef.current = true;
      camRef.current.zoom = next;
      setCameraZoom(next);
      cameraRef.current.setCamera({
        centerCoordinate: camRef.current.center,
        zoomLevel: next,
        pitch: typeof camRef.current.pitch === "number" ? camRef.current.pitch : pitchValue,
        heading: typeof camRef.current.heading === "number" ? camRef.current.heading : INITIAL_HEADING,
        animationDuration: 250,
      });
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 300);
    },
    [pitchValue, zoom]
  );

  const startZoomChange = useCallback(
    (delta: number) => {
      handleZoomChange(delta);
      if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = setInterval(() => handleZoomChange(delta), 150);
    },
    [handleZoomChange]
  );

  /** Model uzun basış seçiminden sonra hafif zoom out — seçim ve düzenleme için daha rahat çerçeve */
  const easeZoomOutForModelSelection = useCallback(
    (centerCoordinate: [number, number]) => {
      if (!cameraRef?.current?.setCamera) return;
      const current =
        typeof camRef.current.zoom === "number" ? camRef.current.zoom : zoom;
      const delta = current > 18 ? 3 : current > 15 ? 2.5 : 2;
      const targetZoom = Math.max(2, Math.min(22, current - delta));
      if (targetZoom >= current - 0.05) return;
      isProgrammaticMoveRef.current = true;
      camRef.current.zoom = targetZoom;
      camRef.current.center = centerCoordinate;
      setCameraZoom(targetZoom);
      setCameraCenter(centerCoordinate);
      cameraRef.current.setCamera({
        centerCoordinate,
        zoomLevel: targetZoom,
        pitch: typeof camRef.current.pitch === "number" ? camRef.current.pitch : pitchValue,
        heading:
          typeof camRef.current.heading === "number" ? camRef.current.heading : INITIAL_HEADING,
        animationDuration: 500,
      });
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 550);
    },
    [zoom, pitchValue, setCameraZoom, setCameraCenter]
  );

  const stopZoomChange = useCallback(() => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  }, []);

  const handleHeadingChange = useCallback(
    (delta: number) => {
      if (!cameraRef?.current?.setCamera) return;
      const current = typeof camRef.current.heading === "number" ? camRef.current.heading : INITIAL_HEADING;
      const next = Math.round(((current + delta) % 360 + 360) % 360);
      isProgrammaticMoveRef.current = true;
      camRef.current.heading = next;
      setCameraHeading(next);
      cameraRef.current.setCamera({
        centerCoordinate: camRef.current.center,
        heading: next,
        pitch: typeof camRef.current.pitch === "number" ? camRef.current.pitch : pitchValue,
        zoomLevel: typeof camRef.current.zoom === "number" ? camRef.current.zoom : zoom,
        animationDuration: 250,
      });
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 300);
    },
    [pitchValue, zoom]
  );

  const startHeadingChange = useCallback(
    (delta: number) => {
      handleHeadingChange(delta);
      if (headingIntervalRef.current) clearInterval(headingIntervalRef.current);
      headingIntervalRef.current = setInterval(() => handleHeadingChange(delta), 150);
    },
    [handleHeadingChange]
  );

  const stopHeadingChange = useCallback(() => {
    if (headingIntervalRef.current) {
      clearInterval(headingIntervalRef.current);
      headingIntervalRef.current = null;
    }
  }, []);

  const handlePitchChange = useCallback(
    (nextPitch: number) => {
      if (!cameraRef?.current?.setCamera) return;
      const nv = Math.round(Math.max(0, Math.min(85, nextPitch)));
      isProgrammaticMoveRef.current = true;
      camRef.current.pitch = nv;
      setPitchValue(nv);
      cameraRef.current.setCamera({
        centerCoordinate: camRef.current.center,
        pitch: nv,
        heading: typeof camRef.current.heading === "number" ? camRef.current.heading : INITIAL_HEADING,
        zoomLevel: typeof camRef.current.zoom === "number" ? camRef.current.zoom : zoom,
        animationDuration: 250,
      });
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 300);
    },
    [zoom]
  );

  const startPitchChange = useCallback(
    (delta: number) => {
      const current = Math.round(typeof camRef.current.pitch === "number" ? camRef.current.pitch : pitchValue);
      handlePitchChange(current + delta);
      if (pitchIntervalRef.current) clearInterval(pitchIntervalRef.current);
      pitchIntervalRef.current = setInterval(() => {
        const cur = Math.round(typeof camRef.current.pitch === "number" ? camRef.current.pitch : pitchValue);
        handlePitchChange(cur + delta);
      }, 150);
    },
    [handlePitchChange, pitchValue]
  );

  const stopPitchChange = useCallback(() => {
    if (pitchIntervalRef.current) {
      clearInterval(pitchIntervalRef.current);
      pitchIntervalRef.current = null;
    }
  }, []);

  /** Kontroller açıldığında 3D görünüme geç; programmatic ref ile onCameraChanged'ın pitch'i ezmesi önlenir */
  const apply3DView = useCallback((targetPitch: number = 50) => {
    if (!cameraRef?.current?.setCamera) return;
    const nv = Math.round(Math.max(0, Math.min(85, targetPitch)));
    isProgrammaticMoveRef.current = true;
    camRef.current.pitch = nv;
    setPitchValue(nv);
    cameraRef.current.setCamera({
      centerCoordinate: camRef.current.center,
      zoomLevel: typeof camRef.current.zoom === "number" ? camRef.current.zoom : zoom,
      pitch: nv,
      heading: typeof camRef.current.heading === "number" ? camRef.current.heading : INITIAL_HEADING,
      animationDuration: 500,
    });
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 450);
  }, [zoom]);

  // Throttle: harita açı değişimlerinde titreme/sıçrama önlemek için state güncellemelerini seyrelt
  const CAMERA_STATE_THROTTLE_MS = 120;
  const lastCameraStateUpdateRef = useRef<number>(0);
  const pendingZoomRef = useRef<number | null>(null);
  const pendingPitchRef = useRef<number | null>(null);
  const pendingHeadingRef = useRef<number | null>(null);
  const pendingCenterRef = useRef<[number, number] | null>(null);

  // Programatik hareket sırasında gelen camera event'leri pitch/zoom'u ezmesin (terrain açılırken 2D-3D yanıp sönmesini önler)
  const onCameraChanged = useCallback((e: any) => {
    if (isProgrammaticMoveRef.current) return;

    const properties = e?.properties;
    const geometry = e?.geometry;

    const z = properties?.zoom ?? properties?.zoomLevel;
    const p = properties?.pitch;
    const h = properties?.heading ?? properties?.bearing;
    const c = geometry?.coordinates ?? properties?.centerCoordinate ?? properties?.center;

    const now = Date.now();
    const shouldFlushState =
      now - lastCameraStateUpdateRef.current >= CAMERA_STATE_THROTTLE_MS;

    if (typeof z === "number") {
      camRef.current.zoom = z;
      pendingZoomRef.current = z;
      if (shouldFlushState) {
        pendingZoomRef.current = null;
        setCameraZoom((prev) => (Math.abs(prev - z) >= 0.1 ? z : prev));
        lastCameraStateUpdateRef.current = now;
      }
    }
    if (typeof p === "number") camRef.current.pitch = p;
    if (typeof h === "number") {
      const roundedH = Math.round(((h % 360) + 360) % 360);
      camRef.current.heading = roundedH;
      pendingHeadingRef.current = roundedH;
      if (shouldFlushState && Math.abs(cameraHeading - roundedH) >= 2) {
        pendingHeadingRef.current = null;
        setCameraHeading(roundedH);
      }
    }

    // Pitch: tam sayıya yuvarla; titreme önlemek için hem throttle hem en az 2° fark
    if (typeof p === "number") {
      const roundedP = Math.round(p);
      pendingPitchRef.current = roundedP;
      if (
        shouldFlushState &&
        Math.abs(pitchValue - roundedP) >= 2
      ) {
        pendingPitchRef.current = null;
        setPitchValue(roundedP);
        if (__DEV__) {
          console.log("[useMapCameraControls] Pitch güncellendi:", {
            oldPitch: pitchValue,
            newPitch: roundedP,
          });
        }
      }
    }

    if (shouldFlushState) {
      lastCameraStateUpdateRef.current = now;
    }

    if (isProgrammaticMoveRef.current) return;

    if (Array.isArray(c) && c.length === 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      const newCenter: [number, number] = [c[0], c[1]];
      camRef.current.center = newCenter;
      pendingCenterRef.current = newCenter;
      if (shouldFlushState) {
        pendingCenterRef.current = null;
        setCameraCenter(newCenter);
      }
    }
  }, [cameraHeading, pitchValue]);

  // Throttle sonrası kalan zoom/pitch/center periyodik flush (kullanıcı hareketi durduğunda UI güncel kalsın)
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      if (now - lastCameraStateUpdateRef.current < CAMERA_STATE_THROTTLE_MS) return;
      const z = pendingZoomRef.current;
      const p = pendingPitchRef.current;
      const h = pendingHeadingRef.current;
      const cen = pendingCenterRef.current;
      let flushed = false;
      if (typeof z === "number") {
        pendingZoomRef.current = null;
        setCameraZoom((prev) => (Math.abs(prev - z) >= 0.1 ? z : prev));
        flushed = true;
      }
      if (typeof p === "number" && Math.abs(pitchValue - p) >= 1) {
        pendingPitchRef.current = null;
        setPitchValue(p);
        flushed = true;
      }
      if (typeof h === "number" && Math.abs(cameraHeading - h) >= 2) {
        pendingHeadingRef.current = null;
        setCameraHeading(h);
        flushed = true;
      }
      if (cen) {
        pendingCenterRef.current = null;
        setCameraCenter(cen);
        flushed = true;
      }
      if (flushed) lastCameraStateUpdateRef.current = now;
    }, 200);
    return () => clearInterval(t);
  }, [cameraHeading, pitchValue]);

  return useMemo(
    () => ({
      cameraRef,
      camRef,
      cameraZoom,
      cameraCenter,
      cameraHeading,
      pitchValue,
      setPitchValue,
      setCameraZoom,
      setCameraCenter,
      setCameraHeading,
      onCameraChanged,
      apply3DView,
      easeZoomOutForModelSelection,
      startZoomChange,
      stopZoomChange,
      startHeadingChange,
      stopHeadingChange,
      startPitchChange,
      stopPitchChange,
    }),
    [
      apply3DView,
      easeZoomOutForModelSelection,
      cameraCenter,
      cameraHeading,
      cameraZoom,
      onCameraChanged,
      pitchValue,
      startHeadingChange,
      startPitchChange,
      startZoomChange,
      stopHeadingChange,
      stopPitchChange,
      stopZoomChange,
    ]
  );
}

