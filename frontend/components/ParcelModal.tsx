import React, { useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

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

const parseAreaToNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).replace(/\s/g, '').replace(/m²|m2/gi, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const formatArea = (value: any): string => {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(n)) return `${String(value)} m²`;
  return `${n.toLocaleString('tr-TR')} m²`;
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
}) => {
  const insets = useSafeAreaInsets();

  const mergedProperties = useMemo(() => {
    const parametersData: any = analysisData?.parameters_data || {};
    const parcelValues = parametersData?.parcel_values || {};
    return { ...properties, ...parametersData, ...parcelValues };
  }, [properties, analysisData]);

  const summary = useMemo(() => {
    const il = pickValue(mergedProperties, ['ilAd', 'il', 'city', 'city_name', 'cityName', 'CityName']);
    const ilce = pickValue(mergedProperties, ['ilceAd', 'ilce', 'town', 'town_name', 'townName', 'TownName']);
    const mahalle = pickValue(mergedProperties, ['mahalleAd', 'mahalle', 'quarter', 'quarter_name', 'QuarterName']);
    const ada = pickValue(mergedProperties, ['adaNo', 'ada', 'Ada']);
    const parsel = pickValue(mergedProperties, ['parselNo', 'parsel', 'Parsel']);
    const alanRaw = mergedProperties.alan ?? mergedProperties.area ?? mergedProperties.Area ?? mergedProperties.area_m2;
    const alan = formatArea(alanRaw);
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
      const areaNum = parseAreaToNumber(alanRaw);
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

  const locationLine = [summary.il, summary.ilce].filter(v => v !== '-').join(' / ');

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
        contentContainerStyle={{ paddingBottom: 16 + (insets?.bottom || 0), flexGrow: 1 }}
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
});

export default ParcelModal;
