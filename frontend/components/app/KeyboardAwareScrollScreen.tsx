import React, { forwardRef, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
} from '../../src/keyboard';

export type KeyboardAwareScrollScreenProps = Omit<ScrollViewProps, 'ref'> & {
  children: React.ReactNode;
  /** Sabit header yüksekliği (px); yoksa 0 */
  headerHeight?: number;
  backgroundColor?: string;
  avoidingStyle?: StyleProp<ViewStyle>;
  /** iOS KAV behavior bağlamı */
  behaviorContext?: 'screen' | 'auth' | 'modal';
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
    const behavior = getKeyboardAvoidingBehavior(behaviorContext);
    const keyboardVerticalOffset =
      Platform.OS === 'ios' ? getIosKeyboardVerticalOffset(insets.top, headerHeight) : 0;

    const fillStyle = useMemo(
      () => [styles.fill, { backgroundColor }, avoidingStyle],
      [backgroundColor, avoidingStyle],
    );

    return (
      <KeyboardAvoidingView
        style={fillStyle}
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          ref={ref}
          style={[styles.fill, { backgroundColor }, style]}
          contentContainerStyle={contentContainerStyle}
          nestedScrollEnabled={nestedScrollEnabled}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode ?? SCROLL_VIEW_KEYBOARD_PROPS.keyboardDismissMode}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
