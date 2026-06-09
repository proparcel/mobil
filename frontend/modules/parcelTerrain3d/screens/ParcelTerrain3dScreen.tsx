import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import TerrainUnityView from '../native/TerrainUnityView.native';
import { closeTerrainUnityViewer, resumeTerrainUnityViewer } from '../native/TerrainUnityModule';
import { clearTerrainPayload, getTerrainPayload } from '../store/terrainPayloadStore';
import {
  finishTerrainAttempt,
  getTerrainWorkspaceLogPath,
  logTerrainAttempt,
  readTerrainAttemptLog,
} from '../logging/terrainAttemptLog';

type RootStackParamList = {
  'parcel-terrain-3d': undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'parcel-terrain-3d'>;

export default function ParcelTerrain3dScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const session = useMemo(() => getTerrainPayload(), []);
  const [closing, setClosing] = useState(false);
  const [logHint, setLogHint] = useState<string>('');
  const finishedRef = React.useRef(false);

  useEffect(() => {
    if (!session) {
      navigation.goBack();
    }
  }, [session, navigation]);

  useEffect(() => {
    if (!session?.attemptId) return;
    setLogHint(`Deneme: ${session.attemptId}`);
  }, [session?.attemptId]);

  useFocusEffect(
    useCallback(() => {
      void resumeTerrainUnityViewer();
      const kick = setTimeout(() => void resumeTerrainUnityViewer(), 800);
      return () => clearTimeout(kick);
    }, []),
  );

  const finalizeAttempt = useCallback(
    async (status: 'success' | 'error' | 'closed') => {
      const attemptId = session?.attemptId;
      if (!attemptId || finishedRef.current) return;
      finishedRef.current = true;
      await logTerrainAttempt(attemptId, 'rn', 'info', 'screen.finalize', { status });
      const log = await finishTerrainAttempt(attemptId, status, {
        embeddedDemo: session.embeddedDemo,
        snapshotId: session.snapshotId,
      });
      if (__DEV__ && log) {
        setLogHint(`Log kaydedildi: ${getTerrainWorkspaceLogPath(attemptId)}`);
      }
    },
    [session],
  );

  useEffect(() => {
    return () => {
      void (async () => {
        await closeTerrainUnityViewer();
        await finalizeAttempt('closed');
        clearTerrainPayload();
      })();
    };
  }, [finalizeAttempt]);

  const handleClose = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    await closeTerrainUnityViewer();
    await finalizeAttempt('closed');
    clearTerrainPayload();
    navigation.goBack();
  }, [closing, finalizeAttempt, navigation]);

  const handleShareLog = useCallback(async () => {
    const attemptId = session?.attemptId;
    if (!attemptId) return;
    const log = await readTerrainAttemptLog(attemptId);
    if (!log) return;
    await Share.share({
      title: `Terrain log ${attemptId}`,
      message: JSON.stringify(log, null, 2),
    });
    await resumeTerrainUnityViewer();
  }, [session?.attemptId]);

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const title = [session.payload.parcel.ada, session.payload.parcel.parsel]
    .filter(Boolean)
    .join(' / ');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} accessibilityLabel="Kapat">
          <Ionicons name="close" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          3D Parsel Eğimi{title ? ` — ${title}` : ''}
        </Text>
        {__DEV__ && session.attemptId ? (
          <TouchableOpacity onPress={handleShareLog} style={styles.closeBtn} accessibilityLabel="Log paylaş">
            <Ionicons name="document-text-outline" size={20} color="#38bdf8" />
          </TouchableOpacity>
        ) : (
          <View style={styles.closeBtn} />
        )}
      </View>
      {__DEV__ && logHint ? <Text style={styles.logHint}>{logHint}</Text> : null}
      <TerrainUnityView
        style={styles.unity}
        embeddedDemo={session.embeddedDemo}
        attemptId={session.attemptId ?? undefined}
        terrainJson={session.embeddedDemo ? undefined : JSON.stringify(session.payload)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#f8fafc', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  logHint: {
    color: '#64748b',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
  },
  unity: { flex: 1 },
});
