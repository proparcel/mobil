/**
 * Dosyalarım — kayıtlı sorgu / parsel / 3D girişleri (ana haritadaki modalları açar)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRouter } from '../../src/hooks/useNavigation';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  pageBg: '#f8fafc',
} as const;

export default function DosyalarimScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Dosyalarım</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('index', { launch: 'my-queries' })}
          activeOpacity={0.7}
        >
          <Ionicons name="bookmark-outline" size={22} color={COLORS.accentBlue} />
          <Text style={styles.rowText}>Kayıtlı sorgularım</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.borderSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('index', { launch: 'parcel-split' })}
          activeOpacity={0.7}
        >
          <Ionicons name="git-branch-outline" size={22} color={COLORS.accentBlue} />
          <Text style={styles.rowText}>Hisseli parsel projelerim</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.borderSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('index', { launch: '3d-designs' })}
          activeOpacity={0.7}
        >
          <Ionicons name="cube-outline" size={22} color={COLORS.accentBlue} />
          <Text style={styles.rowText}>3D tasarımlarım</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.borderSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('drone-editor')}
          activeOpacity={0.7}
        >
          <Ionicons name="videocam-outline" size={22} color={COLORS.accentBlue} />
          <Text style={styles.rowText}>AI drone videolarım</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.borderSoft} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    gap: 12,
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
});
