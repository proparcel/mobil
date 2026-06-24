import { Dimensions, Platform } from 'react-native';

type KeyboardEndCoordinates = {
  height?: number;
  screenY?: number;
};

export type KeyboardMetrics = {
  height: number;
  screenY: number;
};

/**
 * Android (özellikle Samsung / edge-to-edge) cihazlarda raporlanan height
 * eksik gelebilir; screenY ile screen yüksekliğinden türetilen değeri de kullan.
 */
export function resolveKeyboardMetrics(
  end?: KeyboardEndCoordinates | null,
): KeyboardMetrics {
  if (!end) return { height: 0, screenY: 0 };

  const reportedHeight = end.height ?? 0;
  const screenY = end.screenY ?? 0;
  const screenHeight = Dimensions.get('screen').height;

  let height = reportedHeight;
  if (Platform.OS === 'android' && screenY > 0) {
    const fromScreenY = screenHeight - screenY;
    if (fromScreenY > 0 && (reportedHeight <= 0 || fromScreenY > reportedHeight * 1.15)) {
      height = fromScreenY;
    }
  }

  return { height, screenY };
}

export function getKeyboardTopY(metrics: KeyboardMetrics): number {
  if (metrics.screenY > 0) return metrics.screenY;
  const windowHeight = Dimensions.get('window').height;
  return windowHeight - metrics.height;
}
