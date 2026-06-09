/**
 * Combined Screenshot Container Component
 *
 * Harita + parsel bilgilerini birleştiren Kurumsal & Premium Tasarım
 */

import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import {
  getCombinedImageDimensions,
  prepareCaptureImageUri,
  CAPTURE_VIEW_SHOT_OPTIONS,
  CAPTURE_IMAGE_LOAD_TIMEOUT_MS,
  waitCaptureLayoutFrames,
  verifyCaptureFile,
} from '../../src/utils/screenshotManager';
import { parseTurkishPrice, formatTurkishPrice } from '../../src/utils/priceParser';
import {
  mergeParcelDisplayProperties,
  pickParcelDisplayValue,
  LOCATION_IL_KEYS,
  LOCATION_ILCE_KEYS,
  LOCATION_MAHALLE_KEYS,
} from '../../src/utils/mergeParcelDisplayProperties';
import { MapCaptureOverlayOnMap } from './MapCaptureOverlayOnMap';
import type { MapOverlayCapturePayload } from '../../src/utils/mapOverlayCaptureProjection';

export type CaptureWithMapUriOptions = {
  overlay?: MapOverlayCapturePayload | null;
  sourceViewport?: { width: number; height: number } | null;
  /** Arazi yok ve overlay yok → doğrudan mapUri (2. ViewShot yok) */
  skipViewShot?: boolean;
};

export type CombinedScreenshotCaptureRef = {
  capture: () => Promise<string>;
  captureWithMapUri: (mapUri: string, options?: CaptureWithMapUriOptions) => Promise<string>;
};

