import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, ActivityIndicator, Alert, StatusBar, Animated, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useNavigation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProParcelResponse } from '../../src/types/parcelResponse';
import type { ReportPayload, VillaResult, FactoryResult, CostEngineBreakdownItem } from '../../src/types/reportPayload';
import { getReportMemory } from '../../src/utils/reportMemory';
import { buildDfaRowsFromValuationSteps, parseAreaM2 as parseAreaM2Util } from '../../src/utils/dfaRows';
import { formatTurkishPrice } from '../../src/utils/priceParser';
import { ParcelModalContent } from '../../components/ParcelModalContent';
// ShareModal ve CombinedScreenshotContainer kaldırıldı — paylaş butonu artık doğrudan PDF paylaşıyor
import { API_URL, FALLBACK_API_URL } from "../../config/api";
import { generateAnalysisReportPdf } from '../../src/utils/analysisReportPdf';
import { buildReportPdfFileName } from '../../src/utils/reportPdfFileName';
import { tryMapboxSnap, waitForMapIdle } from '../../src/utils/mapboxSnapshot';
import { getCombinedImageDimensions } from '../../src/utils/screenshotManager';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../../services/authService';

// Conditional Mapbox import (same pattern as index)
let Mapbox: any = null;
let MAPBOX_TOKEN = '';
try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
  try {
    const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
    MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN || '';
    if (Mapbox && Mapbox.setAccessToken && MAPBOX_TOKEN) {
      Mapbox.setAccessToken(MAPBOX_TOKEN);
    }
  } catch (tokenError) {
    console.warn('[report_mobil_viewver] Mapbox token yüklenemedi:', tokenError);
  }
} catch (e) {
  console.warn('[report_mobil_viewver] Mapbox native module not available.', e);
}

/**
 * Mapbox Static Images API kullanarak parsel geometrisinin uydu görüntüsünü al.
 * GeoJSON overlay ile parsel sınırı çizilir. Sonuç base64 olarak döner.
 */
async function fetchStaticMapBase64(geom: any): Promise<string> {
  if (!MAPBOX_TOKEN || !geom) return '';
  try {
    let url: string;

    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      // Nokta geometrisi: merkezli uydu görüntüsü
      const [lon, lat] = geom.coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return '';
      url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},16,0/800x600@2x?access_token=${MAPBOX_TOKEN}`;
    } else {
      // Polygon/MultiPolygon: simplestyle-spec overlay
      const feature = {
        type: 'Feature',
        properties: {
          stroke: '#3b82f6',
          'stroke-width': 3,
          'stroke-opacity': 1,
          fill: '#3b82f6',
          'fill-opacity': 0.15,
        },
        geometry: geom,
      };
      const geojsonStr = JSON.stringify(feature);
      const encoded = encodeURIComponent(geojsonStr);

      if (encoded.length > 6000) {
        // URL çok uzunsa center+zoom fallback
        const center = calcCenterFromPolygonGeom(geom);
        if (!center) return '';
        url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${center[0]},${center[1]},16,0/800x600@2x?access_token=${MAPBOX_TOKEN}`;
      } else {
        url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/800x600@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
      }
    }

    const tempPath = `${RNFS.CachesDirectoryPath}/static_map_${Date.now()}.png`;
    const result = await RNFS.downloadFile({ fromUrl: url, toFile: tempPath }).promise;
    if (result.statusCode !== 200) {
      console.warn('[fetchStaticMapBase64] Mapbox API HTTP', result.statusCode);
      await RNFS.unlink(tempPath).catch(() => {});
      return '';
    }
    const b64 = await RNFS.readFile(tempPath, 'base64');
    await RNFS.unlink(tempPath).catch(() => {});
    return b64;
  } catch (err) {
    console.warn('[fetchStaticMapBase64] Static map fetch hatası:', err);
    return '';
  }
}

const COLORS = {
  // Brand
  brandNavy: '#0f172a',
  accentBlue: '#3b82f6',
  // Backgrounds (eye-friendly)
  pageBg: '#f8fafc',
  headerBg: '#0f172a',
  cardBg: '#ffffff',
  buttonBg: 'rgba(255,255,255,0.08)',
  // Borders / text
  borderSoft: 'rgba(255,255,255,0.18)',
  textMuted: '#475569',
  textOnDark: '#f8fafc',
} as const;

type Params = {
  cacheId?: string;
  proparcel_value?: string;
  tkgm_value?: string;
  ada?: string;
  parsel?: string;
  unit_price?: string;
  total_price?: string;
  createdAt?: string;
  /** Stored DFA rows (JSON string) when opening from Sorgularım */
  dfaRows?: string;
  /** Stored location header (JSON string) when opening from Sorgularım */
  location_header?: string;
  /** Sorgu kaynağı türü - 'expert_request' ise Yanıt ve Resimler sekmeleri görünür */
  sourceType?: string;
  /** Uzman talebi ID'si */
  expertRequestId?: string;
  /** Saved query ID'si */
  savedQueryId?: string;
};

// Uzman yanıtı verisi tipi
type ExpertResponseData = {
  id: number;
  responseText: string;
  surveyAnswers: {
    similar_sale_exists?: boolean;
    emsal_ada_parsel?: {
      entries?: Array<{
        ada: string;
        parsel: string;
        fiyat?: number;
        alan?: number;
        polygon?: any;
      }>;
    };
    special_conditions?: string;
    is_low_terrain?: string;
  };
  attachments: string[];
  approvedAt: string | null;
  expert: {
    userId: number;
    fullName: string | null;
  };
};

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

type MapPanelKey =
  | 'none'
  | 'quarter_morphology'
  | 'quarter_sales'
  | 'km_analysis'
  | 'parcel_slope'
  | 'parcel_view'
  | 'parcel_electric'
  | 'parcel_water'
  | 'parcel_roads'
  | 'parcel_all';

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseAreaM2(value: any): number {
  return parseAreaM2Util(value);
}

function isReportPayload(d: unknown): d is ReportPayload {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return 'properties' in o && typeof o.properties === 'object' && ('dfaRows' in o || 'valuation_steps' in o);
}

