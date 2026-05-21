import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  StatusBar,
  TextInput,
  Dimensions,
  Modal,
  Share,
  Pressable,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppBottomSheetModal from '../../components/app/AppBottomSheetModal';
import UserMenuModal from '../../components/app/UserMenuModal';
import ListingFavoriteMenuMobile from '../../components/app/ListingFavoriteMenuMobile';
import QueryFavoriteMenuMobile from '../../components/app/QueryFavoriteMenuMobile';
import { usePortalDetailScoresData } from '../../components/app/PortalDetailScoresBlock';
import PortalInsightSummaryCard from '../../components/app/PortalInsightSummaryCard';
import PortalMulkScoreDetailCard, { PortalAraziScoreDetailCard } from '../../components/app/PortalMulkScoreDetailCard';
import PortalFruitInvestmentCard from '../../components/app/PortalFruitInvestmentCard';
import PortalSolarEnergyCard from '../../components/app/PortalSolarEnergyCard';
import PortalWindEnergyCard from '../../components/app/PortalWindEnergyCard';
import ListingDescriptionRich from '../../components/app/ListingDescriptionRich';
import PortalSlopeTerrainCard from '../../components/app/PortalSlopeTerrainCard';
import PortalParcelSplitDetailCard from '../../components/app/PortalParcelSplitDetailCard';
import { formatListingAttributeValueTr, listingAttributeLabelTr } from '../../src/utils/listingAttributeLabels';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useNavigation';
import { useAuth } from '../contexts/AuthContext';
import {
  createPortalQueryComment,
  createPortalQueryReply,
  createPortalQueryRating,
  deletePortalQueryComment,
  getPortalRecentQueryDetail,
  getPortalQueryCommentLikes,
  getPortalQueryRatings,
  getPortalQueryRaters,
  getPortalQueryFavoriteStatus,
  getQueryRatingStatus,
  likePortalQueryComment,
  addPortalQueryFavorite,
  removePortalQueryFavorite,
  rerunPortalQueryWithRoadOverride,
  unlikePortalQueryComment,
  updatePortalQueryComment,
  getPortalSolarEnergyScore,
  getPortalWindEnergyScore,
} from '../../services/portalService';
import { authJsonFetch } from '../../services/apiClient';
import { authService } from '../../services/authService';
import type {
  PortalQueryComment,
  PortalQueryDetail,
  PortalListingVideoItem,
  PortalDfaStep,
  PortalExpertResponse,
  PortalRatingsResponse,
  QueryRatingCreatePayload,
  PortalSolarEnergyScoreResponse,
  PortalWindEnergyScoreResponse,
} from '../../src/types/portal';
import {
  buildDfaRowsFromSteps,
  formatTotalAppliedPercent,
  getPortalDfaPriceFooter,
} from '../../src/utils/portalDfaHelpers';
import { normalizeParcelShapeLabel } from '../../src/utils/normalizeParcelShapeLabel';
import { API_URL, FALLBACK_API_URL } from '../../config/api';
import { portalPageUrl } from '../../config/portalSite';
import RNFS from 'react-native-fs';
import { createEdgeMeasurementFeatures, type EdgeMeasureData, type EdgeMeasurementFeature } from '../../src/utils/edgeMeasurementsManager';

let Mapbox: any = null;
let RasterDemSource: any = null;
let Terrain: any = null;
let SkyLayer: any = null;
try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
  if (mapboxModule.RasterDemSource) RasterDemSource = mapboxModule.RasterDemSource;
  if (mapboxModule.Terrain) Terrain = mapboxModule.Terrain;
  if (mapboxModule.SkyLayer) SkyLayer = mapboxModule.SkyLayer;
} catch {
  console.warn('[son-30-gun-detay] @rnmapbox/maps yüklenemedi');
}

let MAPBOX_TOKEN = '';
try {
  const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
  MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN || '';
} catch {
  console.warn('[son-30-gun-detay] Mapbox token yüklenemedi');
}

let VideoComponent: any = null;
try {
  const v = require('react-native-video');
  VideoComponent = v?.default || v;
} catch {
  if (__DEV__) console.warn('[son-30-gun-detay] react-native-video yüklenemedi');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** mapContainer (280) içinde küçük resim şeridine kalan alan */
const HERO_GALLERY_MAIN_HEIGHT = 216;

type HeroListingMediaItem =
  | { kind: 'image'; url: string }
  | { kind: 'video'; videoUrl: string; posterUrl: string | null; source: string | null };

const COLORS = {
  brandNavy: '#0f172a',
  accentBlue: '#3b82f6',
  accentGreen: '#22c55e',
  pageBg: '#f8fafc',
  headerBg: '#1e293b',
  cardBg: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  dangerRed: '#ef4444',
  warningOrange: '#f59e0b',
  warningYellow: '#fbbf24',
} as const;

const QUERY_TYPE_LABELS: Record<string, string> = {
  arsa: 'Arsa', tarla: 'Tarla', villa: 'Villa', fabrika: 'Fabrika',
  bina: 'Bina', konut: 'Konut', mustakil_ev: 'Müstakil Ev',
};

/** Web `PortalRecentQueryDetailApp` mapOperationItems — LİHKAB / harita işlemleri alt menü */
const MAP_OPERATION_MENU_ITEMS = [
  'Yola Terk',
  'Satın Alma Yoldan İhdas',
  'İfraz Ayırma',
  'Tevhit Birleştirme',
  'Aplikasyon Krokisi',
  'Parsel Yer Gösterme',
  'Yapı Aplikasyon Projesi',
  'Cins Değişikliği',
  'Bağımsız Bölüm Yer Gösterme',
  'Hatalı Bağımsız Bölüm Düzeltme',
  'İrtifak Hakkı Terkini',
  'İrtifak Hakkı Tesisi',
  'Zemin Tespit Tutanağı',
] as const;

const BUILDING_TYPES = ['villa', 'fabrika', 'bina', 'konut', 'mustakil_ev'];

/** Web `PortalRecentQueryDetailApp.jsx` ile aynı yapı sorgu tipleri */
const STRUCTURE_PORTAL_QUERY_TYPES = new Set([
  'bina', 'villa', 'mustakil_ev', 'ciftlik_ev', 'fabrika', 'konut', 'konut_daire', 'ticari', 'commercial',
]);

function isStructurePortalQueryType(qt: string | undefined): boolean {
  return STRUCTURE_PORTAL_QUERY_TYPES.has(String(qt || '').trim().toLowerCase());
}

type RoadOverrideSelectionMobile = { edge_id: number; road_type_id: 9 | 13 | null };
type ElectricOverrideLineMobile = {
  id: string;
  start: [number, number];
  end: [number, number];
  voltage_kv: 64 | 154 | 380;
};

function normalizeRoadOverrideSelectionsMobile(input: any[]): RoadOverrideSelectionMobile[] {
  const rows = Array.isArray(input) ? input : [];
  const used = new Set<number>();
  const out: RoadOverrideSelectionMobile[] = [];
  rows.forEach((row) => {
    const edgeId = Number(row?.edge_id);
    const roadTypeIdRaw = row?.road_type_id;
    const roadTypeId = roadTypeIdRaw == null ? null : Number(roadTypeIdRaw);
    if (!Number.isInteger(edgeId) || edgeId < 0 || used.has(edgeId)) return;
    if (roadTypeId != null && roadTypeId !== 9 && roadTypeId !== 13) return;
    used.add(edgeId);
    out.push({
      edge_id: edgeId,
      road_type_id: roadTypeId == null ? null : (roadTypeId as 9 | 13),
    });
  });
  return out.sort((a, b) => a.edge_id - b.edge_id);
}

function haversineMetersMobile(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const earthRadiusM = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeElectricOverrideLinesMobile(input: any[]): ElectricOverrideLineMobile[] {
  const rows = Array.isArray(input) ? input : [];
  const out: ElectricOverrideLineMobile[] = [];
  rows.forEach((row, index) => {
    const s = row?.start;
    const e = row?.end;
    const kv = Number(row?.voltage_kv);
    if (!Array.isArray(s) || s.length < 2 || !Array.isArray(e) || e.length < 2) return;
    const sLon = Number(s[0]); const sLat = Number(s[1]);
    const eLon = Number(e[0]); const eLat = Number(e[1]);
    if (![sLon, sLat, eLon, eLat].every(Number.isFinite)) return;
    if (![64, 154, 380].includes(kv)) return;
    out.push({
      id: `line-${index}-${sLon}-${sLat}-${eLon}-${eLat}-${kv}`,
      start: [sLon, sLat],
      end: [eLon, eLat],
      voltage_kv: kv as 64 | 154 | 380,
    });
  });
  return out;
}

function isImarliArsaLandCategory(d: PortalQueryDetail): boolean {
  const leaf = String(d.category_leaf_id || d.listing_category_leaf_id || '').trim();
  if (leaf) {
    if (leaf.startsWith('arazi_')) return false;
    if (leaf.startsWith('imarli_arsa_')) return true;
    return false;
  }
  const main = String(d.listing_category_main || '').trim().toLowerCase();
  if (main === 'arazi') return false;
  if (main === 'imarli_arsa') return true;
  const qt = String(d.query_type || '').toLowerCase();
  return qt === 'arsa';
}

function isImarsizTarimLandCategory(d: PortalQueryDetail): boolean {
  const leaf = String(d.category_leaf_id || d.listing_category_leaf_id || '').trim();
  if (leaf.startsWith('imarli_arsa_')) return false;
  if (leaf.startsWith('arazi_')) return true;
  const qt = String(d.query_type || '').toLowerCase();
  if (qt === 'tarla') return true;
  const main = String(d.listing_category_main || '').trim().toLowerCase();
  if (main === 'arazi') return true;
  return false;
}

type DetailMainTabDef = { id: string; label: string };

/** İlan vitrinine bağlı sekmeler (İlan bilgileri + Açıklama); ilan yoksa yalnızca DFA’da tam detay. */
function hasListingDescriptionTab(d: PortalQueryDetail): boolean {
  return !!d.listing_id;
}

/** Web üst şerit sırasıyla uyumlu sekme listesi */
function buildMobileDetailTabs(d: PortalQueryDetail): DetailMainTabDef[] {
  const isStructure = isStructurePortalQueryType(d.query_type);
  const out: DetailMainTabDef[] = [];
  if (hasListingDescriptionTab(d)) {
    out.push({ id: 'listing_info', label: 'İlan Bilgileri' });
    out.push({ id: 'listing_description', label: 'Açıklama' });
  }
  const mid: DetailMainTabDef[] = [
    { id: 'overview', label: 'DFA' },
    { id: 'slope', label: 'Parsel Eğimi' },
    { id: 'km', label: 'KM Analizi' },
    { id: 'edge', label: 'Kenar Ölçüleri' },
  ];
  if (isImarliArsaLandCategory(d) || isImarsizTarimLandCategory(d)) {
    mid.push({ id: 'split', label: 'Bölünebilirlik' });
  }
  mid.push({ id: 'electric', label: 'Yüksek Gerilim' });
  if (!isStructure) {
    mid.push({ id: 'fruit_investment', label: 'Meyve Bahçesi Skoru' });
  }
  mid.push({ id: 'investment_score', label: 'Mülk Skoru' });
  mid.push({ id: 'solar_energy', label: 'Güneş Enerjisi' });
  if (!isStructure) {
    mid.push({ id: 'wind_energy', label: 'Rüzgar Enerjisi' });
  }
  out.push(...mid);
  out.push({ id: 'expert', label: 'Uzman Görüşleri' });
  return out;
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

/** «Değerlendirilmeli» için toplam TL; binlik nokta ve ondalık virgül toleranslı. */
function parseTurkishTotalAmount(raw: string): number | null {
  let s = String(raw || '').trim().replace(/\s/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    const intPart = s.slice(0, lastComma).replace(/\./g, '').replace(/,/g, '');
    const decPart = s.slice(lastComma + 1).replace(/\D/g, '');
    s = decPart ? `${intPart}.${decPart}` : intPart;
  } else {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

function formatArea(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' m²';
}

function formatMeters(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n)) + ' m';
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    const pad = (nn: number) => String(nn).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '—'; }
}

function normalizeDetailLabelKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** İlan + parsel satırlarında aynı anlama gelen etiketleri tek satırda birleştir (ilk etiket korunur, değer ilan tarafıyla güncellenir). */
function canonicalDetailLabelKey(label: string): string {
  const n = normalizeDetailLabelKey(label);
  if (['m²', 'arazi alanı', 'ilan alanı', 'ilan alanı (m²)', 'alan m²'].includes(n)) return '__arazi_alan__';
  if (['cephe (m)', 'yol cephesi (m)', 'toplam yola cephe', 'cephe sayısı', 'facade sayısı', 'facade count'].includes(n)) return '__cephe__';
  if (['tapu durumu', 'title deed status', 'deed status', 'yapı tapusu', 'building title deed status'].includes(n)) return '__tapu__';
  if (['parsel formu', 'parsel şekli', 'parcel shape'].includes(n)) return '__parsel_sekli__';
  if (['takas', 'barter', 'exchange'].includes(n)) return '__takas__';
  if (['imar durumu', 'zoning status'].includes(n)) return '__imar__';
  return n;
}

/** Tamamen aynı satırlar ve kanonik tekrarlar temizlenir (ilk satır korunur). */
function dedupeDetailRowsFinal(rows: [string, string, boolean?][]): [string, string, boolean?][] {
  const seenExact = new Set<string>();
  const seenCanon = new Set<string>();
  const out: [string, string, boolean?][] = [];
  for (const r of rows) {
    const exact = `${normalizeDetailLabelKey(r[0])}|||${String(r[1]).trim()}`;
    if (seenExact.has(exact)) continue;
    seenExact.add(exact);
    const ck = canonicalDetailLabelKey(r[0]);
    if (seenCanon.has(ck)) continue;
    seenCanon.add(ck);
    out.push(r);
  }
  return out;
}

/** Eski «Diğer → Özellikler» alt bloğundan İlan sekmesi «Özellikler» kartına taşınan satırlar (etiket eşleşmesi). */
function isDiğerOzellikMovedToListingCard(label: string): boolean {
  const n = normalizeDetailLabelKey(label);
  if (n.includes('sinema') || n.includes('medya')) return true;
  if (n.includes('havuz')) return true;
  if (n.includes('hamam')) return true;
  if (n.includes('sauna')) return true;
  if (n.includes('peysaj')) return true;
  if (n.includes('kalite') && !n.includes('carpan')) return true;
  return false;
}

function sortDetailRowsHead(rows: [string, string, boolean?][]): [string, string, boolean?][] {
  const headLabels = new Set(['İlan başlığı', 'Alt kategori']);
  const head: [string, string, boolean?][] = [];
  const rest: [string, string, boolean?][] = [];
  for (const r of rows) {
    if (headLabels.has(r[0])) head.push(r);
    else rest.push(r);
  }
  return [...head, ...rest];
}

function mergeParcelAndListingDetailRows(
  baseRows: [string, string, boolean?][],
  detail: PortalQueryDetail,
): [string, string, boolean?][] {
  const out: [string, string, boolean?][] = [];
  const keyToIndex = new Map<string, number>();

  const push = (label: string, value: string, prominent?: boolean) => {
    const key = canonicalDetailLabelKey(label);
    if (keyToIndex.has(key)) {
      const i = keyToIndex.get(key)!;
      const prev = out[i];
      out[i] = [prev[0], value, prominent ?? prev[2]];
      return;
    }
    keyToIndex.set(key, out.length);
    out.push([label, value, prominent]);
  };

  for (const r of baseRows) {
    push(r[0], r[1], r[2]);
  }

  const hasListing =
    !!(detail.listing_id || detail.listing_title || (detail.listing_description && String(detail.listing_description).trim()));
  if (!hasListing) return out;

  if (detail.listing_title?.trim()) push('İlan başlığı', detail.listing_title.trim());
  if (detail.listing_category_leaf_label?.trim()) push('Alt kategori', detail.listing_category_leaf_label.trim());
  if (detail.listing_price_amount != null) push('İlan fiyatı', formatPrice(detail.listing_price_amount));
  if (detail.listing_area_m2 != null) push('İlan alanı', formatArea(detail.listing_area_m2));

  const la = detail.listing_attributes && typeof detail.listing_attributes === 'object' ? (detail.listing_attributes as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(la)) {
    push(listingAttributeLabelTr(k), formatListingAttributeValueTr(v));
  }

  return sortDetailRowsHead(out);
}

const LISTING_FIXED_ATTR_KEYS = new Set([
  'kaks_emsal',
  'gabari',
  'credit_eligible',
  'title_deed_status',
  'deed_status',
  'seller_type',
  'barter',
  'exchange',
  'zoning_status',
]);

/** Üst «İlan bilgileri» bloğunda sabit satırlar olarak gösterilir; kalan listing_attributes döngüsünde tekrarlanmaz. */
const LISTING_INFO_PRIMARY_EXTRA_ATTR_KEYS = new Set(['dwelling_gross_m2', 'dwelling_net_m2']);

/** Konfor satırları — üst kartta değil «Özellikler» kartında (sıra sabit). */
const LISTING_OZELLIK_ATTR_ORDER = [
  'has_swimming_pool',
  'has_landscaping',
  'parking_type',
  'has_sauna',
  'has_turkish_bath',
  'has_gym',
  'has_cinema_room',
  'has_elevator',
  'facade_cladding',
  'has_fireplace',
] as const;

const LISTING_OZELLIK_ATTR_KEYS = new Set<string>(LISTING_OZELLIK_ATTR_ORDER);

/** Aynı özellik için farklı etiketler («Havuz» vs «Havuz var mı?») tek satırda birleşsin diye sabit anahtar. */
const OZELLIK_SEMANTIC_BY_ATTR_KEY: Record<(typeof LISTING_OZELLIK_ATTR_ORDER)[number], string> = {
  has_swimming_pool: 'pool',
  has_landscaping: 'landscaping',
  parking_type: 'parking',
  has_sauna: 'sauna',
  has_turkish_bath: 'hamam',
  has_gym: 'gym',
  has_cinema_room: 'cinema',
  has_elevator: 'elevator',
  facade_cladding: 'facade_cladding',
  has_fireplace: 'fireplace',
};

/** Birleşik detay satırı etiketi → semantik anahtar (isDiğerOzellikMovedToListingCard ile uyumlu). */
function ozellikSemanticKeyFromLabel(label: string): string | null {
  const n = normalizeDetailLabelKey(label);
  if (n.includes('sinema') || n.includes('medya')) return 'cinema';
  if (n.includes('havuz')) return 'pool';
  if (n.includes('hamam')) return 'hamam';
  if (n.includes('sauna')) return 'sauna';
  if (n.includes('peysaj')) return 'landscaping';
  if (n.includes('kalite') && !n.includes('carpan')) return 'quality';
  return null;
}

/** İlan «Özellikler»: önce listing_attributes sabit sıra, sonra birleşik satırlardan (eski Diğer→Özellikler) taşınanlar — tekrar yok. */
function buildListingOzellikRows(
  d: PortalQueryDetail,
  mergedFullRows: [string, string, boolean?][],
): [string, string][] {
  const la =
    d.listing_attributes && typeof d.listing_attributes === 'object'
      ? (d.listing_attributes as Record<string, unknown>)
      : {};
  const out: [string, string][] = [];
  /** Etiket metni farklı olsa da aynı özellik (havuz/sauna/…) yalnızca bir kez; öncelik listing_attributes. */
  const seenSemantic = new Set<string>();
  for (const k of LISTING_OZELLIK_ATTR_ORDER) {
    const v = la[k];
    if (v == null || String(v).trim() === '') continue;
    const label = listingAttributeLabelTr(k);
    const sem = OZELLIK_SEMANTIC_BY_ATTR_KEY[k];
    if (seenSemantic.has(sem)) continue;
    seenSemantic.add(sem);
    out.push([label, formatListingAttributeValueTr(v)]);
  }
  for (const r of mergedFullRows) {
    if (!isDiğerOzellikMovedToListingCard(r[0])) continue;
    const sem = ozellikSemanticKeyFromLabel(r[0]);
    if (sem == null || seenSemantic.has(sem)) continue;
    seenSemantic.add(sem);
    out.push([r[0], r[1]]);
  }
  return out;
}

function totalRoadFrontageLengthM(d: PortalQueryDetail): number | null {
  const rf = d.road_frontage_values?.total_road_frontage_edge_length_m;
  if (rf != null && Number.isFinite(Number(rf))) return Number(rf);
  const em = d.edge_measure_data;
  if (em && typeof em === 'object') {
    const t = (em as { total_road_frontage_edge_length_m?: unknown }).total_road_frontage_edge_length_m;
    if (t != null && Number.isFinite(Number(t))) return Number(t);
  }
  return null;
}

/** İlan bilgileri sekmesi — sabit sıralı üst özet + kalan listing_attributes. */
function buildListingInfoPrimaryRows(d: PortalQueryDetail): [string, string][] {
  const la =
    d.listing_attributes && typeof d.listing_attributes === 'object'
      ? (d.listing_attributes as Record<string, unknown>)
      : {};
  const rows: [string, string][] = [];

  if (d.listing_price_amount != null && Number.isFinite(Number(d.listing_price_amount))) {
    const cur = d.listing_currency ? ` ${d.listing_currency}` : '';
    rows.push(['İlan Fiyatı', formatPrice(d.listing_price_amount) + cur]);
  } else {
    rows.push(['İlan Fiyatı', '—']);
  }

  if (d.total_price != null && Number.isFinite(Number(d.total_price))) {
    rows.push(['ProParcel Tahmini', formatPrice(d.total_price)]);
  } else {
    rows.push(['ProParcel Tahmini', '—']);
  }

  const ilanTarih = d.listing_published_at || d.created_at;
  rows.push(['İlan Tarihi', formatDate(ilanTarih)]);

  const imarTipi =
    (d.listing_category_leaf_label && String(d.listing_category_leaf_label).trim()) ||
    (la.zoning_status != null && String(la.zoning_status).trim() !== ''
      ? formatListingAttributeValueTr(la.zoning_status)
      : '') ||
    '—';
  rows.push(['İmar Tipi', imarTipi]);

  if (d.listing_area_m2 != null) {
    rows.push(['Yapı Brüt m²', formatArea(d.listing_area_m2)]);
  } else {
    rows.push(['Yapı Brüt m²', '—']);
  }

  rows.push([
    'Daire Brüt m²',
    la.dwelling_gross_m2 != null && String(la.dwelling_gross_m2).trim() !== '' && Number.isFinite(Number(la.dwelling_gross_m2))
      ? formatArea(Number(la.dwelling_gross_m2))
      : '—',
  ]);
  rows.push([
    'Daire Net m²',
    la.dwelling_net_m2 != null && String(la.dwelling_net_m2).trim() !== '' && Number.isFinite(Number(la.dwelling_net_m2))
      ? formatArea(Number(la.dwelling_net_m2))
      : '—',
  ]);
  const araziFromParcel = d.arazi_m2 != null && Number.isFinite(Number(d.arazi_m2));
  const arsaM2 = araziFromParcel
    ? Number(d.arazi_m2)
    : la.open_area_m2 != null && String(la.open_area_m2).trim() !== '' && Number.isFinite(Number(la.open_area_m2))
      ? Number(la.open_area_m2)
      : null;
  const openAreaUsedForArsaM2 = !araziFromParcel && arsaM2 != null;
  rows.push(['Arsa m²', arsaM2 != null ? formatArea(arsaM2) : '—']);
  const cepheM = totalRoadFrontageLengthM(d);
  rows.push(['Toplam Yola Cephe', cepheM != null ? formatMeters(cepheM) : '—']);

  const lp = d.listing_price_amount;
  const lm = d.listing_area_m2;
  if (lp != null && lm != null && Number(lm) > 0 && Number.isFinite(Number(lp))) {
    const unit = Number(lp) / Number(lm);
    rows.push(['m² Fiyatı', `${formatPrice(unit)} / m²`]);
  } else {
    rows.push(['m² Fiyatı', '—']);
  }

  rows.push(['Ada No', d.ada != null && String(d.ada).trim() !== '' ? String(d.ada) : '—']);
  rows.push(['Parsel No', d.parsel != null && String(d.parsel).trim() !== '' ? String(d.parsel) : '—']);

  rows.push([
    'Kaks',
    la.kaks_emsal != null && String(la.kaks_emsal).trim() !== ''
      ? formatListingAttributeValueTr(la.kaks_emsal)
      : '—',
  ]);
  rows.push([
    'Gabari',
    la.gabari != null && String(la.gabari).trim() !== '' ? formatListingAttributeValueTr(la.gabari) : '—',
  ]);

  rows.push([
    'Krediye uygunluk',
    la.credit_eligible != null && String(la.credit_eligible).trim() !== ''
      ? formatListingAttributeValueTr(la.credit_eligible)
      : '—',
  ]);

  const td = la.title_deed_status ?? la.deed_status;
  rows.push([
    'Tapu durumu',
    td != null && String(td).trim() !== '' ? formatListingAttributeValueTr(td) : '—',
  ]);
  rows.push([
    listingAttributeLabelTr('building_title_deed_status'),
    la.building_title_deed_status != null && String(la.building_title_deed_status).trim() !== ''
      ? formatListingAttributeValueTr(la.building_title_deed_status)
      : '—',
  ]);

  rows.push([
    'Kimden',
    la.seller_type != null && String(la.seller_type).trim() !== ''
      ? formatListingAttributeValueTr(la.seller_type)
      : '—',
  ]);

  const tak = la.barter ?? la.exchange;
  rows.push([
    'Takas',
    tak != null && String(tak).trim() !== '' ? formatListingAttributeValueTr(tak) : '—',
  ]);

  const seen = new Set(rows.map(([a]) => normalizeDetailLabelKey(a)));
  for (const [k, v] of Object.entries(la)) {
    if (LISTING_FIXED_ATTR_KEYS.has(k)) continue;
    if (LISTING_INFO_PRIMARY_EXTRA_ATTR_KEYS.has(k)) continue;
    if (LISTING_OZELLIK_ATTR_KEYS.has(k)) continue;
    if (k === 'open_area_m2' && openAreaUsedForArsaM2) continue;
    if (k === 'building_title_deed_status') continue;
    if (v == null || String(v).trim() === '') continue;
    const label = listingAttributeLabelTr(k);
    const nk = normalizeDetailLabelKey(label);
    if (seen.has(nk)) continue;
    seen.add(nk);
    rows.push([label, formatListingAttributeValueTr(v)]);
  }

  return rows;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (API_URL || FALLBACK_API_URL || '').replace(/\/$/, '');
  return `${base}/${url.replace(/^\//, '')}`;
}

/** react-native-video: HLS/DASH için `type` gerekir; aksi halde oynatma başlamayabilir */
function buildVideoSource(uri: string): { uri: string; type?: string } {
  const u = uri.trim();
  const path = u.split('?')[0].toLowerCase();
  if (path.endsWith('.m3u8') || path.includes('.m3u8')) {
    return { uri: u, type: 'm3u8' };
  }
  if (path.endsWith('.mpd')) {
    return { uri: u, type: 'mpd' };
  }
  return { uri: u };
}

// ── Polygon simplification (same as report_mobil_viewver) ──

function simplifyPolygonCoords(coords: number[][], tolerance: number): number[][] {
  if (coords.length <= 4) return coords;
  const simplified: number[][] = [coords[0]];
  for (let i = 1; i < coords.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = coords[i];
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    if (Math.sqrt(dx * dx + dy * dy) >= tolerance) simplified.push(curr);
  }
  simplified.push(coords[coords.length - 1]);
  return simplified;
}

function simplifyGeometry(geom: any, tolerance: number): any {
  if (!geom || !geom.coordinates) return geom;
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map((ring: number[][]) => simplifyPolygonCoords(ring, tolerance)) };
  }
  if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map((poly: number[][][]) => poly.map((ring: number[][]) => simplifyPolygonCoords(ring, tolerance))) };
  }
  return geom;
}

