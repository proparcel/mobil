import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  credits?: number;
  message?: string;
  onClose: () => void;
};

export default function CreditCelebrationModal({
  visible,
  credits = 1,
  message = '',
  onClose,
}: Props) {
  const displayMessage =
    message.trim() || `Tebrikler! ${Number(credits) || 1} Tepe Kredi kazandınız.`;

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
          <Text style={styles.title}>Tebrikler!</Text>
          <Text style={styles.message}>{displayMessage}</Text>
          <View style={styles.coinBadge}>
            <Text style={styles.coinValue}>+{Number(credits) || 1}</Text>
            <Text style={styles.coinLabel}>Tepe Kredi</Text>
          </View>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Harika</Text>
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
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  coinBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  coinValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#b45309',
  },
  coinLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
