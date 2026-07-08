import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import type { TkgmViewResponse } from '../src/types/parcelResponse';
import { sheetModalBottomInset, sheetScrollBottomPadding } from '../src/utils/sheetSafeArea';
import { formatParcelAreaDisplay, pickParcelAreaRaw } from '../src/utils/dfaRows';
import {
  quarterVerificationStatusLabel,
  type QuarterPriceVerificationStatusResponse,
  type QuarterVerificationPropertyKey,
  type QuarterVerificationStatus,
} from '../src/utils/quarterPriceVerification';
import { fetchQuarterPriceVerificationStatus } from '../services/quarterPriceVerificationService';

type Props = {
  visible: boolean;
  tkgmData: TkgmViewResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** 403 feature_locked — upgrade / abonelik UX */
  onFeatureLocked?: () => void;
};

const SHEET_EXPANDED_HEIGHT = 420;
const SHEET_LOWER_OFFSET = 40;

const PROPERTY_ROWS: { key: QuarterVerificationPropertyKey; label: string }[] = [
  { key: 'arsa', label: 'Arsa' },
  { key: 'tarla', label: 'Tarla' },
  { key: 'ticari', label: 'Ticari' },
];

function pickValue(source: Record<string, any> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = source?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function statusChipStyle(status: string | null | undefined) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'verified') {
    return { text: '#15803d', bg: '#dcfce7', border: '#86efac' };
  }
  if (s === 'unverified') {
    return { text: '#c2410c', bg: '#ffedd5', border: '#fdba74' };
  }
  if (s === 'missing') {
    return { text: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
  }
  return { text: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
}

export const QuarterPriceVerificationModal: React.FC<Props> = ({
  visible,
  tkgmData,
  onConfirm,
  onCancel,
  onFeatureLocked,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<QuarterPriceVerificationStatusResponse | null>(
    null
  );
  const [fetchFailed, setFetchFailed] = useState(false);

  const bottomInset = useMemo(
    () => Math.max(0, sheetModalBottomInset(insets?.bottom || 0) - SHEET_LOWER_OFFSET),
    [insets?.bottom]
  );

  const snapPoints = useMemo(
    () => [SHEET_EXPANDED_HEIGHT + sheetScrollBottomPadding(insets?.bottom || 0, 20)],
    [insets?.bottom]
  );

  const modalProps = useMemo(
    () => ({
      bottomInset,
      ...(Platform.OS === 'ios'
        ? { containerStyle: { marginBottom: -SHEET_LOWER_OFFSET } }
        : null),
    }),
    [bottomInset]
  );

  const content = useMemo(() => {
    const props = (tkgmData as any)?.properties || {};
    const il = pickValue(props, ['ilAd', 'il', 'cityName', 'CityName']);
    const ilce = pickValue(props, ['ilceAd', 'ilce', 'townName', 'TownName']);
    const mahalle = pickValue(props, ['mahalleAd', 'mahalle', 'quarterName', 'QuarterName']);
    const ada = pickValue(props, ['adaNo', 'ada', 'Ada']);
    const parsel = pickValue(props, ['parselNo', 'parsel', 'Parsel']);
    const alanRaw =
      pickParcelAreaRaw(props) ?? pickParcelAreaRaw(tkgmData as Record<string, unknown>);
    const alan = formatParcelAreaDisplay(alanRaw);
    const row1 = [il, ilce, mahalle].filter(Boolean).join(' / ');
    const row2Left = ada && parsel ? `${ada}/${parsel}` : ada || parsel || '';
    const row2 = [row2Left, alan].filter(Boolean).join(' • ');
    return { row1, row2 };
  }, [tkgmData]);

  useEffect(() => {
    if (!visible || !tkgmData) {
      setLoading(false);
      setStatusData(null);
      setFetchFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStatusData(null);
    setFetchFailed(false);

    void (async () => {
      const result = await fetchQuarterPriceVerificationStatus(tkgmData);
      if (cancelled) return;
      if (result.ok) {
        setStatusData(result.data);
        setFetchFailed(false);
      } else {
        setStatusData(null);
        setFetchFailed(true);
        if (result.featureLocked) {
          onFeatureLocked?.();
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // onFeatureLocked kimliği değişince yeniden fetch etme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tkgmData]);

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={() => {}}
      snapPoints={snapPoints}
      initialIndex={0}
      enablePanDownToClose={false}
      backdropOpacity={0}
      enableBackdropTouchThrough
      backdropPressBehavior="none"
      modalProps={modalProps}
    >
      <View
        style={[
          styles.content,
          { paddingBottom: sheetScrollBottomPadding(insets?.bottom || 0, 20) },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Doğrulama Durumu</Text>
          <Text style={styles.subTitle}>{content.row1 || '-'}</Text>
          <Text style={styles.subTitle}>{content.row2 || '-'}</Text>
        </View>

        <View style={styles.statusBox}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingText}>Kontrol ediliyor…</Text>
            </View>
          ) : fetchFailed ? (
            <Text style={styles.errorText}>Durum alınamadı</Text>
          ) : (
            PROPERTY_ROWS.map(({ key, label }) => {
              const rawStatus = statusData?.properties?.[key]?.status as
                | QuarterVerificationStatus
                | string
                | undefined;
              const chip = statusChipStyle(rawStatus ?? (fetchFailed ? null : 'missing'));
              return (
                <View key={key} style={styles.statusRow}>
                  <Text style={styles.statusLabel}>{label}</Text>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: chip.bg, borderColor: chip.border },
                    ]}
                  >
                    <Text style={[styles.statusChipText, { color: chip.text }]}>
                      {quarterVerificationStatusLabel(rawStatus ?? 'missing')}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.cancelText]}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.confirmText]}>Devam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppBottomSheetModal>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 20,
  },
  statusBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    minHeight: 120,
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cancelText: {
    color: '#334155',
  },
  confirmText: {
    color: '#ffffff',
  },
});
