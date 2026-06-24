import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import {
  resolveKeyboardMetrics,
  type KeyboardMetrics,
} from './resolveKeyboardMetrics';

const EMPTY_KEYBOARD_METRICS: KeyboardMetrics = { height: 0, screenY: 0 };

/**
 * Klavye yüksekliği (px). Picker modal padding ve scroll-into-view için.
 * iOS: WillShow/WillHide; Android: DidShow/DidHide.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates?: { height?: number; screenY?: number } }) => {
      setHeight(resolveKeyboardMetrics(e.endCoordinates).height);
    };
    const onHide = () => setHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

/** Imperatif scroll-into-view için ref tabanlı klavye metrikleri */
export function useKeyboardHeightRef() {
  const metricsRef = useRef<KeyboardMetrics>(EMPTY_KEYBOARD_METRICS);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      metricsRef.current = resolveKeyboardMetrics(e.endCoordinates);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      metricsRef.current = EMPTY_KEYBOARD_METRICS;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return metricsRef;
}
