/**
 * View transform state ve fit-to-view için hook.
 * Pan/pinch gesture’lar canvas tarafından uygulanır; bu hook state + fitToView sağlar.
 */

import { useCallback, useState } from "react";
import type { ViewTransform } from "../../../src/types/parcelSplit";
import type { Bbox } from "../../../src/utils/parcelSplitTransform";
import {
  computeFitToView,
  screenToWorld as stw,
  worldToScreen as wts,
} from "../../../src/utils/parcelSplitTransform";

const MIN_SCALE = 0.05;
const MAX_SCALE = 50;

export function useViewTransform(
  width: number,
  height: number,
  padding: number
) {
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const fitToView = useCallback(
    (bbox: Bbox) => {
      const t = computeFitToView(bbox, width, height, padding);
      if (__DEV__) {
        console.log("[ParcelSplit] fitToView applied", { width, height, bbox, transform: t });
      }
      setViewTransform(t);
    },
    [width, height, padding]
  );

  const worldToScreen = useCallback(
    (p: { x: number; y: number }) => wts(p, viewTransform),
    [viewTransform]
  );

  const screenToWorld = useCallback(
    (p: { x: number; y: number }) => stw(p, viewTransform),
    [viewTransform]
  );

  const applyPan = useCallback((dx: number, dy: number) => {
    setViewTransform((prev) => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
    }));
  }, []);

  const applyPinch = useCallback(
    (factor: number, centerX: number, centerY: number) => {
      setViewTransform((prev) => {
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev.scale * factor)
        );
        const wx = (centerX - prev.translateX) / prev.scale;
        const wy = (centerY - prev.translateY) / prev.scale;
        const translateX = centerX - wx * newScale;
        const translateY = centerY - wy * newScale;
        return { scale: newScale, translateX, translateY };
      });
    },
    []
  );

  const zoomIn = useCallback(() => {
    setViewTransform((prev) => {
      const f = 1.25;
      const newScale = Math.min(MAX_SCALE, prev.scale * f);
      const cx = width / 2;
      const cy = height / 2;
      const wx = (cx - prev.translateX) / prev.scale;
      const wy = (cy - prev.translateY) / prev.scale;
      return {
        scale: newScale,
        translateX: cx - wx * newScale,
        translateY: cy - wy * newScale,
      };
    });
  }, [width, height]);

  const zoomOut = useCallback(() => {
    setViewTransform((prev) => {
      const f = 1 / 1.25;
      const newScale = Math.max(MIN_SCALE, prev.scale * f);
      const cx = width / 2;
      const cy = height / 2;
      const wx = (cx - prev.translateX) / prev.scale;
      const wy = (cy - prev.translateY) / prev.scale;
      return {
        scale: newScale,
        translateX: cx - wx * newScale,
        translateY: cy - wy * newScale,
      };
    });
  }, [width, height]);

  return {
    viewTransform,
    setViewTransform,
    fitToView,
    worldToScreen,
    screenToWorld,
    applyPan,
    applyPinch,
    zoomIn,
    zoomOut,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
  };
}
