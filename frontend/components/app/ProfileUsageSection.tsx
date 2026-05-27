import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  creditService,
  type ProfileUsageLedgerItem,
  type ProfileUsagePurchaseItem,
  type ProfileUsageSummary,
} from '../../services/creditService';
import {
  formatCreditUsageCoin,
  formatCreditUsageDate,
  formatCreditUsageDescription,
} from '../../src/utils/formatCreditUsageDescription';

type LedgerTab = 'usages' | 'purchases';
type SummaryRange = '30d' | 'all';

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pro_query: 'search-outline',
  ilan: 'home-outline',
  '3d_design': 'cube-outline',
  listing_pro_sorgu_unlock: 'lock-open-outline',
  model_purchase: 'cart-outline',
  parcel_split_view: 'grid-outline',
  drone_video: 'videocam-outline',
  refund: 'return-down-back-outline',
  admin_adjustment: 'build-outline',
  subscription_monthly: 'calendar-outline',
  coin_expiry: 'time-outline',
};

function actionIcon(actionType: string): keyof typeof Ionicons.glyphMap {
  return ACTION_ICONS[actionType] || 'flash-outline';
}

type Props = {
  onOpenPricing: () => void;
};

export default function ProfileUsageSection({ onOpenPricing }: Props) {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ProfileUsageSummary | null>(null);
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('usages');
  const [summaryRange, setSummaryRange] = useState<SummaryRange>('30d');
  const [period, setPeriod] = useState<'30d' | 'all'>('all');
  const [usageRows, setUsageRows] = useState<ProfileUsageLedgerItem[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<ProfileUsagePurchaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const activityCounts = useMemo(() => {
    if (!summary) return { pro_query: 0, ilan: 0, design_3d: 0 };
    const block = summaryRange === '30d' ? summary.usage_summary_30d : summary.usage_summary_all;
    return {
      pro_query: Number(block?.pro_query) || 0,
      ilan: Number(block?.ilan) || 0,
      design_3d: Number(block?.design_3d) || 0,
    };
  }, [summary, summaryRange]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const loadSummary = useCallback(async () => {
    const res = await creditService.getProfileUsageContext();
    if (res.success && res.data) {
      setSummary(res.data);
      return true;
    }
    setSummary(null);
    setError(res.message || 'Özet yüklenemedi.');
    return false;
  }, []);

  const loadLedger = useCallback(async () => {
    const res = await creditService.getProfileUsageLedger({
      page,
      pageSize,
      period: ledgerTab === 'usages' ? period : 'all',
      kind: ledgerTab,
    });
    if (res.success && res.data) {
      if (res.data.kind === 'purchases') {
        setPurchaseRows(res.data.items);
        setUsageRows([]);
      } else {
        setUsageRows(res.data.items);
        setPurchaseRows([]);
      }
      setTotal(res.data.total);
      return true;
    }
    setUsageRows([]);
    setPurchaseRows([]);
    setTotal(0);
    setError(res.message || 'Liste yüklenemedi.');
    return false;
  }, [ledgerTab, page, period]);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    await loadSummary();
    await loadLedger();
    setBusy(false);
  }, [loadSummary, loadLedger]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (busy) return;
    setBusy(true);
    void loadLedger().finally(() => setBusy(false));
  }, [ledgerTab, page, period]);

  const onPickTab = (tab: LedgerTab) => {
    setLedgerTab(tab);
    setPage(1);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="bar-chart" size={20} color="#3b82f6" />
        <Text style={styles.cardTitle}>Kullanımlarım</Text>
      </View>
      <Text style={styles.cardHint}>
        Tepe Coin bakiyeniz, işlem özetleri ve hareket geçmişiniz.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void reload()}>
            <Text style={styles.retryBtnText}>Yeniden dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {busy && !summary ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.loadingTxt}>Yükleniyor…</Text>
        </View>
      ) : null}

      {summary ? (
        <>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{Number(summary.wallet_balance || 0).toLocaleString('tr-TR')}</Text>
              <Text style={styles.kpiLabel}>Mevcut bakiye</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{Number(summary.earned_balance || 0).toLocaleString('tr-TR')}</Text>
              <Text style={styles.kpiLabel}>Kazanılan</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{Number(summary.purchased_balance || 0).toLocaleString('tr-TR')}</Text>
              <Text style={styles.kpiLabel}>Satın alınan pay</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{Number(summary.usage_last_30_days || 0).toLocaleString('tr-TR')}</Text>
              <Text style={styles.kpiLabel}>Son 30 gün (coin)</Text>
            </View>
          </View>

          <View style={styles.activityHead}>
            <Text style={styles.activityTitle}>İşlem yoğunluğu</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, summaryRange === '30d' && styles.segBtnActive]}
                onPress={() => setSummaryRange('30d')}
              >
                <Text style={[styles.segBtnText, summaryRange === '30d' && styles.segBtnTextActive]}>30 gün</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, summaryRange === 'all' && styles.segBtnActive]}
                onPress={() => setSummaryRange('all')}
              >
                <Text style={[styles.segBtnText, summaryRange === 'all' && styles.segBtnTextActive]}>Tümü</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.activityRow}>
            <ActivityChip label="Pro Sorgu" value={activityCounts.pro_query} icon="search-outline" />
            <ActivityChip label="İlan" value={activityCounts.ilan} icon="home-outline" />
            <ActivityChip label="3D" value={activityCounts.design_3d} icon="cube-outline" />
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, ledgerTab === 'usages' && styles.tabBtnActive]}
              onPress={() => onPickTab('usages')}
            >
              <Text style={[styles.tabBtnText, ledgerTab === 'usages' && styles.tabBtnTextActive]}>Coin hareketleri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, ledgerTab === 'purchases' && styles.tabBtnActive]}
              onPress={() => onPickTab('purchases')}
            >
              <Text style={[styles.tabBtnText, ledgerTab === 'purchases' && styles.tabBtnTextActive]}>Satın almalar</Text>
            </TouchableOpacity>
          </View>

          {ledgerTab === 'usages' ? (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Dönem</Text>
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segBtn, period === 'all' && styles.segBtnActive]}
                  onPress={() => {
                    setPeriod('all');
                    setPage(1);
                  }}
                >
                  <Text style={[styles.segBtnText, period === 'all' && styles.segBtnTextActive]}>Tümü</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, period === '30d' && styles.segBtnActive]}
                  onPress={() => {
                    setPeriod('30d');
                    setPage(1);
                  }}
                >
                  <Text style={[styles.segBtnText, period === '30d' && styles.segBtnTextActive]}>30 gün</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.filterHint}>Paket yüklemeleri ve satın alma kayıtları.</Text>
          )}

          {busy ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color="#3b82f6" />
          ) : (ledgerTab === 'usages' ? usageRows : purchaseRows).length === 0 ? (
            <Text style={styles.emptyText}>Bu filtreyle kayıt bulunamadı.</Text>
          ) : (
            <View style={styles.list}>
              {ledgerTab === 'usages'
                ? usageRows.map((item) => (
                    <UsageRow key={item.id || `${item.created_at}-${item.action_type}`} item={item} />
                  ))
                : purchaseRows.map((item) => (
                    <PurchaseRow key={item.id || String(item.purchase_date)} item={item} />
                  ))}
            </View>
          )}

          {total > 0 ? (
            <View style={styles.pager}>
              <Text style={styles.pagerMeta}>
                Toplam {total.toLocaleString('tr-TR')} · Sayfa {page}/{totalPages}
              </Text>
              <View style={styles.pagerBtns}>
                <TouchableOpacity
                  style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                  disabled={page <= 1 || busy}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.pagerBtnText}>Önceki</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
                  disabled={page >= totalPages || busy}
                  onPress={() => setPage((p) => p + 1)}
                >
                  <Text style={styles.pagerBtnText}>Sonraki</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <TouchableOpacity style={styles.ctaBtn} onPress={onOpenPricing}>
        <Ionicons name="add-circle-outline" size={18} color="#3b82f6" />
        <Text style={styles.ctaBtnText}>Tepe Coin Paketleri</Text>
      </TouchableOpacity>
    </View>
  );
}

function ActivityChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.activityChip}>
      <Ionicons name={icon} size={16} color="#3b82f6" />
      <Text style={styles.activityChipLabel}>{label}</Text>
      <Text style={styles.activityChipValue}>{value.toLocaleString('tr-TR')}</Text>
    </View>
  );
}

function UsageRow({ item }: { item: ProfileUsageLedgerItem }) {
  const desc = formatCreditUsageDescription(item.description);
  const iconName = actionIcon(item.action_type);
  const positive = Boolean(item.is_positive);

  return (
    <View style={styles.row}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={iconName} size={20} color="#3b82f6" />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.action_type_label || item.action_type}</Text>
        {desc ? <Text style={styles.rowDesc} numberOfLines={2}>{desc}</Text> : null}
        <Text style={styles.rowMeta}>{formatCreditUsageDate(item.created_at)}</Text>
        {item.balance_after != null ? (
          <Text style={styles.rowBalance}>Bakiye: {Number(item.balance_after).toLocaleString('tr-TR')} C</Text>
        ) : null}
      </View>
      <Text style={[styles.rowCoin, positive && styles.rowCoinPositive]}>
        {formatCreditUsageCoin(item.credits_used, positive)}
      </Text>
    </View>
  );
}

function PurchaseRow({ item }: { item: ProfileUsagePurchaseItem }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconWrap}>
        <Ionicons name="bag-handle-outline" size={20} color="#16a34a" />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.package_name || 'Paket'}</Text>
        <Text style={styles.rowDesc}>{item.status_label || item.status || '—'}</Text>
        <Text style={styles.rowMeta}>{formatCreditUsageDate(item.purchase_date)}</Text>
        {item.amount_paid != null && Number(item.amount_paid) > 0 ? (
          <Text style={styles.rowBalance}>
            Ödeme: {Number(item.amount_paid).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowCoin, styles.rowCoinPositive]}>
        +{Number(item.credits_added || 0).toLocaleString('tr-TR')} C
      </Text>
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
  cardHint: { fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 18 },
  loadingWrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loadingTxt: { fontSize: 13, color: '#64748b' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { fontSize: 13, color: '#b91c1c', marginBottom: 8 },
  retryBtn: { alignSelf: 'flex-start' },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 140,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  activityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  activityTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  activityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  activityChipLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  activityChipValue: { fontSize: 12, fontWeight: '800', color: '#1d4ed8' },
  segment: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  segBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  segBtnActive: { backgroundColor: '#3b82f6' },
  segBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  segBtnTextActive: { color: '#fff' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterHint: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  list: { gap: 8, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  rowDesc: { fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 17 },
  rowMeta: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  rowBalance: { fontSize: 11, color: '#64748b', marginTop: 2 },
  rowCoin: { fontSize: 14, fontWeight: '800', color: '#dc2626', marginTop: 2 },
  rowCoinPositive: { color: '#16a34a' },
  emptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingVertical: 20 },
  pager: { marginTop: 8, gap: 8 },
  pagerMeta: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  pagerBtns: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  pagerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pagerBtnDisabled: { opacity: 0.45 },
  pagerBtnText: { fontSize: 13, fontWeight: '600', color: '#334155' },
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
