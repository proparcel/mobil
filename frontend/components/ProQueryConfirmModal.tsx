import React, { useMemo } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import type { TkgmViewResponse } from '../src/types/parcelResponse';
import { sheetModalBottomInset, sheetScrollBottomPadding } from '../src/utils/sheetSafeArea';
import { formatParcelAreaDisplay, pickParcelAreaRaw } from '../src/utils/dfaRows';

type Props = {
  visible: boolean;
  tkgmData: TkgmViewResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const SHEET_EXPANDED_HEIGHT = 280;
const SHEET_LOWER_OFFSET = 40;

function pickValue(source: Record<string, any> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = source?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export const ProQueryConfirmModal: React.FC<Props> = ({ visible, tkgmData, onConfirm, onCancel }) => {
  const insets = useSafeAreaInsets();

  const bottomInset = useMemo(
    () => Math.max(0, sheetModalBottomInset(insets?.bottom || 0) - SHEET_LOWER_OFFSET),
    [insets?.bottom],
  );

  const snapPoints = useMemo(
    () => [SHEET_EXPANDED_HEIGHT + sheetScrollBottomPadding(insets?.bottom || 0, 20)],
    [insets?.bottom],
  );

  const modalProps = useMemo(
    () => ({
      bottomInset,
      ...(Platform.OS === 'ios'
        ? { containerStyle: { marginBottom: -SHEET_LOWER_OFFSET } }
        : null),
    }),
    [bottomInset],
  );

  if (__DEV__ && visible) {
    console.log('[ProQueryConfirmModal] Render, visible:', visible, 'tkgmData var mı:', !!tkgmData);
  }

  const content = useMemo(() => {
    const props = (tkgmData as any)?.properties || {};

    const il = pickValue(props, ['ilAd', 'il', 'cityName', 'CityName']);
    const ilce = pickValue(props, ['ilceAd', 'ilce', 'townName', 'TownName']);
    const mahalle = pickValue(props, ['mahalleAd', 'mahalle', 'quarterName', 'QuarterName']);

    const ada = pickValue(props, ['adaNo', 'ada', 'Ada']);
    const parsel = pickValue(props, ['parselNo', 'parsel', 'Parsel']);

    const alanRaw = pickParcelAreaRaw(props) ?? pickParcelAreaRaw(tkgmData as Record<string, unknown>);
    const alan = formatParcelAreaDisplay(alanRaw);

    const row1 = [il, ilce, mahalle].filter(Boolean).join(' / ');
    const row2Left = ada && parsel ? `${ada}/${parsel}` : (ada || parsel || '');
    const row2 = [row2Left, alan].filter(Boolean).join(' • ');

    return { row1, row2 };
  }, [tkgmData]);

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={() => {}}
      snapPoints={snapPoints}
      initialIndex={0}
      enablePanDownToClose={false}
      backdropOpacity={0}
      enableBackdropTouchThrough
      backdropPressBehavior="none"
      modalProps={modalProps}
    >
      <View
        style={[
          styles.content,
          { paddingBottom: sheetScrollBottomPadding(insets?.bottom || 0, 20) },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Parsel Bilgisi</Text>
          <Text style={styles.subTitle}>{content.row1 || '-'}</Text>
          <Text style={styles.subTitle}>{content.row2 || '-'}</Text>
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

        <Text style={styles.hint}>Not: Onayladıktan sonra arazi türü seçimi isteyeceğiz.</Text>
      </View>
    </AppBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  header: {
    marginBottom: 16,
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
