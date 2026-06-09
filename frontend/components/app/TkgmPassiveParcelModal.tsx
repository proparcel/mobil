/**
 * TKGM pasif / toplulaştırılmış parsel bilgilendirme modalı (mobil).
 *
 * Web referansı: myapp/static/js/utils/tkgm_passive_parcel.js (showPassiveParcelModal).
 * Sorgulanan (pasif) parsel ile gittiği (aktif) parsel bilgilerini gösterir.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type {
  PassiveParcelInfo,
  PassiveParcelRowProps,
} from '../../src/utils/tkgmPassiveParcel';
import { durumLabel } from '../../src/utils/tkgmPassiveParcel';

interface TkgmPassiveParcelModalProps {
  visible: boolean;
  info: PassiveParcelInfo | null;
  onClose: () => void;
}

function toText(value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  return s;
}

type RowItem = { label: string; value: string };

function buildRows(props: PassiveParcelRowProps): RowItem[] {
  const ada = toText(props.adaNo ?? props.ada);
  const parsel = toText(props.parselNo ?? props.parsel);
  const adaParsel = [ada, parsel].filter(Boolean).join(' / ');
  const alanRaw = toText(props.alan);
  const items: RowItem[] = [
    { label: 'İl', value: toText(props.ilAd ?? props.il) },
    { label: 'İlçe', value: toText(props.ilceAd ?? props.ilce) },
    { label: 'Mahalle', value: toText(props.mahalleAd ?? props.mahalle) },
    { label: 'Ada / Parsel', value: adaParsel },
    { label: 'Özet', value: toText(props.ozet) },
    { label: 'Durum', value: props.durumLabel || durumLabel(props.durum) },
    { label: 'Alan', value: alanRaw ? `${alanRaw} m²` : '' },
    { label: 'Nitelik', value: toText(props.nitelik) },
    { label: 'Pafta', value: toText(props.pafta) },
  ];
  return items.filter((it) => it.value !== '');
}

function Section({ title, props }: { title: string; props: PassiveParcelRowProps }) {
  const rows = buildRows(props);
  if (!rows.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rows}>
        {rows.map((it, idx) => (
          <View key={it.label} style={[styles.row, idx === 0 && styles.rowFirst]}>
            <Text style={styles.rowLabel}>{it.label}</Text>
            <Text style={styles.rowValue}>{it.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const TkgmPassiveParcelModal: React.FC<TkgmPassiveParcelModalProps> = ({
  visible,
  info,
  onClose,
}) => {
  return (
    <Modal
      visible={visible && !!info}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Parsel pasif / toplulaştırılmış</Text>
            <Text style={styles.sub}>
              Sorguladığınız ada-parsel TKGM'de pasif durumdadır. Haritada gittiği aktif
              parsel kullanılacaktır.
            </Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {info?.sourceProps ? (
              <Section title="Sorgulanan parsel (pasif kayıt)" props={info.sourceProps} />
            ) : null}

            {(info?.destinations || []).map((dest, idx) => {
              const title =
                (info?.destinations.length || 0) > 1
                  ? `Gittiği parsel ${idx + 1}`
                  : 'Gittiği parsel (aktif kayıt)';
              return <Section key={`dest-${idx}`} title={title} props={dest} />;
            })}

            {info?.sebep ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Değişiklik sebebi</Text>
                <View style={styles.rows}>
                  <View style={[styles.row, styles.rowFirst]}>
                    <Text style={styles.rowLabel}>Açıklama</Text>
                    <Text style={styles.rowValue}>{info.sebep}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.foot}>
            <TouchableOpacity style={styles.okBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.okBtnText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default TkgmPassiveParcelModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  head: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  rows: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowLabel: {
    flexBasis: '42%',
    maxWidth: '42%',
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  rowValue: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
  },
  foot: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  okBtn: {
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  okBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
