import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ProParcelResponse } from '../src/types/parcelResponse';
import { formatTurkishPrice, parseTurkishPrice } from '../src/utils/priceParser';
import { normalizeParcelShapeLabel } from '../src/utils/normalizeParcelShapeLabel';
import {
  mergeParcelDisplayProperties,
  pickParcelDisplayValue,
  LOCATION_IL_KEYS,
  LOCATION_ILCE_KEYS,
  LOCATION_MAHALLE_KEYS,
} from '../src/utils/mergeParcelDisplayProperties';
import { formatParcelAreaDisplay, pickParcelAreaRaw, resolveParcelAreaM2 } from '../src/utils/dfaRows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { sheetScrollBottomPadding } from '../src/utils/sheetSafeArea';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { fetchAdaparselParcelDetail } from '../services/adaparselAlertService';
import { getOrFetchAdaparselParcelDetail } from '../src/utils/adaparselDetailCache';
import { resolveTkgmParcelLookupParams } from '../src/utils/tkgmParcelIdentifiers';
import { logSimpleQuery } from '../src/utils/simpleQueryLogger';

interface ParcelModalProps {
  visible: boolean;
  onClose: () => void;
  properties: Record<string, any>;
  analysisData?: ProParcelResponse | null;
  onShare?: () => void;
  onGetDirections?: () => void;
  onStreetView?: () => void;
  onToggle3D?: () => void;
  is3DMode?: boolean;
  onSwitchToProMode?: () => void;
  showAdaparselDetail?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.55;

const PRICE_KEYS_UNIT = [
  'unite_price', 'unitPrice', 'unit_price', 'birim_fiyat', 'birimFiyat', 'BirimFiyat',
  'pricePerSquareMeter', 'price_per_square_meter', 'm2_price', 'm2Price', 'M2Price', 'KYM_M2Price',
  'quarter_uniteprice', 'quarter_uniteprice_km_estimated', 'quarter_uniteprice_median',
];

const PRICE_KEYS_TOTAL = [
  'price_of_tarla', 'total_price', 'toplam_fiyat', 'TotalPrice', 'totalPrice', 'ToplamFiyat',
  'estimated_total_price', 'estimatedTotalPrice', 'estimated_price', 'km_recommended_price',
];

const normalizeKey = (key: string): string => {
  const raw = String(key ?? '').trim();
  const noDiacritics = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.toLowerCase().replace(/I/g, 'i').replace(/ı/g, 'i').replace(/[\s_-]+/g, '');
};

const hiddenFieldsRaw = [
  'pafta', 'quarter_type_name', 'parcel_isExist', 'il_id', 'ilId', 'ilce_id', 'ilceId', 'mahalle_id', 'mahalleId',
  'gittigiParselListe', 'gittigi_parsel_liste', 'Gittigi Parsel Liste', 'gittigiParselSebep', 'gittigi_parsel_sebep',
  'Gittigi Parsel Sebep', 'Boundary Birincil Yapı', 'Boundary Birincil Yapi', 'BoundaryBirincilYapi',
  'boundaryBirincilYapi', 'boundaryBirincilYapı', 'boundary_birincil_yapi', 'boundary_birincil_yapı',
];

const hiddenKeysNormalized = new Set(hiddenFieldsRaw.map(normalizeKey));
const isHiddenKey = (key: string): boolean => hiddenKeysNormalized.has(normalizeKey(key));

const pickValue = (source: Record<string, any>, keys: string[]): string => {
  for (const k of keys) {
    const v = source?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v);
  }
  return '-';
};

const pickRaw = (source: Record<string, any>, keys: string[]): any => {
  for (const k of keys) {
    const v = source?.[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    const sl = s.toLowerCase();
    if (sl === 'none' || sl === 'null' || sl === 'undefined' || s === '-') continue;
    return v;
  }
  return null;
};

const formatPriceMaybe = (raw: any, showDecimals: boolean = false): string => {
  if (raw === null || raw === undefined) return '-';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return '-';
    const tl = t.toLowerCase();
    if (tl === 'none' || tl === 'null' || tl === 'undefined' || t === '-') return '-';
    if (tl.includes('tl') || t.includes('₺')) {
      // Eğer kuruş gösterilmeyecekse, virgülden sonrasını kaldır
      if (!showDecimals) {
        return t.replace(/,\d{2}/, '');
      }
      return t;
    }
  }
  const parsed = parseTurkishPrice(raw as any);
  if (!parsed) return '-';
  
  // Kuruş gösterilmeyecekse tam sayı olarak formatla
  if (!showDecimals) {
    return Math.round(parsed).toLocaleString('tr-TR') + ' ₺';
  }
  return formatTurkishPrice(parsed);
};