function calcCenterFromCoords(coords: number[][]): [number, number] | null {
  if (!coords || !coords.length) return null;
  let sumLon = 0, sumLat = 0;
  for (const c of coords) { sumLon += c[0]; sumLat += c[1]; }
  return [sumLon / coords.length, sumLat / coords.length];
}

async function fetchStaticMapBase64(geom: any): Promise<string> {
  if (!MAPBOX_TOKEN || !geom) return '';
  try {
    let url = '';
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      const [lon, lat] = geom.coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return '';
      url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},16,0/800x600@2x?access_token=${MAPBOX_TOKEN}`;
    } else {
      const featureProps = { stroke: '#3b82f6', 'stroke-width': 3, 'stroke-opacity': 1, fill: '#3b82f6', 'fill-opacity': 0.15 };
      const feature = { type: 'Feature', properties: featureProps, geometry: geom };
      const encoded = encodeURIComponent(JSON.stringify(feature));
      if (encoded.length > 6000) {
        let resolved = false;
        for (const tol of [0.0003, 0.0006, 0.001, 0.002]) {
          const sg = simplifyGeometry(geom, tol);
          const se = encodeURIComponent(JSON.stringify({ type: 'Feature', properties: featureProps, geometry: sg }));
          if (se.length <= 6000) {
            url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${se})/auto/800x600@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
            resolved = true;
            break;
          }
        }
        if (!resolved) {
          const flat = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates?.[0]?.[0];
          const center = calcCenterFromCoords(flat);
          if (!center) return '';
          url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${center[0]},${center[1]},16,0/800x600@2x?access_token=${MAPBOX_TOKEN}`;
        }
      } else {
        url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/800x600@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
      }
    }
    if (!url) return '';
    const tempPath = `${RNFS.CachesDirectoryPath}/static_map_${Date.now()}.png`;
    const result = await RNFS.downloadFile({ fromUrl: url, toFile: tempPath }).promise;
    if (result.statusCode !== 200) { await RNFS.unlink(tempPath).catch(() => {}); return ''; }
    const b64 = await RNFS.readFile(tempPath, 'base64');
    await RNFS.unlink(tempPath).catch(() => {});
    return b64;
  } catch (err) {
    console.warn('[son-30-gun-detay] Static map fetch hatası:', err);
    return '';
  }
}

// ── SVG Overlay Harita Yardımcıları ──

import type { GeoOverlay, PageMapBundle } from '../../src/utils/analysisReportPdf';

/**
 * GeoJSON geometrisindeki koordinatları [lat,lon] → [lon,lat] formatına normalize eder.
 * Türkiye koşullarına göre heuristic: ilk koordinat ortalaması lat aralığında (36-42)
 * ve ikinci koordinat ortalaması lon alt aralığında (25-36) ise swap yapar.
 */
function normalizeGeomToLonLat(geom: any): any {
  if (!geom) return geom;

  // FeatureCollection: normalize each feature's geometry
  if (geom.type === 'FeatureCollection' && Array.isArray(geom.features)) {
    return {
      ...geom,
      features: geom.features.map((f: any) => ({
        ...f,
        geometry: f.geometry ? normalizeGeomToLonLat(f.geometry) : f.geometry,
      })),
    };
  }

  // Feature: normalize geometry
  if (geom.type === 'Feature' && geom.geometry) {
    return { ...geom, geometry: normalizeGeomToLonLat(geom.geometry) };
  }

  // GeometryCollection: normalize each geometry
  if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
    return {
      ...geom,
      geometries: geom.geometries.map((g: any) => normalizeGeomToLonLat(g)),
    };
  }

  if (!geom.coordinates || !geom.type) return geom;
  const flat: number[][] = [];
  function collectCoords(arr: any): void {
    if (Array.isArray(arr) && typeof arr[0] === 'number') { flat.push(arr); return; }
    if (Array.isArray(arr)) for (const item of arr) collectCoords(item);
  }
  collectCoords(geom.coordinates);
  if (flat.length < 2) return geom;

  const sample = flat.slice(0, Math.min(30, flat.length));
  const avg0 = sample.reduce((s, c) => s + c[0], 0) / sample.length;
  const avg1 = sample.reduce((s, c) => s + c[1], 0) / sample.length;

  let swap = false;
  if (avg0 >= 35 && avg0 <= 43 && avg1 >= 25 && avg1 < 36) swap = true;
  if (!swap && avg1 > 42.5 && avg0 < 43) swap = true;

  if (!swap) return geom;
  function swapDeep(arr: any): any {
    if (typeof arr[0] === 'number') return [arr[1], arr[0], ...arr.slice(2)];
    return arr.map(swapDeep);
  }
  return { ...geom, coordinates: swapDeep(geom.coordinates) };
}

function extractAllCoords(geom: any): number[][] {
  if (!geom) return [];
  // FeatureCollection
  if (geom.type === 'FeatureCollection' && Array.isArray(geom.features)) {
    const coords: number[][] = [];
    for (const f of geom.features) coords.push(...extractAllCoords(f.geometry));
    return coords;
  }
  // Feature
  if (geom.type === 'Feature' && geom.geometry) return extractAllCoords(geom.geometry);
  // GeometryCollection
  if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
    const coords: number[][] = [];
    for (const g of geom.geometries) coords.push(...extractAllCoords(g));
    return coords;
  }
  if (!geom.coordinates) return [];
  const coords: number[][] = [];
  function walk(arr: any): void {
    if (typeof arr[0] === 'number') { coords.push(arr); return; }
    if (Array.isArray(arr)) for (const item of arr) walk(item);
  }
  walk(geom.coordinates);
  return coords;
}

function computeGeoBounds(geometries: any[], padding = 0.003): [number, number, number, number] | null {
  const allCoords: number[][] = [];
  for (const g of geometries) {
    if (g) allCoords.push(...extractAllCoords(g));
  }
  if (allCoords.length === 0) return null;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of allCoords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon - padding, minLat - padding, maxLon + padding, maxLat + padding];
}

async function fetchBoundsMapBase64(
  bounds: [number, number, number, number],
  width = 600, height = 400,
): Promise<string> {
  if (!MAPBOX_TOKEN) return '';
  const [w, s, e, n] = bounds;
  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${w},${s},${e},${n}]/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
  try {
    const tmpPath = `${RNFS.CachesDirectoryPath}/basemap_${Date.now()}.png`;
    const dl = await RNFS.downloadFile({ fromUrl: url, toFile: tmpPath }).promise;
    if (dl.statusCode !== 200) { console.warn('[fetchBoundsMapBase64] HTTP:', dl.statusCode); return ''; }
    const base64 = await RNFS.readFile(tmpPath, 'base64');
    RNFS.unlink(tmpPath).catch(() => {});
    return base64;
  } catch (err) {
    console.warn('[fetchBoundsMapBase64] Hata:', err);
    return '';
  }
}

/**
 * Normalize edilen poligonlardan basit [lat,lon] ring → [lon,lat] GeoJSON polygon olusturur.
 * report-price-map API [lat,lon] formatında döner.
 */
