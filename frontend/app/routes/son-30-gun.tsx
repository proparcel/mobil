import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  RefreshControl,
  StatusBar,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppBottomSheetModal from '../../components/app/AppBottomSheetModal';
import { useRouter } from '../../src/hooks/useNavigation';
import { useAuth } from '../contexts/AuthContext';
import {
  getPortalLocations,
  getPortalRecentQueries,
  getPublicListingAttributeSchema,
  getPublicListingCategories,
  type PublicListingAttributeField,
  type PublicListingAttributeSchema,
  type PublicListingCategoryNode,
} from '../../services/portalService';
import type {
  PortalLocationItem,
  PortalQueryListItem,
  PortalQueryListParams,
} from '../../src/types/portal';
import UserMenuModal from '../../components/app/UserMenuModal';
import { useRoute } from '@react-navigation/native';
import { API_URL } from '../../config/api';
import { getPublicVitrinListings } from '../../services/vitrinSearchService';
import type { VitrinListingItem, VitrinListingSearchParams } from '../../src/types/vitrin';
import { isLandCategoryFiltersForListing, mapPortalQueryTypeToListingCategory } from '../../src/utils/portalListingCategory';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Constants ──

const COLORS = {
  headerBg: '#1e293b',
  accentBlue: '#3b82f6',
  accentGreen: '#22c55e',
  pageBg: '#f8fafc',
  cardBg: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  dangerRed: '#ef4444',
  warningOrange: '#f59e0b',
  actionBarBg: '#1e293b',
  chipBg: 'rgba(255,255,255,0.08)',
  chipBorder: 'rgba(255,255,255,0.18)',
  chipActiveBg: '#3b82f6',
} as const;

const PAGE_SIZE = 20;

const QUERY_TYPE_LABELS: Record<string, string> = {
  arsa: 'Arsa',
  tarla: 'Tarla',
  villa: 'Villa',
  fabrika: 'Fabrika',
  bina: 'Bina',
  konut: 'Konut',
  mustakil_ev: 'Müstakil Ev',
  ciftlik_ev: 'Çiftlik Evi',
};

const SORT_FIELD_OPTIONS = [
  { value: '', label: 'Varsayılan (tarih)' },
  { value: 'date_desc', label: 'En Yeni' },
  { value: 'date_asc', label: 'En Eski Tarih' },
  { value: 'price', label: 'Fiyata göre' },
  { value: 'unit_price', label: 'Birim fiyata göre' },
  { value: 'rating', label: 'Kullanıcı puanı' },
  { value: 'comment', label: 'Yorum sayısı' },
  { value: 'expert', label: 'Uzman yanıtı' },
  { value: 'gm', label: 'Mülk skoru (GM)' },
  { value: 'meta', label: 'Genel puan (yıldız)' },
];

const SORT_DIR_OPTIONS = [
  { value: 'desc', label: 'Azalan' },
  { value: 'asc', label: 'Artan' },
];

const QUERY_API_SORT_FIELDS = new Set(['price', 'unit_price', 'rating', 'comment', 'expert', 'gm', 'meta']);
const LISTING_API_SORT_FIELDS = new Set(['rating', 'comment', 'gm', 'meta', 'expert']);

const LAND_INFRA_TRI_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: '1', label: 'Evet' },
  { value: '0', label: 'Hayır' },
];

function getModeAccent(listMode: ListMode) {
  if (listMode === 'ilanlar') {
    return {
      strong: '#e6c800',
      text: '#0f172a',
      softBg: '#fff9db',
      softBorder: '#e6c800',
      segBg: '#ffde00',
      segBorder: '#e6c800',
    };
  }
  return {
    strong: COLORS.accentBlue,
    text: COLORS.accentBlue,
    softBg: '#eff6ff',
    softBorder: '#bfdbfe',
    segBg: COLORS.accentBlue + '12',
    segBorder: COLORS.accentBlue + '55',
  };
}

// ── Helpers ──

/** Web `PortalRecentQueriesApp` ile aynı anahtar — portal son 30 gün için son seçilen il */
const PORTAL_RECENT_CITY_STORAGE_KEY = 'pp.portal.recentQueries.lastCityId';

async function getStoredPortalRecentCityId(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(PORTAL_RECENT_CITY_STORAGE_KEY);
    return String(v || '').trim();
  } catch {
    return '';
  }
}

async function setStoredPortalRecentCityId(cityId: string): Promise<void> {
  const normalized = String(cityId || '').trim();
  if (!normalized) return;
  try {
    await AsyncStorage.setItem(PORTAL_RECENT_CITY_STORAGE_KEY, normalized);
  } catch {
    // localStorage erişilemiyorsa sessizce devam (web ile aynı)
  }
}

/** Web `pickDefaultCity` ile aynı: önce tercih edilen id, yoksa `count` en yüksek il */
function pickDefaultCityForPortalList(
  cities: PortalLocationItem[],
  preferredCityId: string,
): { city: PortalLocationItem | null; source: string } {
  const rows = Array.isArray(cities) ? cities : [];
  const preferred = String(preferredCityId || '').trim();
  if (preferred) {
    const matched = rows.find((city) => String(city?.id) === preferred);
    if (matched) return { city: matched, source: 'stored' };
  }
  if (!rows.length) return { city: null, source: '' };
  const topCity = rows.reduce((best, current) => {
    const currentCount = Number(current?.count) || 0;
    const bestCount = Number(best?.count) || 0;
    return currentCount > bestCount ? current : best;
  }, rows[0]);
  return { city: topCity || null, source: topCity ? 'popular' : '' };
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

function formatArea(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' m²';
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  } catch {
    return '—';
  }
}

function numOrEmpty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return String(n);
}

