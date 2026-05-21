import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getKeyboardAvoidingBehavior, SCROLL_VIEW_KEYBOARD_PROPS } from '../../src/keyboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { VitrinListingSearchParams } from '../../src/types/vitrin';
import { stripVitrinParamsOverlappingMainScreen } from '../../src/utils/aranacaklarListingSearchExtra';

const COLORS = {
  bg: '#f8fafc',
  card: '#fff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  primary: '#2563eb',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  value: Partial<VitrinListingSearchParams>;
  onApply: (next: Partial<VitrinListingSearchParams>) => void;
};

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHead} onPress={onToggle}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.muted} />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function num(s: string): number | undefined {
  const n = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Son 30 gün / vitrin public search ile aynı parametreler — aranacak kişiye kayıt için.
 */
export default function AranacaklarVitrinFiltersSheet({ visible, onClose, value, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<Partial<VitrinListingSearchParams>>(() => ({ ...value }));
  const [openRoad, setOpenRoad] = useState(true);
  const [openScore, setOpenScore] = useState(false);
  const [openLand, setOpenLand] = useState(false);
  const [openNav, setOpenNav] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const [openFlags, setOpenFlags] = useState(false);

  useEffect(() => {
    if (visible) setP({ ...value });
  }, [visible, value]);

  const setField = (patch: Partial<VitrinListingSearchParams>) => {
    setP((cur) => ({ ...cur, ...patch }));
  };

  const apply = () => {
    onApply(stripVitrinParamsOverlappingMainScreen(p));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={getKeyboardAvoidingBehavior('modal')}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Vitrin filtreleri</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Seçtikleriniz ana ekranda kayda eklenir. «Talebe uygula» ile taslağı güncelleyin, ana ekrandan «Tümünü
            kaydet» ile kaydedin.
          </Text>
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps={SCROLL_VIEW_KEYBOARD_PROPS.keyboardShouldPersistTaps}
            keyboardDismissMode={SCROLL_VIEW_KEYBOARD_PROPS.keyboardDismissMode}
          >
            <CollapsibleSection title="Yola cephe (metre)" open={openRoad} onToggle={() => setOpenRoad((o) => !o)}>
              <Text style={styles.lbl}>En az / en çok (m)</Text>
              <View style={styles.row2}>
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.road_frontage_min_m != null ? String(p.road_frontage_min_m) : ''}
                  onChangeText={(t) => setField({ road_frontage_min_m: num(t) })}
                  placeholder="En az (m)"
                  placeholderTextColor={COLORS.muted}
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.road_frontage_max_m != null ? String(p.road_frontage_max_m) : ''}
                  onChangeText={(t) => setField({ road_frontage_max_m: num(t) })}
                  placeholder="En çok (m)"
                  placeholderTextColor={COLORS.muted}
                />
              </View>
            </CollapsibleSection>

            <CollapsibleSection title="Skorlar" open={openScore} onToggle={() => setOpenScore((o) => !o)}>
              <Text style={styles.lbl}>Genel puan — min / max (0–100)</Text>
              <View style={styles.row2}>
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.meta_min != null ? String(p.meta_min) : ''}
                  onChangeText={(t) => setField({ meta_min: num(t) })}
                  placeholder="Min."
                  placeholderTextColor={COLORS.muted}
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.meta_max != null ? String(p.meta_max) : ''}
                  onChangeText={(t) => setField({ meta_max: num(t) })}
                  placeholder="Max."
                  placeholderTextColor={COLORS.muted}
                />
              </View>
              <Text style={styles.lbl}>Mülk skoru (GM) — min / max</Text>
              <View style={styles.row2}>
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.investment_score_min != null ? String(p.investment_score_min) : ''}
                  onChangeText={(t) => setField({ investment_score_min: num(t) })}
                  placeholder="Min."
                  placeholderTextColor={COLORS.muted}
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.investment_score_max != null ? String(p.investment_score_max) : ''}
                  onChangeText={(t) => setField({ investment_score_max: num(t) })}
                  placeholder="Max."
                  placeholderTextColor={COLORS.muted}
                />
              </View>
              <Text style={styles.lbl}>Mahalle skoru — min / max</Text>
              <View style={styles.row2}>
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.quarter_score_min != null ? String(p.quarter_score_min) : ''}
                  onChangeText={(t) => setField({ quarter_score_min: num(t) })}
                  placeholder="Min."
                  placeholderTextColor={COLORS.muted}
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.quarter_score_max != null ? String(p.quarter_score_max) : ''}
                  onChangeText={(t) => setField({ quarter_score_max: num(t) })}
                  placeholder="Max."
                  placeholderTextColor={COLORS.muted}
                />
              </View>
              <Text style={styles.lbl}>Kullanıcı puanı (%) — min / max</Text>
              <View style={styles.row2}>
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.rating_score_min != null ? String(p.rating_score_min) : ''}
                  onChangeText={(t) => setField({ rating_score_min: num(t) })}
                  placeholder="Min."
                  placeholderTextColor={COLORS.muted}
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  keyboardType="numeric"
                  value={p.rating_score_max != null ? String(p.rating_score_max) : ''}
                  onChangeText={(t) => setField({ rating_score_max: num(t) })}
                  placeholder="Max."
                  placeholderTextColor={COLORS.muted}
                />
              </View>
            </CollapsibleSection>

            <CollapsibleSection title="Arazi altyapısı" open={openLand} onToggle={() => setOpenLand((o) => !o)}>
              <Text style={styles.lbl}>Yol (1: var, 0: yok, boş: fark etmez)</Text>
              <TextInput
                style={styles.input}
                value={p.listing_has_road || ''}
                onChangeText={(t) => setField({ listing_has_road: t || undefined })}
                placeholder="1 veya 0"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>Su (1: var, 0: yok)</Text>
              <TextInput
                style={styles.input}
                value={p.listing_has_water || ''}
                onChangeText={(t) => setField({ listing_has_water: t || undefined })}
                placeholder="1 veya 0"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>Elektrik hattı (1: var, 0: yok)</Text>
              <TextInput
                style={styles.input}
                value={p.listing_has_power_line || ''}
                onChangeText={(t) => setField({ listing_has_power_line: t || undefined })}
                placeholder="1 veya 0"
                placeholderTextColor={COLORS.muted}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Merkeze rota mesafesi (metre)" open={openNav} onToggle={() => setOpenNav((o) => !o)}>
              <Text style={styles.lbl}>İl merkezine en fazla (m)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={p.max_nav_city_m != null ? String(p.max_nav_city_m) : ''}
                onChangeText={(t) => setField({ max_nav_city_m: num(t) })}
                placeholder="Üst sınır (m)"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>İlçe merkezine en fazla (m)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={p.max_nav_town_m != null ? String(p.max_nav_town_m) : ''}
                onChangeText={(t) => setField({ max_nav_town_m: num(t) })}
                placeholder="Üst sınır (m)"
                placeholderTextColor={COLORS.muted}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Sıralama" open={openSort} onToggle={() => setOpenSort((o) => !o)}>
              <Text style={styles.lbl}>Sıralama alanı</Text>
              <TextInput
                style={styles.input}
                value={p.sort_by || ''}
                onChangeText={(t) => setField({ sort_by: t || undefined })}
                placeholder="Örn. meta, price, rating"
                autoCapitalize="none"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>Yön (artan / azalan)</Text>
              <TextInput
                style={styles.input}
                value={p.sort_dir || ''}
                onChangeText={(t) => setField({ sort_dir: (t === 'asc' ? 'asc' : t === 'desc' ? 'desc' : undefined) })}
                placeholder="asc veya desc"
                placeholderTextColor={COLORS.muted}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Diğer seçenekler" open={openFlags} onToggle={() => setOpenFlags((o) => !o)}>
              <Text style={styles.lbl}>Uzman yanıtı verilmiş (1 = evet)</Text>
              <TextInput
                style={styles.input}
                value={p.expert_answered || ''}
                onChangeText={(t) => setField({ expert_answered: t || undefined })}
                placeholder="1"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>Sadece fiyat avantajı (1 = evet)</Text>
              <TextInput
                style={styles.input}
                value={p.price_advantage_only || ''}
                onChangeText={(t) => setField({ price_advantage_only: t || undefined })}
                placeholder="1"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>Hisseli (1: evet, 0: hayır)</Text>
              <TextInput
                style={styles.input}
                value={p.hisseli || ''}
                onChangeText={(t) => setField({ hisseli: t || undefined })}
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.lbl}>İlan özellikleri (JSON metni)</Text>
              <TextInput
                style={[styles.input, styles.tall]}
                multiline
                value={p.listing_attr || ''}
                onChangeText={(t) => setField({ listing_attr: t.trim() ? t : undefined })}
                autoCapitalize="none"
                placeholderTextColor={COLORS.muted}
              />
            </CollapsibleSection>
          </ScrollView>

          <Pressable style={styles.applyBtn} onPress={apply}>
            <Text style={styles.applyBtnText}>Uygula</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.muted, paddingHorizontal: 16, marginBottom: 8 },
  scroll: { maxHeight: 520, paddingHorizontal: 16 },
  section: { marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sectionBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  lbl: { fontSize: 11, color: COLORS.muted, marginTop: 4, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
  },
  tall: { minHeight: 72, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  half: { flex: 1 },
  applyBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
