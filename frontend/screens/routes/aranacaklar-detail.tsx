import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from '../../src/hooks/useNavigation';
import {
  fetchAranacaklarDetail,
  patchAranacaklarNote,
  deleteAranacaklarNote,
  postAranacaklarFollowup,
  postAranacaklarFollowupCalled,
  postAranacaklarIntent,
  postAranacaklarNote,
  postAranacaklarPhoneCall,
  type AranacaklarDetail,
} from '../../services/aranacaklarService';
import { getPublicListingCategories, type PublicListingCategoryNode } from '../../services/portalService';
import AranacaklarScreenShell from '../../components/app/AranacaklarScreenShell';
import { KeyboardAwareScrollScreen } from '../../components/app/KeyboardAwareScrollScreen';
import {
  AranacaklarIntentLocationSection,
  hydrateSavedQuartersFromIntent,
  intentPayloadFromSavedQuarters,
  type SavedQuarterItem,
} from '../../components/app/AranacaklarIntentLocationSection';
import { AranacaklarSubCategorySelect } from '../../components/app/AranacaklarSubCategorySelect';
import { INTENT_MAIN_TO_ROOT_ID, normalizeIntentLeafId } from '../../src/utils/aranacaklarIntentCategory';
import { followupTone, type FollowupTone } from '../../src/utils/aranacaklarFollowupTone';
import {
  formatNextSearchDueDateTr,
  getNextSearchCountdownLabel,
} from '../../src/utils/aranacaklarFollowupSchedule';
import {
  formatContactCreatedAtTr,
  followupMarkChipColors,
  followupMarkStatusLabel,
  getFollowupActionMark,
} from '../../src/utils/aranacaklarFollowupMarks';
import {
  contactSideBadgeColors,
  formatContactSideLabel,
} from '../../src/utils/aranacaklarContactSide';
import { scheduleAranacaklarContactNotification } from '../../services/aranacaklarLocalNotifications';
import type { VitrinListingSearchParams } from '../../src/types/vitrin';
import {
  pruneAranacaklarListingSearchExtra,
  vitrinFiltersFromIntent,
} from '../../src/utils/aranacaklarListingSearchExtra';
import AranacaklarVitrinFiltersSheet from '../../components/app/AranacaklarVitrinFiltersSheet';

const MAINS = [
  { v: 'arsa', l: 'Arsa' },
  { v: 'tarla', l: 'Tarla' },
  { v: 'yapi', l: 'Yapı' },
  { v: 'ticari', l: 'Ticari' },
];

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
  chipBg: '#f1f5f9',
  pageBg: '#f1f5f9',
} as const;

function followupChipTone(ft: FollowupTone) {
  switch (ft) {
    case 'overdue':
      return { bg: '#fee2e2', border: '#f87171', fg: '#991b1b' };
    case 'soon':
      return { bg: '#fef9c3', border: '#fde047', fg: '#854d0e' };
    case 'called':
      return { bg: '#dcfce7', border: '#86efac', fg: '#14532d' };
    case 'waiting':
      return { bg: '#f1f5f9', border: '#cbd5e1', fg: '#334155' };
    default:
      return { bg: '#f1f5f9', border: '#e2e8f0', fg: '#64748b' };
  }
}