function parseOptFloat(s: string): number | undefined {
  const t = (s || '').trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Şehir / ilçe merkezine rota (m → km); web `formatNavRouteKm` ile uyumlu */
function formatNavRouteKm(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(Number(meters))) return '—';
  const km = Number(meters) / 1000;
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(km)} km`;
}

// ── Filter Bottom-Sheet Picker Row ──

interface FilterPickerItem { value: string | number; label: string }

/** Şehir / ilçe merkezine gidiş rotası — üst sınır (m); web vitrin / Son 30 ile uyumlu */
const NAV_ROUTE_MAX_OPTIONS: FilterPickerItem[] = [
  { value: '', label: 'Tümü' },
  { value: '5000', label: '≤ 5 km' },
  { value: '10000', label: '≤ 10 km' },
  { value: '15000', label: '≤ 15 km' },
  { value: '20000', label: '≤ 20 km' },
  { value: '30000', label: '≤ 30 km' },
  { value: '50000', label: '≤ 50 km' },
];

/** Web portal ile uyumlu: "N yıldız ve altı" üst sınır seçenekleri. */
const STAR_SCORE_MAX_OPTIONS: FilterPickerItem[] = [
  { value: '', label: 'Tümü' },
  { value: '20', label: '1 yıldız ve altı' },
  { value: '40', label: '2 yıldız ve altı' },
  { value: '60', label: '3 yıldız ve altı' },
  { value: '80', label: '4 yıldız ve altı' },
  { value: '100', label: '5 yıldız ve altı' },
];

function normalizeStarScoreMaxChoice(value: unknown): string {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const n = Math.min(100, Math.max(0, Number(value)));
  const match = [20, 40, 60, 80, 100].find((threshold) => n <= threshold);
  return match != null ? String(match) : '100';
}

function compareNullableNumbers(a: number | null | undefined, b: number | null | undefined, dir: 1 | -1): number {
  const aNull = a == null || Number.isNaN(Number(a));
  const bNull = b == null || Number.isNaN(Number(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return (Number(a) - Number(b)) * dir;
}

function compareNullableDateStrings(a: string | null | undefined, b: string | null | undefined, dir: 1 | -1): number {
  const ta = a ? Date.parse(a) : Number.NaN;
  const tb = b ? Date.parse(b) : Number.NaN;
  const aNull = Number.isNaN(ta);
  const bNull = Number.isNaN(tb);
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return (ta - tb) * dir;
}

function getListingUnitPrice(item: VitrinListingItem): number | null {
  const price = item.price_amount;
  const area = item.area_m2;
  if (price == null || area == null || Number.isNaN(Number(price)) || Number.isNaN(Number(area)) || Number(area) <= 0) {
    return null;
  }
  return Number(price) / Number(area);
}

function FilterPickerRow({
  label,
  items,
  selectedValue,
  onSelect,
  loading,
  disabled,
}: {
  label: string;
  items: FilterPickerItem[];
  selectedValue: string | number | null;
  onSelect: (v: string | number | null) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === selectedValue);

  return (
    <View style={filterRowStyles.container}>
      {label ? <Text style={filterRowStyles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[filterRowStyles.button, disabled && filterRowStyles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : (
          <>
            <Text
              style={[filterRowStyles.buttonText, !selected && filterRowStyles.placeholder]}
              numberOfLines={1}
            >
              {selected ? selected.label : 'Seçin...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={filterRowStyles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={filterRowStyles.modalSheet}>
            <View style={filterRowStyles.modalHandle} />
            <Text style={filterRowStyles.modalTitle}>{label}</Text>
            <ScrollView style={filterRowStyles.modalScroll} bounces={false}>
              {items.map((item, idx) => {
                const isActive = selectedValue === item.value;
                return (
                  <TouchableOpacity
                    key={item.value != null ? String(item.value) : `opt-${idx}`}
                    style={[filterRowStyles.modalItem, isActive && filterRowStyles.modalItemActive]}
                    onPress={() => { onSelect(item.value || null); setOpen(false); }}
                  >
                    <Text style={[filterRowStyles.modalItemText, isActive && filterRowStyles.modalItemTextActive]}>
                      {item.label}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={COLORS.accentBlue} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const filterRowStyles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  disabled: { opacity: 0.4 },
  buttonText: { fontSize: 14, color: COLORS.textPrimary, flex: 1, marginRight: 4 },
  placeholder: { color: COLORS.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    maxHeight: '70%',
    paddingBottom: 30,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft },
  modalScroll: { flex: 1, paddingHorizontal: 8 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderSoft },
  modalItemActive: { backgroundColor: '#eff6ff' },
  modalItemText: { fontSize: 14, color: COLORS.textPrimary },
  modalItemTextActive: { color: COLORS.accentBlue, fontWeight: '600' },
});

function splitCsvIds(value?: string | null): string[] {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseListingAttrJson(raw: string): Record<string, unknown> {
  const s = String(raw || '').trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

function compactListingAttr(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const range = value as { min?: unknown; max?: unknown; eq?: unknown };
      const hasMin = range.min !== '' && range.min != null;
      const hasMax = range.max !== '' && range.max != null;
      const hasEq = range.eq !== '' && range.eq != null;
      if (!hasMin && !hasMax && !hasEq) return;
      if (hasEq && !hasMin && !hasMax) {
        out[key] = range.eq as string | number | boolean;
        return;
      }
      const nextRange: Record<string, number> = {};
      if (hasMin) {
        const minNum = typeof range.min === 'number' ? range.min : Number(range.min);
        if (!Number.isNaN(minNum)) nextRange.min = minNum;
      }
      if (hasMax) {
        const maxNum = typeof range.max === 'number' ? range.max : Number(range.max);
        if (!Number.isNaN(maxNum)) nextRange.max = maxNum;
      }
      if (Object.keys(nextRange).length) out[key] = nextRange;
      return;
    }
    out[key] = value;
  });
  return out;
}

function serializeListingAttr(obj: Record<string, unknown>): string {
  const compact = compactListingAttr(obj);
  return Object.keys(compact).length ? JSON.stringify(compact) : '';
}

function isDynamicAttrFieldVisible(
  field: PublicListingAttributeField,
  listingAttributes: Record<string, unknown>,
): boolean {
  const rule = field.visible_when;
  if (!rule?.field) return true;
  const current = listingAttributes[rule.field];
  const currentStr = String(current ?? '');
  if (rule.equals !== undefined) return currentStr === String(rule.equals);
  if (Array.isArray(rule.not_in) && rule.not_in.length) {
    const blocked = new Set(rule.not_in.map((value) => String(value)));
    return !blocked.has(currentStr);
  }
  return true;
}

function isChoiceField(field: PublicListingAttributeField): boolean {
  return Array.isArray(field.choices) && field.choices.length > 0;
}

function mergeSpecificFieldsFromSchemas(schemas: PublicListingAttributeSchema[]): PublicListingAttributeField[] {
  const byKey = new Map<string, PublicListingAttributeField>();
  const order: string[] = [];
  for (const schema of schemas) {
    if (!schema || !Array.isArray(schema.fields) || !Array.isArray(schema.specific_field_keys)) continue;
    const specific = new Set(schema.specific_field_keys);
    for (const field of schema.fields) {
      const key = field?.key;
      if (!key || !specific.has(key)) continue;
      if (field.binding && field.binding !== 'listing_attributes') continue;
      if (!byKey.has(key)) {
        byKey.set(key, field);
        order.push(key);
      }
    }
  }
  return order.map((key) => byKey.get(key)).filter(Boolean) as PublicListingAttributeField[];
}

async function collectLeafIdsForAttrFilters(selection: {
  categoryMain?: string;
  categoryTypeIds?: string[];
  categoryLeafIds?: string[];
}): Promise<string[]> {
  const leaves = new Set((selection.categoryLeafIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const branches = (selection.categoryTypeIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  const main = String(selection.categoryMain || '').trim();

  async function walk(parentId: string) {
    const res = await getPublicListingCategories({ parentId });
    if (!res.ok) throw new Error(res.error || 'Kategori ağacı yüklenemedi');
    for (const node of res.data.nodes || []) {
      if (node.is_leaf) leaves.add(node.id);
      else await walk(node.id);
    }
  }

  for (const branchId of branches) {
    await walk(branchId);
  }
  if (main && !branches.length && leaves.size === 0) {
    await walk(main);
  }
  return [...leaves];
}

function CategoryTreeFilter({
  rootNodes,
  childNodesByRoot,
  loading,
  listMode,
  expandedRootId,
  selectedMainId,
  selectedBranchIds,
  selectedLeafIds,
  onReset,
  onToggleRoot,
  onSelectMain,
  onToggleChild,
}: {
  rootNodes: PublicListingCategoryNode[];
  childNodesByRoot: Record<string, PublicListingCategoryNode[]>;
  loading?: boolean;
  listMode: ListMode;
  expandedRootId: string | null;
  selectedMainId: string;
  selectedBranchIds: string[];
  selectedLeafIds: string[];
  onReset: () => void;
  onToggleRoot: (rootId: string) => void;
  onSelectMain: (rootId: string) => void;
  onToggleChild: (node: PublicListingCategoryNode, rootId: string) => void;
}) {
  const accent = getModeAccent(listMode);
  const selectedBranches = new Set(selectedBranchIds);
  const selectedLeaves = new Set(selectedLeafIds);
  const hasAnySelection = Boolean(selectedMainId || selectedBranchIds.length || selectedLeafIds.length);

  return (
    <View style={categoryTreeStyles.container}>
      <Text style={categoryTreeStyles.label}>İlan Türü</Text>
      <TouchableOpacity
        style={[
          categoryTreeStyles.resetRow,
          !hasAnySelection && { borderColor: accent.softBorder, backgroundColor: accent.softBg },
        ]}
        onPress={onReset}
        activeOpacity={0.75}
      >
        <Ionicons
          name={!hasAnySelection ? 'checkbox' : 'square-outline'}
          size={18}
          color={!hasAnySelection ? accent.strong : COLORS.textSecondary}
        />
        <Text style={[categoryTreeStyles.resetText, !hasAnySelection && { color: accent.text, fontWeight: '700' }]}>Tümü</Text>
      </TouchableOpacity>
      {loading ? (
        <View style={categoryTreeStyles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        </View>
      ) : (
        rootNodes.map((root) => {
          const expanded = expandedRootId === root.id;
          const mainSelected = selectedMainId === root.id && selectedBranchIds.length === 0 && selectedLeafIds.length === 0;
          return (
            <View key={root.id} style={categoryTreeStyles.rootBlock}>
              <View
                style={[
                  categoryTreeStyles.rootRow,
                  mainSelected && { borderColor: accent.softBorder, backgroundColor: accent.softBg },
                ]}
              >
                <TouchableOpacity
                  style={categoryTreeStyles.rootSelectArea}
                  onPress={() => onSelectMain(root.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={mainSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={mainSelected ? accent.strong : COLORS.textSecondary}
                  />
                  <Text style={[categoryTreeStyles.rootText, mainSelected && { color: accent.text }]}>
                    {root.label}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={categoryTreeStyles.rootExpandBtn}
                  onPress={() => onToggleRoot(root.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {expanded ? (
                <View style={categoryTreeStyles.childList}>
                  {(childNodesByRoot[root.id] || []).map((node) => {
                    const checked = node.is_leaf ? selectedLeaves.has(node.id) : selectedBranches.has(node.id);
                    return (
                      <TouchableOpacity
                        key={node.id}
                        style={categoryTreeStyles.childRow}
                        onPress={() => onToggleChild(node, root.id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={checked ? accent.strong : COLORS.textSecondary}
                        />
                        <Text style={[categoryTreeStyles.childText, checked && { color: accent.text, fontWeight: '600' }]}>
                          {node.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const categoryTreeStyles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    backgroundColor: COLORS.cardBg,
    marginBottom: 10,
  },
  resetRowActive: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  resetText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  resetTextActive: { color: COLORS.accentBlue, fontWeight: '700' },
  loadingRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootBlock: { marginBottom: 10 },
  rootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    backgroundColor: COLORS.cardBg,
  },
  rootRowActive: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  rootSelectArea: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rootExpandBtn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  rootTextActive: { color: COLORS.accentBlue },
  childList: {
    marginTop: 6,
    marginLeft: 12,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.borderSoft,
    gap: 8,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  childText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  childTextActive: { color: COLORS.accentBlue, fontWeight: '600' },
});

// ── Price Range Input Row ──

function PriceRangeRow({
  label,
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  placeholder,
}: {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  placeholder?: { min: string; max: string };
}) {
  return (
    <View style={rangeStyles.container}>
      <Text style={rangeStyles.label}>{label}</Text>
      <View style={rangeStyles.row}>
        <TextInput
          style={rangeStyles.input}
          value={minVal}
          onChangeText={onMinChange}
          placeholder={placeholder?.min || 'Min'}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="numeric"
        />
        <Text style={rangeStyles.sep}>–</Text>
        <TextInput
          style={rangeStyles.input}
          value={maxVal}
          onChangeText={onMaxChange}
          placeholder={placeholder?.max || 'Max'}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

const rangeStyles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 44,
  },
  sep: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
});

function ListingAttrFiltersSection({
  categoryMain,
  categoryTypeIds,
  categoryLeafIds,
  listMode,
  listingAttrJson,
  onChange,
}: {
  categoryMain: string;
  categoryTypeIds: string[];
  categoryLeafIds: string[];
  listMode: ListMode;
  listingAttrJson: string;
  onChange: (nextJson: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [resolvedLeaves, setResolvedLeaves] = useState<string[]>([]);
  const [mergedFields, setMergedFields] = useState<PublicListingAttributeField[]>([]);

  const categorySelected = Boolean(
    String(categoryMain || '').trim() || categoryTypeIds.length || categoryLeafIds.length,
  );
  const values = useMemo(() => parseListingAttrJson(listingAttrJson), [listingAttrJson]);

  useEffect(() => {
    if (!categorySelected) {
      setLoading(false);
      setLoadErr(null);
      setResolvedLeaves([]);
      setMergedFields([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const leafIds = await collectLeafIdsForAttrFilters({
          categoryMain,
          categoryTypeIds,
          categoryLeafIds,
        });
        if (cancelled) return;
        setResolvedLeaves(leafIds);
        if (!leafIds.length) {
          setMergedFields([]);
          return;
        }
        const schemaResults = await Promise.all(leafIds.map((leafId) => getPublicListingAttributeSchema(leafId)));
        if (cancelled) return;
        const failed = schemaResults.find((result) => !result.ok);
        if (failed && !failed.ok) {
          throw new Error(failed.error || 'Kategori detay alanları yüklenemedi');
        }
        const schemas = schemaResults
          .filter((result): result is { ok: true; data: PublicListingAttributeSchema } => result.ok)
          .map((result) => result.data);
        setMergedFields(mergeSpecificFieldsFromSchemas(schemas));
      } catch (error) {
        if (cancelled) return;
        setLoadErr(error instanceof Error ? error.message : String(error));
        setResolvedLeaves([]);
        setMergedFields([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categorySelected, categoryMain, categoryTypeIds, categoryLeafIds]);

  const setScalar = useCallback((key: string, next: string | undefined) => {
    const updated = { ...values };
    if (next === undefined || next === null || next === '') delete updated[key];
    else updated[key] = next;
    onChange(serializeListingAttr(updated));
  }, [onChange, values]);

  const setRange = useCallback((key: string, range: { min?: string | number; max?: string | number }) => {
    const updated = { ...values };
    const emptyMin = range.min === '' || range.min == null;
    const emptyMax = range.max === '' || range.max == null;
    if (emptyMin && emptyMax) delete updated[key];
    else updated[key] = { min: emptyMin ? undefined : range.min, max: emptyMax ? undefined : range.max };
    onChange(serializeListingAttr(updated));
  }, [onChange, values]);

  if (!categorySelected) {
    return (
      <>
        <Text style={styles.sheetSectionTitle}>Kategori detayı (ilan araması)</Text>
        <Text style={styles.sheetHelperText}>Özel filtreler için önce bir emlak kategorisi seçin.</Text>
      </>
    );
  }

  if (loading && !mergedFields.length) {
    return (
      <>
        <Text style={styles.sheetSectionTitle}>Kategori detayı (ilan araması)</Text>
        <Text style={styles.sheetHelperText}>Kategoriye özel alanlar yükleniyor…</Text>
      </>
    );
  }

  if (loadErr) {
    return (
      <>
        <Text style={styles.sheetSectionTitle}>Kategori detayı (ilan araması)</Text>
        <Text style={styles.sheetHelperText}>Detay filtreleri yüklenemedi: {loadErr}</Text>
      </>
    );
  }

  if (!resolvedLeaves.length || !mergedFields.length) {
    return (
      <>
        <Text style={styles.sheetSectionTitle}>Kategori detayı (ilan araması)</Text>
        <Text style={styles.sheetHelperText}>Bu kategori için ek özel filtre bulunmuyor.</Text>
      </>
    );
  }

  const visibleFields = mergedFields.filter((field) => isDynamicAttrFieldVisible(field, values));

  return (
    <>
      <Text style={styles.sheetSectionTitle}>Kategori detayı (ilan araması)</Text>
      <Text style={styles.sheetHelperText}>
        {listMode === 'ilanlar'
          ? 'Seçtiğiniz kategoriye göre otomatik alanlar gelir ve ilan aramasına uygulanır.'
          : 'Buradaki seçimler ProSorgular listesine uygulanmaz; İlanlar sekmesine geçtiğinizde ilan aramasında kullanılır.'}
      </Text>
      {visibleFields.map((field) => {
        const label = field.required ? `${field.label} *` : field.label;
        const rawValue = values[field.key];
        if (isChoiceField(field)) {
          const items: FilterPickerItem[] = [
            { value: '', label: 'Tümü' },
            ...(field.choices || []).map((choice) => ({ value: choice.value, label: choice.label })),
          ];
          return (
            <FilterPickerRow
              key={field.key}
              label={label}
              items={items}
              selectedValue={rawValue == null ? '' : String(rawValue)}
              onSelect={(value) => setScalar(field.key, value == null ? undefined : String(value))}
            />
          );
        }

        if (field.value_type === 'integer' || field.value_type === 'number') {
          const range = rawValue && typeof rawValue === 'object' ? (rawValue as { min?: unknown; max?: unknown }) : {};
          return (
            <PriceRangeRow
              key={field.key}
              label={label}
              minVal={range.min == null || range.min === '' ? '' : String(range.min)}
              maxVal={range.max == null || range.max === '' ? '' : String(range.max)}
              onMinChange={(value) => setRange(field.key, { min: value, max: range.max as string | number | undefined })}
              onMaxChange={(value) => setRange(field.key, { min: range.min as string | number | undefined, max: value })}
            />
          );
        }

        return (
          <View key={field.key} style={rangeStyles.container}>
            <Text style={rangeStyles.label}>{label}</Text>
            <TextInput
              style={rangeStyles.input}
              value={rawValue == null ? '' : String(rawValue)}
              onChangeText={(value) => setScalar(field.key, value || undefined)}
              placeholder="Seçin / yazın"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        );
      })}
    </>
  );
}

// ── Placeholder / Skeleton Card ──

function PlaceholderCard() {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.thumbnailWrap}>
        <View style={[cardStyles.thumbnail, cardStyles.thumbnailPlaceholder, { backgroundColor: '#e2e8f0' }]}>
          <Ionicons name="map-outline" size={24} color="#cbd5e1" />
        </View>
      </View>
      <View style={cardStyles.body}>
        <View style={cardStyles.bodyStarRow}>
          <View style={cardStyles.starMetaInline}>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[placeholderStyles.barSmall, { width: 14, height: 14, borderRadius: 3 }]} />
              ))}
            </View>
            <View style={[placeholderStyles.bar, { width: 42, height: 12 }]} />
          </View>
          <View style={cardStyles.socialRow}>
            <View style={[placeholderStyles.barSmall, { width: 34, height: 14, borderRadius: 4 }]} />
            <View style={[placeholderStyles.barSmall, { width: 34, height: 14, borderRadius: 4 }]} />
            <View style={[placeholderStyles.barSmall, { width: 34, height: 14, borderRadius: 4 }]} />
          </View>
        </View>
        <View style={cardStyles.topRow}>
          <View style={[placeholderStyles.bar, { width: '82%' }]} />
        </View>
        <View style={[placeholderStyles.bar, { width: '50%', marginBottom: 6 }]} />
        <View style={cardStyles.priceRow}>
          <View style={[placeholderStyles.bar, { width: '35%' }]} />
          <View style={[placeholderStyles.bar, { width: '30%' }]} />
        </View>
        <View style={cardStyles.bottomRow}>
          <View style={[placeholderStyles.bar, { width: '40%', height: 14 }]} />
          <View style={[placeholderStyles.bar, { width: '25%' }]} />
        </View>
      </View>
    </View>
  );
}

const PLACEHOLDER_COUNT = 6;

function PlaceholderList({ message }: { message?: string }) {
  return (
    <View>
      {message && (
        <View style={placeholderStyles.messageWrap}>
          <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
          <Text style={placeholderStyles.messageText}>{message}</Text>
        </View>
      )}
      {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
        <PlaceholderCard key={`ph-${i}`} />
      ))}
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  bar: { height: 10, borderRadius: 4, backgroundColor: '#e2e8f0', width: '60%' },
  barSmall: { height: 10, borderRadius: 4, backgroundColor: '#e2e8f0' },
  messageWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 0,
    backgroundColor: '#f0f9ff', borderBottomWidth: 1, borderBottomColor: '#bae6fd',
  },
  messageText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
});

// ── Query Card ──

function getRatingColor(pct: number | null): string {
  if (pct == null) return '#94a3b8';
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

/**
 * `combined_meta_stars_pct` (0–100) → görsel yıldız + 5 üzerinden metin.
 * `PortalInsightSummaryCard.starsFromPct` ile aynı mantık.
 */
function metaStarsFromPct(pct: number | null | undefined): { filled: number; outOf5: string } {
  if (pct == null || Number.isNaN(Number(pct))) return { filled: 0, outOf5: '—' };
  const p = Math.min(100, Math.max(0, Number(pct)));
  const out = (p / 100) * 5;
  return {
    filled: Math.round(out),
    outOf5: out.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };
}

/** Başarılı puan adedi: farklı payload alanlarını destekle, yoksa yüzde+adetten türet. */
function resolveRatingSuccessCount(item: Record<string, unknown>): number {
  const asNum = (raw: unknown): number | null => {
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const ratingSummary =
    item.rating_summary && typeof item.rating_summary === 'object'
      ? (item.rating_summary as Record<string, unknown>)
      : null;

  const direct =
    asNum(item.rating_success_count) ??
    asNum(item.success_count) ??
    asNum(ratingSummary?.success_count);
  if (direct != null) return Math.max(0, Math.round(direct));

  const ratingCount = asNum(item.rating_count) ?? asNum(ratingSummary?.rating_count);
  const ratingScorePct = asNum(item.rating_score_pct) ?? asNum(ratingSummary?.rating_score_pct);
  if (ratingCount != null && ratingScorePct != null) {
    const estimated = Math.round((Math.max(0, ratingCount) * Math.min(100, Math.max(0, ratingScorePct))) / 100);
    return Math.max(0, estimated);
  }
  return 0;
}

/** Başlığın hemen üstünde: meta yıldızlar + x,x/5 (kart gövdesi içinde). */
function QueryCardStarRow({ metaPct }: { metaPct: number | null | undefined }) {
  const { filled, outOf5 } = metaStarsFromPct(metaPct);
  const hasPct = metaPct != null && !Number.isNaN(Number(metaPct));

  const stars = (
    <View style={cardStyles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= filled ? 'star' : 'star-outline'}
          size={12}
          color={i <= filled ? '#fbbf24' : '#cbd5e1'}
        />
      ))}
    </View>
  );

  const statsInline = hasPct ? (
    <Text style={cardStyles.starStatsLine} numberOfLines={1}>
      <Text style={[cardStyles.starPct, { color: getRatingColor(metaPct != null ? Number(metaPct) : null) }]}>
        {outOf5}
      </Text>
      <Text style={cardStyles.starOutOf5Suffix}>/5</Text>
    </Text>
  ) : (
    <View style={cardStyles.starEmptyWrap}>
      <Text style={cardStyles.starEmptyHint}>Yıldız puanı yok</Text>
    </View>
  );

  return (
    <View style={cardStyles.starMetaInline}>
      {stars}
      {statsInline}
    </View>
  );
}

function QueryCard({ item, onPress }: { item: PortalQueryListItem; onPress: () => void }) {
  const typeLabel = QUERY_TYPE_LABELS[(item.query_type || '').toLowerCase()] || item.query_type || 'Arsa';
  const adaParsel = `${item.ada || '0'}/${item.parsel || '0'}`;
  const favoriteCountTotal = Math.max(0, Number(item.favorite_count_total ?? 0) || 0);
  const ratingSuccessCount = resolveRatingSuccessCount(item as unknown as Record<string, unknown>);
  const commentCount = Math.max(0, Number(item.comment_count ?? 0) || 0);
  const expertBadge = item.has_expert_request
    ? item.expert_status === 'ANSWERED'
      ? { text: 'Yanıtlandı', color: COLORS.accentGreen }
      : { text: 'Bekleniyor', color: COLORS.warningOrange }
    : null;

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={cardStyles.thumbnailWrap}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={cardStyles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[cardStyles.thumbnail, cardStyles.thumbnailPlaceholder]}>
            <Ionicons name="map-outline" size={24} color={COLORS.textSecondary} />
          </View>
        )}
      </View>
      <View style={cardStyles.body}>
        <View style={cardStyles.bodyStarRow}>
          <QueryCardStarRow metaPct={item.combined_meta_stars_pct ?? null} />
          <View style={cardStyles.socialRow}>
            <View style={cardStyles.socialBadgeFav}>
              <Ionicons name="heart" size={9} color="#be123c" />
              <Text style={cardStyles.socialBadgeFavText}>{favoriteCountTotal}</Text>
            </View>
            <View style={cardStyles.socialBadgeLike}>
              <Ionicons name="thumbs-up" size={9} color="#1d4ed8" />
              <Text style={cardStyles.socialBadgeLikeText}>{ratingSuccessCount}</Text>
            </View>
            <View style={cardStyles.socialBadge}>
              <Ionicons name="chatbubble-ellipses" size={9} color="#0f766e" />
              <Text style={cardStyles.socialBadgeText}>{commentCount}</Text>
            </View>
          </View>
        </View>
        <View style={cardStyles.topRow}>
          <Text style={cardStyles.location} numberOfLines={1}>
            {item.quarter_name || item.title || '—'}
          </Text>
        </View>
        <View style={cardStyles.adaParselNavRow}>
          <Text style={cardStyles.adaParsel} numberOfLines={1}>
            Ada/Parsel: {adaParsel}
          </Text>
          <View style={cardStyles.navKmInline}>
            <Text style={cardStyles.navKmLine} numberOfLines={1}>
              İl {formatNavRouteKm(item.nav_in_distance_m_city)}
            </Text>
            <Text style={cardStyles.navKmSep}>·</Text>
            <Text style={cardStyles.navKmLine} numberOfLines={1}>
              İlçe {formatNavRouteKm(item.nav_in_distance_m_town)}
            </Text>
          </View>
        </View>
        <View style={cardStyles.priceRow}>
          <View style={cardStyles.priceLeftGroup}>
            <View style={cardStyles.typeBadge}>
              <Text style={cardStyles.typeBadgeText}>{typeLabel}</Text>
            </View>
            <Text style={cardStyles.area}>{formatArea(item.area_m2)}</Text>
          </View>
          <Text style={cardStyles.unitPrice}>{formatPrice(item.unit_price)}/m²</Text>
        </View>
        <View style={cardStyles.bottomRow}>
          <Text style={cardStyles.totalPrice}>{formatPrice(item.total_price)}</Text>
          <View style={cardStyles.bottomRight}>
            {expertBadge ? (
              <View style={[cardStyles.expertBadge, { backgroundColor: expertBadge.color + '20' }]}>
                <Ionicons name="person" size={10} color={expertBadge.color} />
                <Text style={[cardStyles.expertBadgeText, { color: expertBadge.color }]}>{expertBadge.text}</Text>
              </View>
            ) : null}
            <Text style={cardStyles.date}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function resolveListingThumbUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  const base = API_URL.replace(/\/$/, '');
  return t.startsWith('/') ? `${base}${t}` : `${base}/${t}`;
}

function parseLocationLabelParts(labels: Record<string, string> | undefined): {
  city: string;
  district: string;
  quarter: string;
} {
  if (!labels || typeof labels !== 'object') return { city: '', district: '', quarter: '' };
  const o = labels as Record<string, string>;
  return {
    city: String(o.city_name || o.il || o.city || '').trim(),
    district: String(o.district_name || o.ilce || o.district || '').trim(),
    quarter: String(o.quarter_name || o.mahalle || o.quarter || '').trim(),
  };
}

function normalizeListingLocId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

const scopeBarStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  rowWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  sep: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  link: { fontSize: 13, fontWeight: '700', color: COLORS.accentBlue },
  plain: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
});

function ListingLocationScopeBar({
  cityName,
  districtName,
  quarterName,
  cityId,
  districtId,
  onPressCity,
  onPressDistrict,
}: {
  cityName: string;
  districtName: string;
  quarterName: string;
  cityId: number | null;
  districtId: number | null;
  onPressCity: (id: number) => void;
  onPressDistrict: (cityId: number, districtId: number) => void;
}) {
  const hasAny = Boolean(cityName || districtName || quarterName);
  if (!hasAny) return null;

  return (
    <View style={scopeBarStyles.wrap}>
      <Ionicons name="location-outline" size={15} color={COLORS.accentBlue} style={{ marginRight: 8, marginTop: 1 }} />
      <View style={scopeBarStyles.rowWrap}>
        {cityName ? (
          cityId != null ? (
            <TouchableOpacity
              onPress={() => onPressCity(cityId)}
              activeOpacity={0.65}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            >
              <Text style={scopeBarStyles.link}>{cityName}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={scopeBarStyles.plain}>{cityName}</Text>
          )
        ) : null}
        {districtName ? (
          <>
            {cityName ? <Text style={scopeBarStyles.sep}> · </Text> : null}
            {cityId != null && districtId != null ? (
              <TouchableOpacity
                onPress={() => onPressDistrict(cityId, districtId)}
                activeOpacity={0.65}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
              >
                <Text style={scopeBarStyles.link}>{districtName}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={scopeBarStyles.plain}>{districtName}</Text>
            )}
          </>
        ) : null}
        {quarterName ? (
          <>
            {cityName || districtName ? <Text style={scopeBarStyles.sep}> · </Text> : null}
            <Text style={scopeBarStyles.plain}>{quarterName}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function formatRoadFrontageMeters(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n)) + ' m';
}

function formatGmNormalized(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function VitrinListingCard({ item, onPress }: { item: VitrinListingItem; onPress: () => void }) {
  const thumb = resolveListingThumbUrl(item.thumb_url);
  const favoriteCountTotal = Math.max(0, Number(item.favorite_count_total ?? 0) || 0);
  const ratingSuccessCount = resolveRatingSuccessCount(item as unknown as Record<string, unknown>);
  const commentCount = Math.max(0, Number(item.comment_count ?? 0) || 0);
  const price =
    item.price_amount != null && !Number.isNaN(Number(item.price_amount))
      ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(
          Number(item.price_amount),
        )
      : '—';
  const area =
    item.area_m2 != null && !Number.isNaN(Number(item.area_m2))
      ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(item.area_m2))} m²`
      : '—';
  const cat = item.category_leaf_label || 'İlan';
  const gm = item.investment_normalized_score;
  const hasGm = gm != null && Number.isFinite(Number(gm));

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={cardStyles.thumbnailWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={cardStyles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[cardStyles.thumbnail, cardStyles.thumbnailPlaceholder]}>
            <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
          </View>
        )}
      </View>
      <View style={cardStyles.body}>
        <View style={cardStyles.bodyStarRow}>
          <QueryCardStarRow metaPct={item.combined_meta_stars_pct ?? null} />
          <View style={cardStyles.socialRow}>
            <View style={cardStyles.socialBadgeFav}>
              <Ionicons name="heart" size={9} color="#be123c" />
              <Text style={cardStyles.socialBadgeFavText}>{favoriteCountTotal}</Text>
            </View>
            <View style={cardStyles.socialBadgeLike}>
              <Ionicons name="thumbs-up" size={9} color="#1d4ed8" />
              <Text style={cardStyles.socialBadgeLikeText}>{ratingSuccessCount}</Text>
            </View>
            <View style={cardStyles.socialBadge}>
              <Ionicons name="chatbubble-ellipses" size={9} color="#0f766e" />
              <Text style={cardStyles.socialBadgeText}>{commentCount}</Text>
            </View>
          </View>
        </View>
        <View style={cardStyles.topRow}>
          <Text style={cardStyles.location} numberOfLines={2}>
            {item.title || 'İlan'}
          </Text>
        </View>
        <View style={cardStyles.vitrinMetricsRow}>
          <View style={[cardStyles.vitrinMetric, !hasGm && cardStyles.vitrinMetricGrow]}>
            <Ionicons name="resize-outline" size={12} color={COLORS.textSecondary} />
            <Text style={cardStyles.vitrinMetricText} numberOfLines={1}>
              Yola cephe {formatRoadFrontageMeters(item.road_frontage_m)}
            </Text>
          </View>
          {hasGm ? (
            <View style={cardStyles.vitrinMetric}>
              <Ionicons name="trending-up-outline" size={12} color={COLORS.textSecondary} />
              <Text style={cardStyles.vitrinMetricText} numberOfLines={1}>
                GM {formatGmNormalized(gm)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={cardStyles.adaParselNavRow}>
          <View style={cardStyles.navKmInline}>
            <Text style={cardStyles.navKmLine} numberOfLines={1}>
              İl {formatNavRouteKm(item.nav_in_distance_m_city)}
            </Text>
            <Text style={cardStyles.navKmSep}>·</Text>
            <Text style={cardStyles.navKmLine} numberOfLines={1}>
              İlçe {formatNavRouteKm(item.nav_in_distance_m_town)}
            </Text>
          </View>
        </View>
        <View style={cardStyles.priceRow}>
          <View style={cardStyles.priceLeftGroup}>
            <View style={cardStyles.typeBadge}>
              <Text style={cardStyles.typeBadgeText}>{cat}</Text>
            </View>
            <Text style={cardStyles.area}>{area}</Text>
          </View>
          <Text style={cardStyles.unitPrice}>{price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.cardBg,
    borderRadius: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    overflow: 'hidden',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    elevation: 0,
    shadowOpacity: 0,
  },
  bodyStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 6,
  },
  starMetaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  /** Tek satırda: 4,5/5 */
  starStatsLine: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  starPct: { fontSize: 12, fontWeight: '800' },
  starOutOf5Suffix: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  starEmptyWrap: { alignItems: 'flex-start', justifyContent: 'center' },
  starEmptyHint: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  thumbnailWrap: {
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 6,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  thumbnail: {
    width: 80,
    height: 100,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: 10, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  location: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1, minWidth: 0 },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flexWrap: 'nowrap',
    maxWidth: '56%',
    flexShrink: 1,
    minWidth: 0,
  },
  typeBadge: { backgroundColor: COLORS.accentBlue + '15', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.accentBlue, textTransform: 'uppercase' },
  socialBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#ccfbf1', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  socialBadgeText: { fontSize: 9, fontWeight: '700', color: '#0f766e' },
  socialBadgeFav: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#ffe4e6', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  socialBadgeFavText: { fontSize: 9, fontWeight: '700', color: '#be123c' },
  socialBadgeLike: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  socialBadgeLikeText: { fontSize: 9, fontWeight: '700', color: '#1d4ed8' },
  priceLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 },
  /** Ada/Parsel (sol) + İl·İlçe km (sağ) tek satır */
  adaParselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  adaParsel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  navKmInline: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 6 },
  navKmLine: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  navKmSep: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700', opacity: 0.85 },
  vitrinMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  vitrinMetric: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  vitrinMetricGrow: { flex: 1 },
  vitrinMetricText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', flexShrink: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  area: { fontSize: 12, color: COLORS.textSecondary },
  unitPrice: { fontSize: 12, color: COLORS.textSecondary },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalPrice: { fontSize: 14, fontWeight: '700', color: COLORS.accentBlue },
  bottomRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expertBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  expertBadgeText: { fontSize: 10, fontWeight: '600' },
  date: { fontSize: 11, color: COLORS.textSecondary },
});

