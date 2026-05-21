import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Linking,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Contacts from 'react-native-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePhoneToE164TR } from '../../src/utils/phoneE164';
import { useRouter } from '../../src/hooks/useNavigation';
import { createAranacaklarContact } from '../../services/aranacaklarService';
import AranacaklarScreenShell from '../../components/app/AranacaklarScreenShell';
import { KeyboardAwareBody } from '../../components/app/KeyboardAwareBody';
import { SCROLL_VIEW_KEYBOARD_PROPS } from '../../src/keyboard';
import { CONTACT_SIDE_OPTIONS, type ContactSide } from '../../src/utils/aranacaklarContactSide';

type Row = { recordID: string; displayName: string; phoneNumber: string };

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
  pageBg: '#f8fafc',
} as const;

const ERR_CONTACTS_PERMISSION = 'Rehber izni gerekli.';

/** Sadece rehber okuma — native takılırsa üst sınır */
const READ_CONTACTS_MS = 120_000;

/** Bellek + AsyncStorage; süre sınırı yok. Güncel rehber için liste aşağı çekilir. */
const PHONEBOOK_STORAGE_KEY = 'pp_phonebook_cache_v1';

type PhonebookCache = { rows: Row[]; loadedAt: number };

let phonebookCache: PhonebookCache | null = null;

async function loadPhonebookFromDisk(): Promise<PhonebookCache | null> {
  try {
    const raw = await AsyncStorage.getItem(PHONEBOOK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: Row[]; loadedAt?: number };
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return {
      rows: parsed.rows,
      loadedAt: typeof parsed.loadedAt === 'number' ? parsed.loadedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

async function savePhonebookToDisk(rows: Row[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PHONEBOOK_STORAGE_KEY,
      JSON.stringify({ v: 1, rows, loadedAt: Date.now() })
    );
  } catch {
    /* depolama dolu / izin — sessiz */
  }
}

function hasUsableMemoryCache(): boolean {
  return Boolean(phonebookCache && phonebookCache.rows.length > 0);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * İzin diyaloğu kullanıcı yanıtını bekler — zaman aşımı yok (önceki 25 sn limiti hatalı reddediyordu).
 * Android: doğrudan READ_CONTACTS (sistem penceresi).
 * iOS: Contacts API (sistem penceresi, süresiz bekleme).
 */
async function ensureContactsPermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(ERR_CONTACTS_PERMISSION);
    }
    return;
  }
  let perm = await Contacts.checkPermission();
  if (perm === 'authorized' || perm === 'limited') return;
  perm = await Contacts.requestPermission();
  if (perm !== 'authorized' && perm !== 'limited') {
    throw new Error(ERR_CONTACTS_PERMISSION);
  }
}

function openAppPermissionSettings(): void {
  Linking.openSettings().catch(() => {
    Alert.alert('Ayarlar', 'Uygulama ayarları açılamadı. Ayarlar → Uygulamalar → ProParcel → İzinler yolunu kullanın.');
  });
}

function filterPhonebookRows(rows: Row[], q: string): Row[] {
  const t = q.trim();
  if (!t) return rows;
  const qLower = t.toLocaleLowerCase('tr-TR');
  const qDigits = t.replace(/\D/g, '');
  return rows.filter((row) => {
    if (row.displayName.toLocaleLowerCase('tr-TR').includes(qLower)) return true;
    if (qDigits.length > 0) {
      const phoneDigits = row.phoneNumber.replace(/\D/g, '');
      if (phoneDigits.includes(qDigits)) return true;
    }
    return row.phoneNumber.toLowerCase().includes(qLower);
  });
}

