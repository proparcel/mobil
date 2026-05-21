import { Platform } from 'react-native';
import type { BottomSheetModalProps } from '@gorhom/bottom-sheet';

/** Bottom sheet / modal formlar — ParcelSearchModal ile aynı sözleşme */
export const KEYBOARD_SHEET_MODAL_PROPS: Partial<BottomSheetModalProps> = {
  android_keyboardInputMode: 'adjustResize',
  keyboardBehavior: 'interactive',
};

export const SCROLL_VIEW_KEYBOARD_PROPS = {
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: 'on-drag' as const,
};

export const DEFAULT_HEADER_HEIGHT = 56;

export function getIosKeyboardVerticalOffset(
  safeAreaTop: number,
  headerHeight: number = DEFAULT_HEADER_HEIGHT,
): number {
  return safeAreaTop + headerHeight;
}

/** iOS KeyboardAvoidingView behavior; Android: undefined (sistem + scroll) */
export function getKeyboardAvoidingBehavior(
  context: 'screen' | 'auth' | 'modal' | 'form',
): 'padding' | 'height' | undefined {
  if (Platform.OS !== 'ios') return undefined;
  if (context === 'form') return 'height';
  return 'padding';
}
