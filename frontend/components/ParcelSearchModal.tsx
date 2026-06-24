import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import * as ExpoImagePicker from 'expo-image-picker';
import AdaParselForm from './AdaParselForm';
import { sheetContentSafeBottom } from '../src/utils/sheetSafeArea';
import SidebarSavedQueriesTab from './SidebarSavedQueriesTab';
import type { SidebarSavedQuery } from '../src/utils/sidebarSavedQueries';
import {
  extractSmartQueryFromImage,
  extractSmartQueryFromSpeech,
  type SmartQueryExtractResponse,
} from '../services/smartQueryService';
import {
  resolveSmartQueryForForm,
  type SmartQueryParcelPayload,
} from '../src/utils/smartQueryResolve';
import type { LocationHierarchySelection } from '../src/utils/locationHierarchyMap';
import { useSmartQueryAudioRecorder } from '../src/hooks/useSmartQueryAudioRecorder';
import VoiceSearchListeningAnimation from './app/VoiceSearchListeningAnimation';
import {
  appendSmartQueryDebugLog,
  logSmartQuerySessionStart,
} from '../src/utils/smartQueryDebugLog';
import { showSmartQueryErrorAlert } from '../src/utils/smartQueryErrorAlert';
import {
  ensureCameraPermission,
  permissionBlockedHint,
  permissionDeniedHint,
} from '../src/utils/devicePermissions';
import { useAuth } from '../screens/contexts/AuthContext';
import { useRouter } from '../src/hooks/useNavigation';
import {
  canUseSmartQuery,
  promptSmartQueryUpgrade,
  promptSmartQueryLogin,
  SMART_QUERY_UPGRADE_MESSAGE,
} from '../src/utils/customerFeatureGates';

type TabKey = 'parcel' | 'myqueries' | 'smart';

export type ParcelSearchTabKey = TabKey;

type ParcelSubmitPayload = SmartQueryParcelPayload;

type ParcelQuerySubmitOptions = { zoomToParcel?: boolean };

interface ParcelSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (payload: ParcelSubmitPayload, options?: ParcelQuerySubmitOptions) => void | Promise<void>;
  /** Parsel sekmesinde Sorgula altında — doğrudan pro sorgu */
  onProSubmit?: (payload: ParcelSubmitPayload, options?: ParcelQuerySubmitOptions) => void | Promise<void>;
  onHierarchySelect?: (selection: LocationHierarchySelection) => void;
  /** Kayıtlı sorgu tıklanınca basit moda geç (harita ekranı) */
  onBeforeSavedQueryRun?: () => void;
  /** Modal açıldığında seçili sekme (varsayılan: parsel) */
  initialTab?: ParcelSearchTabKey;
  /** Ana ekran ses orb vb. — parsel sekmesine forma aktarılacak seed */
  incomingFormSeed?: SidebarSavedQuery | null;
  onIncomingFormSeedConsumed?: () => void;
}

