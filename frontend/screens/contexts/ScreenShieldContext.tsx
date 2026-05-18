/**
 * ScreenShield context: overlay görünürlüğü ve capture state.
 * ParcelSplit odaktayken enable; capture/screenshot event'lerinde overlay gösterilir.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  enable,
  disable,
  setOverlayVisible,
  addCaptureChangedListener,
  addScreenshotDetectedListener,
  isAvailable,
} from "../../src/services/screenShieldService";

type ScreenShieldContextValue = {
  overlayVisible: boolean;
  captureActive: boolean;
  enableShield: () => void;
  disableShield: () => void;
  isAvailable: boolean;
};

const ScreenShieldContext = createContext<ScreenShieldContextValue | null>(null);

const OVERLAY_AFTER_SCREENSHOT_MS = 2000;

export function ScreenShieldProvider({ children }: { children: React.ReactNode }) {
  const [overlayVisible, setOverlayVisibleState] = useState(false);
  const [captureActive, setCaptureActive] = useState(false);
  const screenshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  const enableShield = useCallback(() => {
    if (!isAvailable) return;
    listenerCleanupRef.current?.();
    listenerCleanupRef.current = null;
    enable({ mode: "parcelSplit" });
    const removeCapture = addCaptureChangedListener((active) => {
      setCaptureActive(active);
      setOverlayVisibleState(active);
    });
    const removeScreenshot = addScreenshotDetectedListener(() => {
      setOverlayVisibleState(true);
      if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = setTimeout(() => {
        setOverlayVisibleState(false);
        screenshotTimerRef.current = null;
      }, OVERLAY_AFTER_SCREENSHOT_MS);
    });
    listenerCleanupRef.current = () => {
      removeCapture();
      removeScreenshot();
    };
  }, []);

  const disableShield = useCallback(() => {
    listenerCleanupRef.current?.();
    listenerCleanupRef.current = null;
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = null;
    }
    setOverlayVisibleState(false);
    setCaptureActive(false);
    disable();
  }, []);

  const value: ScreenShieldContextValue = {
    overlayVisible: overlayVisible || captureActive,
    captureActive,
    enableShield,
    disableShield,
    isAvailable,
  };

  return (
    <ScreenShieldContext.Provider value={value}>
      {children}
    </ScreenShieldContext.Provider>
  );
}

export function useScreenShield(): ScreenShieldContextValue {
  const ctx = useContext(ScreenShieldContext);
  if (!ctx) {
    return {
      overlayVisible: false,
      captureActive: false,
      enableShield: () => {},
      disableShield: () => {},
      isAvailable: false,
    };
  }
  return ctx;
}
