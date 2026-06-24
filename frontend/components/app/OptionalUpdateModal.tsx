import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { redirectToStore } from '../../src/utils/storeRedirect';

type Props = {
  visible: boolean;
  message: string;
  onLater: () => void;
};

export function OptionalUpdateModal({ visible, message, onLater }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onLater}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles-outline" size={36} color="#3b82f6" />
          </View>
          <Text style={styles.title}>Yeni Sürüm Mevcut</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onLater}>
              <Text style={styles.secondaryButtonText}>Sonra</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => {
                redirectToStore();
              }}
            >
              <Text style={styles.primaryButtonText}>Güncelle</Text>
            </Pressable>
          </View>
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
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#1f2937',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