function fmtTL0(n: any): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return `₺${Math.round(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function pctTextFromFactors(appliedFactor: any): string {
  const f = Number(appliedFactor);
  if (!Number.isFinite(f) || f === 1) return '%0';
  const pct = Math.abs((f - 1) * 100);
  const sign = f > 1 ? '+' : '-';
  const abs0 = Math.round(pct);
  const abs1 = Math.round(pct * 10) / 10;
  const showDecimal = Math.abs(abs1 - abs0) >= 0.1;
  return (
    sign +
    '%' +
    (showDecimal
      ? abs1.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : abs0.toLocaleString('tr-TR', { maximumFractionDigits: 0 }))
  );
}

function formatTrNumber(val: number | null): string | null {
  if (val == null || !Number.isFinite(val)) return null;
  return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tryParseJsonIfString(input: any): any {
  if (typeof input !== 'string') return input;
  const s = input.trim();
  if (!s) return input;
  const first = s[0];
  if (first !== '{' && first !== '[') return input;
  try {
    return JSON.parse(s);
  } catch {
    return input;
  }
}

function extractGeometryFromAny(input: any): any | null {
  if (!input) return null;
  const v = tryParseJsonIfString(input);
  if (!v) return null;

  // Array-of-features (GeoDataFrame .to_json()['features'] gibi)
  if (Array.isArray(v) && v.length) {
    const first = tryParseJsonIfString(v[0]);
    if (first?.type === 'Feature' && first.geometry) return tryParseJsonIfString(first.geometry);
    if (first?.type && first.coordinates) return first; // geometry objesi
  }

  // Some backends may send { features: [...] } without type
  if (!v.type && Array.isArray(v.features) && v.features.length) {
    const f0 = tryParseJsonIfString(v.features[0]);
    return f0?.geometry || null;
  }

  // FeatureCollection
  if (v.type === 'FeatureCollection' && Array.isArray(v.features) && v.features.length) {
    const f0 = tryParseJsonIfString(v.features[0]);
    return f0?.geometry || null;
  }

  // Feature
  if (v.type === 'Feature' && v.geometry) {
    return tryParseJsonIfString(v.geometry);
  }

  // Geometry
  if (v.type && v.coordinates) {
    return v;
  }

  // Some backends may send { geometry: {...} }
  if (v.geometry) {
    const g = tryParseJsonIfString(v.geometry);
    if (g?.type && g?.coordinates) return g;
  }

  return null;
}

function toFeatureCollection(geometry: any, properties: Record<string, any> = {}): any {
  if (!geometry) {
    return { type: 'FeatureCollection', features: [] };
  }
  const normalizedGeom = normalizeGeoJsonForMapbox(geometry);
  if (!normalizedGeom) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties, geometry: normalizedGeom }],
  };
}

function toMapboxShape(input: any): any | null {
  if (!input) return null;
  const v = tryParseJsonIfString(input);
  if (!v) return null;
  // GeoDataFrame .to_json()['features'] gibi array-of-features durumunu destekle
  if (Array.isArray(v)) {
    const features = v
      .map((it: any) => tryParseJsonIfString(it))
      .map((it: any) => {
        if (!it) return null;
        if (it.type === 'Feature') return it;
        // bazen geometry listesi gibi gelebilir → Feature'a sar
        if (it.type && it.coordinates) return { type: 'Feature', geometry: it, properties: {} };
        // { geometry: {...} } gibi
        if (it.geometry?.type && it.geometry?.coordinates) return { type: 'Feature', geometry: it.geometry, properties: it.properties || {} };
        return null;
      })
      .filter(Boolean);
    if (!features.length) return null;
    return normalizeGeoJsonForMapbox({ type: 'FeatureCollection', features });
  }
  // { features: [...] } ama type yoksa FeatureCollection varsay
  if (!v.type && Array.isArray(v.features)) {
    return normalizeGeoJsonForMapbox({ type: 'FeatureCollection', features: v.features.map((f: any) => tryParseJsonIfString(f)) });
  }
  if (v.type === 'FeatureCollection') return normalizeGeoJsonForMapbox(v);
  if (v.type === 'Feature') return normalizeGeoJsonForMapbox(v);
  const g = extractGeometryFromAny(v);
  if (g) return normalizeGeoJsonForMapbox({ type: 'Feature', geometry: g, properties: {} });
  return null;
}

function calcCenterFromPolygonGeom(geom: any): [number, number] | null {
  try {
    if (!geom || !geom.coordinates) return null;
    // Polygon: [ [ [lon,lat], ... ] ]
    let ring: any[] | null = null;
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) ring = geom.coordinates[0];
    else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0])) ring = geom.coordinates[0][0];
    if (!ring || ring.length === 0) return null;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const c of ring) {
      if (Array.isArray(c) && c.length >= 2) {
        const x = Number(c[0]);
        const y = Number(c[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    if (count === 0) return null;
    return [sumX / count, sumY / count];
  } catch {
    return null;
  }
}

/**
 * GeoJSON koordinat normalizasyonu (lat/lon -> lon/lat)
 * - Mapbox, GeoJSON'da [lon, lat] bekler.
 * - Bazı backend çıktıları [lat, lon] gelebiliyor; TR bbox (lat:35-43, lon:25-46) ile tespit edip swap eder.
 */
function normalizeGeometryLonLatForTurkey(geom: any): any {
  if (!geom || !geom.coordinates || !geom.type) return geom;

  const deepClone = (v: any) => {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  };

  const swapCoordsArray = (coords: any): any => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return [coords[1], coords[0]];
    }
    return coords.map(swapCoordsArray);
  };

  const getFirstCoord = (g: any): [number, number] | null => {
    try {
      if (!g || !g.coordinates) return null;
      if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
        return [Number(g.coordinates[0]), Number(g.coordinates[1])];
      }
      if (g.type === 'LineString' && Array.isArray(g.coordinates?.[0]) && g.coordinates[0].length >= 2) {
        return [Number(g.coordinates[0][0]), Number(g.coordinates[0][1])];
      }
      if (g.type === 'MultiLineString' && Array.isArray(g.coordinates?.[0]?.[0]) && g.coordinates[0][0].length >= 2) {
        return [Number(g.coordinates[0][0][0]), Number(g.coordinates[0][0][1])];
      }
      if (g.type === 'Polygon' && Array.isArray(g.coordinates?.[0]?.[0]) && g.coordinates[0][0].length >= 2) {
        return [Number(g.coordinates[0][0][0]), Number(g.coordinates[0][0][1])];
      }
      if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates?.[0]?.[0]?.[0]) && g.coordinates[0][0][0].length >= 2) {
        return [Number(g.coordinates[0][0][0][0]), Number(g.coordinates[0][0][0][1])];
      }
    } catch {
      return null;
    }
    return null;
  };

  // Eğer ilk koordinat TR lat aralığında ise [lat,lon] olma ihtimali yüksek → swap
  const first = getFirstCoord(geom);
  if (!first) return geom;
  const x = first[0];
  const y = first[1];
  const looksLikeLatLonTR = Number.isFinite(x) && Number.isFinite(y) && x >= 35 && x <= 43 && y >= 25 && y <= 46;
  if (!looksLikeLatLonTR) return geom;

  const cloned = deepClone(geom);
  cloned.coordinates = swapCoordsArray(cloned.coordinates);
  return cloned;
}

function normalizeGeoJsonForMapbox(input: any): any {
  if (!input) return input;

  // FeatureCollection
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    return {
      ...input,
      features: input.features.map((f: any) => normalizeGeoJsonForMapbox(f)),
    };
  }

  // Feature
  if (input.type === 'Feature' && input.geometry) {
    return {
      ...input,
      geometry: normalizeGeometryLonLatForTurkey(input.geometry),
    };
  }

  // Geometry
  if (input.type && input.coordinates) {
    return normalizeGeometryLonLatForTurkey(input);
  }

  return input;
}

function getByCaseInsensitive(obj: any, key: string): any {
  try {
    if (!obj || !key) return null;
    if (obj[key] != null) return obj[key];
    const target = String(key).toLowerCase();
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (String(k).toLowerCase() === target) return obj[k];
    }
    const v1 = String(key).replace(/_/g, '-').toLowerCase();
    const v2 = String(key).replace(/-/g, '_').toLowerCase();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const kk = String(k).toLowerCase();
      if (kk === v1 || kk === v2) return obj[k];
    }
  } catch {
    // no-op
  }
  return null;
}

function hasNonEmptyCoords(val: any): boolean {
  try {
    if (!val) return false;
    const v = tryParseJsonIfString(val);
    if (!v) return false;

    if (Array.isArray(v)) {
      return v.some(hasNonEmptyCoords);
    }

    if (v.type === 'FeatureCollection' && Array.isArray(v.features)) {
      return v.features.some(hasNonEmptyCoords);
    }

    if (v.type === 'Feature') {
      return hasNonEmptyCoords(v.geometry);
    }

    if (v.type && v.coordinates !== undefined) {
      const walk = (coords: any): boolean => {
        if (!Array.isArray(coords)) return false;
        if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          return Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
        }
        for (let i = 0; i < coords.length; i++) {
          if (walk(coords[i])) return true;
        }
        return false;
      };
      return walk(v.coordinates);
    }
  } catch {
    return false;
  }
  return false;
}

function countGeo(val: any): number {
  try {
    if (!val) return 0;
    const v = tryParseJsonIfString(val);
    if (Array.isArray(v)) return v.filter(hasNonEmptyCoords).length;
    if (v?.type === 'FeatureCollection' && Array.isArray(v.features)) {
      return v.features.filter(hasNonEmptyCoords).length;
    }
    if (v?.type === 'Feature') return hasNonEmptyCoords(v) ? 1 : 0;
    if (v?.type && v?.coordinates !== undefined) return hasNonEmptyCoords(v) ? 1 : 0;
  } catch {
    // no-op
  }
  return 0;
}

function getRepresentativePoint(input: any): [number, number] | null {
  try {
    const g = extractGeometryFromAny(input);
    if (!g) return null;
    const geom = normalizeGeoJsonForMapbox(g);

    if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      const x = Number(geom.coordinates[0]);
      const y = Number(geom.coordinates[1]);
      return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    }

    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      return calcCenterFromPolygonGeom(geom);
    }

    // LineString / MultiLineString: orta noktaya yakın bir koordinat seç
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length) {
      const idx = Math.floor(geom.coordinates.length / 2);
      const c = geom.coordinates[idx];
      if (Array.isArray(c) && c.length >= 2) return [Number(c[0]), Number(c[1])];
      return null;
    }
    if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates) && geom.coordinates.length) {
      const line = geom.coordinates[0];
      if (!Array.isArray(line) || line.length === 0) return null;
      const idx = Math.floor(line.length / 2);
      const c = line[idx];
      if (Array.isArray(c) && c.length >= 2) return [Number(c[0]), Number(c[1])];
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeLonLatCoordForTurkey(coord: any): [number, number] | null {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const a = Number(coord[0]);
  const b = Number(coord[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Eğer [lat,lon] TR bbox gibi duruyorsa swap
  if (a >= 35 && a <= 43 && b >= 25 && b <= 46) return [b, a];
  return [a, b];
}

function fmtDistanceSmartTr(val: any): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '-';
  if (n >= 1000) {
    const km = Math.round((n / 1000) * 10) / 10;
    return `${km.toLocaleString('tr-TR', { minimumFractionDigits: km % 1 ? 1 : 0, maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(n).toLocaleString('tr-TR')} m`;
}

function fmtM2SmartTr(val: any, decimals: number = 0): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} m²`;
}

// ── Villa / Fabrika rapor kartları yardımcıları ──

function fmtTL(v: any): string {
  if (v == null || v === '' || v === '-') return '-';
  const num = Number(v);
  if (!Number.isFinite(num)) return String(v ?? '');
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

function fmtNum(v: any, digits: number = 2): string {
  if (v == null) return '-';
  const num = Number(v);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const QUALITY_LABELS: Record<string, string> = {
  STANDARD: 'Standart',
  GOOD: 'İyi',
  LUX: 'Lüks',
  ULTRA: 'Ultra Lüks',
};

const SUBTYPE_LABELS: Record<string, string> = {
  VILLA_LT200: 'Küçük Villa (≤200 m²)',
  VILLA_200_500: 'Orta Villa (200–500 m²)',
  VILLA_GE500: 'Büyük Villa (500+ m²)',
};

const FACTORY_PARAM_LABELS: Record<string, string> = {
  CEILING_HEIGHT_M: 'Tavan Yüksekliği',
  MEP_LEVEL: 'Mekanik/Elektrik/Tesisat',
  FLOOR_CLASS: 'Zemin Sınıfı',
  SPAN_CLASS: 'Açıklık Sınıfı',
  OFFICE_RATIO: 'Ofis Alanı (m²)',
  STOREYS: 'Kat Sayısı',
  HAS_CRANE: 'Vinç Var mı',
  CRANE_TON: 'Vinç Kapasitesi (ton)',
  IS_COLD_STORAGE: 'Soğuk Hava Deposu',
  COLD_TEMP_CLASS: 'Sıcaklık Sınıfı',
  FIRE_CLASS: 'Yangın Sınıfı',
  INSULATION_CLASS: 'Yalıtım Sınıfı',
};

const FACTORY_VALUE_LABELS: Record<string, string> = {
  BASIC: 'Temel',
  STANDARD: 'Standart',
  ADVANCED: 'İleri Seviye',
  REINFORCED: 'Güçlendirilmiş',
  EPOXY: 'Epoksi',
  HEAVY_DUTY: 'Ağır Hizmet',
  '0_12': '0-12 m',
  '12_18': '12-18 m',
  '18_24': '18-24 m',
  '24_PLUS': '24+ m',
  true: 'Evet',
  false: 'Hayır',
};

function trFactoryValue(paramCode: string, val: any): string {
  if (val == null) return '-';
  const s = String(val);
  if (paramCode === 'CEILING_HEIGHT_M') return fmtNum(val, 1) + ' m';
  if (paramCode === 'OFFICE_RATIO') return fmtNum(val, 0) + ' m²';
  if (paramCode === 'CRANE_TON') return fmtNum(val, 0) + ' ton';
  if (paramCode === 'STOREYS') return fmtNum(val, 0) + ' kat';
  return FACTORY_VALUE_LABELS[s] || s;
}

function fmtPercentSmartTr(val: any, digits: number = 1): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '-';
  return `%${n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function ReportMobilViewver() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProParcelResponse | ReportPayload | null>(null);

  // Share / PDF
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Kullanıcı profil bilgileri (avatar, firma)
  const [profileInfo, setProfileInfo] = useState<{
    avatarUrl: string;
    companyName: string;
    companyLogoUrl: string;
  }>({ avatarUrl: '', companyName: '', companyLogoUrl: '' });

  // Uzman Yanıtı Sekmeleri (source_type='expert_request' için)
  const [activeTab, setActiveTab] = useState<'rapor' | 'yanit' | 'resimler'>('rapor');
  const [expertResponses, setExpertResponses] = useState<ExpertResponseData[]>([]);
  const [expertResponseLoading, setExpertResponseLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Uzman talebi kaynağı mı kontrol et
  const isExpertRequestSource = useMemo(() => {
    return params.sourceType === 'expert_request' || !!params.expertRequestId || !!params.savedQueryId;
  }, [params.sourceType, params.expertRequestId, params.savedQueryId]);
  
  // Tüm resimler (tüm yanıtlardan)
  const allImages = useMemo(() => {
    const imgs: string[] = [];
    expertResponses.forEach(r => {
      if (r.attachments && Array.isArray(r.attachments)) {
        r.attachments.forEach(url => {
          if (url) imgs.push(url);
        });
      }
    });
    return imgs;
  }, [expertResponses]);

  // Map UI
  const [mapGroup, setMapGroup] = useState<'parcel' | 'quarter'>('parcel');
  const [parcelMenuOpen, setParcelMenuOpen] = useState(false);
  const [quarterMenuOpen, setQuarterMenuOpen] = useState(false);
  const [mapPanel, setMapPanel] = useState<MapPanelKey>('none');
  const [mapPanelVisible, setMapPanelVisible] = useState(false);
  const closeMapPanel = useCallback(() => setMapPanelVisible(false), []);

  const [layerVis, setLayerVis] = useState(() => ({
    // Quarter
    quarter_polygon: false,
    boundary_polygon: false,
    quarter_slope_poly_0_20: false,
    quarter_slope_poly_20_30: false,
    quarter_slope_poly_over_30: false,
    grid_multipolygon: false,
    neighborhood_price_map: false,

    // Parcel
    parcel_slope_poly_0_20: false,
    parcel_slope_poly_20_30: false,
    parcel_slope_poly_over_30: false,
    view_primary: false,
    view_r1: false,
    electric: false,
    water_polygon: false,
    waterway: false,
    // Yakın Yollar (ana projedeki DFA akışı)
    near_roads_parallel: false,
    near_roads_nearest: false,
    near_roads_connector: false,

    // Labels
    labels: false,

    // Center lines (quarter -> city/town)
    city_center_line: false,
    town_center_line: false,
  }));

  // Toggle satırlarında "dokununca scroll kayması" sorununu azaltmak için:

  const priceSnapshot = useMemo(() => {
    return {
      unit_price: toNum(params.unit_price),
      total_price: toNum(params.total_price),
    };
  }, [params.unit_price, params.total_price]);

  const keys = useMemo(() => {
    return {
      proparcel_value: toNum(params.proparcel_value),
      tkgm_value: toNum(params.tkgm_value),
      ada: (params.ada ?? '').toString(),
      parsel: (params.parsel ?? '').toString(),
    };
  }, [params.proparcel_value, params.tkgm_value, params.ada, params.parsel]);

  const summary = useMemo(() => {
    if (data && isReportPayload(data)) {
      const p = data.properties || {};
      return {
        il: p.ilAd ?? '-',
        ilce: p.ilceAd ?? '-',
        mahalle: p.mahalleAd ?? '-',
        area: '-',
        ada: (p.adaNo ?? keys.ada) || '-',
        parsel: (p.parselNo ?? keys.parsel) || '-',
      };
    }
    const pd: any = (data as any)?.parameters_data || {};
    const pv: any = pd?.parcel_values || {};
    const location = pd?.location || {};

    const mahalle = pv?.mahalleAd || pv?.quarter_name || location?.quarter || '-';
    const il = pv?.ilAd || location?.city || '-';
    const ilce = pv?.ilceAd || location?.district || '-';
    const area = pv?.yuzolcum || pv?.alan || pv?.area_m2 || pv?.areaM2 || '-';
    const ada = pv?.adaNo || pv?.ada || keys.ada || '-';
    const parsel = pv?.parselNo || pv?.parsel || keys.parsel || '-';
    return { il, ilce, mahalle, area, ada, parsel };
  }, [data, keys.ada, keys.parsel]);

  const derived = useMemo(() => {
    if (data && isReportPayload(data)) {
      const polygons: any = {};
      const parcelGeom = null;
      const p = data.properties || {};
      const propsForSummary = {
        ...p,
        unite_price: formatTrNumber(priceSnapshot.unit_price),
        price_of_tarla: formatTrNumber(priceSnapshot.total_price),
      };
      const dfaRows = Array.isArray(data.dfaRows) && data.dfaRows.length > 0
        ? data.dfaRows
        : buildDfaRowsFromValuationSteps(data.valuation_steps ?? [], 0);
      return {
        pd: {},
        pv: p,
        polygons,
        parcelGeom,
        parcelDataForShare: { geometry: null, properties: propsForSummary, analysisData: data },
        valuationSteps: data.valuation_steps ?? [],
        areaM2: 0,
        dfaRows,
        villaResult: data.villa_result ?? null,
        factoryResult: data.factory_result ?? null,
        priceComment: null as null | { lines: string[]; isRamsar: boolean; ramsarText: string | null },
      };
    }

    const pd: any = (data as any)?.parameters_data || {};
    const pv: any = pd?.parcel_values || {};
    const polygons: any = (data as any)?.parameters_polygons || {};

    const parcelGeomRaw =
      extractGeometryFromAny((data as any)?.geometry) ||
      extractGeometryFromAny(polygons?.parcel_polygon) ||
      null;
    const parcelGeom = parcelGeomRaw ? normalizeGeoJsonForMapbox(parcelGeomRaw) : null;

    const propsForSummary = {
      ...(pv || {}),
      ...(pd || {}),
      unite_price: formatTrNumber(priceSnapshot.unit_price),
      price_of_tarla: formatTrNumber(priceSnapshot.total_price),
    };

    const parcelDataForShare = {
      geometry: parcelGeom,
      properties: propsForSummary,
      analysisData: data,
    };

    const valuationSteps = Array.isArray(pd?.valuation_steps) ? pd.valuation_steps : [];

    const areaRaw =
      pv?.arazi_m2 ??
      pv?.area_m2 ??
      pv?.alan ??
      pv?.yuzolcum ??
      (parcelGeom ? null : null);
    const areaM2 = parseAreaM2(areaRaw);
    const dfaRows = buildDfaRowsFromValuationSteps(valuationSteps, areaM2);

    // ─ Fiyat Değerlendirmesi hesaplama ─
    let priceComment: null | { lines: string[]; isRamsar: boolean; ramsarText: string | null } = null;
    try {
      const qp = toNum(pv?.quarter_uniteprice ?? pd?.quarter_uniteprice);
      const med = toNum(pd?.quarter_uniteprice_median ?? pv?.quarter_uniteprice_median);
      const dPct = toNum(pv?.diffPercentOfPrice ?? pd?.diffPercentOfPrice);
      const areaForComment = areaM2 > 0 ? areaM2 : null;

      const kmQ = (pd?.km_analysis || {} as any).quality || null;
      const ramsarV = pd?.ramsar_values || {} as any;
      const isRamsar = ramsarV.is_ramsar === true || ramsarV.is_ramsar === 1;

      const psDetails = (pd?.price_selection || {} as any).details || {};
      const rawVer = psDetails.db_verified ?? pv?.quarter_uniteprice_verified ?? pd?.quarter_uniteprice_verified;
      const isVer = rawVer === true || rawVer === 1 || rawVer === '1' || (typeof rawVer === 'string' && rawVer.toLowerCase() === 'true');

      const lines: string[] = [];

      const recUnit = (med != null && dPct != null) ? med * (1 + dPct / 100) : null;
      const recTotal = (recUnit != null && areaForComment != null) ? recUnit * areaForComment : null;
      if (qp != null && med != null && med < qp * 0.9 && recUnit != null && recTotal != null) {
        lines.push(`Mahallede arazi fiyatlarının şu an çıktığı izlenmektedir. Öneri olarak ${fmtTL(recUnit)} birim fiyatından Toplam; ${fmtTL(recTotal)} fiyatına bu arazi özelliklerinde benzer bir arazi almak fırsat olabilir.`);
      }

      if (kmQ && (kmQ.score != null || kmQ.label || kmQ.summary_text_tr)) {
        const s = kmQ.score != null ? String(kmQ.score) : '-';
        const l = kmQ.label ? ` (${kmQ.label})` : '';
        const sm = kmQ.summary_text_tr ? ` — ${kmQ.summary_text_tr}` : '';
        lines.push(`KM Kalite: ${s}/100${l}${sm}`);
      }

      if (isVer) {
        lines.push('Arazi hesaplamasında tahmin edilen fiyat kullanılmamıştır. Güncel piyasada geçerli olan doğrulanmış birim fiyatı baz alınmıştır.');
      } else {
        lines.push('Mahallenin güncel piyasa değeriyle ilgili hiçbir veri bulunmadığı için arazi hesaplamasında tahmin edilen birim fiyatı baz alınmıştır.');
      }

      const ramsarName = ramsarV.ramsar_name ? String(ramsarV.ramsar_name).trim() : null;
      const ramsarText = isRamsar ? (ramsarName ? `${ramsarName} (Sulak Koruma Alanı) alanı içinde` : 'RAMSAR (Sulak Koruma Alanı) alanı içinde') : null;

      if (lines.length > 0) {
        priceComment = { lines, isRamsar, ramsarText };
      }
    } catch (_) {}

    return {
      pd, pv, polygons, parcelGeom, parcelDataForShare, valuationSteps, areaM2, dfaRows,
      villaResult: pd?.villa_result ?? null,
      factoryResult: pd?.factory_result ?? null,
      priceComment,
    };
  }, [data, priceSnapshot.total_price, priceSnapshot.unit_price]);

  const debugMapLogsEnabled = useMemo(() => {
    try {
      const raw =
        (params as any)?.debugMap ??
        (params as any)?.debug_map ??
        (params as any)?.debug ??
        (params as any)?.logs ??
        null;
      const s = String(raw ?? '').trim().toLowerCase();
      return (typeof __DEV__ !== 'undefined' && __DEV__) || s === '1' || s === 'true' || s === 'yes';
    } catch {
      return typeof __DEV__ !== 'undefined' && __DEV__;
    }
  }, [params]);

  useEffect(() => {
    if (!debugMapLogsEnabled) return;
    if (!data) return;
    const polys: any = (data as any)?.parameters_polygons || {};
    const keys = Object.keys(polys || {});
    console.log(
      `[ReportMap][dataLoaded] polygonsKeys=${keys.length} keys=${keys.slice(0, 40).join(', ')}${keys.length > 40 ? '…' : ''}`
    );
  }, [data, debugMapLogsEnabled]);

  useEffect(() => {
    if (!debugMapLogsEnabled) return;
    if (!mapPanelVisible || mapPanel === 'none') return;

    const polys = (derived.polygons || {}) as any;
    const panel = mapPanel;
    const keyList: string[] =
      panel === 'parcel_water'
        ? ['water_polygon', 'clipped_waterway_multilinestring']
        : panel === 'quarter_sales'
          ? ['quarter_polygon', 'grid_multipolygon']
          : panel === 'quarter_morphology'
            ? ['quarter_polygon', 'boundary_polygon', 'quarter_slope_poly_0_20', 'quarter_slope_poly_20_30', 'quarter_slope_poly_over_30']
            : [];

    console.log(
      `[ReportMap][panelOpen] panel=${panel} mapGroup=${mapGroup} layerVis=${JSON.stringify(layerVis)}`
    );

    const describe = (k: string) => {
      const raw = (polys as any)?.[k] ?? getByCaseInsensitive(polys, k);
      const parsed = tryParseJsonIfString(raw);
      const kind = raw == null ? 'null' : Array.isArray(parsed) ? 'array' : parsed?.type ? String(parsed.type) : typeof raw;
      const count = countGeo(raw);
      const has = hasNonEmptyCoords(raw);
      const rep = getRepresentativePoint(raw);
      const shape = toMapboxShape(raw);
      const shapeCount = Array.isArray(shape?.features) ? shape.features.length : 0;
      const shapeType = shape?.type || (shape ? 'shape' : 'null');
      console.log(
        `[ReportMap][layer] ${k} kind=${kind} count=${count} hasCoords=${has} shape=${shapeType} shapeFeatures=${shapeCount} rep=${rep ? `${rep[0]},${rep[1]}` : '-'}`
      );
    };

    for (const k of keyList) describe(k);
  }, [debugMapLogsEnabled, derived.polygons, layerVis, mapGroup, mapPanel, mapPanelVisible]);

  const setPresetAndOpenPanel = useCallback((panel: MapPanelKey) => {
    setMapPanel(panel);
    setMapPanelVisible(true);
    setParcelMenuOpen(false);
    setQuarterMenuOpen(false);
    // reset scroll position (no-op; ref removed)

    const isQuarter = panel === 'quarter_morphology' || panel === 'quarter_sales' || panel === 'km_analysis';
    setMapGroup(isQuarter ? 'quarter' : 'parcel');

    const off = {
      quarter_polygon: false,
      boundary_polygon: false,
      quarter_slope_poly_0_20: false,
      quarter_slope_poly_20_30: false,
      quarter_slope_poly_over_30: false,
      grid_multipolygon: false,
      neighborhood_price_map: false,
      parcel_slope_poly_0_20: false,
      parcel_slope_poly_20_30: false,
      parcel_slope_poly_over_30: false,
      view_primary: false,
      view_r1: false,
      electric: false,
      water_polygon: false,
      waterway: false,
      near_roads_parallel: false,
      near_roads_nearest: false,
      near_roads_connector: false,
      labels: false,
      city_center_line: false,
      town_center_line: false,
    };

    setLayerVis((_prev) => {
      if (panel === 'quarter_morphology') {
        return {
          ...off,
          quarter_polygon: true,
          boundary_polygon: true,
          quarter_slope_poly_0_20: true,
          quarter_slope_poly_20_30: true,
          quarter_slope_poly_over_30: true,
          city_center_line: true,
          town_center_line: true,
        };
      }
      if (panel === 'quarter_sales') {
        return { ...off, quarter_polygon: true, grid_multipolygon: true };
      }
      if (panel === 'km_analysis') {
        return { ...off, quarter_polygon: true, neighborhood_price_map: true };
      }
      if (panel === 'parcel_slope') {
        return {
          ...off,
          parcel_slope_poly_0_20: true,
          parcel_slope_poly_20_30: true,
          parcel_slope_poly_over_30: true,
        };
      }
      if (panel === 'parcel_view') {
        return { ...off, view_primary: true, view_r1: true };
      }
      if (panel === 'parcel_electric') {
        return { ...off, electric: true };
      }
      if (panel === 'parcel_water') {
        return { ...off, water_polygon: true, waterway: true };
      }
      if (panel === 'parcel_roads') {
        return { ...off, near_roads_parallel: true, near_roads_nearest: true, near_roads_connector: true };
      }
      if (panel === 'parcel_all') {
        return {
          ...off,
          parcel_slope_poly_0_20: true,
          parcel_slope_poly_20_30: true,
          parcel_slope_poly_over_30: true,
          view_primary: true,
          view_r1: true,
          electric: true,
          water_polygon: true,
          waterway: true,
          near_roads_parallel: true,
          near_roads_nearest: true,
          near_roads_connector: true,
          labels: true,
        };
      }
      return off;
    });
  }, []);

  const overlayLabelsFC = useMemo(() => {
    const features: any[] = [];
    const polys = derived.polygons || {};

    const maybePush = (id: string, title: string, geo: any, color: string) => {
      const pt = getRepresentativePoint(geo);
      if (!pt) return;
      features.push({
        type: 'Feature',
        properties: { id, title, color },
        geometry: { type: 'Point', coordinates: pt },
      });
    };

    if (layerVis.quarter_polygon) maybePush('quarter', 'Mahalle', polys.quarter_polygon, '#f97316');
    if (layerVis.boundary_polygon) maybePush('boundary', 'Yapı Alanı', polys.boundary_polygon, '#ffffff');

    if (layerVis.parcel_slope_poly_0_20) maybePush('slope0', 'Eğim 0-20', polys.parcel_slope_poly_0_20, '#22c55e');
    if (layerVis.parcel_slope_poly_20_30) maybePush('slope1', 'Eğim 20-30', polys.parcel_slope_poly_20_30, '#f59e0b');
    if (layerVis.parcel_slope_poly_over_30) maybePush('slope2', 'Eğim 30%+', polys.parcel_slope_poly_over_30, '#ef4444');

    if (layerVis.view_primary) maybePush('viewp', 'Ana Manzara', getByCaseInsensitive(polys, 'View_PRIMARY'), '#60a5fa');
    if (layerVis.view_r1) maybePush('viewr', 'İkincil Manzara', getByCaseInsensitive(polys, 'View_R1'), '#a78bfa');

    if (layerVis.electric) maybePush('electric', 'Yüksek Gerilim', polys.clipped_electric_multilinestring, '#a78bfa');
    if (layerVis.water_polygon) maybePush('water', 'Su Alanı', polys.water_polygon, '#38bdf8');
    if (layerVis.waterway) maybePush('waterway', 'Su Yolu', polys.clipped_waterway_multilinestring, '#38bdf8');
    if (layerVis.near_roads_nearest || layerVis.near_roads_parallel || layerVis.near_roads_connector) {
      // Etiket noktası: önce en yakın yol, yoksa paralel yollar
      const bestGeo = polys.nearest_road_field || polys.parallel_roads_multilinestring || polys.nearest_road_field_connector || null;
      maybePush('roads', 'Yakın Yollar', bestGeo, '#fbbf24');
    }

    return { type: 'FeatureCollection', features };
  }, [
    derived.polygons,
    layerVis.boundary_polygon,
    layerVis.electric,
    layerVis.parcel_slope_poly_0_20,
    layerVis.parcel_slope_poly_20_30,
    layerVis.parcel_slope_poly_over_30,
    layerVis.quarter_polygon,
    layerVis.near_roads_parallel,
    layerVis.near_roads_nearest,
    layerVis.near_roads_connector,
    layerVis.view_primary,
    layerVis.view_r1,
    layerVis.water_polygon,
    layerVis.waterway,
  ]);

  const centerLines = useMemo(() => {
    const qi: any = derived.pd?.quarter_info || {};
    const quarterCenter = getRepresentativePoint(derived.polygons?.quarter_polygon);
    const city = normalizeLonLatCoordForTurkey(qi.city_center);
    const town = normalizeLonLatCoordForTurkey(qi.town_center);

    const mkLine = (a: [number, number] | null, b: [number, number] | null, id: string) => {
      if (!a || !b) return null;
      return {
        type: 'Feature',
        properties: { id },
        geometry: { type: 'LineString', coordinates: [a, b] },
      };
    };

    return {
      quarterCenter,
      city,
      town,
      cityLine: mkLine(city, quarterCenter, 'city'),
      townLine: mkLine(town, quarterCenter, 'town'),
    };
  }, [derived.pd, derived.polygons]);

  const centerPointsFC = useMemo(() => {
    const features: any[] = [];
    const anyLineOn = layerVis.city_center_line || layerVis.town_center_line;
    if (!anyLineOn) return { type: 'FeatureCollection', features };

    const pushPt = (id: string, title: string, coord: [number, number] | null, color: string) => {
      if (!coord) return;
      features.push({
        type: 'Feature',
        properties: { id, title, color },
        geometry: { type: 'Point', coordinates: coord },
      });
    };

    // Quarter center: çizgi açıkken referans noktası olarak göster
    pushPt('quarter_center', 'Mahalle Merkezi', centerLines.quarterCenter, '#f97316');
    if (layerVis.city_center_line) pushPt('city_center', 'Şehir Merkezi', centerLines.city, '#3b82f6');
    if (layerVis.town_center_line) pushPt('town_center', 'İlçe Merkezi', centerLines.town, '#8b5cf6');

    return { type: 'FeatureCollection', features };
  }, [centerLines.city, centerLines.quarterCenter, centerLines.town, layerVis.city_center_line, layerVis.town_center_line]);

  const backendUrl = useMemo(() => {
    return ((FALLBACK_API_URL || API_URL) || '').replace(/\/$/, '');
  }, []);

  const [neighborhoodPriceMapFC, setNeighborhoodPriceMapFC] = useState<any | null>(null);
  const [neighborhoodPriceMapLoading, setNeighborhoodPriceMapLoading] = useState(false);
  const [neighborhoodPriceMapError, setNeighborhoodPriceMapError] = useState<string | null>(null);
  const neighborhoodPriceMapKeyRef = useRef<string | null>(null);
  const neighborhoodPriceMapInFlightRef = useRef(false);

  const kmProparcelValue = useMemo(() => {
    const pv: any = derived.pv || {};
    const pd: any = derived.pd || {};
    // location_header'dan da proparcel_value almayı dene
    const lh: any = tryParseJsonIfString(params.location_header) || {};
    const fromDerived = toNum(
      pv.Proparcel_value ?? pv.proparcel_value ?? 
      pd.proparcel_value ?? 
      lh.Proparcel_value ?? lh.proparcel_value
    );
    const v = keys.proparcel_value ?? fromDerived ?? null;
    return Number.isFinite(Number(v)) ? Number(v) : null;
  }, [derived.pd, derived.pv, keys.proparcel_value, params.location_header]);

  const kmPropertyType = useMemo(() => {
    const pv: any = derived.pv || {};
    const pd: any = derived.pd || {};
    const raw = String(
      pv.property_type_override ??
        pv.property_type_detected ??
        pv.property_type ??
        pd.property_type_detected ??
        pd.property_type ??
        ''
    )
      .trim()
      .toLowerCase();

    let t: 'arsa' | 'tarla' = 'arsa';
    if (raw.includes('arsa+tarla')) t = 'arsa';
    else if (raw.includes('ticari')) t = 'arsa';
    else if (raw.includes('arsa')) t = 'arsa';
    else if (raw.includes('tarla')) t = 'tarla';
    return t;
  }, [derived.pd, derived.pv]);

  useEffect(() => {
    if (mapPanel !== 'km_analysis') return;
    if (!layerVis.neighborhood_price_map) return;
    if (!backendUrl) return;
    if (!kmProparcelValue) return;

    const scope = 'town';
    const priceStatus = 'available';
    const k = `${kmPropertyType}__${kmProparcelValue}__${scope}__${priceStatus}`;
    if (neighborhoodPriceMapInFlightRef.current) return;

    // Aynı anahtarda veri geldiyse tekrar fetch etme
    if (neighborhoodPriceMapKeyRef.current === k && neighborhoodPriceMapFC?.features?.length) return;

    neighborhoodPriceMapKeyRef.current = k;
    neighborhoodPriceMapInFlightRef.current = true;
    setNeighborhoodPriceMapLoading(true);
    setNeighborhoodPriceMapError(null);

    const qs =
      `property_type=${encodeURIComponent(kmPropertyType)}` +
      `&proparcel_value=${encodeURIComponent(String(kmProparcelValue))}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&price_status=${encodeURIComponent(priceStatus)}`;
    const url = `${backendUrl}/analiz/api/report-price-map/?${qs}`;

    const toLonLatPair = (pair: any): [number, number] | null => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const a = Number(pair[0]);
      const b = Number(pair[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const looksLatLonTR = a >= 35 && a <= 43 && b >= 25 && b <= 46;
      const looksLonLatTR = a >= 25 && a <= 46 && b >= 35 && b <= 43;
      if (looksLatLonTR) return [b, a];
      if (looksLonLatTR) return [a, b];
      // Web tarafı varsayımı: [lat,lon] -> [lon,lat]
      return [b, a];
    };

    const normalizeRing = (coords: any): [number, number][] => {
      const ring: [number, number][] = [];
      if (!Array.isArray(coords)) return ring;
      for (const p of coords) {
        const ll = toLonLatPair(p);
        if (ll) ring.push(ll);
      }
      if (ring.length > 2) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
      }
      return ring;
    };

    (async () => {
      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'X-PP-Client': 'mobile',
            'ngrok-skip-browser-warning': 'true',
          },
        });

        const json: any = await resp.json().catch(() => null);
        if (!resp.ok || !json || json.success === false) {
          setNeighborhoodPriceMapFC({ type: 'FeatureCollection', features: [] });
          setNeighborhoodPriceMapError(!resp.ok ? `HTTP ${resp.status}` : 'Veri alınamadı');
          return;
        }

        const items = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.data?.data)
            ? json.data.data
            : Array.isArray(json?.data?.items)
              ? json.data.items
              : [];

        const features: any[] = [];

        const parseTrNumber = (v: any): number | null => {
          if (v === null || v === undefined || v === '') return null;
          if (typeof v === 'number') return Number.isFinite(v) ? v : null;
          const s = String(v)
            .trim()
            .replace(/\s/g, '')
            .replace(/₺|tl|try/gi, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^\d.]/g, '');
          if (!s) return null;
          const n = parseFloat(s);
          return Number.isFinite(n) ? n : null;
        };

        const fmtPrice = (v: any): string | null => {
          const n = parseTrNumber(v);
          if (n == null || n <= 0) return null;
          return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const pickQuarterName = (item: any): string => {
          const candidates = [
            item?.quarter_name,
            item?.quarterName,
            item?.mahalleAd,
            item?.mahalle_ad,
            item?.mahalle,
            item?.quarter,
            item?.name,
            item?.label_text,
            item?.labelText,
          ];
          for (const c of candidates) {
            const s = String(c ?? '').trim();
            if (s) return s;
          }
          return '';
        };

        for (const item of items) {
          const ring = normalizeRing(item?.coordinates);
          if (!ring.length) continue;

          const quarterName = pickQuarterName(item);
          const priceText = fmtPrice(item?.m2_price);
          const labelText =
            quarterName && priceText
              ? `${quarterName}\n${priceText} ₺/m²`
              : quarterName
                ? quarterName
                : priceText
                  ? `${priceText} ₺/m²`
                  : '';

          const isTarget = item?.is_target === true || String(item?.proparcel_value) === String(kmProparcelValue);

          features.push({
            type: 'Feature',
            properties: {
              is_target: !!isTarget,
              quarter_name: quarterName,
              proparcel_value: item?.proparcel_value ?? null,
              m2_price: item?.m2_price ?? null,
              label_text: labelText || item?.label_text || quarterName || '',
            },
            geometry: { type: 'Polygon', coordinates: [ring] },
          });
        }

        setNeighborhoodPriceMapFC({ type: 'FeatureCollection', features });
        try {
          if (debugMapLogsEnabled) {
            const sample = features.find((f: any) => f?.properties?.label_text) || features[0];
            console.log(
              `[ReportMap][kmAnalysis] fetched=${features.length} sampleLabel=${sample?.properties?.label_text ? String(sample.properties.label_text).slice(0, 80) : '-'}`
            );
          }
        } catch {
          // no-op
        }
      } catch (e: any) {
        setNeighborhoodPriceMapFC({ type: 'FeatureCollection', features: [] });
        setNeighborhoodPriceMapError(e?.message || 'Bağlantı hatası');
      } finally {
        neighborhoodPriceMapInFlightRef.current = false;
        setNeighborhoodPriceMapLoading(false);
      }
    })();
  }, [backendUrl, kmProparcelValue, kmPropertyType, layerVis.neighborhood_price_map, mapPanel, neighborhoodPriceMapFC?.features?.length]);

  const mapRef = useRef<any>(null);
  const mapReadyRef = useRef({ didFinishLoadingMap: false, didFinishLoadingStyle: false, isIdle: false });

  /** PDF Rapor Paylaş: Harita snapshot -> PDF oluştur -> Paylaş */
  const handleSharePdf = useCallback(async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    let tempMapUri: string | null = null;

    try {
      // 1. Harita görüntüsünü al
      let mapBase64 = '';

      // 1a. Önce mapRef snapshot dene (bağlı MapView varsa)
      if (mapRef.current) {
        try {
          await waitForMapIdle(mapReadyRef, 5000);
          const dimensions = getCombinedImageDimensions();
          tempMapUri = await tryMapboxSnap(mapRef, dimensions);
          if (tempMapUri) {
            const cleanUri = tempMapUri.startsWith('file://')
              ? tempMapUri.replace('file://', '')
              : tempMapUri;
            mapBase64 = await RNFS.readFile(cleanUri, 'base64');
          }
        } catch (snapErr) {
          console.warn('[handleSharePdf] MapView snapshot hatası:', snapErr);
        }
      }

      // 1b. Snapshot alınamadıysa → Mapbox Static Images API kullan
      if (!mapBase64) {
        // Geometri kaynaklarını sırayla dene
        const geomSources = [
          derived.parcelGeom,
          // ProParcelResponse.parameters_polygons.parcel_polygon
          extractGeometryFromAny((data as any)?.parameters_polygons?.parcel_polygon),
          // ProParcelResponse.geometry
          extractGeometryFromAny((data as any)?.geometry),
        ];
        for (const geom of geomSources) {
          if (geom && !mapBase64) {
            console.log('[handleSharePdf] Static map API ile harita alınıyor (parcel polygon)...');
            mapBase64 = await fetchStaticMapBase64(geom);
          }
        }
        // Son çare: centroid_point varsa merkezli uydu görüntüsü
        if (!mapBase64) {
          const centroid = extractGeometryFromAny((data as any)?.parameters_polygons?.centroid_point);
          if (centroid?.coordinates) {
            const [lon, lat] = centroid.coordinates;
            if (MAPBOX_TOKEN && Number.isFinite(lon) && Number.isFinite(lat)) {
              console.log('[handleSharePdf] Static map API ile harita alınıyor (centroid)...');
              mapBase64 = await fetchStaticMapBase64({ type: 'Point', coordinates: [lon, lat] });
            }
          }
        }
      }

      if (!mapBase64) {
        console.warn('[handleSharePdf] Harita görüntüsü alınamadı, placeholder ile devam ediliyor');
      }

      // 2. Kullanıcı/firma bilgileri
      const userName = user?.full_name || '';
      const userPhone = user?.phone_number || '';
      const companyName = profileInfo.companyName || 'ProParcel';

      // 2b. Avatar/Logo: eğer URL ise base64'e çevir (PDF'te güvenilir embed için)
      let avatarBase64 = '';
      if (profileInfo.avatarUrl) {
        try {
          const avTmp = `${RNFS.CachesDirectoryPath}/avatar_${Date.now()}.jpg`;
          await RNFS.downloadFile({ fromUrl: profileInfo.avatarUrl, toFile: avTmp }).promise;
          avatarBase64 = `data:image/jpeg;base64,${await RNFS.readFile(avTmp, 'base64')}`;
          await RNFS.unlink(avTmp).catch(() => {});
        } catch (avErr) {
          console.warn('[handleSharePdf] Avatar indirilemedi:', avErr);
        }
      }

      let logoBase64 = '';
      if (profileInfo.companyLogoUrl) {
        try {
          const lgTmp = `${RNFS.CachesDirectoryPath}/logo_${Date.now()}.png`;
          await RNFS.downloadFile({ fromUrl: profileInfo.companyLogoUrl, toFile: lgTmp }).promise;
          logoBase64 = `data:image/png;base64,${await RNFS.readFile(lgTmp, 'base64')}`;
          await RNFS.unlink(lgTmp).catch(() => {});
        } catch (lgErr) {
          console.warn('[handleSharePdf] Logo indirilemedi:', lgErr);
        }
      }

      // 3. Dosya adı (web: Mahalle_Ada_Parsel.pdf)
      const fileNameBase = buildReportPdfFileName(
        summary.mahalle !== '-' ? summary.mahalle : '',
        summary.ada !== '-' ? summary.ada : '',
        summary.parsel !== '-' ? summary.parsel : '',
      ).replace(/\.pdf$/i, '');

      // 4. PDF oluştur — valuationSteps birden fazla kaynaktan dene
      let stepsForPdf = derived.valuationSteps;
      if ((!stepsForPdf || stepsForPdf.length === 0) && data) {
        // Alternatif kaynaklar
        const pd = (data as any)?.parameters_data;
        stepsForPdf =
          pd?.valuation_steps ??
          (data as any)?.valuation_steps ??
          pd?.dfa_steps ??
          [];
      }

      const { pdfUri, filename } = await generateAnalysisReportPdf({
        mapScreenshotBase64: mapBase64,
        location: {
          il: summary.il,
          ilce: summary.ilce,
          mahalle: summary.mahalle,
          ada: summary.ada,
          parsel: summary.parsel,
          area: derived.areaM2 > 0
            ? `${Math.round(derived.areaM2).toLocaleString('tr-TR')} m²`
            : '-',
        },
        pricing: {
          unitPrice: priceSnapshot.unit_price,
          totalPrice: priceSnapshot.total_price,
        },
        dfaRows: derived.dfaRows,
        valuationSteps: Array.isArray(stepsForPdf) ? stepsForPdf : [],
        areaM2: derived.areaM2,
        companyName,
        companyLogoUrl: logoBase64,
        userName,
        userPhone,
        userAvatarUrl: avatarBase64,
        priceComment: derived.priceComment,
        fileName: fileNameBase,
      });

      // 5. PDF'i paylaş
      await Share.open({
        title: 'Analiz Raporu',
        message: `ProParcel Analiz Raporu — ${summary.mahalle} ${summary.ada}/${summary.parsel}`,
        url: `file://${pdfUri}`,
        type: 'application/pdf',
        filename,
      });

      console.log('[handleSharePdf] PDF başarıyla paylaşıldı:', filename);
    } catch (error: any) {
      // Kullanıcı iptal ettiyse sessizce çık
      if (
        error?.message === 'User did not share' ||
        error?.message?.includes('cancel') ||
        error?.message?.includes('iptal') ||
        error?.code === 'ECANCELLED'
      ) {
        console.log('[handleSharePdf] Kullanıcı paylaşımı iptal etti');
        return;
      }
      console.error('[handleSharePdf] PDF paylaşma hatası:', error);
      Alert.alert('Hata', error?.message || 'PDF raporu oluşturulurken bir hata oluştu.');
    } finally {
      // Temp harita dosyasını temizle
      if (tempMapUri) {
        try {
          const cleanUri = tempMapUri.startsWith('file://')
            ? tempMapUri.replace('file://', '')
            : tempMapUri;
          await RNFS.unlink(cleanUri);
        } catch { /* ignore */ }
      }
      setIsGeneratingPdf(false);
    }
  }, [data, derived, summary, priceSnapshot, user, profileInfo, isGeneratingPdf]);

  const fetchRerun = useCallback(async () => {
    if (!keys.tkgm_value || !keys.ada || !keys.parsel) {
      Alert.alert('Hata', 'Sorgu anahtar bilgileri eksik.');
      return;
    }
    // Not: "Sorgularım" üzerinden rerun istekleri ngrok/https üzerinden gitmeli.
    // Bu yüzden öncelik ngrok fallback'te; gerekirse API_URL'a düşer.
    const backendUrl = ((FALLBACK_API_URL || API_URL) || "").replace(/\/$/, "");

    setLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/api/mobile/rerun_parcel_info/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PP-Client': 'mobile',
          // Ngrok uyarı sayfasını by-pass etmek için (API çağrılarında genelde gerekmez ama güvenli)
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          proparcel_value: keys.proparcel_value,
          tkgm_value: keys.tkgm_value,
          ada: keys.ada,
          parsel: keys.parsel,
          map_mode: '2d',
          is3D: false,
          include_valuation: true,
        }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${t}`);
      }
      const json = (await resp.json()) as ProParcelResponse;
      setData(json);
    } catch (e: any) {
      Alert.alert('Bağlantı Hatası', e?.message || 'Rapor verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [keys.ada, keys.parsel, keys.proparcel_value, keys.tkgm_value]);

  useEffect(() => {
    // 1) İlk sorgudan geldiysek cache'den oku (ReportPayload veya eski ProParcelResponse)
    if (params.cacheId) {
      const cached = getReportMemory<ProParcelResponse | ReportPayload>(String(params.cacheId));
      if (cached) {
        setData(cached);
        return;
      }
    }
    // 2) Sorgularım'dan geldiysek saklanan dfaRows + location_header ile doldur
    const dfaRowsStr = (params as any).dfaRows;
    const locationHeaderStr = (params as any).location_header;
    if (typeof dfaRowsStr === 'string' && dfaRowsStr.trim() && typeof locationHeaderStr === 'string' && locationHeaderStr.trim()) {
      try {
        const dfaRows = JSON.parse(dfaRowsStr) as ReportPayload['dfaRows'];
        const location_header = JSON.parse(locationHeaderStr) as ReportPayload['properties'];
        if (Array.isArray(dfaRows) && location_header && typeof location_header === 'object') {
          setData({
            properties: location_header,
            dfaRows,
          });
          setLoading(false);
          return;
        }
      } catch {
        // fallback to fetchRerun
      }
    }
    // 3) Cache yoksa ve stored veri yoksa: rerun (valuation skip)
    fetchRerun();
  }, [params.cacheId, (params as any).dfaRows, (params as any).location_header, fetchRerun]);

  // Profil bilgilerini al (avatar, firma)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await authService.getProfile();
        if (cancelled) return;
        if (resp.success && resp.data) {
          const profile = resp.data.profile;
          const company = resp.data.company_relation;
          setProfileInfo({
            avatarUrl: profile?.avatar_url || profile?.pending_avatar_url || '',
            companyName: company?.company_name || profile?.company_relation?.company_name || '',
            companyLogoUrl: company?.company_logo || profile?.company_logo_url || profile?.company_logo || '',
          });
        }
      } catch (err) {
        console.warn('[report_mobil_viewver] Profil alınamadı:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Uzman yanıtlarını yükle (expert_request kaynağından gelen sorgularda)
  useEffect(() => {
    if (!isExpertRequestSource) return;
    
    const loadExpertResponses = async () => {
      setExpertResponseLoading(true);
      try {
        let apiUrl = '';
        if (params.savedQueryId) {
          apiUrl = `${backendUrl}/api/user/saved-queries/${params.savedQueryId}/detail/`;
        } else if (params.expertRequestId) {
          apiUrl = `${backendUrl}/api/expert-requests/${params.expertRequestId}/report-data/`;
        }
        
        if (!apiUrl) {
          setExpertResponseLoading(false);
          return;
        }

        const res = await fetch(apiUrl, { credentials: 'include' });
        if (!res.ok) {
          setExpertResponseLoading(false);
          return;
        }
        
        const data = await res.json();
        
        // API yanıt formatına göre yanıtları al
        let responses: ExpertResponseData[] = [];
        if (params.savedQueryId && data.responses) {
          responses = data.responses;
        } else if (params.expertRequestId && data.success && data.data?.responses) {
          responses = data.data.responses;
        }
        
        setExpertResponses(responses);
      } catch (e) {
        console.error('[report_mobil_viewver] Uzman yanıtları yüklenemedi:', e);
      } finally {
        setExpertResponseLoading(false);
      }
    };

    loadExpertResponses();
  }, [isExpertRequestSource, params.savedQueryId, params.expertRequestId, backendUrl]);

  // Tab render fonksiyonları
  const renderYanitTab = () => {
    if (expertResponseLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accentBlue} />
          <Text style={styles.muted}>Yanıtlar yükleniyor...</Text>
        </View>
      );
    }

    if (expertResponses.length === 0) {
      return (
        <View style={[styles.center, { paddingVertical: 60 }]}>
          <Ionicons name="hourglass-outline" size={48} color="#fbbf24" />
          <Text style={{ fontSize: 16, color: '#fbbf24', marginTop: 12 }}>Yanıt bekleniyor...</Text>
          <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>Uzman görüşü henüz gönderilmedi.</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {expertResponses.map((r, idx) => (
          <View key={r.id || idx} style={[styles.card, { marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: '#3b82f6',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  {r.expert?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontWeight: '600', color: '#1f2937', fontSize: 15 }}>
                  {r.expert?.fullName || 'Uzman'}
                </Text>
                {r.approvedAt && (
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(r.approvedAt).toLocaleDateString('tr-TR')}
                  </Text>
                )}
              </View>
            </View>

            {/* Anket Soruları */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Yakında satılan benzer arazi var mı?</Text>
              <Text style={{ color: '#1f2937', fontSize: 14 }}>
                {r.surveyAnswers?.similar_sale_exists ? 'Evet' : 'Hayır'}
              </Text>
            </View>
            
            {r.surveyAnswers?.emsal_ada_parsel?.entries && r.surveyAnswers.emsal_ada_parsel.entries.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Satılan Araziler</Text>
                {r.surveyAnswers.emsal_ada_parsel.entries.map((entry: any, idx: number) => (
                  <View key={idx} style={{ backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6, marginTop: 4, borderLeftWidth: 3, borderLeftColor: '#22c55e' }}>
                    <Text style={{ color: '#1f2937', fontSize: 14 }}>
                      <Text style={{ fontWeight: '700' }}>{entry.ada}/{entry.parsel}</Text>
                      {entry.alan ? ` - ${Number(entry.alan).toLocaleString('tr-TR')} m²` : ''}
                      {entry.fiyat ? ` - ${Number(entry.fiyat).toLocaleString('tr-TR')} TL` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {r.surveyAnswers?.special_conditions && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Özel koşullar</Text>
                <Text style={{ color: '#1f2937', fontSize: 14 }}>{r.surveyAnswers.special_conditions}</Text>
              </View>
            )}

            {r.surveyAnswers?.is_low_terrain && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Arazi çukur mu?</Text>
                <Text style={{ color: '#1f2937', fontSize: 14 }}>{r.surveyAnswers.is_low_terrain}</Text>
              </View>
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Uzman Açıklaması</Text>
              <Text style={{ color: '#1f2937', fontSize: 14, lineHeight: 22 }}>{r.responseText || '-'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderResimlerTab = () => {
    if (allImages.length === 0) {
      return (
        <View style={[styles.center, { paddingVertical: 60 }]}>
          <Ionicons name="images-outline" size={48} color="#64748b" />
          <Text style={{ fontSize: 16, color: '#94a3b8', marginTop: 12 }}>Henüz resim yok</Text>
        </View>
      );
    }

    const currentImage = allImages[currentImageIndex];
    
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {/* Image */}
          <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {currentImage && (
              <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                {/* React Native Image component would be used here */}
                <Text style={{ color: '#fff', fontSize: 13 }}>Resim {currentImageIndex + 1} / {allImages.length}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{currentImage}</Text>
              </View>
            )}
          </View>
          
          {/* Navigation */}
          {allImages.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
              <TouchableOpacity
                onPress={() => setCurrentImageIndex(i => (i - 1 + allImages.length) % allImages.length)}
                style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 22, marginRight: 16 }}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              {/* Dots */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {allImages.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setCurrentImageIndex(i)}
                    style={{
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: i === currentImageIndex ? '#3b82f6' : '#64748b'
                    }}
                  />
                ))}
              </View>
              
              <TouchableOpacity
                onPress={() => setCurrentImageIndex(i => (i + 1) % allImages.length)}
                style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 22, marginLeft: 16 }}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top, height: 54 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Rapor
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleSharePdf}
            style={styles.headerBtn}
            accessibilityLabel="PDF Rapor Paylaş"
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <ActivityIndicator size="small" color="#f8fafc" />
            ) : (
              <Ionicons name="share-social-outline" size={18} color="#f8fafc" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const ppValue = kmProparcelValue ?? keys.proparcel_value;
              if (ppValue == null) {
                Alert.alert(
                  'Uzman Görüşü',
                  'Bu rapor için mahalle bilgisi bulunamadı. Lütfen yeni bir sorgu yaparak raporu tekrar oluşturun.',
                  [{ text: 'Tamam' }]
                );
                return;
              }
              router.push({
                pathname: 'report-expert-request',
                params: {
                  il: summary.il !== '-' ? summary.il : undefined,
                  ilce: summary.ilce !== '-' ? summary.ilce : undefined,
                  mahalle: summary.mahalle !== '-' ? summary.mahalle : undefined,
                  ada: summary.ada !== '-' ? summary.ada : undefined,
                  parsel: summary.parsel !== '-' ? summary.parsel : undefined,
                  tkgm_value: keys.tkgm_value != null ? String(keys.tkgm_value) : undefined,
                  proparcel_value: String(ppValue),
                  cacheId: params.cacheId ?? undefined,
                },
              });
            }}
            style={[styles.headerBtn, styles.headerBtnUzman]}
            accessibilityLabel="Uzman Görüşü"
          >
            <Ionicons name="chatbubbles-outline" size={18} color="#f8fafc" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#f8fafc' }}>Uzman Görüşü</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Uzman Talebi Sekmeleri (source_type='expert_request' için) */}
      {isExpertRequestSource && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'rapor' && styles.tabItemActive]}
            onPress={() => setActiveTab('rapor')}
          >
            <Ionicons name="document-text-outline" size={18} color={activeTab === 'rapor' ? '#3b82f6' : '#64748b'} />
            <Text style={[styles.tabItemText, activeTab === 'rapor' && styles.tabItemTextActive]}>Rapor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'yanit' && styles.tabItemActive, { borderColor: '#22c55e' }]}
            onPress={() => setActiveTab('yanit')}
          >
            <Ionicons name="chatbubble-outline" size={18} color={activeTab === 'yanit' ? '#22c55e' : '#64748b'} />
            <Text style={[styles.tabItemText, activeTab === 'yanit' && { color: '#22c55e' }]}>Yanıt</Text>
            {expertResponses.length > 0 && (
              <View style={{ backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{expertResponses.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'resimler' && styles.tabItemActive, { borderColor: '#22c55e' }]}
            onPress={() => setActiveTab('resimler')}
          >
            <Ionicons name="images-outline" size={18} color={activeTab === 'resimler' ? '#22c55e' : '#64748b'} />
            <Text style={[styles.tabItemText, activeTab === 'resimler' && { color: '#22c55e' }]}>Resimler</Text>
            {allImages.length > 0 && (
              <View style={{ backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{allImages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accentBlue} />
          <Text style={styles.muted}>Rapor hazırlanıyor…</Text>
        </View>
      ) : isExpertRequestSource && activeTab === 'yanit' ? (
        renderYanitTab()
      ) : isExpertRequestSource && activeTab === 'resimler' ? (
        renderResimlerTab()
      ) : (
        <View style={styles.body}>
          <ScrollView contentContainerStyle={[styles.bodyContent, { paddingBottom: 12 + (insets.bottom || 0) + 24 }]}>
            {(summary.il !== '-' || summary.ilce !== '-' || summary.mahalle !== '-' || summary.ada !== '-' || summary.parsel !== '-') && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Konum</Text>
                <Text style={[styles.locationHeaderText, { marginTop: 4 }]}>
                  {[summary.il, summary.ilce, summary.mahalle, summary.ada, summary.parsel].filter((x) => x && x !== '-').join(', ')}
                </Text>
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Fiyat</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.k}>Birim</Text>
                  <Text style={styles.v}>{formatTurkishPrice(priceSnapshot.unit_price)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.k}>Toplam</Text>
                  <Text style={styles.v}>{formatTurkishPrice(priceSnapshot.total_price)}</Text>
                </View>
              </View>
            </View>

            {/* ── Fiyat Değerlendirmesi Kartı ── */}
            {derived.priceComment != null && (
              <View style={[styles.card, pcStyles.cardBorder]}>
                <Text style={styles.cardTitle}>Fiyat Değerlendirmesi</Text>
                {derived.priceComment.lines.map((line: string, i: number) => (
                  <Text key={`pc-${i}`} style={pcStyles.line}>{line}</Text>
                ))}
                {derived.priceComment.isRamsar && derived.priceComment.ramsarText && (
                  <Text style={pcStyles.ramsarLine}>⚠️ {derived.priceComment.ramsarText}</Text>
                )}
              </View>
            )}

            {/* ── Villa Değerleme Kartı ── */}
            {derived.villaResult != null && (
              <View style={[styles.card, vfStyles.cardHighlight]}>
                <Text style={styles.cardTitle}>Villa Değerleme</Text>
                {/* Uyarılar */}
                {(derived.villaResult.warnings || []).map((w: any, i: number) => (
                  <View key={`vw-${i}`} style={vfStyles.warningBox}>
                    <Text style={vfStyles.warningText}>{typeof w === 'string' ? w : (w?.warning || JSON.stringify(w))}</Text>
                  </View>
                ))}
                {/* Özet satırları */}
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.summaryLabel}>Arsa Değeri</Text>
                  <Text style={vfStyles.summaryValue}>{fmtTL(derived.villaResult.arsa_total_tl)}</Text>
                </View>
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.summaryLabel}>Villa Yapı Maliyeti</Text>
                  <Text style={vfStyles.summaryValue}>{fmtTL(derived.villaResult.villa_cost_tl)}</Text>
                </View>
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.summaryLabel}>
                    Yaş Bonusu{' '}
                    <Text style={vfStyles.summaryHint}>(x{fmtNum(derived.villaResult.age_multiplier, 2)} × arsa)</Text>
                  </Text>
                  <Text style={vfStyles.summaryValue}>{fmtTL(derived.villaResult.age_bonus_tl)}</Text>
                </View>
                <View style={vfStyles.dividerThick} />
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.totalLabel}>TOPLAM VİLLA BEDELİ</Text>
                  <Text style={vfStyles.totalValue}>{fmtTL(derived.villaResult.villa_final_total_tl)}</Text>
                </View>
                <Text style={vfStyles.formulaHint}>= arsa + villa maliyeti + yaş bonusu</Text>

                {/* Villa Özellikleri */}
                <View style={vfStyles.propsSection}>
                  <Text style={[styles.cardTitle, { marginTop: 14 }]}>Villa Özellikleri</Text>
                  <View style={vfStyles.propsCard}>
                    {derived.villaResult.villa_engine_result?.base_cost_tl != null && derived.villaResult.villa_engine_result?.unit_price_tl != null && derived.villaResult.villa_engine_result.unit_price_tl > 0 && (
                      <View style={vfStyles.propRow}>
                        <Text style={vfStyles.propLabel}>İnşaat Alanı</Text>
                        <Text style={vfStyles.propValue}>{fmtNum(derived.villaResult.villa_engine_result.base_cost_tl / derived.villaResult.villa_engine_result.unit_price_tl, 0)} m²</Text>
                      </View>
                    )}
                    {derived.villaResult.villa_engine_result?.subtype_code_used && (
                      <View style={vfStyles.propRow}>
                        <Text style={vfStyles.propLabel}>Boyut Bandı</Text>
                        <Text style={vfStyles.propValue}>{SUBTYPE_LABELS[derived.villaResult.villa_engine_result.subtype_code_used] || derived.villaResult.villa_engine_result.subtype_code_used}</Text>
                      </View>
                    )}
                    {derived.villaResult.villa_engine_result?.unit_price_tl != null && (
                      <View style={vfStyles.propRow}>
                        <Text style={vfStyles.propLabel}>Birim Fiyat</Text>
                        <Text style={vfStyles.propValue}>{fmtTL(derived.villaResult.villa_engine_result.unit_price_tl)}/m²</Text>
                      </View>
                    )}
                    <View style={vfStyles.propRow}>
                      <Text style={vfStyles.propLabel}>Kalite Seviyesi</Text>
                      <Text style={vfStyles.propValue}>{QUALITY_LABELS[derived.villaResult.quality_level] || derived.villaResult.quality_level || 'Standart'}</Text>
                    </View>
                    <View style={vfStyles.propRow}>
                      <Text style={vfStyles.propLabel}>Bina Yaşı</Text>
                      <Text style={vfStyles.propValue}>{fmtNum(derived.villaResult.building_age, 0)} yıl</Text>
                    </View>
                    <View style={vfStyles.propRow}>
                      <Text style={vfStyles.propLabel}>Yaş Çarpanı (0-12 yıl)</Text>
                      <Text style={vfStyles.propValue}>{fmtNum(derived.villaResult.age_multiplier, 2)}</Text>
                    </View>
                    <View style={vfStyles.propRow}>
                      <Text style={vfStyles.propLabel}>Havuz</Text>
                      <Text style={[vfStyles.propValue, { color: derived.villaResult.has_pool ? '#0ea5e9' : '#94a3b8' }]}>
                        {derived.villaResult.has_pool ? 'Evet' : 'Hayır'}
                      </Text>
                    </View>
                    <View style={[vfStyles.propRow, { borderBottomWidth: 0 }]}>
                      <Text style={vfStyles.propLabel}>Peyzaj / Çevre Düzenlemesi</Text>
                      <Text style={[vfStyles.propValue, { color: derived.villaResult.has_landscape ? '#22c55e' : '#94a3b8' }]}>
                        {derived.villaResult.has_landscape ? 'Evet' : 'Hayır'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ── Fabrika Değerleme Kartı ── */}
            {derived.factoryResult != null && (
              <View style={[styles.card, vfStyles.cardHighlightFactory]}>
                <Text style={styles.cardTitle}>Fabrika Değerleme</Text>
                {/* Uyarılar */}
                {(derived.factoryResult.warnings || []).map((w: any, i: number) => (
                  <View key={`fw-${i}`} style={vfStyles.warningBox}>
                    <Text style={vfStyles.warningText}>{typeof w === 'string' ? w : (w?.warning || JSON.stringify(w))}</Text>
                  </View>
                ))}
                {/* Türetilmiş baz fiyat uyarısı */}
                {derived.factoryResult.cost_engine_result?.is_derived_base && (
                  <View style={vfStyles.derivedBox}>
                    <Text style={vfStyles.derivedText}>Yaklaşık / Türetilmiş Baz Fiyat — Kaynak: {derived.factoryResult.cost_engine_result.derived_from || '?'}</Text>
                  </View>
                )}
                {/* Özet satırları */}
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.summaryLabel}>Arsa Değeri</Text>
                  <Text style={vfStyles.summaryValue}>{fmtTL(derived.factoryResult.arsa_total_tl)}</Text>
                </View>
                <View style={vfStyles.dividerThin} />
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.summaryLabel}>Fabrika Yapı Maliyeti</Text>
                  <Text style={vfStyles.summaryValue}>{fmtTL(derived.factoryResult.adjusted_factory_cost_tl)}</Text>
                </View>
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.summaryLabel}>Fabrika Yaşı</Text>
                  <Text style={vfStyles.summaryValue}>{fmtNum(derived.factoryResult.factory_age, 0)} yıl</Text>
                </View>
                <View style={vfStyles.dividerThick} />
                <View style={vfStyles.summaryRow}>
                  <Text style={vfStyles.totalLabel}>TOPLAM FABRİKA BEDELİ</Text>
                  <Text style={vfStyles.totalValue}>{fmtTL(derived.factoryResult.factory_final_total_tl)}</Text>
                </View>

                {/* Fabrika Özellikleri */}
                {(() => {
                  const breakdown = derived.factoryResult.cost_engine_result?.breakdown || [];
                  const paramEntries = breakdown.filter((b: CostEngineBreakdownItem) =>
                    b.param_code && b.param_code !== '_DERIVED_BASE' && b.input != null
                  );
                  if (paramEntries.length === 0) return null;
                  return (
                    <View style={vfStyles.propsSection}>
                      <Text style={[styles.cardTitle, { marginTop: 14 }]}>Fabrika Özellikleri</Text>
                      <View style={vfStyles.propsCardFactory}>
                        {paramEntries.map((b: CostEngineBreakdownItem, i: number) => (
                          <View key={`fp-${i}`} style={[vfStyles.propRow, i === paramEntries.length - 1 && { borderBottomWidth: 0 }]}>
                            <Text style={vfStyles.propLabelFactory}>{FACTORY_PARAM_LABELS[b.param_code!] || b.param_code}</Text>
                            <Text style={vfStyles.propValue}>{trFactoryValue(b.param_code!, b.input)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Detaylı Fiyat Analizi</Text>
              {derived.dfaRows.length === 0 ? (
                <Text style={styles.note}>DFA verisi yok.</Text>
              ) : (
                <View style={styles.dfaTable}>
                  {derived.dfaRows.map((r: any, idx: number) => (
                    <View key={idx} style={{}}>
                      <View
                        style={[
                          styles.dfaRow,
                          r.kind === 'inc' && styles.dfaRowInc,
                          r.kind === 'dec' && styles.dfaRowDec,
                          r.kind === 'warn' && styles.dfaRowWarn,
                          r.kind === 'initial' && styles.dfaRowInitial,
                        ]}
                      >
                        <Text style={[styles.dfaCell, styles.dfaCellDescOnly]}>
                          {r.desc}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Ekran görüntüsü paylaşma kaldırıldı — paylaş butonu artık doğrudan PDF oluşturup paylaşıyor */}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.pageBg },
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
  headerBtnUzman: {
    width: undefined,
    minWidth: 36,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerBtnPdf: {
    width: undefined,
    minWidth: 36,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderColor: 'rgba(59,130,246,0.55)',
  },
  headerTitle: { flex: 1, color: '#fff', fontWeight: 'bold', fontSize: 20, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  tabsBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: COLORS.brandNavy,
    borderColor: COLORS.brandNavy,
  },
  tabText: { color: COLORS.brandNavy, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: COLORS.textOnDark },
  // Uzman Yanıtı Sekmeleri
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#3b82f6',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabItemTextActive: {
    color: '#3b82f6',
  },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: COLORS.cardBg,
    padding: 12,
  },
  cardTitle: { color: COLORS.brandNavy, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  locationHeaderText: { color: COLORS.brandNavy, fontSize: 13, lineHeight: 20 },
  value: { color: COLORS.brandNavy, fontSize: 13, fontWeight: '700' },
  meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  k: { color: COLORS.textMuted, fontSize: 11 },
  v: { color: COLORS.brandNavy, fontSize: 16, fontWeight: '900', marginTop: 4 },
  note: { color: COLORS.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  summaryBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.brandNavy, fontWeight: '800', fontSize: 13 },
  primaryBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.brandNavy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: { color: COLORS.textOnDark, fontWeight: '900', fontSize: 14 },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  stepKey: { width: 90, color: COLORS.brandNavy, fontWeight: '900', fontSize: 12 },
  stepVal: { flex: 1, color: COLORS.textMuted, fontSize: 12, lineHeight: 16 },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapBottomBarWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  mapBottomBar: {
    flexDirection: 'row',
    gap: 10,
  },
  mapGroupBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapGroupBtnActive: {
    backgroundColor: COLORS.brandNavy,
    borderColor: COLORS.brandNavy,
  },
  mapGroupBtnText: { color: COLORS.brandNavy, fontWeight: '900', fontSize: 13 },
  mapGroupBtnTextActive: { color: COLORS.textOnDark },
  mapDropdown: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  mapDropdownItem: {
    height: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mapDropdownText: { color: COLORS.brandNavy, fontWeight: '800', fontSize: 13 },
  mapHint: {
    marginTop: 10,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapHintText: { color: COLORS.textOnDark, fontWeight: '800', fontSize: 12 },

  // Map bottom sheet (info + layer controls)
  sheetOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheetDragZone: {
    // hem handle hem header'dan sürükle-kapat için
  },
  dragHandleZone: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  dragHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.18)',
  },
  sheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 12,
  },
  sheetHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sheetTitle: { color: COLORS.brandNavy, fontWeight: '900', fontSize: 14 },
  sheetSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  sheetBody: { padding: 14, gap: 12 },
  sheetSection: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  sheetSectionTitle: { color: COLORS.brandNavy, fontWeight: '900', fontSize: 13, marginBottom: 10 },
  sheetMuted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },

  kvRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  kvK: { color: COLORS.textMuted, fontSize: 12, flex: 1 },
  kvV: { color: COLORS.brandNavy, fontSize: 12, fontWeight: '800', flex: 1, textAlign: 'right' },

  toggleRow: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  toggleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 },
  toggleDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  toggleLabel: { color: COLORS.brandNavy, fontWeight: '800', fontSize: 12, flex: 1 },
  togglePill: {
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  togglePillOn: { backgroundColor: COLORS.brandNavy, borderColor: COLORS.brandNavy },
  togglePillText: { color: COLORS.textMuted, fontWeight: '900', fontSize: 11 },
  togglePillTextOn: { color: COLORS.textOnDark },

  barsRow: { paddingVertical: 4, gap: 10, paddingRight: 8, flexDirection: 'row' },
  barCol: { width: 46, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: 18, height: 130, borderRadius: 9, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#2563eb', borderRadius: 9 },
  barYear: { marginTop: 8, color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  barVal: { marginTop: 2, color: COLORS.brandNavy, fontSize: 10, fontWeight: '900' },

  simpleTable: { borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  simpleRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff' },
  simpleCellL: { flex: 1, color: COLORS.brandNavy, fontWeight: '900', fontSize: 12 },
  simpleCellR: { width: 70, color: COLORS.brandNavy, fontWeight: '800', fontSize: 12, textAlign: 'right' },

  kmTable: { borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  kmRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff' },
  kmHeader: { backgroundColor: '#111827' },
  kmCell: { color: COLORS.brandNavy, fontSize: 11 },
  kmCellHeader: { color: '#ffffff' },
  kmCellMah: { width: 180, marginRight: 10, color: COLORS.brandNavy, fontWeight: '900' },
  kmCellNum: { width: 80, textAlign: 'right', color: COLORS.brandNavy, fontWeight: '900' },
  dfaTable: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  dfaRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    gap: 10,
  },
  dfaCell: {
    color: COLORS.brandNavy,
    fontSize: 11,
  },
  dfaCellDescOnly: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.brandNavy, lineHeight: 18, flexWrap: 'wrap' },
  dfaRowInc: { backgroundColor: '#ecfdf5' },
  dfaRowDec: { backgroundColor: '#fef2f2' },
  dfaRowWarn: { backgroundColor: '#fffbeb' },
  dfaRowInitial: { backgroundColor: '#eff6ff' },
  menuOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-start' },
  menuDragZone: {
    // menünün en üst kısmı "tut & çek" alanı
    paddingTop: 2,
    paddingBottom: 6,
  },
  menuCard: {
    marginTop: 54,
    marginHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  menuTitle: { color: '#e2e8f0', fontWeight: '900', fontSize: 14, marginBottom: 10, paddingHorizontal: 12, paddingTop: 10 },
  menuItem: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  menuItemText: { color: '#e2e8f0', fontWeight: '800', fontSize: 13 },
});

// ── Fiyat Değerlendirmesi Kart Stilleri ──
const pcStyles = StyleSheet.create({
  cardBorder: {
    borderColor: '#22c55e',
    borderWidth: 1.5,
  },
  line: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  ramsarLine: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
});

// ── Villa / Fabrika Değerleme Kart Stilleri ──
const vfStyles = StyleSheet.create({
  // Kart vurgu kenarları
  cardHighlight: {
    borderColor: '#0ea5e9',
    borderWidth: 2,
  },
  cardHighlightFactory: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  // Uyarı kutusu
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  warningText: {
    color: '#92400e',
    fontSize: 12,
    lineHeight: 16,
  },
  // Türetilmiş baz fiyat kutusu
  derivedBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  derivedText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  // Özet satırları
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  summaryLabel: {
    color: '#475569',
    fontSize: 13,
    flex: 1,
  },
  summaryHint: {
    fontSize: 11,
    color: '#94a3b8',
  },
  summaryValue: {
    color: COLORS.brandNavy,
    fontSize: 13,
    fontWeight: '700',
  },
  // Ayraçlar
  dividerThin: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  dividerThick: {
    height: 2,
    backgroundColor: '#cbd5e1',
    marginVertical: 10,
  },
  // Toplam satır
  totalLabel: {
    color: COLORS.brandNavy,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  totalValue: {
    color: '#0ea5e9',
    fontSize: 17,
    fontWeight: '900',
  },
  formulaHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },
  // Özellik bölümü
  propsSection: {
    marginTop: 4,
  },
  propsCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  propsCardFactory: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  propLabel: {
    color: '#0369a1',
    fontSize: 13,
    flex: 1,
  },
  propLabelFactory: {
    color: '#1d4ed8',
    fontSize: 13,
    flex: 1,
  },
  propValue: {
    color: COLORS.brandNavy,
    fontSize: 13,
    fontWeight: '700',
  },
});

