import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const TepeCoinIcon = require('../../assets/images/TepeCoin.png');
import { useRouter, useLocalSearchParams } from '../../src/hooks/useNavigation';
import { useAuth } from '../contexts/AuthContext';
import { checkExpertRequestAvailability, purchaseAndCreateExpertRequest } from '../../services/expertRequestService';
import { creditService } from '../../services/creditService';

const COLORS = {
  brandNavy: '#0f172a',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
  textMuted: '#475569',
  textOnDark: '#f8fafc',
} as const;

/** purchasing_kredits action_type anahtarları → kart Tepe Coin varsayılanları */
const CREDIT_ACTION_KEYS = {
  expertConsultancy: 'expert_consultancy',
  proparcelGorusu: 'proparcel_gorusu',
  proparcelExper: 'proparcel_exper',
} as const;
const DEFAULT_CREDITS = { expertConsultancy: 10, proparcelGorusu: 5, proparcelExper: 100 };

type Params = {
  il?: string;
  ilce?: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
  tkgm_value?: string;
  proparcel_value?: string;
  cacheId?: string;
};

export default function ReportExpertRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [credits, setCredits] = useState(DEFAULT_CREDITS);
  const [costsLoaded, setCostsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await creditService.getCreditCosts();
      if (cancelled) return;
      const raw = res as unknown as { costs?: Record<string, number>; data?: { costs?: Record<string, number> } };
      const costsMap = raw?.costs ?? raw?.data?.costs ?? null;
      if (costsMap && typeof costsMap === 'object') {
        setCredits({
          expertConsultancy: typeof costsMap[CREDIT_ACTION_KEYS.expertConsultancy] === 'number'
            ? costsMap[CREDIT_ACTION_KEYS.expertConsultancy]
            : DEFAULT_CREDITS.expertConsultancy,
          proparcelGorusu: typeof costsMap[CREDIT_ACTION_KEYS.proparcelGorusu] === 'number'
            ? costsMap[CREDIT_ACTION_KEYS.proparcelGorusu]
            : DEFAULT_CREDITS.proparcelGorusu,
          proparcelExper: typeof costsMap[CREDIT_ACTION_KEYS.proparcelExper] === 'number'
            ? costsMap[CREDIT_ACTION_KEYS.proparcelExper]
            : DEFAULT_CREDITS.proparcelExper,
        });
      }
      setCostsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const il = params.il ?? '';
  const ilce = params.ilce ?? '';
  const mahalle = params.mahalle ?? '';
  const ada = params.ada ?? '';
  const parsel = params.parsel ?? '';
  const proparcelValue = params.proparcel_value ? Number(params.proparcel_value) : null;
  const tkgmValue = params.tkgm_value ?? null;

  const handleCard1Press = async () => {
    if (!isAuthenticated) {
      Alert.alert('Giriş gerekli', 'Uzman görüşü istemek için giriş yapın.');
      router.push('login');
      return;
    }
    if (busy) return;
    if (proparcelValue == null) {
      Alert.alert('Hata', 'Mahalle bilgisi bulunamadı (proparcel_value).');
      return;
    }
    const availability = await checkExpertRequestAvailability(proparcelValue);
    if (!availability.ok) {
      Alert.alert('Hata', availability.error);
      return;
    }
    if (!availability.available) {
      Alert.alert('Uygun değil', availability.reason ?? 'Bu bölgede uzman bulunmuyor.');
      return;
    }
    Alert.alert(
      'Uzman Görüşü',
      `Bu bölgede ${availability.eligibleExpertCount} uzman var.\nBu işlem ${credits.expertConsultancy} Tepe Coin ücretiyle talep oluşturur.\nDevam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, oluştur',
          style: 'default',
          onPress: async () => {
            try {
              setBusy(true);
              const idem = `er_${Date.now()}_${Math.random().toString(16).slice(2)}`;
              const payload = {
                neighborhoodId: proparcelValue,
                parcelRef: {
                  city: il,
                  district: ilce,
                  neighborhood: mahalle,
                  ada,
                  parsel,
                  tkgm_value: tkgmValue,
                  proparcel_value: proparcelValue,
                },
                sourceReportId: String(params.cacheId ?? ''),
                note: '',
                idempotencyKey: idem,
              };
              const res = await purchaseAndCreateExpertRequest(payload);
              if (!res.ok) {
                Alert.alert('Hata', res.error);
                return;
              }
              Alert.alert('Başarılı', 'Uzman görüşü talebi oluşturuldu.', [
                { text: 'Tamam', style: 'cancel' },
                { text: 'Uzman Görüşü', onPress: () => router.push('expert-requests') },
              ]);
            } catch (e: any) {
              Alert.alert('Hata', e?.message ?? 'Talep oluşturulamadı.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { height: 54 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Uzman Görüşü</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Kart 1 - Bölge Uzmanlarına Danış */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bölge Uzmanlarına Danış</Text>
          <Text style={styles.cardDescription}>
            Raporunuzu {mahalle ? `"${mahalle}"` : 'ilgili'} bölgesinde uzmanlaşmış gayrimenkul danışmanlarına iletebilirsiniz.
            Rapor hakkındaki görüşler 3 iş günü içinde tarafınıza bildirilir. Belirtilen süre içinde geri bildirim gelmemesi halinde Tepe Coin bakiyeniz iade edilir.
          </Text>
          <View style={styles.coinRow}>
            <Image source={TepeCoinIcon} style={styles.coinIcon} resizeMode="contain" />
            <Text style={styles.coinText}>
              {costsLoaded ? `${credits.expertConsultancy} Tepe Coin` : '... Tepe Coin'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCard1Press}
            style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.textOnDark} />
            ) : (
              <Text style={styles.primaryBtnText}>Uzman Görüşü</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Kart 2 - ProParcel'den Görüş İste */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ProParcel'den Görüş İste</Text>
          <Text style={styles.cardDescription}>
            ProParcel ekipleri tarafından saha incelemesi yapılmaksızın raporunuzun değerlendirilmesini talep edebilirsiniz.
            Geri bildirim 3 iş günü içinde tarafınıza iletilir; aksi halde Tepe Coin bakiyeniz iade edilir.
          </Text>
          <View style={styles.coinRow}>
            <Image source={TepeCoinIcon} style={styles.coinIcon} resizeMode="contain" />
            <Text style={styles.coinText}>
              {costsLoaded ? `${credits.proparcelGorusu} Tepe Coin` : '... Tepe Coin'}
            </Text>
          </View>
          <TouchableOpacity style={styles.placeholderBtn} disabled>
            <Text style={styles.placeholderBtnText}>Yakında...</Text>
          </TouchableOpacity>
        </View>

        {/* Kart 3 - ProParcel Resmi Exper Belgesi */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ProParcel Resmi Exper Belgesi</Text>
          <Text style={styles.cardDescription}>
            ProParcel ekiplerince düzenlenen, SPK onaylı, tüm kurum ve kuruluşlarca geçerli resmi exper belgesi talep edebilirsiniz. Belge, gayrimenkul değerleme süreçlerinde resmi delil niteliği taşır.
          </Text>
          <View style={styles.coinRow}>
            <Image source={TepeCoinIcon} style={styles.coinIcon} resizeMode="contain" />
            <Text style={styles.coinText}>
              {costsLoaded ? `${credits.proparcelExper} Tepe Coin` : '... Tepe Coin'}
            </Text>
          </View>
          <TouchableOpacity style={styles.placeholderBtn} disabled>
            <Text style={styles.placeholderBtnText}>Yakında...</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.brandNavy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#3b82f6',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
  headerRight: { width: 36, height: 36 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.brandNavy, marginBottom: 10 },
  cardDescription: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginBottom: 12 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  coinIcon: { width: 20, height: 20 },
  coinText: { fontSize: 13, fontWeight: '700', color: COLORS.accentBlue },
  primaryBtn: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textOnDark },
  placeholderBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  placeholderBtnText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});
