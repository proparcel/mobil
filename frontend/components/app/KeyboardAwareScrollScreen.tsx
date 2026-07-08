import React, { forwardRef, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_HEADER_HEIGHT,
  SCROLL_VIEW_KEYBOARD_PROPS,
  getIosKeyboardVerticalOffset,
  getKeyboardAvoidingBehavior,
  useKeyboardHeight,
} from '../../src/keyboard';

export type KeyboardAwareScrollScreenProps = Omit<ScrollViewProps, 'ref'> & {
  children: React.ReactNode;
  /** Sabit header yüksekliği (px); yoksa 0 */
  headerHeight?: number;
  backgroundColor?: string;
  avoidingStyle?: StyleProp<ViewStyle>;
  /** iOS KAV behavior bağlamı */
  behaviorContext?: 'screen' | 'auth' | 'modal';
  /** Üst SafeAreaView (top) zaten uygulandıysa offset yalnızca headerHeight */
  safeAreaTopHandledExternally?: boolean;
  /**
   * Uzun ScrollView + scroll-into-view: KeyboardAvoidingView kapalı.
   * Çift kaydırma / klavye üstü gri boşluk önlenir; content paddingBottom ile klavye payı verilir.
   */
  disableKeyboardAvoiding?: boolean;
};

/**
 * Tam sayfa: tek KeyboardAvoidingView + ScrollView (klavye rehberi standardı).
 */
export const KeyboardAwareScrollScreen = forwardRef<ScrollView, KeyboardAwareScrollScreenProps>(
  function KeyboardAwareScrollScreen(
    {
      children,
      headerHeight = DEFAULT_HEADER_HEIGHT,
      backgroundColor = '#f1f5f9',
      avoidingStyle,
      behaviorContext = 'screen',
      safeAreaTopHandledExternally = false,
      disableKeyboardAvoiding = false,
      contentContainerStyle,
      style,
      keyboardShouldPersistTaps,
      keyboardDismissMode,
      nestedScrollEnabled = true,
      showsVerticalScrollIndicator = false,
      ...scrollProps
    },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const keyboardHeight = useKeyboardHeight();
    const behavior = disableKeyboardAvoiding ? undefined : getKeyboardAvoidingBehavior(behaviorContext);
    const keyboardVerticalOffset =
      Platform.OS === 'ios' && !disableKeyboardAvoiding
        ? safeAreaTopHandledExternally
          ? headerHeight
          : getIosKeyboardVerticalOffset(insets.top, headerHeight)
        : 0;

    const mergedContentContainerStyle = useMemo(() => {
      if (!disableKeyboardAvoiding || keyboardHeight <= 0) return contentContainerStyle;
      const flatten = StyleSheet.flatten(contentContainerStyle) ?? {};
      const baseBottom = typeof flatten.paddingBottom === 'number' ? flatten.paddingBottom : 0;
      const extra = { paddingBottom: baseBottom + keyboardHeight };
      if (Array.isArray(contentContainerStyle)) {
        return [...contentContainerStyle, extra];
      }
      return [contentContainerStyle, extra];
    }, [contentContainerStyle, disableKeyboardAvoiding, keyboardHeight]);

    const fillStyle = useMemo(
      () => [styles.fill, { backgroundColor }, avoidingStyle],
      [backgroundColor, avoidingStyle],
    );

    const scrollView = (
      <ScrollView
        ref={ref}
        style={[styles.fill, { backgroundColor }, style]}
        contentContainerStyle={mergedContentContainerStyle}
        nestedScrollEnabled={nestedScrollEnabled}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode ?? SCROLL_VIEW_KEYBOARD_PROPS.keyboardDismissMode}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );

    if (disableKeyboardAvoiding) {
      return <View style={fillStyle}>{scrollView}</View>;
    }

    return (
      <KeyboardAvoidingView
        style={fillStyle}
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {scrollView}
      </KeyboardAvoidingView>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
