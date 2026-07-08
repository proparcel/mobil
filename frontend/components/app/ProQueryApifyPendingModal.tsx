import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { APIFY_PENDING_USER_MESSAGE } from '../../src/utils/proQueryApi';

type Props = {
  visible: boolean;
  message?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirming?: boolean;
};

export default function ProQueryApifyPendingModal({
  visible,
  message,
  onConfirm,
  onCancel,
  confirming = false,
}: Props) {
  const body = String(message || APIFY_PENDING_USER_MESSAGE).trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={36} color="#1e3a8a" />
          </View>
          <Text style={styles.title}>Fiyat analizi gerekli</Text>
          <Text style={styles.message}>{body}</Text>
          <Pressable
            style={[styles.button, confirming && styles.buttonDisabled]}
            onPress={onConfirm}
            disabled={confirming}
          >
            <Text style={styles.buttonText}>{confirming ? 'Başlatılıyor…' : 'Tamam'}</Text>
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
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#eff6ff',
    fontSize: 15,
    fontWeight: '700',
  },
});
