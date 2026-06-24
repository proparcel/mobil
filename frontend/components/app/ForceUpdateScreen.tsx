import React, { useEffect } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { redirectToStore } from '../../src/utils/storeRedirect';

type Props = {
  message: string;
};

export function ForceUpdateScreen({ message }: Props) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-download-outline" size={44} color="#3b82f6" />
        </View>
        <Text style={styles.title}>Güncelleme Gerekli</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable style={styles.button} onPress={() => redirectToStore()}>
          <Text style={styles.buttonText}>Güncelle</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b1220',
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  iconWrap: {
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
