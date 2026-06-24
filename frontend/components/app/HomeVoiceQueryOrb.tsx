import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import VoiceSearchListeningAnimation from './VoiceSearchListeningAnimation';
import { useSmartQueryAudioRecorder } from '../../src/hooks/useSmartQueryAudioRecorder';
import { extractSmartQueryFromSpeech } from '../../services/smartQueryService';
import {
  resolveSmartQueryForForm,
} from '../../src/utils/smartQueryResolve';
import type { SidebarSavedQuery } from '../../src/utils/sidebarSavedQueries';
import {
  appendSmartQueryDebugLog,
  logSmartQuerySessionStart,
} from '../../src/utils/smartQueryDebugLog';
import { showSmartQueryErrorAlert } from '../../src/utils/smartQueryErrorAlert';
import { useAuth } from '../../screens/contexts/AuthContext';
import { useRouter } from '../../src/hooks/useNavigation';
import {
  canUseSmartQuery,
  promptSmartQueryUpgrade,
  promptSmartQueryLogin,
} from '../../src/utils/customerFeatureGates';

const ORB_IDLE_SIZE = 94;
const ORB_ACTIVE_SIZE = 118;
const ORB_LIFT_Y = 54;
const ORB_PIN_SCALE = 1.02;

type Props = {
  onFormSeedResolved: (seed: SidebarSavedQuery) => void;
  onInteraction?: () => void;
};

