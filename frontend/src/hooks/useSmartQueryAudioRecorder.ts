import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, type RecordingStatus } from 'expo-av';
import RNFS from 'react-native-fs';
import {
  ensureMicrophonePermission,
  permissionBlockedHint,
  permissionDeniedHint,
} from '../utils/devicePermissions';
import {
  appendSmartQueryDebugLog,
  logSmartQuerySessionStart,
} from '../utils/smartQueryDebugLog';

export type SmartQueryRecordingPayload = {
  base64: string;
  mimeType: string;
  uri: string;
};

const METERING_POLL_MS = 80;

function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.3gp')) return 'audio/3gpp';
  if (lower.endsWith('.caf')) return 'audio/x-caf';
  return 'audio/m4a';
}

function normalizeMetering(db?: number): number {
  if (typeof db !== 'number' || Number.isNaN(db)) return 0;
  return Math.min(1, Math.max(0, (db + 55) / 55));
}

async function describeAudioFile(path: string): Promise<{
  fileBytes: number;
  exists: boolean;
}> {
  try {
    const exists = await RNFS.exists(path);
    if (!exists) return { fileBytes: 0, exists: false };
    const stat = await RNFS.stat(path);
    return { fileBytes: Number(stat.size) || 0, exists: true };
  } catch {
    return { fileBytes: 0, exists: false };
  }
}

export function useSmartQueryAudioRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtMsRef = useRef<number | null>(null);
  const lastStatusDurationMsRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState('audio/m4a');
  const [permissionHint, setPermissionHint] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const clearRecording = useCallback(async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
      }
    } catch {
      /* ignore */
    }
    recordingRef.current = null;
    recordingStartedAtMsRef.current = null;
    lastStatusDurationMsRef.current = null;
    setIsRecording(false);
    setRecordingUri(null);
    setRecordingMimeType('audio/m4a');
    setAudioLevel(0);
    void appendSmartQueryDebugLog('recorder_clear', 'recorder');
  }, []);

  useEffect(() => {
    return () => {
      void clearRecording();
    };
  }, [clearRecording]);

  const handleRecordingStatus = useCallback((status: RecordingStatus) => {
    if (!status.isRecording) return;
    if (typeof status.durationMillis === 'number' && !Number.isNaN(status.durationMillis)) {
      lastStatusDurationMsRef.current = status.durationMillis;
    }
    setAudioLevel(normalizeMetering(status.metering));
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setPermissionHint(null);
    setAudioLevel(0);

    const permission = await ensureMicrophonePermission();
    if (!permission.granted) {
      setPermissionHint(
        permission.blocked
          ? permissionBlockedHint('microphone')
          : permissionDeniedHint('microphone')
      );
      return false;
    }

    try {
      if (recordingRef.current) {
        await clearRecording();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        handleRecordingStatus,
        METERING_POLL_MS
      );

      recordingRef.current = recording;
      recordingStartedAtMsRef.current = Date.now();
      lastStatusDurationMsRef.current = 0;
      setIsRecording(true);
      setRecordingUri(null);
      await logSmartQuerySessionStart('recorder', 'speech');
      await appendSmartQueryDebugLog('recorder_start', 'recorder', {
        startedAtMs: recordingStartedAtMsRef.current,
      });
      return true;
    } catch (error: any) {
      await appendSmartQueryDebugLog('recorder_start_failed', 'recorder', {
        message: error?.message || 'Kayıt başlatılamadı.',
      });
      Alert.alert('Ses kaydı', error?.message || 'Kayıt başlatılamadı.');
      return false;
    }
  }, [clearRecording, handleRecordingStatus]);

  const stopRecording = useCallback(async (): Promise<SmartQueryRecordingPayload | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setAudioLevel(0);

      if (!uri) {
        Alert.alert('Ses kaydı', 'Kayıt dosyası oluşturulamadı.');
        return null;
      }

      const mimeType = mimeFromUri(uri);
      setRecordingUri(uri);
      setRecordingMimeType(mimeType);

      const path = uri.replace(/^file:\/\//, '');
      const fileInfo = await describeAudioFile(path);
      const base64 = await RNFS.readFile(path, 'base64');
      const stoppedAtMs = Date.now();
      const wallDurationMs =
        recordingStartedAtMsRef.current != null
          ? stoppedAtMs - recordingStartedAtMsRef.current
          : null;
      const statusDurationMs = lastStatusDurationMsRef.current;

      await appendSmartQueryDebugLog('recorder_stop', 'recorder', {
        uri,
        mimeType,
        path,
        fileBytes: fileInfo.fileBytes,
        fileExists: fileInfo.exists,
        base64Length: base64?.length ?? 0,
        wallDurationMs,
        statusDurationMs,
        under1sWall: wallDurationMs != null ? wallDurationMs < 1000 : null,
        under1sStatus: statusDurationMs != null ? statusDurationMs < 1000 : null,
        under01sWhisperMin: fileInfo.fileBytes < 800,
      });

      recordingStartedAtMsRef.current = null;
      lastStatusDurationMsRef.current = null;

      if (!base64) {
        Alert.alert('Ses kaydı', 'Kayıt okunamadı.');
        return null;
      }

      return { base64, mimeType, uri };
    } catch (error: any) {
      recordingRef.current = null;
      setIsRecording(false);
      setAudioLevel(0);
      await appendSmartQueryDebugLog('recorder_stop_failed', 'recorder', {
        message: error?.message || 'Kayıt durdurulamadı.',
      });
      Alert.alert('Ses kaydı', error?.message || 'Kayıt durdurulamadı.');
      return null;
    }
  }, []);

  const getRecordingPayload = useCallback(async (): Promise<SmartQueryRecordingPayload | null> => {
    if (!recordingUri) return null;
    try {
      const path = recordingUri.replace(/^file:\/\//, '');
      const fileInfo = await describeAudioFile(path);
      const base64 = await RNFS.readFile(path, 'base64');
      await appendSmartQueryDebugLog('recorder_payload_reuse', 'recorder', {
        uri: recordingUri,
        mimeType: recordingMimeType,
        path,
        fileBytes: fileInfo.fileBytes,
        fileExists: fileInfo.exists,
        base64Length: base64?.length ?? 0,
      });
      if (!base64) return null;
      return { base64, mimeType: recordingMimeType, uri: recordingUri };
    } catch (error: any) {
      await appendSmartQueryDebugLog('recorder_stop_failed', 'recorder', {
        phase: 'payload_reuse',
        message: error?.message || 'Kayıt okunamadı.',
      });
      Alert.alert('Ses kaydı', error?.message || 'Kayıt okunamadı.');
      return null;
    }
  }, [recordingUri, recordingMimeType]);

  return {
    isRecording,
    hasRecording: Boolean(recordingUri),
    recordingUri,
    recordingMimeType,
    permissionHint,
    audioLevel,
    startRecording,
    stopRecording,
    clearRecording,
    getRecordingPayload,
  };
}
