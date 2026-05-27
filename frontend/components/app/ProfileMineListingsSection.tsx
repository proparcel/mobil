import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL } from '../../config/api';
import type { MineListingRow } from '../../src/types/listing';

type ListingTab = 'active' | 'passive';

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function isActiveListing(row: MineListingRow): boolean {
  return String(row.publication_status || '').toLowerCase() === 'published';
}

function listingStatusLabel(publicationStatus: string | null | undefined): string {
  const p = String(publicationStatus || '').toLowerCase();
  if (p === 'published') return 'Yayında';
  if (p === 'unpublished') return 'Taslak';
  if (p === 'inactive') return 'Pasif';
  return publicationStatus ? String(publicationStatus) : '—';
}

function statusBadgeStyle(publicationStatus: string | null | undefined) {
  const p = String(publicationStatus || '').toLowerCase();
  if (p === 'published') return styles.statusPublished;
  if (p === 'inactive') return styles.statusInactive;
  return styles.statusDraft;
}

function formatListingDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(amount: number | null | undefined, currency?: string | null): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  try {
    return Number(amount).toLocaleString('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      maximumFractionDigits: 0,
    });
  } catch {
    return `${Number(amount).toLocaleString('tr-TR')} ${currency || 'TRY'}`;
  }
}

type Props = {
  items: MineListingRow[];
  loading: boolean;
  onOpenEditor: (listingId: string) => void;
  onDeactivate: (row: MineListingRow) => void;
  onOpenIlanIslemleri: () => void;
};

export default function ProfileMineListingsSection({
  items,
  loading,
  onOpenEditor,
  onDeactivate,
  onOpenIlanIslemleri,
}: Props) {
  const [tab, setTab] = useState<ListingTab>('active');

  const activeItems = useMemo(() => items.filter(isActiveListing), [items]);
  const passiveItems = useMemo(() => items.filter((row) => !isActiveListing(row)), [items]);
  const visible = tab === 'active' ? activeItems : passiveItems;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="images" size={20} color="#3b82f6" />
        <Text style={styles.cardTitle}>İlanlarım</Text>
      </View>
      <Text style={styles.cardHint}>
        Yayında ve pasif ilanlarınız. Kartlarda gösterim, favori, beğeni ve yorum sayıları yer alır.
      </Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabBtnText, tab === 'active' && styles.tabBtnTextActive]}>
            Aktif ({activeItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'passive' && styles.tabBtnActive]}
          onPress={() => setTab('passive')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabBtnText, tab === 'passive' && styles.tabBtnTextActive]}>
            Pasif ({passiveItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
      ) : visible.length ? (
        <View style={styles.list}>
          {visible.map((row) => (
            <ListingCard
              key={row.listing_id}
              row={row}
              onOpenEditor={onOpenEditor}
              onDeactivate={onDeactivate}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {tab === 'active'
            ? 'Yayında ilanınız yok.'
            : 'Pasif veya taslak ilanınız yok.'}
        </Text>
      )}

      <TouchableOpacity style={styles.ctaBtn} onPress={onOpenIlanIslemleri} activeOpacity={0.85}>
        <Ionicons name="briefcase-outline" size={18} color="#3b82f6" />
        <Text style={styles.ctaBtnText}>İlan işlemleri</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListingCard({
  row,
  onOpenEditor,
  onDeactivate,
}: {
  row: MineListingRow;
  onOpenEditor: (listingId: string) => void;
  onDeactivate: (row: MineListingRow) => void;
}) {
  const imageUri = resolveMediaUrl(row.thumb_url || row.cover_image_url);
  const isPublished = isActiveListing(row);
  const views = Math.max(0, Number(row.detail_view_count_total ?? 0) || 0);
  const favorites = Math.max(0, Number(row.favorite_count_total ?? 0) || 0);
  const likes = Math.max(0, Number(row.rating_success_count ?? 0) || 0);
  const comments = Math.max(0, Number(row.comment_count ?? 0) || 0);
  const priceLabel = formatPrice(row.price_amount, row.currency);
  const dateLabel = formatListingDate(row.updated_at || row.published_at);

  return (
    <View style={styles.listingCard}>
      <TouchableOpacity
        style={styles.listingMain}
        onPress={() => onOpenEditor(row.listing_id)}
        activeOpacity={0.88}
      >
        <View style={styles.thumbWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="image-outline" size={28} color="#94a3b8" />
            </View>
          )}
        </View>
        <View style={styles.listingBody}>
          <Text style={styles.listingTitle} numberOfLines={2}>
            {row.title || row.listing_id}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, statusBadgeStyle(row.publication_status)]}>
              <Text style={styles.statusBadgeText}>{listingStatusLabel(row.publication_status)}</Text>
            </View>
            {dateLabel ? <Text style={styles.dateText}>{dateLabel}</Text> : null}
          </View>
          {priceLabel ? <Text style={styles.priceText}>{priceLabel}</Text> : null}
          <View style={styles.statsRow}>
            <StatChip icon="eye-outline" value={views} color="#475569" bg="#f1f5f9" />
            <StatChip icon="heart" value={favorites} color="#be123c" bg="#fff1f2" />
            <StatChip icon="thumbs-up" value={likes} color="#1d4ed8" bg="#eff6ff" />
            <StatChip icon="chatbubble-ellipses" value={comments} color="#0f766e" bg="#ecfdf5" />
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtnPrimary}
          onPress={() => onOpenEditor(row.listing_id)}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={18} color="#2563eb" />
          <Text style={styles.actionTxtPrimary}>Güncelle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtnWarn, !isPublished && styles.actionBtnDisabled]}
          onPress={() => onDeactivate(row)}
          disabled={!isPublished}
          activeOpacity={0.85}
        >
          <Ionicons name="pause-circle-outline" size={18} color={isPublished ? '#b45309' : '#94a3b8'} />
          <Text style={[styles.actionTxtWarn, !isPublished && styles.actionTxtMuted]}>Pasife al</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatChip({
  icon,
  value,
  color,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.statChipText, { color }]}>{value.toLocaleString('tr-TR')}</Text>
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
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },
  list: { gap: 10 },
  emptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingVertical: 20 },
  listingCard: {
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  listingMain: { flexDirection: 'row', padding: 10, gap: 10 },
  thumbWrap: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden' },
  thumb: { width: 88, height: 88 },
  thumbPlaceholder: {
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingBody: { flex: 1, minWidth: 0 },
  listingTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPublished: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#fef3c7' },
  statusDraft: { backgroundColor: '#e2e8f0' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  dateText: { fontSize: 11, color: '#94a3b8' },
  priceText: { fontSize: 13, fontWeight: '700', color: '#1d4ed8', marginTop: 4 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statChipText: { fontSize: 11, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 10,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  actionBtnWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 4,
  },
  actionBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  actionTxtPrimary: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  actionTxtWarn: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  actionTxtMuted: { color: '#94a3b8' },
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