export default function HomeVoiceQueryOrb({ onFormSeedResolved, onInteraction }: Props) {
  const voiceRecorder = useSmartQueryAudioRecorder();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const smartQueryEnabled = canUseSmartQuery(user);

  const ensureVoiceQueryAccess = useCallback((): boolean => {
    if (isAuthLoading) return false;
    if (!isAuthenticated) {
      promptSmartQueryLogin(() => router.push('login'));
      return false;
    }
    if (!smartQueryEnabled) {
      promptSmartQueryUpgrade(() => router.push('pricing'));
      return false;
    }
    return true;
  }, [isAuthLoading, isAuthenticated, smartQueryEnabled, router]);
  const [isExtracting, setIsExtracting] = useState(false);

  const voiceAnimMode = isExtracting ? 'processing' : voiceRecorder.isRecording ? 'listening' : 'idle';
  const isOrbExpanded = voiceRecorder.isRecording || isExtracting;
  const expandProgress = useSharedValue(0);

  useEffect(() => {
    expandProgress.value = withTiming(isOrbExpanded ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOrbExpanded, expandProgress]);

  const orbClusterAnimStyle = useAnimatedStyle(() => {
    const idleScale = ORB_IDLE_SIZE / ORB_ACTIVE_SIZE;
    const scale = idleScale + (1 - idleScale) * expandProgress.value;
    return {
      transform: [
        { translateY: -ORB_LIFT_Y * expandProgress.value },
        { scale },
      ],
    };
  });

  const voiceActionLabel = isExtracting
    ? 'Analiz ediliyor…'
    : voiceRecorder.isRecording
      ? 'Gönder'
      : 'Konuş';
  const voiceOverlayLabelTone = isExtracting
    ? 'processing'
    : voiceRecorder.isRecording
      ? 'active'
      : 'idle';

  const handleSpeechSend = useCallback(async () => {
    if (isExtracting) return;
    if (!ensureVoiceQueryAccess()) return;

    await appendSmartQueryDebugLog('flow_send_start', 'orb', {
      isRecording: voiceRecorder.isRecording,
      hasRecording: voiceRecorder.hasRecording,
      recordingMimeType: voiceRecorder.recordingMimeType,
    });

    let recording: Awaited<ReturnType<typeof voiceRecorder.getRecordingPayload>> = null;
    if (voiceRecorder.isRecording) {
      recording = await voiceRecorder.stopRecording();
    } else {
      recording = await voiceRecorder.getRecordingPayload();
    }

    if (!recording?.base64) {
      setIsExtracting(false);
      await appendSmartQueryDebugLog('flow_send_skip', 'orb', {
        reason: 'empty_payload',
      });
      showSmartQueryErrorAlert('Lütfen önce konuşarak bir sorgu yapın.');
      return;
    }

    setIsExtracting(true);

    try {
      const response = await extractSmartQueryFromSpeech(recording.base64, recording.mimeType);
      if (!response.ok) {
        await appendSmartQueryDebugLog('flow_error', 'orb', {
          phase: 'http_error',
          status: response.status,
          error: response.error,
        });
        showSmartQueryErrorAlert(response.error || 'Ses kaydı işlenirken bir hata oluştu.');
        return;
      }

      const outcome = await resolveSmartQueryForForm(response.data, {
        channel: 'speech',
        source: 'orb',
      });

      if (outcome.status === 'complete') {
        await appendSmartQueryDebugLog('flow_success', 'orb', {
          summary: outcome.summary,
          mahalleTkgmValue: outcome.payload.mahalleTkgmValue,
        });
        onFormSeedResolved(outcome.seed);
        return;
      }

      if (outcome.status === 'partial') {
        await appendSmartQueryDebugLog('flow_partial_success', 'orb', {
          il: outcome.seed.il,
          ilce: outcome.seed.ilce,
          ada: outcome.seed.ada,
          parsel: outcome.seed.parsel,
        });
        Alert.alert('Akıllı Sorgu', outcome.message);
        onFormSeedResolved(outcome.seed);
        return;
      }

      showSmartQueryErrorAlert(outcome.error);
    } catch (error: any) {
      await appendSmartQueryDebugLog('flow_error', 'orb', {
        phase: 'exception',
        message: error?.message || 'Ses sorgusu başlatılamadı.',
      });
      showSmartQueryErrorAlert(error?.message || 'Ses sorgusu başlatılamadı.');
    } finally {
      setIsExtracting(false);
    }
  }, [isExtracting, voiceRecorder, onFormSeedResolved, ensureVoiceQueryAccess]);

  const handleAnimationPress = useCallback(async () => {
    onInteraction?.();
    if (isExtracting) return;
    if (!ensureVoiceQueryAccess()) return;

    if (voiceRecorder.isRecording) {
      setIsExtracting(true);
      await handleSpeechSend();
      return;
    }

    await logSmartQuerySessionStart('orb', 'speech');
    await voiceRecorder.startRecording();
  }, [isExtracting, voiceRecorder, handleSpeechSend, onInteraction, ensureVoiceQueryAccess]);

  const handleCancel = useCallback(async () => {
    if (isExtracting) return;
    await voiceRecorder.clearRecording();
  }, [voiceRecorder, isExtracting]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.orbCluster, orbClusterAnimStyle]}>
        <TouchableOpacity
          onPress={handleAnimationPress}
          disabled={isExtracting}
          activeOpacity={0.92}
          style={styles.orbTap}
          accessibilityRole="button"
          accessibilityLabel={voiceActionLabel}
        >
          <View pointerEvents="none" style={styles.orbVisual}>
            <VoiceSearchListeningAnimation
              mode={voiceAnimMode}
              audioLevel={voiceRecorder.isRecording ? voiceRecorder.audioLevel : 0}
              size={ORB_ACTIVE_SIZE}
              mapOrbBackground
              pinScale={ORB_PIN_SCALE}
            />
          </View>
        </TouchableOpacity>

        <View
          pointerEvents="none"
          style={[
            styles.orbLabelDock,
            voiceOverlayLabelTone === 'active' && styles.orbLabelDockActive,
            voiceOverlayLabelTone === 'processing' && styles.orbLabelDockProcessing,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.orbLabelText,
              voiceOverlayLabelTone === 'active' && styles.orbLabelTextActive,
              voiceOverlayLabelTone === 'processing' && styles.orbLabelTextProcessing,
            ]}
          >
            {voiceActionLabel}
          </Text>
        </View>

        {voiceRecorder.isRecording && !isExtracting ? (
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.78}
            style={styles.cancelDock}
            accessibilityRole="button"
            accessibilityLabel="Kaydı iptal et"
          >
            <Text style={styles.cancelLink}>İptal</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {voiceRecorder.permissionHint ? (
        <Text style={styles.permissionHint} numberOfLines={2} pointerEvents="none">
          {voiceRecorder.permissionHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  orbCluster: {
    width: ORB_ACTIVE_SIZE,
    height: ORB_ACTIVE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  orbLabelDock: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.9)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.48)',
  },
  orbLabelDockActive: {
    backgroundColor: 'rgba(8, 47, 73, 0.92)',
    borderColor: 'rgba(34, 211, 238, 0.5)',
  },
  orbLabelDockProcessing: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(96, 165, 250, 0.42)',
  },
  orbLabelText: {
    color: 'rgba(186, 230, 253, 0.96)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 12,
  },
  orbLabelTextActive: {
    color: 'rgba(34, 211, 238, 0.98)',
  },
  orbLabelTextProcessing: {
    color: 'rgba(147, 197, 253, 0.96)',
  },
  orbTap: {
    width: ORB_ACTIVE_SIZE,
    height: ORB_ACTIVE_SIZE,
    borderRadius: ORB_ACTIVE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbVisual: {
    width: ORB_ACTIVE_SIZE,
    height: ORB_ACTIVE_SIZE,
    borderRadius: ORB_ACTIVE_SIZE / 2,
    overflow: 'hidden',
  },
  permissionHint: {
    color: '#fbbf24',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 8,
    maxWidth: ORB_ACTIVE_SIZE + 48,
  },
  cancelDock: {
    position: 'absolute',
    bottom: -26,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    zIndex: 6,
    elevation: 6,
  },
  cancelLink: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