function latLonRingToPolygon(coords: number[][]): any {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const ring = coords.map(c => [c[1], c[0]]); // [lat,lon] → [lon,lat]
  const first = ring[0]; const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

type OverlayFeature = {
  geometry: any;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
  priority?: number; // yüksek = öncelikli, düşük = kalabalıksa atılır
};

/**
 * Sayfa bazlı Static Map API - farkli harita stili + akilli overlay butceleme.
 * Her feature bireysel olarak budgelenir. Sigmayan overlay atlanir, parsel her zaman kalir.
 */
async function fetchPageMapBase64(
  features: OverlayFeature[],
  mapStyle: string = 'mapbox/satellite-streets-v12',
): Promise<string> {
  if (!MAPBOX_TOKEN || !features.length) return '';
  try {
    const MAX_ENCODED = 5800;
    const PER_FEATURE_BUDGET = 2800;

    // Her feature icin simplestyle properties olustur
    const toGeoFeature = (f: OverlayFeature, geom: any) => ({
      type: 'Feature' as const,
      properties: {
        stroke: f.stroke || '#FF0000',
        'stroke-width': f.strokeWidth ?? 2,
        'stroke-opacity': f.strokeOpacity ?? 1,
        fill: f.fill || '#FF0000',
        'fill-opacity': f.fillOpacity ?? 0.2,
      },
      geometry: geom,
    });

    // Her feature'i bireysel olarak simplify edip budgele
    const fittedFeatures: any[] = [];
    let totalSize = 100; // FeatureCollection wrapper overhead

    // Oncelik sirasina gore sirala (yuksek oncelikli son - en son eklenen kazanir)
    const sorted = [...features]
      .filter(f => f.geometry?.coordinates)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    for (const f of sorted) {
      let geom = f.geometry;
      let feat = toGeoFeature(f, geom);
      let enc = encodeURIComponent(JSON.stringify(feat));

      // Sigmiyorsa progressively simplify et
      if (enc.length > PER_FEATURE_BUDGET) {
        for (const tol of [0.0005, 0.001, 0.002, 0.004, 0.008, 0.015]) {
          geom = simplifyGeometry(f.geometry, tol);
          feat = toGeoFeature(f, geom);
          enc = encodeURIComponent(JSON.stringify(feat));
          if (enc.length <= PER_FEATURE_BUDGET) break;
        }
      }

      // Hala sigmiyorsa bu feature'i atla
      if (enc.length > PER_FEATURE_BUDGET) {
        console.log(`[fetchPageMapBase64] Feature atlandı: ${f.stroke} (${enc.length} > ${PER_FEATURE_BUDGET})`);
        continue;
      }

      // Toplam bütçeyi aşıyorsa atla
      if (totalSize + enc.length > MAX_ENCODED) {
        console.log(`[fetchPageMapBase64] Bütçe aşıldı, atlanıyor: ${f.stroke} (toplam=${totalSize}+${enc.length})`);
        continue;
      }

      fittedFeatures.push(feat);
      totalSize += enc.length;
    }

    // Hiç feature sığmadıysa boş dön (fallback ana harita kullanılacak)
    if (!fittedFeatures.length) {
      console.log('[fetchPageMapBase64] Hiç feature sığmadı, boş dönüyor');
      return '';
    }

    const fc = { type: 'FeatureCollection' as const, features: fittedFeatures };
    const encoded = encodeURIComponent(JSON.stringify(fc));
    console.log(`[fetchPageMapBase64] Stil=${mapStyle}, ${fittedFeatures.length} feature, encoded=${encoded.length}`);

    const url = `https://api.mapbox.com/styles/v1/${mapStyle}/static/geojson(${encoded})/auto/800x600@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
    const tempPath = `${RNFS.CachesDirectoryPath}/page_map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`;
    const result = await RNFS.downloadFile({ fromUrl: url, toFile: tempPath }).promise;
    if (result.statusCode !== 200) {
      console.warn(`[fetchPageMapBase64] HTTP ${result.statusCode} - stil: ${mapStyle}`);
      await RNFS.unlink(tempPath).catch(() => {});
      return '';
    }
    const b64 = await RNFS.readFile(tempPath, 'base64');
    await RNFS.unlink(tempPath).catch(() => {});
    return b64;
  } catch (err) {
    console.warn('[fetchPageMapBase64] Hata:', err);
    return '';
  }
}

/**
 * Web edge-measure-map.js calculateBBoxCorners uyarlaması.
 * Parsel ring + bbox center/rotation_deg ile bbox köşelerini hesaplar.
 * Dönen: [[lon,lat], ...] kapalı ring (5 nokta) veya null.
 */
function calculateBBoxCornersFromEdgeData(edgeData: any, parcelGeom: any): number[][] | null {
  try {
    const bbox = edgeData?.bbox;
    if (!bbox?.center) return null;
    const centerLon = bbox.center[0];
    const centerLat = bbox.center[1];
    if (!Number.isFinite(centerLon) || !Number.isFinite(centerLat)) return null;
    const rotDeg = Number(bbox.rotation_deg || 0);
    const cosR = Math.cos(rotDeg * Math.PI / 180);
    const sinR = Math.sin(rotDeg * Math.PI / 180);
    const mPerDegLon = 111000 * Math.cos(centerLat * Math.PI / 180);

    // Parsel ring'i al
    let ring: number[][] = [];
    if (parcelGeom?.type === 'Polygon' && parcelGeom.coordinates?.[0]) {
      ring = parcelGeom.coordinates[0];
    } else if (parcelGeom?.type === 'MultiPolygon' && parcelGeom.coordinates?.[0]?.[0]) {
      ring = parcelGeom.coordinates[0][0];
    }
    if (ring.length < 3) return null;
    // Kapalı ring ise son noktayı at
    const last = ring[ring.length - 1];
    const first = ring[0];
    if (Math.abs(first[0] - last[0]) < 1e-10 && Math.abs(first[1] - last[1]) < 1e-10) {
      ring = ring.slice(0, -1);
    }

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const pt of ring) {
      const dxM = (pt[0] - centerLon) * mPerDegLon;
      const dyM = (pt[1] - centerLat) * 111000;
      const u = dxM * cosR + dyM * sinR;
      const v = -dxM * sinR + dyM * cosR;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const PAD = 7;
    minU -= PAD; maxU += PAD; minV -= PAD; maxV += PAD;

    const cornersUV = [[minU, minV], [maxU, minV], [maxU, maxV], [minU, maxV]];
    const corners: number[][] = [];
    for (const [u, v] of cornersUV) {
      const dx = u * cosR - v * sinR;
      const dy = u * sinR + v * cosR;
      corners.push([centerLon + dx / mPerDegLon, centerLat + dy / 111000]);
    }
    corners.push([corners[0][0], corners[0][1]]); // ring kapat
    return corners;
  } catch {
    return null;
  }
}

function coordsToGeometry(coords: number[][] | null): any {
  if (!coords || coords.length < 3) return null;
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return { type: 'Polygon', coordinates: [ring] };
}

function getStaticMapUrl(coords: number[][] | null): string | null {
  if (!MAPBOX_TOKEN || !coords || coords.length < 3) return null;
  const geom = coordsToGeometry(coords);
  if (!geom) return null;
  const featureProps = { stroke: '#ef4444', 'stroke-width': 2, 'stroke-opacity': 1, fill: '#22c55e', 'fill-opacity': 0.25 };
  const feature = { type: 'Feature', properties: featureProps, geometry: geom };
  const encoded = encodeURIComponent(JSON.stringify(feature));
  if (encoded.length > 6000) {
    const center = calcCenterFromCoords(coords);
    if (!center) return null;
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${center[0]},${center[1]},16,0/${SCREEN_WIDTH * 2}x500@2x?access_token=${MAPBOX_TOKEN}`;
  }
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/${SCREEN_WIDTH * 2}x500@2x?access_token=${MAPBOX_TOKEN}&padding=40`;
}

// ── Main Screen ──

export default function Son30GunDetayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ snapshotId?: string; commentId?: string; ratingId?: string; listingId?: string }>();
  const { user, isAuthenticated } = useAuth();
  const expertSectionRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const bilgiSectionRef = useRef<View>(null);
  const yorumSectionRef = useRef<View>(null);
  const kmSectionRef = useRef<View>(null);
  const slopeSectionRef = useRef<View>(null);
  const electricSectionRef = useRef<View>(null);
  const streetViewSectionRef = useRef<View>(null);
  const dfaSectionRef = useRef<View>(null);
  const listingDescSectionRef = useRef<View>(null);
  const listingInfoSectionRef = useRef<View>(null);
  const edgeSectionRef = useRef<View>(null);

  const snapshotId = params.snapshotId ? parseInt(params.snapshotId, 10) : NaN;
  const targetCommentId = params.commentId ? parseInt(params.commentId, 10) : null;
  const [detailMenuVisible, setDetailMenuVisible] = useState(false);
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [detailMenuLihkabOpen, setDetailMenuLihkabOpen] = useState(false);
  const [activeDetailTabId, setActiveDetailTabId] = useState<string>('overview');
  const [solarEnergyPayload, setSolarEnergyPayload] = useState<PortalSolarEnergyScoreResponse | null>(null);
  const [solarEnergyLoading, setSolarEnergyLoading] = useState(false);
  const [solarEnergyErr, setSolarEnergyErr] = useState<string | null>(null);
  const solarEnergyFetchedRef = useRef(false);
  const [windEnergyPayload, setWindEnergyPayload] = useState<PortalWindEnergyScoreResponse | null>(null);
  const [windEnergyLoading, setWindEnergyLoading] = useState(false);
  const [windEnergyErr, setWindEnergyErr] = useState<string | null>(null);
  const windEnergyFetchedRef = useRef(false);

  const scrollToSection = useCallback((tabId: string, ref: React.RefObject<View>) => {
    setActiveDetailTabId(tabId);
    setDetailMenuVisible(false);
    setTimeout(() => {
      ref.current?.measureLayout(
        scrollRef.current?.getInnerViewRef?.() as any,
        (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }),
        () => {},
      );
    }, 450);
  }, []);

  const [data, setData] = useState<PortalQueryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expertModalOpen, setExpertModalOpen] = useState(false);
  const [expertNote, setExpertNote] = useState('');
  const [expertPrice, setExpertPrice] = useState<string>('');
  const [expertSubmitting, setExpertSubmitting] = useState(false);

  // Edge measurement page
  const [edgeModalVisible, setEdgeModalVisible] = useState(false);
  const [roadReportModalVisible, setRoadReportModalVisible] = useState(false);
  const [roadOverrideSelections, setRoadOverrideSelections] = useState<RoadOverrideSelectionMobile[]>([]);
  const [roadFocusedEdgeId, setRoadFocusedEdgeId] = useState<number | null>(null);
  const [roadRerunSubmitting, setRoadRerunSubmitting] = useState(false);
  // Electric line map page
  const [electricMapVisible, setElectricMapVisible] = useState(false);
  const [electricOverrideLines, setElectricOverrideLines] = useState<ElectricOverrideLineMobile[]>([]);
  const [electricDraftStart, setElectricDraftStart] = useState<[number, number] | null>(null);
  const [electricDraftCursor, setElectricDraftCursor] = useState<[number, number] | null>(null);
  const [electricSelectedVoltageKv, setElectricSelectedVoltageKv] = useState<64 | 154 | 380>(64);
  /** Üst bölüm: ilan görselleri önce; harita ayrı sekmede. */
  const [heroTopTab, setHeroTopTab] = useState<'images' | 'map'>('map');
  const heroTopDefaultAppliedRef = useRef(false);
  const [heroGalleryIndex, setHeroGalleryIndex] = useState(0);
  const heroGalleryListRef = useRef<FlatList<HeroListingMediaItem>>(null);
  /** true = kullanıcı durdurdu; undefined = varsayılan oynat; false = açıkça oynat (ilk dokunuş / takılı kurtarma) */
  const [heroVideoPausedByIndex, setHeroVideoPausedByIndex] = useState<Record<number, boolean>>({});
  /** Dokunuşla Video yeniden mount (otomatik oynatma takılınca) */
  const [heroVideoTapNonce, setHeroVideoTapNonce] = useState<Record<number, number>>({});
  /** Galeri önizlemesinde ses kapalı başlar; kullanıcı hoparlör ile açar (otomatik ses politikası) */
  const [heroVideoMuted, setHeroVideoMuted] = useState(true);
  const [heroVideoMediaStatus, setHeroVideoMediaStatus] = useState<
    Record<number, 'loading' | 'ready' | 'error'>
  >({});
  const [heroVideoPosterDismissed, setHeroVideoPosterDismissed] = useState<Record<number, boolean>>({});

  // Map page with 2D/3D toggle
  const [mapPageVisible, setMapPageVisible] = useState(false);
  const [mapIs3D, setMapIs3D] = useState(false);
  const [mapPitchValue, setMapPitchValue] = useState(60);
  const mapCameraRef = useRef<any>(null);
  const mapCamState = useRef({ zoom: 17, pitch: 60, heading: 0 });
  const mapHeadingInterval = useRef<any>(null);
  const mapZoomInterval = useRef<any>(null);
  const mapPitchInterval = useRef<any>(null);

  // Puanlama ve yorumlar (Yorum sekmesi)
  const [ratingModalData, setRatingModalData] = useState<PortalRatingsResponse | null>(null);
  const [ratingModalLoading, setRatingModalLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [replyParentCommentId, setReplyParentCommentId] = useState<number | null>(null);
  const [commentLikeBusyId, setCommentLikeBusyId] = useState<number | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(targetCommentId);
  const [participantModalVisible, setParticipantModalVisible] = useState(false);
  const [participantModalTitle, setParticipantModalTitle] = useState('Katılımcılar');
  const [participantItems, setParticipantItems] = useState<Array<{ user_id: number; display_name: string; avatar_url: string | null; subtitle?: string | null }>>([]);

  // Evaluation modal (Değerlendir Coin Kazan - web'deki QueryRatingModal)
  const [evalModalVisible, setEvalModalVisible] = useState(false);
  const [evalStep, setEvalStep] = useState<1 | 2>(1);
  const [evalExpectedPrice, setEvalExpectedPrice] = useState('');
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalError, setEvalError] = useState('');
  const [evalCoinAmount, setEvalCoinAmount] = useState(5);

  const [isQueryFavorite, setIsQueryFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteCountTotal, setFavoriteCountTotal] = useState(0);

  /** API bazen ilan özeti döndürmez; vitrinden gelen listingId ile favori/paylaş eşlensin (web ile aynı ilan kimliği). */
  const paramListingId = useMemo(() => String(params.listingId ?? '').trim(), [params.listingId]);
  const effectiveListingId = useMemo(() => {
    const fromData = data?.listing_id != null ? String(data.listing_id).trim() : '';
    return fromData || paramListingId;
  }, [data?.listing_id, paramListingId]);
  const isListingDetailView = useMemo(
    () => Boolean(String(effectiveListingId || '').trim() || data?.listing_id),
    [effectiveListingId, data?.listing_id],
  );
  /** Web `ListingFavoriteHeart`: ilan kimliği varken klasörlü ilan favorisi; yoksa Pro sorgu favorisi */
  const showListingFavoriteUi = useMemo(
    () => Boolean(String(effectiveListingId || '').trim()),
    [effectiveListingId],
  );
  const detailModeNoticeText = isListingDetailView
    ? 'Emlak Ilan Detayi Goruntulenmektedir'
    : 'Son 30 Gun Icinde Yapilan Pro Sorgu Detayi Goruntulenmektedir';

  // Full-screen image viewer
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerUrls, setImageViewerUrls] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [videoFullscreenUri, setVideoFullscreenUri] = useState<string | null>(null);

  // Profile info for PDF sharing
  const [profileInfo, setProfileInfo] = useState<{ avatarUrl: string; companyName: string; companyLogoUrl: string }>({
    avatarUrl: '', companyName: '', companyLogoUrl: '',
  });

  const detailTabDefs = useMemo(() => (data ? buildMobileDetailTabs(data) : []), [data]);

  const lastSnapshotForTabRef = useRef<number | null>(null);
  useEffect(() => {
    if (!data?.snapshot_id || !detailTabDefs.length) return;
    if (lastSnapshotForTabRef.current !== data.snapshot_id) {
      lastSnapshotForTabRef.current = data.snapshot_id;
      setActiveDetailTabId(detailTabDefs[0].id);
    }
  }, [data?.snapshot_id, detailTabDefs]);

  useEffect(() => {
    if (!detailTabDefs.length) return;
    if (!detailTabDefs.some((t) => t.id === activeDetailTabId)) {
      setActiveDetailTabId(detailTabDefs[0].id);
    }
  }, [detailTabDefs, activeDetailTabId]);

  // Load detail
  const loadDetail = useCallback(async () => {
    if (!isFinite(snapshotId)) {
      setError('Geçersiz sorgu ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getPortalRecentQueryDetail(snapshotId);
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error || 'Bir hata oluştu');
    }
    setLoading(false);
  }, [snapshotId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    heroTopDefaultAppliedRef.current = false;
    setHeroTopTab('map');
    setHeroGalleryIndex(0);
    heroGalleryListRef.current?.scrollToOffset({ offset: 0, animated: false });
    setRoadReportModalVisible(false);
    setRoadOverrideSelections([]);
    setRoadFocusedEdgeId(null);
    setElectricMapVisible(false);
    setElectricOverrideLines([]);
    setElectricDraftStart(null);
    setElectricDraftCursor(null);
    setElectricSelectedVoltageKv(64);
    setSolarEnergyPayload(null);
    setSolarEnergyErr(null);
    solarEnergyFetchedRef.current = false;
    setWindEnergyPayload(null);
    setWindEnergyErr(null);
    windEnergyFetchedRef.current = false;
    setHeroVideoPausedByIndex({});
    setHeroVideoTapNonce({});
    setHeroVideoMuted(true);
    setHeroVideoMediaStatus({});
    setHeroVideoPosterDismissed({});
  }, [snapshotId]);

  useEffect(() => {
    if (activeDetailTabId !== 'solar_energy') return;
    const sid = Number(data?.snapshot_id ?? snapshotId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    if (solarEnergyFetchedRef.current) return;
    solarEnergyFetchedRef.current = true;
    let cancelled = false;
    setSolarEnergyLoading(true);
    setSolarEnergyErr(null);
    getPortalSolarEnergyScore(sid)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setSolarEnergyPayload(res.data);
        } else {
          setSolarEnergyErr(res.error || 'Güneş skoru alınamadı');
          solarEnergyFetchedRef.current = false;
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSolarEnergyErr(e instanceof Error ? e.message : 'Hata');
          solarEnergyFetchedRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setSolarEnergyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDetailTabId, data?.snapshot_id, snapshotId]);

  useEffect(() => {
    if (activeDetailTabId !== 'wind_energy') return;
    const sid = Number(data?.snapshot_id ?? snapshotId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    if (windEnergyFetchedRef.current) return;
    windEnergyFetchedRef.current = true;
    let cancelled = false;
    setWindEnergyLoading(true);
    setWindEnergyErr(null);
    getPortalWindEnergyScore(sid)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setWindEnergyPayload(res.data);
        } else {
          setWindEnergyErr(res.error || 'Rüzgar skoru alınamadı');
          windEnergyFetchedRef.current = false;
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setWindEnergyErr(e instanceof Error ? e.message : 'Hata');
          windEnergyFetchedRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setWindEnergyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDetailTabId, data?.snapshot_id, snapshotId]);

  useEffect(() => {
    if (!data || heroTopDefaultAppliedRef.current) return;
    const urls = Array.isArray(data.listing_media)
      ? data.listing_media.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
    const vids = Array.isArray(data.listing_videos) ? data.listing_videos : [];
    const hasVideo = vids.some((v) => {
      if (!v || typeof v !== 'object') return false;
      return String((v as PortalListingVideoItem).processed_url || '').trim().length > 0;
    });
    if (urls.length > 0 || hasVideo) {
      setHeroTopTab('images');
      heroTopDefaultAppliedRef.current = true;
    }
  }, [data]);

  const detailStub = useMemo(
    () =>
      ({
        snapshot_id: Number.isFinite(snapshotId) ? snapshotId : 0,
        id: Number.isFinite(snapshotId) ? snapshotId : 0,
        query_type: 'arsa',
      }) as PortalQueryDetail,
    [snapshotId],
  );
  const scores = usePortalDetailScoresData(Number.isFinite(snapshotId) ? snapshotId : 0, data ?? detailStub);

  // Load profile info for PDF
  useEffect(() => {
    (async () => {
      try {
        const resp = await authService.getProfile();
        if (resp.success && resp.data) {
          const profile = resp.data.profile;
          const company = resp.data.company_relation;
          setProfileInfo({
            avatarUrl: profile?.avatar_url || profile?.pending_avatar_url || '',
            companyName: profile?.company_name || company?.company_name || '',
            companyLogoUrl: profile?.company_logo_url || profile?.company_logo || company?.company_logo || '',
          });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const sid = Number(data?.snapshot_id);
    if (!Number.isFinite(sid) || sid <= 0 || !isAuthenticated) {
      setIsQueryFavorite(false);
      setFavoriteLoading(false);
      return;
    }
    let cancelled = false;
    setFavoriteLoading(true);
    getPortalQueryFavoriteStatus(sid)
      .then((res) => {
        if (!cancelled) {
          setIsQueryFavorite(Boolean(res.ok && res.data?.is_favorite));
        }
      })
      .catch(() => {
        if (!cancelled) setIsQueryFavorite(false);
      })
      .finally(() => {
        if (!cancelled) setFavoriteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.snapshot_id, isAuthenticated]);

  useEffect(() => {
    const nextCount = Math.max(0, Number(data?.favorite_count_total ?? 0) || 0);
    setFavoriteCountTotal(nextCount);
  }, [data?.favorite_count_total, data?.listing_id]);

  // Derived values
  const queryType = (data?.query_type || 'arsa').toLowerCase();
  const typeLabel = QUERY_TYPE_LABELS[queryType] || queryType.charAt(0).toUpperCase() + queryType.slice(1);
  const isBuildingType = BUILDING_TYPES.includes(queryType);
  const likeCount = Math.max(
    0,
    Number(data?.rating_summary?.success_count ?? (data as any)?.rating_success_count ?? 0) || 0,
  );
  const mapUrl = useMemo(() => {
    if (!data) return null;
    if (data.parcel_coords_lonlat) return getStaticMapUrl(data.parcel_coords_lonlat);
    return data.thumbnail_url ? resolveImageUrl(data.thumbnail_url) : null;
  }, [data]);
  const roadSelectableRing = useMemo(() => {
    const coords = data?.parcel_coords_lonlat;
    if (!Array.isArray(coords) || coords.length < 3) return [] as [number, number][];
    const ring = coords
      .map((c) => [Number(c?.[0]), Number(c?.[1])] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (ring.length < 3) return [] as [number, number][];
    if (ring.length >= 2) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
    }
    return ring;
  }, [data?.parcel_coords_lonlat]);
  const completedRoadSelections = useMemo(
    () => normalizeRoadOverrideSelectionsMobile(roadOverrideSelections).filter((x) => x.road_type_id != null),
    [roadOverrideSelections],
  );
  const hasElectricOverrideNote = useMemo(
    () => Boolean((data as any)?.has_user_electric_override),
    [data],
  );
  const canSubmitRoadRerun = completedRoadSelections.length > 0 || electricOverrideLines.length > 0;

  const firmLogoUri = useMemo(
    () => resolveImageUrl(profileInfo.companyLogoUrl || null),
    [profileInfo.companyLogoUrl],
  );

  // ── Handlers ──

  const handleViewReport = useCallback(() => {
    if (!data) return;
    router.push('portal-v5-report-webview', {
      snapshotId: String(data.snapshot_id),
    });
  }, [data, router]);

  const handleSharePdf = useCallback(() => {
    if (!data) return;
    router.push('portal-v5-report-webview', {
      snapshotId: String(data.snapshot_id),
      sharePdf: '1',
      mahalle: String(data.quarter_name ?? '').trim(),
      ada: String(data.ada ?? '').trim(),
      parsel: String(data.parsel ?? '').trim(),
    });
  }, [data, router]);

  const handleShareMenu = useCallback(() => {
    if (!data) return;
    const listingUrl = effectiveListingId ? portalPageUrl(`/portal/ilan/${effectiveListingId}/`) : '';
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    if (listingUrl) {
      actions.push({
        text: 'İlan linkini paylaş',
        onPress: () => {
          Share.share({ message: listingUrl, title: 'ProParcel' }).catch(() => {});
        },
      });
    }
    actions.push({
      text: 'PDF paylaş',
      onPress: () => handleSharePdf(),
    });
    actions.push({ text: 'İptal', style: 'cancel' });
    Alert.alert(
      'Paylaş',
      listingUrl ? 'Ne paylaşmak istersiniz?' : 'PDF raporunu paylaşın.',
      actions,
    );
  }, [data, effectiveListingId, handleSharePdf]);

  const handleOpenSocialMediaTemplate = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert('Giriş gerekli', 'Sosyal medya şablonu oluşturmak için giriş yapın.');
      return;
    }
    const nav: { listingId?: string; snapshotId?: string; source: string } = { source: 'detail' };
    if (effectiveListingId) {
      nav.listingId = effectiveListingId;
    } else if (Number.isFinite(snapshotId) && snapshotId > 0) {
      nav.snapshotId = String(snapshotId);
    } else {
      nav.source = 'menu';
    }
    router.push('sosyal-medya-sablonu', nav);
  }, [effectiveListingId, isAuthenticated, router, snapshotId]);

  const applyQueryFavorite = useCallback(
    (nextFavorite: boolean) => {
      const sid = Number(data?.snapshot_id);
      if (!Number.isFinite(sid) || sid <= 0) return;
      if (!isAuthenticated) {
        Alert.alert(
          'Giriş gerekli',
          'Favorilere eklemek için giriş yapın.',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Giriş yap', onPress: () => router.push('login') },
          ],
        );
        return;
      }
      if (favoriteBusy) return;
      if (nextFavorite === isQueryFavorite) return;
      setFavoriteBusy(true);
      setIsQueryFavorite(nextFavorite);
      setFavoriteCountTotal((current) => Math.max(0, current + (nextFavorite ? 1 : -1)));
      (async () => {
        const resp = nextFavorite
          ? await addPortalQueryFavorite(sid)
          : await removePortalQueryFavorite(sid);
        if (!resp.ok) {
          setIsQueryFavorite(!nextFavorite);
          setFavoriteCountTotal((current) => Math.max(0, current + (nextFavorite ? -1 : 1)));
          Alert.alert('Hata', resp.error || 'Favori işlemi tamamlanamadı.');
        }
        setFavoriteBusy(false);
      })().catch(() => {
        setIsQueryFavorite(!nextFavorite);
        setFavoriteCountTotal((current) => Math.max(0, current + (nextFavorite ? -1 : 1)));
        setFavoriteBusy(false);
        Alert.alert('Hata', 'Favori işlemi tamamlanamadı.');
      });
    },
    [data?.snapshot_id, favoriteBusy, isAuthenticated, isQueryFavorite, router],
  );

  const handleRoadEdgeSelect = useCallback((edgeIdRaw: any) => {
    const edgeId = Number(edgeIdRaw);
    if (!Number.isInteger(edgeId) || edgeId < 0) return;
    setRoadOverrideSelections((prev) => {
      const normalized = normalizeRoadOverrideSelectionsMobile(prev);
      const existing = normalized.find((item) => item.edge_id === edgeId);
      if (existing?.road_type_id != null) {
        return normalized;
      }
      if (existing) return normalized;
      return normalizeRoadOverrideSelectionsMobile([...normalized, { edge_id: edgeId, road_type_id: null }]);
    });
    setRoadFocusedEdgeId(edgeId);
  }, []);

  const handleRoadTypePick = useCallback((edgeIdRaw: any, roadTypeIdRaw: any) => {
    const edgeId = Number(edgeIdRaw);
    const roadTypeId = Number(roadTypeIdRaw);
    if (!Number.isInteger(edgeId) || ![9, 13].includes(roadTypeId)) return;
    setRoadOverrideSelections((prev) =>
      normalizeRoadOverrideSelectionsMobile(
        prev.map((item) => (
          item.edge_id === edgeId
            ? { ...item, road_type_id: roadTypeId as 9 | 13 }
            : item
        )),
      ),
    );
    setRoadFocusedEdgeId(edgeId);
  }, []);

  const handleRoadSelectionRemove = useCallback((edgeIdRaw: any) => {
    const edgeId = Number(edgeIdRaw);
    if (!Number.isInteger(edgeId)) return;
    setRoadOverrideSelections((prev) =>
      normalizeRoadOverrideSelectionsMobile(prev.filter((item) => item.edge_id !== edgeId)),
    );
    setRoadFocusedEdgeId((prev) => (prev === edgeId ? null : prev));
  }, []);

  const handleElectricMapTap = useCallback((coord: [number, number]) => {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (!electricDraftStart) {
      setElectricDraftStart([lon, lat]);
      setElectricDraftCursor([lon, lat]);
      return;
    }
    setElectricOverrideLines((prev) =>
      normalizeElectricOverrideLinesMobile([
        ...(prev || []),
        {
          start: electricDraftStart,
          end: [lon, lat],
          voltage_kv: electricSelectedVoltageKv,
        },
      ]),
    );
    setElectricDraftStart(null);
    setElectricDraftCursor(null);
  }, [electricDraftStart, electricSelectedVoltageKv]);

  const handleElectricRemoveLine = useCallback((lineId: string) => {
    setElectricOverrideLines((prev) =>
      normalizeElectricOverrideLinesMobile((prev || []).filter((line) => line.id !== lineId)),
    );
  }, []);

  const handleRoadRerunSubmit = useCallback(async (source: 'road' | 'electric' = 'road') => {
    if (!data || !canSubmitRoadRerun || roadRerunSubmitting) return;
    setRoadRerunSubmitting(true);
    try {
      const edgesAll = completedRoadSelections.map((item) => ({
        edge_id: item.edge_id,
        road_type_id: item.road_type_id as 9 | 13,
      }));
      const edges = source === 'electric' ? [] : edgesAll;
      const electricLines = electricOverrideLines.map((line) => ({
        start: line.start,
        end: line.end,
        voltage_kv: line.voltage_kv,
      }));
      const resp = await rerunPortalQueryWithRoadOverride(data.snapshot_id, edges, electricLines, source);
      if (!resp.ok) {
        Alert.alert('Hata', resp.error || 'Sorgu güncellenemedi.');
        return;
      }
      setRoadReportModalVisible(false);
      setElectricMapVisible(false);
      setRoadOverrideSelections([]);
      setRoadFocusedEdgeId(null);
      setElectricOverrideLines([]);
      setElectricDraftStart(null);
      setElectricDraftCursor(null);
      setElectricSelectedVoltageKv(64);
      await loadDetail();
      Alert.alert('Başarılı', 'Sorgu kullanıcı yol/hat bildirimine göre güncellendi.');
    } finally {
      setRoadRerunSubmitting(false);
    }
  }, [data, canSubmitRoadRerun, roadRerunSubmitting, completedRoadSelections, electricOverrideLines, loadDetail]);

  const handleOpenExpertRequest = useCallback(
    (extra?: { menuFocus?: string; mapOperationLabel?: string }) => {
      if (!data) return;
      router.push({
        pathname: 'report-expert-request',
        params: {
          il: data.city_name || '',
          ilce: data.town_name || '',
          mahalle: data.quarter_name || '',
          ada: data.ada || '',
          parsel: data.parsel || '',
          proparcel_value: data.proparcel_value ? String(data.proparcel_value) : undefined,
          cacheId: data.snapshot_id ? String(data.snapshot_id) : undefined,
          ...extra,
        },
      });
    },
    [data, router],
  );

  const handleExpertSubmit = useCallback(async () => {
    if (!data || expertSubmitting) return;
    setExpertSubmitting(true);
    try {
      const payload = {
        neighborhoodId: data.proparcel_value,
        parcelRef: { city: data.city_name || '', district: data.town_name || '', neighborhood: data.quarter_name || '', ada: data.ada, parsel: data.parsel },
        sourceReportId: String(data.snapshot_id),
        note: expertNote.trim().slice(0, 500),
        idempotencyKey: `portal_${data.snapshot_id}`,
        actionType: 'expert_consultancy',
      };
      const res = await authJsonFetch<any>('/api/expert-requests/purchase-and-create/', { method: 'POST', json: payload });
      if (!res.ok) {
        if (res.status === 402) { router.push('pricing'); return; }
        Alert.alert('Hata', res.error || 'İstek başarısız');
        return;
      }
      setExpertModalOpen(false);
      Alert.alert('Başarılı', 'Uzman talebi oluşturuldu');
      loadDetail();
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Bir hata oluştu');
    } finally {
      setExpertSubmitting(false);
    }
  }, [data, expertNote, expertSubmitting, router, loadDetail]);

  const loadRatingModalData = useCallback(async (snapshotIdValue: number) => {
    setRatingModalLoading(true);
    try {
      const result = await getPortalQueryRatings(snapshotIdValue);
      if (result.ok && result.data) {
        setRatingModalData(result.data);
      }
    } catch (_) {
      // silently fail
    } finally {
      setRatingModalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    if (targetCommentId || params.ratingId) {
      setHighlightedCommentId(targetCommentId);
      loadRatingModalData(data.snapshot_id);
      setTimeout(() => {
        yorumSectionRef.current?.measureLayout(
          scrollRef.current?.getInnerViewRef?.() as any,
          (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }),
          () => {}
        );
      }, 80);
    }
  }, [data, loadRatingModalData, params.ratingId, targetCommentId]);

  useEffect(() => {
    if (!data) return;
    loadRatingModalData(data.snapshot_id);
  }, [data, loadRatingModalData]);

  const openParcelStreetView = useCallback(() => {
    if (!data?.parcel_coords_lonlat?.length) return;
    const coords = data.parcel_coords_lonlat;
    const cLat = coords.reduce((sum, c) => sum + (c[1] || 0), 0) / coords.length;
    const cLon = coords.reduce((sum, c) => sum + (c[0] || 0), 0) / coords.length;
    const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${cLat},${cLon}`;
    Linking.openURL(svUrl).catch(() => {});
  }, [data]);

  // ── Evaluation modal (Değerlendir Coin Kazan) handlers ──
  const openEvalModal = useCallback(async () => {
    if (!data) return;
    // Check if already rated
    try {
      const res = await getQueryRatingStatus(data.snapshot_id);
      if (res.ok && res.data?.credits) {
        setEvalCoinAmount(res.data.credits);
      }
      if (res.ok && res.data?.already_rated && !data.is_own_query) {
        const ratedAt = res.data.rated_at;
        let dateStr = '';
        if (ratedAt) {
          try { dateStr = '\nPuanlama tarihi: ' + new Date(ratedAt).toLocaleDateString('tr-TR'); } catch (_) {}
        }
        Alert.alert('Bilgi', 'Bu sorgu daha önce puanlandı.' + dateStr);
        return;
      }
    } catch (_) { /* continue to open */ }
    setEvalStep(1);
    setEvalExpectedPrice('');
    setEvalError('');
    setEvalModalVisible(true);
  }, [data]);

  const submitEvaluation = useCallback(async (action: 'SUCCESS' | 'NEEDS_REVIEW') => {
    if (!data) return;
    if (action === 'NEEDS_REVIEW') {
      const val = parseTurkishTotalAmount(evalExpectedPrice);
      if (val == null) {
        setEvalError('Beklenen toplam fiyatı (TL) giriniz.');
        return;
      }
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Onay', 'Emin misiniz? Bu sorgu için bir daha puanlama yapamazsınız.', [
        { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Evet', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    setEvalSubmitting(true);
    setEvalError('');
    try {
      const payload: QueryRatingCreatePayload = {
        snapshot_id: data.snapshot_id,
        source_page: 'mobile_portal_detail',
        action,
      };
      if (action === 'NEEDS_REVIEW') {
        const total = parseTurkishTotalAmount(evalExpectedPrice);
        if (total != null) payload.user_expected_total_price = total;
      }
      const res = await createPortalQueryRating(payload);
      if (res.ok) {
        setEvalModalVisible(false);
        const coins = res.data?.coin_awarded ?? 5;
        loadDetail();
        loadRatingModalData(data.snapshot_id);
        Alert.alert('Teşekkürler!', `${coins} Tepe Coin hesabınıza eklendi.`);
      } else if (res.status === 409) {
        setEvalModalVisible(false);
        Alert.alert('Bilgi', 'Bu sorgu daha önce puanlandı.');
      } else {
        setEvalError(res.error || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } catch (e: any) {
      setEvalError(e.message || 'Bağlantı hatası.');
    } finally {
      setEvalSubmitting(false);
    }
  }, [data, evalExpectedPrice, loadDetail, loadRatingModalData]);

  const handleStartEditComment = useCallback((comment: PortalQueryComment) => {
    setEditingCommentId(comment.id);
    setReplyParentCommentId(null);
    setCommentDraft(comment.comment);
    setCommentError('');
  }, []);

  const handleStartReplyComment = useCallback((comment: PortalQueryComment) => {
    setEditingCommentId(null);
    setReplyParentCommentId(comment.id);
    setCommentDraft('');
    setCommentError('');
  }, []);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setReplyParentCommentId(null);
    setCommentDraft('');
    setCommentError('');
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!data) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) {
      setCommentError('Yorum alanı zorunludur.');
      return;
    }

    setCommentSubmitting(true);
    setCommentError('');
    try {
      const res = editingCommentId != null
        ? await updatePortalQueryComment(editingCommentId, { comment: trimmed })
        : replyParentCommentId != null
          ? await createPortalQueryReply(replyParentCommentId, { comment: trimmed })
          : await createPortalQueryComment({ snapshot_id: data.snapshot_id, comment: trimmed });

      if (res.ok) {
        setCommentDraft('');
        setEditingCommentId(null);
        setReplyParentCommentId(null);
        await Promise.all([loadDetail(), loadRatingModalData(data.snapshot_id)]);
      } else {
        setCommentError(res.error || 'Yorum kaydedilemedi.');
      }
    } catch (e: any) {
      setCommentError(e?.message || 'Yorum kaydedilemedi.');
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentDraft, data, editingCommentId, loadDetail, loadRatingModalData, replyParentCommentId]);

  const handleDeleteComment = useCallback(async (comment: PortalQueryComment) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Onay', 'Bu yorumu silmek istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sil', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    setCommentSubmitting(true);
    setCommentError('');
    try {
      const res = await deletePortalQueryComment(comment.id);
      if (res.ok) {
        if (editingCommentId === comment.id) {
          setEditingCommentId(null);
          setCommentDraft('');
        }
        if (replyParentCommentId === comment.id) {
          setReplyParentCommentId(null);
          setCommentDraft('');
        }
        if (data) {
          await Promise.all([loadDetail(), loadRatingModalData(data.snapshot_id)]);
        }
      } else {
        setCommentError(res.error || 'Yorum silinemedi.');
      }
    } catch (e: any) {
      setCommentError(e?.message || 'Yorum silinemedi.');
    } finally {
      setCommentSubmitting(false);
    }
  }, [data, editingCommentId, loadDetail, loadRatingModalData, replyParentCommentId]);

  const handleToggleCommentLike = useCallback(async (comment: PortalQueryComment) => {
    setCommentLikeBusyId(comment.id);
    try {
      const res = comment.liked_by_me
        ? await unlikePortalQueryComment(comment.id)
        : await likePortalQueryComment(comment.id);
      if (res.ok && data) {
        await loadRatingModalData(data.snapshot_id);
      } else if (!res.ok) {
        Alert.alert('Hata', res.error || 'Beğeni işlemi tamamlanamadı.');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Beğeni işlemi tamamlanamadı.');
    } finally {
      setCommentLikeBusyId(null);
    }
  }, [data, loadRatingModalData]);

  const handleShowCommentLikes = useCallback(async (comment: PortalQueryComment) => {
    const res = await getPortalQueryCommentLikes(comment.id);
    if (!res.ok) {
      Alert.alert('Hata', res.error || 'Beğenenler yüklenemedi.');
      return;
    }
    setParticipantModalTitle('Beğenenler');
    setParticipantItems(res.data.results.map((item) => ({
      user_id: item.user_id,
      display_name: item.display_name,
      avatar_url: item.avatar_url,
      subtitle: item.liked_at ? formatDate(item.liked_at) : null,
    })));
    setParticipantModalVisible(true);
  }, []);

  const handleShowRaters = useCallback(async () => {
    if (!data) return;
    const res = await getPortalQueryRaters(data.snapshot_id);
    if (!res.ok) {
      Alert.alert('Hata', res.error || 'Puanlayanlar yüklenemedi.');
      return;
    }
    setParticipantModalTitle('Puanlayanlar');
    setParticipantItems(res.data.results.map((item) => ({
      user_id: item.user_id,
      display_name: item.display_name,
      avatar_url: item.avatar_url,
      subtitle: item.action === 'SUCCESS' ? 'Başarılı' : 'Başarısız',
    })));
    setParticipantModalVisible(true);
  }, [data]);

  // ── Render Helpers ──

  const renderDfaTable = (steps: PortalDfaStep[]) => {
    if (!steps || !steps.length || !data) return null;
    const rows = buildDfaRowsFromSteps(steps);
    const footer = getPortalDfaPriceFooter(data);
    const appliedPct = formatTotalAppliedPercent(data, rows);
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>Detaylı Fiyat Analizi Tablosu</Text>
        <View>
          <View style={s.dfaHeaderRow}>
            <Text style={[s.dfaCell, s.dfaCellDesc, s.dfaHeaderText]}>Açıklama</Text>
            <Text style={[s.dfaCell, s.dfaCellPctCol, s.dfaHeaderText]}>Yüzde</Text>
          </View>
          {rows.map((row, i) => {
            const isPositive = row.tone === 'positive';
            const isNegative = row.tone === 'negative';
            const descLower = String(row.description || '').toLowerCase();
            const canReportRoad = descLower.includes('yola bağlantısı yok');
            const canReportElectric = descLower.includes('yüksek gerilim hattı')
              || descLower.includes('elektrik hattı');
            const isElectricRelatedRow = descLower.includes('yüksek gerilim') || descLower.includes('elektrik hattı');
            return (
              <View
                key={row.key}
                style={[s.dfaRow, i % 2 === 0 && s.dfaRowAlt, isPositive && s.dfaRowPos, isNegative && s.dfaRowNeg]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.dfaCell, s.dfaCellDesc]}>{row.description}</Text>
                  {isElectricRelatedRow && hasElectricOverrideNote ? (
                    <Text style={s.dfaUserNote}>Hat bildirimi kullanıcı tarafından yapılmıştır.</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      s.dfaCell,
                      s.dfaCellPctCol,
                      s.dfaPctText,
                      isPositive && s.dfaPctPos,
                      isNegative && s.dfaPctNeg,
                    ]}
                  >
                    {row.percent}
                  </Text>
                  {canReportRoad && (
                    <TouchableOpacity
                      onPress={() => setRoadReportModalVisible(true)}
                      style={s.roadReportBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={s.roadReportBtnText}>Yol Bildir</Text>
                    </TouchableOpacity>
                  )}
                  {canReportElectric && (
                    <TouchableOpacity
                      onPress={() => setElectricMapVisible(true)}
                      style={s.roadReportBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={s.roadReportBtnText}>Hat Bildir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        <View style={s.dfaSummaryWrap}>
          <Text style={s.dfaSummaryTitle}>Değerleme özeti (özet API)</Text>
          <View style={s.dfaSummaryGrid}>
            <View style={s.dfaSummaryItem}>
              <Text style={s.dfaSummaryLabel}>Başlangıç (TL/m²)</Text>
              <Text style={s.dfaSummaryValue}>
                {footer.startUnit != null ? formatPrice(footer.startUnit) : '—'}
              </Text>
            </View>
            <View style={s.dfaSummaryItem}>
              <Text style={s.dfaSummaryLabel}>Bitiş (TL/m²)</Text>
              <Text style={s.dfaSummaryValue}>
                {footer.endUnit != null ? formatPrice(footer.endUnit) : '—'}
              </Text>
            </View>
            <View style={s.dfaSummaryItem}>
              <Text style={s.dfaSummaryLabel}>Uygulanan %</Text>
              <Text style={s.dfaSummaryValue}>{appliedPct}</Text>
            </View>
            <View style={s.dfaSummaryItem}>
              <Text style={s.dfaSummaryLabel}>Toplam (TL)</Text>
              <Text style={s.dfaSummaryValue}>
                {footer.total != null ? formatPrice(footer.total) : '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTahminModule = () => {
    if (!data) return null;
    const km = (data.km_analysis || {}) as Record<string, any>;
    const pred = (data.prediction_json || {}) as Record<string, any>;
    const ps = (data.price_selection_json || {}) as Record<string, any>;
    const details = ps.details || {};
    const reason = ps.reason || null;
    const model = ps.model || null;
    const hasPred = pred && Object.keys(pred).length > 0;
    const hasPs = ps && Object.keys(ps).length > 0;
    const hasKm = km && Object.keys(km).length > 0;
    if (!hasPred && !hasPs && !hasKm && data.km_recommended_price == null) return null;

    const MODEL_LABELS: Record<string, string> = {
      DB: 'Veritabanı', PREDICTION: 'ProParcel Akıllı Tahmin', KM: 'KM Tahmin', NONE: '-',
    };
    const modelLabel = model ? (MODEL_LABELS[model] || model) : (hasPs ? '-' : 'Akıllı Tahmin');

    const isVillage = reason && String(reason).indexOf('VILLAGE_') === 0;
    let detailText = '';
    if (isVillage) detailText = 'Köy içi multiplier kuralı ile hesaplandı';
    else if (reason === 'PREDICTION_HIGH_CONFIDENCE' || reason === 'PREDICTION_HIGH_CONFIDENCE_UNVERIFIED_DB') detailText = 'Yüksek güven — Öncelikli seçildi';
    else if (reason && reason.indexOf('DB_PREDICTION_') === 0) detailText = 'DB fiyatı akıllı tahmin ile doğrulandı';
    else if (reason && reason.indexOf('DB_NO_PREDICTION') === 0) detailText = 'Veritabanı fiyatı kullanıldı';
    else if (reason && reason.indexOf('KM_') === 0) detailText = reason.indexOf('VALIDATED') >= 0 ? 'KM tahmini akıllı tahmin ile doğrulandı' : 'KM tahmini kullanıldı';
    else if (reason === 'PREDICTION_FIRST') detailText = 'Akıllı tahmin ilk sonucu kullanıldı';
    else if (reason === 'FALLBACK_QUARTER_PRICE') detailText = 'Fallback: Mahalle fiyatı kullanıldı';
    else if (reason === 'NO_DATA') detailText = 'Veri bulunamadı';
    else if (reason) detailText = 'Neden: ' + reason;
    else if (hasPred && !hasPs) detailText = 'Vertex AI tahmin sonuçları';

    const kmQuality = km.quality || {};
    const kmMeta = km.analysis_meta || {};
    let kmSummaryTr = kmQuality.summary_text_tr ? String(kmQuality.summary_text_tr).trim() : '';
    const kmScore = kmQuality.score != null ? Number(kmQuality.score) : null;
    const kmLabel = kmQuality.label ? String(kmQuality.label) : '';
    const totalExamined = kmMeta.total_examined_count != null ? Number(kmMeta.total_examined_count) : 0;
    if (!kmSummaryTr && (Number.isFinite(kmScore) || Number.isFinite(totalExamined))) {
      const tail = (Number.isFinite(kmScore) && (kmScore as number) < 30) ? 'Tahmin fiyatı bu koşullarda zayıf görülmektedir.'
        : (Number.isFinite(kmScore) && (kmScore as number) < 60) ? 'Mahallenin tahmin edilen birim fiyatı oldukça güvenilir seviyelere yakındır.'
        : 'Mahallenin tahmin edilen birim fiyatı çok güvenilir seviyededir.';
      kmSummaryTr = `Sorgulanan mahallenin birim fiyatını tahmin etmek için ${Number.isFinite(totalExamined) ? totalExamined : 0} mahalle analiz edilmiştir. ${tail}`;
    }

    const toNum = (v: any): number | null => { if (v == null) return null; const n = Number(v); return isFinite(n) ? n : null; };

    const dbVerified = details.db_verified;
    const dbPrice = toNum(details.db_price || details.db_unit_price || (model === 'DB' ? details.price : null));
    const kmPrice = toNum(details.km_price || details.km_recommended_price || details.km_estimated_price || ((model === 'KM' || (reason && String(reason).indexOf('KM_') === 0)) ? details.price : null) || data.km_recommended_price);
    const predPrice = toNum(details.prediction_price || details.prediction_first_price) || (pred.arsa ? toNum(pred.arsa.estimated_price || pred.arsa.estimatedPrice) : null) || (pred.tarla ? toNum(pred.tarla.estimated_price || pred.tarla.estimatedPrice) : null);
    const arsaEst = toNum(pred.arsa && (pred.arsa.estimated_price || pred.arsa.estimatedPrice));
    const tarlaEst = toNum(pred.tarla && (pred.tarla.estimated_price || pred.tarla.estimatedPrice));
    const nearestPrice = toNum(details.prediction_nearest_price || details.nearest_price);

    type PriceRow = { label: string; value: number | null; highlight: boolean };
    const priceRows: PriceRow[] = [
      { label: 'Veritabanı' + (dbVerified === true || dbVerified === 1 ? ' \u2713' : dbVerified === false || dbVerified === 0 ? ' \u2717' : ''), value: dbPrice, highlight: model === 'DB' && !isVillage },
      { label: 'KM Tahmin', value: kmPrice, highlight: (model === 'KM' || (reason != null && String(reason).indexOf('KM_') === 0)) && !isVillage },
      { label: 'ProParcel Akıllı Tahmin', value: predPrice, highlight: (model === 'PREDICTION' || (reason != null && String(reason).indexOf('PREDICTION_') === 0)) && !isVillage },
      { label: 'Akıllı Tahmin Arsa', value: arsaEst, highlight: false },
      { label: 'Akıllı Tahmin Tarla', value: tarlaEst, highlight: false },
      { label: 'Akıllı Tahmin En Yakın', value: nearestPrice, highlight: reason != null && String(reason).indexOf('NEAREST') >= 0 },
    ];
    const visibleRows = priceRows.filter(r => r.value != null);

    return (
      <View ref={kmSectionRef} style={s.card}>
        <View style={s.cardTitleRow}>
          <Ionicons name="analytics" size={16} color={COLORS.accentBlue} />
          <Text style={s.cardTitle}>Tahmin Modülü</Text>
        </View>

        {(modelLabel || detailText) && (
          <View style={sec.modelBox}>
            {modelLabel ? <Text style={sec.modelLabel}>{isVillage ? 'Köy İçi Kuralı' : modelLabel}</Text> : null}
            {detailText ? <Text style={sec.modelDetail}>{detailText}</Text> : null}
            {(dbVerified === true || dbVerified === 1) && (
              <View style={sec.verifiedBadge}><Text style={sec.verifiedText}>Doğrulanmış</Text></View>
            )}
          </View>
        )}

        {kmSummaryTr ? (
          <View style={sec.summaryBox}>
            <Text style={sec.summaryTitle}>KM Tahmin Yorumu</Text>
            <Text style={sec.summaryText}>{kmSummaryTr}</Text>
            {(kmScore != null || kmLabel) ? (
              <Text style={sec.summaryMeta}>
                {kmScore != null ? `Kalite Skoru: ${kmScore}/100` : ''}
                {kmLabel ? (kmScore != null ? ` (${kmLabel})` : kmLabel) : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        {(kmMeta.total_examined_count != null || kmMeta.primary_neighbors_count != null || kmScore != null) && !kmSummaryTr && (
          <View style={sec.statsRow}>
            {kmMeta.total_examined_count != null && (
              <View style={sec.statItem}>
                <Text style={sec.statValue}>{kmMeta.total_examined_count}</Text>
                <Text style={sec.statLabel}>İncelenen Mahalle</Text>
              </View>
            )}
            {kmMeta.primary_neighbors_count != null && (
              <View style={sec.statItem}>
                <Text style={sec.statValue}>{kmMeta.primary_neighbors_count}</Text>
                <Text style={sec.statLabel}>Birincil Komşu</Text>
              </View>
            )}
            {kmScore != null && (
              <View style={sec.statItem}>
                <Text style={sec.statValue}>{kmScore}{kmLabel ? ` (${kmLabel})` : ''}</Text>
                <Text style={sec.statLabel}>Kalite Skoru</Text>
              </View>
            )}
          </View>
        )}

        {visibleRows.length > 0 && (
          <>
            <Text style={sec.comparisonTitle}>Karşılaştırma</Text>
            <View style={sec.comparisonGrid}>
              {visibleRows.map((r, i) => (
                <View key={i} style={[sec.comparisonItem, r.highlight && sec.comparisonItemHighlight]}>
                  <Text style={sec.comparisonLabel}>{r.label}</Text>
                  <Text style={[sec.comparisonValue, r.highlight && sec.comparisonValueHighlight]}>
                    {formatPrice(r.value)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {(pred.arsa || pred.tarla) && (
          <View style={sec.predFooter}>
            {pred.arsa && (
              <Text style={sec.predFooterText}>
                Arsa: Sınıf {pred.arsa.class ?? '—'}, Skor {pred.arsa.score != null ? parseFloat(pred.arsa.score).toFixed(2) : '—'}
              </Text>
            )}
            {pred.tarla && (
              <Text style={sec.predFooterText}>
                Tarla: Sınıf {pred.tarla.class ?? '—'}, Skor {pred.tarla.score != null ? parseFloat(pred.tarla.score).toFixed(2) : '—'}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const formatSurveyValue = (val: any, qType?: string, code?: string): string | null => {
    if (val === undefined || val === null || val === '') return null;
    if (qType === 'boolean' || typeof val === 'boolean') return val === true || val === 'true' ? 'Evet' : 'Hayır';
    if ((qType === 'ada_parsel' || code === 'emsal_ada_parsel') && typeof val === 'object') {
      const entries = val.entries || [];
      if (entries.length > 0) {
        return entries.map((e: any) => {
          const parts = [`${e.ada}/${e.parsel}`];
          if (e.alan) parts.push(`${Number(e.alan).toLocaleString('tr-TR')} m²`);
          if (e.fiyat) parts.push(`${Number(e.fiyat).toLocaleString('tr-TR')} ₺`);
          return parts.join(' - ');
        }).join('\n');
      }
      return `${val.ada || ''}/${val.parsel || ''}`;
    }
    if ((qType === 'number' || (code && (code.includes('price') || code.includes('fiyat')))) && val) {
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
      return isNaN(num) ? String(val) : `${Math.round(num).toLocaleString('tr-TR')} ₺`;
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const fallbackLabels: Record<string, string> = {
    similar_sale_exists: 'Emsal Satış Var mı?',
    is_price_appropriate: 'Fiyat Uygun mu?',
    expert_price_suggestion: 'Uzman Fiyat Önerisi',
    emsal_ada_parsel: 'Emsal Parseller',
    special_conditions: 'Özel Koşullar',
    is_low_terrain: 'Arazi Çukur mu?',
    imar_durumu: 'İmar Durumu',
    altyapi_durumu: 'Altyapı Durumu',
    ulasim_durumu: 'Ulaşım Durumu',
    arazi_kullanim_amaci: 'Arazi Kullanım Amacı',
    ek_aciklama: 'Ek Açıklama',
  };

  const renderSurveyAnswers = (answers: Record<string, unknown>) => {
    if (!answers || Object.keys(answers).length === 0) return null;
    const questions = data?.expert?.survey_questions || [];
    const totalPrice = data?.expert?.total_price;
    const rows: { label: string; value: string }[] = [];

    if (questions.length > 0) {
      for (const q of questions) {
        const val = answers[q.code];
        const display = formatSurveyValue(val, q.type, q.code);
        if (!display) continue;
        let label = (q.label || q.code);
        if (totalPrice) {
          label = label.replace(/\{\{toplam_fiyat\}\}/g, `${Math.round(totalPrice).toLocaleString('tr-TR')} ₺`);
          label = label.replace(/\*\*\*\*/g, `${Math.round(totalPrice).toLocaleString('tr-TR')} ₺`);
        }
        rows.push({ label, value: display });
      }
    } else {
      for (const [key, val] of Object.entries(answers)) {
        const display = formatSurveyValue(val, undefined, key);
        if (!display) continue;
        const label = fallbackLabels[key] || key.replace(/_/g, ' ');
        rows.push({ label, value: display });
      }
    }

    if (rows.length === 0) return null;
    return (
      <View style={s.surveyWrap}>
        {rows.map((r, i) => (
          <View key={i} style={[s.surveyRow, i % 2 === 0 && s.surveyRowAlt]}>
            <Text style={s.surveyLabel}>{r.label}</Text>
            <Text style={s.surveyValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderExpertResponse = (resp: PortalExpertResponse) => (
    <View key={resp.id} style={s.expertCard}>
      <View style={s.expertHeader}>
        {resp.expert_avatar_url ? (
          <Image source={{ uri: resolveImageUrl(resp.expert_avatar_url)! }} style={s.expertAvatar} />
        ) : (
          <View style={[s.expertAvatar, s.expertAvatarPlaceholder]}>
            <Ionicons name="person" size={20} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={s.expertInfo}>
          <Text style={s.expertName}>{resp.expert_display_name || 'Uzman'}</Text>
          <View style={s.expertMeta}>
            {resp.expert_badge && <Text style={s.expertBadge}>{resp.expert_badge}</Text>}
            {resp.expert_score != null && <Text style={s.expertScore}>{resp.expert_score} puan</Text>}
          </View>
          {resp.expert_company && <Text style={s.expertCompany}>{resp.expert_company}</Text>}
        </View>
      </View>
      {resp.response_text ? <Text style={s.expertText}>{resp.response_text}</Text> : null}
      {renderSurveyAnswers(resp.survey_answers as Record<string, unknown>)}
      {resp.attachments_json && resp.attachments_json.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.expertAttachments}>
          {resp.attachments_json.map((att, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.8}
              onPress={() => {
                const urls = resp.attachments_json!.map(a => resolveImageUrl(a)!);
                setImageViewerUrls(urls);
                setImageViewerIndex(i);
                setImageViewerVisible(true);
              }}
            >
              <Image source={{ uri: resolveImageUrl(att)! }} style={s.expertAttImage} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {resp.pdf_url ? (
        <TouchableOpacity style={s.expertPdfBtn} onPress={() => Linking.openURL(resolveImageUrl(resp.pdf_url)!)}>
          <Ionicons name="document-text" size={16} color={COLORS.accentBlue} />
          <Text style={s.expertPdfBtnText}>PDF İndir</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={s.expertDate}>{formatDate(resp.approved_at || resp.created_at)}</Text>
    </View>
  );

  // ── Map 3D control helpers ──
  const mapHandlePitch = useCallback((delta: number) => {
    const nv = Math.max(0, Math.min(90, Math.round((mapCamState.current.pitch || 0) + delta)));
    setMapPitchValue(nv);
    mapCamState.current.pitch = nv;
    mapCameraRef.current?.setCamera?.({ pitch: nv, animationDuration: 250 });
  }, []);
  const mapHandleHeading = useCallback((delta: number) => {
    const nh = ((mapCamState.current.heading || 0) + delta) % 360;
    mapCamState.current.heading = nh;
    mapCameraRef.current?.setCamera?.({ heading: nh, animationDuration: 250 });
  }, []);
  const mapHandleZoom = useCallback((delta: number) => {
    const nz = Math.max(2, Math.min(22, (mapCamState.current.zoom || 17) + delta));
    mapCamState.current.zoom = nz;
    mapCameraRef.current?.setCamera?.({ zoomLevel: nz, animationDuration: 250 });
  }, []);
  const mapStartPitch = useCallback((d: number) => { mapHandlePitch(d); mapPitchInterval.current = setInterval(() => mapHandlePitch(d), 150); }, [mapHandlePitch]);
  const mapStopPitch = useCallback(() => { if (mapPitchInterval.current) { clearInterval(mapPitchInterval.current); mapPitchInterval.current = null; } }, []);
  const mapStartHeading = useCallback((d: number) => { mapHandleHeading(d); mapHeadingInterval.current = setInterval(() => mapHandleHeading(d), 150); }, [mapHandleHeading]);
  const mapStopHeading = useCallback(() => { if (mapHeadingInterval.current) { clearInterval(mapHeadingInterval.current); mapHeadingInterval.current = null; } }, []);
  const mapStartZoom = useCallback((d: number) => { mapHandleZoom(d); mapZoomInterval.current = setInterval(() => mapHandleZoom(d), 150); }, [mapHandleZoom]);
  const mapStopZoom = useCallback(() => { if (mapZoomInterval.current) { clearInterval(mapZoomInterval.current); mapZoomInterval.current = null; } }, []);

  // ── Parcel geometry for inline map (hooks must be before early returns) ──
  const parcelGeom = useMemo(() => data ? coordsToGeometry(data.parcel_coords_lonlat) : null, [data]);
  const parcelCenter = useMemo(() => data ? calcCenterFromCoords(data.parcel_coords_lonlat || []) : null, [data]);

  const parcelGeoJSON = useMemo(() => {
    if (!data || !parcelGeom) return null;
    return {
      type: 'Feature' as const,
      properties: {
        label: `${data.ada || '0'}/${data.parsel || '0'}\n${formatArea(data.arazi_m2 ?? data.area_m2)}\n${data.unit_price ? Math.round(data.unit_price).toLocaleString('tr-TR') + ' ₺/m²' : ''}`,
      },
      geometry: parcelGeom,
    };
  }, [data, parcelGeom]);

  // ── Emsal (comparable) parcels from expert responses ──
  const expertResponsesForEmsal = data?.expert?.responses || [];
  const emsalGeoJSON = useMemo(() => {
    const features: any[] = [];
    for (const resp of expertResponsesForEmsal) {
      const emsalData = resp.emsal_parcels as any;
      let entries = emsalData?.entries || [];
      if (!entries.length) {
        const sa = resp.survey_answers as any;
        const emsalAda = sa?.emsal_ada_parsel;
        if (emsalAda?.entries) entries = emsalAda.entries;
      }
      for (const entry of entries) {
        if (!entry.polygon?.coordinates) continue;
        let geom = entry.polygon;
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
          const normRing = (coords: any[]): any[] => {
            if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) return coords.map(normRing);
            return coords.map((c: number[]) => {
              const [a, b] = c;
              if (a >= 36 && a <= 43 && b >= 25 && b <= 46) return [b, a];
              return [a, b];
            });
          };
          geom = { ...geom, coordinates: geom.coordinates.map(normRing) };
        }
        const labelParts = [`${entry.ada || '—'}/${entry.parsel || '—'}`];
        if (entry.alan) labelParts.push(`${Number(entry.alan).toLocaleString('tr-TR')} m²`);
        if (entry.fiyat && entry.alan) {
          const unitPrice = Math.round(Number(entry.fiyat) / Number(entry.alan));
          labelParts.push(`${unitPrice.toLocaleString('tr-TR')} ₺/m²`);
        } else if (entry.fiyat) {
          labelParts.push(`${Number(entry.fiyat).toLocaleString('tr-TR')} ₺`);
        }
        features.push({
          type: 'Feature',
          properties: { label: labelParts.join('\n') },
          geometry: geom,
        });
      }
    }
    if (features.length === 0) return null;
    return { type: 'FeatureCollection' as const, features };
  }, [expertResponsesForEmsal]);

  const heroListingMediaItems = useMemo((): HeroListingMediaItem[] => {
    if (!data) return [];
    const lm = data.listing_media;
    const images: string[] = !Array.isArray(lm)
      ? []
      : lm
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          .map((u) => resolveImageUrl(u.trim()) || u.trim());
    const rawVideos = data.listing_videos;
    const videos: { processed_url: string; thumbnail_url: string | null; source: string | null }[] = [];
    if (Array.isArray(rawVideos)) {
      for (const v of rawVideos) {
        if (!v || typeof v !== 'object') continue;
        const pv = v as PortalListingVideoItem;
        const processed = String(pv.processed_url || '').trim();
        if (!processed) continue;
        const thumb = String(pv.thumbnail_url || '').trim();
        const source = pv.source != null ? String(pv.source) : null;
        videos.push({
          processed_url: resolveImageUrl(processed) || processed,
          thumbnail_url: thumb ? resolveImageUrl(thumb) || thumb : null,
          source,
        });
      }
    }
    videos.sort((a, b) => {
      const rank = (s: string | null) => (s === 'upload' ? 1 : 0);
      return rank(a.source) - rank(b.source);
    });
    const videoItems: HeroListingMediaItem[] = videos.map((v) => ({
      kind: 'video' as const,
      videoUrl: v.processed_url,
      posterUrl: v.thumbnail_url,
      source: v.source,
    }));
    const imageItems: HeroListingMediaItem[] = images.map((url) => ({ kind: 'image' as const, url }));
    return [...videoItems, ...imageItems];
  }, [data]);

  const openHeroViewerAtIndex = useCallback(
    (heroIndex: number) => {
      const item = heroListingMediaItems[heroIndex];
      if (!item) return;
      if (item.kind === 'video') {
        setVideoFullscreenUri(item.videoUrl);
        return;
      }
      const imageUrls = heroListingMediaItems.filter((x) => x.kind === 'image').map((x) => x.url);
      const imageIndex = heroListingMediaItems.slice(0, heroIndex).filter((x) => x.kind === 'image').length;
      setImageViewerUrls(imageUrls);
      setImageViewerIndex(imageIndex);
      setImageViewerVisible(true);
    },
    [heroListingMediaItems],
  );

  // ── Loading / Error states ──

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}><Ionicons name="arrow-back" size={18} color="#f8fafc" /></TouchableOpacity>
          <Text style={s.headerTitle}>Sorgu Detayı</Text>
          <TouchableOpacity onPress={() => setUserMenuVisible(true)} style={s.headerBtn} accessibilityLabel="Uygulama menüsü">
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
          <Text style={s.loadingText}>Yükleniyor...</Text>
        </View>
        <UserMenuModal visible={userMenuVisible} onClose={() => setUserMenuVisible(false)} currentScreen="son-30-gun-detay" />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}><Ionicons name="arrow-back" size={18} color="#f8fafc" /></TouchableOpacity>
          <Text style={s.headerTitle}>Sorgu Detayı</Text>
          <TouchableOpacity onPress={() => setUserMenuVisible(true)} style={s.headerBtn} accessibilityLabel="Uygulama menüsü">
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={s.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.dangerRed} />
          <Text style={s.errorText}>{error || 'Sorgu bulunamadı'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadDetail}>
            <Text style={s.retryBtnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
        <UserMenuModal visible={userMenuVisible} onClose={() => setUserMenuVisible(false)} currentScreen="son-30-gun-detay" />
      </SafeAreaView>
    );
  }

  // ── Expert data ──
  const expertRequest = data.expert?.request;
  const expertResponses = data.expert?.responses || [];
  const hasExpertResponses = expertResponses.length > 0;
  const expertStatus = expertRequest?.status?.toLowerCase();

  // ── Build info rows ──
  const infoRows: [string, string, boolean?][] = [];
  const parcelShapeRaw =
    data.parcel_shape_type_label ||
    data.parcel_shape_type ||
    data.edge_measure_data?.parcel_shape_type_label ||
    data.edge_measure_data?.parcel_shape_type ||
    null;
  const parcelShapeText = parcelShapeRaw
    ? normalizeParcelShapeLabel(parcelShapeRaw) ?? String(parcelShapeRaw)
    : null;
  const totalRoadFrontageLength =
    data.road_frontage_values?.total_road_frontage_edge_length_m ??
    data.edge_measure_data?.total_road_frontage_edge_length_m ??
    null;
  infoRows.push(['Konum', data.quarter_name || '—']);
  infoRows.push(['Ada / Parsel', `${data.ada || '0'}/${data.parsel || '0'}`]);
  infoRows.push(['Tip', typeLabel]);
  if (parcelShapeText) infoRows.push(['Parsel Formu', String(parcelShapeText)]);
  infoRows.push(['Arazi Alanı', formatArea(data.arazi_m2 ?? data.area_m2)]);
  if (totalRoadFrontageLength != null && !data.listing_id) {
    infoRows.push(['Toplam Yola Cephe', formatMeters(totalRoadFrontageLength)]);
  }
  if (data.building_params && typeof data.building_params === 'object') {
    Object.entries(data.building_params).forEach(([k, v]) => {
      if (v != null && v !== '') infoRows.push([k, String(v)]);
    });
  }
  if (isBuildingType && data.arsa_fiyati != null && data.arsa_fiyati > 0) {
    infoRows.push(['Arsa Fiyatı', formatPrice(data.arsa_fiyati)]);
  }
  if (isBuildingType && data.bina_maliyeti != null && data.bina_maliyeti > 0) {
    const maliyetLabel = queryType === 'villa' ? 'Villa Maliyeti' : queryType === 'fabrika' ? 'Fabrika Maliyeti' : 'Bina Maliyeti';
    infoRows.push([maliyetLabel, formatPrice(data.bina_maliyeti)]);
  }
  const canSeeExpertDetail = Boolean(
    data.viewer_is_staff || data.viewer_is_expert_for_this_query || data.viewer_is_expert_user
  );
  if (canSeeExpertDetail && data.expert_price_detail && typeof data.expert_price_detail === "object") {
    const expertPriceDetail = data.expert_price_detail as any;
    const details = expertPriceDetail?.price_selection?.details || {};
    const parcelValues = expertPriceDetail?.parcel_values || {};
    const formatExpertPrice = (v: unknown) => {
      if (v == null || v === "") return "—";
      const n = Number(v);
      return Number.isFinite(n) ? formatPrice(n) : String(v);
    };
    if (details.db_price != null || details.db_unit_price != null) infoRows.push(["DB Birim Fiyat", formatExpertPrice(details.db_price ?? details.db_unit_price)]);
    if (details.km_price != null || details.km_recommended_price != null) infoRows.push(["KM Birim Fiyat", formatExpertPrice(details.km_price ?? details.km_recommended_price)]);
    if (details.prediction_price != null || details.prediction_first_price != null) infoRows.push(["Tahmin Birim Fiyat", formatExpertPrice(details.prediction_price ?? details.prediction_first_price)]);
    const parcelUnit = parcelValues.parcel_unit_from_dfa ?? parcelValues.unite_price ?? parcelValues.parcel_uniteprice;
    if (parcelUnit != null) infoRows.push(["Parsel Birim Fiyat", formatExpertPrice(parcelUnit)]);
  }
  if (canSeeExpertDetail || !isBuildingType) {
    infoRows.push(['Birim Fiyat', formatPrice(data.unit_price)]);
  }
  infoRows.push(['ProParcel Tahmin', formatPrice(data.total_price), true]);
  infoRows.push([
    'Toplam',
    data.listing_price_amount != null && Number.isFinite(Number(data.listing_price_amount))
      ? formatPrice(data.listing_price_amount)
      : '—',
    true,
  ]);
  infoRows.push(['Tarih', formatDate(data.created_at)]);

  const mergedFullRows = dedupeDetailRowsFinal(mergeParcelAndListingDetailRows(infoRows, data));
  const primaryListingRows = data.listing_id ? buildListingInfoPrimaryRows(data) : [];
  const listingOzellikRows = data.listing_id ? buildListingOzellikRows(data, mergedFullRows) : [];

  // ── Owner card ──
  const oc = data.owner_card;
  const hasOwnerCard = oc && (oc.full_name || oc.avatar_url || oc.phone || oc.email);
  const hasCompanyCard = oc && (oc.company_name || oc.company_logo_url);
  const openOwnerVisitorProfile = () => {
    const uid = oc?.user_id;
    if (uid == null) return;
    router.push('visitor-badges', {
      userId: String(uid),
      displayName: (oc?.full_name && String(oc.full_name).trim()) || undefined,
    });
  };

  const renderOwnerContactCard = () => {
    if (!hasCompanyCard && !hasOwnerCard) return null;
    const inner = (
      <>
        {hasCompanyCard && (
          <View style={s.ownerRow}>
            {oc!.company_logo_url ? (
              <Image source={{ uri: resolveImageUrl(oc!.company_logo_url)! }} style={s.companyLogo} resizeMode="contain" />
            ) : (
              <View style={[s.companyLogo, s.companyLogoPlaceholder]}>
                <Ionicons name="business" size={20} color={COLORS.textSecondary} />
              </View>
            )}
            <Text style={s.companyName}>{oc!.company_name || '—'}</Text>
          </View>
        )}
        {hasOwnerCard && (
          <View style={s.ownerRow}>
            {oc!.avatar_url ? (
              <Image source={{ uri: resolveImageUrl(oc!.avatar_url)! }} style={s.ownerAvatar} />
            ) : (
              <View style={[s.ownerAvatar, s.ownerAvatarPlaceholder]}>
                <Ionicons name="person" size={20} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={s.ownerInfo}>
              {oc!.full_name && <Text style={s.ownerName}>{oc!.full_name}</Text>}
              {oc!.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${oc!.phone!.replace(/[^0-9+]/g, '')}`)}>
                  <Text style={s.ownerPhone}>{oc!.phone}</Text>
                </TouchableOpacity>
              )}
              {oc!.email && (
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${encodeURIComponent(oc!.email!)}`)}>
                  <Text style={s.ownerEmail}>{oc!.email}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </>
    );
    if (oc?.user_id != null) {
      return (
        <Pressable style={[s.card, { marginTop: 12 }]} onPress={openOwnerVisitorProfile}>
          {inner}
        </Pressable>
      );
    }
    return <View style={[s.card, { marginTop: 12 }]}>{inner}</View>;
  };

  // ── Road Report Full Page ──
  if (roadReportModalVisible && data?.parcel_coords_lonlat && data.parcel_coords_lonlat.length > 0) {
    const ring = roadSelectableRing;
    const closedRing = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]] : ring;
    const cLon = ring.reduce((sum, c) => sum + c[0], 0) / Math.max(1, ring.length);
    const cLat = ring.reduce((sum, c) => sum + c[1], 0) / Math.max(1, ring.length);
    const parcelGeoJSON = {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [closedRing] },
      properties: {},
    };
    const selectionMap = new Map<number, RoadOverrideSelectionMobile>();
    normalizeRoadOverrideSelectionsMobile(roadOverrideSelections).forEach((item) => {
      selectionMap.set(item.edge_id, item);
    });
    const edgeFeatures = ring.map((p1, i) => {
      const p2 = ring[(i + 1) % ring.length];
      const selected = selectionMap.get(i);
      const isSelected = selected?.road_type_id != null;
      const isFocused = roadFocusedEdgeId === i;
      const color = isSelected ? '#22c55e' : (isFocused ? '#f59e0b' : '#60a5fa');
      const width = isSelected || isFocused ? 5.5 : 4;
      return {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: [p1, p2] },
        properties: {
          edgeId: i,
          color,
          width,
          label: `Kenar ${i + 1} (${Math.round(haversineMetersMobile(p1[0], p1[1], p2[0], p2[1]))}m)`,
        },
      };
    });
    const edgeCollection = { type: 'FeatureCollection' as const, features: edgeFeatures };
    const title = completedRoadSelections.length > 0
      ? 'Lütfen başka bir kenarda yol geçiyorsa o kenarı seçiniz'
      : 'Arazinin hangi kenarında yol geçiyorsa lütfen harita üzerinde o kenarı seçiniz';

    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => setRoadReportModalVisible(false)} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Yol Bildir</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          <Text style={s.roadGuideText}>{title}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {Mapbox ? (
            <Mapbox.MapView
              style={{ flex: 1 }}
              styleURL="mapbox://styles/mapbox/satellite-streets-v12"
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
            >
              <Mapbox.Camera
                defaultSettings={{ centerCoordinate: [cLon, cLat], zoomLevel: 17 }}
                animationDuration={0}
              />
              <Mapbox.ShapeSource id="roadReportParcelSrc" shape={parcelGeoJSON}>
                <Mapbox.FillLayer id="roadReportParcelFill" style={{ fillColor: '#dc2626', fillOpacity: 0.22 }} />
                <Mapbox.LineLayer id="roadReportParcelStroke" style={{ lineColor: '#ef4444', lineWidth: 2 }} />
              </Mapbox.ShapeSource>
              <Mapbox.ShapeSource
                id="roadReportEdgesSrc"
                shape={edgeCollection}
                onPress={(ev: any) => {
                  const feature = ev?.features?.[0];
                  const edgeId = feature?.properties?.edgeId;
                  handleRoadEdgeSelect(edgeId);
                }}
              >
                <Mapbox.LineLayer
                  id="roadReportEdgesLine"
                  style={{
                    lineColor: ['get', 'color'],
                    lineWidth: ['get', 'width'],
                    lineOpacity: 0.98,
                  }}
                />
              </Mapbox.ShapeSource>
            </Mapbox.MapView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg }}>
              <Ionicons name="map-outline" size={40} color="#94a3b8" />
              <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>Harita yüklenemedi</Text>
            </View>
          )}
        </View>
        <View style={[s.roadSelectionPanel, { paddingBottom: Math.max(12, insets.bottom + 10) }]}>
          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {normalizeRoadOverrideSelectionsMobile(roadOverrideSelections).length ? (
              normalizeRoadOverrideSelectionsMobile(roadOverrideSelections).map((item) => (
                <View key={`road-choice-${item.edge_id}`} style={[s.roadChoiceCard, roadFocusedEdgeId === item.edge_id && s.roadChoiceCardFocused]}>
                  <View style={s.roadChoiceHeader}>
                    <TouchableOpacity onPress={() => setRoadFocusedEdgeId(item.edge_id)} style={s.roadChoiceEdgeBtn}>
                      <Text style={s.roadChoiceEdgeBtnText}>Kenar {item.edge_id + 1}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRoadSelectionRemove(item.edge_id)}>
                      <Text style={s.roadChoiceRemove}>Kaldır</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.roadChoiceRow}>
                    <TouchableOpacity style={s.roadChoiceRadioWrap} onPress={() => handleRoadTypePick(item.edge_id, 13)}>
                      <Ionicons name={item.road_type_id === 13 ? 'radio-button-on' : 'radio-button-off'} size={16} color="#2563eb" />
                      <Text style={s.roadChoiceRadioText}>Kadastral Yol</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.roadChoiceRadioWrap} onPress={() => handleRoadTypePick(item.edge_id, 9)}>
                      <Ionicons name={item.road_type_id === 9 ? 'radio-button-on' : 'radio-button-off'} size={16} color="#2563eb" />
                      <Text style={s.roadChoiceRadioText}>Asfalt Yol</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.roadChoiceEmpty}>Haritada bir kenar seçin.</Text>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[s.roadModalDoneBtn, (completedRoadSelections.length === 0 || roadRerunSubmitting) && s.dfaRerunBtnDisabled]}
            onPress={() => handleRoadRerunSubmit('road')}
            disabled={completedRoadSelections.length === 0 || roadRerunSubmitting}
          >
            <Text style={s.roadModalDoneBtnText}>{roadRerunSubmitting ? 'Güncelleniyor...' : 'Güncelle'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Edge Measurement Full Page ──
  if (edgeModalVisible && data.parcel_coords_lonlat && data.parcel_coords_lonlat.length > 0) {
    const coords = data.parcel_coords_lonlat;
    const ring = coords.map(c => [c[0], c[1]] as [number, number]);
    const closedRing = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]] : ring;
    const cLon = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
    const cLat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
    const parcelGeoJSON = {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [closedRing] },
      properties: {},
    };
    let edgeFeatures: EdgeMeasurementFeature[] = [];
    try {
      edgeFeatures = createEdgeMeasurementFeatures(
        { type: 'Polygon', coordinates: [closedRing] },
        data.edge_measure_data as EdgeMeasureData,
      );
    } catch (e) {
      console.warn('[son-30-gun-detay] Edge features oluşturulamadı', e);
    }

    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => setEdgeModalVisible(false)} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Kenar Ölçüleri</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1 }}>
          {Mapbox ? (
            <Mapbox.MapView
              style={{ flex: 1 }}
              styleURL="mapbox://styles/mapbox/satellite-streets-v12"
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
            >
              <Mapbox.Camera
                defaultSettings={{ centerCoordinate: [cLon, cLat], zoomLevel: 17 }}
                animationDuration={0}
              />
              <Mapbox.ShapeSource id="detailParcelSrc" shape={parcelGeoJSON}>
                <Mapbox.FillLayer id="detailParcelFill" style={{ fillColor: '#dc2626', fillOpacity: 0.25 }} />
                <Mapbox.LineLayer id="detailParcelStroke" style={{ lineColor: '#FF0000', lineWidth: 2 }} />
              </Mapbox.ShapeSource>
              {edgeFeatures.map((f, i) => {
                const color = f.properties.color || '#2563eb';
                const isBBox = f.properties.kind === 'bbox';
                const isSegment = f.properties.kind === 'segment';
                return (
                  <Mapbox.ShapeSource key={`det-edge-${i}`} id={`det-edge-${i}`} shape={f}>
                    {f.geometry.type === 'LineString' && (
                      <Mapbox.LineLayer
                        id={`det-edge-ln-${i}`}
                        style={{
                          lineColor: isBBox ? '#ffffff' : color,
                          lineWidth: isBBox ? 1.5 : (isSegment ? 3 : 2),
                          lineDasharray: isBBox ? [2, 2] : undefined,
                        }}
                      />
                    )}
                    {f.geometry.type === 'Point' && f.properties.text && (
                      <Mapbox.SymbolLayer
                        id={`det-edge-lbl-${i}`}
                        style={{
                          textField: ['get', 'text'],
                          textSize: 13,
                          textColor: '#ffffff',
                          textHaloColor: '#000000',
                          textHaloWidth: 2,
                          textAnchor: 'center',
                          textAllowOverlap: true,
                        }}
                      />
                    )}
                  </Mapbox.ShapeSource>
                );
              })}
            </Mapbox.MapView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg }}>
              <Ionicons name="resize-outline" size={40} color="#94a3b8" />
              <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>Harita yüklenemedi</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Electric Line Map Full Page ──
  if (electricMapVisible && data.parcel_coords_lonlat && data.parcel_coords_lonlat.length > 0) {
    const coords = data.parcel_coords_lonlat;
    const ring = coords.map(c => [c[0], c[1]] as [number, number]);
    const closedRing = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]] : ring;
    const cLon = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
    const cLat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;

    const parcelGeoJSON = {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [closedRing] },
      properties: {},
    };
    const lineFeatures = electricOverrideLines.map((line) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [line.start, line.end] },
      properties: { label: `${line.voltage_kv} KV` },
    }));
    const lineGeoJSON = {
      type: 'FeatureCollection' as const,
      features: lineFeatures,
    };
    const draftGeoJSON = electricDraftStart && electricDraftCursor ? {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [electricDraftStart, electricDraftCursor] },
      properties: {},
    } : null;
    const pointFeatures = electricOverrideLines.flatMap((line, idx) => ([
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: line.start }, properties: { label: `L${idx + 1}A` } },
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: line.end }, properties: { label: `L${idx + 1}B` } },
    ]));
    if (electricDraftStart) {
      pointFeatures.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: electricDraftStart },
        properties: { label: 'Başlangıç' },
      });
    }
    const pointsGeoJSON = {
      type: 'FeatureCollection' as const,
      features: pointFeatures,
    };
    const electricTitle = electricOverrideLines.length > 0
      ? 'Lütfen başka bir hat varsa parsel üzerinde iki nokta ile ekleyin.'
      : 'Parsel üzerinde ilk ve ikinci noktayı seçerek hat çizin.';

    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => setElectricMapVisible(false)} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Hat Bildir</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          <Text style={s.roadGuideText}>{electricTitle}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {Mapbox ? (
            <Mapbox.MapView
              style={{ flex: 1 }}
              styleURL="mapbox://styles/mapbox/satellite-streets-v12"
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
              onPress={(ev: any) => {
                const coordsTap = ev?.geometry?.coordinates;
                if (!Array.isArray(coordsTap) || coordsTap.length < 2) return;
                handleElectricMapTap([Number(coordsTap[0]), Number(coordsTap[1])]);
              }}
            >
              <Mapbox.Camera
                defaultSettings={{ centerCoordinate: [cLon, cLat], zoomLevel: 16 }}
                animationDuration={0}
              />
              {/* Parcel */}
              <Mapbox.ShapeSource id="hvParcelSrc" shape={parcelGeoJSON}>
                <Mapbox.FillLayer id="hvParcelFill" style={{ fillColor: 'rgba(34,197,94,0.25)' }} />
                <Mapbox.LineLayer id="hvParcelStroke" style={{ lineColor: '#16a34a', lineWidth: 2 }} />
              </Mapbox.ShapeSource>
              <Mapbox.ShapeSource id="hvLinesSrc" shape={lineGeoJSON}>
                <Mapbox.LineLayer
                  id="hvLineLayer"
                  style={{ lineColor: '#FF4500', lineWidth: 4, lineOpacity: 0.9 }}
                />
                <Mapbox.SymbolLayer
                  id="hvLineLabel"
                  style={{ textField: ['get', 'label'], textSize: 11, textColor: '#fff', textHaloColor: '#000', textHaloWidth: 1.5, textAllowOverlap: true }}
                />
              </Mapbox.ShapeSource>
              {draftGeoJSON ? (
                <Mapbox.ShapeSource id="hvDraftSrc" shape={draftGeoJSON}>
                  <Mapbox.LineLayer id="hvDraftLayer" style={{ lineColor: '#f59e0b', lineWidth: 3, lineDasharray: [2, 1], lineOpacity: 0.95 }} />
                </Mapbox.ShapeSource>
              ) : null}
              <Mapbox.ShapeSource id="hvPointsSrc" shape={pointsGeoJSON}>
                <Mapbox.CircleLayer id="hvPointCircle" style={{ circleRadius: 6, circleColor: '#FF4500', circleStrokeWidth: 1.5, circleStrokeColor: '#fff' }} />
              </Mapbox.ShapeSource>
            </Mapbox.MapView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg }}>
              <Ionicons name="flash-outline" size={40} color="#94a3b8" />
              <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>Harita yüklenemedi</Text>
            </View>
          )}
        </View>
        <View style={[s.roadSelectionPanel, { paddingBottom: Math.max(12, insets.bottom + 10) }]}>
          <View style={s.roadChoiceCard}>
            <Text style={s.roadChoiceEdgeBtnText}>Enerji Tipi</Text>
            <View style={[s.roadChoiceRow, { marginTop: 8, flexWrap: 'wrap' as const }]}>
              {[64, 154, 380].map((kv) => (
                <TouchableOpacity key={`kv-${kv}`} style={s.roadChoiceRadioWrap} onPress={() => setElectricSelectedVoltageKv(kv as 64 | 154 | 380)}>
                  <Ionicons name={electricSelectedVoltageKv === kv ? 'radio-button-on' : 'radio-button-off'} size={16} color="#2563eb" />
                  <Text style={s.roadChoiceRadioText}>{kv} KV</Text>
                </TouchableOpacity>
              ))}
            </View>
            {electricDraftStart ? (
              <TouchableOpacity onPress={() => { setElectricDraftStart(null); setElectricDraftCursor(null); }} style={{ marginTop: 8 }}>
                <Text style={s.roadChoiceRemove}>Seçimi İptal Et</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView style={{ maxHeight: 170 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {electricOverrideLines.length ? (
              electricOverrideLines.map((line, idx) => (
                <View key={line.id} style={s.roadChoiceCard}>
                  <View style={s.roadChoiceHeader}>
                    <View style={s.roadChoiceEdgeBtn}>
                      <Text style={s.roadChoiceEdgeBtnText}>Hat {idx + 1} ({line.voltage_kv} KV)</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleElectricRemoveLine(line.id)}>
                      <Text style={s.roadChoiceRemove}>Kaldır</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.roadChoiceEmpty}>Haritaya iki nokta koyarak hat ekleyin.</Text>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[s.roadModalDoneBtn, (electricOverrideLines.length === 0 || roadRerunSubmitting) && s.dfaRerunBtnDisabled]}
            onPress={() => handleRoadRerunSubmit('electric')}
            disabled={electricOverrideLines.length === 0 || roadRerunSubmitting}
          >
            <Text style={s.roadModalDoneBtnText}>{roadRerunSubmitting ? 'Güncelleniyor...' : 'Güncelle'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Map Full Page with 2D/3D toggle ──
  if (mapPageVisible && data.parcel_coords_lonlat && data.parcel_coords_lonlat.length > 0) {
    const coords = data.parcel_coords_lonlat;
    const ring = coords.map(c => [c[0], c[1]] as [number, number]);
    const closedRing = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]] : ring;
    const cLon = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
    const cLat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
    const parcelGeoJSON = {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [closedRing] },
      properties: {
        label: `${data.ada || '0'}/${data.parsel || '0'}\n${formatArea(data.arazi_m2 ?? data.area_m2)}\n${data.unit_price ? Math.round(data.unit_price).toLocaleString('tr-TR') + ' ₺/m²' : ''}`,
      },
    };

    const allMapCoords: [number, number][] = [...ring];
    if (emsalGeoJSON) {
      for (const f of emsalGeoJSON.features) {
        const fCoords = f.geometry?.coordinates?.[0];
        if (fCoords) fCoords.forEach((c: number[]) => allMapCoords.push([c[0], c[1]]));
      }
    }
    const hasEmsalOnMap = emsalGeoJSON && allMapCoords.length > ring.length;
    const mapLons = allMapCoords.map(c => c[0]);
    const mapLats = allMapCoords.map(c => c[1]);
    const mapBounds = hasEmsalOnMap ? {
      ne: [Math.max(...mapLons), Math.max(...mapLats)] as [number, number],
      sw: [Math.min(...mapLons), Math.min(...mapLats)] as [number, number],
      paddingTop: 60, paddingBottom: 60, paddingLeft: 60, paddingRight: 60,
    } : undefined;

    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setMapPageVisible(false); setMapIs3D(false); setMapPitchValue(60); mapCamState.current = { zoom: 17, pitch: 60, heading: 0 }; }} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Harita</Text>
          <TouchableOpacity
            onPress={() => setMapIs3D(prev => !prev)}
            style={[s.headerBtn, mapIs3D && { backgroundColor: 'rgba(59,130,246,0.35)', borderColor: 'rgba(59,130,246,0.5)' }]}
          >
            <Ionicons name={mapIs3D ? 'cube' : 'cube-outline'} size={18} color="#f8fafc" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          {Mapbox ? (
            <Mapbox.MapView
              key={mapIs3D ? 'map3d' : 'map2d'}
              style={{ flex: 1 }}
              styleURL="mapbox://styles/mapbox/satellite-streets-v12"
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
            >
              <Mapbox.Camera
                ref={mapCameraRef}
                defaultSettings={mapBounds ? {
                  bounds: mapBounds,
                  pitch: mapIs3D ? 60 : 0,
                } : {
                  centerCoordinate: [cLon, cLat],
                  zoomLevel: 17,
                  pitch: mapIs3D ? 60 : 0,
                }}
                animationDuration={0}
              />
              {mapIs3D && RasterDemSource && Terrain && (
                <RasterDemSource id="mapbox-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxZoomLevel={15}>
                  <Terrain style={{ exaggeration: 1.5 }} />
                </RasterDemSource>
              )}
              {mapIs3D && SkyLayer && (
                <SkyLayer
                  id="sky-layer"
                  style={{
                    skyType: 'atmosphere',
                    skyAtmosphereSun: [0, 0],
                    skyAtmosphereSunIntensity: 15,
                  }}
                />
              )}
              {/* Emsal (comparable) parcels – green */}
              {emsalGeoJSON && (
                <Mapbox.ShapeSource id="map-emsal-src" shape={emsalGeoJSON}>
                  <Mapbox.FillLayer id="map-emsal-fill" style={{ fillColor: '#22c55e', fillOpacity: 0.25 }} />
                  <Mapbox.LineLayer id="map-emsal-line" style={{ lineColor: '#15803d', lineWidth: 2.5, lineOpacity: 0.9 }} />
                  <Mapbox.SymbolLayer
                    id="map-emsal-label"
                    style={{
                      textField: ['get', 'label'],
                      textSize: 10,
                      textColor: '#15803d',
                      textHaloColor: '#ffffff',
                      textHaloWidth: 1.5,
                      textAllowOverlap: true,
                      textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                      textAnchor: 'center',
                    }}
                  />
                </Mapbox.ShapeSource>
              )}
              {/* Queried parcel – red */}
              <Mapbox.ShapeSource id="mapParcelSrc" shape={parcelGeoJSON}>
                <Mapbox.FillLayer id="mapParcelFill" style={{ fillColor: '#dc2626', fillOpacity: 0.3 }} />
                <Mapbox.LineLayer id="mapParcelStroke" style={{ lineColor: '#FF0000', lineWidth: 2 }} />
                <Mapbox.SymbolLayer
                  id="mapParcelLabel"
                  style={{
                    textField: ['get', 'label'],
                    textSize: 12,
                    textColor: '#ffffff',
                    textHaloColor: '#000000',
                    textHaloWidth: 2,
                    textAllowOverlap: true,
                    textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    textAnchor: 'center',
                  }}
                />
              </Mapbox.ShapeSource>
            </Mapbox.MapView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg }}>
              <Ionicons name="map-outline" size={40} color="#94a3b8" />
              <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>Harita yüklenemedi</Text>
            </View>
          )}
          {/* 3D Navigation Controls */}
          {mapIs3D && (
            <View style={mc.controlsWrapper} pointerEvents="box-none">
              <View style={mc.navPanel} pointerEvents="auto">
                <View style={mc.navRow}>
                  <View style={mc.navSpacer} />
                  <TouchableOpacity onPressIn={() => mapStartZoom(1.0)} onPressOut={mapStopZoom} style={mc.navBtn}>
                    <Ionicons name="chevron-up" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                  <View style={mc.navSpacer} />
                </View>
                <View style={mc.navRow}>
                  <TouchableOpacity onPressIn={() => mapStartHeading(15)} onPressOut={mapStopHeading} style={mc.navBtn}>
                    <Ionicons name="chevron-back" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                  <View style={mc.navSpacer} />
                  <TouchableOpacity onPressIn={() => mapStartHeading(-15)} onPressOut={mapStopHeading} style={mc.navBtn}>
                    <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
                <View style={mc.navRow}>
                  <View style={mc.navSpacer} />
                  <TouchableOpacity onPressIn={() => mapStartZoom(-1.0)} onPressOut={mapStopZoom} style={mc.navBtn}>
                    <Ionicons name="chevron-down" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                  <View style={mc.navSpacer} />
                </View>
              </View>
              <View style={mc.pitchPanel} pointerEvents="auto">
                <TouchableOpacity onPressIn={() => mapStartPitch(5)} onPressOut={mapStopPitch} style={mc.pitchBtn}>
                  <Ionicons name="add" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <Text style={mc.pitchText}>{Math.round(mapPitchValue)}°</Text>
                <TouchableOpacity onPressIn={() => mapStartPitch(-5)} onPressOut={mapStopPitch} style={mc.pitchBtn}>
                  <Ionicons name="remove" size={20} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {data.quarter_name || `${data.ada}/${data.parsel}`}
          </Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={handleShareMenu} style={s.headerBtn} accessibilityLabel="Paylaş">
            <Ionicons name="share-outline" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setUserMenuVisible(true)} style={s.headerBtn} accessibilityLabel="Uygulama menüsü">
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDetailMenuVisible(true)} style={s.headerBtn} accessibilityLabel="Sorgu işlemleri">
            <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {data.listing_title && String(data.listing_title).trim() ? (
        <View style={s.listingTitleBar}>
          <Text style={s.listingTitleText} numberOfLines={3}>
            {String(data.listing_title).trim()}
          </Text>
        </View>
      ) : null}

      <View style={[s.modeNoticeBar, isListingDetailView ? s.modeNoticeBarListing : s.modeNoticeBarQuery]}>
        <View style={[s.modeNoticeDot, isListingDetailView ? s.modeNoticeDotListing : s.modeNoticeDotQuery]} />
        <Text style={s.modeNoticeText}>{detailModeNoticeText}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Breadcrumb */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.breadcrumbWrap} contentContainerStyle={s.breadcrumbContent}>
          <Text style={s.breadcrumbItem}>{typeLabel}</Text>
          {data.city_name && (
            <>
              <Ionicons name="chevron-forward" size={12} color={COLORS.textSecondary} style={s.breadcrumbArrow} />
              <Text style={s.breadcrumbItem}>{data.city_name}</Text>
            </>
          )}
          {data.town_name && (
            <>
              <Ionicons name="chevron-forward" size={12} color={COLORS.textSecondary} style={s.breadcrumbArrow} />
              <Text style={s.breadcrumbItem}>{data.town_name}</Text>
            </>
          )}
          {data.quarter_name && (
            <>
              <Ionicons name="chevron-forward" size={12} color={COLORS.textSecondary} style={s.breadcrumbArrow} />
              <Text style={[s.breadcrumbItem, s.breadcrumbItemActive]}>{data.quarter_name}</Text>
            </>
          )}
        </ScrollView>

        {/* Harita üstü action bar (puan/yorum + beğeni + favori) */}
        <View style={s.heroMediaTabsRow}>
          {heroListingMediaItems.length > 0 ? (
            <View style={s.heroMediaTabsLeft}>
              <TouchableOpacity
                style={[s.heroMediaTab, heroTopTab === 'images' && s.heroMediaTabActive]}
                onPress={() => setHeroTopTab('images')}
                activeOpacity={0.7}
              >
                <Text style={[s.heroMediaTabText, heroTopTab === 'images' && s.heroMediaTabTextActive]}>Resimler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.heroMediaTab, heroTopTab === 'map' && s.heroMediaTabActive]}
                onPress={() => setHeroTopTab('map')}
                activeOpacity={0.7}
              >
                <Text style={[s.heroMediaTabText, heroTopTab === 'map' && s.heroMediaTabTextActive]}>Harita</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.heroMediaTabsLeftPlaceholder} />
          )}
          <View style={s.heroMediaActionsRight}>
            {showListingFavoriteUi ? (
              <ListingFavoriteMenuMobile
                listingId={String(effectiveListingId).trim()}
                favoriteCountTotal={favoriteCountTotal}
                isAuthenticated={isAuthenticated}
                viewerIsOwner={Boolean(data?.viewer_is_listing_owner)}
                sourceSurface="listing_detail"
                touchableStyle={s.heroMediaFavBtn}
                touchableActiveStyle={s.heroMediaFavBtnActive}
                countStyle={s.heroMediaFavCount}
                countActiveStyle={s.heroMediaFavCountActive}
                onFavoriteCountChange={({ wasFavorite, isFavorite }) => {
                  if (wasFavorite === isFavorite) return;
                  setFavoriteCountTotal((current) =>
                    Math.max(0, current + (isFavorite ? 1 : -1)),
                  );
                }}
              />
            ) : (
              <QueryFavoriteMenuMobile
                snapshotId={Number.isFinite(snapshotId) && snapshotId > 0 ? snapshotId : 0}
                isQueryFavorite={isQueryFavorite}
                favoriteCountTotal={favoriteCountTotal}
                isAuthenticated={isAuthenticated}
                favoriteLoading={favoriteLoading}
                favoriteBusy={favoriteBusy}
                onApplyFavorite={applyQueryFavorite}
                touchableStyle={s.heroMediaFavBtn}
                touchableActiveStyle={s.heroMediaFavBtnActive}
                countStyle={s.heroMediaFavCount}
                countActiveStyle={s.heroMediaFavCountActive}
              />
            )}
            <TouchableOpacity
              style={s.heroMediaLikeBtn}
              onPress={() => void openEvalModal()}
              activeOpacity={0.7}
              accessibilityLabel={`Sorgu sonucunu puanla (Tepe Coin). Toplam begeni ${likeCount}`}
            >
              <Ionicons name="thumbs-up" size={16} color="#1d4ed8" />
              <Text style={s.heroMediaLikeCount}>{likeCount}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {heroListingMediaItems.length > 0 && heroTopTab === 'images' && (
          <View style={[s.mapContainer, s.heroGalleryColumn]}>
            <FlatList
              ref={heroGalleryListRef}
              data={heroListingMediaItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              removeClippedSubviews={false}
              keyExtractor={(media, i) =>
                media.kind === 'video'
                  ? `hero-main-v-${i}-${media.videoUrl.slice(-24)}`
                  : `hero-main-i-${i}-${media.url.slice(-24)}`
              }
              style={s.heroGalleryPager}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              initialScrollIndex={Math.min(heroGalleryIndex, Math.max(0, heroListingMediaItems.length - 1))}
              onMomentumScrollEnd={(e) => {
                const ix = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                if (ix >= 0 && ix < heroListingMediaItems.length) {
                  setHeroGalleryIndex(ix);
                }
              }}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  heroGalleryListRef.current?.scrollToIndex({ index: info.index, animated: false });
                }, 100);
              }}
              renderItem={({ item, index }) => {
                if (item.kind === 'video') {
                  const videoPaused =
                    index !== heroGalleryIndex || heroVideoPausedByIndex[index] === true;
                  const vStatus = heroVideoMediaStatus[index];
                  const showHeroVideoLoading =
                    index === heroGalleryIndex && vStatus === 'loading';
                  const showHeroVideoError = vStatus === 'error';
                  const posterUri =
                    item.posterUrl && !heroVideoPosterDismissed[index]
                      ? item.posterUrl
                      : undefined;
                  return (
                    <View style={s.heroGalleryPagerItem}>
                      {VideoComponent ? (
                        <VideoComponent
                          key={`hero-v-${index}-${heroVideoTapNonce[index] ?? 0}-${item.videoUrl.slice(-32)}`}
                          source={buildVideoSource(item.videoUrl)}
                          style={StyleSheet.absoluteFillObject}
                          resizeMode="cover"
                          paused={videoPaused}
                          muted={heroVideoMuted}
                          volume={heroVideoMuted ? 0 : 1}
                          repeat
                          poster={posterUri}
                          posterResizeMode="cover"
                          hideShutterView={Platform.OS === 'android'}
                          ignoreSilentSwitch={heroVideoMuted ? 'obey' : 'ignore'}
                          mixWithOthers={heroVideoMuted ? 'inherit' : 'mix'}
                          playInBackground={false}
                          playWhenInactive={false}
                          onLoadStart={() => {
                            setHeroVideoMediaStatus((prev) => ({ ...prev, [index]: 'loading' }));
                          }}
                          onLoad={() => {
                            setHeroVideoMediaStatus((prev) => ({ ...prev, [index]: 'ready' }));
                            setHeroVideoPosterDismissed((prev) => ({ ...prev, [index]: true }));
                          }}
                          onError={(e: unknown) => {
                            if (__DEV__) {
                              console.warn('[son-30-gun-detay] hero video error', index, e);
                            }
                            setHeroVideoMediaStatus((prev) => ({ ...prev, [index]: 'error' }));
                          }}
                        />
                      ) : item.posterUrl ? (
                        <Image source={{ uri: item.posterUrl }} style={s.heroGalleryMainImg} resizeMode="cover" />
                      ) : (
                        <View style={[s.heroGalleryMainImg, s.heroVideoPosterFallback]}>
                          <Ionicons name="videocam-outline" size={40} color="#64748b" />
                        </View>
                      )}
                      {VideoComponent ? (
                        <Pressable
                          style={s.heroVideoTapOverlay}
                          onPress={() => {
                            if (index !== heroGalleryIndex) return;
                            setHeroVideoPausedByIndex((prev) => {
                              const p = prev[index];
                              const next =
                                p === true ? false : p === false ? true : false;
                              const bumpNonce = p !== false;
                              if (bumpNonce) {
                                setHeroVideoTapNonce((n) => ({
                                  ...n,
                                  [index]: (n[index] ?? 0) + 1,
                                }));
                                setHeroVideoPosterDismissed((d) => ({ ...d, [index]: false }));
                                setHeroVideoMediaStatus((st) => ({ ...st, [index]: 'loading' }));
                              }
                              return { ...prev, [index]: next };
                            });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={
                            videoPaused ? 'Videoyu oynat' : 'Videoyu duraklat'
                          }
                        />
                      ) : null}
                      {VideoComponent && index === heroGalleryIndex && heroVideoPausedByIndex[index] === true ? (
                        <View style={s.heroVideoPlayHint} pointerEvents="none">
                          <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.92)" />
                        </View>
                      ) : null}
                      {VideoComponent && showHeroVideoLoading ? (
                        <View style={s.heroVideoLoadingOverlay} pointerEvents="none">
                          <ActivityIndicator size="large" color="#fff" />
                          <Text style={s.heroVideoLoadingText}>Video yükleniyor…</Text>
                        </View>
                      ) : null}
                      {VideoComponent && showHeroVideoError ? (
                        <View style={s.heroVideoErrorOverlay} pointerEvents="none">
                          <Ionicons name="alert-circle-outline" size={40} color="#fecaca" />
                          <Text style={s.heroVideoErrorText}>Video oynatılamadı</Text>
                          <Text style={s.heroVideoErrorHint} numberOfLines={2}>
                            Ağ veya biçim sorunu olabilir. Tam ekranı veya yeniden denemeyi deneyin.
                          </Text>
                        </View>
                      ) : null}
                      {VideoComponent ? (
                        <TouchableOpacity
                          style={s.heroVideoMuteBtn}
                          onPress={() => setHeroVideoMuted((m) => !m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel={heroVideoMuted ? 'Sesi aç' : 'Sesi kapat'}
                        >
                          <Ionicons
                            name={heroVideoMuted ? 'volume-mute' : 'volume-high'}
                            size={22}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={s.heroVideoFullscreenBtn}
                        onPress={() => setVideoFullscreenUri(item.videoUrl)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Tam ekran video"
                      >
                        <Ionicons name="expand-outline" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    style={s.heroGalleryPagerItem}
                    activeOpacity={0.9}
                    onPress={() => openHeroViewerAtIndex(index)}
                  >
                    <Image source={{ uri: item.url }} style={s.heroGalleryMainImg} resizeMode="cover" />
                  </TouchableOpacity>
                );
              }}
            />
            {heroListingMediaItems.length > 1 ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                style={s.heroGalleryThumbs}
                contentContainerStyle={s.heroGalleryThumbsContent}
              >
                {heroListingMediaItems.map((media, i) => {
                  const sel = i === Math.min(heroGalleryIndex, heroListingMediaItems.length - 1);
                  const thumbUri = media.kind === 'video' ? media.posterUrl || media.videoUrl : media.url;
                  return (
                    <TouchableOpacity
                      key={media.kind === 'video' ? `hero-g-v-${i}` : `hero-g-i-${i}`}
                      onPress={() => {
                        setHeroGalleryIndex(i);
                        heroGalleryListRef.current?.scrollToIndex({ index: i, animated: true });
                      }}
                      style={[s.heroGalleryThumb, sel && s.heroGalleryThumbSelected]}
                      activeOpacity={0.8}
                    >
                      <View style={s.heroGalleryThumbInner}>
                        <Image source={{ uri: thumbUri }} style={s.heroGalleryThumbImg} resizeMode="cover" />
                        {media.kind === 'video' ? (
                          <View style={s.heroGalleryThumbPlay} pointerEvents="none">
                            <Ionicons name="play" size={16} color="#fff" />
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        )}
        {(heroListingMediaItems.length === 0 || heroTopTab === 'map') && (
          <>
            {Mapbox && parcelGeom && parcelCenter && (
              <View style={s.mapContainer}>
                <Mapbox.MapView
                  style={{ flex: 1 }}
                  styleURL="mapbox://styles/mapbox/satellite-streets-v12"
                  logoEnabled={false}
                  attributionEnabled={false}
                  scaleBarEnabled={false}
                >
                  <Mapbox.Camera
                    defaultSettings={{ centerCoordinate: parcelCenter, zoomLevel: 17, animationDuration: 0 }}
                  />

                  {/* Emsal (comparable) parcels – green */}
                  {emsalGeoJSON && (
                    <Mapbox.ShapeSource id="emsal-src" shape={emsalGeoJSON}>
                      <Mapbox.FillLayer id="emsal-fill" style={{ fillColor: '#22c55e', fillOpacity: 0.25 }} />
                      <Mapbox.LineLayer id="emsal-line" style={{ lineColor: '#15803d', lineWidth: 2.5, lineOpacity: 0.9 }} />
                      <Mapbox.SymbolLayer
                        id="emsal-label"
                        style={{
                          textField: ['get', 'label'],
                          textSize: 10,
                          textColor: '#15803d',
                          textHaloColor: '#ffffff',
                          textHaloWidth: 1.5,
                          textAllowOverlap: true,
                          textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                          textAnchor: 'center',
                        }}
                      />
                    </Mapbox.ShapeSource>
                  )}

                  {/* Queried parcel – red */}
                  <Mapbox.ShapeSource id="parcel-src" shape={parcelGeoJSON}>
                    <Mapbox.FillLayer id="parcel-fill" style={{ fillColor: '#ef4444', fillOpacity: 0.3 }} />
                    <Mapbox.LineLayer id="parcel-line" style={{ lineColor: '#dc2626', lineWidth: 3, lineOpacity: 1 }} />
                    <Mapbox.SymbolLayer
                      id="parcel-label"
                      style={{
                        textField: ['get', 'label'],
                        textSize: 12,
                        textColor: '#ffffff',
                        textHaloColor: '#000000',
                        textHaloWidth: 2,
                        textAllowOverlap: true,
                        textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        textAnchor: 'center',
                      }}
                    />
                  </Mapbox.ShapeSource>
                </Mapbox.MapView>

                {/* "Sorgulanan Mülk" badge – top right */}
                <View style={s.mapBadge}>
                  <Text style={s.mapBadgeText}>Sorgulanan Mülk</Text>
                </View>

                {/* Full-screen map button – bottom right */}
                <TouchableOpacity
                  style={s.mapFullScreenBtn}
                  onPress={() => setMapPageVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="expand-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {(!Mapbox || !parcelGeom) && mapUrl && (
              <View style={s.mapContainer}>
                <Image source={{ uri: mapUrl }} style={s.mapImage} resizeMode="cover" />
              </View>
            )}
          </>
        )}

        {Number.isFinite(snapshotId) && (
          <>
            {isAuthenticated && profileInfo.companyName.trim() ? (
              <View style={s.firmBanner} accessibilityRole="header">
                <View style={s.firmBannerMark}>
                  {firmLogoUri ? (
                    <Image source={{ uri: firmLogoUri }} style={s.firmBannerLogo} resizeMode="contain" />
                  ) : (
                    <Ionicons name="business" size={16} color="#38bdf8" />
                  )}
                </View>
                <Text style={s.firmBannerName} numberOfLines={2}>
                  {profileInfo.companyName.trim()}
                </Text>
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.detailTabScroll} contentContainerStyle={s.detailTabScrollContent}>
              {detailTabDefs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[s.detailTabSquare, activeDetailTabId === tab.id && s.detailTabSquareActive]}
                  onPress={() => setActiveDetailTabId(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.detailTabSquareText, activeDetailTabId === tab.id && s.detailTabSquareTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.detailTabSquare, s.detailTabSquareAux]}
                onPress={() => {
                  router.push('promahalle', {
                    city_id: String(data?.city_id || ''),
                    town_id: String(data?.town_id || ''),
                    quarter_id: String(data?.quarter_id || ''),
                    proparcel_value: data?.proparcel_value ? String(data.proparcel_value) : undefined,
                    title: data?.quarter_name?.trim()
                      ? `ProMahalle — ${String(data.quarter_name).trim()}`
                      : 'ProMahalle',
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.detailTabSquareText, s.detailTabSquareAuxText]}>Mahalle Bilgileri</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.detailTabSquare, s.detailTabSquareAux]}
                onPress={() => handleViewReport()}
                activeOpacity={0.7}
              >
                <Text style={[s.detailTabSquareText, s.detailTabSquareAuxText]}>Rapor</Text>
              </TouchableOpacity>
            </ScrollView>

            {activeDetailTabId === 'listing_info' && data.listing_id ? (
              <View ref={listingInfoSectionRef}>
                <View style={s.card}>
                  <View style={s.cardTitleRow}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.accentBlue} />
                    <Text style={s.cardTitle}>İlan Bilgileri</Text>
                  </View>
                  <View style={s.detailInfoKvBox}>
                    {primaryListingRows.map(([lab, val], ri) => (
                      <View
                        key={`lpr-${ri}-${normalizeDetailLabelKey(lab)}`}
                        style={[
                          s.detailInfoKvRow,
                          ri === primaryListingRows.length - 1 &&
                            listingOzellikRows.length === 0 &&
                            s.detailInfoKvRowLast,
                        ]}
                      >
                        <Text style={s.detailInfoKvLabel}>{lab}</Text>
                        <Text style={s.detailInfoKvVal} numberOfLines={6}>
                          {val}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                {listingOzellikRows.length > 0 ? (
                  <View style={[s.card, { marginTop: 12 }]}>
                    <View style={s.cardTitleRow}>
                      <Ionicons name="options-outline" size={16} color={COLORS.accentBlue} />
                      <Text style={s.cardTitle}>Özellikler</Text>
                    </View>
                    <View style={s.detailInfoKvBox}>
                      {listingOzellikRows.map(([lab, val], ri) => (
                        <View
                          key={`loz-${ri}-${normalizeDetailLabelKey(lab)}`}
                          style={[
                            s.detailInfoKvRow,
                            ri === listingOzellikRows.length - 1 && s.detailInfoKvRowLast,
                          ]}
                        >
                          <Text style={s.detailInfoKvLabel}>{lab}</Text>
                          <Text style={s.detailInfoKvVal} numberOfLines={5}>
                            {val}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {activeDetailTabId === 'listing_description' && (
              <View ref={listingDescSectionRef} style={s.listingDescFullPage}>
                {data.listing_description && String(data.listing_description).trim() ? (
                  <ListingDescriptionRich content={String(data.listing_description).trim()} />
                ) : (
                  <Text style={s.detailEmptyTabText}>Bu kayıt için ilan açıklaması yok.</Text>
                )}
              </View>
            )}

            {activeDetailTabId === 'overview' && (
              <>
                <View ref={bilgiSectionRef}>
                  <PortalInsightSummaryCard detail={data} data={scores.insightData} />
                </View>
                <View ref={dfaSectionRef}>{renderDfaTable(data.dfa_json)}</View>
              </>
            )}

            {activeDetailTabId === 'km' && (
              <>{renderTahminModule()}</>
            )}

            {activeDetailTabId === 'slope' && (() => {
              const slopeElev = (data.slope_elevation_json || {}) as Record<string, any>;
              const morphology = (slopeElev.elevation_morphology || {}) as Record<string, any>;
              const sv = (slopeElev.parcel_slope_values || slopeElev.slope_values || {}) as Record<string, any>;
              const fmtPctBand = (v: any): string => {
                if (v == null || v === '') return '—';
                const n = Number(v);
                if (!isFinite(n)) return '—';
                const pct = (n <= 1 && n >= 0) ? (n * 100) : n;
                return `%${Math.round(pct)}`;
              };
              const formatRoundedSlope = (value: unknown): string => {
                if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
                return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.ceil(Number(value)));
              };
              const formatPercentSlope = (value: unknown): string => {
                if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
                return `%${formatRoundedSlope(value)}`;
              };
              const formatMetersSlope = (value: unknown): string => {
                if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
                return `${formatRoundedSlope(value)} m`;
              };
              const formatRangeSlope = (range: unknown): string => {
                if (!Array.isArray(range) || range.length < 2) return '—';
                return `${formatMetersSlope(range[0])} - ${formatMetersSlope(range[1])}`;
              };
              const avgSlopeRaw =
                morphology.avg_slope != null ? Number(morphology.avg_slope)
                  : sv.slope_avg_poly != null ? Number(sv.slope_avg_poly)
                    : sv.avg_slope != null ? Number(sv.avg_slope)
                      : NaN;
              const avgSlope = Number.isFinite(avgSlopeRaw) ? avgSlopeRaw : null;

              const morphRows = [
                { label: 'Arazi Sınıfı', value: String(morphology.type_label || '—') },
                { label: 'Morfoloji Tipi', value: String(morphology.type || '—') },
                {
                  label: 'Güven Seviyesi',
                  value: morphology.confidence != null && morphology.confidence !== ''
                    ? formatPercentSlope(Number(morphology.confidence) * 100)
                    : '—',
                },
              ];
              const distRows = [
                { label: '0-20 Eğim Alanı', value: formatPercentSlope(sv.parcel_slope_percent_0_20) },
                { label: '20-30 Eğim Alanı', value: formatPercentSlope(sv.parcel_slope_percent_20_30) },
                { label: '30+ Eğim Alanı', value: formatPercentSlope(sv.parcel_slope_percent_over_30) },
                { label: 'Eşik Üstü Alan', value: formatPercentSlope(sv.fraction_above_threshold) },
                { label: 'Ortalama Eğim', value: formatPercentSlope(sv.slope_avg_poly) },
              ];
              const elevRows = [
                { label: 'Ortalama Rakım', value: formatMetersSlope(morphology.avg_elevation) },
                { label: 'Rakım Aralığı', value: formatRangeSlope(morphology.elevation_range) },
                { label: 'Toplam Yükseklik Farkı', value: formatMetersSlope(morphology.range) },
                {
                  label: 'Parsel Alanı',
                  value: morphology.area_m2 != null ? `${formatRoundedSlope(morphology.area_m2)} m²` : '—',
                },
                { label: 'Taban Rakım', value: formatMetersSlope(sv.base_elevation) },
              ];

              const renderSlopeBlock = (title: string, rows: { label: string; value: string }[]) => (
                <View style={s.card}>
                  <View style={s.cardTitleRow}>
                    <Ionicons name="layers-outline" size={16} color={COLORS.accentBlue} />
                    <Text style={s.cardTitle}>{title}</Text>
                  </View>
                  {rows.map((row) => (
                    <View key={row.label} style={s.slopeDetailRow}>
                      <Text style={s.slopeDetailLabel}>{row.label}</Text>
                      <Text style={s.slopeDetailVal}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              );

              return (
                <View ref={slopeSectionRef}>
                  <View style={[s.card, s.slopeTerrainTopCard]}>
                    <PortalSlopeTerrainCard slope={avgSlope} />
                  </View>
                  {renderSlopeBlock('Morfoloji Özeti', morphRows)}
                  <View style={s.card}>
                    <View style={s.cardTitleRow}>
                      <Ionicons name="pie-chart-outline" size={16} color={COLORS.accentBlue} />
                      <Text style={s.cardTitle}>Parsel Eğim Dağılımı</Text>
                    </View>
                    <View style={sec.slopeGrid}>
                      <View style={[sec.slopeGridItem, { borderLeftColor: '#22c55e', borderLeftWidth: 3 }]}>
                        <Text style={sec.slopeGridLabel}>%20 Altında Eğim</Text>
                        <Text style={sec.slopeGridValue}>{fmtPctBand(sv.parcel_slope_percent_0_20)}</Text>
                      </View>
                      <View style={[sec.slopeGridItem, { borderLeftColor: '#eab308', borderLeftWidth: 3 }]}>
                        <Text style={sec.slopeGridLabel}>%20-%30 Arası</Text>
                        <Text style={sec.slopeGridValue}>{fmtPctBand(sv.parcel_slope_percent_20_30)}</Text>
                      </View>
                      <View style={[sec.slopeGridItem, { borderLeftColor: '#ef4444', borderLeftWidth: 3 }]}>
                        <Text style={sec.slopeGridLabel}>%30 Üzerinde</Text>
                        <Text style={sec.slopeGridValue}>{fmtPctBand(sv.parcel_slope_percent_over_30)}</Text>
                      </View>
                    </View>
                    {distRows.map((row) => (
                      <View key={row.label} style={s.slopeDetailRow}>
                        <Text style={s.slopeDetailLabel}>{row.label}</Text>
                        <Text style={s.slopeDetailVal}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                  {renderSlopeBlock('Rakım Özeti', elevRows)}
                </View>
              );
            })()}

            {activeDetailTabId === 'edge' && (
              <View ref={edgeSectionRef}>
                <View style={s.card}>
                  <View style={s.cardTitleRow}>
                    <Ionicons name="resize-outline" size={16} color={COLORS.accentBlue} />
                    <Text style={s.cardTitle}>Kenar Ölçüleri</Text>
                  </View>
                  {data.edge_measure_data && typeof data.edge_measure_data === 'object' && Object.keys(data.edge_measure_data as object).length > 0 && data.parcel_coords_lonlat && data.parcel_coords_lonlat.length > 0 ? (
                    <TouchableOpacity style={sec.linkBtn} onPress={() => setEdgeModalVisible(true)} activeOpacity={0.7}>
                      <Ionicons name="expand-outline" size={18} color={COLORS.accentBlue} />
                      <Text style={sec.linkBtnText}>Kenar ölçümlerini ve haritayı aç</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.detailEmptyTabText}>Bu kayıt için kenar ölçüm verisi yok.</Text>
                  )}
                </View>
              </View>
            )}

            {activeDetailTabId === 'electric' && (() => {
              const ev = (data.electric_values || {}) as Record<string, any>;
              const electricIsExist = ev.electric_isExist === true || ev.electric_isExist === 1;

              if (!electricIsExist) {
                return (
                  <View ref={electricSectionRef} style={s.card}>
                    <View style={s.cardTitleRow}>
                      <Ionicons name="flash" size={16} color={COLORS.accentGreen} />
                      <Text style={s.cardTitle}>Yüksek Gerilim</Text>
                    </View>
                    <View style={sec.noLineBox}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.accentGreen} />
                      <Text style={sec.noLineText}>Arazi Üzerinden Geçen Yüksek Gerilim Hattı Yok</Text>
                    </View>
                  </View>
                );
              }

              const parseVoltage = (v: any): number | null => { if (v == null) return null; const n = Number(v); return isFinite(n) && n > 0 ? n : null; };
              const parseArea = (v: any): number | null => { if (v == null) return null; const n = Number(v); return isFinite(n) ? n : null; };

              const lf = data.electric_line_feature as Record<string, any> | null;
              const voltageKV = parseVoltage(ev.KW) || parseVoltage(ev.voltage) || (lf?.properties ? parseVoltage(lf.properties.voltage) : null);
              const areaM2 = parseArea(ev.electric_area);
              const voltageDisplay = voltageKV != null ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(voltageKV)} kV` : '—';
              const areaDisplay = areaM2 != null ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(areaM2)} m²` : '—';
              let voltageClass = 'Bilinmiyor';
              if (voltageKV != null) {
                if (voltageKV >= 380) voltageClass = 'Çok Yüksek Gerilim (380 kV+)';
                else if (voltageKV >= 154) voltageClass = 'Yüksek Gerilim (154-380 kV)';
                else if (voltageKV >= 34.5) voltageClass = 'Orta Gerilim (34.5-154 kV)';
                else if (voltageKV >= 1) voltageClass = 'Alçak Gerilim (1-34.5 kV)';
                else voltageClass = 'Düşük Gerilim (<1 kV)';
              }

              const hasLineCoords = !!(
                (lf?.geometry?.coordinates && lf.geometry.coordinates.length >= 2) ||
                (Array.isArray(ev.electric_line) && ev.electric_line.length >= 2)
              );

              return (
                <TouchableOpacity
                  ref={electricSectionRef as any}
                  style={s.card}
                  activeOpacity={hasLineCoords ? 0.7 : 1}
                  onPress={hasLineCoords ? () => setElectricMapVisible(true) : undefined}
                >
                  <View style={s.cardTitleRow}>
                    <Ionicons name="flash" size={16} color={COLORS.warningOrange} />
                    <Text style={s.cardTitle}>Yüksek Gerilim Hattı</Text>
                    {hasLineCoords ? <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} /> : null}
                  </View>
                  <View style={sec.hvGrid}>
                    <View style={sec.hvGridItem}>
                      <Text style={sec.hvGridLabel}>Voltaj</Text>
                      <Text style={sec.hvGridValue}>{voltageDisplay}</Text>
                    </View>
                    <View style={sec.hvGridItem}>
                      <Text style={sec.hvGridLabel}>Kamulaştırma Alanı</Text>
                      <Text style={sec.hvGridValue}>{areaDisplay}</Text>
                    </View>
                    <View style={sec.hvGridItem}>
                      <Text style={sec.hvGridLabel}>Voltaj Sınıfı</Text>
                      <Text style={sec.hvGridValue}>{voltageClass}</Text>
                    </View>
                    <View style={sec.hvGridItem}>
                      <Text style={sec.hvGridLabel}>Hat</Text>
                      <Text style={[sec.hvGridValue, { color: COLORS.dangerRed }]}>Parsel üzerinden geçiyor</Text>
                    </View>
                  </View>
                  {hasLineCoords ? (
                    <Text style={sec.hvHint}>Haritada görmek için dokunun</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })()}

            {activeDetailTabId === 'fruit_investment' && (
              scores.structureQuery ? (
                <View style={s.card}>
                  <Text style={s.detailEmptyTabText}>Bu sorgu tipi için meyve bahçesi skoru uygulanmaz.</Text>
                </View>
              ) : (
                <PortalFruitInvestmentCard
                  loading={scores.loading}
                  analysis={scores.fruitAnalysis}
                  emptyReason={scores.fruitEmptyReason}
                  fetchError={scores.fruitErr}
                />
              )
            )}

            {activeDetailTabId === 'investment_score' && (
              <>
                <PortalMulkScoreDetailCard detail={data} loading={scores.loading} fetchError={scores.err} invPayload={scores.invPayload} />
                <PortalAraziScoreDetailCard detail={data} loading={scores.loading} fetchError={scores.err} invPayload={scores.invPayload} />
              </>
            )}

            {activeDetailTabId === 'solar_energy' && (
              <PortalSolarEnergyCard
                loading={solarEnergyLoading}
                payload={solarEnergyPayload}
                fetchError={solarEnergyErr}
              />
            )}

            {activeDetailTabId === 'wind_energy' && (
              <PortalWindEnergyCard
                loading={windEnergyLoading}
                payload={windEnergyPayload}
                fetchError={windEnergyErr}
              />
            )}

            {activeDetailTabId === 'split' && (
              <PortalParcelSplitDetailCard snapshotId={snapshotId} />
            )}

            {activeDetailTabId === 'expert' && (
              <>
                <TouchableOpacity
                  style={s.evalBtnInline}
                  onPress={openEvalModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={s.evalBtnInlineText}>Değerlendir Coin Kazan</Text>
                  <Ionicons name="chevron-forward" size={14} color="#15803d" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                {data.ramsar_json?.is_ramsar && (
                  <View style={s.ramsarWarn}>
                    <Ionicons name="warning" size={18} color="#92400e" />
                    <Text style={s.ramsarText}>
                      {data.ramsar_json.ramsar_name
                        ? `${data.ramsar_json.ramsar_name} (Sulak Koruma Alanı) alanı içindedir.`
                        : 'RAMSAR (Sulak Koruma Alanı) alanı içindedir.'}
                    </Text>
                  </View>
                )}

                {hasExpertResponses && (
                  <View ref={expertSectionRef} style={s.card}>
                    <View style={s.cardTitleRow}>
                      <Ionicons name="chatbubbles" size={16} color={COLORS.accentBlue} />
                      <Text style={s.cardTitle}>Uzman Görüşleri</Text>
                    </View>
                    {expertRequest && (
                      <View style={[s.expertStatusBadge, expertStatus === 'answered' ? s.expertStatusAnswered : expertStatus === 'in_review' ? s.expertStatusReview : s.expertStatusPending]}>
                        <Text style={s.expertStatusText}>
                          {expertStatus === 'answered' ? 'Yanıtlandı' : expertStatus === 'in_review' ? 'İncelemede' : 'Beklemede'}
                        </Text>
                      </View>
                    )}
                    {expertResponses.map(renderExpertResponse)}
                  </View>
                )}

                {data.parcel_coords_lonlat && data.parcel_coords_lonlat.length > 0 && (
                  <View ref={streetViewSectionRef} style={s.card}>
                    <View style={s.cardTitleRow}>
                      <Ionicons name="walk" size={16} color={COLORS.accentBlue} />
                      <Text style={s.cardTitle}>Sokak Görüntüsü</Text>
                    </View>
                    <TouchableOpacity style={sec.linkBtn} onPress={openParcelStreetView} activeOpacity={0.7}>
                      <Ionicons name="open-outline" size={18} color={COLORS.accentBlue} />
                      <Text style={sec.linkBtnText}>Street View'ı tekrar aç</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {(
              <View ref={yorumSectionRef} style={detailRatingStyles.body}>
                <View style={detailRatingStyles.header}>
                  <Text style={detailRatingStyles.title}>
                    {ratingModalData?.rating_summary?.rating_score_pct != null
                      ? `Puanlama ve Yorumlar — ${ratingModalData.comment_count} yorum`
                      : 'Puanlama ve Yorumlar'}
                  </Text>
                </View>
                {ratingModalLoading ? (
                  <ActivityIndicator size="large" color={COLORS.accentBlue} style={{ marginTop: 40 }} />
                ) : ratingModalData == null ? (
                  <View style={detailRatingStyles.emptyWrap}>
                    <Ionicons name="star-outline" size={36} color="#94a3b8" />
                    <Text style={detailRatingStyles.emptyText}>Yorumlar yüklenemedi.</Text>
                  </View>
                ) : (
                  <>
                    <View style={detailRatingStyles.summaryRow}>
                      <View style={detailRatingStyles.summaryItem}>
                        <Text style={[detailRatingStyles.summaryBig, { color: '#22c55e' }]}>
                          {ratingModalData.rating_summary.rating_score_pct != null ? `%${ratingModalData.rating_summary.rating_score_pct}` : '—'}
                        </Text>
                        <Text style={detailRatingStyles.summaryLabel}>Başarı</Text>
                      </View>
                      <View style={detailRatingStyles.summaryItem}>
                        <Text style={detailRatingStyles.summaryBig}>{ratingModalData.rating_summary.rating_count}</Text>
                        <Text style={detailRatingStyles.summaryLabel}>Toplam</Text>
                      </View>
                      <View style={detailRatingStyles.summaryItem}>
                        <Text style={[detailRatingStyles.summaryBig, { color: '#22c55e' }]}>{ratingModalData.rating_summary.success_count}</Text>
                        <Text style={detailRatingStyles.summaryLabel}>Başarılı</Text>
                      </View>
                      <View style={detailRatingStyles.summaryItem}>
                        <Text style={[detailRatingStyles.summaryBig, { color: '#f59e0b' }]}>{ratingModalData.rating_summary.needs_review_count}</Text>
                        <Text style={detailRatingStyles.summaryLabel}>Değerl.</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={detailRatingStyles.ratersBtn} onPress={handleShowRaters}>
                      <Text style={detailRatingStyles.ratersBtnText}>Kimler puanladı?</Text>
                    </TouchableOpacity>
                    <View style={detailRatingStyles.commentComposer}>
                      <Text style={detailRatingStyles.sectionTitle}>
                        {editingCommentId != null ? 'Yorumunuzu Düzenleyin' : replyParentCommentId != null ? 'Yanıt Yazın' : 'Yorum Ekleyin'}
                      </Text>
                      <TextInput
                        style={detailRatingStyles.commentInput}
                        value={commentDraft}
                        onChangeText={setCommentDraft}
                        placeholder="Görüşünüzü yazın..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        maxLength={2000}
                        editable={!commentSubmitting}
                      />
                      {!!commentError && <Text style={detailRatingStyles.commentError}>{commentError}</Text>}
                      <View style={detailRatingStyles.commentActionRow}>
                        <TouchableOpacity
                          style={detailRatingStyles.commentSubmitBtn}
                          onPress={handleSubmitComment}
                          disabled={commentSubmitting}
                        >
                          {commentSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                            <Text style={detailRatingStyles.commentSubmitBtnText}>
                              {editingCommentId != null ? 'Yorumu Güncelle' : replyParentCommentId != null ? 'Yanıt Gönder' : 'Yorum Gönder'}
                            </Text>
                          )}
                        </TouchableOpacity>
                        {editingCommentId != null || replyParentCommentId != null ? (
                          <TouchableOpacity style={detailRatingStyles.commentCancelBtn} onPress={handleCancelEditComment} disabled={commentSubmitting}>
                            <Text style={detailRatingStyles.commentCancelBtnText}>Vazgeç</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    <Text style={detailRatingStyles.sectionTitle}>Yorumlar</Text>
                    {ratingModalData.comments.length === 0 ? (
                      <View style={detailRatingStyles.emptyWrap}>
                        <Ionicons name="chatbubble-ellipses-outline" size={32} color="#94a3b8" />
                        <Text style={detailRatingStyles.emptyText}>Henüz yorum yapılmamış.</Text>
                      </View>
                    ) : (
                      ratingModalData.comments.map((comment: PortalQueryComment) => (
                        <View key={comment.id} style={[detailRatingStyles.fbItem, highlightedCommentId === comment.id && detailRatingStyles.highlightedItem]}>
                          {comment.avatar_url ? (
                            <Image source={{ uri: comment.avatar_url }} style={detailRatingStyles.fbAvatar} />
                          ) : (
                            <View style={detailRatingStyles.fbAvatarPlaceholder}>
                              <Text style={detailRatingStyles.fbAvatarInitial}>{(comment.masked_name || '?')[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={detailRatingStyles.commentHeaderRow}>
                              <Text style={detailRatingStyles.fbName}>{comment.masked_name || '***'}</Text>
                              <View style={detailRatingStyles.commentMetaRow}>
                                {comment.is_edited ? <Text style={detailRatingStyles.commentEdited}>Düzenlendi</Text> : null}
                                {comment.created_at ? <Text style={detailRatingStyles.fbDate}>{formatDate(comment.created_at)}</Text> : null}
                              </View>
                            </View>
                            <Text style={detailRatingStyles.fbComment}>{comment.comment}</Text>
                            <View style={detailRatingStyles.commentOwnerActions}>
                              <TouchableOpacity onPress={() => handleToggleCommentLike(comment)} disabled={commentLikeBusyId === comment.id}>
                                <Text style={detailRatingStyles.commentActionText}>
                                  {comment.liked_by_me ? 'Beğeniyi Kaldır' : 'Beğen'} ({comment.like_count ?? 0})
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleShowCommentLikes(comment)}>
                                <Text style={detailRatingStyles.commentActionText}>Beğenenler</Text>
                              </TouchableOpacity>
                              {!comment.is_deleted ? (
                                <TouchableOpacity onPress={() => handleStartReplyComment(comment)} disabled={commentSubmitting}>
                                  <Text style={detailRatingStyles.commentActionText}>Yanıtla</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                            {comment.is_owner ? (
                              <View style={detailRatingStyles.commentOwnerActions}>
                                <TouchableOpacity onPress={() => handleStartEditComment(comment)} disabled={commentSubmitting}>
                                  <Text style={detailRatingStyles.commentActionText}>Düzenle</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteComment(comment)} disabled={commentSubmitting}>
                                  <Text style={detailRatingStyles.commentDeleteText}>Sil</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                            {comment.replies?.length ? (
                              <View style={detailRatingStyles.replyList}>
                                {comment.replies.map((reply: PortalQueryComment) => (
                                  <View key={reply.id} style={[detailRatingStyles.replyItem, highlightedCommentId === reply.id && detailRatingStyles.highlightedItem]}>
                                    <View style={detailRatingStyles.commentHeaderRow}>
                                      <Text style={detailRatingStyles.fbName}>{reply.display_name || reply.masked_name || '***'}</Text>
                                      <View style={detailRatingStyles.commentMetaRow}>
                                        {reply.is_edited ? <Text style={detailRatingStyles.commentEdited}>Düzenlendi</Text> : null}
                                        {reply.created_at ? <Text style={detailRatingStyles.fbDate}>{formatDate(reply.created_at)}</Text> : null}
                                      </View>
                                    </View>
                                    <Text style={detailRatingStyles.fbComment}>{reply.comment}</Text>
                                    <View style={detailRatingStyles.commentOwnerActions}>
                                      <TouchableOpacity onPress={() => handleToggleCommentLike(reply)} disabled={commentLikeBusyId === reply.id}>
                                        <Text style={detailRatingStyles.commentActionText}>
                                          {reply.liked_by_me ? 'Beğeniyi Kaldır' : 'Beğen'} ({reply.like_count ?? 0})
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => handleShowCommentLikes(reply)}>
                                        <Text style={detailRatingStyles.commentActionText}>Beğenenler</Text>
                                      </TouchableOpacity>
                                    </View>
                                    {reply.is_owner ? (
                                      <View style={detailRatingStyles.commentOwnerActions}>
                                        <TouchableOpacity onPress={() => handleStartEditComment(reply)} disabled={commentSubmitting}>
                                          <Text style={detailRatingStyles.commentActionText}>Düzenle</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteComment(reply)} disabled={commentSubmitting}>
                                          <Text style={detailRatingStyles.commentDeleteText}>Sil</Text>
                                        </TouchableOpacity>
                                      </View>
                                    ) : null}
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ))
                    )}
                  </>
                )}
                <View style={{ height: 24 }} />
              </View>
            )}

            {renderOwnerContactCard()}
          </>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* Expert Request Bottom Sheet */}
      <AppBottomSheetModal
        visible={expertModalOpen}
        onClose={() => setExpertModalOpen(false)}
        snapPoints={['70%']}
        backdropOpacity={0.25}
        backdropPressBehavior="close"
      >
        <View style={s.modalContent}>
          <Text style={s.modalTitle}>
            <Ionicons name="person" size={18} color={COLORS.accentBlue} /> Uzman Görüşü İste
          </Text>
          <Text style={s.modalPrice}>{expertPrice}</Text>
          <Text style={s.modalLabel}>Not (isteğe bağlı, max 500 karakter)</Text>
          <TextInput
            style={s.modalInput}
            value={expertNote}
            onChangeText={setExpertNote}
            maxLength={500}
            placeholder="Uzman için notunuz..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={[s.modalBtn, s.modalBtnCancel]} onPress={() => setExpertModalOpen(false)}>
              <Text style={s.modalBtnCancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, s.modalBtnSubmit]} onPress={handleExpertSubmit} disabled={expertSubmitting}>
              {expertSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.modalBtnSubmitText}>Devam</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </AppBottomSheetModal>

      {/* ── Evaluation Modal (Değerlendir Coin Kazan) ── */}
      <AppBottomSheetModal
        visible={evalModalVisible}
        onClose={() => setEvalModalVisible(false)}
        snapPoints={['70%']}
        backdropOpacity={0.4}
        backdropPressBehavior="close"
      >
        <View style={ev.container}>
          <View style={ev.titleRow}>
            <Ionicons name="star" size={20} color="#f59e0b" />
            <Text style={ev.title}>Sorgu Sonucunu Puanla</Text>
          </View>
          <Text style={ev.subtitle}>{evalCoinAmount} Tepe Coin Kazan!</Text>

          {evalStep === 1 ? (
            <>
              {data?.total_price != null && Number.isFinite(Number(data.total_price)) ? (
                <Text style={ev.desc}>
                  Sorgu sonucuna göre, bu arazi
                  {data.listing_id ? ' ve bu ilan' : ''} için ProParcel sistem öngörüsü toplam{' '}
                  <Text style={ev.descStrong}>{formatPrice(Number(data.total_price))}</Text>
                  {' '}
                  tutarındadır. Bu toplam fiyat tahmini sizce başarılı mı?
                </Text>
              ) : (
                <Text style={ev.desc}>
                  Bu sorgu için henüz toplam sistem öngörüsü yok. Genel olarak sorgu sonucunu nasıl
                  değerlendiriyorsunuz?
                </Text>
              )}
              <TouchableOpacity
                style={ev.btnSuccess}
                onPress={() => submitEvaluation('SUCCESS')}
                disabled={evalSubmitting}
                activeOpacity={0.7}
              >
                {evalSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={ev.btnSuccessText}>Başarılı</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={ev.btnReview}
                onPress={() => setEvalStep(2)}
                activeOpacity={0.7}
              >
                <Ionicons name="alert-circle" size={20} color="#92400e" />
                <Text style={ev.btnReviewText}>Değerlendirilmeli</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={ev.desc}>
                Sizce doğru olan toplam fiyat (TL) ne olmalıydı? Birim fiyat değil, parsel/ilan toplamı.
              </Text>
              <Text style={ev.fieldLabel}>Beklenen toplam fiyat (TL)</Text>
              <TextInput
                style={ev.input}
                value={evalExpectedPrice}
                onChangeText={setEvalExpectedPrice}
                placeholder="Örn: 4250000 veya 4.250.000"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={ev.btnSubmit}
                onPress={() => submitEvaluation('NEEDS_REVIEW')}
                disabled={evalSubmitting}
                activeOpacity={0.7}
              >
                {evalSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={ev.btnSubmitText}>Gönder</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={ev.btnBack} onPress={() => { setEvalStep(1); setEvalError(''); }} activeOpacity={0.7}>
                <Text style={ev.btnBackText}>Geri</Text>
              </TouchableOpacity>
            </>
          )}
          {!!evalError && <Text style={ev.errorText}>{evalError}</Text>}
        </View>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        visible={participantModalVisible}
        onClose={() => setParticipantModalVisible(false)}
        snapPoints={['70%', '85%']}
        backdropOpacity={0.25}
        backdropPressBehavior="close"
      >
        <View style={detailRatingStyles.header}>
          <Text style={detailRatingStyles.title}>{participantModalTitle}</Text>
          <TouchableOpacity onPress={() => setParticipantModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView style={detailRatingStyles.body} contentContainerStyle={{ paddingBottom: 24 }}>
          {participantItems.length === 0 ? (
            <View style={detailRatingStyles.emptyWrap}>
              <Ionicons name="people-outline" size={32} color="#94a3b8" />
              <Text style={detailRatingStyles.emptyText}>Kayıt bulunamadı.</Text>
            </View>
          ) : participantItems.map((item) => (
            <View key={`${participantModalTitle}-${item.user_id}-${item.subtitle || ''}`} style={detailRatingStyles.participantItem}>
              <View style={{ flex: 1 }}>
                <Text style={detailRatingStyles.fbName}>{item.display_name}</Text>
                {item.subtitle ? <Text style={detailRatingStyles.fbDate}>{item.subtitle}</Text> : null}
              </View>
            </View>
          ))}
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <UserMenuModal visible={userMenuVisible} onClose={() => setUserMenuVisible(false)} currentScreen="son-30-gun-detay" />

      {/* ── Sorgu detay işlemleri (uzman talebi, paylaşım, LİHKAB) ── */}
      <AppBottomSheetModal
        visible={detailMenuVisible}
        onClose={() => setDetailMenuVisible(false)}
        snapPoints={['70%', '90%']}
        variant="dark"
        backdropOpacity={0.2}
        backdropPressBehavior="close"
      >
        <View style={dm.header}>
          <Text style={dm.title}>İşlemler</Text>
          <TouchableOpacity
            style={dm.coinBtn}
            onPress={() => { setDetailMenuVisible(false); setTimeout(() => openEvalModal(), 350); }}
            activeOpacity={0.7}
          >
            <Ionicons name="star" size={13} color="#fbbf24" />
            <Text style={dm.coinBtnText}>Değerlendir</Text>
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView contentContainerStyle={dm.body}>
          <Text style={dm.sectionLabel}>Sayfalar</Text>

          <TouchableOpacity
            style={dm.item}
            onPress={() => {
              setDetailMenuVisible(false);
              setDetailMenuLihkabOpen(false);
              setTimeout(() => handleOpenExpertRequest({ menuFocus: 'expert' }), 350);
            }}
          >
            <Ionicons name="person-outline" size={20} color={COLORS.accentBlue} />
            <Text style={dm.itemText}>Uzman Görüşü Talebi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dm.item}
            onPress={() => {
              setDetailMenuVisible(false);
              setDetailMenuLihkabOpen(false);
              setTimeout(() => handleOpenExpertRequest({ menuFocus: 'spk' }), 350);
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.accentBlue} />
            <Text style={dm.itemText}>SPK Lisanslı Değerleme Talebi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dm.item}
            onPress={() => setDetailMenuLihkabOpen((o) => !o)}
            activeOpacity={0.7}
          >
            <Ionicons name="map-outline" size={20} color={COLORS.accentBlue} />
            <Text style={[dm.itemText, { flex: 1 }]}>LİHKAB işlemleri</Text>
            <Ionicons name={detailMenuLihkabOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
          </TouchableOpacity>

          {detailMenuLihkabOpen
            ? MAP_OPERATION_MENU_ITEMS.map((label) => (
              <TouchableOpacity
                key={label}
                style={[dm.item, dm.lihkabSubItem]}
                onPress={() => {
                  setDetailMenuVisible(false);
                  setDetailMenuLihkabOpen(false);
                  setTimeout(
                    () => handleOpenExpertRequest({ menuFocus: 'map', mapOperationLabel: label }),
                    350,
                  );
                }}
              >
                <Ionicons name="arrow-forward" size={16} color="#64748b" />
                <Text style={[dm.itemText, dm.lihkabSubText]} numberOfLines={3}>{label}</Text>
              </TouchableOpacity>
            ))
            : null}

          {/* Actions */}
          <View style={dm.divider} />
          <Text style={dm.sectionLabel}>Aksiyonlar</Text>

          <TouchableOpacity
            style={dm.item}
            onPress={() => { setDetailMenuVisible(false); setTimeout(() => handleShareMenu(), 350); }}
          >
            <Ionicons name="share-outline" size={20} color={COLORS.accentBlue} />
            <Text style={dm.itemText}>Paylaş</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dm.item}
            onPress={() => { setDetailMenuVisible(false); setTimeout(() => handleOpenSocialMediaTemplate(), 350); }}
          >
            <Ionicons name="share-social-outline" size={20} color={COLORS.accentBlue} />
            <Text style={dm.itemText}>Post Şablonu Oluştur</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dm.item, dm.itemRating]}
            onPress={() => { setDetailMenuVisible(false); setTimeout(() => openEvalModal(), 350); }}
          >
            <Ionicons name="star" size={20} color="#fbbf24" />
            <Text style={dm.itemRatingText}>Değerlendir Coin Kazan</Text>
          </TouchableOpacity>

          {(hasExpertResponses || data.is_own_query) && (
            <TouchableOpacity
              style={dm.item}
              onPress={() => {
                setDetailMenuVisible(false);
                if (hasExpertResponses) {
                  setTimeout(() => scrollToSection('expert', expertSectionRef), 350);
                } else {
                  setTimeout(() => handleOpenExpertRequest(), 350);
                }
              }}
            >
              <Ionicons name="person-outline" size={20} color={COLORS.accentBlue} />
              <Text style={dm.itemText}>{hasExpertResponses ? 'Uzman Yanıtlarını Gör' : 'Talep Oluştur'}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 24 }} />
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      {/* Full-screen Image Viewer */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={imgV.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <TouchableOpacity style={imgV.closeBtn} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {imageViewerUrls.length > 1 && (
            <Text style={imgV.counter}>{imageViewerIndex + 1} / {imageViewerUrls.length}</Text>
          )}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: imageViewerIndex * Dimensions.get('window').width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setImageViewerIndex(idx);
            }}
            style={{ flex: 1 }}
          >
            {imageViewerUrls.map((url, i) => (
              <View key={i} style={imgV.page}>
                <Image source={{ uri: url }} style={imgV.image} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Tam ekran ilan videosu */}
      <Modal
        visible={videoFullscreenUri != null}
        transparent
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setVideoFullscreenUri(null)}
      >
        <View style={imgV.videoOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <TouchableOpacity
            style={[imgV.videoCloseBtn, { top: Math.max(16, insets.top + 8) }]}
            onPress={() => setVideoFullscreenUri(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {videoFullscreenUri && VideoComponent ? (
            <VideoComponent
              source={buildVideoSource(videoFullscreenUri)}
              style={imgV.videoFull}
              controls
              resizeMode="contain"
              muted={false}
              volume={1}
              ignoreSilentSwitch="ignore"
              playInBackground={false}
              hideShutterView={Platform.OS === 'android'}
              onError={(e: unknown) => {
                if (__DEV__) console.warn('[son-30-gun-detay] fullscreen video error', e);
              }}
            />
          ) : videoFullscreenUri ? (
            <View style={imgV.videoFallback}>
              <Text style={imgV.videoFallbackText}>Video oynatıcı kullanılamıyor</Text>
            </View>
          ) : null}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const screenW = Dimensions.get('window').width;
const imgV = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', top: 50, right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: 56, left: 0, right: 0, zIndex: 10, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '600' },
  page: { width: screenW, flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: screenW, height: '100%' },
  videoOverlay: { flex: 1, backgroundColor: '#000' },
  videoCloseBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFull: { flex: 1, width: '100%' },
  videoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  videoFallbackText: { color: '#94a3b8', fontSize: 15, textAlign: 'center' },
});

const detailRatingStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 12 },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: '#94a3b8', marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
  ratersBtn: { alignSelf: 'flex-start', marginBottom: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#eff6ff' },
  ratersBtnText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryBig: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  summaryLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  commentComposer: { marginBottom: 18, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#f8fbff' },
  commentInput: { minHeight: 88, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b', textAlignVertical: 'top' },
  commentError: { color: '#dc2626', fontSize: 12, marginTop: 8 },
  commentActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  commentSubmitBtn: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  commentSubmitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  commentCancelBtn: { backgroundColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  commentCancelBtnText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  fbItem: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', marginBottom: 8 },
  fbAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  fbAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  fbAvatarInitial: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  fbName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  fbAction: { fontSize: 12, color: '#64748b', marginTop: 1 },
  fbDetail: { fontSize: 12, color: '#64748b', marginTop: 3 },
  fbComment: { fontSize: 12, color: '#475569', marginTop: 6, backgroundColor: '#fff', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  fbDate: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  highlightedItem: { borderColor: '#60a5fa', backgroundColor: '#eff6ff' },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  commentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  commentEdited: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  commentOwnerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  commentActionText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  commentDeleteText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  replyList: { marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#dbeafe', gap: 10 },
  replyItem: { paddingTop: 4 },
  participantItem: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, alignSelf: 'flex-start', marginTop: 8 },
  badgeText: { fontSize: 14, fontWeight: '700' },
  badgeCount: { fontSize: 12, color: '#64748b', fontWeight: '400' },
});

// ── Styles ──

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.headerBg },
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flexShrink: 1 },
  listingTitleBar: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  listingTitleText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    lineHeight: 24,
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
    fontWeight: '700' as const,
    color: '#1f2937',
  },
  centerContainer: { flex: 1, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary },
  errorText: { marginTop: 16, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: COLORS.accentBlue, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scrollView: { flex: 1, backgroundColor: COLORS.pageBg },
  scrollContent: { paddingBottom: 20 },

  // Breadcrumb
  breadcrumbWrap: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft },
  breadcrumbContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  breadcrumbItem: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  breadcrumbItemActive: { color: COLORS.accentBlue, fontWeight: '600' },
  breadcrumbArrow: { marginHorizontal: 4 },

  firmBanner: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.headerBg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accentBlue,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  firmBannerMark: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  firmBannerLogo: {
    width: '100%',
    height: '100%',
  },
  firmBannerName: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#f8fafc',
    letterSpacing: 0.2,
  },
  /** Satır hafif gri; sekme kutuları beyaz */
  detailTabScroll: { backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft },
  detailTabScrollContent: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8, gap: 6, alignItems: 'stretch' },
  detailTabSquare: {
    minWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.borderSoft,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTabSquareActive: {
    backgroundColor: '#ffffff',
    borderColor: COLORS.warningYellow,
  },
  detailTabSquareText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  detailTabSquareTextActive: { color: COLORS.textPrimary },
  detailTabSquareAux: { borderColor: '#94a3b8', borderWidth: 2, backgroundColor: '#f8fafc' },
  detailTabSquareAuxText: { color: '#475569', fontSize: 10 },
  detailEmptyTabText: { fontSize: 13, color: COLORS.textSecondary, padding: 12, lineHeight: 20 },
  /** Açıklama sekmesi — kart yok, tam genişlik metin */
  listingDescFullPage: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  slopeTabSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  slopeTerrainTopCard: { paddingVertical: 12, paddingHorizontal: 10 },
  slopeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
  },
  slopeDetailLabel: { fontSize: 12, color: COLORS.textSecondary, flex: 1, paddingRight: 8 },
  slopeDetailVal: { fontSize: 12, fontWeight: '600' as const, color: COLORS.textPrimary, flexShrink: 1, textAlign: 'right', maxWidth: '65%' },
  detailInfoKvBox: {
    backgroundColor: COLORS.cardBg,
  },
  detailInfoKvRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSoft,
  },
  detailInfoKvRowProminent: {
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 0,
  },
  detailInfoKvRowLast: {
    borderBottomWidth: 0,
  },
  detailInfoKvLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailInfoKvLabelProminent: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  detailInfoKvVal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'right' as const,
    flex: 1,
    maxWidth: '52%',
  },
  detailInfoKvValProminent: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.accentBlue,
  },
  listingDesc: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 21 },

  // Map
  mapContainer: {
    height: 280,
    backgroundColor: '#e2e8f0',
    position: 'relative' as const,
    marginBottom: 12,
  },
  heroMediaTabsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    marginBottom: 8,
  },
  heroMediaTabsLeft: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  heroMediaTabsLeftPlaceholder: {
    flex: 1,
  },
  heroMediaActionsRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  heroMediaTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  heroMediaTabActive: {
    backgroundColor: '#ffffff',
    borderColor: COLORS.warningYellow,
  },
  heroMediaTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  heroMediaTabTextActive: {
    color: COLORS.textPrimary,
  },
  heroMediaFavBtn: {
    minWidth: 56,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row' as const,
    gap: 6,
    paddingHorizontal: 10,
  },
  heroMediaLikeBtn: {
    minWidth: 56,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row' as const,
    gap: 6,
    paddingHorizontal: 10,
  },
  heroMediaRatingsBtn: {
    minWidth: 66,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  heroMediaRatingsBtnText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    textAlign: 'center' as const,
  },
  heroMediaFavBtnActive: {
    borderColor: '#facc15',
    backgroundColor: '#fefce8',
  },
  heroMediaFavBtnDisabled: {
    opacity: 0.7,
  },
  heroMediaFavCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  heroMediaLikeCount: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  heroMediaFavCountActive: {
    color: COLORS.textPrimary,
  },
  heroGalleryColumn: {
    flexDirection: 'column' as const,
    paddingBottom: 0,
  },
  heroGalleryPager: {
    width: '100%' as const,
    height: HERO_GALLERY_MAIN_HEIGHT,
  },
  heroGalleryPagerItem: {
    width: SCREEN_WIDTH,
    height: HERO_GALLERY_MAIN_HEIGHT,
  },
  heroGalleryMainImg: {
    width: '100%',
    height: '100%',
  },
  heroGalleryThumbs: {
    flexGrow: 0,
    maxHeight: 64,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    backgroundColor: '#f1f5f9',
  },
  heroGalleryThumbsContent: {
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  heroGalleryThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  heroGalleryThumbInner: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
  },
  heroGalleryThumbPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroVideoPosterFallback: {
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVideoTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroVideoPlayHint: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  heroVideoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
    gap: 10,
  },
  heroVideoLoadingText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  heroVideoErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15,23,42,0.55)',
    gap: 8,
  },
  heroVideoErrorText: { color: '#fecaca', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  heroVideoErrorHint: { color: '#e2e8f0', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  heroVideoMuteBtn: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    elevation: 5,
  },
  heroVideoFullscreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    elevation: 5,
  },
  heroGalleryThumbSelected: {
    borderColor: COLORS.accentBlue,
  },
  heroGalleryThumbImg: {
    width: '100%',
    height: '100%',
  },
  mapImage: { width: '100%', height: '100%' },
  mapBadge: {
    position: 'absolute' as const, top: 10, right: 10,
    backgroundColor: 'rgba(239,68,68,0.9)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, elevation: 5,
  },
  mapBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  evalBtnInline: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    marginTop: 10, marginBottom: 2,
    backgroundColor: '#f0fdf4', borderRadius: 0,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  evalBtnInlineText: { fontSize: 13, fontWeight: '700' as const, color: '#15803d' },
  mapFullScreenBtn: {
    position: 'absolute' as const, bottom: 10, right: 10,
    backgroundColor: 'rgba(30,41,59,0.8)', width: 36, height: 36,
    borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3,
  },

  // RAMSAR
  ramsarWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: '#fef3c7', borderRadius: 0, padding: 12, borderWidth: 1, borderColor: '#fde68a',
  },
  ramsarText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '500' },

  // Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 0, marginTop: 12,
    padding: 16, borderWidth: 1, borderColor: COLORS.borderSoft,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderSoft },
  infoRowProminent: { borderBottomWidth: 0, paddingTop: 12 },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoLabelProminent: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  infoValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500', textAlign: 'right', flex: 1 },
  infoValueProminent: { fontSize: 18, fontWeight: '800', color: COLORS.accentBlue },

  // DFA Table (web ile: tabloda yalnız açıklama + yüzde; özet altta)
  dfaHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.headerBg, borderRadius: 6, overflow: 'hidden' },
  dfaHeaderText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  dfaRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.borderSoft },
  dfaRowAlt: { backgroundColor: '#f8fafc' },
  dfaRowPos: { backgroundColor: '#f0fdf4' },
  dfaRowNeg: { backgroundColor: '#fef2f2' },
  dfaCell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 11, color: COLORS.textPrimary },
  dfaCellDesc: { flex: 1 },
  dfaCellPctCol: { width: 88, textAlign: 'right' as const },
  dfaPctText: { fontWeight: '600' as const },
  dfaPctPos: { color: COLORS.accentGreen },
  dfaPctNeg: { color: COLORS.dangerRed },
  dfaUserNote: { marginTop: 3, fontSize: 10, fontWeight: '700' as const, color: '#b45309' },
  dfaSummaryWrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderSoft,
  },
  dfaSummaryTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  dfaSummaryGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  dfaSummaryItem: { width: '50%' as const, paddingVertical: 8, paddingRight: 8 },
  dfaSummaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  dfaSummaryValue: { fontSize: 13, fontWeight: '600' as const, color: COLORS.textPrimary },
  roadReportBtn: {
    marginTop: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roadReportBtnText: { fontSize: 11, fontWeight: '700' as const, color: COLORS.accentBlue },
  dfaRerunBtn: {
    marginTop: 10,
    alignSelf: 'flex-end' as const,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dfaRerunBtnDisabled: { opacity: 0.45 },
  dfaRerunBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' as const },
  roadGuideText: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  roadSelectionPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  roadChoiceCard: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  roadChoiceCardFocused: {
    borderColor: COLORS.warningOrange,
    backgroundColor: '#fff7ed',
  },
  roadChoiceHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  roadChoiceEdgeBtn: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roadChoiceEdgeBtnText: { fontSize: 12, fontWeight: '700' as const, color: COLORS.textPrimary },
  roadChoiceRemove: { fontSize: 12, color: COLORS.dangerRed, fontWeight: '700' as const },
  roadChoiceRow: { flexDirection: 'row' as const, gap: 12 },
  roadChoiceRadioWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  roadChoiceRadioText: { fontSize: 12, color: COLORS.textPrimary },
  roadChoiceEmpty: { fontSize: 12, color: COLORS.textSecondary, padding: 4 },
  roadModalDoneBtn: {
    marginTop: 8,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
  },
  roadModalDoneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' as const },

  // Action buttons
  actionSection: { marginTop: 16, gap: 10 },
  actionBtnRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16 },
  actionBtnPrimary: { backgroundColor: COLORS.accentBlue, flex: 1 },
  actionBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnOutline: { flex: 1, borderWidth: 1.5, borderColor: COLORS.accentBlue, backgroundColor: COLORS.cardBg },
  actionBtnOutlineText: { color: COLORS.accentBlue, fontSize: 13, fontWeight: '600' },

  // Expert section
  expertStatusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  expertStatusAnswered: { backgroundColor: '#dcfce7' },
  expertStatusReview: { backgroundColor: '#fef3c7' },
  expertStatusPending: { backgroundColor: '#f1f5f9' },
  expertStatusText: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  expertCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: COLORS.borderSoft },
  expertHeader: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  expertAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0' },
  expertAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  expertInfo: { flex: 1 },
  expertName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  expertMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  expertBadge: { fontSize: 11, color: COLORS.accentBlue, fontWeight: '600' },
  expertScore: { fontSize: 11, color: COLORS.textSecondary },
  expertCompany: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  expertText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 20, marginBottom: 8 },
  expertAttachments: { marginBottom: 8 },
  expertAttImage: { width: 100, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: '#e2e8f0' },
  expertPdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  expertPdfBtnText: { fontSize: 13, color: COLORS.accentBlue, fontWeight: '600' },
  expertDate: { fontSize: 11, color: COLORS.textSecondary },
  surveyWrap: { marginBottom: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 0.5, borderColor: COLORS.borderSoft },
  surveyRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7 },
  surveyRowAlt: { backgroundColor: '#f1f5f9' },
  surveyLabel: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  surveyValue: { flex: 1, fontSize: 12, color: COLORS.textPrimary, textAlign: 'right' as const },

  // Owner / Company
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  companyLogo: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f1f5f9' },
  companyLogoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  companyName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' },
  ownerAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  ownerPhone: { fontSize: 13, color: COLORS.accentBlue, marginTop: 2 },
  ownerEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Modal
  modalContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  modalPrice: { fontSize: 14, fontWeight: '600', color: COLORS.accentBlue, marginBottom: 16 },
  modalLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: 8, padding: 12,
    fontSize: 14, color: COLORS.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#f1f5f9' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modalBtnSubmit: { backgroundColor: COLORS.accentBlue },
  modalBtnSubmitText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ── Sorgu detay işlemleri sheet (koyu yüzey, genel kullanıcı menüsü ile uyumlu) ──
const dm = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(51, 65, 85, 0.85)',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#e2e8f0' },
  coinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.45)',
  },
  coinBtnText: { fontSize: 12, fontWeight: '700', color: '#86efac' },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 12, marginBottom: 6, paddingHorizontal: 4,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 2,
  },
  itemText: { fontSize: 14, fontWeight: '500', color: '#e2e8f0' },
  itemRating: {
    backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 10, marginTop: 4,
  },
  itemRatingText: { fontSize: 14, fontWeight: '700', color: '#86efac' },
  divider: { height: 1, backgroundColor: 'rgba(51, 65, 85, 0.85)', marginVertical: 10 },
  lihkabSubItem: {
    paddingLeft: 36,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    marginBottom: 1,
  },
  lihkabSubText: { fontSize: 13, flex: 1, color: '#cbd5e1' },
});

// ── New Section Styles ──
const sec = StyleSheet.create({
  highlightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#bfdbfe',
  },
  highlightLabel: { fontSize: 13, fontWeight: '600', color: COLORS.accentBlue },
  highlightValue: { fontSize: 15, fontWeight: '700', color: COLORS.accentBlue },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.accentBlue,
    backgroundColor: 'rgba(59,130,246,0.04)',
  },
  linkBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.accentBlue },
  mapImg: { width: '100%', height: 200, borderRadius: 8 },
  mapPlaceholder: {
    height: 150, borderRadius: 8, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  mapPlaceholderText: { fontSize: 13, color: '#94a3b8', marginTop: 6 },

  // Tahmin Modülü
  modelBox: {
    backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderSoft,
  },
  modelLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  modelDetail: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  verifiedBadge: {
    marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: '#15803d' },
  summaryBox: {
    backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderSoft,
  },
  summaryTitle: {
    fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8,
  },
  summaryText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 20 },
  summaryMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statItem: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.borderSoft,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  comparisonTitle: {
    fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },
  comparisonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  comparisonItem: {
    width: (SCREEN_WIDTH - 32 - 16 - 8) / 2,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.borderSoft,
  },
  comparisonItemHighlight: {
    borderColor: COLORS.accentBlue, backgroundColor: '#eff6ff',
  },
  comparisonLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  comparisonValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  comparisonValueHighlight: { color: COLORS.accentBlue },
  predFooter: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderSoft,
  },
  predFooterText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },

  // Parsel Eğimi
  slopeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  slopeGridItem: {
    flex: 1, minWidth: (SCREEN_WIDTH - 32 - 16 - 16) / 3,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: '#f8fafc',
  },
  slopeGridLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  slopeGridValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  slopeLegend: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 4 },
  slopeLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slopeLegendDot: { width: 12, height: 12, borderRadius: 2 },
  slopeLegendText: { fontSize: 12, color: COLORS.textSecondary },

  // Yüksek Gerilim
  noLineBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  noLineText: { fontSize: 13, fontWeight: '500', color: '#15803d', flex: 1 },
  hvGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  hvGridItem: {
    width: (SCREEN_WIDTH - 32 - 16 - 8) / 2,
    paddingVertical: 8,
  },
  hvGridLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  hvGridValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  hvHint: { fontSize: 12, color: COLORS.accentBlue, marginTop: 8, fontWeight: '500' },
});

// Map 3D controls styles
const mc = StyleSheet.create({
  controlsWrapper: {
    position: 'absolute', bottom: 54, right: 16,
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, zIndex: 1000,
  },
  navPanel: {
    backgroundColor: 'rgba(30,41,59,0.78)', borderRadius: 12, padding: 6,
    borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.9)', elevation: 15,
    width: 110, height: 110, alignItems: 'center', justifyContent: 'center',
  },
  navRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6',
  },
  navSpacer: { width: 30, height: 30 },
  pitchPanel: {
    backgroundColor: 'rgba(30,41,59,0.78)', borderRadius: 12, padding: 6,
    borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.9)', elevation: 15,
    alignItems: 'center', width: 50, height: 110, justifyContent: 'center',
  },
  pitchBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6',
  },
  pitchText: { color: '#fff', fontSize: 12, fontWeight: '700', marginVertical: 4 },
});

// Evaluation modal styles
const ev = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  title: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  subtitle: {
    fontSize: 13, fontWeight: '600', color: '#16a34a',
    marginBottom: 16, paddingLeft: 28,
  },
  desc: { fontSize: 14, color: '#64748b', marginBottom: 14, lineHeight: 21 },
  descStrong: { fontWeight: '800', color: '#1e293b' },
  btnSuccess: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, marginBottom: 10,
  },
  btnSuccessText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnReview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderRadius: 12, paddingVertical: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#fde68a',
  },
  btnReviewText: { fontSize: 15, fontWeight: '600', color: '#92400e' },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#1e293b', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1e293b', marginBottom: 12,
  },
  btnSubmit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1a5fb4', borderRadius: 12, paddingVertical: 14, marginBottom: 10,
  },
  btnSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnBack: { alignItems: 'center', paddingVertical: 10 },
  btnBackText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: 6 },
});