// ── Main Screen ──

type ListMode = 'ilanlar' | 'proSorgular';

export default function Son30GunScreen() {
  const router = useRouter();
  const route = useRoute();
  const routeName = route.name;
  const routeParams = (route.params || {}) as {
    categoryMain?: string;
    category_main?: string;
    categoryLeafId?: string;
    category_leaf_id?: string;
    listingType?: 'sale' | 'rent';
    listing_type?: 'sale' | 'rent';
    cityId?: string;
    city_id?: string;
    cityName?: string;
    city_name?: string;
  };
  const { isAuthenticated } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  /** `emlak-vitrini` → vitrin ilanları; `son-30-gun` → Pro sorgu sonuçları */
  const [listMode, setListMode] = useState<ListMode>(() =>
    routeName === 'son-30-gun' ? 'proSorgular' : 'ilanlar',
  );

  /** API `counts_for` — ilan vitrininde şehir sayıları Mongo; Pro sorguda audit snapshot */
  const locationsCountsFor = listMode === 'ilanlar' ? 'listings' : 'queries';

  // Location filter data
  const [cities, setCities] = useState<PortalLocationItem[]>([]);
  const [towns, setTowns] = useState<PortalLocationItem[]>([]);
  const [quarters, setQuarters] = useState<PortalLocationItem[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [townsLoading, setTownsLoading] = useState(false);
  const [quartersLoading, setQuartersLoading] = useState(false);

  // Applied filters (used for API calls)
  const [appliedFilters, setAppliedFilters] = useState<PortalQueryListParams>({});
  const [appliedListingFilters, setAppliedListingFilters] = useState<VitrinListingSearchParams>({});
  const [mineOnly, setMineOnly] = useState(false);

  /** Web `PortalRecentQueriesApp` — ilk açılışta il yoksa bir kez varsayılan il (stored / popular) */
  const didAutoSelectProDefaultCityRef = useRef(false);

  const effectiveAppliedListingFilters = useMemo((): VitrinListingSearchParams => {
    const next: VitrinListingSearchParams = { ...(appliedListingFilters || {}) };
    if (routeName !== 'emlak-vitrini-liste') return next;
    const routeCategoryMain = routeParams.category_main || routeParams.categoryMain;
    const routeCategoryLeafId = routeParams.category_leaf_id || routeParams.categoryLeafId;
    const routeListingType = routeParams.listing_type || routeParams.listingType;
    const routeCityId = routeParams.city_id || routeParams.cityId;
    if (routeCategoryMain && !next.category_main) next.category_main = routeCategoryMain;
    if (routeCategoryLeafId && !next.category_leaf_id) next.category_leaf_id = routeCategoryLeafId;
    if (routeListingType && !next.listing_type) next.listing_type = routeListingType;
    if (routeCityId && next.city_id == null && Number.isFinite(Number(routeCityId))) {
      next.city_id = Number(routeCityId);
    }
    return next;
  }, [
    routeName,
    routeParams.categoryMain,
    routeParams.category_main,
    routeParams.categoryLeafId,
    routeParams.category_leaf_id,
    routeParams.listingType,
    routeParams.listing_type,
    routeParams.cityId,
    routeParams.city_id,
    appliedListingFilters,
  ]);

  // Draft filters (inside bottom sheet, not applied until "Ara" is pressed)
  const [draftCity, setDraftCity] = useState<number | null>(null);
  const [draftTown, setDraftTown] = useState<number | null>(null);
  const [draftQuarter, setDraftQuarter] = useState<number | null>(null);
  const [draftCategoryMain, setDraftCategoryMain] = useState('');
  const [draftCategoryTypeIds, setDraftCategoryTypeIds] = useState<string[]>([]);
  const [draftCategoryLeafIds, setDraftCategoryLeafIds] = useState<string[]>([]);
  const [expandedCategoryRootId, setExpandedCategoryRootId] = useState<string | null>(null);
  const [draftHisseli, setDraftHisseli] = useState(false);
  const [draftUnitPriceMin, setDraftUnitPriceMin] = useState('');
  const [draftUnitPriceMax, setDraftUnitPriceMax] = useState('');
  const [draftTotalPriceMin, setDraftTotalPriceMin] = useState('');
  const [draftTotalPriceMax, setDraftTotalPriceMax] = useState('');
  /** Yalnızca uzman yanıtı (ANSWERED) olan kayıtlar — Pro: `expert_status`, İlan: `expert_answered` */
  const [draftProExpertAnswered, setDraftProExpertAnswered] = useState(false);
  const [draftListingExpertAnswered, setDraftListingExpertAnswered] = useState(false);
  const [draftProPriceAdvantageOnly, setDraftProPriceAdvantageOnly] = useState(false);
  const [draftListingPriceAdvantageOnly, setDraftListingPriceAdvantageOnly] = useState(false);

  const [draftSortBy, setDraftSortBy] = useState('');
  const [draftSortDir, setDraftSortDir] = useState<'asc' | 'desc'>('desc');

  const [draftAreaM2Min, setDraftAreaM2Min] = useState('');
  const [draftAreaM2Max, setDraftAreaM2Max] = useState('');
  const [draftProRoadMinM, setDraftProRoadMinM] = useState('');
  const [draftProRoadMaxM, setDraftProRoadMaxM] = useState('');
  const [draftGmMin, setDraftGmMin] = useState('');
  const [draftGmMax, setDraftGmMax] = useState('');
  const [draftMetaMin, setDraftMetaMin] = useState('');
  const [draftMetaMax, setDraftMetaMax] = useState('');
  const [draftPuanMin, setDraftPuanMin] = useState('');
  const [draftPuanMax, setDraftPuanMax] = useState('');
  const [draftProHasRoad, setDraftProHasRoad] = useState('');
  const [draftProHasWater, setDraftProHasWater] = useState('');
  const [draftProHasPower, setDraftProHasPower] = useState('');

  const [draftListingAreaMin, setDraftListingAreaMin] = useState('');
  const [draftListingAreaMax, setDraftListingAreaMax] = useState('');
  const [draftListingRoadMin, setDraftListingRoadMin] = useState('');
  const [draftListingRoadMax, setDraftListingRoadMax] = useState('');
  const [draftListingGmMin, setDraftListingGmMin] = useState('');
  const [draftListingGmMax, setDraftListingGmMax] = useState('');
  const [draftListingPuanMin, setDraftListingPuanMin] = useState('');
  const [draftListingPuanMax, setDraftListingPuanMax] = useState('');
  const [draftListingHasRoad, setDraftListingHasRoad] = useState('');
  const [draftListingHasWater, setDraftListingHasWater] = useState('');
  const [draftListingHasPower, setDraftListingHasPower] = useState('');
  const [draftListingUnitPriceMin, setDraftListingUnitPriceMin] = useState('');
  const [draftListingUnitPriceMax, setDraftListingUnitPriceMax] = useState('');
  const [draftListingMetaMin, setDraftListingMetaMin] = useState('');
  const [draftListingMetaMax, setDraftListingMetaMax] = useState('');
  /** İlan araması için serialize edilmiş `listing_attr` değeri */
  const [draftListingAttrJson, setDraftListingAttrJson] = useState('');
  const [draftListingHisseli, setDraftListingHisseli] = useState(false);
  const [draftMaxNavCityM, setDraftMaxNavCityM] = useState('');
  const [draftMaxNavTownM, setDraftMaxNavTownM] = useState('');
  const [categoryRootNodes, setCategoryRootNodes] = useState<PublicListingCategoryNode[]>([]);
  const [categoryChildrenByRoot, setCategoryChildrenByRoot] = useState<Record<string, PublicListingCategoryNode[]>>({});
  const [categoryTreeLoading, setCategoryTreeLoading] = useState(false);

  // Filter sheet visibility
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [sortSheetVisible, setSortSheetVisible] = useState(false);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    if (listMode === 'ilanlar') {
      let c = 0;
      if (effectiveAppliedListingFilters.city_id != null) c++;
      if (effectiveAppliedListingFilters.district_id != null) c++;
      if (effectiveAppliedListingFilters.quarter_id != null) c++;
      if (effectiveAppliedListingFilters.price_min_amount != null) c++;
      if (effectiveAppliedListingFilters.price_max_amount != null) c++;
      if (effectiveAppliedListingFilters.area_min_m2 != null) c++;
      if (effectiveAppliedListingFilters.area_max_m2 != null) c++;
      if (effectiveAppliedListingFilters.investment_score_min != null) c++;
      if (effectiveAppliedListingFilters.investment_score_max != null) c++;
      if (effectiveAppliedListingFilters.rating_score_min != null) c++;
      if (effectiveAppliedListingFilters.rating_score_max != null) c++;
      if (effectiveAppliedListingFilters.road_frontage_min_m != null) c++;
      if (effectiveAppliedListingFilters.road_frontage_max_m != null) c++;
      if (effectiveAppliedListingFilters.category_main || effectiveAppliedListingFilters.category_type || effectiveAppliedListingFilters.category_leaf_id) c++;
      if (effectiveAppliedListingFilters.listing_has_road) c++;
      if (effectiveAppliedListingFilters.listing_has_water) c++;
      if (effectiveAppliedListingFilters.listing_has_power_line) c++;
      if (effectiveAppliedListingFilters.unit_price_min != null) c++;
      if (effectiveAppliedListingFilters.unit_price_max != null) c++;
      if (effectiveAppliedListingFilters.meta_min != null || effectiveAppliedListingFilters.meta_max != null) c++;
      if (effectiveAppliedListingFilters.hisseli) c++;
      if (effectiveAppliedListingFilters.expert_answered) c++;
      if (effectiveAppliedListingFilters.price_advantage_only) c++;
      if (effectiveAppliedListingFilters.max_nav_city_m != null) c++;
      if (effectiveAppliedListingFilters.max_nav_town_m != null) c++;
      if (String(effectiveAppliedListingFilters.listing_attr || '').trim()) c++;
      return c;
    }
    let c = 0;
    if (appliedFilters.city_id) c++;
    if (appliedFilters.town_id) c++;
    if (appliedFilters.quarter_id) c++;
    if (appliedFilters.query_type) c++;
    if (appliedFilters.hisseli) c++;
    if (appliedFilters.unit_price_min != null) c++;
    if (appliedFilters.unit_price_max != null) c++;
    if (appliedFilters.total_price_min != null) c++;
    if (appliedFilters.total_price_max != null) c++;
    if (appliedFilters.expert_status === 'ANSWERED') c++;
    if (appliedFilters.price_advantage_only) c++;
    if (appliedFilters.area_m2_min != null) c++;
    if (appliedFilters.area_m2_max != null) c++;
    if (appliedFilters.gm_min != null) c++;
    if (appliedFilters.gm_max != null) c++;
    if (appliedFilters.meta_min != null || appliedFilters.meta_max != null) c++;
    if (appliedFilters.puan_min != null) c++;
    if (appliedFilters.puan_max != null) c++;
    if (appliedFilters.road_frontage_min_m != null) c++;
    if (appliedFilters.road_frontage_max_m != null) c++;
    if (appliedFilters.category_main || appliedFilters.category_type || appliedFilters.category_leaf_id) c++;
    if (appliedFilters.listing_has_road) c++;
    if (appliedFilters.listing_has_water) c++;
    if (appliedFilters.listing_has_power_line) c++;
    if (appliedFilters.max_nav_city_m != null) c++;
    if (appliedFilters.max_nav_town_m != null) c++;
    return c;
  }, [listMode, appliedFilters, appliedListingFilters, effectiveAppliedListingFilters]);

  const activeSortBy = useMemo(
    () => (listMode === 'ilanlar' ? effectiveAppliedListingFilters.sort_by : appliedFilters.sort_by) || '',
    [listMode, appliedFilters.sort_by, effectiveAppliedListingFilters.sort_by],
  );

  const isPriceAdvantageOnlyActive = useMemo(() => (
    listMode === 'ilanlar'
      ? effectiveAppliedListingFilters.price_advantage_only === '1'
      : appliedFilters.price_advantage_only === '1'
  ), [listMode, appliedFilters.price_advantage_only, effectiveAppliedListingFilters.price_advantage_only]);

  // List state
  const [items, setItems] = useState<PortalQueryListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const [listingItems, setListingItems] = useState<VitrinListingItem[]>([]);
  const [listingTotal, setListingTotal] = useState(0);
  const [listingPage, setListingPage] = useState(1);
  const [listingTotalPages, setListingTotalPages] = useState(1);
  const [listingLoadingMore, setListingLoadingMore] = useState(false);
  const [listingInitialLoad, setListingInitialLoad] = useState(true);
  const [listingError, setListingError] = useState<string | null>(null);

  const displayQueryItems = useMemo(() => {
    const sb = (appliedFilters.sort_by || '').trim().toLowerCase();
    if (!sb) return items;
    const dir = appliedFilters.sort_dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      switch (sb) {
        case 'date_desc':
          return compareNullableDateStrings(a.updated_at || a.created_at, b.updated_at || b.created_at, -1);
        case 'date_asc':
          return compareNullableDateStrings(a.updated_at || a.created_at, b.updated_at || b.created_at, 1);
        case 'price':
          return compareNullableNumbers(a.total_price, b.total_price, dir);
        case 'unit_price':
          return compareNullableNumbers(a.unit_price, b.unit_price, dir);
        case 'rating':
          return compareNullableNumbers(a.rating_score_pct, b.rating_score_pct, dir);
        case 'comment':
          return compareNullableNumbers(a.comment_count, b.comment_count, dir);
        case 'meta':
          return compareNullableNumbers(a.combined_meta_stars_pct, b.combined_meta_stars_pct, dir);
        default:
          return 0;
      }
    });
  }, [items, appliedFilters.sort_by, appliedFilters.sort_dir]);

  const displayListingItems = useMemo(() => {
    const sb = (effectiveAppliedListingFilters.sort_by || '').trim().toLowerCase();
    if (!sb) return listingItems;
    const dir = effectiveAppliedListingFilters.sort_dir === 'asc' ? 1 : -1;
    return [...listingItems].sort((a, b) => {
      switch (sb) {
        case 'date_desc':
          return compareNullableDateStrings(a.updated_at, b.updated_at, -1);
        case 'date_asc':
          return compareNullableDateStrings(a.updated_at, b.updated_at, 1);
        case 'price':
          return compareNullableNumbers(a.price_amount, b.price_amount, dir);
        case 'unit_price':
          return compareNullableNumbers(getListingUnitPrice(a), getListingUnitPrice(b), dir);
        case 'rating':
          return compareNullableNumbers(a.rating_score_pct, b.rating_score_pct, dir);
        case 'comment':
          return compareNullableNumbers(a.comment_count, b.comment_count, dir);
        case 'gm':
          return compareNullableNumbers(a.investment_normalized_score, b.investment_normalized_score, dir);
        case 'meta':
          return compareNullableNumbers(a.combined_meta_stars_pct, b.combined_meta_stars_pct, dir);
        default:
          return 0;
      }
    });
  }, [listingItems, effectiveAppliedListingFilters.sort_by, effectiveAppliedListingFilters.sort_dir]);

  /** Filtre satırında il/ilçe adı çözümlemesi (uygulanan city/district için) */
  const [scopeTowns, setScopeTowns] = useState<PortalLocationItem[]>([]);
  const [scopeQuarters, setScopeQuarters] = useState<PortalLocationItem[]>([]);

  // ── Load location cascades ──

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        setCitiesLoading(true);
        const res = await getPortalLocations(undefined, undefined, { countsFor: locationsCountsFor });
        if (res.ok && res.data?.cities) setCities(res.data.cities);
      } catch (e) {
        console.warn('[Son30Gun] Cities hata:', e);
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, [isAuthenticated, locationsCountsFor]);

  useEffect(() => {
    const id =
      listMode === 'ilanlar' ? appliedListingFilters.city_id : appliedFilters.city_id;
    if (id == null) return;
    void setStoredPortalRecentCityId(String(id));
  }, [listMode, appliedFilters.city_id, appliedListingFilters.city_id]);

  useEffect(() => {
    if (listMode !== 'proSorgular') return;
    if (didAutoSelectProDefaultCityRef.current) return;
    if (appliedFilters.city_id) {
      didAutoSelectProDefaultCityRef.current = true;
      return;
    }
    if (citiesLoading || cities.length === 0) return;

    let cancelled = false;
    (async () => {
      const preferredFromListings =
        effectiveAppliedListingFilters.city_id != null
          ? String(effectiveAppliedListingFilters.city_id)
          : '';
      const stored = await getStoredPortalRecentCityId();
      const preferred = preferredFromListings || stored;
      if (cancelled) return;
      if (didAutoSelectProDefaultCityRef.current) return;
      if (appliedFilters.city_id) return;
      const { city } = pickDefaultCityForPortalList(cities, preferred);
      if (!city) {
        didAutoSelectProDefaultCityRef.current = true;
        return;
      }
      didAutoSelectProDefaultCityRef.current = true;
      const id = Number(city.id);
      setAppliedFilters((cur) => ({ ...cur, city_id: id }));
      setDraftCity(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    listMode,
    cities,
    citiesLoading,
    appliedFilters.city_id,
    effectiveAppliedListingFilters.city_id,
  ]);

  useEffect(() => {
    setTowns([]);
    setQuarters([]);
    setDraftTown(null);
    setDraftQuarter(null);
    if (!draftCity) return;
    (async () => {
      try {
        setTownsLoading(true);
        const res = await getPortalLocations(draftCity, undefined, { countsFor: locationsCountsFor });
        if (res.ok && res.data?.towns) setTowns(res.data.towns);
      } catch (e) {
        console.warn('[Son30Gun] Towns hata:', e);
      } finally {
        setTownsLoading(false);
      }
    })();
  }, [draftCity, locationsCountsFor]);

  useEffect(() => {
    setQuarters([]);
    setDraftQuarter(null);
    if (!draftCity || !draftTown) return;
    (async () => {
      try {
        setQuartersLoading(true);
        const res = await getPortalLocations(draftCity, draftTown, { countsFor: locationsCountsFor });
        if (res.ok && res.data?.quarters) setQuarters(res.data.quarters);
      } catch (e) {
        console.warn('[Son30Gun] Quarters hata:', e);
      } finally {
        setQuartersLoading(false);
      }
    })();
  }, [draftCity, draftTown, locationsCountsFor]);

  useEffect(() => {
    if (listMode !== 'ilanlar') {
      setScopeTowns([]);
      return;
    }
    const cid = effectiveAppliedListingFilters.city_id;
    if (cid == null) {
      setScopeTowns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getPortalLocations(cid, undefined, {
          countsFor: 'listings',
          categoryMain: effectiveAppliedListingFilters.category_main,
          categoryLeafId: effectiveAppliedListingFilters.category_leaf_id,
          listingType: effectiveAppliedListingFilters.listing_type,
        });
        if (!cancelled && res.ok && res.data?.towns) setScopeTowns(res.data.towns);
      } catch (e) {
        console.warn('[Son30Gun] vitrin scope ilçe hata:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    listMode,
    effectiveAppliedListingFilters.city_id,
    effectiveAppliedListingFilters.category_main,
    effectiveAppliedListingFilters.category_leaf_id,
    effectiveAppliedListingFilters.listing_type,
  ]);

  useEffect(() => {
    if (listMode !== 'ilanlar') {
      setScopeQuarters([]);
      return;
    }
    const cid = effectiveAppliedListingFilters.city_id;
    const tid = effectiveAppliedListingFilters.district_id;
    if (cid == null || tid == null) {
      setScopeQuarters([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getPortalLocations(cid, tid, {
          countsFor: 'listings',
          categoryMain: effectiveAppliedListingFilters.category_main,
          categoryLeafId: effectiveAppliedListingFilters.category_leaf_id,
          listingType: effectiveAppliedListingFilters.listing_type,
        });
        if (!cancelled && res.ok && res.data?.quarters) setScopeQuarters(res.data.quarters);
      } catch (e) {
        console.warn('[Son30Gun] vitrin scope mahalle hata:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    listMode,
    effectiveAppliedListingFilters.city_id,
    effectiveAppliedListingFilters.district_id,
    effectiveAppliedListingFilters.category_main,
    effectiveAppliedListingFilters.category_leaf_id,
    effectiveAppliedListingFilters.listing_type,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        setCategoryTreeLoading(true);
        const rootsRes = await getPublicListingCategories();
        const roots = rootsRes.ok ? rootsRes.data?.nodes || [] : [];
        if (cancelled) return;
        setCategoryRootNodes(roots);
        const pairs = await Promise.all(
          roots.map(async (root) => {
            const childRes = await getPublicListingCategories({ parentId: root.id });
            return [root.id, childRes.ok ? childRes.data?.nodes || [] : []] as const;
          }),
        );
        if (cancelled) return;
        const next: Record<string, PublicListingCategoryNode[]> = {};
        pairs.forEach(([rootId, nodes]) => {
          next[rootId] = nodes;
        });
        setCategoryChildrenByRoot(next);
      } catch (e) {
        console.warn('[Son30Gun] category tree hata:', e);
      } finally {
        if (!cancelled) setCategoryTreeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /** Filtre sayfası açılınca taslakları uygulanan değerlerle doldur (web ile aynı mantık) */
  useEffect(() => {
    if (!filterSheetVisible && !sortSheetVisible) return;
    const sortSrc = listMode === 'ilanlar' ? appliedListingFilters : appliedFilters;
    setDraftSortBy((sortSrc.sort_by as string) || '');
    setDraftSortDir(sortSrc.sort_dir === 'asc' ? 'asc' : 'desc');

    if (listMode === 'proSorgular') {
      const mapped = mapPortalQueryTypeToListingCategory(appliedFilters.query_type || '');
      const nextMain = appliedFilters.category_main || mapped.category_main || '';
      setDraftCity(appliedFilters.city_id ?? null);
      setDraftTown(appliedFilters.town_id ?? null);
      setDraftQuarter(appliedFilters.quarter_id ?? null);
      setDraftCategoryMain(nextMain);
      setDraftCategoryTypeIds(splitCsvIds(appliedFilters.category_type));
      setDraftCategoryLeafIds(splitCsvIds(appliedFilters.category_leaf_id));
      setExpandedCategoryRootId(nextMain || null);
      setDraftHisseli(appliedFilters.hisseli === '1');
      setDraftUnitPriceMin(numOrEmpty(appliedFilters.unit_price_min));
      setDraftUnitPriceMax(numOrEmpty(appliedFilters.unit_price_max));
      setDraftTotalPriceMin(numOrEmpty(appliedFilters.total_price_min));
      setDraftTotalPriceMax(numOrEmpty(appliedFilters.total_price_max));
      setDraftProExpertAnswered(appliedFilters.expert_status === 'ANSWERED');
      setDraftProPriceAdvantageOnly(appliedFilters.price_advantage_only === '1');
      setDraftAreaM2Min(numOrEmpty(appliedFilters.area_m2_min));
      setDraftAreaM2Max(numOrEmpty(appliedFilters.area_m2_max));
      setDraftProRoadMinM(numOrEmpty(appliedFilters.road_frontage_min_m));
      setDraftProRoadMaxM(numOrEmpty(appliedFilters.road_frontage_max_m));
      setDraftGmMin(numOrEmpty(appliedFilters.gm_min));
      setDraftGmMax(numOrEmpty(appliedFilters.gm_max));
      setDraftMetaMin('');
      setDraftMetaMax(normalizeStarScoreMaxChoice(appliedFilters.meta_max));
      setDraftPuanMin(numOrEmpty(appliedFilters.puan_min));
      setDraftPuanMax(numOrEmpty(appliedFilters.puan_max));
      setDraftProHasRoad(appliedFilters.listing_has_road || '');
      setDraftProHasWater(appliedFilters.listing_has_water || '');
      setDraftProHasPower(appliedFilters.listing_has_power_line || '');
      setDraftMaxNavCityM(numOrEmpty(appliedFilters.max_nav_city_m));
      setDraftMaxNavTownM(numOrEmpty(appliedFilters.max_nav_town_m));
      setDraftListingAttrJson(String(appliedListingFilters.listing_attr || '').trim());
    } else {
      const nextMain = appliedListingFilters.category_main || '';
      setDraftCity(appliedListingFilters.city_id ?? null);
      setDraftTown(appliedListingFilters.district_id ?? null);
      setDraftQuarter(appliedListingFilters.quarter_id ?? null);
      setDraftCategoryMain(nextMain);
      setDraftCategoryTypeIds(splitCsvIds(appliedListingFilters.category_type));
      setDraftCategoryLeafIds(splitCsvIds(appliedListingFilters.category_leaf_id));
      setExpandedCategoryRootId(nextMain || null);
      setDraftTotalPriceMin(numOrEmpty(appliedListingFilters.price_min_amount));
      setDraftTotalPriceMax(numOrEmpty(appliedListingFilters.price_max_amount));
      setDraftListingAreaMin(numOrEmpty(appliedListingFilters.area_min_m2));
      setDraftListingAreaMax(numOrEmpty(appliedListingFilters.area_max_m2));
      setDraftListingRoadMin(numOrEmpty(appliedListingFilters.road_frontage_min_m));
      setDraftListingRoadMax(numOrEmpty(appliedListingFilters.road_frontage_max_m));
      setDraftListingGmMin(numOrEmpty(appliedListingFilters.investment_score_min));
      setDraftListingGmMax(numOrEmpty(appliedListingFilters.investment_score_max));
      setDraftListingPuanMin(numOrEmpty(appliedListingFilters.rating_score_min));
      setDraftListingPuanMax(numOrEmpty(appliedListingFilters.rating_score_max));
      setDraftListingHasRoad(appliedListingFilters.listing_has_road || '');
      setDraftListingHasWater(appliedListingFilters.listing_has_water || '');
      setDraftListingHasPower(appliedListingFilters.listing_has_power_line || '');
      setDraftListingUnitPriceMin(numOrEmpty(appliedListingFilters.unit_price_min));
      setDraftListingUnitPriceMax(numOrEmpty(appliedListingFilters.unit_price_max));
      setDraftListingMetaMin('');
      setDraftListingMetaMax(normalizeStarScoreMaxChoice(appliedListingFilters.meta_max));
      setDraftListingHisseli(appliedListingFilters.hisseli === '1');
      setDraftListingExpertAnswered(appliedListingFilters.expert_answered === '1');
      setDraftListingPriceAdvantageOnly(appliedListingFilters.price_advantage_only === '1');
      setDraftMaxNavCityM(numOrEmpty(appliedListingFilters.max_nav_city_m));
      setDraftMaxNavTownM(numOrEmpty(appliedListingFilters.max_nav_town_m));
      setDraftListingAttrJson(String(appliedListingFilters.listing_attr || '').trim());
    }
  }, [filterSheetVisible, sortSheetVisible, listMode, appliedFilters, appliedListingFilters]);

  // ── Load list ──

  const loadList = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!isAuthenticated) return;

    if (!appliedFilters.city_id) {
      setItems([]);
      setTotalCount(0);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setInitialLoad(false);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setInitialLoad(true);
    }

    try {
      const params: PortalQueryListParams = {
        page: pageNum,
        page_size: PAGE_SIZE,
        mine: mineOnly,
        ...appliedFilters,
      };
      const sortByRaw = String(appliedFilters.sort_by || '').trim().toLowerCase();
      if (QUERY_API_SORT_FIELDS.has(sortByRaw)) {
        params.sort_by = sortByRaw;
        params.sort_dir = appliedFilters.sort_dir === 'asc' ? 'asc' : 'desc';
      } else {
        delete params.sort_by;
        delete params.sort_dir;
      }

      const res = await getPortalRecentQueries(params);

      if (res.ok && res.data) {
        const results = res.data.results ?? [];
        const total = res.data.total ?? 0;
        const pg = res.data.page ?? 1;
        const pgSize = res.data.page_size ?? PAGE_SIZE;
        const tp = pgSize > 0 ? Math.ceil(total / pgSize) : 1;
        console.log('[Son30Gun] API OK – total:', total, 'page:', pg, 'results:', results.length);
        if (append) {
          setItems((prev) => [...prev, ...results]);
        } else {
          setItems(results);
        }
        setTotalCount(total);
        setPage(pg);
        setTotalPages(tp);
      } else {
        console.warn('[Son30Gun] API FAIL:', !res.ok && 'error' in res ? res.error : 'unknown');
        if (!append) { setItems([]); setTotalCount(0); }
      }
    } catch (e) {
      console.warn('[Son30Gun] Liste hata:', e);
      if (!append) { setItems([]); setTotalCount(0); }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setInitialLoad(false);
    }
  }, [isAuthenticated, mineOnly, appliedFilters]);

  const loadListings = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!isAuthenticated) return;

      if (append) {
        setListingLoadingMore(true);
      } else {
        setLoading(true);
        setListingError(null);
        setListingInitialLoad(true);
      }

      try {
        const params: VitrinListingSearchParams = {
          page: pageNum,
          page_size: PAGE_SIZE,
          ...effectiveAppliedListingFilters,
        };
        const sortByRaw = String(effectiveAppliedListingFilters.sort_by || '').trim().toLowerCase();
        if (LISTING_API_SORT_FIELDS.has(sortByRaw)) {
          params.sort_by = sortByRaw;
          params.sort_dir = effectiveAppliedListingFilters.sort_dir === 'asc' ? 'asc' : 'desc';
        } else {
          delete params.sort_by;
          delete params.sort_dir;
        }
        const res = await getPublicVitrinListings(params);

        if (res.ok && res.data) {
          const body = res.data as {
            items?: VitrinListingItem[];
            pagination?: { total_count?: number; page?: number; page_size?: number };
          };
          const results = body.items ?? [];
          const total = body.pagination?.total_count ?? 0;
          const pg = body.pagination?.page ?? pageNum;
          const pgSize = body.pagination?.page_size ?? PAGE_SIZE;
          const tp = pgSize > 0 ? Math.ceil(total / pgSize) : 1;
          setListingError(null);
          if (append) {
            setListingItems((prev) => [...prev, ...results]);
          } else {
            setListingItems(results);
          }
          setListingTotal(total);
          setListingPage(pg);
          setListingTotalPages(tp);
        } else {
          const err = !res.ok ? res.error : 'Bilinmeyen hata';
          setListingError(err);
          if (!append) {
            setListingItems([]);
            setListingTotal(0);
          }
        }
      } catch (e) {
        console.warn('[Son30Gun] Vitrin liste hata:', e);
        setListingError('İlanlar yüklenemedi');
        if (!append) {
          setListingItems([]);
          setListingTotal(0);
        }
      } finally {
        setLoading(false);
        setListingLoadingMore(false);
        setRefreshing(false);
        setListingInitialLoad(false);
      }
    },
    [isAuthenticated, effectiveAppliedListingFilters],
  );

  useEffect(() => {
    if (listMode !== 'proSorgular') return;
    loadList(1, false);
  }, [listMode, loadList]);

  useEffect(() => {
    if (listMode !== 'ilanlar') return;
    loadListings(1, false);
  }, [listMode, loadListings]);

  useEffect(() => {
    if (routeName !== 'emlak-vitrini-liste') return;
    const next: VitrinListingSearchParams = {};
    const routeCategoryMain = routeParams.category_main || routeParams.categoryMain;
    const routeCategoryLeafId = routeParams.category_leaf_id || routeParams.categoryLeafId;
    const routeListingType = routeParams.listing_type || routeParams.listingType;
    const routeCityId = routeParams.city_id || routeParams.cityId;
    if (routeCategoryMain) next.category_main = routeCategoryMain;
    if (routeCategoryLeafId) next.category_leaf_id = routeCategoryLeafId;
    if (routeListingType) next.listing_type = routeListingType;
    if (routeCityId && Number.isFinite(Number(routeCityId))) {
      next.city_id = Number(routeCityId);
    }
    setListMode('ilanlar');
    setAppliedFilters({});
    setAppliedListingFilters(next);
    setMineOnly(false);
  }, [
    routeName,
    routeParams.categoryMain,
    routeParams.category_main,
    routeParams.categoryLeafId,
    routeParams.category_leaf_id,
    routeParams.cityId,
    routeParams.city_id,
    routeParams.listingType,
    routeParams.listing_type,
  ]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (listMode === 'ilanlar') loadListings(1, false);
    else loadList(1, false);
  }, [listMode, loadListings, loadList]);

  const handleLoadMore = useCallback(() => {
    if (listMode === 'ilanlar') {
      if (listingLoadingMore || listingPage >= listingTotalPages) return;
      loadListings(listingPage + 1, true);
      return;
    }
    if (loadingMore || page >= totalPages) return;
    loadList(page + 1, true);
  }, [
    listMode,
    listingLoadingMore,
    listingPage,
    listingTotalPages,
    loadListings,
    loadingMore,
    page,
    totalPages,
    loadList,
  ]);

  const handleCardPress = useCallback((item: PortalQueryListItem) => {
    router.push('son-30-gun-detay', { snapshotId: String(item.snapshot_id) });
  }, [router]);

  const handleListingPress = useCallback(
    (item: VitrinListingItem) => {
      const sid = item.portal_snapshot_id;
      if (sid != null && Number.isFinite(Number(sid))) {
        router.push('son-30-gun-detay', {
          snapshotId: String(sid),
          listingId: item.listing_id ? String(item.listing_id) : undefined,
        });
        return;
      }
      Alert.alert('Detay', 'Bu ilan için henüz Pro sorgu bağlantısı yok.');
    },
    [router],
  );

  // ── Apply filters from bottom sheet ──

  const handleApplyFilters = useCallback(() => {
    const laRaw = String(draftListingAttrJson || '').trim();
    let listingAttrNormalized: string | undefined;
    if (laRaw) {
      try {
        const parsed = JSON.parse(laRaw);
        if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          Alert.alert(
            'Kategori detayı',
            'Kategoriye özel filtre değeri doğrulanamadı. Alanları yeniden seçip tekrar deneyin.',
          );
          return;
        }
        listingAttrNormalized = JSON.stringify(parsed);
      } catch {
        Alert.alert('Kategori detayı', 'Kategoriye özel filtre değeri doğrulanamadı. Alanları yeniden seçip tekrar deneyin.');
        return;
      }
    }

    if (listMode === 'ilanlar') {
      const f: VitrinListingSearchParams = {};
      if (appliedListingFilters.sort_by) {
        f.sort_by = appliedListingFilters.sort_by;
        f.sort_dir = appliedListingFilters.sort_dir === 'asc' ? 'asc' : 'desc';
      }
      if (draftCity) f.city_id = draftCity;
      if (draftTown) f.district_id = draftTown;
      if (draftQuarter) f.quarter_id = draftQuarter;
      const pmin = parseOptFloat(draftTotalPriceMin);
      const pmax = parseOptFloat(draftTotalPriceMax);
      if (pmin != null) f.price_min_amount = pmin;
      if (pmax != null) f.price_max_amount = pmax;
      const amin = parseOptFloat(draftListingAreaMin);
      const amax = parseOptFloat(draftListingAreaMax);
      if (amin != null) f.area_min_m2 = amin;
      if (amax != null) f.area_max_m2 = amax;
      const rfMin = parseOptFloat(draftListingRoadMin);
      const rfMax = parseOptFloat(draftListingRoadMax);
      if (rfMin != null) f.road_frontage_min_m = rfMin;
      if (rfMax != null) f.road_frontage_max_m = rfMax;
      const gmi = parseOptFloat(draftListingGmMin);
      const gma = parseOptFloat(draftListingGmMax);
      if (gmi != null) f.investment_score_min = gmi;
      if (gma != null) f.investment_score_max = gma;
      const rmin = parseOptFloat(draftListingPuanMin);
      const rmax = parseOptFloat(draftListingPuanMax);
      if (rmin != null) f.rating_score_min = rmin;
      if (rmax != null) f.rating_score_max = rmax;
      if (draftCategoryMain) f.category_main = draftCategoryMain;
      if (draftCategoryTypeIds.length) f.category_type = draftCategoryTypeIds.join(',');
      if (draftCategoryLeafIds.length) f.category_leaf_id = draftCategoryLeafIds.join(',');
      const landCtx = {
        query_type: '',
        category_main: f.category_main,
        category_type: f.category_type,
        category_leaf_id: f.category_leaf_id,
      };
      if (isLandCategoryFiltersForListing(landCtx)) {
        if (draftListingHasRoad) f.listing_has_road = draftListingHasRoad;
        if (draftListingHasWater) f.listing_has_water = draftListingHasWater;
        if (draftListingHasPower) f.listing_has_power_line = draftListingHasPower;
      }
      const lupmin = parseOptFloat(draftListingUnitPriceMin);
      const lupmax = parseOptFloat(draftListingUnitPriceMax);
      if (lupmin != null) f.unit_price_min = lupmin;
      if (lupmax != null) f.unit_price_max = lupmax;
      const lme2 = parseOptFloat(draftListingMetaMax);
      if (lme2 != null) f.meta_max = lme2;
      if (draftListingHisseli) f.hisseli = '1';
      if (draftListingExpertAnswered) f.expert_answered = '1';
      if (draftListingPriceAdvantageOnly) f.price_advantage_only = '1';
      const navListC = parseOptFloat(draftMaxNavCityM);
      const navListT = parseOptFloat(draftMaxNavTownM);
      if (navListC != null) f.max_nav_city_m = navListC;
      if (navListT != null) f.max_nav_town_m = navListT;
      if (listingAttrNormalized) f.listing_attr = listingAttrNormalized;
      setAppliedListingFilters(f);
    } else {
      const f: PortalQueryListParams = {};
      if (appliedFilters.sort_by) {
        f.sort_by = appliedFilters.sort_by;
        f.sort_dir = appliedFilters.sort_dir === 'asc' ? 'asc' : 'desc';
      }
      if (draftCity) f.city_id = draftCity;
      if (draftTown) f.town_id = draftTown;
      if (draftQuarter) f.quarter_id = draftQuarter;
      if (draftCategoryMain) f.category_main = draftCategoryMain;
      if (draftCategoryTypeIds.length) f.category_type = draftCategoryTypeIds.join(',');
      if (draftCategoryLeafIds.length) f.category_leaf_id = draftCategoryLeafIds.join(',');
      if (draftHisseli) f.hisseli = '1';
      const upmin = parseOptFloat(draftUnitPriceMin);
      const upmax = parseOptFloat(draftUnitPriceMax);
      if (upmin != null) f.unit_price_min = upmin;
      if (upmax != null) f.unit_price_max = upmax;
      const tpmin = parseOptFloat(draftTotalPriceMin);
      const tpmax = parseOptFloat(draftTotalPriceMax);
      if (tpmin != null) f.total_price_min = tpmin;
      if (tpmax != null) f.total_price_max = tpmax;
      if (draftProExpertAnswered) f.expert_status = 'ANSWERED';
      if (draftProPriceAdvantageOnly) f.price_advantage_only = '1';
      const a1 = parseOptFloat(draftAreaM2Min);
      const a2 = parseOptFloat(draftAreaM2Max);
      if (a1 != null) f.area_m2_min = a1;
      if (a2 != null) f.area_m2_max = a2;
      const prf1 = parseOptFloat(draftProRoadMinM);
      const prf2 = parseOptFloat(draftProRoadMaxM);
      if (prf1 != null) f.road_frontage_min_m = prf1;
      if (prf2 != null) f.road_frontage_max_m = prf2;
      const gm1 = parseOptFloat(draftGmMin);
      const gm2 = parseOptFloat(draftGmMax);
      if (gm1 != null) f.gm_min = gm1;
      if (gm2 != null) f.gm_max = gm2;
      const me2 = parseOptFloat(draftMetaMax);
      if (me2 != null) f.meta_max = me2;
      const pu1 = parseOptFloat(draftPuanMin);
      const pu2 = parseOptFloat(draftPuanMax);
      if (pu1 != null) f.puan_min = pu1;
      if (pu2 != null) f.puan_max = pu2;
      if (isLandCategoryFiltersForListing({
        query_type: '',
        category_main: draftCategoryMain,
        category_type: draftCategoryTypeIds.join(','),
        category_leaf_id: draftCategoryLeafIds.join(','),
      })) {
        if (draftProHasRoad) f.listing_has_road = draftProHasRoad;
        if (draftProHasWater) f.listing_has_water = draftProHasWater;
        if (draftProHasPower) f.listing_has_power_line = draftProHasPower;
      }
      const navProC = parseOptFloat(draftMaxNavCityM);
      const navProT = parseOptFloat(draftMaxNavTownM);
      if (navProC != null) f.max_nav_city_m = navProC;
      if (navProT != null) f.max_nav_town_m = navProT;
      setAppliedFilters(f);
      setAppliedListingFilters((prev) => {
        const next = { ...prev };
        if (listingAttrNormalized) next.listing_attr = listingAttrNormalized;
        else delete next.listing_attr;
        return next;
      });
    }
    setFilterSheetVisible(false);
  }, [
    listMode,
    draftCity,
    draftTown,
    draftQuarter,
    draftCategoryMain,
    draftCategoryTypeIds,
    draftCategoryLeafIds,
    draftHisseli,
    draftUnitPriceMin,
    draftUnitPriceMax,
    draftTotalPriceMin,
    draftTotalPriceMax,
    draftProExpertAnswered,
    draftListingExpertAnswered,
    draftProPriceAdvantageOnly,
    draftListingPriceAdvantageOnly,
    draftAreaM2Min,
    draftAreaM2Max,
    draftProRoadMinM,
    draftProRoadMaxM,
    draftGmMin,
    draftGmMax,
    draftMetaMin,
    draftMetaMax,
    draftPuanMin,
    draftPuanMax,
    draftProHasRoad,
    draftProHasWater,
    draftProHasPower,
    draftListingAreaMin,
    draftListingAreaMax,
    draftListingRoadMin,
    draftListingRoadMax,
    draftListingGmMin,
    draftListingGmMax,
    draftListingPuanMin,
    draftListingPuanMax,
    draftListingHasRoad,
    draftListingHasWater,
    draftListingHasPower,
    draftListingUnitPriceMin,
    draftListingUnitPriceMax,
    draftListingMetaMin,
    draftListingMetaMax,
    draftListingHisseli,
    draftMaxNavCityM,
    draftMaxNavTownM,
    draftListingAttrJson,
    appliedFilters.sort_by,
    appliedFilters.sort_dir,
    appliedListingFilters.sort_by,
    appliedListingFilters.sort_dir,
  ]);

  const handleApplySort = useCallback(() => {
    const resolvedSortDir: 'asc' | 'desc' = draftSortBy === 'date_asc'
      ? 'asc'
      : draftSortBy === 'date_desc'
        ? 'desc'
        : draftSortDir;
    if (listMode === 'ilanlar') {
      setAppliedListingFilters((prev) => {
        const next: VitrinListingSearchParams = { ...prev };
        if (draftSortBy) {
          next.sort_by = draftSortBy;
          next.sort_dir = resolvedSortDir;
        } else {
          delete next.sort_by;
          delete next.sort_dir;
        }
        return next;
      });
    } else {
      setAppliedFilters((prev) => {
        const next: PortalQueryListParams = { ...prev };
        if (draftSortBy) {
          next.sort_by = draftSortBy;
          next.sort_dir = resolvedSortDir;
        } else {
          delete next.sort_by;
          delete next.sort_dir;
        }
        return next;
      });
    }
    setSortSheetVisible(false);
  }, [listMode, draftSortBy, draftSortDir]);

  const handleClearSort = useCallback(() => {
    setDraftSortBy('');
    setDraftSortDir('desc');
    if (listMode === 'ilanlar') {
      setAppliedListingFilters((prev) => {
        const next: VitrinListingSearchParams = { ...prev };
        delete next.sort_by;
        delete next.sort_dir;
        return next;
      });
    } else {
      setAppliedFilters((prev) => {
        const next: PortalQueryListParams = { ...prev };
        delete next.sort_by;
        delete next.sort_dir;
        return next;
      });
    }
    setSortSheetVisible(false);
  }, [listMode]);

  const handleClearFilters = useCallback(() => {
    setDraftCity(null);
    setDraftTown(null);
    setDraftQuarter(null);
    setDraftCategoryMain('');
    setDraftCategoryTypeIds([]);
    setDraftCategoryLeafIds([]);
    setExpandedCategoryRootId(null);
    setDraftHisseli(false);
    setDraftUnitPriceMin('');
    setDraftUnitPriceMax('');
    setDraftTotalPriceMin('');
    setDraftTotalPriceMax('');
    setDraftProExpertAnswered(false);
    setDraftListingExpertAnswered(false);
    setDraftProPriceAdvantageOnly(false);
    setDraftListingPriceAdvantageOnly(false);
    setDraftAreaM2Min('');
    setDraftAreaM2Max('');
    setDraftProRoadMinM('');
    setDraftProRoadMaxM('');
    setDraftGmMin('');
    setDraftGmMax('');
    setDraftMetaMin('');
    setDraftMetaMax('');
    setDraftPuanMin('');
    setDraftPuanMax('');
    setDraftProHasRoad('');
    setDraftProHasWater('');
    setDraftProHasPower('');
    setDraftListingAreaMin('');
    setDraftListingAreaMax('');
    setDraftListingRoadMin('');
    setDraftListingRoadMax('');
    setDraftListingGmMin('');
    setDraftListingGmMax('');
    setDraftListingPuanMin('');
    setDraftListingPuanMax('');
    setDraftListingHasRoad('');
    setDraftListingHasWater('');
    setDraftListingHasPower('');
    setDraftListingUnitPriceMin('');
    setDraftListingUnitPriceMax('');
    setDraftListingMetaMin('');
    setDraftListingMetaMax('');
    setDraftListingHisseli(false);
    setDraftMaxNavCityM('');
    setDraftMaxNavTownM('');
    setDraftListingAttrJson('');
    if (listMode === 'ilanlar') {
      setAppliedListingFilters((prev) => {
        const next: VitrinListingSearchParams = {};
        if (prev.sort_by) {
          next.sort_by = prev.sort_by;
          next.sort_dir = prev.sort_dir === 'asc' ? 'asc' : 'desc';
        }
        return next;
      });
    } else {
      setAppliedFilters((prev) => {
        const next: PortalQueryListParams = {};
        if (prev.sort_by) {
          next.sort_by = prev.sort_by;
          next.sort_dir = prev.sort_dir === 'asc' ? 'asc' : 'desc';
        }
        return next;
      });
    }
  }, [listMode]);

  const handleListingScopeCity = useCallback((cityId: number) => {
    setAppliedListingFilters((prev) => {
      const next: VitrinListingSearchParams = { ...prev };
      next.city_id = cityId;
      delete next.district_id;
      delete next.quarter_id;
      return next;
    });
    setDraftCity(cityId);
    setDraftTown(null);
    setDraftQuarter(null);
  }, []);

  const handleListingScopeDistrict = useCallback((cityId: number, districtId: number) => {
    setAppliedListingFilters((prev) => {
      const next: VitrinListingSearchParams = { ...prev };
      next.city_id = cityId;
      next.district_id = districtId;
      delete next.quarter_id;
      return next;
    });
    setDraftCity(cityId);
    setDraftTown(districtId);
    setDraftQuarter(null);
  }, []);

  // ── City / Town / Quarter picker items for FilterPickerRow ──

  const cityPickerItems = useMemo<FilterPickerItem[]>(() => [
    { value: '', label: 'Tümü' },
    ...cities.map((c) => ({ value: c.id, label: `${c.name} (${c.count})` })),
  ], [cities]);

  const townPickerItems = useMemo<FilterPickerItem[]>(() => [
    { value: '', label: 'Tümü' },
    ...towns.map((t) => ({ value: t.id, label: `${t.name} (${t.count})` })),
  ], [towns]);

  const quarterPickerItems = useMemo<FilterPickerItem[]>(() => [
    { value: '', label: 'Tümü' },
    ...quarters.map((q) => ({ value: q.id, label: `${q.name} (${q.count})` })),
  ], [quarters]);

  const listingLocationScope = useMemo(() => {
    if (listMode !== 'ilanlar') return null;
      const af = effectiveAppliedListingFilters || {};
    const first = listingItems[0];

    if (af.city_id != null) {
      const c = cities.find((x) => x.id === af.city_id);
      const t = af.district_id != null ? scopeTowns.find((x) => x.id === af.district_id) : undefined;
      const q = af.quarter_id != null ? scopeQuarters.find((x) => x.id === af.quarter_id) : undefined;
      return {
        cityName: c?.name ?? '',
        districtName: t?.name ?? '',
        quarterName: q?.name ?? '',
        cityId: af.city_id,
        districtId: af.district_id ?? null,
        quarterId: af.quarter_id ?? null,
      };
    }

    if (first) {
      const parts = parseLocationLabelParts(first.location_labels);
      return {
        cityName: parts.city,
        districtName: parts.district,
        quarterName: parts.quarter,
        cityId: normalizeListingLocId(first.city_id),
        districtId: normalizeListingLocId(first.district_id),
        quarterId: normalizeListingLocId(first.quarter_id),
      };
    }
    return null;
  }, [listMode, effectiveAppliedListingFilters, listingItems, cities, scopeTowns, scopeQuarters]);

  // ── Render helpers ──

  const renderQueryItem = useCallback(
    ({ item }: { item: PortalQueryListItem }) => <QueryCard item={item} onPress={() => handleCardPress(item)} />,
    [handleCardPress],
  );

  const renderListingItem = useCallback(
    ({ item }: { item: VitrinListingItem }) => (
      <VitrinListingCard item={item} onPress={() => handleListingPress(item)} />
    ),
    [handleListingPress],
  );

  const keyExtractorQuery = useCallback((item: PortalQueryListItem, index: number) =>
    item.snapshot_id != null ? String(item.snapshot_id) : `q-${index}`, []);

  const keyExtractorListing = useCallback((item: VitrinListingItem, index: number) =>
    item.listing_id ? String(item.listing_id) : `l-${index}`, []);

  const showListingLocationScopeBar = useMemo(() => {
    if (listMode !== 'ilanlar') return false;
    const scope = listingLocationScope;
    return !!(scope && (scope.cityName || scope.districtName || scope.quarterName) && !listingInitialLoad);
  }, [listMode, listingLocationScope, listingInitialLoad]);

  const ListHeader = useMemo(() => {
    if (listMode === 'ilanlar') {
      if (!loading && !listingInitialLoad && listingTotal > 0) {
        return (
          <View style={styles.resultCountWrap}>
            <Text style={styles.resultCount}>{listingTotal} ilan bulundu</Text>
          </View>
        );
      }
      return null;
    }
    if (!loading && !initialLoad && totalCount > 0) {
      return (
        <View style={styles.resultCountWrap}>
          <Text style={styles.resultCount}>{totalCount} sorgu bulundu</Text>
        </View>
      );
    }
    return null;
  }, [listMode, loading, listingInitialLoad, listingTotal, initialLoad, totalCount]);

  const ListFooter = useMemo(() => {
    if (listMode === 'ilanlar' && listingLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
          <Text style={styles.footerText}>Yükleniyor...</Text>
        </View>
      );
    }
    if (listMode === 'proSorgular' && loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
          <Text style={styles.footerText}>Yükleniyor...</Text>
        </View>
      );
    }
    return <View style={{ height: 8 }} />;
  }, [listMode, listingLoadingMore, loadingMore]);

  const ListEmpty = useMemo(() => {
    if (listMode === 'ilanlar') {
      if (loading && listingInitialLoad) return <PlaceholderList />;
      if (listingError) {
        const low = listingError.toLowerCase();
        const is404 = low.includes('404') || low.includes('not found');
        return (
          <PlaceholderList message={is404 ? 'Vitrin ilan araması şu an kullanılamıyor.' : listingError} />
        );
      }
      if (displayListingItems.length === 0 && !loading) {
        return <PlaceholderList message="Bu filtreyle ilan bulunamadı" />;
      }
      return <PlaceholderList message="İlan bulunamadı" />;
    }
    if (loading) return <PlaceholderList />;
    if (!appliedFilters.city_id) return <PlaceholderList message="Sorguları görmek için filtreden il seçin" />;
    return <PlaceholderList message="Bu filtreyle sonuç bulunamadı" />;
  }, [listMode, loading, listingInitialLoad, listingError, displayListingItems.length, appliedFilters.city_id]);
  const listModeNoticeText = listMode === 'ilanlar'
    ? 'Emlak Ilanlari Listelenmektedir'
    : 'Son 30 Gun Icinde Yapilan Pro Sorgu Sonuclari Listelenmektedir';

  // ── Render ──

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* ── Header (matches other screens) ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emlak Vitrini</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Action Bar ── */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionChip, activeFilterCount > 0 && styles.actionChipActive]}
          onPress={() => setFilterSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={16} color={activeFilterCount > 0 ? '#fff' : 'rgba(255,255,255,0.7)'} />
          <Text style={[styles.actionChipText, activeFilterCount > 0 && styles.actionChipTextActive]}>
            Filtre{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, !!activeSortBy && styles.actionChipActive]}
          onPress={() => setSortSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-vertical-outline" size={16} color={activeSortBy ? '#fff' : 'rgba(255,255,255,0.7)'} />
          <Text style={[styles.actionChipText, !!activeSortBy && styles.actionChipTextActive]}>Sıralama</Text>
        </TouchableOpacity>

        {listMode === 'proSorgular' ? (
          <TouchableOpacity
            style={[styles.actionChip, mineOnly && styles.actionChipActive]}
            onPress={() => setMineOnly((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={16} color={mineOnly ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text style={[styles.actionChipText, mineOnly && styles.actionChipTextActive]}>Benim</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      <View style={[styles.modeNoticeBar, listMode === 'ilanlar' ? styles.modeNoticeBarListing : styles.modeNoticeBarQuery]}>
        <View style={[styles.modeNoticeDot, listMode === 'ilanlar' ? styles.modeNoticeDotListing : styles.modeNoticeDotQuery]} />
        <Text style={styles.modeNoticeText}>{listModeNoticeText}</Text>
      </View>

      {isPriceAdvantageOnlyActive ? (
        <View style={styles.activeSummaryBar}>
          <View style={styles.activeSummaryChip}>
            <Ionicons name="pricetag-outline" size={14} color={COLORS.accentBlue} />
            <Text style={styles.activeSummaryChipText}>Sadece fiyat avantajı</Text>
          </View>
        </View>
      ) : null}

      {listMode === 'ilanlar' && showListingLocationScopeBar && listingLocationScope ? (
        <ListingLocationScopeBar
          cityName={listingLocationScope.cityName}
          districtName={listingLocationScope.districtName}
          quarterName={listingLocationScope.quarterName}
          cityId={listingLocationScope.cityId}
          districtId={listingLocationScope.districtId}
          onPressCity={handleListingScopeCity}
          onPressDistrict={handleListingScopeDistrict}
        />
      ) : null}

      {/* ── List (placeholder skeleton + üstte yükleme overlay) ── */}
      <View style={styles.listWrap}>
        <FlatList
          data={(listMode === 'ilanlar' ? displayListingItems : displayQueryItems) as any}
          renderItem={listMode === 'ilanlar' ? (renderListingItem as any) : (renderQueryItem as any)}
          keyExtractor={listMode === 'ilanlar' ? (keyExtractorListing as any) : (keyExtractorQuery as any)}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={
            listMode === 'ilanlar'
              ? [styles.listContent, styles.listContentVitrin]
              : styles.listContent
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.accentBlue]} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
        {(listMode === 'ilanlar' && loading && listingInitialLoad) ||
        (listMode === 'proSorgular' && loading && initialLoad) ? (
          <View style={styles.listLoadingOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={COLORS.accentBlue} />
          </View>
        ) : null}
      </View>

      {/* ── Filter Bottom Sheet ── */}
      <AppBottomSheetModal
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        snapPoints={['87%']}
        backdropOpacity={0.25}
        backdropPressBehavior="close"
      >
        <View style={styles.sheetHeader}>
          <View style={styles.sheetSegmentRow}>
            <TouchableOpacity
              style={[
                styles.sheetSegBtn,
                listMode === 'ilanlar' && {
                  backgroundColor: getModeAccent('ilanlar').segBg,
                  borderColor: getModeAccent('ilanlar').segBorder,
                },
              ]}
              onPress={() => setListMode('ilanlar')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.sheetSegBtnText,
                  listMode === 'ilanlar' && { color: getModeAccent('ilanlar').text, fontWeight: '800' },
                ]}
              >
                İlanlar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sheetSegBtn,
                listMode === 'proSorgular' && {
                  backgroundColor: getModeAccent('proSorgular').segBg,
                  borderColor: getModeAccent('proSorgular').segBorder,
                },
              ]}
              onPress={() => setListMode('proSorgular')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.sheetSegBtnText,
                  listMode === 'proSorgular' && { color: getModeAccent('proSorgular').text, fontWeight: '800' },
                ]}
              >
                ProSorgular
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleClearFilters}>
            <Text style={styles.sheetClearText}>Temizle</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView style={styles.sheetScroll} contentContainerStyle={{ paddingBottom: 150 }} bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetSectionTitle}>Konum Seç</Text>
          <FilterPickerRow
            label=""
            items={cityPickerItems}
            selectedValue={draftCity}
            onSelect={(v) => setDraftCity(v as number | null)}
            loading={citiesLoading}
          />
          <FilterPickerRow
            label=""
            items={townPickerItems}
            selectedValue={draftTown}
            onSelect={(v) => setDraftTown(v as number | null)}
            loading={townsLoading}
            disabled={!draftCity}
          />
          <FilterPickerRow
            label=""
            items={quarterPickerItems}
            selectedValue={draftQuarter}
            onSelect={(v) => setDraftQuarter(v as number | null)}
            loading={quartersLoading}
            disabled={!draftTown}
          />

          <CategoryTreeFilter
            rootNodes={categoryRootNodes}
            childNodesByRoot={categoryChildrenByRoot}
            loading={categoryTreeLoading}
            listMode={listMode}
            expandedRootId={expandedCategoryRootId}
            selectedMainId={draftCategoryMain}
            selectedBranchIds={draftCategoryTypeIds}
            selectedLeafIds={draftCategoryLeafIds}
            onReset={() => {
              setDraftCategoryMain('');
              setDraftCategoryTypeIds([]);
              setDraftCategoryLeafIds([]);
              setExpandedCategoryRootId(null);
            }}
            onToggleRoot={(rootId) => {
              setExpandedCategoryRootId((prev) => (prev === rootId ? null : rootId));
            }}
            onSelectMain={(rootId) => {
              setDraftCategoryMain(rootId);
              setDraftCategoryTypeIds([]);
              setDraftCategoryLeafIds([]);
              setExpandedCategoryRootId(rootId);
            }}
            onToggleChild={(node, rootId) => {
              setDraftCategoryMain(rootId);
              setExpandedCategoryRootId(rootId);
              if (node.is_leaf) {
                setDraftCategoryLeafIds((prev) => (
                  prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
                ));
                setDraftCategoryTypeIds([]);
              } else {
                setDraftCategoryTypeIds((prev) => (
                  prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
                ));
                setDraftCategoryLeafIds([]);
              }
            }}
          />

          <ListingAttrFiltersSection
            categoryMain={draftCategoryMain}
            categoryTypeIds={draftCategoryTypeIds}
            categoryLeafIds={draftCategoryLeafIds}
            listMode={listMode}
            listingAttrJson={draftListingAttrJson}
            onChange={setDraftListingAttrJson}
          />

          <Text style={styles.sheetSectionTitle}>Merkez rota mesafesi</Text>
          <FilterPickerRow
            label="Şehir merkezine (max)"
            items={NAV_ROUTE_MAX_OPTIONS}
            selectedValue={draftMaxNavCityM}
            onSelect={(v) => setDraftMaxNavCityM(v != null && v !== '' ? String(v) : '')}
            disabled={!draftCity}
          />
          <FilterPickerRow
            label="İlçe merkezine (max)"
            items={NAV_ROUTE_MAX_OPTIONS}
            selectedValue={draftMaxNavTownM}
            onSelect={(v) => setDraftMaxNavTownM(v != null && v !== '' ? String(v) : '')}
            disabled={!draftTown}
          />

          {listMode === 'proSorgular' ? (
            <>
              <View style={styles.sheetSwitchRow}>
                <Text style={styles.sheetSwitchLabel}>Hisseli parsel</Text>
                <Switch
                  value={draftHisseli}
                  onValueChange={setDraftHisseli}
                  trackColor={{ false: COLORS.borderSoft, true: COLORS.accentBlue + '60' }}
                  thumbColor={draftHisseli ? COLORS.accentBlue : '#f4f3f4'}
                />
              </View>

              <PriceRangeRow
                label="m² aralığı (sorgu)"
                minVal={draftAreaM2Min}
                maxVal={draftAreaM2Max}
                onMinChange={setDraftAreaM2Min}
                onMaxChange={setDraftAreaM2Max}
                placeholder={{ min: 'Min m²', max: 'Max m²' }}
              />
              <PriceRangeRow
                label="Yola cephe (m)"
                minVal={draftProRoadMinM}
                maxVal={draftProRoadMaxM}
                onMinChange={setDraftProRoadMinM}
                onMaxChange={setDraftProRoadMaxM}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <PriceRangeRow
                label="m² Fiyat (₺/m²)"
                minVal={draftUnitPriceMin}
                maxVal={draftUnitPriceMax}
                onMinChange={setDraftUnitPriceMin}
                onMaxChange={setDraftUnitPriceMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <PriceRangeRow
                label="Toplam Fiyat (₺)"
                minVal={draftTotalPriceMin}
                maxVal={draftTotalPriceMax}
                onMinChange={setDraftTotalPriceMin}
                onMaxChange={setDraftTotalPriceMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <FilterPickerRow
                label="Genel puan — yıldız"
                items={STAR_SCORE_MAX_OPTIONS}
                selectedValue={draftMetaMax}
                onSelect={(v) => {
                  setDraftMetaMin('');
                  setDraftMetaMax((v as string) || '');
                }}
              />
              <PriceRangeRow
                label="Mülk skoru (0–100)"
                minVal={draftGmMin}
                maxVal={draftGmMax}
                onMinChange={setDraftGmMin}
                onMaxChange={setDraftGmMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <PriceRangeRow
                label="Kullanıcı puanı % (0–100)"
                minVal={draftPuanMin}
                maxVal={draftPuanMax}
                onMinChange={setDraftPuanMin}
                onMaxChange={setDraftPuanMax}
                placeholder={{ min: 'Min %', max: 'Max %' }}
              />

              {isLandCategoryFiltersForListing({
                query_type: '',
                category_main: draftCategoryMain,
                category_type: draftCategoryTypeIds.join(','),
                category_leaf_id: draftCategoryLeafIds.join(','),
              }) ? (
                <>
                  <Text style={styles.sheetSectionTitle}>Arazi — altyapı (ilan)</Text>
                  <FilterPickerRow
                    label="Yol"
                    items={LAND_INFRA_TRI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    selectedValue={draftProHasRoad}
                    onSelect={(v) => setDraftProHasRoad((v as string) || '')}
                  />
                  <FilterPickerRow
                    label="Su"
                    items={LAND_INFRA_TRI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    selectedValue={draftProHasWater}
                    onSelect={(v) => setDraftProHasWater((v as string) || '')}
                  />
                  <FilterPickerRow
                    label="Elektrik hattı"
                    items={LAND_INFRA_TRI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    selectedValue={draftProHasPower}
                    onSelect={(v) => setDraftProHasPower((v as string) || '')}
                  />
                </>
              ) : null}

              <View style={styles.sheetSwitchRow}>
                <Text style={styles.sheetSwitchLabel}>Uzman Talebi</Text>
                <Switch
                  value={draftProExpertAnswered}
                  onValueChange={setDraftProExpertAnswered}
                  trackColor={{ false: COLORS.borderSoft, true: COLORS.accentBlue + '60' }}
                  thumbColor={draftProExpertAnswered ? COLORS.accentBlue : '#f4f3f4'}
                />
              </View>
              <View style={styles.sheetSwitchRow}>
                <Text style={styles.sheetSwitchLabel}>Fiyat Avantajı</Text>
                <Switch
                  value={draftProPriceAdvantageOnly}
                  onValueChange={setDraftProPriceAdvantageOnly}
                  trackColor={{ false: COLORS.borderSoft, true: COLORS.accentBlue + '60' }}
                  thumbColor={draftProPriceAdvantageOnly ? COLORS.accentBlue : '#f4f3f4'}
                />
              </View>
              <Text style={styles.sheetHelperText}>Yalnızca sistemine göre avantajlı görünen kayıtları getirir.</Text>
            </>
          ) : (
            <>
              <View style={styles.sheetSwitchRow}>
                <Text style={styles.sheetSwitchLabel}>Hisseli parsel</Text>
                <Switch
                  value={draftListingHisseli}
                  onValueChange={setDraftListingHisseli}
                  trackColor={{ false: COLORS.borderSoft, true: COLORS.accentBlue + '60' }}
                  thumbColor={draftListingHisseli ? COLORS.accentBlue : '#f4f3f4'}
                />
              </View>
              <View style={styles.sheetSwitchRow}>
                <Text style={styles.sheetSwitchLabel}>Uzman Talebi</Text>
                <Switch
                  value={draftListingExpertAnswered}
                  onValueChange={setDraftListingExpertAnswered}
                  trackColor={{ false: COLORS.borderSoft, true: COLORS.accentBlue + '60' }}
                  thumbColor={draftListingExpertAnswered ? COLORS.accentBlue : '#f4f3f4'}
                />
              </View>
              <View style={styles.sheetSwitchRow}>
                <Text style={styles.sheetSwitchLabel}>Fiyat Avantajı</Text>
                <Switch
                  value={draftListingPriceAdvantageOnly}
                  onValueChange={setDraftListingPriceAdvantageOnly}
                  trackColor={{ false: COLORS.borderSoft, true: COLORS.accentBlue + '60' }}
                  thumbColor={draftListingPriceAdvantageOnly ? COLORS.accentBlue : '#f4f3f4'}
                />
              </View>
              <Text style={styles.sheetHelperText}>Yalnızca fiyat avantajı taşıyan ilanları getirir.</Text>
              <PriceRangeRow
                label="İlan toplam fiyat (₺)"
                minVal={draftTotalPriceMin}
                maxVal={draftTotalPriceMax}
                onMinChange={setDraftTotalPriceMin}
                onMaxChange={setDraftTotalPriceMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <PriceRangeRow
                label="m² fiyat (₺/m²)"
                minVal={draftListingUnitPriceMin}
                maxVal={draftListingUnitPriceMax}
                onMinChange={setDraftListingUnitPriceMin}
                onMaxChange={setDraftListingUnitPriceMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <PriceRangeRow
                label="Alan (m²)"
                minVal={draftListingAreaMin}
                maxVal={draftListingAreaMax}
                onMinChange={setDraftListingAreaMin}
                onMaxChange={setDraftListingAreaMax}
                placeholder={{ min: 'Min m²', max: 'Max m²' }}
              />
              <PriceRangeRow
                label="Yola cephe (m)"
                minVal={draftListingRoadMin}
                maxVal={draftListingRoadMax}
                onMinChange={setDraftListingRoadMin}
                onMaxChange={setDraftListingRoadMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <FilterPickerRow
                label="Genel puan — yıldız"
                items={STAR_SCORE_MAX_OPTIONS}
                selectedValue={draftListingMetaMax}
                onSelect={(v) => {
                  setDraftListingMetaMin('');
                  setDraftListingMetaMax((v as string) || '');
                }}
              />
              <PriceRangeRow
                label="Mülk skoru GM (0–100)"
                minVal={draftListingGmMin}
                maxVal={draftListingGmMax}
                onMinChange={setDraftListingGmMin}
                onMaxChange={setDraftListingGmMax}
                placeholder={{ min: 'Min', max: 'Max' }}
              />
              <PriceRangeRow
                label="Kullanıcı puanı % (0–100)"
                minVal={draftListingPuanMin}
                maxVal={draftListingPuanMax}
                onMinChange={setDraftListingPuanMin}
                onMaxChange={setDraftListingPuanMax}
                placeholder={{ min: 'Min %', max: 'Max %' }}
              />
              {isLandCategoryFiltersForListing({
                query_type: '',
                category_main: draftCategoryMain,
                category_type: draftCategoryTypeIds.join(','),
                category_leaf_id: draftCategoryLeafIds.join(','),
              }) ? (
                <>
                  <Text style={styles.sheetSectionTitle}>Arazi — altyapı</Text>
                  <FilterPickerRow
                    label="Yol"
                    items={LAND_INFRA_TRI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    selectedValue={draftListingHasRoad}
                    onSelect={(v) => setDraftListingHasRoad((v as string) || '')}
                  />
                  <FilterPickerRow
                    label="Su"
                    items={LAND_INFRA_TRI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    selectedValue={draftListingHasWater}
                    onSelect={(v) => setDraftListingHasWater((v as string) || '')}
                  />
                  <FilterPickerRow
                    label="Elektrik hattı"
                    items={LAND_INFRA_TRI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    selectedValue={draftListingHasPower}
                    onSelect={(v) => setDraftListingHasPower((v as string) || '')}
                  />
                </>
              ) : null}
            </>
          )}

        </BottomSheetScrollView>

        {/* Ara button - fixed at bottom */}
        <View style={styles.sheetFooter}>
          <TouchableOpacity style={styles.searchBtn} onPress={handleApplyFilters} activeOpacity={0.8}>
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.searchBtnText}>Ara</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        visible={sortSheetVisible}
        onClose={() => setSortSheetVisible(false)}
        snapPoints={['70%']}
        backdropOpacity={0.25}
        backdropPressBehavior="close"
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Sıralama</Text>
          <TouchableOpacity onPress={handleClearSort}>
            <Text style={styles.sheetClearText}>Temizle</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.sheetScroll}
          contentContainerStyle={{ paddingBottom: 130 }}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <FilterPickerRow
            label="Sıralama türü"
            items={SORT_FIELD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selectedValue={draftSortBy}
            onSelect={(v) => {
              const next = v != null && v !== '' ? String(v) : '';
              setDraftSortBy(next);
              if (next === 'date_desc') setDraftSortDir('desc');
              if (next === 'date_asc') setDraftSortDir('asc');
            }}
          />
          <FilterPickerRow
            label="Yön"
            items={SORT_DIR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selectedValue={draftSortDir}
            onSelect={(v) => setDraftSortDir(v === 'asc' ? 'asc' : 'desc')}
            disabled={!draftSortBy || draftSortBy === 'date_desc' || draftSortBy === 'date_asc'}
          />
        </BottomSheetScrollView>

        <View style={styles.sheetFooter}>
          <TouchableOpacity style={styles.searchBtn} onPress={handleApplySort} activeOpacity={0.8}>
            <Ionicons name="swap-vertical-outline" size={18} color="#fff" />
            <Text style={styles.searchBtnText}>Sıralamayı Uygula</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheetModal>

      {/* ── User Menu ── */}
      <UserMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentScreen={routeName === 'emlak-vitrini' || routeName === 'emlak-vitrini-liste' ? 'emlak-vitrini' : 'son-30-gun-pro'}
      />
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.headerBg },

  // Header (matches other screens)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.accentBlue,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.actionBarBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
  },
  actionChipActive: {
    backgroundColor: COLORS.chipActiveBg,
    borderColor: COLORS.chipActiveBg,
  },
  actionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  actionChipTextActive: {
    color: '#fff',
  },
  modeNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modeNoticeBarQuery: {
    backgroundColor: '#eff6ff',
    borderBottomColor: '#bfdbfe',
  },
  modeNoticeBarListing: {
    backgroundColor: '#fffbeb',
    borderBottomColor: '#fde68a',
  },
  modeNoticeDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  modeNoticeDotQuery: {
    backgroundColor: '#2563eb',
  },
  modeNoticeDotListing: {
    backgroundColor: '#f59e0b',
  },
  modeNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  activeSummaryBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.actionBarBg,
  },
  activeSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  activeSummaryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accentBlue,
  },

  // List
  loadingContainer: { flex: 1, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary },
  listWrap: { flex: 1, position: 'relative' as const },
  listLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  listContent: { backgroundColor: COLORS.pageBg, flexGrow: 1, paddingTop: 0, paddingBottom: 8, paddingHorizontal: 0 },
  /** Emlak vitrini listesi — ana sayfa / header ile uyumlu lacivert zemin */
  listContentVitrin: { backgroundColor: "#0f172a" },
  resultCountWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  resultCount: { fontSize: 12, color: COLORS.textSecondary },
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  footerText: { fontSize: 13, color: COLORS.textSecondary },

  // Filter bottom sheet
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    gap: 10,
  },
  sheetSegmentRow: { flex: 1, flexDirection: 'row', gap: 8 },
  sheetSegBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    alignItems: 'center',
    backgroundColor: COLORS.pageBg,
  },
  sheetSegBtnActive: {
    backgroundColor: COLORS.accentBlue + '12',
    borderColor: COLORS.accentBlue + '55',
  },
  sheetSegBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  sheetSegBtnTextActive: { color: COLORS.accentBlue, fontWeight: '800' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  sheetClearText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  sheetScroll: { paddingHorizontal: 20, paddingTop: 16 },
  sheetSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  sheetSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingVertical: 4,
  },
  sheetSwitchLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  sheetHelperText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
    marginTop: -6,
    marginBottom: 14,
  },
  sheetFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    backgroundColor: COLORS.cardBg,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 12,
    paddingVertical: 14,
  },
  searchBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
