import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { fetchAranacaklarStats, type AranacaklarStats } from '../../services/aranacaklarService';
import AranacaklarScreenShell from '../../components/app/AranacaklarScreenShell';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
} as const;

export default function AranacaklarStatsScreen() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<AranacaklarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setErr(null);
    setLoading(true);
    const res = await fetchAranacaklarStats();
    setLoading(false);
    if (!res.ok || !res.data) {
      setErr(res.error || 'Özet alınamadı');
      setData(null);
      return;
    }
    setData(res.data);
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) {
    return (
      <AranacaklarScreenShell title="Performans">
        <View style={styles.center}>
          <Text style={styles.muted}>Bu özellik için giriş yapın.</Text>
        </View>
      </AranacaklarScreenShell>
    );
  }

  return (
    <AranacaklarScreenShell title="Arama performansı">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {loading && !data ? <ActivityIndicator color={COLORS.accentBlue} style={{ marginTop: 24 }} /> : null}
        {err ? <Text style={styles.error}>{err}</Text> : null}
        {data ? (
          <View style={styles.grid}>
            <StatCard label="Kayıtlı kişi" value={data.contacts_total} tone="neutral" />
            <StatCard label="Aktif takip" value={data.followups_active} tone="neutral" />
            <StatCard label="Gecikmiş hatırlatma" value={data.followups_overdue} tone="bad" />
            <StatCard label="Önümüzdeki 3 gün" value={data.followups_due_soon} tone="warn" />
            <StatCard label="Toplam Arandı tıklaması" value={data.calls_total} tone="good" />
            <StatCard label="Son 7 günde aranan kişi" value={data.contacts_called_recent} tone="good" />
          </View>
        ) : null}
        <Text style={styles.hint}>
          Gecikmiş: hatırlatma tarihi geçmiş aktif takipler. Her &quot;Arandı&quot; tıklaması sayaçta toplanır.
        </Text>
      </ScrollView>
    </AranacaklarScreenShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'bad' | 'warn' | 'good' }) {
  const bg =
    tone === 'bad'
      ? styles.cardBad
      : tone === 'warn'
        ? styles.cardWarn
        : tone === 'good'
          ? styles.cardGood
          : styles.card;
  return (
    <View style={[styles.card, bg]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  center: { padding: 24, alignItems: 'center' },
  muted: { color: COLORS.textSecondary },
  error: { color: '#dc2626', marginBottom: 8 },
  grid: { gap: 10 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  cardBad: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  cardWarn: { backgroundColor: '#fefce8', borderColor: '#fde047' },
  cardGood: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cardLabel: { fontSize: 13, color: COLORS.textSecondary },
  cardValue: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginTop: 6 },
  hint: { marginTop: 16, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
});
