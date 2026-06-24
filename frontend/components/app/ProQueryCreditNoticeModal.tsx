import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProQueryCreditNotice } from '../../src/types/portal';
import { resolveProQueryCreditNoticeTitle } from '../../src/utils/portalPriceStatus';

type Props = {
  visible: boolean;
  notice: ProQueryCreditNotice | null | undefined;
  onClose: () => void;
};

export default function ProQueryCreditNoticeModal({ visible, notice, onClose }: Props) {
  const message = String(notice?.message || '').trim();
  if (!message) {
    return null;
  }

  const title = resolveProQueryCreditNoticeTitle(notice);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="information-circle" size={36} color="#14532d" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Anladım</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14532d',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#14532d',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#14532d',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ecfdf5',
    fontSize: 15,
    fontWeight: '700',
  },
});
