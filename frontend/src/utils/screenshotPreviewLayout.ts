import { Dimensions } from 'react-native';
import { getCombinedImageDimensions } from './screenshotManager';

export type ScreenshotPreviewMapFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ScreenshotPreviewLayout = {
  overlayLeft: number;
  overlayTopVisible: number;
  overlayWidth: number;
  overlayHeight: number;
  mapFrameHeight: number;
  mapFrameScreen: ScreenshotPreviewMapFrame;
};

export function computeScreenshotPreviewLayout(options: {
  hasActiveParcel: boolean;
  insetTop?: number;
  insetBottom?: number;
}): ScreenshotPreviewLayout {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const dimensions = getCombinedImageDimensions();
  const insetTop = options.insetTop ?? 0;
  const insetBottom = options.insetBottom ?? 0;

  const baseOverlayWidth = dimensions.totalWidth;
  const baseOverlayHeight = options.hasActiveParcel ? dimensions.height : dimensions.mapHeight;

  const reservedTop = 60 + insetTop;
  const reservedBottom = 120 + insetBottom;
  const availableWidth = Math.max(0, screenWidth - 24);
  const availableHeight = Math.max(0, screenHeight - reservedTop - reservedBottom);

  const scaleW = baseOverlayWidth > 0 ? availableWidth / baseOverlayWidth : 1;
  const scaleH = baseOverlayHeight > 0 ? availableHeight / baseOverlayHeight : 1;
  const scale = Math.max(0, Math.min(1, scaleW, scaleH));

  const overlayWidth = baseOverlayWidth * scale;
  const overlayHeight = baseOverlayHeight * scale;
  const overlayLeft = (screenWidth - overlayWidth) / 2;
  const overlayTop = reservedTop + (availableHeight - overlayHeight) / 2;
  const overlayTopVisible = Math.max(0, overlayTop);
  const mapFrameHeight = dimensions.mapHeight * scale;

  return {
    overlayLeft,
    overlayTopVisible,
    overlayWidth,
    overlayHeight,
    mapFrameHeight,
    mapFrameScreen: {
      left: overlayLeft,
      top: overlayTopVisible,
      width: overlayWidth,
      height: mapFrameHeight,
    },
  };
}
