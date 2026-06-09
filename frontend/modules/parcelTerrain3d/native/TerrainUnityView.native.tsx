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
  terrainJson?: string;
  embeddedDemo?: boolean;
  attemptId?: string;
};

const NativeTerrainUnityView =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? requireNativeComponent<NativeProps>('TerrainUnityView')
    : null;

type Props = {
  terrainJson?: string;
  embeddedDemo?: boolean;
  attemptId?: string;
  style?: ViewStyle;
};

export function TerrainUnityView({ terrainJson, embeddedDemo, attemptId, style }: Props): React.ReactElement {
  if (NativeTerrainUnityView) {
    return (
      <NativeTerrainUnityView
        style={style}
        terrainJson={terrainJson}
        embeddedDemo={embeddedDemo === true}
        attemptId={attemptId}
      />
    );
  }

  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.title}>3D Eğim Görüntüleyici</Text>
      <Text style={styles.sub}>TerrainUnityView yalnızca Unity embed edilmiş native build'de aktiftir.</Text>
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
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});

export default TerrainUnityView;
