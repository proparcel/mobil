import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_HEADER_HEIGHT,
  getIosKeyboardVerticalOffset,
  getKeyboardAvoidingBehavior,
} from '../../src/keyboard';

type Props = {
  children: React.ReactNode;
  headerHeight?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

/** FlatList / sabit layout — tek KAV sarmalayıcı (arama + liste vb.) */
export function KeyboardAwareBody({
  children,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  backgroundColor = '#f8fafc',
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const behavior = getKeyboardAvoidingBehavior('screen');
  const keyboardVerticalOffset =
    Platform.OS === 'ios' ? getIosKeyboardVerticalOffset(insets.top, headerHeight) : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor }, style]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
