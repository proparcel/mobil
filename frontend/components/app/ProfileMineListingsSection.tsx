import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MineListingsPanel from './MineListingsPanel';
import type { MineListingRow } from '../../src/types/listing';

type Props = {
  items: MineListingRow[];
  loading: boolean;
  onOpenEditor: (listingId: string) => void;
  onDeactivate: (row: MineListingRow) => void;
  onPublish: (row: MineListingRow) => void;
  onOpenIlanIslemleri: () => void;
  busyListingId?: string | null;
};

export default function ProfileMineListingsSection({
  items,
  loading,
  onOpenEditor,
  onDeactivate,
  onPublish,
  onOpenIlanIslemleri,
  busyListingId,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="images" size={20} color="#3b82f6" />
        <Text style={styles.cardTitle}>İlanlarım</Text>
      </View>
      <Text style={styles.cardHint}>
        İlanlarınızı yönetin. Kartlarda gösterim, favori, beğeni ve yorum sayıları yer alır.
      </Text>

      <MineListingsPanel
        items={items}
        loading={loading}
        onOpenEditor={onOpenEditor}
        onDeactivate={onDeactivate}
        onPublish={onPublish}
        variant="embedded"
        busyListingId={busyListingId}
      />

      <TouchableOpacity style={styles.ctaBtn} onPress={onOpenIlanIslemleri} activeOpacity={0.85}>
        <Ionicons name="briefcase-outline" size={18} color="#3b82f6" />
        <Text style={styles.ctaBtnText}>İlan işlemleri</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cardHint: { fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 18 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: '#3b82f6' },
});
