import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { TkgmViewResponse } from '../src/types/parcelResponse';

type Props = {
  visible: boolean;
  tkgmData: TkgmViewResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function pickValue(source: Record<string, any> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = source?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function formatArea(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  let n: number;
  if (typeof value === 'string') {
    const cleaned = String(value)
      .trim()
      .replace(/\s/g, '')
      .replace(/m²|m2/gi, '')
      .replace(/\./g, '')
      .replace(',', '.');
    n = parseFloat(cleaned);
  } else {
    n = Number(value);
  }
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.round(n).toLocaleString('tr-TR')} m²`;
}

export const ProQueryConfirmModal: React.FC<Props> = ({ visible, tkgmData, onConfirm, onCancel }) => {
  const insets = useSafeAreaInsets();
  
  console.log('[ProQueryConfirmModal] Render, visible:', visible, 'tkgmData var mı:', !!tkgmData);

  const content = useMemo(() => {
    const props = (tkgmData as any)?.properties || {};

    const il = pickValue(props, ['ilAd', 'il', 'cityName', 'CityName']);
    const ilce = pickValue(props, ['ilceAd', 'ilce', 'townName', 'TownName']);
    const mahalle = pickValue(props, ['mahalleAd', 'mahalle', 'quarterName', 'QuarterName']);

    const ada = pickValue(props, ['adaNo', 'ada', 'Ada']);
    const parsel = pickValue(props, ['parselNo', 'parsel', 'Parsel']);

    const alanRaw =
      props?.alan ??
      props?.yuzolcum ??
      props?.Yuzolcum ??
      props?.ALAN ??
      props?.area ??
      props?.Area ??
      props?.area_m2 ??
      (tkgmData as any)?.alan ??
      (tkgmData as any)?.yuzolcum ??
      (tkgmData as any)?.Area;

    const alan = formatArea(alanRaw);

    const row1 = [il, ilce, mahalle].filter(Boolean).join(' / ');
    const row2Left = ada && parsel ? `${ada}/${parsel}` : (ada || parsel || '');
    const row2 = [row2Left, alan].filter(Boolean).join(' • ');

    return { row1, row2 };
  }, [tkgmData]);

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      // IMPORTANT: This modal must not close by swipe/backdrop.
      // Only the explicit "İptal" button should close it.
      onClose={() => {}}
      snapPoints={['70%', '90%']}
      initialIndex={0}
      enablePanDownToClose={false}
      backdropPressBehavior="none"
      modalProps={{ android_keyboardInputMode: 'adjustResize', keyboardBehavior: 'interactive' as any }}
    >
      <BottomSheetScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 28 + (insets?.bottom || 0) * 2, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Parsel Bilgisi</Text>
          <Text style={styles.subTitle}>
            {content.row1 || '-'}
          </Text>
          <Text style={styles.subTitle}>
            {content.row2 || '-'}
          </Text>
        </View>

        <View style={styles.questionBox}>
          <Text style={styles.questionText}>Fiyat tahmini öğrenmek istediğiniz yer burası mı?</Text>
          <Text style={styles.questionText}>Pro Sorguyu onaylıyor musunuz?</Text>
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]} 
            onPress={() => {
              console.log('[ProQueryConfirmModal] İptal butonu tıklandı');
              onCancel();
            }} 
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.cancelText]}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.confirmButton]} 
            onPress={() => {
              console.log('[ProQueryConfirmModal] Onayla butonu tıklandı');
              onConfirm();
            }} 
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.confirmText]}>Onayla</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Not: Onayladıktan sonra arazi türü seçimi isteyeceğiz.
        </Text>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 18,
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 20,
  },
  questionBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cancelText: {
    color: '#334155',
  },
  confirmText: {
    color: '#ffffff',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
});

