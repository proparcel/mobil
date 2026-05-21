import { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  type ScrollView,
  type View,
} from 'react-native';
import { useKeyboardHeightRef } from './useKeyboardHeight';

export type ScrollInputIntoViewOptions = {
  scrollRef: React.RefObject<ScrollView | null>;
  inputWrapRef: React.RefObject<View | null>;
  /** Odak öncesi (ör. sekme değiştir) */
  onBeforeFocus?: () => void;
  topGap?: number;
  /** Input altı ile klavye üstü arası boşluk (px) */
  keyboardOverlapMargin?: number;
  /** onBeforeFocus varsa ilk scroll gecikmesi */
  tabSwitchDelay?: number;
};

/**
 * Uzun ScrollView içindeki input — klavye açılınca programatik scroll.
 * Referans: PortalDfaTableCard mahalle birim fiyatı.
 */
export function useScrollInputIntoView({
  scrollRef,
  inputWrapRef,
  onBeforeFocus,
  topGap = 80,
  keyboardOverlapMargin = 20,
  tabSwitchDelay = 400,
}: ScrollInputIntoViewOptions) {
  const inputFocusedRef = useRef(false);
  const keyboardHeightRef = useKeyboardHeightRef();

  const scrollIntoView = useCallback(() => {
    const scroll = scrollRef.current;
    const anchor = inputWrapRef.current;
    if (!scroll || !anchor) return;

    const inner = scroll.getInnerViewRef?.() as View | null;
    if (!inner) return;

    const doScroll = (contentY: number) => {
      anchor.measureInWindow((_x, winY, _w, inputH) => {
        const winH = Dimensions.get('window').height;
        const kb = keyboardHeightRef.current;
        const keyboardTop = winH - kb;
        const inputBottom = winY + inputH;
        let targetY = Math.max(0, contentY - topGap);
        if (kb > 0 && inputBottom > keyboardTop - keyboardOverlapMargin) {
          targetY += inputBottom - keyboardTop + keyboardOverlapMargin;
        }
        scroll.scrollTo({ y: targetY, animated: true });
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
  }, [scrollRef, inputWrapRef, topGap, keyboardOverlapMargin, keyboardHeightRef]);

  const handleFocus = useCallback(() => {
    inputFocusedRef.current = true;
    onBeforeFocus?.();
    const tabDelay = onBeforeFocus ? tabSwitchDelay : 80;
    setTimeout(scrollIntoView, tabDelay);
    setTimeout(scrollIntoView, tabDelay + 280);
  }, [onBeforeFocus, tabSwitchDelay, scrollIntoView]);

  const handleBlur = useCallback(() => {
    inputFocusedRef.current = false;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeightRef.current = e.endCoordinates?.height ?? 0;
      if (!inputFocusedRef.current) return;
      setTimeout(scrollIntoView, 50);
      setTimeout(scrollIntoView, 220);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollIntoView, keyboardHeightRef]);

  return { handleFocus, handleBlur, scrollIntoView };
}
