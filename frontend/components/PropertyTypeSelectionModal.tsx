import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

interface PropertyTypeSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (propertyType: string, shareData?: ShareParcelSelection | null) => void;
  title?: string;
  suggestedType?: string | null;
}

export interface ShareParcelSelection {
  hisseli: boolean;
  hisseM2?: string | null;
  parcelLocationStatus?: 'parselbelirli' | 'parselbelirlidegil' | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.90;

// Buton grupları — ayraç çizgileriyle ayrılır
const BUTTON_GROUPS = [
  [
    { value: 'Arsa', label: 'Arsa', color: '#3b82f6', icon: 'home' },
    { value: 'Tarla', label: 'Tarla', color: '#10b981', icon: 'leaf' },
  ],
  'separator',
  [
    { value: 'Köy içi', label: 'Köy içi', color: '#06b6d4', icon: 'business' },
    { value: 'Ticari', label: 'Ticari Arsa', color: '#f59e0b', icon: 'storefront' },
  ],
  [
    { value: 'Konut Arsası', label: 'Konut Arsası', color: '#8b5cf6', icon: 'home-outline' },
    { value: 'Fabrika Arsası', label: 'OSB Fbk. Arsası', color: '#ec4899', icon: 'construct' },
  ],
  'separator',
  [
    { value: 'Fabrika', label: 'Fabrika', color: '#ef4444', icon: 'build' },
    { value: 'Villa', label: 'Villa', color: '#0ea5e9', icon: 'home' },
  ],
  'separator',
  [
    { value: 'Bina', label: 'Bina', color: '#6366f1', icon: 'business' },
    { value: 'Müstakil Ev', label: 'Müstakil Ev', color: '#14b8a6', icon: 'home' },
  ],
  'separator',
  [
    { value: 'Konut Maliyeti + Daire Satış Fiyatı Hesaplama', label: 'Konut + Daire', color: '#a855f7', icon: 'home-outline' },
    { value: 'Daire', label: 'Daire', color: '#9ca3af', icon: 'square-outline', disabled: true },
  ],
] as const;

const PropertyTypeSelectionModal: React.FC<PropertyTypeSelectionModalProps> = ({
  visible,
  onClose,
  onSelect,
  title = 'Taşınmaz Türü Seçin',
  suggestedType,
}) => {
  const insets = useSafeAreaInsets();
  const [shareDetailsVisible, setShareDetailsVisible] = useState(false);
  const [hisseM2, setHisseM2] = useState('');
  const [parcelLocationStatus, setParcelLocationStatus] = useState<ShareParcelSelection['parcelLocationStatus']>(null);
  const [draftHisseM2, setDraftHisseM2] = useState('');
  const [draftParcelLocationStatus, setDraftParcelLocationStatus] = useState<ShareParcelSelection['parcelLocationStatus']>(null);
  const [shareValidationError, setShareValidationError] = useState('');

  useEffect(() => {
    if (visible) {
      setHisseM2('');
      setParcelLocationStatus(null);
      setDraftHisseM2('');
      setDraftParcelLocationStatus(null);
      setShareDetailsVisible(false);
      setShareValidationError('');
    }
  }, [visible]);

  const handleSelect = (propertyType: string) => {
    const normalizedM2 = hisseM2.trim();
    const hasShareData = Boolean(parcelLocationStatus || normalizedM2);
    const shareData = hasShareData
      ? {
          hisseli: true,
          hisseM2: normalizedM2 !== '' ? normalizedM2 : null,
          parcelLocationStatus,
        }
      : null;
    onSelect(propertyType, shareData);
  };

  const handleClose = () => {
    setHisseM2('');
    setParcelLocationStatus(null);
    setDraftHisseM2('');
    setDraftParcelLocationStatus(null);
    setShareDetailsVisible(false);
    setShareValidationError('');
    onClose();
  };

  // Sadece rakam girişine izin ver
  const handleHisseM2Change = (text: string) => {
    const digits = text.replace(/[^\d]/g, '');
    setDraftHisseM2(digits);
  };

  const shareSummaryText = parcelLocationStatus
    ? [
        hisseM2.trim() ? `Hisse alanı: ${hisseM2.trim()} m²` : null,
        parcelLocationStatus === 'parselbelirli'
          ? 'Durum: Muvafakkatname var, parselin yeri belli'
          : 'Durum: Parsel yeri belli değil',
      ]
        .filter(Boolean)
        .join('\n')
    : 'İsterseniz hisseli parsel alanı ve parsel yeri bilgisini alt modaldan girebilirsiniz.';

  const openShareDetailsModal = () => {
    setDraftHisseM2(hisseM2);
    setDraftParcelLocationStatus(parcelLocationStatus);
    setShareValidationError('');
    setShareDetailsVisible(true);
  };

  const closeShareDetailsModal = () => {
    setDraftHisseM2(hisseM2);
    setDraftParcelLocationStatus(parcelLocationStatus);
    setShareValidationError('');
    setShareDetailsVisible(false);
  };

  const saveShareDetails = () => {
    if (!draftParcelLocationStatus) {
      setShareValidationError('Devam etmek için parsel yeri durumunu seçin.');
      return;
    }
    setHisseM2(draftHisseM2.trim());
    setParcelLocationStatus(draftParcelLocationStatus);
    setShareValidationError('');
    setShareDetailsVisible(false);
  };

  const clearShareDetails = () => {
    setHisseM2('');
    setParcelLocationStatus(null);
    setDraftHisseM2('');
    setDraftParcelLocationStatus(null);
    setShareValidationError('');
    setShareDetailsVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <AppBottomSheetModal
        visible={visible}
        onClose={handleClose}
        snapPoints={[MODAL_HEIGHT]}
        initialIndex={0}
        modalProps={{ android_keyboardInputMode: 'adjustResize', keyboardBehavior: 'interactive' as any }}
      >
        <BottomSheetScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 80 + (insets?.bottom || 0) * 2, flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
        >
          {/* Başlık */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {title.split(/(".*?")/).map((part, i) =>
                part.startsWith('"') && part.endsWith('"')
                  ? <Text key={i} style={styles.titleBold}>{part}</Text>
                  : part
              )}
            </Text>
            {suggestedType && (
              <Text style={styles.suggestedText}>
                Önerilen: <Text style={styles.suggestedType}>{suggestedType}</Text>
              </Text>
            )}
          </View>

          <View style={styles.hisseContainer}>
            <Text style={styles.hisseLabel}>Bu Arazi Hisseli İse Detay Bilgilerini Girin</Text>
            <TouchableOpacity
              style={styles.shareActionButton}
              onPress={openShareDetailsModal}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={18} color="#1d4ed8" />
              <Text style={styles.shareActionButtonText}>Hisseli Parsel Bilgilerini Aç</Text>
            </TouchableOpacity>
            <Text style={styles.shareSummary}>{shareSummaryText}</Text>
          </View>

          {/* Seçenekler — gruplu düzen */}
          <View style={styles.optionsContainer}>
            {BUTTON_GROUPS.map((group, gi) => {
              if (group === 'separator') {
                return <View key={`sep-${gi}`} style={styles.separator} />;
              }
              return (
                <View key={`grp-${gi}`} style={styles.buttonRow}>
                  {(group as unknown as any[]).map((type: any) =>
                    type.disabled ? (
                      <View
                        key={type.value}
                        style={[styles.optionButton, styles.optionButtonDisabled]}
                      >
                        <Ionicons name={type.icon as any} size={22} color="#9ca3af" />
                        <Text style={[styles.optionText, styles.optionTextDisabled]}>{type.label}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        key={type.value}
                        style={[styles.optionButton, { borderColor: type.color }]}
                        onPress={() => handleSelect(type.value)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={type.icon as any} size={22} color={type.color} />
                        <Text style={[styles.optionText, { color: type.color }]}>{type.label}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              );
            })}
          </View>

          {/* Kapat Butonu */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>Kapat</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        visible={shareDetailsVisible}
        onClose={closeShareDetailsModal}
        snapPoints={['70%']}
        initialIndex={0}
        modalProps={{ android_keyboardInputMode: 'adjustResize', keyboardBehavior: 'interactive' as any }}
      >
        <BottomSheetScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 + (insets?.bottom || 0), flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.detailTitle}>Hisseli Parsel Bilgileri</Text>
            <Text style={styles.detailSubtitle}>M² bilgisini ve parsel yeri durumunu buradan girin.</Text>
          </View>

          <View style={styles.hisseContainer}>
            <Text style={styles.hisseLabel}>Hisse M² Bilgisi</Text>
            <TextInput
              style={styles.hisseInput}
              value={draftHisseM2}
              onChangeText={handleHisseM2Change}
              placeholder="Örn: 250"
              keyboardType="numeric"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
            />
            <Text style={styles.hisseHint}>Sadece rakam girilebilir. Boş bırakılırsa TKGM alanı kullanılacaktır.</Text>
          </View>

          <View style={styles.hisseContainer}>
            <Text style={styles.hisseLabel}>Parsel Yeri Durumu</Text>
            <TouchableOpacity
              style={[styles.detailOptionCard, draftParcelLocationStatus === 'parselbelirli' && styles.detailOptionCardActive]}
              onPress={() => {
                setDraftParcelLocationStatus('parselbelirli');
                setShareValidationError('');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.radioCircle, draftParcelLocationStatus === 'parselbelirli' && styles.radioCircleActive]}>
                {draftParcelLocationStatus === 'parselbelirli' && <View style={styles.radioCircleInner} />}
              </View>
              <Text style={styles.detailOptionText}>Muvafakkatname var, parselin yeri belli</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detailOptionCard, draftParcelLocationStatus === 'parselbelirlidegil' && styles.detailOptionCardActive]}
              onPress={() => {
                setDraftParcelLocationStatus('parselbelirlidegil');
                setShareValidationError('');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.radioCircle, draftParcelLocationStatus === 'parselbelirlidegil' && styles.radioCircleActive]}>
                {draftParcelLocationStatus === 'parselbelirlidegil' && <View style={styles.radioCircleInner} />}
              </View>
              <Text style={styles.detailOptionText}>Parsel yeri belli değil</Text>
            </TouchableOpacity>
            {shareValidationError ? <Text style={styles.shareErrorText}>{shareValidationError}</Text> : null}
          </View>

          <View style={styles.detailActionRow}>
            <TouchableOpacity style={styles.detailSecondaryButton} onPress={clearShareDetails} activeOpacity={0.8}>
              <Text style={styles.detailSecondaryButtonText}>Temizle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailSecondaryButton} onPress={closeShareDetailsModal} activeOpacity={0.8}>
              <Text style={styles.detailSecondaryButtonText}>Kapat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailPrimaryButton} onPress={saveShareDetails} activeOpacity={0.8}>
              <Text style={styles.detailPrimaryButtonText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '400',
    color: '#0f172a',
    marginBottom: 2,
    lineHeight: 20,
  },
  titleBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  suggestedText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  suggestedType: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  hisseContainer: {
    marginBottom: 10,
  },
  hisseLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  hisseInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  shareActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  shareActionButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  shareSummary: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    lineHeight: 18,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#3b82f6',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  hisseHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 3,
    lineHeight: 15,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginTop: 2,
    marginBottom: 12,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
    gap: 6,
  },
  optionButtonDisabled: {
    borderColor: '#d1d5db',
    opacity: 0.7,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextDisabled: {
    color: '#9ca3af',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  detailSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  detailOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  detailOptionCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  detailOptionText: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  shareErrorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  detailSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  detailSecondaryButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  detailPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  detailPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default PropertyTypeSelectionModal;
