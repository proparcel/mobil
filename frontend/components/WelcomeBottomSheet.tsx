import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { sheetScrollBottomPadding } from '../src/utils/sheetSafeArea';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const WelcomeBottomSheet: React.FC<Props> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={['45%']}
      initialIndex={0}
      modalProps={{ enableDynamicSizing: true }}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: sheetScrollBottomPadding(insets.bottom, 20) }]}>
        <Text style={styles.title}>ProParcel&apos;a hoş geldiniz</Text>
        <Text style={styles.text}>
          Haritadan parsel sorgulayabilir, emlak vitrinini ve son 30 gün pro sorgularını menüden açabilirsiniz.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Başla</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

export default WelcomeBottomSheet;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  text: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 20 },
  btn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
