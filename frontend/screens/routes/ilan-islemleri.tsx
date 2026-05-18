import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRouter } from '../../src/hooks/useNavigation';

export default function IlanIslemleriScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>İlan İşlemleri</Text>
        <View style={{ width: 22 }} />
      </View>
      <TouchableOpacity style={styles.row} onPress={() => router.push('ilanlarim')}>
        <Text style={styles.rowText}>İlanlarım</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.row} onPress={() => router.push('favori-ilanlarim')}>
        <Text style={styles.rowText}>Favori ilanlarım</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', padding: 14 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  row: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  rowText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
});
