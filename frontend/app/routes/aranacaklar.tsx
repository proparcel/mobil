import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRouter } from '../../src/hooks/useNavigation';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAranacaklarList,
  postAranacaklarPhoneCall,
  deleteAranacaklarContact,
  type AranacaklarListRow,
} from '../../services/aranacaklarService';
import AranacaklarScreenShell from '../../components/app/AranacaklarScreenShell';
import { formatIntentCardParts } from '../../src/utils/aranacaklarIntentCategory';
import { followupTone, followupToneLabel } from '../../src/utils/aranacaklarFollowupTone';
import { getNextSearchCountdownLabel } from '../../src/utils/aranacaklarFollowupSchedule';
import { syncAranacaklarListNotifications } from '../../services/aranacaklarLocalNotifications';
import {
  contactSideBadgeColors,
  formatContactSideLabel,
} from '../../src/utils/aranacaklarContactSide';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
} as const;

export default function AranacaklarScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [rows, setRows] = useState<AranacaklarListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    const res = await fetchAranacaklarList({});
    setLoading(false);
    if (!res.ok) {
      setErr(res.error || 'Liste alınamadı');
      setRows([]);
      return;
    }
    const list = Array.isArray(res.data?.results) ? res.data.results : [];
    setRows(list);
    void syncAranacaklarListNotifications(list);
  }, [isAuthenticated]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRequestDelete = useCallback((row: AranacaklarListRow) => {
    const id = row.contact.contact_id;
    const name = row.contact.full_name || 'Kişi';
    swipeRefs.current.get(id)?.close();
    Alert.alert('Kaldır', `"${name}" Aranacaklar listesinden kaldırılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteAranacaklarContact(id);
          if (!res.ok) {
            Alert.alert('Hata', res.error || 'Kayıt kaldırılamadı.');
            return;
          }
          setRows((prev) => prev.filter((r) => r.contact.contact_id !== id));
        },
      },
    ]);
  }, []);

  if (!isAuthenticated) {
    return (
      <AranacaklarScreenShell title="Aranacaklar">
        <View style={styles.centerBox}>
          <Text style={styles.muted}>Bu özellik için giriş yapın.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('login')} activeOpacity={0.85}>
            <Text style={styles.btnText}>Giriş</Text>
          </TouchableOpacity>
        </View>
      </AranacaklarScreenShell>
    );
  }

  return (
    <AranacaklarScreenShell title="Aranacaklar">
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('aranacaklar-picker')} activeOpacity={0.85}>
          <Text style={styles.btnSecondaryText}>Rehber</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('aranacaklar-stats')} activeOpacity={0.85}>
          <Text style={styles.btnSecondaryText}>Performans</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={load} activeOpacity={0.85}>
          <Text style={styles.btnText}>Yenile</Text>
        </TouchableOpacity>
      </View>
      {err ? <Text style={styles.error}>{err}</Text> : null}
      {loading && !rows.length ? (
        <ActivityIndicator size="large" color={COLORS.accentBlue} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listPad}
          data={rows}
          keyExtractor={(item) => item.contact.contact_id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          renderItem={({ item }) => {
            const c = item.contact;
            const tel = c.phone_e164 || c.phone_raw;
            const parts = item.intent ? formatIntentCardParts(item.intent as Record<string, unknown>) : null;
            const ft = followupTone(item.followup as Record<string, unknown> | null, item.contact as Record<string, unknown>);
            const countdownLabel = getNextSearchCountdownLabel(
              item.followup as { next_due_at?: string; interval_months?: number } | null,
            );
            const sideLabel = formatContactSideLabel(c.contact_side);
            const sideColors = contactSideBadgeColors(c.contact_side);
            const fuPillStyle =
              ft === 'overdue'
                ? styles.fuPillOverdue
                : ft === 'soon'
                  ? styles.fuPillSoon
                  : ft === 'called'
                    ? styles.fuPillCalled
                    : ft === 'waiting'
                      ? styles.fuPillWaiting
                      : styles.fuPillNone;
            return (
              <Swipeable
                ref={(r) => {
                  if (r) swipeRefs.current.set(c.contact_id, r);
                  else swipeRefs.current.delete(c.contact_id);
                }}
                friction={2}
                overshootLeft={false}
                renderLeftActions={() => (
                  <TouchableOpacity
                    style={styles.swipeDelete}
                    onPress={() => onRequestDelete(item)}
                    activeOpacity={0.85}
                    accessibilityLabel="Kaydı sil"
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={styles.swipeDeleteText}>Sil</Text>
                  </TouchableOpacity>
                )}
              >
                <View style={styles.card}>
                  {countdownLabel ? (
                    <Text style={styles.countdown} numberOfLines={2}>
                      {countdownLabel}
                    </Text>
                  ) : null}
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={2}>
                          {c.full_name}
                        </Text>
                        {sideLabel ? (
                          <View
                            style={[
                              styles.sideBadge,
                              { backgroundColor: sideColors.bg, borderColor: sideColors.border },
                            ]}
                          >
                            <Text style={[styles.sideBadgeText, { color: sideColors.text }]}>{sideLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.phone}>{c.phone_raw || c.phone_e164}</Text>
                      <Text style={[styles.fuPill, fuPillStyle]}>{followupToneLabel(ft)}</Text>
                      {parts ? (
                        <View style={styles.intentBlock}>
                          <Text style={styles.intentHeadline} numberOfLines={2}>
                            {parts.headline}
                          </Text>
                          {parts.m2Line ? <Text style={styles.intentMeta}>{parts.m2Line}</Text> : null}
                          {parts.priceLine ? <Text style={styles.intentMeta}>{parts.priceLine}</Text> : null}
                        </View>
                      ) : (
                        <Text style={styles.metaMuted}>Talep tanımlı değil</Text>
                      )}
                    </View>
                    <View style={styles.cardRight}>
                      {parts ? (
                        <View style={[styles.ltBadge, parts.listingType === 'Kiralık' && styles.ltBadgeRent]}>
                          <Text style={styles.ltBadgeText}>{parts.listingType}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.btnAsideSecondary}
                        onPress={() => {
                          if (!tel) return;
                          void (async () => {
                            try {
                              await postAranacaklarPhoneCall(c.contact_id);
                              load();
                            } catch {
                              /* sessiz */
                            }
                          })();
                          Linking.openURL(`tel:${tel}`);
                        }}
                        activeOpacity={0.85}
                        disabled={!tel}
                      >
                        <Text style={styles.btnAsideSecondaryText}>Ara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnAsidePrimary}
                        onPress={() => router.push({ pathname: 'aranacaklar-detail', params: { contactId: c.contact_id } })}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.btnAsidePrimaryText}>Detay</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Swipeable>
            );
          }}
          ListEmptyComponent={!loading ? <Text style={styles.muted}>Kayıt yok.</Text> : null}
        />
      )}
    </AranacaklarScreenShell>
  );
}

const styles = StyleSheet.create({
  listPad: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  centerBox: { padding: 24, alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  fuPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fuPillNone: { backgroundColor: '#f1f5f9', color: '#64748b' },
  fuPillWaiting: { backgroundColor: '#f1f5f9', color: '#475569' },
  fuPillSoon: { backgroundColor: '#fef9c3', color: '#854d0e' },
  fuPillCalled: { backgroundColor: '#dcfce7', color: '#14532d' },
  fuPillOverdue: { backgroundColor: '#fee2e2', color: '#991b1b' },
  muted: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 16 },
  error: { color: '#dc2626', marginHorizontal: 16, marginBottom: 8 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  countdown: {
    color: COLORS.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardLeft: { flex: 1, minWidth: 0 },
  cardRight: { width: 96, flexShrink: 0, alignItems: 'stretch', gap: 8 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600', flexShrink: 1 },
  sideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  sideBadgeText: { fontSize: 11, fontWeight: '800' },
  phone: { color: COLORS.textSecondary, marginTop: 4, fontSize: 14 },
  intentBlock: { marginTop: 10, gap: 4 },
  intentHeadline: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  intentMeta: { color: COLORS.textSecondary, fontSize: 13 },
  metaMuted: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  ltBadge: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  ltBadgeRent: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  ltBadgeText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  btnAsidePrimary: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAsidePrimaryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  btnAsideSecondary: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAsideSecondaryText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 13 },
  btn: { backgroundColor: COLORS.accentBlue, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  btnSecondary: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnSecondaryText: { color: COLORS.textPrimary, fontWeight: '600' },
  swipeDelete: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: 12,
    marginBottom: 10,
    marginRight: 8,
    gap: 4,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
