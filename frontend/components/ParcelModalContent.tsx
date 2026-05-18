import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ProParcelResponse } from '../src/types/parcelResponse';
import { formatTurkishPrice, parseTurkishPrice } from '../src/utils/priceParser';

interface ParcelModalContentProps {
  properties: Record<string, any>;
  analysisData?: ProParcelResponse | null;
  isCompact?: boolean; // Compact mode için (screenshot için)
}

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

const formatPriceMaybe = (raw: any): string => {
  if (raw === null || raw === undefined) return '-';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return '-';
    const tl = t.toLowerCase();
    if (tl === 'none' || tl === 'null' || tl === 'undefined' || t === '-') return '-';
    if (tl.includes('tl') || t.includes('₺')) return t;
  }
  const parsed = parseTurkishPrice(raw as any);
  if (!parsed) return '-';
  return formatTurkishPrice(parsed);
};

export const ParcelModalContent: React.FC<ParcelModalContentProps> = ({ 
  properties, 
  analysisData, 
  isCompact = false 
}) => {
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
    const unitRaw = pickRaw(mergedProperties, PRICE_KEYS_UNIT);
    let totalRaw = pickRaw(mergedProperties, PRICE_KEYS_TOTAL);
    if (totalRaw === null) {
      const unitNum = parseTurkishPrice(unitRaw as any);
      const areaNum = parseAreaToNumber(alanRaw);
      if (unitNum > 0 && areaNum > 0) totalRaw = unitNum * areaNum;
    }
    return { il, ilce, mahalle, ada, parsel, alan, nitelik, mevkii, unitPriceText: formatPriceMaybe(unitRaw), totalPriceText: formatPriceMaybe(totalRaw) };
  }, [mergedProperties]);

  const containerStyle = isCompact 
    ? [styles.container, styles.containerCompact]
    : [styles.container, styles.containerA4];

  const contentStyle = isCompact ? styles.contentCompact : styles.contentA4;

  return (
    <View style={containerStyle}>
      <View style={[styles.content, contentStyle]}>
        {/* Konum Bölümü */}
        <View style={[styles.headerCard, isCompact && styles.headerCardCompact]}>
          <View style={styles.locationRow}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location" size={isCompact ? 20 : 24} color="#60a5fa" />
            </View>
            <View style={styles.locationTextContent}>
              <Text style={styles.locationLabel}>Konum Bilgisi</Text>
              <Text style={[styles.mahalleText, isCompact && styles.mahalleTextCompact]} numberOfLines={2}>
                {summary.mahalle}
              </Text>
              <Text style={[styles.cityTownText, isCompact && styles.cityTownTextCompact]}>
                {summary.il} / {summary.ilce}
              </Text>
            </View>
          </View>

          <View style={styles.headerCardDivider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Ada</Text>
                <Text style={styles.infoValue}>{summary.ada}</Text>
              </View>
              <View style={styles.infoCellDivider} />
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Parsel</Text>
                <Text style={styles.infoValue}>{summary.parsel}</Text>
              </View>
            </View>
            <View style={styles.infoRowSingle}>
              <Text style={styles.infoLabel}>Alan</Text>
              <Text style={styles.infoValue}>{summary.alan}</Text>
            </View>
            <View style={styles.longDash} />
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Mevkii</Text>
                <Text style={styles.infoValue}>{summary.mevkii}</Text>
              </View>
              <View style={styles.infoCellDivider} />
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Nitelik</Text>
                <Text style={styles.infoValue}>{summary.nitelik}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fiyat Bölümü */}
        <View style={styles.priceRow}>
          <View style={[styles.priceCard, styles.priceCardUnit]}>
            <View style={styles.priceHeader}>
              <Ionicons name="pricetag" size={isCompact ? 16 : 18} color="#1d4ed8" />
              <Text style={styles.priceLabel}>Birim Fiyat</Text>
            </View>
            <Text style={styles.priceValue}>{summary.unitPriceText}</Text>
            <Text style={styles.priceHint}>m² başına</Text>
          </View>
          <View style={[styles.priceCard, styles.priceCardTotal]}>
            <View style={styles.priceHeader}>
              <Ionicons name="cash" size={isCompact ? 16 : 18} color="#047857" />
              <Text style={styles.priceLabel}>Toplam Fiyat</Text>
            </View>
            <Text style={styles.priceValue}>{summary.totalPriceText}</Text>
            <Text style={styles.priceHint}>tahmini toplam</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  containerCompact: {
    backgroundColor: '#fff',
  },
  containerA4: {
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  content: {
    padding: 20,
  },
  contentCompact: {
    padding: 16,
  },
  contentA4: {
    padding: 20,
    // A4 formatında içerik - yeterli padding
  },
  headerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  headerCardCompact: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  locationTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  locationLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  mahalleText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '900',
    lineHeight: 26,
  },
  mahalleTextCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  cityTownText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  cityTownTextCompact: {
    fontSize: 12,
  },
  headerCardDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    marginVertical: 18,
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowSingle: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  infoCell: {
    flex: 1,
    alignItems: 'center',
  },
  infoCellDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
    marginHorizontal: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '800',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '900',
    textAlign: 'center',
  },
  longDash: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  priceCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  priceCardUnit: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  priceCardTotal: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  priceHint: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});
