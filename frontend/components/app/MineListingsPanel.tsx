import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { resolveMediaUrl } from '../../src/utils/resolveMediaUrl';
import type { MineListingRow } from '../../src/types/listing';

export type MineListingFilter = 'all' | 'published' | 'draft' | 'inactive';

export const MINE_LISTING_FILTERS: { key: MineListingFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'published', label: 'Yayında' },
  { key: 'draft', label: 'Taslak' },
  { key: 'inactive', label: 'Pasif' },
];

export function filterMineListings(
  items: MineListingRow[],
  filter: MineListingFilter,
): MineListingRow[] {
  if (filter === 'all') return items;
  if (filter === 'published') {
    return items.filter((r) => String(r.publication_status || '').toLowerCase() === 'published');
  }
  if (filter === 'inactive') {
    return items.filter((r) => String(r.publication_status || '').toLowerCase() === 'inactive');
  }
  return items.filter((r) => String(r.publication_status || '').toLowerCase() === 'unpublished');
}

export function countMineListingsByFilter(items: MineListingRow[]): Record<MineListingFilter, number> {
  return {
    all: items.length,
    published: items.filter((r) => String(r.publication_status || '').toLowerCase() === 'published').length,
    draft: items.filter((r) => String(r.publication_status || '').toLowerCase() === 'unpublished').length,
    inactive: items.filter((r) => String(r.publication_status || '').toLowerCase() === 'inactive').length,
  };
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

function emptyMessageForFilter(filter: MineListingFilter): string {
  if (filter === 'published') return 'Yayında ilanınız yok.';
  if (filter === 'draft') return 'Taslak ilanınız yok.';
  if (filter === 'inactive') return 'Pasif ilanınız yok.';
  return 'Henüz ilanınız yok.';
}

type FilterTabsProps = {
  filter: MineListingFilter;
  onFilterChange: (filter: MineListingFilter) => void;
  counts: Record<MineListingFilter, number>;
  compact?: boolean;
};

export function MineListingsFilterTabs({
  filter,
  onFilterChange,
  counts,
  compact,
}: FilterTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.tabRow, compact && styles.tabRowCompact]}
    >
      {MINE_LISTING_FILTERS.map(({ key, label }) => {
        const active = filter === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, compact && styles.tabBtnCompact, active && styles.tabBtnActive]}
            onPress={() => onFilterChange(key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
              {label} ({counts[key]})
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

type MineListingCardProps = {
  row: MineListingRow;
  onOpenEditor: (listingId: string) => void;
  onDeactivate: (row: MineListingRow) => void;
  onPublish: (row: MineListingRow) => void;
  busy?: boolean;
};

export function MineListingCard({
  row,
  onOpenEditor,
  onDeactivate,
  onPublish,
  busy,
}: MineListingCardProps) {
  const imageUri = resolveMediaUrl(row.thumb_url || row.cover_image_url);
  const pub = String(row.publication_status || '').toLowerCase();
  const isPublished = pub === 'published';
  const isInactive = pub === 'inactive';
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
        disabled={busy}
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
            {row.title?.trim() || row.listing_id}
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
        {isInactive ? (
          <TouchableOpacity
            style={[styles.actionBtnSuccess, busy && styles.actionBtnDisabled]}
            onPress={() => onPublish(row)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={busy ? '#94a3b8' : '#15803d'} />
            <Text style={[styles.actionTxtSuccess, busy && styles.actionTxtMuted]}>Yayınla</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.actionBtnPrimary, busy && styles.actionBtnDisabled]}
          onPress={() => onOpenEditor(row.listing_id)}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={18} color={busy ? '#94a3b8' : '#2563eb'} />
          <Text style={[styles.actionTxtPrimary, busy && styles.actionTxtMuted]}>Güncelle</Text>
        </TouchableOpacity>
        {isPublished ? (
          <TouchableOpacity
            style={[styles.actionBtnWarn, busy && styles.actionBtnDisabled]}
            onPress={() => onDeactivate(row)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="pause-circle-outline" size={18} color={busy ? '#94a3b8' : '#b45309'} />
            <Text style={[styles.actionTxtWarn, busy && styles.actionTxtMuted]}>Pasife al</Text>
          </TouchableOpacity>
        ) : null}
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

type MineListingsPanelProps = {
  items: MineListingRow[];
  loading: boolean;
  onOpenEditor: (listingId: string) => void;
  onDeactivate: (row: MineListingRow) => void;
  onPublish: (row: MineListingRow) => void;
  variant?: 'embedded' | 'standalone';
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  busyListingId?: string | null;
};

export default function MineListingsPanel({
  items,
  loading,
  onOpenEditor,
  onDeactivate,
  onPublish,
  variant = 'embedded',
  refreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
  busyListingId,
}: MineListingsPanelProps) {
  const [filter, setFilter] = useState<MineListingFilter>('all');
  const counts = useMemo(() => countMineListingsByFilter(items), [items]);
  const filtered = useMemo(() => filterMineListings(items, filter), [items, filter]);

  const filterTabs = (
    <MineListingsFilterTabs
      filter={filter}
      onFilterChange={setFilter}
      counts={counts}
      compact={variant === 'embedded'}
    />
  );

  const renderItem: ListRenderItem<MineListingRow> = ({ item }) => (
    <MineListingCard
      row={item}
      onOpenEditor={onOpenEditor}
      onDeactivate={onDeactivate}
      onPublish={onPublish}
      busy={busyListingId === item.listing_id}
    />
  );

  const emptyNode =
    ListEmptyComponent ??
    (!loading ? (
      <Text style={styles.emptyText}>{emptyMessageForFilter(filter)}</Text>
    ) : null);

  if (variant === 'standalone') {
    return (
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.listing_id}
        renderItem={renderItem}
        contentContainerStyle={styles.standaloneList}
        ListHeaderComponent={
          <View>
            {ListHeaderComponent}
            {filterTabs}
            {loading ? <ActivityIndicator color="#3b82f6" style={styles.loaderInline} /> : null}
          </View>
        }
        ListEmptyComponent={loading ? null : emptyNode}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
          ) : undefined
        }
      />
    );
  }

  return (
    <View>
      {filterTabs}
      {loading ? (
        <ActivityIndicator color="#3b82f6" style={styles.loaderInline} />
      ) : filtered.length ? (
        <View style={styles.list}>
          {filtered.map((row) => (
            <MineListingCard
              key={row.listing_id}
              row={row}
              onOpenEditor={onOpenEditor}
              onDeactivate={onDeactivate}
              onPublish={onPublish}
              busy={busyListingId === row.listing_id}
            />
          ))}
        </View>
      ) : (
        emptyNode
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  tabRowCompact: { paddingBottom: 12 },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtnCompact: { paddingVertical: 8, paddingHorizontal: 12 },
  tabBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },
  list: { gap: 10 },
  standaloneList: { padding: 16, paddingBottom: 32, gap: 10 },
  loaderInline: { marginVertical: 16 },
  emptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingVertical: 20 },
  listingCard: {
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 10,
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
    flexWrap: 'wrap',
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
  actionBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4,
  },
  actionBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  actionTxtPrimary: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  actionTxtWarn: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  actionTxtSuccess: { fontSize: 14, fontWeight: '700', color: '#15803d' },
  actionTxtMuted: { color: '#94a3b8' },
});
