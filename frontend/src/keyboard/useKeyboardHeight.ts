import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Klavye yüksekliği (px). Picker modal padding ve scroll-into-view için.
 * iOS: WillShow/WillHide; Android: DidShow/DidHide.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      const h = e.endCoordinates?.height;
      if (typeof h === 'number') setHeight(h);
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

/** Imperatif scroll-into-view için ref tabanlı yükseklik */
export function useKeyboardHeightRef() {
  const heightRef = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      heightRef.current = e.endCoordinates?.height ?? 0;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      heightRef.current = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return heightRef;
}
