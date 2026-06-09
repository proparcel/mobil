import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import UnitySmokeTestView from '../native/UnitySmokeTestView.native';
import {
  getUnitySmokePlatformHint,
  isUnitySmokeTestAvailable,
  pingUnitySmokeTest,
} from '../native/UnitySmokeTestModule';

type RootStackParamList = {
  'unity-smoke-test': undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'unity-smoke-test'>;

const PING_DELAY_MS = 4000;

export default function UnitySmokeTestScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [unityReady, setUnityReady] = useState<boolean | null>(null);
  const [pingSent, setPingSent] = useState(false);
  const [pingStatus, setPingStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isUnitySmokeTestAvailable();
      if (!cancelled) setUnityReady(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (unityReady !== true || pingSent) return;
    const timer = setTimeout(async () => {
      const ok = await pingUnitySmokeTest('hello');
      setPingSent(true);
      setPingStatus(
        ok
          ? 'Ping gonderildi — logcat: adb logcat | findstr PP_SMOKE'
          : 'Ping basarisiz',
      );
    }, PING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [unityReady, pingSent]);

  const handleManualPing = useCallback(async () => {
    const ok = await pingUnitySmokeTest('hello-manual');
    setPingStatus(ok ? 'Manuel ping gonderildi' : 'Manuel ping basarisiz');
  }, []);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('index');
    }
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.iconBtn} accessibilityLabel="Kapat">
          <Ionicons name="close" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unity Smoke Test</Text>
        <TouchableOpacity onPress={handleManualPing} style={styles.iconBtn} accessibilityLabel="Ping">
          <Ionicons name="radio-outline" size={22} color="#38bdf8" />
        </TouchableOpacity>
      </View>

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>Beklenen</Text>
        <Text style={styles.hintText}>• Dönen kırmızı cube + UNITY OK yazısı</Text>
        <Text style={styles.hintText}>• Logcat: [PP_SMOKE] Awake / Start / Ping</Text>
        <Text style={styles.hintSub}>{getUnitySmokePlatformHint()}</Text>
        {pingStatus ? <Text style={styles.pingStatus}>{pingStatus}</Text> : null}
      </View>

      {unityReady === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : unityReady ? (
        <UnitySmokeTestView style={styles.unity} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>UnityPlayer yok</Text>
          <Text style={styles.errorSub}>
            Unity Android export (UnitySmokeTestScene index 0) + npm run android gerekir.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hintBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2937',
  },
  hintTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  hintText: { color: '#e2e8f0', fontSize: 12, lineHeight: 18 },
  hintSub: { color: '#64748b', fontSize: 11, marginTop: 6, lineHeight: 16 },
  pingStatus: { color: '#38bdf8', fontSize: 12, marginTop: 6 },
  unity: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { color: '#f87171', fontSize: 16, fontWeight: '700' },
  errorSub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
