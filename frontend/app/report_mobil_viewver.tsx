import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, ActivityIndicator, Alert, StatusBar, Modal, TouchableWithoutFeedback, Animated, PanResponder, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProParcelResponse } from './types/parcelResponse';
import { getReportMemory } from './utils/reportMemory';
import { formatTurkishPrice } from './utils/priceParser';
import { ParcelModalContent } from '../components/ParcelModalContent';
import ShareModal from '../components/ShareModal';
import StreetViewModal from '../components/StreetViewModal';
import { getFirstStreetViewPoint } from './utils/streetViewHelper';
import { createShareHandler } from './utils/handlers/shareHandler';
import { CombinedScreenshotContainer } from './components/CombinedScreenshotContainer';
import { API_URL } from "../config/api";

// Conditional Mapbox import (same pattern as index)
let Mapbox: any = null;
try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
  if (Mapbox && Mapbox.setAccessToken) {
    try {
      const { MAPBOX_ACCESS_TOKEN } = require('../config/mapbox');
      Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    } catch (tokenError) {
      console.warn('[report_mobil_viewver] Mapbox token yüklenemedi:', tokenError);
    }
  }
} catch (e) {
  console.warn('[report_mobil_viewver] Mapbox native module not available.', e);
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
};

type TabKey = 'summary' | 'map' | 'street';

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
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value)
    .replace(/\s/g, '')
    .replace(/m²|m2/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
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

function extractGeometryFromAny(input: any): any | null {
  if (!input) return null;
  if (input.type === 'FeatureCollection' && Array.isArray(input.features) && input.features.length) {
    return input.features[0]?.geometry || null;
  }
  if (input.type === 'Feature' && input.geometry) return input.geometry;
  if (input.type && input.coordinates) return input;
  return null;
}

function toFeatureCollection(geometry: any, properties: Record<string, any> = {}): any {
  const normalizedGeom = normalizeGeoJsonForMapbox(geometry);
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties, geometry: normalizedGeom }],
  };
}