export default function AranacaklarDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const [data, setData] = useState<AranacaklarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [main, setMain] = useState('arsa');
  const [sub, setSub] = useState('');
  const [lt, setLt] = useState('satilik');
  const [minM2, setMinM2] = useState('');
  const [maxM2, setMaxM2] = useState('');
  const [pmin, setPmin] = useState('');
  const [pmax, setPmax] = useState('');
  const [subNodes, setSubNodes] = useState<PublicListingCategoryNode[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const [subLoadErr, setSubLoadErr] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [savedQuarters, setSavedQuarters] = useState<SavedQuarterItem[]>([]);
  const [hydratingLocations, setHydratingLocations] = useState(false);
  const [vitrinExtra, setVitrinExtra] = useState<Partial<VitrinListingSearchParams>>({});
  const [vitrinSheetOpen, setVitrinSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    setSavedQuarters([]);
    const res = await fetchAranacaklarDetail(contactId);
    setLoading(false);
    if (!res.ok || !res.data) {
      Alert.alert('Hata', res.ok ? 'Veri yok' : res.error);
      return;
    }
    setData(res.data);
    const c0 = res.data.contact as Record<string, unknown>;
    if (c0?.contact_id) {
      void scheduleAranacaklarContactNotification({
        contact: {
          contact_id: String(c0.contact_id),
          full_name: String(c0.full_name || ''),
          phone_raw: String(c0.phone_raw || ''),
          phone_e164: String(c0.phone_e164 || ''),
          last_phone_call_at: c0.last_phone_call_at as string | undefined,
          created_at: c0.created_at as string | undefined,
        },
        followup: res.data.followup,
        intent: res.data.intent,
      });
    }
    const i = res.data.intent as any;
    if (i) {
      const m = String(i.main_category || 'arsa');
      setMain(m);
      const rawSub = String(i.sub_category || '');
      setSub(normalizeIntentLeafId(m, rawSub) || rawSub);
      setLt(String(i.listing_type || 'satilik'));
      setMinM2(i.min_m2 != null ? String(i.min_m2) : '');
      setMaxM2(i.max_m2 != null ? String(i.max_m2) : '');
      setPmin(i.price_min != null ? String(i.price_min) : '');
      setPmax(i.price_max != null ? String(i.price_max) : '');
      setHydratingLocations(true);
      void hydrateSavedQuartersFromIntent(i)
        .then(setSavedQuarters)
        .finally(() => setHydratingLocations(false));
      setVitrinExtra(vitrinFiltersFromIntent(i));
    } else {
      setSavedQuarters([]);
      setVitrinExtra({});
    }
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const rootId = INTENT_MAIN_TO_ROOT_ID[main];
    if (!rootId) {
      setSubNodes([]);
      return;
    }
    let cancelled = false;
    setLoadingSub(true);
    setSubLoadErr(null);
    void (async () => {
      const res = await getPublicListingCategories({ parentId: rootId });
      if (cancelled) return;
      setLoadingSub(false);
      if (!res.ok) {
        setSubLoadErr(res.error || 'Alt kategoriler yüklenemedi');
        setSubNodes([]);
        return;
      }
      const nodes = res.data?.nodes || [];
      setSubNodes(nodes.filter((n) => n.is_leaf));
    })();
    return () => {
      cancelled = true;
    };
  }, [main]);

  async function saveAll() {
    if (!contactId) return;
    if (subNodes.length > 0 && !sub.trim()) {
      Alert.alert('Alt kategori', 'İlan kategorisinden bir alt tür seçin.');
      return;
    }
    const loc = intentPayloadFromSavedQuarters(savedQuarters);
    const res = await postAranacaklarIntent(contactId, {
      main_category: main,
      sub_category: sub.trim(),
      listing_type: lt,
      min_m2: minM2 ? Number(minM2) : null,
      max_m2: maxM2 ? Number(maxM2) : null,
      price_min: pmin ? Number(pmin) : null,
      price_max: pmax ? Number(pmax) : null,
      city_ids: loc.city_ids,
      district_ids: loc.district_ids,
      neighborhood_ids: loc.neighborhood_ids,
      listing_search_extra: pruneAranacaklarListingSearchExtra(vitrinExtra),
    });
    if (!res.ok) {
      Alert.alert('Hata', res.error);
      return;
    }
    const trimmed = note.trim();
    if (trimmed) {
      const noteRes = await postAranacaklarNote(contactId, trimmed);
      if (!noteRes.ok) {
        Alert.alert('Hata', `Talep kaydedildi; not eklenemedi: ${noteRes.error}`);
        await load();
        return;
      }
      setNote('');
    }
    Alert.alert('Başarılı', 'Kayıt tamamlandı.');
    await load();
  }

  async function fu(m: 1 | 3 | 6 | 12) {
    if (!contactId) return;
    const res = await postAranacaklarFollowup(contactId, m);
    if (!res.ok) Alert.alert('Hata', res.error);
    else load();
  }

  async function called() {
    if (!contactId) return;
    const res = await postAranacaklarFollowupCalled(contactId);
    if (!res.ok) Alert.alert('Hata', res.error);
    else load();
  }

  async function saveNoteEdit() {
    if (!contactId || !editingNoteId || !editNoteText.trim()) return;
    const res = await patchAranacaklarNote(contactId, editingNoteId, editNoteText.trim());
    if (!res.ok) Alert.alert('Hata', res.error);
    else {
      setEditingNoteId(null);
      load();
    }
  }

  function removeNote(noteId: string) {
    if (!contactId) return;
    Alert.alert('Notu sil', 'Bu notu silmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteAranacaklarNote(contactId, noteId);
          if (!res.ok) Alert.alert('Hata', res.error);
          else load();
        },
      },
    ]);
  }

  function onSelectMain(v: string) {
    setMain(v);
    setSub('');
  }

  const c = data?.contact as any;
  const tel = c?.phone_e164 || c?.phone_raw;
  const headerTitle = c?.full_name || 'Kişi detayı';
  const fuTone = followupTone(
    data?.followup as Record<string, unknown> | null,
    data?.contact as Record<string, unknown> | null,
  );
  const ct = followupChipTone(fuTone);
  const nextSearchCountdown = getNextSearchCountdownLabel(
    data?.followup as { next_due_at?: string; interval_months?: number } | null,
  );
  const nextSearchDateTr = formatNextSearchDueDateTr(
    data?.followup as { next_due_at?: string; interval_months?: number } | null,
  );
  const createdAtTr = formatContactCreatedAtTr(data?.contact as Record<string, unknown> | null);
  const sideLabel = formatContactSideLabel((data?.contact as Record<string, unknown> | null)?.contact_side);
  const sideColors = contactSideBadgeColors((data?.contact as Record<string, unknown> | null)?.contact_side);
  const actionMark = getFollowupActionMark(
    data?.followup as { next_due_at?: string; interval_months?: number } | null,
    data?.contact as Record<string, unknown> | null,
  );
  const markChip = followupMarkChipColors(actionMark);
  const markStatus = followupMarkStatusLabel(actionMark);
  const activeInterval = Number((data?.followup as Record<string, unknown> | null)?.interval_months) || null;

  const chipColors = (months?: number) => {
    if (actionMark !== 'none') {
      const active = months != null && activeInterval === months;
      return {
        bg: markChip.bg,
        border: markChip.border,
        fg: markChip.fg,
        dot: markChip.dot,
        borderWidth: active ? 2.5 : 2,
      };
    }
    return { bg: ct.bg, border: ct.border, fg: ct.fg, dot: '#94a3b8', borderWidth: 1 };
  };

  if (loading && !data) {
    return (
      <AranacaklarScreenShell title="Yükleniyor…">
        <ActivityIndicator color={COLORS.accentBlue} style={{ marginTop: 40 }} size="large" />
      </AranacaklarScreenShell>
    );
  }

  return (
    <AranacaklarScreenShell title={headerTitle}>
      <KeyboardAwareScrollScreen
        headerHeight={56}
        backgroundColor="#f8fafc"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.infoBanner}>
          {sideLabel ? (
            <View style={[styles.sideBadge, { backgroundColor: sideColors.bg, borderColor: sideColors.border }]}>
              <Text style={[styles.sideBadgeText, { color: sideColors.text }]}>{sideLabel}</Text>
            </View>
          ) : null}
          {createdAtTr ? (
            <Text style={styles.infoBannerText}>
              <Text style={styles.infoBannerLabel}>Kayıt tarihi: </Text>
              {createdAtTr}
            </Text>
          ) : null}
          {markStatus ? (
            <Text
              style={[
                styles.infoBannerStatus,
                actionMark === 'due_red' && styles.infoBannerStatusRed,
                actionMark === 'called_green' && styles.infoBannerStatusGreen,
              ]}
            >
              {markStatus}
            </Text>
          ) : null}
        </View>
        {tel ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Telefon</Text>
            <Text style={styles.sectionLead}>Aramak için dokunun</Text>
            <TouchableOpacity
              onPress={() => {
                if (!contactId) return;
                void (async () => {
                  try {
                    await postAranacaklarPhoneCall(contactId);
                    load();
                  } catch {
                    /* sessiz */
                  }
                })();
                Linking.openURL(`tel:${tel}`);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.link}>{c?.phone_raw || tel}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sonraki hatırlatma</Text>
          <Text style={styles.sectionLead}>Bir sonraki aramayı ne zaman yapmak istediğinizi seçin</Text>
          {nextSearchCountdown ? (
            <Text style={styles.countdown}>{nextSearchCountdown}</Text>
          ) : null}
          {nextSearchDateTr ? (
            <Text style={styles.countdownDate}>Arama tarihi: {nextSearchDateTr}</Text>
          ) : null}
          <View style={styles.rowTight}>
            {([1, 3, 6, 12] as const).map((m) => {
              const cc = chipColors(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.chip,
                    styles.chipMarked,
                    {
                      backgroundColor: cc.bg,
                      borderColor: cc.border,
                      borderWidth: cc.borderWidth,
                    },
                  ]}
                  onPress={() => fu(m)}
                  activeOpacity={0.85}
                >
                  {actionMark !== 'none' ? (
                    <View style={[styles.chipMarkDot, { backgroundColor: cc.dot }]} />
                  ) : null}
                  <Text style={[styles.chipText, { color: cc.fg }]}>{m} ay sonra</Text>
                </TouchableOpacity>
              );
            })}
            {(() => {
              const cc = chipColors();
              return (
                <TouchableOpacity
                  style={[
                    styles.chip,
                    styles.chipMarked,
                    {
                      backgroundColor: cc.bg,
                      borderColor: cc.border,
                      borderWidth: cc.borderWidth,
                    },
                  ]}
                  onPress={called}
                  activeOpacity={0.85}
                >
                  {actionMark !== 'none' ? (
                    <View style={[styles.chipMarkDot, { backgroundColor: cc.dot }]} />
                  ) : null}
                  <Text style={[styles.chipText, { color: cc.fg }]}>Şimdi arandı</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Konum</Text>
          <Text style={styles.sectionLead}>Hangi bölgelerde arama yapılacağını belirleyin</Text>
          {hydratingLocations ? (
            <ActivityIndicator color={COLORS.accentBlue} style={{ marginVertical: 16 }} />
          ) : (
            <AranacaklarIntentLocationSection savedQuarters={savedQuarters} onSavedQuartersChange={setSavedQuarters} />
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Aradığı ilan</Text>
          <Text style={styles.sectionLead}>Kategori, ilan türü ve bütçe</Text>
          <View style={styles.form}>
            <Text style={styles.lbl}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {MAINS.map((x) => (
                <TouchableOpacity key={x.v} style={[styles.chip, main === x.v && styles.chipOn]} onPress={() => onSelectMain(x.v)}>
                  <Text style={[styles.chipText, main === x.v && styles.chipTextOn]}>{x.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <AranacaklarSubCategorySelect
              nodes={subNodes}
              value={sub}
              onChange={setSub}
              loading={loadingSub}
              errorText={subLoadErr}
            />
            {sub && !subNodes.some((n) => n.id === sub) ? (
              <Text style={styles.legacyHint}>
                Eski kayıt: listeden uygun türü yeniden seçin
              </Text>
            ) : null}

            <Text style={[styles.lbl, { marginTop: 4 }]}>İlan türü</Text>
            <View style={styles.rowTight}>
              <TouchableOpacity style={[styles.chip, lt === 'satilik' && styles.chipOn]} onPress={() => setLt('satilik')}>
                <Text style={[styles.chipText, lt === 'satilik' && styles.chipTextOn]}>Satılık</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, lt === 'kiralik' && styles.chipOn]} onPress={() => setLt('kiralik')}>
                <Text style={[styles.chipText, lt === 'kiralik' && styles.chipTextOn]}>Kiralık</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldRowLabel}>Alan (min m²)</Text>
              <TextInput
                style={[styles.inp, styles.fieldRowInput]}
                keyboardType="numeric"
                placeholder="İsteğe bağlı"
                placeholderTextColor={COLORS.textSecondary}
                value={minM2}
                onChangeText={setMinM2}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldRowLabel}>Alan (max m²)</Text>
              <TextInput
                style={[styles.inp, styles.fieldRowInput]}
                keyboardType="numeric"
                placeholder="İsteğe bağlı"
                placeholderTextColor={COLORS.textSecondary}
                value={maxM2}
                onChangeText={setMaxM2}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldRowLabel}>Fiyat (min ₺)</Text>
              <TextInput
                style={[styles.inp, styles.fieldRowInput]}
                keyboardType="numeric"
                placeholder="İsteğe bağlı"
                placeholderTextColor={COLORS.textSecondary}
                value={pmin}
                onChangeText={setPmin}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldRowLabel}>Fiyat (max ₺)</Text>
              <TextInput
                style={[styles.inp, styles.fieldRowInput]}
                keyboardType="numeric"
                placeholder="İsteğe bağlı"
                placeholderTextColor={COLORS.textSecondary}
                value={pmax}
                onChangeText={setPmax}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daha ayrıntılı arama</Text>
          <Text style={styles.sectionLead}>İsterseniz puan, yola cephe veya mesafe gibi ek tercihler ekleyin</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setVitrinSheetOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>
              Ek tercihleri seç{Object.keys(pruneAranacaklarListingSearchExtra(vitrinExtra)).length ? ' ●' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kısa not</Text>
          <Text style={styles.sectionLead}>Bu görüşmeyle ilgili hatırlatmak istediğiniz bir şey varsa yazın</Text>
          <TextInput
            style={[styles.inp, { minHeight: 88 }]}
            multiline
            placeholder="İsteğe bağlı"
            placeholderTextColor={COLORS.textSecondary}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <TouchableOpacity style={styles.primary} onPress={saveAll} activeOpacity={0.85}>
          <Text style={styles.primaryText}>Tümünü kaydet</Text>
        </TouchableOpacity>

        <View style={[styles.sectionCard, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Daha önce kaydedilen notlar</Text>
          {(data?.notes || []).length === 0 ? (
            <Text style={styles.emptyNotes}>Henüz kayıtlı not yok</Text>
          ) : null}
        {(data?.notes || []).map((n) => (
          <View key={n.note_id} style={styles.note}>
            {editingNoteId === n.note_id ? (
              <>
                <TextInput
                  style={[styles.inp, { minHeight: 72 }]}
                  multiline
                  value={editNoteText}
                  onChangeText={setEditNoteText}
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity style={styles.noteBtn} onPress={saveNoteEdit} activeOpacity={0.85}>
                    <Text style={styles.noteBtnTextPrimary}>Kaydet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.noteBtn}
                    onPress={() => setEditingNoteId(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.noteBtnText}>İptal</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.noteHead}>
                  <Text style={styles.noteDate}>{n.created_at}</Text>
                  <View style={styles.noteHeadBtns}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingNoteId(n.note_id);
                        setEditNoteText(n.text || '');
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.noteLink}>Düzenle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeNote(n.note_id)} activeOpacity={0.85}>
                      <Text style={styles.noteLinkDanger}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.noteText}>{n.text}</Text>
              </>
            )}
          </View>
        ))}
        </View>
      </KeyboardAwareScrollScreen>
      <AranacaklarVitrinFiltersSheet
        visible={vitrinSheetOpen}
        onClose={() => setVitrinSheetOpen(false)}
        value={vitrinExtra}
        onApply={(next) => setVitrinExtra(next)}
      />
    </AranacaklarScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 12, paddingBottom: 40, paddingTop: 12, backgroundColor: COLORS.pageBg },
  infoBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  sideBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  sideBadgeText: { fontSize: 12, fontWeight: '800' },
  infoBannerText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  infoBannerLabel: { color: COLORS.textSecondary, fontWeight: '600' },
  infoBannerStatus: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  infoBannerStatusRed: { color: '#b91c1c' },
  infoBannerStatusGreen: { color: '#15803d' },
  chipMarked: { position: 'relative', paddingTop: 14 },
  chipMarkDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  lastSection: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sectionLead: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 19 },
  countdown: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accentBlue,
    marginBottom: 6,
  },
  countdownDate: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  emptyNotes: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
  secondaryBtn: {
    backgroundColor: COLORS.chipBg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginBottom: 0,
  },
  secondaryBtnText: { color: COLORS.accentBlue, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  link: { color: COLORS.accentBlue, marginTop: 2, fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  rowTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 0, marginBottom: 0 },
  chip: { backgroundColor: COLORS.chipBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderSoft },
  chipOn: { backgroundColor: COLORS.accentBlue, borderColor: COLORS.accentBlue },
  chipText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  legacyHint: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  form: { gap: 8 },
  lbl: { color: COLORS.textSecondary, fontSize: 12 },
  inp: {
    backgroundColor: COLORS.cardBg,
    color: COLORS.textPrimary,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  primary: {
    backgroundColor: COLORS.accentBlue,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldRowInput: { flex: 1 },
  fieldRowLabel: { width: 118, textAlign: 'left', fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  note: { backgroundColor: COLORS.cardBg, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.borderSoft },
  noteHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  noteHeadBtns: { flexDirection: 'row', gap: 12 },
  noteActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  noteBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  noteBtnText: { color: COLORS.textPrimary, fontWeight: '600' },
  noteBtnTextPrimary: { color: COLORS.accentBlue, fontWeight: '600' },
  noteLink: { color: COLORS.accentBlue, fontSize: 13, fontWeight: '600' },
  noteLinkDanger: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  noteDate: { color: COLORS.textSecondary, fontSize: 11 },
  noteText: { color: COLORS.textPrimary, marginTop: 4 },
});