interface CombinedScreenshotContainerProps {
  capturedMapUri: string | null;
  parcelData: any;
  isProMode?: boolean;
  mapOnly?: boolean;
  priceOverride?: {
    unitPrice?: number | null;
    totalPrice?: number | null;
  } | null;
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

const formatPriceMaybe = (raw: any, allow: boolean): string => {
  if (!allow) return '-';
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

export const CombinedScreenshotContainer = React.forwardRef<
  CombinedScreenshotCaptureRef,
  CombinedScreenshotContainerProps
>(({
  capturedMapUri,
  parcelData,
  isProMode = false,
  mapOnly = false,
  priceOverride = null,
}, ref) => {
  const dimensions = getCombinedImageDimensions();
  const viewShotRef = useRef<ViewShot>(null);
  const [displayMapUri, setDisplayMapUri] = useState<string | null>(capturedMapUri);
  const [captureOverlay, setCaptureOverlay] = useState<MapOverlayCapturePayload | null>(null);
  const [captureSourceViewport, setCaptureSourceViewport] = useState<{ width: number; height: number } | null>(null);
  const imageReadyResolveRef = useRef<(() => void) | null>(null);

  React.useEffect(() => {
    setDisplayMapUri(capturedMapUri);
  }, [capturedMapUri]);

  const waitForDisplayedImage = useCallback(async (uri: string) => {
    await prepareCaptureImageUri(uri);
    await new Promise<void>((resolve) => {
      const finish = () => {
        imageReadyResolveRef.current = null;
        resolve();
      };
      imageReadyResolveRef.current = finish;
      setTimeout(finish, CAPTURE_IMAGE_LOAD_TIMEOUT_MS);
    });
  }, []);

  const runViewShotCapture = useCallback(async (): Promise<string> => {
    if (!viewShotRef.current?.capture) {
      throw new Error('ViewShot hazır değil');
    }
    const uri = await viewShotRef.current.capture();
    if (!uri) {
      throw new Error('Paylaşılacak görüntü bulunamadı');
    }
    return uri;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      capture: runViewShotCapture,
      captureWithMapUri: async (mapUri: string, options?: CaptureWithMapUriOptions) => {
        if (options?.skipViewShot) {
          const ok = await verifyCaptureFile(mapUri);
          if (!ok) throw new Error('Harita görüntüsü geçersiz');
          return mapUri;
        }

        setDisplayMapUri(mapUri);
        setCaptureOverlay(options?.overlay ?? null);
        setCaptureSourceViewport(options?.sourceViewport ?? null);
        await waitCaptureLayoutFrames(2);
        await waitForDisplayedImage(mapUri);
        return runViewShotCapture();
      },
    }),
    [runViewShotCapture, waitForDisplayedImage],
  );

  const handleMapImageLoad = useCallback(() => {
    imageReadyResolveRef.current?.();
    imageReadyResolveRef.current = null;
  }, []);

  const mapOverlayLayer = (
    <MapCaptureOverlayOnMap
      overlay={captureOverlay}
      width={dimensions.mapWidth}
      height={dimensions.mapHeight}
      sourceViewport={captureSourceViewport}
    />
  );

  if (mapOnly) {
    return (
      <ViewShot
        ref={viewShotRef}
        options={CAPTURE_VIEW_SHOT_OPTIONS}
        collapsable={false}
        style={{
          width: dimensions.totalWidth,
          height: dimensions.mapHeight,
          backgroundColor: '#0f172a',
          flexDirection: 'column',
        }}
      >
        <View style={{ width: dimensions.mapWidth, height: dimensions.mapHeight, backgroundColor: '#0f172a' }}>
          {displayMapUri ? (
            <Image
              source={{ uri: displayMapUri }}
              fadeDuration={0}
              onLoadEnd={handleMapImageLoad}
              style={{
                width: dimensions.mapWidth,
                height: dimensions.mapHeight,
                resizeMode: 'cover',
              }}
            />
          ) : null}
          {mapOverlayLayer}
        </View>
      </ViewShot>
    );
  }

  const mergedProperties = mergeParcelDisplayProperties(parcelData);

  const pickValue = (source: Record<string, any>, keys: readonly string[]): string =>
    pickParcelDisplayValue(source, keys);

  const formatArea = (value: any): string => {
    if (value === null || value === undefined || value === '') return '-';
    let n: number;
    if (typeof value === 'string') {
      const cleaned = String(value).trim();
      if (cleaned.includes(',')) {
        const withoutDots = cleaned.replace(/\./g, '');
        const withDot = withoutDots.replace(',', '.');
        n = Number(withDot);
      } else {
        n = Number(cleaned.replace(',', '.'));
      }
    } else {
      n = Number(value);
    }
    if (!Number.isFinite(n) || n <= 0) return '-';
    return `${Math.round(n).toLocaleString('tr-TR')} m²`;
  };

  const il = pickValue(mergedProperties, LOCATION_IL_KEYS);
  const ilce = pickValue(mergedProperties, LOCATION_ILCE_KEYS);
  const mahalle = pickValue(mergedProperties, LOCATION_MAHALLE_KEYS);
  const ada = pickValue(mergedProperties, ['adaNo', 'ada', 'Ada']);
  const parsel = pickValue(mergedProperties, ['parselNo', 'parsel', 'Parsel']);
  const alanRaw = mergedProperties.alan ?? mergedProperties.area ?? mergedProperties.Area ?? mergedProperties.area_m2 ?? null;
  const alan = formatArea(alanRaw);
  const nitelik = pickValue(mergedProperties, ['nitelik', 'Nitelik']);

  const areaNum = parseAreaToNumber(alanRaw);
  const allowPrices = Boolean(isProMode || priceOverride?.totalPrice || priceOverride?.unitPrice);

  const backendUnitRaw = pickRaw(mergedProperties, PRICE_KEYS_UNIT);
  const backendTotalRaw = pickRaw(mergedProperties, PRICE_KEYS_TOTAL);

  let unitRaw: any = (priceOverride?.unitPrice ?? null);
  let totalRaw: any = (priceOverride?.totalPrice ?? null);

  if ((totalRaw === null || totalRaw === undefined) && (unitRaw !== null && unitRaw !== undefined)) {
    const unitNum = Number(unitRaw);
    if (Number.isFinite(unitNum) && unitNum > 0 && areaNum > 0) totalRaw = unitNum * areaNum;
  }
  if ((unitRaw === null || unitRaw === undefined) && (totalRaw !== null && totalRaw !== undefined)) {
    const totalNum = Number(totalRaw);
    if (Number.isFinite(totalNum) && totalNum > 0 && areaNum > 0) unitRaw = totalNum / areaNum;
  }

  if (unitRaw === null || unitRaw === undefined) unitRaw = backendUnitRaw;
  if (totalRaw === null || totalRaw === undefined) totalRaw = backendTotalRaw;
  if (totalRaw === null) {
    const unitNum = parseTurkishPrice(unitRaw as any);
    if (unitNum > 0 && areaNum > 0) totalRaw = unitNum * areaNum;
  }

  const unitPriceText = formatPriceMaybe(unitRaw, allowPrices);
  const totalPriceText = formatPriceMaybe(totalRaw, allowPrices);

  const hasUserEnteredPrice = Boolean(
    priceOverride && (priceOverride.totalPrice !== null && priceOverride.totalPrice !== undefined
      || priceOverride.unitPrice !== null && priceOverride.unitPrice !== undefined)
  );

  const locationLine = [il, ilce].filter(v => v !== '-').join(' / ');

  return (
    <ViewShot
      ref={viewShotRef}
      options={CAPTURE_VIEW_SHOT_OPTIONS}
      collapsable={false}
      style={{
        width: dimensions.totalWidth,
        height: dimensions.height,
        backgroundColor: '#1e293b',
        flexDirection: 'column',
      }}
    >
      <View style={{ width: dimensions.mapWidth, height: dimensions.mapHeight, backgroundColor: '#0f172a' }}>
        {displayMapUri ? (
          <Image
            source={{ uri: displayMapUri }}
            fadeDuration={0}
            onLoadEnd={handleMapImageLoad}
            onError={() => {
              imageReadyResolveRef.current?.();
              imageReadyResolveRef.current = null;
            }}
            style={{
              width: dimensions.mapWidth,
              height: dimensions.mapHeight,
              resizeMode: 'cover',
            }}
          />
        ) : null}
        {mapOverlayLayer}
        <View style={styles.brandOverlay}>
          <Text style={styles.brandOverlayText}>PROPARCEL</Text>
        </View>

        <View style={styles.priceOverlay}>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>BİRİM FİYAT</Text>
            <Text style={styles.priceValue}>{unitPriceText}</Text>
          </View>

          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>TOPLAM FİYAT</Text>
            <Text style={styles.priceValue}>{totalPriceText}</Text>
          </View>
        </View>
      </View>

      <View style={{
        width: dimensions.modalWidth,
        height: dimensions.modalHeight,
        backgroundColor: '#1e293b',
        paddingHorizontal: 20,
        paddingVertical: 6,
        justifyContent: 'flex-start',
        borderTopWidth: 4,
        borderTopColor: '#3b82f6',
      }}>
        <View style={styles.headerInfo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationSubtitle}>{locationLine}</Text>
            <Text style={styles.locationTitle} numberOfLines={1}>{mahalle}</Text>
          </View>
          <View style={styles.nitelikBadge}>
            <Text style={styles.nitelikText}>{nitelik !== '-' ? nitelik : 'ARSA/ARAZİ'}</Text>
          </View>
        </View>

        <View style={styles.dataGrid}>
          <View style={styles.dataBox}>
            <Text style={styles.dataLabel}>ADA</Text>
            <Text style={styles.dataValue}>{ada}</Text>
          </View>

          <View style={styles.dataBox}>
            <Text style={styles.dataLabel}>PARSEL</Text>
            <Text style={styles.dataValue}>{parsel}</Text>
          </View>

          <View style={[styles.dataBox, { flex: 1.4 }]}>
            <Text style={styles.dataLabel}>ALAN</Text>
            <Text style={styles.dataValue}>{alan}</Text>
          </View>
        </View>

        {hasUserEnteredPrice && (
          <Text style={styles.userPriceWarning}>
            Fiyat bilgisi kullanıcı tarafından girilmiştir. Proparcel tahmini değildir!
          </Text>
        )}

        <View style={[styles.footer, { marginTop: 'auto' }]}>
          <Text style={styles.footerText}>Taşınmaz Özet Bilgi Formu</Text>
          <View style={styles.dot} />
          <Text style={styles.footerText}>{new Date().toLocaleDateString('tr-TR')}</Text>
        </View>
      </View>
    </ViewShot>
  );
});

CombinedScreenshotContainer.displayName = 'CombinedScreenshotContainer';

const styles = StyleSheet.create({
  brandOverlay: {
    position: 'absolute',
    top: 35,
    right: 15,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  brandOverlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
    marginTop: 0,
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
  priceOverlay: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
  },
  priceBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.6)',
    minWidth: 100,
  },
  priceLabel: {
    color: '#3b82f6',
    fontSize: 7,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.8,
  },
  priceValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  dataGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
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
  userPriceWarning: {
    marginTop: 6,
    color: '#fecaca',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
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
  }
});