function toMapboxShape(input: any): any | null {
  if (!input) return null;
  if (input.type === 'FeatureCollection') return normalizeGeoJsonForMapbox(input);
  if (input.type === 'Feature') return normalizeGeoJsonForMapbox(input);
  const g = extractGeometryFromAny(input);
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

function countGeo(val: any): number {
  try {
    if (!val) return 0;
    if (Array.isArray(val)) return val.length;
    if (val.type === 'FeatureCollection' && Array.isArray(val.features)) return val.features.length;
    if (val.type === 'Feature' && val.geometry) return 1;
    if (val.type && val.coordinates) return 1;
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

function fmtPercentSmartTr(val: any, digits: number = 1): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '-';
  return `%${n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function ReportMobilViewver() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProParcelResponse | null>(null);
  const [tab, setTab] = useState<TabKey>('summary');

  // Share
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const [capturedMapUri, setCapturedMapUri] = useState<string | null>(null);
  const [capturedModalUri, setCapturedModalUri] = useState<string | null>(null);

  // Street view
  const [streetViewModalVisible, setStreetViewModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const reportMenuTranslateY = useRef(new Animated.Value(0)).current;
  const reportMenuClosingRef = useRef(false);

  // Map UI (Parsel/Mahalle dropdown + bilgi paneli)
  const [mapGroup, setMapGroup] = useState<'parcel' | 'quarter'>('parcel');
  const [parcelMenuOpen, setParcelMenuOpen] = useState(false);
  const [quarterMenuOpen, setQuarterMenuOpen] = useState(false);
  const [mapPanel, setMapPanel] = useState<MapPanelKey>('none');
  const [mapPanelVisible, setMapPanelVisible] = useState(false);
  const mapPanelTranslateY = useRef(new Animated.Value(0)).current;
  const mapPanelClosingRef = useRef(false);
  const mapPanelScrollYRef = useRef(0);
  const mapPanelScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (menuVisible) {
      reportMenuClosingRef.current = false;
      reportMenuTranslateY.setValue(0);
    }
  }, [menuVisible, reportMenuTranslateY]);

  useEffect(() => {
    if (mapPanelVisible) {
      mapPanelClosingRef.current = false;
      mapPanelTranslateY.setValue(0);
      // Panel açılınca drag her yerden çalışsın diye scroll state'i sıfırla
      mapPanelScrollYRef.current = 0;
      // İçeriği en üste çek (önceki panelden kalan scroll, drag'i kilitlemesin)
      setTimeout(() => {
        try {
          mapPanelScrollRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch {
          // ignore
        }
      }, 0);
    }
  }, [mapPanelTranslateY, mapPanelVisible]);

  const animateReportMenuClose = useCallback(() => {
    if (reportMenuClosingRef.current) return;
    reportMenuClosingRef.current = true;
    Animated.timing(reportMenuTranslateY, {
      toValue: WINDOW_HEIGHT,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setMenuVisible(false);
    });
  }, [reportMenuTranslateY]);

  const animateMapPanelClose = useCallback(() => {
    if (mapPanelClosingRef.current) return;
    mapPanelClosingRef.current = true;
    Animated.timing(mapPanelTranslateY, {
      toValue: WINDOW_HEIGHT,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setMapPanelVisible(false);
    });
  }, [mapPanelTranslateY]);

  const reportMenuPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          reportMenuTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
        if (shouldClose) {
          animateReportMenuClose();
          return;
        }
        Animated.spring(reportMenuTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(reportMenuTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [animateReportMenuClose, reportMenuTranslateY]);

  const mapPanelSheetPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          mapPanelTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
        if (shouldClose) {
          animateMapPanelClose();
          return;
        }
        Animated.spring(mapPanelTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(mapPanelTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [animateMapPanelClose, mapPanelTranslateY]);

  // Sheet'in her yerinden (toggle satırları dahil) aşağı çekip kapatabilmek için:
  // - sadece aşağı yönlü swipe'ta devreye gir
  // - kullanıcı neresinden tutarsa tutsun çalışsın (satır bazlı değil)
  const mapPanelCardPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return gestureState.dy > 6 && gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 6 && gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        setIsSheetDragging(true);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          mapPanelTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
        if (shouldClose) {
          animateMapPanelClose();
          return;
        }
        Animated.spring(mapPanelTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => setIsSheetDragging(false));
      },
      onPanResponderTerminate: () => {
        Animated.spring(mapPanelTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => setIsSheetDragging(false));
      },
    });
  }, [animateMapPanelClose, mapPanelTranslateY]);

  const mapPanelListPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        if (mapPanelScrollYRef.current > 0) return false;
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (mapPanelScrollYRef.current > 0) return false;
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          mapPanelTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
        if (shouldClose) {
          animateMapPanelClose();
          return;
        }
        Animated.spring(mapPanelTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(mapPanelTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [animateMapPanelClose, mapPanelTranslateY]);

  const [layerVis, setLayerVis] = useState(() => ({
    // Quarter
    quarter_polygon: false,
    boundary_polygon: false,
    quarter_slope_poly_0_20: false,
    quarter_slope_poly_20_30: false,
    quarter_slope_poly_over_30: false,

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
  // Toggle basılıyken ScrollView scroll'unu kısa süreli kapatıyoruz.
  const [isTogglePressing, setIsTogglePressing] = useState(false);
  // Sheet drag aktifken ScrollView scroll'u kapat (gesture çakışmasın)
  const [isSheetDragging, setIsSheetDragging] = useState(false);

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

    // Build DFA rows from valuation steps (web viewer logic but native)
    const dfaRows = (() => {
      const steps = valuationSteps;
      if (!Array.isArray(steps) || steps.length === 0) return [];
      const rows: Array<{
        desc: string;
        kind: 'initial' | 'inc' | 'dec' | 'warn' | 'neutral';
        details: string[] | null;
      }> = [];

      const first = steps[0] || {};
      const initAvg = Number(first.prev_avg);
      const initTotal =
        first.prev_total != null
          ? Number(first.prev_total)
          : (Number.isFinite(areaM2) && areaM2 > 0 && Number.isFinite(initAvg) ? initAvg * areaM2 : Number.NaN);
      if (Number.isFinite(initAvg)) {
        const initDesc = String(first.note || first.title || 'Başlangıç');
        rows.push({
          desc: initDesc,
          kind: 'initial',
          details: null,
        });
      }

      for (let i = 1; i < steps.length; i++) {
        const it = steps[i] || {};
        const desc = String(it.note || it.title || it.key || 'Adım');
        const pct = pctTextFromFactors(it.applied_factor);
        const newAvg = Number(it.new_avg);
        let newTotal = it.new_total != null ? Number(it.new_total) : Number.NaN;
        if (!Number.isFinite(newTotal) && Number.isFinite(areaM2) && areaM2 > 0 && Number.isFinite(newAvg)) {
          newTotal = newAvg * areaM2;
        }

        const f = Number(it.applied_factor);
        let kind: 'inc' | 'dec' | 'warn' | 'neutral' = 'neutral';
        const dl = desc.toLowerCase();
        if (dl.includes('uyarı') || dl.includes('sarı')) kind = 'warn';
        else if (Number.isFinite(f) && f > 1) kind = 'inc';
        else if (Number.isFinite(f) && f < 1) kind = 'dec';
        else if (pct.startsWith('+')) kind = 'inc';
        else if (pct.startsWith('-')) kind = 'dec';

        rows.push({
          desc,
          kind,
          details: (() => {
            try {
              const d = it.details;
              if (!Array.isArray(d) || d.length === 0) return null;
              const msgs = d
                .map((x: any) => {
                  if (x && typeof x === 'object') return String(x.message || x.code || JSON.stringify(x));
                  return String(x);
                })
                .map((s: string) => s.trim())
                .filter(Boolean);
              return msgs.length ? msgs : null;
            } catch {
              return null;
            }
          })(),
        });
      }

      return rows;
    })();

    return { pd, pv, polygons, parcelGeom, parcelDataForShare, valuationSteps, areaM2, dfaRows };
  }, [data, priceSnapshot.total_price, priceSnapshot.unit_price]);

  const setPresetAndOpenPanel = useCallback((panel: MapPanelKey) => {
    setMapPanel(panel);
    setMapPanelVisible(true);
    setParcelMenuOpen(false);
    setQuarterMenuOpen(false);
    mapPanelScrollYRef.current = 0;

    const isQuarter = panel === 'quarter_morphology' || panel === 'quarter_sales' || panel === 'km_analysis';
    setMapGroup(isQuarter ? 'quarter' : 'parcel');

    const off = {
      quarter_polygon: false,
      boundary_polygon: false,
      quarter_slope_poly_0_20: false,
      quarter_slope_poly_20_30: false,
      quarter_slope_poly_over_30: false,
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
        };
      }
      if (panel === 'quarter_sales') {
        return { ...off, quarter_polygon: true };
      }
      if (panel === 'km_analysis') {
        return { ...off, quarter_polygon: true };
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

  const mapRef = useRef<any>(null);
  const combinedContainerRef = useRef<any>(null);
  const mapReadyRef = useRef({ didFinishLoadingMap: false, didFinishLoadingStyle: false, isIdle: false });
  const isSharingRef = useRef(false);

  const handleShare = useCallback(
    createShareHandler({
      parcelData: derived.parcelDataForShare,
      mapRef,
      combinedContainerRef,
      mapReadyRef,
      isSharingRef,
      setIsProcessingShare,
      setCapturedMapUri,
      setCapturedModalUri,
      setShareModalVisible,
    }),
    [derived.parcelDataForShare]
  );

  const fetchRerun = useCallback(async () => {
    if (!keys.tkgm_value || !keys.ada || !keys.parsel) {
      Alert.alert('Hata', 'Sorgu anahtar bilgileri eksik.');
      return;
    }
    const backendUrl = (API_URL || "").replace(/\/$/, "");

    setLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/api/mobile/rerun_parcel_info/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PP-Client': 'mobile' },
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
    // 1) İlk sorgudan geldiysek cache'den oku
    if (params.cacheId) {
      const cached = getReportMemory<ProParcelResponse>(String(params.cacheId));
      if (cached) {
        setData(cached);
        return;
      }
    }
    // 2) Cache yoksa: rerun (valuation skip)
    fetchRerun();
  }, [params.cacheId, fetchRerun]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top, height: 54 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color={COLORS.textOnDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Report Viewer (Mobil)
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShareModalVisible(true)}
            style={styles.headerBtn}
            accessibilityLabel="Paylaş"
            disabled={isProcessingShare}
          >
            <Ionicons name="share-social-outline" size={18} color={COLORS.textOnDark} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Yakında', 'PDF Kaydet özelliğini bir sonraki adımda ekleyeceğiz.')}
            style={styles.headerBtn}
            accessibilityLabel="PDF Kaydet"
          >
            <Ionicons name="document-text-outline" size={18} color={COLORS.textOnDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerBtn} accessibilityLabel="Menü">
            <Ionicons name="menu" size={20} color={COLORS.textOnDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsBar}>
        {([
          ['summary', 'Özet', 'information-circle-outline'],
          ['map', 'Harita', 'map-outline'],
          ['street', 'Street', 'navigate-outline'],
        ] as const).map(([k, label, icon]) => {
          const active = tab === k;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              activeOpacity={0.85}
            >
              <Ionicons name={icon as any} size={16} color={active ? COLORS.textOnDark : COLORS.brandNavy} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accentBlue} />
          <Text style={styles.muted}>Rapor hazırlanıyor…</Text>
        </View>
      ) : tab === 'map' ? (
        <View style={styles.mapWrap}>
          {!Mapbox ? (
            <View style={styles.center}>
              <Text style={styles.muted}>Mapbox modülü bulunamadı.</Text>
            </View>
          ) : !derived.parcelGeom ? (
            <View style={styles.center}>
              <Text style={styles.muted}>Parsel geometrisi yok.</Text>
            </View>
          ) : (
            <Mapbox.MapView
              ref={mapRef}
              style={styles.map}
              styleURL={Mapbox?.StyleURL?.Satellite}
              onDidFinishLoadingMap={() => (mapReadyRef.current.didFinishLoadingMap = true)}
              onDidFinishLoadingStyle={() => (mapReadyRef.current.didFinishLoadingStyle = true)}
              onMapIdle={() => (mapReadyRef.current.isIdle = true)}
            >
              <Mapbox.Camera
                zoomLevel={16}
                centerCoordinate={calcCenterFromPolygonGeom(derived.parcelGeom) || [29.0, 41.0]}
                animationDuration={600}
              />

              {/* Base parcel boundary (always visible as reference) */}
              <Mapbox.ShapeSource id="parcel-base" shape={toFeatureCollection(derived.parcelGeom, { kind: 'parcel' })}>
                <Mapbox.FillLayer id="parcel-base-fill" style={{ fillColor: COLORS.accentBlue, fillOpacity: 0.12 }} />
                <Mapbox.LineLayer id="parcel-base-line" style={{ lineColor: '#ffffff', lineWidth: 2 }} />
              </Mapbox.ShapeSource>

              {/* Overlay layers (toggle) */}
              {layerVis.quarter_polygon &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.quarter_polygon);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-quarter" shape={shape}>
                      <Mapbox.FillLayer id="layer-quarter-fill" style={{ fillColor: '#f97316', fillOpacity: 0.1 }} />
                      <Mapbox.LineLayer id="layer-quarter-line" style={{ lineColor: '#f97316', lineWidth: 3 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}

              {layerVis.boundary_polygon &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.boundary_polygon);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-boundary" shape={shape}>
                      <Mapbox.FillLayer id="layer-boundary-fill" style={{ fillColor: '#ffffff', fillOpacity: 0.08 }} />
                      <Mapbox.LineLayer id="layer-boundary-line" style={{ lineColor: '#ffffff', lineWidth: 3, lineOpacity: 0.9 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}

              {layerVis.quarter_slope_poly_0_20 &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.quarter_slope_poly_0_20);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-q-slope-0-20" shape={shape}>
                      <Mapbox.FillLayer id="layer-q-slope-0-20-fill" style={{ fillColor: '#22c55e', fillOpacity: 0.18 }} />
                      <Mapbox.LineLayer id="layer-q-slope-0-20-line" style={{ lineColor: '#22c55e', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}
              {layerVis.quarter_slope_poly_20_30 &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.quarter_slope_poly_20_30);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-q-slope-20-30" shape={shape}>
                      <Mapbox.FillLayer id="layer-q-slope-20-30-fill" style={{ fillColor: '#f59e0b', fillOpacity: 0.18 }} />
                      <Mapbox.LineLayer id="layer-q-slope-20-30-line" style={{ lineColor: '#f59e0b', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}
              {layerVis.quarter_slope_poly_over_30 &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.quarter_slope_poly_over_30);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-q-slope-over-30" shape={shape}>
                      <Mapbox.FillLayer id="layer-q-slope-over-30-fill" style={{ fillColor: '#ef4444', fillOpacity: 0.18 }} />
                      <Mapbox.LineLayer id="layer-q-slope-over-30-line" style={{ lineColor: '#ef4444', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}

              {(layerVis.near_roads_parallel || layerVis.near_roads_nearest || layerVis.near_roads_connector) && (
                <>
                  {layerVis.near_roads_parallel &&
                    (() => {
                      const shape = toMapboxShape(derived.polygons?.parallel_roads_multilinestring);
                      if (!shape) return null;
                      return (
                        <Mapbox.ShapeSource id="layer-near-roads-parallel" shape={shape}>
                          <Mapbox.LineLayer
                            id="layer-near-roads-parallel-line"
                            style={{ lineColor: '#e5e7eb', lineWidth: 1.5, lineOpacity: 0.9 }}
                          />
                        </Mapbox.ShapeSource>
                      );
                    })()}

                  {layerVis.near_roads_nearest &&
                    (() => {
                      const shape = toMapboxShape(derived.polygons?.nearest_road_field);
                      if (!shape) return null;
                      return (
                        <Mapbox.ShapeSource id="layer-near-roads-nearest" shape={shape}>
                          <Mapbox.LineLayer
                            id="layer-near-roads-nearest-line"
                            style={{ lineColor: '#fbbf24', lineWidth: 3.5, lineOpacity: 0.95 }}
                          />
                        </Mapbox.ShapeSource>
                      );
                    })()}

                  {layerVis.near_roads_connector &&
                    (() => {
                      const shape = toMapboxShape(derived.polygons?.nearest_road_field_connector);
                      if (!shape) return null;
                      return (
                        <Mapbox.ShapeSource id="layer-near-roads-connector" shape={shape}>
                          <Mapbox.LineLayer
                            id="layer-near-roads-connector-line"
                            style={{
                              lineColor: '#fbbf24',
                              lineWidth: 2,
                              lineOpacity: 0.9,
                              lineDasharray: [2, 2],
                            }}
                          />
                        </Mapbox.ShapeSource>
                      );
                    })()}
                </>
              )}

              {layerVis.electric &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.clipped_electric_multilinestring);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-electric" shape={shape}>
                      <Mapbox.LineLayer id="layer-electric-line" style={{ lineColor: '#a78bfa', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}

              {(layerVis.water_polygon || layerVis.waterway) && (
                <>
                  {layerVis.water_polygon &&
                    (() => {
                      const shape = toMapboxShape(derived.polygons?.water_polygon);
                      if (!shape) return null;
                      return (
                        <Mapbox.ShapeSource id="layer-water-poly" shape={shape}>
                          <Mapbox.FillLayer id="layer-water-fill" style={{ fillColor: '#38bdf8', fillOpacity: 0.22 }} />
                          <Mapbox.LineLayer id="layer-water-line" style={{ lineColor: '#38bdf8', lineWidth: 2 }} />
                        </Mapbox.ShapeSource>
                      );
                    })()}
                  {layerVis.waterway &&
                    (() => {
                      const shape = toMapboxShape(derived.polygons?.clipped_waterway_multilinestring);
                      if (!shape) return null;
                      return (
                        <Mapbox.ShapeSource id="layer-waterway-line" shape={shape}>
                          <Mapbox.LineLayer id="layer-waterway-line-style" style={{ lineColor: '#38bdf8', lineWidth: 2 }} />
                        </Mapbox.ShapeSource>
                      );
                    })()}
                </>
              )}

              {layerVis.parcel_slope_poly_0_20 &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.parcel_slope_poly_0_20);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-slope-0-20" shape={shape}>
                      <Mapbox.FillLayer id="layer-slope-0-20-fill" style={{ fillColor: '#22c55e', fillOpacity: 0.25 }} />
                      <Mapbox.LineLayer id="layer-slope-0-20-line" style={{ lineColor: '#22c55e', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}
              {layerVis.parcel_slope_poly_20_30 &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.parcel_slope_poly_20_30);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-slope-20-30" shape={shape}>
                      <Mapbox.FillLayer id="layer-slope-20-30-fill" style={{ fillColor: '#f59e0b', fillOpacity: 0.25 }} />
                      <Mapbox.LineLayer id="layer-slope-20-30-line" style={{ lineColor: '#f59e0b', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}
              {layerVis.parcel_slope_poly_over_30 &&
                (() => {
                  const shape = toMapboxShape(derived.polygons?.parcel_slope_poly_over_30);
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-slope-over-30" shape={shape}>
                      <Mapbox.FillLayer id="layer-slope-over-30-fill" style={{ fillColor: '#ef4444', fillOpacity: 0.25 }} />
                      <Mapbox.LineLayer id="layer-slope-over-30-line" style={{ lineColor: '#ef4444', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}

              {layerVis.view_primary &&
                (() => {
                  const shape = toMapboxShape(getByCaseInsensitive(derived.polygons, 'View_PRIMARY'));
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-view-primary" shape={shape}>
                      <Mapbox.FillLayer id="layer-view-primary-fill" style={{ fillColor: '#60a5fa', fillOpacity: 0.18 }} />
                      <Mapbox.LineLayer id="layer-view-primary-line" style={{ lineColor: '#60a5fa', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}
              {layerVis.view_r1 &&
                (() => {
                  const shape = toMapboxShape(getByCaseInsensitive(derived.polygons, 'View_R1'));
                  if (!shape) return null;
                  return (
                    <Mapbox.ShapeSource id="layer-view-r1" shape={shape}>
                      <Mapbox.FillLayer id="layer-view-r1-fill" style={{ fillColor: '#a78bfa', fillOpacity: 0.18 }} />
                      <Mapbox.LineLayer id="layer-view-r1-line" style={{ lineColor: '#a78bfa', lineWidth: 2 }} />
                    </Mapbox.ShapeSource>
                  );
                })()}

              {layerVis.labels && overlayLabelsFC?.features?.length > 0 && (
                <Mapbox.ShapeSource id="layer-labels" shape={overlayLabelsFC}>
                  <Mapbox.CircleLayer
                    id="layer-labels-dot"
                    style={{
                      circleRadius: 4,
                      circleColor: ['get', 'color'],
                      circleOpacity: 0.9,
                      circleStrokeWidth: 1,
                      circleStrokeColor: '#111827',
                    }}
                  />
                  <Mapbox.SymbolLayer
                    id="layer-labels-symbol"
                    style={{
                      textField: ['get', 'title'],
                      textSize: 12,
                      textColor: '#ffffff',
                      textHaloColor: '#111827',
                      textHaloWidth: 1.5,
                      // Çakışma azaltma: Mapbox kendi yerleşimini yapsın, gerekirse bazılarını gizlesin
                      textAllowOverlap: false,
                      textIgnorePlacement: false,
                      textOptional: true,
                      textAnchor: 'top',
                      textOffset: [0, 0.8],
                    }}
                  />
                </Mapbox.ShapeSource>
              )}

              {layerVis.city_center_line && centerLines.cityLine && (
                <Mapbox.ShapeSource id="layer-city-center-line" shape={centerLines.cityLine}>
                  <Mapbox.LineLayer id="layer-city-center-line-style" style={{ lineColor: '#3b82f6', lineWidth: 3, lineOpacity: 0.85 }} />
                </Mapbox.ShapeSource>
              )}
              {layerVis.town_center_line && centerLines.townLine && (
                <Mapbox.ShapeSource id="layer-town-center-line" shape={centerLines.townLine}>
                  <Mapbox.LineLayer id="layer-town-center-line-style" style={{ lineColor: '#8b5cf6', lineWidth: 3, lineOpacity: 0.85 }} />
                </Mapbox.ShapeSource>
              )}

              {(layerVis.city_center_line || layerVis.town_center_line) && centerPointsFC?.features?.length > 0 && (
                <Mapbox.ShapeSource id="layer-center-points" shape={centerPointsFC}>
                  <Mapbox.CircleLayer
                    id="layer-center-points-dot"
                    style={{
                      circleRadius: 6,
                      circleColor: ['get', 'color'],
                      circleOpacity: 0.95,
                      circleStrokeWidth: 2,
                      circleStrokeColor: '#111827',
                    }}
                  />
                  <Mapbox.SymbolLayer
                    id="layer-center-points-label"
                    style={{
                      textField: ['get', 'title'],
                      textSize: 12,
                      textColor: '#ffffff',
                      textHaloColor: '#111827',
                      textHaloWidth: 1.8,
                      textAllowOverlap: false,
                      textIgnorePlacement: false,
                      textOptional: true,
                      textAnchor: 'top',
                      textOffset: [0, 1.1],
                    }}
                  />
                </Mapbox.ShapeSource>
              )}
            </Mapbox.MapView>
          )}

          {/* Bottom group bar (Parsel/Mahalle dropdown) */}
          <View style={styles.mapBottomBarWrap} pointerEvents="box-none">
            <View style={styles.mapBottomBar}>
              <TouchableOpacity
                style={[styles.mapGroupBtn, mapGroup === 'parcel' && styles.mapGroupBtnActive]}
                onPress={() => {
                  setParcelMenuOpen(v => !v);
                  setQuarterMenuOpen(false);
                  setMapGroup('parcel');
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.mapGroupBtnText, mapGroup === 'parcel' && styles.mapGroupBtnTextActive]}>Parsel</Text>
                <Ionicons name={parcelMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={mapGroup === 'parcel' ? COLORS.textOnDark : COLORS.brandNavy} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mapGroupBtn, mapGroup === 'quarter' && styles.mapGroupBtnActive]}
                onPress={() => {
                  setQuarterMenuOpen(v => !v);
                  setParcelMenuOpen(false);
                  setMapGroup('quarter');
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.mapGroupBtnText, mapGroup === 'quarter' && styles.mapGroupBtnTextActive]}>Mahalle</Text>
                <Ionicons name={quarterMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={mapGroup === 'quarter' ? COLORS.textOnDark : COLORS.brandNavy} />
              </TouchableOpacity>
            </View>

            {parcelMenuOpen && (
              <View style={styles.mapDropdown}>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('parcel_slope');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Parsel Eğimi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('parcel_view');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Parsel Manzarası</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('parcel_electric');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Yüksek Gerilim Hattı</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('parcel_water');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Su Alanı</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('parcel_roads');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Yakın Yollar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mapDropdownItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    setPresetAndOpenPanel('parcel_all');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Tümü</Text>
                </TouchableOpacity>
              </View>
            )}

            {quarterMenuOpen && (
              <View style={styles.mapDropdown}>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('quarter_morphology');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Mahalle Morfolojisi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('quarter_sales');
                  }}
                >
                  <Text style={styles.mapDropdownText}>Mahalle Satışları</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapDropdownItem}
                  onPress={() => {
                    setPresetAndOpenPanel('km_analysis');
                  }}
                >
                  <Text style={styles.mapDropdownText}>KM Analizi</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Minimal info line (not a big card) */}
            <View style={styles.mapHint}>
              <Text style={styles.mapHintText} numberOfLines={1}>
                {mapPanel === 'quarter_morphology'
                  ? `Mahalle Morfolojisi • ${summary.mahalle}`
                  : mapPanel === 'quarter_sales'
                  ? `Mahalle Satışları • ${summary.mahalle}`
                  : mapPanel === 'km_analysis'
                  ? `KM Analizi • ${summary.mahalle}`
                  : mapPanel === 'parcel_slope'
                  ? `Parsel Eğimi • ${summary.ada}/${summary.parsel}`
                  : mapPanel === 'parcel_view'
                  ? `Parsel Manzarası • ${summary.ada}/${summary.parsel}`
                  : mapPanel === 'parcel_electric'
                  ? `Yüksek Gerilim • ${summary.ada}/${summary.parsel}`
                  : mapPanel === 'parcel_water'
                  ? `Su Alanı • ${summary.ada}/${summary.parsel}`
                  : mapPanel === 'parcel_roads'
                  ? `Yakın Yollar • ${summary.ada}/${summary.parsel}`
                  : mapPanel === 'parcel_all'
                  ? `Tümü • ${summary.ada}/${summary.parsel}`
                  : `Harita • ${summary.ada}/${summary.parsel}`}
              </Text>
            </View>
          </View>

          {/* Map info / controls sheet */}
          <Modal visible={mapPanelVisible} transparent animationType="fade" onRequestClose={animateMapPanelClose}>
            <View style={styles.sheetOverlay}>
              {/* Backdrop press area (transparent) */}
              <TouchableWithoutFeedback onPress={animateMapPanelClose}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>

              <Animated.View
                style={[
                  styles.sheetCard,
                  { paddingBottom: 12 + (insets.bottom || 0), transform: [{ translateY: mapPanelTranslateY }] },
                ]}
                {...mapPanelCardPanResponder.panHandlers}
              >
                <View style={styles.sheetDragZone} {...mapPanelSheetPanResponder.panHandlers}>
                  <View style={styles.dragHandleZone}>
                    <View style={styles.dragHandle} />
                  </View>
                  <View style={styles.sheetHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetTitle}>
                        {mapPanel === 'quarter_morphology'
                          ? 'Mahalle Morfolojisi'
                          : mapPanel === 'quarter_sales'
                          ? 'Mahalle Satışları'
                          : mapPanel === 'km_analysis'
                          ? 'KM Analizi'
                          : mapPanel === 'parcel_slope'
                          ? 'Parsel Eğimi'
                          : mapPanel === 'parcel_view'
                          ? 'Parsel Manzarası'
                          : mapPanel === 'parcel_electric'
                          ? 'Yüksek Gerilim Hattı'
                          : mapPanel === 'parcel_water'
                          ? 'Su Alanı'
                          : mapPanel === 'parcel_roads'
                          ? 'Yakın Yollar'
                          : mapPanel === 'parcel_all'
                          ? 'Tümü'
                          : 'Harita'}
                      </Text>
                      <Text style={styles.sheetSub} numberOfLines={1}>
                        {summary.il} / {summary.ilce} • {summary.mahalle}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={animateMapPanelClose} style={styles.sheetCloseBtn}>
                      <Ionicons name="close" size={20} color={COLORS.brandNavy} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  ref={(r) => {
                    mapPanelScrollRef.current = r as any;
                  }}
                  contentContainerStyle={styles.sheetBody}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled={!isTogglePressing && !isSheetDragging}
                  onScroll={(e) => {
                    mapPanelScrollYRef.current = e?.nativeEvent?.contentOffset?.y || 0;
                  }}
                  scrollEventThrottle={16}
                >
                  {(() => {
                    const pd: any = derived.pd || {};
                    const pv: any = derived.pv || {};
                    const polys: any = derived.polygons || {};

                    const fmtPercent = (v: any, digits = 0) => {
                      const n = Number(v);
                      if (!Number.isFinite(n)) return '-';
                      return `%${n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
                    };

                    const fmtMaybe = (v: any) => (v == null || v === '' ? '-' : String(v));

                    const Toggle = (props: { label: string; value: boolean; onPress: () => void; color?: string }) => {
                      return (
                        <Pressable
                          onPress={props.onPress}
                          onPressIn={() => setIsTogglePressing(true)}
                          onPressOut={() => {
                            // Çok kısa bir gecikme: scroll gesture'ı toggle click ile çakışmasın
                            setTimeout(() => setIsTogglePressing(false), 120);
                          }}
                          style={({ pressed }) => [
                            styles.toggleRow,
                            pressed ? { opacity: 0.85 } : null,
                          ]}
                          hitSlop={10}
                          pressRetentionOffset={20}
                        >
                          <View style={styles.toggleRowLeft} pointerEvents="none">
                            {props.color ? <View style={[styles.toggleDot, { backgroundColor: props.color }]} /> : null}
                            <Text style={styles.toggleLabel}>{props.label}</Text>
                          </View>
                          <View style={[styles.togglePill, props.value && styles.togglePillOn]} pointerEvents="none">
                            <Text style={[styles.togglePillText, props.value && styles.togglePillTextOn]}>
                              {props.value ? 'Açık' : 'Kapalı'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    };

                    if (mapPanel === 'quarter_morphology') {
                      const qi = pd.quarter_info || {};
                      const bf = qi.boundary_features || {};
                      const cf = qi.combined_features || {};
                      const qsv = pd.quarter_slope_values || {};
                      const cityCenter = normalizeLonLatCoordForTurkey(qi.city_center);
                      const townCenter = normalizeLonLatCoordForTurkey(qi.town_center);

                      const slope0_20 = qsv.quarter_slope_percent_0_20 ?? qsv.slope_0_20_percent ?? qsv['0-20'] ?? null;
                      const slope20_30 = qsv.quarter_slope_percent_20_30 ?? qsv.slope_20_30_percent ?? qsv['20-30'] ?? null;
                      const slopeOver30 = qsv.quarter_slope_percent_over_30 ?? qsv.slope_over_30_percent ?? qsv['30+'] ?? null;
                      const avgSlope = qsv.avg_slope ?? qsv.average_slope ?? null;
                      const maxSlope = qsv.max_slope ?? qsv.maximum_slope ?? null;

                      return (
                        <>
                          <View style={styles.sheetSection}>
                            <Text style={styles.sheetSectionTitle}>Katmanlar</Text>
                            <Toggle
                              label="Mahalle Sınırı"
                              value={layerVis.quarter_polygon}
                              onPress={() => setLayerVis(s => ({ ...s, quarter_polygon: !s.quarter_polygon }))}
                              color="#f97316"
                            />
                                <Toggle
                                  label="Yapı Alanı"
                                  value={layerVis.boundary_polygon}
                                  onPress={() => setLayerVis(s => ({ ...s, boundary_polygon: !s.boundary_polygon }))}
                                  color="#ffffff"
                                />
                                <Toggle
                                  label="Mahalle Eğim 0-20"
                                  value={layerVis.quarter_slope_poly_0_20}
                                  onPress={() => setLayerVis(s => ({ ...s, quarter_slope_poly_0_20: !s.quarter_slope_poly_0_20 }))}
                                  color="#22c55e"
                                />
                                <Toggle
                                  label="Mahalle Eğim 20-30"
                                  value={layerVis.quarter_slope_poly_20_30}
                                  onPress={() => setLayerVis(s => ({ ...s, quarter_slope_poly_20_30: !s.quarter_slope_poly_20_30 }))}
                                  color="#f59e0b"
                                />
                                <Toggle
                                  label="Mahalle Eğim 30%+"
                                  value={layerVis.quarter_slope_poly_over_30}
                                  onPress={() => setLayerVis(s => ({ ...s, quarter_slope_poly_over_30: !s.quarter_slope_poly_over_30 }))}
                                  color="#ef4444"
                                />
                                <Toggle
                                  label={`Şehir Merkezi Hattı (${cityCenter ? 'Var' : 'Yok'})`}
                                  value={layerVis.city_center_line}
                                  onPress={() => setLayerVis(s => ({ ...s, city_center_line: !s.city_center_line }))}
                                  color="#3b82f6"
                                />
                                <Toggle
                                  label={`İlçe Merkezi Hattı (${townCenter ? 'Var' : 'Yok'})`}
                                  value={layerVis.town_center_line}
                                  onPress={() => setLayerVis(s => ({ ...s, town_center_line: !s.town_center_line }))}
                                  color="#8b5cf6"
                                />
                              </View>

                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Konum & Genel</Text>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Konum</Text>
                                  <Text style={styles.kvV}>
                                    {summary.il}, {summary.ilce}, {summary.mahalle}
                                  </Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Morfolojik Tip</Text>
                                  <Text style={styles.kvV}>{fmtMaybe(qi.morphology_type_name)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Mahallenin Baskın Yönü</Text>
                                  <Text style={styles.kvV}>{fmtMaybe(qi.aspect_tr ?? qi.province_orientation_r1 ?? pd.province_orientation_r1)}</Text>
                                </View>
                              </View>

                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Nüfus & Mesafe</Text>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Nüfus</Text>
                                  <Text style={styles.kvV}>{fmtMaybe(cf.Population)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Şehir Merkezine Mesafe</Text>
                                  <Text style={styles.kvV}>{fmtDistanceSmartTr(cf.CityCenterDist)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>İlçe Merkezine Mesafe</Text>
                                  <Text style={styles.kvV}>{fmtDistanceSmartTr(cf.TownCenterDist)}</Text>
                                </View>
                              </View>

                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Eğim Özeti</Text>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Ortalama Eğim</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(avgSlope, 1)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Maksimum Eğim</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(maxSlope, 1)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>0-20</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(slope0_20, 1)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>20-30</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(slope20_30, 1)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>30%+</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(slopeOver30, 1)}</Text>
                                </View>
                              </View>

                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Yapı Alanı / Mahalle</Text>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Kapsama Oranı</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(bf.BoundaryPercentage ?? bf.boundaryPercentage, 2)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Mahalle Alanı</Text>
                                  <Text style={styles.kvV}>{fmtM2SmartTr(bf.QuarterArea ?? bf.quarterArea, 0)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Yapı Alanı</Text>
                                  <Text style={styles.kvV}>{fmtM2SmartTr(bf.BoundaryArea ?? bf.boundaryArea, 0)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Yapı Alanı Ortalama Eğim</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(bf.BoundarySlopeAvg ?? bf.boundarySlopeAvg, 1)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Kişi Başına Alan</Text>
                                  <Text style={styles.kvV}>{fmtM2SmartTr(bf.SquareMetersPerPerson ?? bf.squareMetersPerPerson, 2)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Yapı Alanı Dışı Boş Alan</Text>
                                  <Text style={styles.kvV}>{fmtPercentSmartTr(bf.OutBoundaryGridCoverageRatio ?? bf.outBoundaryGridCoverageRatio, 2)}</Text>
                                </View>
                                <View style={[styles.kvRow, { marginBottom: 0 }]}>
                                  <Text style={styles.kvK}>Kot (min / max / avg)</Text>
                                  <Text style={styles.kvV}>
                                    {(() => {
                                      const emin = bf.Boundary_elev_min_value ?? bf.boundary_elev_min_value ?? null;
                                      const emax = bf.Boundary_elev_max_value ?? bf.boundary_elev_max_value ?? null;
                                      const eavg = bf.Boundary_elev_avg ?? bf.boundary_elev_avg ?? null;
                                      const f0 = (x: any) => {
                                        const n = Number(x);
                                        return Number.isFinite(n) ? `${Math.round(n).toLocaleString('tr-TR')} m` : '-';
                                      };
                                      return `${f0(emin)} / ${f0(emax)} / ${f0(eavg)}`;
                                    })()}
                                  </Text>
                                </View>
                              </View>
                            </>
                          );
                        }

                        if (mapPanel === 'quarter_sales') {
                          const sales = pd?.grid_values?.sales_count_by_year;
                          const list = Array.isArray(sales) ? sales : [];
                          const counts = list.map((x: any) => Number(x?.yearly_count)).map((v: any) => (Number.isFinite(v) ? v : 0));
                          const max = Math.max(1, ...counts);

                          return (
                            <>
                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Satış Grafiği</Text>
                                {list.length === 0 ? (
                                  <Text style={styles.sheetMuted}>Mahalle satış verisi bulunamadı.</Text>
                                ) : (
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsRow}>
                                    {list.map((x: any, idx: number) => {
                                      const y = String(x?.year ?? '-');
                                      const c = Number(x?.yearly_count);
                                      const safeC = Number.isFinite(c) ? c : 0;
                                      const h = Math.max(6, Math.round((safeC / max) * 120));
                                      return (
                                        <View key={`${y}-${idx}`} style={styles.barCol}>
                                          <View style={styles.barTrack}>
                                            <View style={[styles.barFill, { height: h }]} />
                                          </View>
                                          <Text style={styles.barYear}>{y}</Text>
                                          <Text style={styles.barVal}>{safeC}</Text>
                                        </View>
                                      );
                                    })}
                                  </ScrollView>
                                )}
                              </View>

                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Detay</Text>
                                {list.length === 0 ? (
                                  <Text style={styles.sheetMuted}>Tablo verisi yok.</Text>
                                ) : (
                                  <View style={styles.simpleTable}>
                                    <View style={[styles.simpleRow, { backgroundColor: '#111827' }]}>
                                      <Text style={[styles.simpleCellL, { color: '#ffffff' }]}>Yıl</Text>
                                      <Text style={[styles.simpleCellR, { color: '#ffffff' }]}>Satış</Text>
                                      <Text style={[styles.simpleCellR, { color: '#ffffff' }]}>Büyüme</Text>
                                      <Text style={[styles.simpleCellR, { color: '#ffffff' }]}>Kümülatif</Text>
                                    </View>
                                    {list.map((x: any, idx: number) => {
                                      const year = String(x?.year ?? '-');
                                      const c = Number(x?.yearly_count);
                                      const safeC = Number.isFinite(c) ? c : 0;
                                      const g = x?.yearly_growth;
                                      const gn = Number(g);
                                      const growthText = Number.isFinite(gn) ? `${gn > 0 ? '+' : ''}${gn}%` : '-';
                                      const cum = x?.all_years_total ?? x?.cumulative_total ?? null;
                                      const cumText = cum == null || cum === '' ? '-' : String(cum);
                                      const growthColor = Number.isFinite(gn) ? (gn > 0 ? '#16a34a' : gn < 0 ? '#dc2626' : COLORS.textMuted) : COLORS.textMuted;
                                      return (
                                        <View key={`${year}-${idx}`} style={[styles.simpleRow, idx === list.length - 1 && { borderBottomWidth: 0 }]}>
                                          <Text style={styles.simpleCellL}>{year}</Text>
                                          <Text style={styles.simpleCellR}>{safeC}</Text>
                                          <Text style={[styles.simpleCellR, { color: growthColor }]}>{growthText}</Text>
                                          <Text style={styles.simpleCellR}>{cumText}</Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                )}
                              </View>
                            </>
                          );
                        }

                        if (mapPanel === 'km_analysis') {
                          const km = pd.km_analysis || {};
                          const meta = km.analysis_meta || {};
                          const q = km.quality || {};
                          const neighbors = Array.isArray(pd.neighbor_recommendations) ? pd.neighbor_recommendations : [];

                          const targetInfo = km.target_info || {};
                          const targetM2Price = targetInfo.M2Price ?? pd.quarter_uniteprice_numeric ?? pv.quarter_uniteprice_numeric ?? null;
                          const targetRoad = targetInfo.RoadScore100 ?? null;
                          const targetCommercial = targetInfo.CommercialScore ?? null;
                          const targetRow = {
                            mahalle: `${summary.mahalle} (Sorgulanan)`,
                            m2_price: targetM2Price,
                            norm_price: targetM2Price,
                            distance_meters: 0,
                            road_score: targetRoad,
                            commercial_score: targetCommercial,
                            __isTarget: true,
                          };

                          const rows = [targetRow, ...neighbors];

                          return (
                            <>
                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>KM Özeti</Text>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Toplam incelenen</Text>
                                  <Text style={styles.kvV}>{fmtMaybe(meta.total_examined_count)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Birincil komşu</Text>
                                  <Text style={styles.kvV}>{fmtMaybe(meta.primary_neighbors_count)}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>KM Skoru</Text>
                                  <Text style={styles.kvV}>{fmtMaybe(q.score)}</Text>
                                </View>
                                <Text style={styles.sheetMuted} numberOfLines={6}>
                                  {String(q.summary_text_tr ?? '').trim() || 'KM analizi özeti bulunamadı.'}
                                </Text>
                              </View>

                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Komşu Mahalleler</Text>
                                {rows.length <= 1 ? (
                                  <Text style={styles.sheetMuted}>Komşu mahalle verisi bulunamadı.</Text>
                                ) : (
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.kmTable}>
                                      <View style={[styles.kmRow, styles.kmHeader]}>
                                        <Text style={[styles.kmCell, styles.kmCellMah, styles.kmCellHeader]}>Mahalle</Text>
                                        <Text style={[styles.kmCell, styles.kmCellNum, styles.kmCellHeader]}>M2</Text>
                                        <Text style={[styles.kmCell, styles.kmCellNum, styles.kmCellHeader]}>Norm</Text>
                                        <Text style={[styles.kmCell, styles.kmCellNum, styles.kmCellHeader]}>Mesafe</Text>
                                        <Text style={[styles.kmCell, styles.kmCellNum, styles.kmCellHeader]}>Road</Text>
                                        <Text style={[styles.kmCell, styles.kmCellNum, styles.kmCellHeader]}>Ticari</Text>
                                      </View>
                                      {rows.map((n: any, idx: number) => {
                                        const isTarget = n?.__isTarget === true;
                                        const bg = isTarget ? { backgroundColor: 'rgba(251,191,36,0.20)' } : null;
                                        const m2n = Number(n?.m2_price);
                                        const normn = Number(n?.norm_price);
                                        const m2 = Number.isFinite(m2n) && m2n > 0 ? `₺${Math.round(m2n).toLocaleString('tr-TR')}` : '-';
                                        const norm = Number.isFinite(normn) && normn > 0 ? `₺${Math.round(normn).toLocaleString('tr-TR')}` : '-';
                                        return (
                                          <View key={idx} style={[styles.kmRow, bg, idx === rows.length - 1 && { borderBottomWidth: 0 }]}>
                                            <Text style={[styles.kmCell, styles.kmCellMah]} numberOfLines={1}>
                                              {String(n?.mahalle ?? '-')}
                                            </Text>
                                            <Text style={[styles.kmCell, styles.kmCellNum]}>{m2}</Text>
                                            <Text style={[styles.kmCell, styles.kmCellNum]}>{norm}</Text>
                                            <Text style={[styles.kmCell, styles.kmCellNum]}>{fmtDistanceSmartTr(n?.distance_meters)}</Text>
                                            <Text style={[styles.kmCell, styles.kmCellNum]}>{fmtMaybe(n?.road_score)}</Text>
                                            <Text style={[styles.kmCell, styles.kmCellNum]}>{fmtMaybe(n?.commercial_score)}</Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  </ScrollView>
                                )}
                              </View>
                            </>
                          );
                        }

                        if (mapPanel === 'parcel_slope') {
                          return (
                            <View style={styles.sheetSection}>
                              <Text style={styles.sheetSectionTitle}>Katmanlar</Text>
                              <Toggle
                                label={`Eğim 0-20 (${countGeo(polys.parcel_slope_poly_0_20) ? 'Var' : 'Yok'})`}
                                value={layerVis.parcel_slope_poly_0_20}
                                onPress={() => setLayerVis(s => ({ ...s, parcel_slope_poly_0_20: !s.parcel_slope_poly_0_20 }))}
                                color="#22c55e"
                              />
                              <Toggle
                                label={`Eğim 20-30 (${countGeo(polys.parcel_slope_poly_20_30) ? 'Var' : 'Yok'})`}
                                value={layerVis.parcel_slope_poly_20_30}
                                onPress={() => setLayerVis(s => ({ ...s, parcel_slope_poly_20_30: !s.parcel_slope_poly_20_30 }))}
                                color="#f59e0b"
                              />
                              <Toggle
                                label={`Eğim 30%+ (${countGeo(polys.parcel_slope_poly_over_30) ? 'Var' : 'Yok'})`}
                                value={layerVis.parcel_slope_poly_over_30}
                                onPress={() => setLayerVis(s => ({ ...s, parcel_slope_poly_over_30: !s.parcel_slope_poly_over_30 }))}
                                color="#ef4444"
                              />
                            </View>
                          );
                        }

                        if (mapPanel === 'parcel_view') {
                          const viewPrimaryPct = Number(
                            pv.view_primary_overlap_percent ?? pv.View_PRIMARY_percent ?? pv.view_primary_percent ?? 0
                          );
                          const viewR1Pct = Number(pv.view_r1_overlap_percent ?? pv.View_R1_percent ?? pv.view_r1_percent ?? 0);
                          const viewPrimaryPoly = getByCaseInsensitive(polys, 'View_PRIMARY');
                          const viewR1Poly = getByCaseInsensitive(polys, 'View_R1');

                          return (
                            <>
                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Özet</Text>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>Ana manzara</Text>
                                  <Text style={styles.kvV}>{Number.isFinite(viewPrimaryPct) ? fmtPercent(viewPrimaryPct, 0) : '-'}</Text>
                                </View>
                                <View style={styles.kvRow}>
                                  <Text style={styles.kvK}>İkincil manzara</Text>
                                  <Text style={styles.kvV}>{Number.isFinite(viewR1Pct) ? fmtPercent(viewR1Pct, 0) : '-'}</Text>
                                </View>
                              </View>
                              <View style={styles.sheetSection}>
                                <Text style={styles.sheetSectionTitle}>Katmanlar</Text>
                                <Toggle
                                  label={`Ana manzara poligonu (${countGeo(viewPrimaryPoly) ? 'Var' : 'Yok'})`}
                                  value={layerVis.view_primary}
                                  onPress={() => setLayerVis(s => ({ ...s, view_primary: !s.view_primary }))}
                                  color="#60a5fa"
                                />
                                <Toggle
                                  label={`İkincil manzara poligonu (${countGeo(viewR1Poly) ? 'Var' : 'Yok'})`}
                                  value={layerVis.view_r1}
                                  onPress={() => setLayerVis(s => ({ ...s, view_r1: !s.view_r1 }))}
                                  color="#a78bfa"
                                />
                              </View>
                            </>
                          );
                        }

                        if (mapPanel === 'parcel_electric') {
                          return (
                            <View style={styles.sheetSection}>
                              <Text style={styles.sheetSectionTitle}>Katman</Text>
                              <Toggle
                                label={`Yüksek Gerilim (${countGeo(polys.clipped_electric_multilinestring) ? 'Var' : 'Yok'})`}
                                value={layerVis.electric}
                                onPress={() => setLayerVis(s => ({ ...s, electric: !s.electric }))}
                                color="#a78bfa"
                              />
                            </View>
                          );
                        }

                        if (mapPanel === 'parcel_water') {
                          return (
                            <View style={styles.sheetSection}>
                              <Text style={styles.sheetSectionTitle}>Katmanlar</Text>
                              <Toggle
                                label={`Su Alanı (${countGeo(polys.water_polygon) ? 'Var' : 'Yok'})`}
                                value={layerVis.water_polygon}
                                onPress={() => setLayerVis(s => ({ ...s, water_polygon: !s.water_polygon }))}
                                color="#38bdf8"
                              />
                              <Toggle
                                label={`Su Yolu (${countGeo(polys.clipped_waterway_multilinestring) ? 'Var' : 'Yok'})`}
                                value={layerVis.waterway}
                                onPress={() => setLayerVis(s => ({ ...s, waterway: !s.waterway }))}
                                color="#38bdf8"
                              />
                            </View>
                          );
                        }

                        if (mapPanel === 'parcel_roads') {
                          return (
                            <View style={styles.sheetSection}>
                              <Text style={styles.sheetSectionTitle}>Yakın Yollar (DFA)</Text>
                              <Toggle
                                label={`Paralel Yollar (${countGeo(polys.parallel_roads_multilinestring) ? 'Var' : 'Yok'})`}
                                value={layerVis.near_roads_parallel}
                                onPress={() => setLayerVis(s => ({ ...s, near_roads_parallel: !s.near_roads_parallel }))}
                                color="#e5e7eb"
                              />
                              <Toggle
                                label={`En Yakın Yol (${countGeo(polys.nearest_road_field) ? 'Var' : 'Yok'})`}
                                value={layerVis.near_roads_nearest}
                                onPress={() => setLayerVis(s => ({ ...s, near_roads_nearest: !s.near_roads_nearest }))}
                                color="#fbbf24"
                              />
                              <Toggle
                                label={`Bağlantı Hattı (${countGeo(polys.nearest_road_field_connector) ? 'Var' : 'Yok'})`}
                                value={layerVis.near_roads_connector}
                                onPress={() => setLayerVis(s => ({ ...s, near_roads_connector: !s.near_roads_connector }))}
                                color="#fbbf24"
                              />
                            </View>
                          );
                        }

                        if (mapPanel === 'parcel_all') {
                          return (
                            <View style={styles.sheetSection}>
                              <Text style={styles.sheetSectionTitle}>Katmanlar</Text>
                              <Toggle label="Eğim 0-20" value={layerVis.parcel_slope_poly_0_20} onPress={() => setLayerVis(s => ({ ...s, parcel_slope_poly_0_20: !s.parcel_slope_poly_0_20 }))} color="#22c55e" />
                              <Toggle label="Eğim 20-30" value={layerVis.parcel_slope_poly_20_30} onPress={() => setLayerVis(s => ({ ...s, parcel_slope_poly_20_30: !s.parcel_slope_poly_20_30 }))} color="#f59e0b" />
                              <Toggle label="Eğim 30%+" value={layerVis.parcel_slope_poly_over_30} onPress={() => setLayerVis(s => ({ ...s, parcel_slope_poly_over_30: !s.parcel_slope_poly_over_30 }))} color="#ef4444" />
                              <Toggle label="Ana Manzara" value={layerVis.view_primary} onPress={() => setLayerVis(s => ({ ...s, view_primary: !s.view_primary }))} color="#60a5fa" />
                              <Toggle label="İkincil Manzara" value={layerVis.view_r1} onPress={() => setLayerVis(s => ({ ...s, view_r1: !s.view_r1 }))} color="#a78bfa" />
                              <Toggle label="Yüksek Gerilim" value={layerVis.electric} onPress={() => setLayerVis(s => ({ ...s, electric: !s.electric }))} color="#a78bfa" />
                              <Toggle label="Su Alanı" value={layerVis.water_polygon} onPress={() => setLayerVis(s => ({ ...s, water_polygon: !s.water_polygon }))} color="#38bdf8" />
                              <Toggle label="Su Yolu" value={layerVis.waterway} onPress={() => setLayerVis(s => ({ ...s, waterway: !s.waterway }))} color="#38bdf8" />
                              <Toggle label="Paralel Yollar" value={layerVis.near_roads_parallel} onPress={() => setLayerVis(s => ({ ...s, near_roads_parallel: !s.near_roads_parallel }))} color="#e5e7eb" />
                              <Toggle label="En Yakın Yol" value={layerVis.near_roads_nearest} onPress={() => setLayerVis(s => ({ ...s, near_roads_nearest: !s.near_roads_nearest }))} color="#fbbf24" />
                              <Toggle label="Bağlantı Hattı" value={layerVis.near_roads_connector} onPress={() => setLayerVis(s => ({ ...s, near_roads_connector: !s.near_roads_connector }))} color="#fbbf24" />
                              <Toggle label="Etiketler" value={layerVis.labels} onPress={() => setLayerVis(s => ({ ...s, labels: !s.labels }))} color="#ffffff" />
                            </View>
                          );
                        }

                    return <Text style={styles.sheetMuted}>Bu panel için içerik yok.</Text>;
                  })()}
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>
        </View>
      ) : tab === 'street' ? (
        <View style={styles.body}>
          <ScrollView contentContainerStyle={[styles.bodyContent, { paddingBottom: 12 + (insets.bottom || 0) + 24 }]}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Street View</Text>
              <Text style={styles.meta}>Parsel için uygun bir yol noktası bulunursa Street View açılır.</Text>
              <TouchableOpacity onPress={() => setStreetViewModalVisible(true)} style={styles.primaryBtn} activeOpacity={0.85}>
                <Ionicons name="navigate" size={18} color={COLORS.textOnDark} />
                <Text style={styles.primaryBtnText}>Street View Aç</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.body}>
          <ScrollView contentContainerStyle={[styles.bodyContent, { paddingBottom: 12 + (insets.bottom || 0) + 24 }]}>
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

      <ShareModal visible={shareModalVisible} onClose={() => setShareModalVisible(false)} onShare={handleShare} isProcessing={isProcessingShare} />
      <StreetViewModal
        visible={streetViewModalVisible}
        onClose={() => setStreetViewModalVisible(false)}
        streetViewPoint={derived.parcelGeom ? getFirstStreetViewPoint(derived.parcelGeom, data) : null}
      />

      {/* Hamburger menu modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={animateReportMenuClose}>
        <View style={styles.menuOverlay}>
          {/* Backdrop press area (transparent) */}
          <TouchableWithoutFeedback onPress={animateReportMenuClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[styles.menuCard, { transform: [{ translateY: reportMenuTranslateY }] }]}
            {...reportMenuPanResponder.panHandlers}
          >
            <View style={styles.menuDragZone}>
              <View style={styles.dragHandleZone}>
                <View style={styles.dragHandle} />
              </View>
              <Text style={styles.menuTitle}>Menü</Text>
            </View>
                <TouchableOpacity
                  onPress={() => {
                    animateReportMenuClose();
                    fetchRerun();
                  }}
                  style={styles.menuItem}
                >
                  <Ionicons name="refresh" size={18} color={COLORS.brandNavy} />
                  <Text style={styles.menuItemText}>Yenile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    animateReportMenuClose();
                    setTab('street');
                  }}
                  style={styles.menuItem}
                >
                  <Ionicons name="navigate-outline" size={18} color={COLORS.brandNavy} />
                  <Text style={styles.menuItemText}>Street View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    animateReportMenuClose();
                    router.back();
                  }}
                  style={styles.menuItem}
                >
                  <Ionicons name="arrow-back" size={18} color={COLORS.brandNavy} />
                  <Text style={styles.menuItemText}>Geri</Text>
                </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Hidden container for screenshot capture */}
      <View style={{ position: 'absolute', left: -10000, top: -10000, opacity: 0, pointerEvents: 'none' }}>
        <CombinedScreenshotContainer
          ref={combinedContainerRef}
          capturedMapUri={capturedMapUri}
          parcelData={derived.parcelDataForShare}
          isProMode={true}
          priceOverride={{ unitPrice: priceSnapshot.unit_price, totalPrice: priceSnapshot.total_price }}
          mapOnly={!derived.parcelGeom}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: COLORS.headerBg,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.buttonBg,
  },
  headerTitle: { flex: 1, color: COLORS.textOnDark, fontWeight: '800', fontSize: 14 },
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

  barsRow: { paddingVertical: 4, gap: 10, paddingRight: 8 },
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
  menuTitle: { color: COLORS.brandNavy, fontWeight: '900', fontSize: 14, marginBottom: 10 },
  menuItem: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  menuItemText: { color: COLORS.brandNavy, fontWeight: '800', fontSize: 13 },
});

