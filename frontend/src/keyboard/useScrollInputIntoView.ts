import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  type ScrollView,
  type View,
} from 'react-native';
import { getKeyboardTopY, resolveKeyboardMetrics } from './resolveKeyboardMetrics';
import { useKeyboardHeightRef } from './useKeyboardHeight';

export type ScrollInputIntoViewOptions = {
  scrollRef: React.RefObject<ScrollView | null>;
  inputWrapRef: React.RefObject<View | null>;
  /** Odak öncesi (ör. sekme değiştir) */
  onBeforeFocus?: () => void;
  /** Input üst kenarının ekranda kalması gereken minimum Y (px) */
  minVisibleTop?: number;
  /** Input altı ile klavye üstü arası boşluk (px) */
  keyboardOverlapMargin?: number;
  /** onBeforeFocus varsa ilk scroll gecikmesi */
  tabSwitchDelay?: number;
};

/**
 * Uzun ScrollView içindeki input — klavye açılınca yalnızca gerekli kadar scroll.
 */
export function useScrollInputIntoView({
  scrollRef,
  inputWrapRef,
  onBeforeFocus,
  minVisibleTop = 100,
  keyboardOverlapMargin = 20,
  tabSwitchDelay = 280,
}: ScrollInputIntoViewOptions) {
  const inputFocusedRef = useRef(false);
  const lastScrollAtRef = useRef(0);
  const keyboardMetricsRef = useKeyboardHeightRef();

  const scrollIntoView = useCallback((skipThrottle = false) => {
    const scroll = scrollRef.current;
    const anchor = inputWrapRef.current;
    if (!scroll || !anchor) return;

    const now = Date.now();
    if (!skipThrottle && now - lastScrollAtRef.current < 180) return;
    lastScrollAtRef.current = now;

    const inner = scroll.getInnerViewRef?.() as View | null;
    if (!inner) return;

    const doScroll = (contentY: number) => {
      anchor.measureInWindow((_x, winY, _w, inputH) => {
        const metrics = keyboardMetricsRef.current;
        if (metrics.height <= 0) return;

        const keyboardTop = getKeyboardTopY(metrics);
        const inputBottom = winY + inputH;
        const overlap = inputBottom - (keyboardTop - keyboardOverlapMargin);
        if (overlap <= 0) return;

        // Klavye temizliği öncelik: uzun textarea'da alt kenar tamamen görünür olmalı.
        const scrollDelta = overlap;
        if (scrollDelta <= 0) return;

        scroll.measureInWindow((_sx, scrollViewWinY) => {
          const currentScrollY = Math.max(0, contentY - (winY - scrollViewWinY));
          scroll.scrollTo({ y: currentScrollY + scrollDelta, animated: true });
        });
      });
    };

    anchor.measureLayout(
      inner,
      (_x, y) => doScroll(y),
      () => {
        setTimeout(() => {
          anchor.measureLayout(inner, (_x, y) => doScroll(y), () => {});
        }, 150);
      },
    );
  }, [
    scrollRef,
    inputWrapRef,
    keyboardOverlapMargin,
    keyboardMetricsRef,
  ]);

  const scheduleScrollIntoView = useCallback(
    (delayMs: number, skipThrottle = false) => {
      setTimeout(() => scrollIntoView(skipThrottle), delayMs);
    },
    [scrollIntoView],
  );

  const handleFocus = useCallback(() => {
    inputFocusedRef.current = true;
    onBeforeFocus?.();
    const tabDelay = onBeforeFocus ? tabSwitchDelay : 120;
    scheduleScrollIntoView(tabDelay);
    scheduleScrollIntoView(tabDelay + 220, true);
    scheduleScrollIntoView(tabDelay + 420, true);
  }, [onBeforeFocus, tabSwitchDelay, scheduleScrollIntoView]);

  const handleBlur = useCallback(() => {
    inputFocusedRef.current = false;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardMetricsRef.current = resolveKeyboardMetrics(e.endCoordinates);
      if (!inputFocusedRef.current) return;
      const baseDelay = Platform.OS === 'android' ? 160 : 80;
      scheduleScrollIntoView(baseDelay);
      scheduleScrollIntoView(baseDelay + 220, true);
      scheduleScrollIntoView(baseDelay + 420, true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardMetricsRef.current = { height: 0, screenY: 0 };
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scheduleScrollIntoView, keyboardMetricsRef]);

  return { handleFocus, handleBlur, scrollIntoView };
}