export default function ParcelSearchModal({
  visible,
  onClose,
  onSubmit,
  onProSubmit,
  onHierarchySelect,
  onBeforeSavedQueryRun,
  initialTab = 'parcel',
  incomingFormSeed = null,
  onIncomingFormSeedConsumed,
}: ParcelSearchModalProps) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const smartQueryEnabled = canUseSmartQuery(user);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [formSeed, setFormSeed] = useState<SidebarSavedQuery | null>(null);
  const [shouldAutoSubmitSeed, setShouldAutoSubmitSeed] = useState(false);
  const [isSmartExtracting, setIsSmartExtracting] = useState(false);
  const voiceRecorder = useSmartQueryAudioRecorder();
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    fileName: string;
    mimeType: string;
  } | null>(null);

  const containerStyle = useMemo(
    () => [styles.sheet, { paddingBottom: sheetContentSafeBottom(insets?.bottom || 0) }],
    [insets?.bottom]
  );

  useEffect(() => {
    if (!visible) return;
    const nextTab = initialTab === 'smart' && !smartQueryEnabled ? 'parcel' : initialTab;
    setTab(nextTab);
    if (initialTab === 'smart' && smartQueryEnabled) {
      setSelectedImage(null);
      setCameraPermissionHint(null);
      setIsSmartExtracting(false);
      void voiceRecorder.clearRecording();
    }
  }, [visible, initialTab, smartQueryEnabled, voiceRecorder.clearRecording]);

  const goToPricing = useCallback(() => {
    onClose();
    router.push('pricing');
  }, [onClose, router]);

  const handleSmartTabPress = useCallback(() => {
    if (!smartQueryEnabled) {
      promptSmartQueryUpgrade(goToPricing);
      return;
    }
    setTab('smart');
  }, [smartQueryEnabled, goToPricing]);

  const ensureSmartQueryAccess = useCallback((): boolean => {
    if (isAuthLoading) return false;
    if (!isAuthenticated) {
      promptSmartQueryLogin(() => router.push('login'));
      return false;
    }
    if (smartQueryEnabled) return true;
    promptSmartQueryUpgrade(goToPricing);
    return false;
  }, [isAuthLoading, isAuthenticated, smartQueryEnabled, goToPricing, router]);

  useEffect(() => {
    if (!incomingFormSeed) return;
    setTab('parcel');
    setShouldAutoSubmitSeed(false);
    setFormSeed(incomingFormSeed);
    onIncomingFormSeedConsumed?.();
  }, [incomingFormSeed, onIncomingFormSeedConsumed]);

  const handleSavedQuerySelect = useCallback(
    (item: SidebarSavedQuery) => {
      onBeforeSavedQueryRun?.();
      setTab('parcel');
      setShouldAutoSubmitSeed(true);
      setFormSeed(item);
    },
    [onBeforeSavedQueryRun]
  );

  const applySmartQueryResult = useCallback(
    async (
      result: SmartQueryExtractResponse,
      channel: 'speech' | 'text' | 'image' = 'speech',
    ) => {
      const outcome = await resolveSmartQueryForForm(result, {
        channel,
        source: 'modal',
      });

      if (outcome.status === 'complete') {
        await appendSmartQueryDebugLog('flow_success', 'modal', {
          channel,
          summary: outcome.summary,
          mahalleTkgmValue: outcome.payload.mahalleTkgmValue,
        });
        setTab('parcel');
        setShouldAutoSubmitSeed(false);
        setFormSeed(outcome.seed);
        return true;
      }

      if (outcome.status === 'partial') {
        await appendSmartQueryDebugLog('flow_partial_success', 'modal', {
          channel,
          il: outcome.seed.il,
          ilce: outcome.seed.ilce,
          ada: outcome.seed.ada,
          parsel: outcome.seed.parsel,
        });
        Alert.alert('Akıllı Sorgu', outcome.message);
        setTab('parcel');
        setShouldAutoSubmitSeed(false);
        setFormSeed(outcome.seed);
        return true;
      }

      showSmartQueryErrorAlert(outcome.error);
      return false;
    },
    [],
  );

  const runImageSmartQuery = useCallback(
    async (base64: string, mimeType: string) => {
      if (!ensureSmartQueryAccess()) return;
      setIsSmartExtracting(true);

      try {
        const response = await extractSmartQueryFromImage(base64, mimeType);
        if (!response.ok) {
          Alert.alert('Akıllı Sorgu', response.error || 'Görsel işlenirken bir hata oluştu.');
          return;
        }

        await applySmartQueryResult(response.data, 'image');
      } catch (error: any) {
        Alert.alert('Akıllı Sorgu', error?.message || 'Görsel sorgusu başlatılamadı.');
      } finally {
        setIsSmartExtracting(false);
      }
    },
    [applySmartQueryResult, ensureSmartQueryAccess]
  );

  const applySmartImageAsset = useCallback(
    (asset: { base64: string; fileName: string; mimeType: string }) => {
      setSelectedImage(asset);
      void voiceRecorder.clearRecording();
    },
    [voiceRecorder]
  );

  const processImagePickerResult = useCallback(
    (result: ImagePickerResponse, options?: { autoQuery?: boolean }) => {
      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('Akıllı Sorgu', result.errorMessage || 'Görsel seçilemedi.');
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Akıllı Sorgu', 'Seçilen görselden veri okunamadı.');
        return;
      }

      const imageAsset = {
        base64: asset.base64,
        fileName: asset.fileName || 'secilen-gorsel',
        mimeType: asset.type || 'image/jpeg',
      };
      applySmartImageAsset(imageAsset);

      if (options?.autoQuery) {
        void runImageSmartQuery(imageAsset.base64, imageAsset.mimeType);
      }
    },
    [applySmartImageAsset, runImageSmartQuery]
  );

  const handlePickImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.8,
        includeBase64: true,
      });
      processImagePickerResult(result);
    } catch (error: any) {
      Alert.alert('Akıllı Sorgu', error?.message || 'Görsel seçilemedi.');
    }
  }, [processImagePickerResult]);

  const handleTakePhoto = useCallback(async () => {
    try {
      setCameraPermissionHint(null);

      const permission = await ensureCameraPermission();
      if (!permission.granted) {
        setCameraPermissionHint(
          permission.blocked
            ? permissionBlockedHint('camera')
            : permissionDeniedHint('camera')
        );
        return;
      }

      const result = await ExpoImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Akıllı Sorgu', 'Çekilen fotoğraftan veri okunamadı.');
        return;
      }

      const imageAsset = {
        base64: asset.base64,
        fileName: asset.fileName || 'kamera-fotografi',
        mimeType: asset.mimeType || 'image/jpeg',
      };

      applySmartImageAsset(imageAsset);
      await runImageSmartQuery(imageAsset.base64, imageAsset.mimeType);
    } catch (error: any) {
      Alert.alert('Akıllı Sorgu', error?.message || 'Fotoğraf çekilemedi.');
    }
  }, [applySmartImageAsset, runImageSmartQuery]);

  const handleImageSmartQuery = useCallback(async () => {
    if (!selectedImage?.base64) {
      Alert.alert('Akıllı Sorgu', 'Lütfen önce bir görsel seçin.');
      return;
    }

    await runImageSmartQuery(selectedImage.base64, selectedImage.mimeType);
  }, [selectedImage, runImageSmartQuery]);

  const handleSpeechSmartQuery = useCallback(async () => {
    if (isSmartExtracting) return;
    if (!ensureSmartQueryAccess()) return;

    await appendSmartQueryDebugLog('flow_send_start', 'modal', {
      channel: 'speech',
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
      await appendSmartQueryDebugLog('flow_send_skip', 'modal', {
        reason: 'empty_payload',
        channel: 'speech',
      });
      showSmartQueryErrorAlert('Lütfen önce konuşarak bir sorgu yapın.');
      return;
    }

    setIsSmartExtracting(true);

    try {
      const response = await extractSmartQueryFromSpeech(recording.base64, recording.mimeType);
      if (!response.ok) {
        await appendSmartQueryDebugLog('flow_error', 'modal', {
          channel: 'speech',
          phase: 'http_error',
          status: response.status,
          error: response.error,
        });
        showSmartQueryErrorAlert(response.error || 'Ses kaydı işlenirken bir hata oluştu.');
        return;
      }

      await applySmartQueryResult(response.data, 'speech');
    } catch (error: any) {
      await appendSmartQueryDebugLog('flow_error', 'modal', {
        channel: 'speech',
        phase: 'exception',
        message: error?.message || 'Ses sorgusu başlatılamadı.',
      });
      showSmartQueryErrorAlert(error?.message || 'Ses sorgusu başlatılamadı.');
    } finally {
      setIsSmartExtracting(false);
    }
  }, [voiceRecorder, applySmartQueryResult, isSmartExtracting, ensureSmartQueryAccess]);

  const handleVoiceCancel = useCallback(async () => {
    if (isSmartExtracting) return;
    await voiceRecorder.clearRecording();
  }, [voiceRecorder, isSmartExtracting]);

  const handleVoiceAnimationPress = useCallback(async () => {
    if (isSmartExtracting) return;
    if (!ensureSmartQueryAccess()) return;

    if (voiceRecorder.isRecording) {
      await handleSpeechSmartQuery();
      return;
    }

    setSelectedImage(null);
    await logSmartQuerySessionStart('modal', 'speech');
    await voiceRecorder.startRecording();
  }, [isSmartExtracting, voiceRecorder, handleSpeechSmartQuery, ensureSmartQueryAccess]);

  const voiceAnimMode = isSmartExtracting
    ? 'processing'
    : voiceRecorder.isRecording
      ? 'listening'
      : 'idle';

  const voiceActionLabel = isSmartExtracting
    ? 'Analiz ediliyor…'
    : voiceRecorder.isRecording
      ? 'Gönder'
      : 'Konuşmak için dokun';

  const voiceOverlayLabelTone = isSmartExtracting
    ? 'processing'
    : voiceRecorder.isRecording
      ? 'active'
      : 'idle';

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={['86%']}
      initialIndex={0}
      variant="dark"
      keyboardForm
    >
      <View style={containerStyle as any}>
        <View style={styles.headerRow}>
          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setTab('parcel')}
              style={[styles.tabBtn, tab === 'parcel' && styles.tabBtnActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === 'parcel' && styles.tabTextActive]}>Parsel Sorgu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab('myqueries')}
              style={[styles.tabBtn, tab === 'myqueries' && styles.tabBtnActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === 'myqueries' && styles.tabTextActive]}>Sorgularım</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSmartTabPress}
              style={[
                styles.tabBtn,
                tab === 'smart' && smartQueryEnabled && styles.tabBtnActive,
                !smartQueryEnabled && styles.tabBtnLocked,
              ]}
              activeOpacity={smartQueryEnabled ? 0.85 : 1}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === 'smart' && smartQueryEnabled && styles.tabTextActive,
                  !smartQueryEnabled && styles.tabTextLocked,
                ]}
              >
                Akıllı Sorgu
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <BottomSheetScrollView style={styles.body} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
          {tab === 'parcel' ? (
            <AdaParselForm
              onClose={onClose}
              onSubmit={onSubmit}
              onProSubmit={onProSubmit}
              variant="dark"
              inBottomSheet
              onHierarchySelect={onHierarchySelect}
              formSeed={formSeed}
              autoSubmitAfterSeed={shouldAutoSubmitSeed}
              onFormSeedConsumed={() => {
                setFormSeed(null);
                setShouldAutoSubmitSeed(false);
              }}
            />
          ) : tab === 'myqueries' ? (
            <SidebarSavedQueriesTab visible={tab === 'myqueries'} onSelect={handleSavedQuerySelect} />
          ) : smartQueryEnabled ? (
            <View style={styles.smartContainer}>
              <View style={styles.smartCard}>
                <View style={styles.smartHeader}>
                  <Ionicons name="mic-outline" size={18} color="#60a5fa" />
                  <Text style={styles.smartTitle}>Konuşarak Sorgula</Text>
                </View>

                <TouchableOpacity
                  onPress={handleVoiceAnimationPress}
                  disabled={isSmartExtracting}
                  activeOpacity={0.92}
                  style={styles.voiceAnimTap}
                  accessibilityRole="button"
                  accessibilityLabel={voiceActionLabel}
                >
                  <VoiceSearchListeningAnimation
                    mode={voiceAnimMode}
                    audioLevel={voiceRecorder.isRecording ? voiceRecorder.audioLevel : 0}
                    overlayLabel={voiceActionLabel}
                    overlayLabelTone={voiceOverlayLabelTone}
                  />
                </TouchableOpacity>

                {voiceRecorder.permissionHint ? (
                  <Text style={styles.permissionHint}>{voiceRecorder.permissionHint}</Text>
                ) : null}

                {voiceRecorder.isRecording && !isSmartExtracting ? (
                  <TouchableOpacity
                    onPress={handleVoiceCancel}
                    activeOpacity={0.7}
                    style={styles.voiceCancelLinkWrap}
                  >
                    <Text style={styles.voiceCancelLink}>İptal</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.smartDivider} />

              <View style={styles.smartCard}>
                <View style={styles.smartHeader}>
                  <Ionicons name="image-outline" size={18} color="#60a5fa" />
                  <Text style={styles.smartTitle}>Resimden Akıllı Sorgu</Text>
                </View>
                <View style={styles.imagePickerRow}>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    disabled={isSmartExtracting}
                    style={styles.imagePickerButton}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="images-outline" size={18} color="#cbd5e1" />
                    <Text
                      style={[
                        styles.imagePickerButtonText,
                        !selectedImage && styles.imagePickerPlaceholder,
                      ]}
                    >
                      {selectedImage?.fileName || 'Tapu veya ekran görüntüsü seçin'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleTakePhoto}
                    disabled={isSmartExtracting}
                    style={styles.imageCameraButton}
                    activeOpacity={0.85}
                    accessibilityLabel="Kamera ile fotoğraf çek"
                  >
                    <Ionicons name="camera-outline" size={20} color="#e2e8f0" />
                  </TouchableOpacity>
                </View>

                {cameraPermissionHint ? (
                  <Text style={styles.permissionHint}>{cameraPermissionHint}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleImageSmartQuery}
                  disabled={isSmartExtracting}
                  style={[styles.smartActionButton, isSmartExtracting && styles.smartActionButtonDisabled]}
                  activeOpacity={0.9}
                >
                  {isSmartExtracting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="scan-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.smartActionButtonText}>Resimden Sorgula</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.smartLockedContainer}>
              <Ionicons name="lock-closed-outline" size={28} color="#64748b" />
              <Text style={styles.smartLockedTitle}>Akıllı Sorgu</Text>
              <Text style={styles.smartLockedMessage}>{SMART_QUERY_UPGRADE_MESSAGE}</Text>
              <TouchableOpacity
                onPress={goToPricing}
                style={styles.smartLockedButton}
                activeOpacity={0.9}
              >
                <Text style={styles.smartLockedButtonText}>Paketleri İncele</Text>
              </TouchableOpacity>
            </View>
          )}
        </BottomSheetScrollView>
      </View>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tabs: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#334155',
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.55)',
  },
  tabBtnLocked: {
    opacity: 0.55,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabTextLocked: {
    color: '#64748b',
  },
  body: {
    flex: 1,
  },
  smartContainer: {
    padding: 16,
    gap: 16,
  },
  smartLockedContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 220,
  },
  smartLockedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  smartLockedMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94a3b8',
    textAlign: 'center',
  },
  smartLockedButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartLockedButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  smartCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  smartActionButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  smartActionButtonDisabled: {
    opacity: 0.7,
  },
  smartActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  imagePickerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  imageCameraButton: {
    width: 46,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerButtonText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePickerPlaceholder: {
    color: '#64748b',
    fontWeight: '500',
  },
  smartDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 4,
  },
  voiceAnimTap: {
    alignSelf: 'center',
  },
  voiceCancelLinkWrap: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  voiceCancelLink: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  permissionHint: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
});

