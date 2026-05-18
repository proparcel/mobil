import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheetModal from './app/AppBottomSheetModal';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const WelcomeBottomSheet: React.FC<Props> = ({ visible, onClose }) => {
  if (!visible) return null;
  return (
    <AppBottomSheetModal visible={visible} onClose={onClose} snapPoints={['45%']} initialIndex={0}>
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>ProParcel&apos;a hoş geldiniz</Text>
        <Text style={styles.text}>
          Haritadan parsel sorgulayabilir, emlak vitrinini ve son 30 gün pro sorgularını menüden açabilirsiniz.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Başla</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

export default WelcomeBottomSheet;

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  text: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 24 },
  btn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