const ParcelModal: React.FC<ParcelModalProps> = ({
  visible,
  onClose,
  properties,
  analysisData,
  onShare,
  onGetDirections,
  onStreetView,
  onToggle3D,
  is3DMode = false,
  onSwitchToProMode,
  showAdaparselDetail = false,
}) => {
  const insets = useSafeAreaInsets();
  const [adaparselLoading, setAdaparselLoading] = useState(false);
  const [adaparselDetail, setAdaparselDetail] = useState<{
    Adi?: string | null;
    HissePay?: string | null;
    HissePayda?: string | null;
    EdinmeSebebi?: string | null;
  } | null>(null);
  const [adaparselFound, setAdaparselFound] = useState<boolean | null>(null);

  const mergedProperties = useMemo(
    () => mergeParcelDisplayProperties({ properties, analysisData }),
    [properties, analysisData],
  );

  const summary = useMemo(() => {
    const il = pickParcelDisplayValue(mergedProperties, LOCATION_IL_KEYS);
    const ilce = pickParcelDisplayValue(mergedProperties, LOCATION_ILCE_KEYS);
    const mahalle = pickParcelDisplayValue(mergedProperties, LOCATION_MAHALLE_KEYS);
    const ada = pickValue(mergedProperties, ['adaNo', 'ada', 'Ada']);
    const parsel = pickValue(mergedProperties, ['parselNo', 'parsel', 'Parsel']);
    const alanRaw = pickParcelAreaRaw(mergedProperties);
    const alan = formatParcelAreaDisplay(alanRaw, '-');
    const nitelik = pickValue(mergedProperties, ['nitelik', 'Nitelik']);
    const mevkii = pickValue(mergedProperties, ['mevkii']);
    const parcelShapeRaw = pickValue(mergedProperties, ['parcel_shape_type_label', 'parcel_shape_type']);
    const parcelShape =
      parcelShapeRaw && parcelShapeRaw !== '-'
        ? normalizeParcelShapeLabel(parcelShapeRaw) ?? parcelShapeRaw
        : parcelShapeRaw;
    const unitRaw = pickRaw(mergedProperties, PRICE_KEYS_UNIT);
    let totalRaw = pickRaw(mergedProperties, PRICE_KEYS_TOTAL);
    if (totalRaw === null) {
      const unitNum = parseTurkishPrice(unitRaw as any);
      const areaNum = resolveParcelAreaM2(alanRaw);
      if (unitNum > 0 && areaNum > 0) totalRaw = unitNum * areaNum;
    }
    return {
      il,
      ilce,
      mahalle,
      ada,
      parsel,
      alan,
      nitelik,
      mevkii,
      parcelShape,
      unitPriceText: formatPriceMaybe(unitRaw),
      totalPriceText: formatPriceMaybe(totalRaw),
    };
  }, [mergedProperties]);

  const lookupParams = useMemo(
    () => resolveTkgmParcelLookupParams(mergedProperties),
    [
      mergedProperties?.adaNo,
      mergedProperties?.ada,
      mergedProperties?.parselNo,
      mergedProperties?.parsel,
      mergedProperties?.mahalleId,
      mergedProperties?.mahalleAd,
      mergedProperties?.proparcel_value,
      mergedProperties?.Proparcel_value,
      mergedProperties?.ilAd,
      mergedProperties?.il,
    ],
  );

  useEffect(() => {
    if (!visible || !showAdaparselDetail) {
      setAdaparselLoading(false);
      setAdaparselDetail(null);
      setAdaparselFound(null);
      return;
    }

    if (!lookupParams) {
      setAdaparselLoading(false);
      setAdaparselDetail(null);
      setAdaparselFound(false);
      return;
    }

    let cancelled = false;
    setAdaparselLoading(true);
    setAdaparselDetail(null);
    setAdaparselFound(null);

    const fetchStart = performance.now();
    void getOrFetchAdaparselParcelDetail(lookupParams)
      .then((result) => {
        if (cancelled) return;
        const detailFetchMs = Math.round(performance.now() - fetchStart);
        logSimpleQuery('adaparsel_detail_modal_result', {
          found: result.found,
          detailFetchMs,
          lookupParams,
          error: result.error,
          httpStatus: result.httpStatus,
        });
        setAdaparselFound(result.found);
        setAdaparselDetail(result.detail ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        logSimpleQuery('adaparsel_detail_modal_error', {
          errorMessage: error instanceof Error ? error.message : String(error),
          lookupParams,
        });
        setAdaparselFound(false);
        setAdaparselDetail(null);
      })
      .finally(() => {
        if (!cancelled) setAdaparselLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, showAdaparselDetail, lookupParams]);

  const locationLine = [summary.il, summary.ilce].filter(v => v !== '-').join(' / ');

  const formatDetailValue = (value?: string | null) => {
    if (value === null || value === undefined || String(value).trim() === '') return '-';
    return String(value).trim();
  };

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={['70%']}
      initialIndex={0}
      backgroundStyle={styles.sheetBackgroundDark}
      handleIndicatorStyle={styles.sheetHandleIndicatorDark}
      modalProps={{
        android_keyboardInputMode: 'adjustResize',
      }}
    >
      <BottomSheetScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: sheetScrollBottomPadding(insets?.bottom || 0, 16), flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
                {/* Üst Menü Bar */}
                <View style={styles.menuBar}>
                  <TouchableOpacity 
                    style={styles.menuButton} 
                    onPress={onGetDirections}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="directions" size={20} color="#fff" />
                    <Text style={styles.menuButtonText}>Yol Tarifi</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity 
                    style={styles.menuButton} 
                    onPress={onStreetView}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="google-street-view" size={20} color="#fff" />
                    <Text style={styles.menuButtonText}>Sokak Görüntüsü</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity 
                    style={[styles.menuButton, is3DMode && styles.menuButtonActive]} 
                    onPress={onToggle3D}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="terrain" size={20} color={is3DMode ? '#3b82f6' : '#fff'} />
                    <Text style={[styles.menuButtonText, is3DMode && styles.menuButtonTextActive]}>3D Harita</Text>
                  </TouchableOpacity>
                </View>

                {/* Toplam Fiyat - Tam Genişlik */}
                {summary.totalPriceText === '-' ? (
                  <TouchableOpacity 
                    style={styles.totalPriceCardPlaceholder}
                    onPress={() => {
                      onClose();
                      onSwitchToProMode?.();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="lock-closed" size={20} color="#3b82f6" style={{ marginBottom: 6 }} />
                    <Text style={styles.totalPricePlaceholderText}>Fiyat Görmek İçin Pro Sorgu Yap</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.totalPriceCard}>
                    <Text style={styles.totalPriceLabel}>TOPLAM FİYAT</Text>
                    <Text style={styles.totalPriceValue}>{summary.totalPriceText}</Text>
                    <Text style={styles.totalPriceHint}>{summary.unitPriceText} / m²</Text>
                  </View>
                )}

                {/* Bilgi Alanı - Screenshot Tasarımı */}
                <View style={styles.infoArea}>
                  {/* Üst: Konum Bilgisi */}
                  <View style={styles.headerInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationSubtitle}>{locationLine}</Text>
                      <Text style={styles.locationTitle} numberOfLines={1}>{summary.mahalle}</Text>
                    </View>
                    <View style={styles.nitelikBadge}>
                      <Text style={styles.nitelikText}>{summary.nitelik !== '-' ? summary.nitelik : 'ARSA/ARAZİ'}</Text>
                    </View>
                  </View>

                  {/* Orta: Veri Kutuları */}
                  <View style={styles.dataGrid}>
                    <View style={styles.dataBox}>
                      <Text style={styles.dataLabel}>ADA</Text>
                      <Text style={styles.dataValue}>{summary.ada}</Text>
                    </View>
                    
                    <View style={styles.dataBox}>
                      <Text style={styles.dataLabel}>PARSEL</Text>
                      <Text style={styles.dataValue}>{summary.parsel}</Text>
                    </View>
                    
                    <View style={[styles.dataBox, { flex: 1.4 }]}>
                      <Text style={styles.dataLabel}>ALAN</Text>
                      <Text style={styles.dataValue}>{summary.alan}</Text>
                    </View>
                  </View>

                  {summary.parcelShape !== '-' && (
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLabel}>PARSEL FORMU</Text>
                      <Text style={styles.metaValue}>{summary.parcelShape}</Text>
                    </View>
                  )}

                  {/* Alt: İnce Detay */}
                  <View style={styles.footer}>
                    <Text style={styles.footerText}>Taşınmaz Özet Bilgi Formu</Text>
                    <View style={styles.dot} />
                    <Text style={styles.footerText}>{new Date().toLocaleDateString('tr-TR')}</Text>
                  </View>
                </View>

                {showAdaparselDetail ? (
                  <View style={styles.adaparselSection}>
                    <Text style={styles.adaparselSectionTitle}>Tapu Kayıt Bilgisi</Text>
                    {adaparselLoading ? (
                      <View style={styles.adaparselSkeleton}>
                        <View style={styles.adaparselSkeletonLine} />
                        <View style={styles.adaparselSkeletonLine} />
                        <View style={[styles.adaparselSkeletonLine, { width: '60%' }]} />
                      </View>
                    ) : adaparselFound && adaparselDetail ? (
                      <View style={styles.adaparselRows}>
                        <View style={styles.adaparselRow}>
                          <Text style={styles.adaparselLabel}>Malik Adı</Text>
                          <Text style={styles.adaparselValue}>{formatDetailValue(adaparselDetail.Adi)}</Text>
                        </View>
                        <View style={styles.adaparselRow}>
                          <Text style={styles.adaparselLabel}>Hisse Pay</Text>
                          <Text style={styles.adaparselValue}>{formatDetailValue(adaparselDetail.HissePay)}</Text>
                        </View>
                        <View style={styles.adaparselRow}>
                          <Text style={styles.adaparselLabel}>Hisse Payda</Text>
                          <Text style={styles.adaparselValue}>{formatDetailValue(adaparselDetail.HissePayda)}</Text>
                        </View>
                        <View style={styles.adaparselRow}>
                          <Text style={styles.adaparselLabel}>Edinme Sebebi</Text>
                          <Text style={styles.adaparselValue}>{formatDetailValue(adaparselDetail.EdinmeSebebi)}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.adaparselEmpty}>Tapu kayıt bilgisi bulunamadı.</Text>
                    )}
                  </View>
                ) : null}

                {onShare ? (
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={onShare}
                    activeOpacity={0.7}
                    accessibilityLabel="Paylaş"
                  >
                    <Ionicons name="share-outline" size={20} color="#fff" />
                    <Text style={styles.shareButtonText}>Paylaş</Text>
                  </TouchableOpacity>
                ) : null}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  dismissArea: { ...StyleSheet.absoluteFillObject },
  modalContent: { 
    backgroundColor: '#1e293b', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    borderTopWidth: 4,
    borderTopColor: '#3b82f6',
    height: MODAL_HEIGHT, 
    paddingTop: 8 
  },
  sheetBackgroundDark: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 4,
    borderTopColor: '#3b82f6',
  },
  sheetHandleIndicatorDark: {
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    width: 44,
  },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(148, 163, 184, 0.4)', marginBottom: 8 },
  content: { padding: 20 },
  // Üst Menü Bar Stilleri
  menuBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 16,
    padding: 4,
  },
  menuButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    borderRadius: 8,
  },
  menuButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  menuButtonTextActive: {
    color: '#3b82f6',
  },
  menuDivider: {
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginVertical: 8,
  },
  // Toplam Fiyat Kartı - Tam Genişlik
  totalPriceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  totalPriceCardPlaceholder: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderStyle: 'dashed',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  totalPricePlaceholderText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  totalPriceLabel: {
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  totalPriceValue: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  totalPriceHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  // Eski stil referansları (kullanılmıyor ama uyumluluk için)
  priceRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  priceCard: { flex: 1, borderRadius: 18, padding: 14, borderWidth: 1 },
  priceCardUnit: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  priceCardTotal: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  priceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  priceLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  priceValue: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  priceHint: { fontSize: 12, color: '#475569', fontWeight: '600' },
  infoArea: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  nitelikBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  nitelikText: {
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: '900',
  },
  dataGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  dataBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  dataLabel: {
    color: '#3b82f6',
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 1,
  },
  dataValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  metaBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metaLabel: {
    color: '#3b82f6',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    opacity: 0.5,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '600',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#94a3b8',
    marginHorizontal: 8,
  },
  adaparselSection: {
    marginTop: 16,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  adaparselSectionTitle: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  adaparselRows: {
    gap: 10,
  },
  adaparselRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  adaparselLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  adaparselValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
  adaparselEmpty: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  adaparselSkeleton: {
    gap: 8,
  },
  adaparselSkeletonLine: {
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    width: '100%',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ParcelModal;
