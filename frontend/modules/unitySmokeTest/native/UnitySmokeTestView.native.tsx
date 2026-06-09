import React from 'react';
import {
  requireNativeComponent,
  View,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';

type NativeProps = {
  style?: ViewStyle;
};

const NativeUnitySmokeTestView =
  Platform.OS === 'android'
    ? requireNativeComponent<NativeProps>('UnitySmokeTestView')
    : null;

type Props = {
  style?: ViewStyle;
};

export function UnitySmokeTestView({ style }: Props): React.ReactElement {
  if (NativeUnitySmokeTestView) {
    return <NativeUnitySmokeTestView style={style} />;
  }

  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.title}>Unity Smoke Test</Text>
      <Text style={styles.sub}>Native UnitySmokeTestView yalnizca Android embed build'de aktif.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  sub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});

export default UnitySmokeTestView;