export default function AranacaklarPickerScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>(() => phonebookCache?.rows ?? []);
  const [loading, setLoading] = useState(() => !hasUsableMemoryCache());
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [contactSide, setContactSide] = useState<ContactSide>('alici');

  const filteredItems = useMemo(() => filterPhonebookRows(items, filterText), [items, filterText]);

  const loadContacts = useCallback(
    async (opts: { signal: { cancelled: boolean }; force?: boolean; isRefresh?: boolean }) => {
      const { signal, force = false, isRefresh = false } = opts;

      if (!force && hasUsableMemoryCache() && phonebookCache) {
        if (!signal.cancelled) {
          setItems(phonebookCache.rows);
          setErr(null);
          setLoading(false);
        }
        return;
      }

      if (!force && !hasUsableMemoryCache()) {
        const fromDisk = await loadPhonebookFromDisk();
        if (signal.cancelled) return;
        if (fromDisk?.rows?.length) {
          phonebookCache = fromDisk;
          setItems(fromDisk.rows);
          setErr(null);
          setLoading(false);
          return;
        }
      }

      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      setErr(null);
      try {
        await ensureContactsPermission();
        if (signal.cancelled) return;
        // Fotoğrafsız okuma — büyük rehberlerde getAll() dakikalarca sürebilir
        const list = await withTimeout(
          Contacts.getAllWithoutPhotos(),
          READ_CONTACTS_MS,
          'Rehber okuması çok uzun sürdü. Kişi sayısı çok fazlaysa bir süre sonra tekrar deneyin.'
        );
        if (signal.cancelled) return;
        const rows: Row[] = [];
        for (const c of list || []) {
          const name = (c.displayName || `${c.givenName || ''} ${c.familyName || ''}`).trim();
          const num = c.phoneNumbers?.[0]?.number || '';
          if (!name || !num) continue;
          rows.push({
            recordID: String(c.recordID || c.rawContactId || Math.random()),
            displayName: name,
            phoneNumber: num,
          });
        }
        rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
        if (!signal.cancelled) {
          const snapshot: PhonebookCache = { rows, loadedAt: Date.now() };
          phonebookCache = snapshot;
          setItems(rows);
          void savePhonebookToDisk(rows);
        }
      } catch (e: any) {
        if (signal.cancelled) return;
        const msg = e?.message || 'Rehber okunamadı.';
        setErr(msg);
        if (msg === ERR_CONTACTS_PERMISSION) {
          openAppPermissionSettings();
        }
      } finally {
        if (!signal.cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      const timer = setTimeout(() => {
        void loadContacts({
          signal,
          /** Hata sonrası «Tekrar dene» — tam native okuma */
          force: retryKey > 0,
          isRefresh: false,
        });
      }, 0);
      return () => {
        signal.cancelled = true;
        clearTimeout(timer);
      };
    }, [loadContacts, retryKey])
  );

  const onRefresh = useCallback(() => {
    const signal = { cancelled: false };
    void loadContacts({ signal, force: true, isRefresh: true });
  }, [loadContacts]);

  const onRetry = () => setRetryKey((k) => k + 1);

  async function onAdd(row: Row) {
    const e164 = normalizePhoneToE164TR(row.phoneNumber);
    const res = await createAranacaklarContact({
      full_name: row.displayName,
      phone_raw: row.phoneNumber,
      phone_e164: e164,
      source: 'phonebook',
      contact_side: contactSide,
    });
    if (!res.ok) {
      Alert.alert('Hata', res.error || 'Kayıt oluşturulamadı');
      return;
    }
    const cid = (res.data as any)?.contact_id;
    if (cid) {
      router.replace({ pathname: 'aranacaklar-detail', params: { contactId: String(cid) } });
    } else {
      router.back();
    }
  }

  return (
    <AranacaklarScreenShell title="Rehberden ekle">
      <KeyboardAwareBody headerHeight={56} backgroundColor={COLORS.pageBg}>
      <View style={styles.sideBar}>
        <Text style={styles.sideLabel}>Kişi tipi</Text>
        <View style={styles.sideRow}>
          {CONTACT_SIDE_OPTIONS.map((opt) => {
            const on = contactSide === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sideChip, on && styles.sideChipOn]}
                onPress={() => setContactSide(opt.value)}
                activeOpacity={0.85}
              >
                <Text style={[styles.sideChipText, on && styles.sideChipTextOn]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.sideHint}>Rehbere eklerken seçili tip kaydedilir.</Text>
      </View>
      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.err}>{err}</Text>
          {err === ERR_CONTACTS_PERMISSION ? (
            <Text style={styles.errHint}>Rehber / Kişiler iznini açın; ayarlar açıldıysa izni verip aşağıdan tekrar deneyin.</Text>
          ) : null}
          <View style={styles.errActions}>
            {err === ERR_CONTACTS_PERMISSION ? (
              <TouchableOpacity style={styles.settingsBtn} onPress={openAppPermissionSettings} activeOpacity={0.85}>
                <Text style={styles.settingsBtnText}>Ayarlara git</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>Tekrar dene</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.accentBlue} size="large" />
          <Text style={styles.loadingHint}>Rehber yükleniyor…</Text>
          <Text style={styles.loadingSub}>Fotoğrafsız okunur; çok kişi varsa biraz sürebilir.</Text>
        </View>
      ) : (
        <View style={styles.listRoot}>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya numara ara…"
              placeholderTextColor={COLORS.textSecondary}
              value={filterText}
              onChangeText={setFilterText}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
          <FlatList
            style={styles.listFlex}
            contentContainerStyle={styles.listPad}
            data={filteredItems}
            keyExtractor={(item) => item.recordID}
            initialNumToRender={20}
            windowSize={10}
            keyboardShouldPersistTaps={SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.accentBlue}
                colors={[COLORS.accentBlue]}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.displayName}</Text>
                  <Text style={styles.phone}>{item.phoneNumber}</Text>
                </View>
                <TouchableOpacity style={styles.btn} onPress={() => onAdd(item)} activeOpacity={0.85}>
                  <Text style={styles.btnText}>Ekle</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              !err ? (
                <Text style={styles.muted}>
                  {filterText.trim() ? 'Eşleşen kayıt yok.' : 'Uygun kayıt yok.'}
                </Text>
              ) : null
            }
          />
        </View>
      )}
      </KeyboardAwareBody>
    </AranacaklarScreenShell>
  );
}

const styles = StyleSheet.create({
  sideBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: COLORS.pageBg,
  },
  sideLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 },
  sideRow: { flexDirection: 'row', gap: 8 },
  sideChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
  },
  sideChipOn: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  sideChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  sideChipTextOn: { color: '#1d4ed8' },
  sideHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  listRoot: { flex: 1 },
  listFlex: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: COLORS.pageBg,
  },
  searchInput: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  listPad: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  errBox: { paddingHorizontal: 16, paddingTop: 12 },
  err: { color: '#dc2626', marginBottom: 8 },
  errHint: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  errActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  retryBtn: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  settingsBtn: {
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  settingsBtnText: { color: '#fff', fontWeight: '600' },
  loadingBox: { paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },
  loadingHint: { marginTop: 16, fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  loadingSub: { marginTop: 8, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  muted: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  name: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  phone: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: COLORS.accentBlue, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});
