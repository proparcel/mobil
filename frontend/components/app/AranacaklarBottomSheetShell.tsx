/**
 * Aranacaklar detay — ortak bottom sheet: %70 yükseklik, aşağı sürükleyerek kapatma, dışarı tıklayınca kapanır.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheetModal from './AppBottomSheetModal';

const SNAP_POINTS = ['70%'] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Alt kategori arama gibi ek üst içerik */
  headerExtra?: React.ReactNode;
};

export function AranacaklarBottomSheetShell({ visible, onClose, title, children, headerExtra }: Props) {
  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={[...SNAP_POINTS]}
      enablePanDownToClose
      backdropPressBehavior="close"
      backdropOpacity={0.45}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.sheetTitle}>{title}</Text>
        {headerExtra ? <View style={styles.headerExtra}>{headerExtra}</View> : null}
        {children}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 28, paddingHorizontal: 8 },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerExtra: { paddingHorizontal: 8, paddingTop: 8 },
});
