import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  StatusBar,
  Dimensions,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  PanResponder,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import { getCombinedImageDimensions } from './utils/screenshotManager';
import { parseTurkishPrice, formatTurkishPrice } from './utils/priceParser';
import MyQueriesModal from './components/MyQueriesModal';
import { SavedQuery, upsertSavedQuery } from './utils/savedQueries';
import { putReportMemory } from './utils/reportMemory';
import { API_URL } from '../config/api';

// Conditional Location import
let Location: any = null;
try {
  Location = require('expo-location');
} catch (e) {
  console.warn('expo-location native module not available.', e);
  // Location modülü yoksa uygulama çalışmaya devam edebilmeli
}

import ParcelModal from '../components/ParcelModal';
import ParcelSearchModal from '../components/ParcelSearchModal';
import ProModeThreeLoader from '../components/ProModeThreeLoader';
import PropertyTypeSelectionModal from '../components/PropertyTypeSelectionModal';
import ShareModal from '../components/ShareModal';
import StreetViewModal from '../components/StreetViewModal';
// CesiumModelViewer kaldırıldı - native Mapbox'a geçildi
import ShapeDrawingModal from './components/ShapeDrawingModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ParcelModalContent } from '../components/ParcelModalContent';
import { ProParcelResponse, TkgmViewResponse, ParcelResponse, GeoJSONGeometry } from './types/parcelResponse';
import { apply3DMode, updateCamRefFromCameraChanged } from './utils/threeDMode';
import { extractNitelikText, generatePropertyTypeTitle } from './utils/propertyTypeUtils';
import { createShareHandler } from './utils/handlers/shareHandler';
import { useScreenshotListener } from './utils/useScreenshotListener';
import { CombinedScreenshotContainer } from './components/CombinedScreenshotContainer';
import { getFirstStreetViewPoint } from './utils/streetViewHelper';
// Shape drawing moved to ShapeDrawingModal component
import {
  MeasurementMode,
  MeasurementFeature,
  calculateArea,
  createRulerFeatures,
  createAreaFeatures,
  getCentroid,
  getCoordinateDistance
} from './utils/measurementManager';
import {
  EdgeMeasurementFeature,
  EdgeMeasureData,
  createEdgeMeasurementFeatures
} from './utils/edgeMeasurementsManager';

// Conditional Mapbox import
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
  if (Mapbox && Mapbox.setAccessToken) {
    try {
      const { MAPBOX_ACCESS_TOKEN } = require('../config/mapbox');
      Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    } catch (tokenError) {
      console.warn('Mapbox token yüklenemedi:', tokenError);
    }
  }
} catch (e) {
  console.warn('Mapbox native module not available.', e);
  // Mapbox yoksa uygulama çalışmaya devam edebilmeli
}

// menuItems array - isProMode parametresi ile dinamik
const getMenuItems = (isProMode: boolean) => [
  { id: 'ada-parsel', title: 'Ada Parsel Sorgula', icon: 'search' },
  { id: '3d-bina', title: '3D Bina', icon: 'terrain', disabled: false }, // Aktif - Mapbox Satellite + Cesium Terrain
  { id: 'akilli-sorgu', title: 'Akıllı Sorgu', icon: 'bulb', disabled: true },
  { id: 'sorgularim', title: 'Sorgularım', icon: 'list', disabled: false },
  { id: 'kullanici', title: 'Kullanıcı', icon: 'person', disabled: true },
  { id: 'giris', title: 'Giriş', icon: 'log-in', disabled: true },
  { id: 'cikis', title: 'Çıkış', icon: 'log-out', disabled: true },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ParcelData {
  geometry?: GeoJSONGeometry | null;
  properties?: Record<string, any>;
  analysisData?: ProParcelResponse | null;
}

interface SimpleModeParcel extends ParcelData {
  id: string;
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const menuTranslateY = useRef(new Animated.Value(0)).current;
  const menuClosingRef = useRef(false);
  const menuScrollYRef = useRef(0);
  const MENU_DRAG_DY_THRESHOLD = 16;
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [isProMode, setIsProMode] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [mapViewKey, setMapViewKey] = useState(0);
  const [mapDefaultSettings, setMapDefaultSettings] = useState({ centerCoordinate: [34.0, 39.0] as [number, number], zoomLevel: 4, pitch: 0, heading: 0 });
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  const [isLoadingParcel, setIsLoadingParcel] = useState(false);
  const [parcelModalVisible, setParcelModalVisible] = useState(false);
  const [myQueriesVisible, setMyQueriesVisible] = useState(false);
  
  // Basit mod için çoklu parsel yönetimi
  const [simpleModeParcels, setSimpleModeParcels] = useState<SimpleModeParcel[]>([]);
  const [selectedParcelForModal, setSelectedParcelForModal] = useState<SimpleModeParcel | null>(null);
  
  // Basit mod için helper fonksiyonlar
  const MAX_SIMPLE_MODE_PARCELS = 30;
  
  const generateParcelId = (): string => {
    return `parcel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addParcelToSimpleMode = useCallback((parcel: ParcelData): void => {
    if (!parcel.geometry) return;
    
    const newParcel: SimpleModeParcel = {
      ...parcel,
      id: generateParcelId(),
    };
    
    setSimpleModeParcels(prev => {
      const updated = [...prev, newParcel];
      // 30 limit kontrolü - FIFO (First In First Out)
      if (updated.length > MAX_SIMPLE_MODE_PARCELS) {
        return updated.slice(1); // En eski parseli kaldır
      }
      return updated;
    });
  }, []);
  
  const [propertyTypeModalVisible, setPropertyTypeModalVisible] = useState(false);
  const [propertyTypeModalTitle, setPropertyTypeModalTitle] = useState('');
  const [propertyTypeModalSuggested, setPropertyTypeModalSuggested] = useState<string | null>(null);
  const [pendingTkgmData, setPendingTkgmData] = useState<TkgmViewResponse | null>(null);
  const [pendingCoordinates, setPendingCoordinates] = useState<[number, number] | null>(null);
  
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const [capturedMapUri, setCapturedMapUri] = useState<string | null>(null);
  const [capturedModalUri, setCapturedModalUri] = useState<string | null>(null);
  const [screenshotPreviewMode, setScreenshotPreviewMode] = useState(false);
  const [screenshotTotalPriceInput, setScreenshotTotalPriceInput] = useState('');
  const [screenshotPriceOverride, setScreenshotPriceOverride] = useState<{ totalPrice?: number | null; unitPrice?: number | null } | null>(null);
  const [screenshotPricePanelVisible, setScreenshotPricePanelVisible] = useState(false);
  
  const [streetViewModalVisible, setStreetViewModalVisible] = useState(false);
  // cesiumModalVisible kaldırıldı - native Mapbox'a geçildi
  
  // Measurement state
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(null);
  const [rulerPoints, setRulerPoints] = useState<[number, number][]>([]);
  const [areaPoints, setAreaPoints] = useState<[number, number][]>([]);
  const [measurementFeatures, setMeasurementFeatures] = useState<MeasurementFeature[]>([]);
  const [dynamicLineFeature, setDynamicLineFeature] = useState<MeasurementFeature | null>(null);
  const [currentTouchPoint, setCurrentTouchPoint] = useState<[number, number] | null>(null);
  
  // Shape drawing moved to ShapeDrawingModal component
  
  // Menus & 3D state
  const [shapeDrawingModalVisible, setShapeDrawingModalVisible] = useState(false);
  const [rulerMenuVisible, setRulerMenuVisible] = useState(false);
  const [rulerQuickMenuVisible, setRulerQuickMenuVisible] = useState(false);
  const [showEdgeMeasurements, setShowEdgeMeasurements] = useState(false);
  const [locationMenuVisible, setLocationMenuVisible] = useState(false);
  const [show3DSlider, setShow3DSlider] = useState(false);
  const [pitchValue, setPitchValue] = useState(0);
  const [zoomControlsVisible, setZoomControlsVisible] = useState(false);
  const [edgeMeasurementFeatures, setEdgeMeasurementFeatures] = useState<EdgeMeasurementFeature[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [infoModeActive, setInfoModeActive] = useState(false);
  const [simpleModeEdgeMeasureData, setSimpleModeEdgeMeasureData] = useState<EdgeMeasureData | null>(null);

  // Bottom pill bar submenu positioning (anchor each submenu above its button)
  const [pillBarLayout, setPillBarLayout] = useState<{ x: number; width: number } | null>(null);
  const [rulerButtonLayout, setRulerButtonLayout] = useState<{ x: number; width: number } | null>(null);
  const [locationButtonLayout, setLocationButtonLayout] = useState<{ x: number; width: number } | null>(null);
  const [rulerMenuWidth, setRulerMenuWidth] = useState(180);
  const [locationMenuWidth, setLocationMenuWidth] = useState(180);
  const [rulerQuickMenuWidth, setRulerQuickMenuWidth] = useState(140);

  const getSubMenuLeft = (button: { x: number; width: number } | null, menuWidth: number) => {
    // 8px padding from screen edges
    const padding = 8;
    if (!pillBarLayout || !button || !menuWidth) return padding;
    const centerX = pillBarLayout.x + button.x + button.width / 2;
    const unclampedLeft = centerX - menuWidth / 2;
    return Math.max(padding, Math.min(unclampedLeft, SCREEN_WIDTH - menuWidth - padding));
  };
  
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const isProgrammaticMoveRef = useRef(false);
  const programmaticTimerRef = useRef<any>(null);
  const combinedContainerRef = useRef<any>(null);
  const modalContentRef = useRef<any>(null);
  const camRef = useRef({ center: [34.0, 39.0] as [number, number], zoom: 4, pitch: 0, heading: 0 });
  const mapReadyRef = useRef({ didFinishLoadingMap: false, didFinishLoadingStyle: false, isIdle: false });
  const isSharingRef = useRef(false);
  const menuItemClickedRef = useRef(false);
  const rulerLongPressTriggeredRef = useRef(false);
  const ignoreNextMapPressRef = useRef(false);
  const intervalRef = useRef<any>(null);
  const zoomIntervalRef = useRef<any>(null);
  const pitchIntervalRef = useRef<any>(null);

  // Ölçüm çizimlerini temizle (Silgi davranışı)
  const clearMeasurementDrawings = useCallback(() => {
    setMeasurementFeatures([]);
    setMeasurementMode(null);
    setRulerPoints([]);
    setAreaPoints([]);
    setDynamicLineFeature(null);
    setCurrentTouchPoint(null);
  }, []);

  // Ölçüm + kenar ölçüleri dahil her şeyi temizle
  const clearAllMeasurementLayers = useCallback(() => {
    clearMeasurementDrawings();
    setShowEdgeMeasurements(false);
    setSimpleModeEdgeMeasureData(null);
    setEdgeMeasurementFeatures([]);
  }, [clearMeasurementDrawings]);

  useEffect(() => {
    if (menuVisible) {
      menuClosingRef.current = false;
      menuTranslateY.setValue(0);
    }
  }, [menuTranslateY, menuVisible]);

  const animateMenuClose = useCallback(() => {
    if (menuClosingRef.current) return;
    menuClosingRef.current = true;
    Animated.timing(menuTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setMenuVisible(false);
    });
  }, [menuTranslateY]);

  const menuSheetPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > MENU_DRAG_DY_THRESHOLD && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          menuTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
        if (shouldClose) {
          animateMenuClose();
          return;
        }
        Animated.spring(menuTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(menuTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [animateMenuClose, menuTranslateY]);

  const menuListPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        if (menuScrollYRef.current > 0) return false;
        return gestureState.dy > MENU_DRAG_DY_THRESHOLD && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (menuScrollYRef.current > 0) return false;
        return gestureState.dy > MENU_DRAG_DY_THRESHOLD && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          menuTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.2;
        if (shouldClose) {
          animateMenuClose();
          return;
        }
        Animated.spring(menuTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(menuTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [MENU_DRAG_DY_THRESHOLD, animateMenuClose, menuTranslateY]);

  // --- Handlers ---
  const handleSearchToggle = useCallback(() => {
    setActiveScreen(prev => prev === 'ada-parsel' ? null : 'ada-parsel');
  }, []);

  const handleMenuItemPress = useCallback((itemId: string) => {
    console.log('[Index] handleMenuItemPress called with itemId:', itemId);
    setMenuVisible(false);
    if (itemId === 'ada-parsel') {
      setActiveScreen('ada-parsel');
    } else if (itemId === '3d-bina') {
      // Şekil çizim modal'ını aç
      setShapeDrawingModalVisible(true);
    } else if (itemId === 'sorgularim') {
      setMyQueriesVisible(true);
    } else {
      console.log('[Index] Unknown menu item:', itemId);
    }
  }, []);

  const handleSelectSavedQuery = useCallback((q: SavedQuery) => {
    setMyQueriesVisible(false);
    router.push({
      pathname: '/report_mobil_viewver',
      params: {
        proparcel_value: q.proparcel_value != null ? String(q.proparcel_value) : '',
        tkgm_value: String(q.tkgm_value),
        ada: String(q.ada),
        parsel: String(q.parsel),
        unit_price: q.price_snapshot?.unit_price != null ? String(q.price_snapshot.unit_price) : '',
        total_price: q.price_snapshot?.total_price != null ? String(q.price_snapshot.total_price) : '',
        createdAt: q.createdAt,
      },
    });
  }, [router]);

  const handleCloseForm = useCallback(() => setActiveScreen(null), []);

  // Aktif parseli belirle:
  // - Pro mod: parcelData
  // - Basit mod: seçili varsa seçili; seçili yoksa ve tek parsel varsa otomatik o
  const activeParcelData = useMemo(() => {
    if (isProMode) return parcelData;
    if (selectedParcelForModal?.geometry) return selectedParcelForModal;
    if (simpleModeParcels.length === 1 && simpleModeParcels[0]?.geometry) return simpleModeParcels[0];
    return null;
  }, [isProMode, parcelData, selectedParcelForModal, simpleModeParcels]);

  const hasActiveParcel = Boolean(activeParcelData?.geometry);
  const isSimpleLoading = !isProMode && isLoadingParcel;
  const visibleParcelCount = useMemo(() => {
    if (isProMode) return parcelData?.geometry ? 1 : 0;
    return (simpleModeParcels || []).filter((p) => Boolean(p?.geometry)).length;
  }, [isProMode, parcelData?.geometry, simpleModeParcels]);
  const hasMultipleVisibleParcels = visibleParcelCount > 1;
  const canOpenPricePanel = hasActiveParcel && !hasMultipleVisibleParcels;

  useEffect(() => {
    // Arazi yokken fiyat paneli açık kalmasın
    if (!hasActiveParcel && screenshotPricePanelVisible) {
      setScreenshotPricePanelVisible(false);
      setScreenshotTotalPriceInput('');
      setScreenshotPriceOverride(null);
    }
  }, [hasActiveParcel, screenshotPricePanelVisible]);

  useEffect(() => {
    // Birden fazla parsel varken fiyat paneli açık kalmasın
    if (screenshotPricePanelVisible && !canOpenPricePanel) {
      setScreenshotPricePanelVisible(false);
    }
  }, [screenshotPricePanelVisible, canOpenPricePanel]);

  const handleToggleScreenshotPricePanel = useCallback(() => {
    if (!hasActiveParcel) return;
    if (hasMultipleVisibleParcels) {
      Alert.alert('Uyarı', 'Fiyat girebilmek için ekranda yalnızca bir parsel olması gerekir.');
      return;
    }
    setScreenshotPricePanelVisible((v) => !v);
  }, [hasActiveParcel, hasMultipleVisibleParcels]);

  const parseAreaToNumber = (value: any): number => {
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
  };

  const getMergedParcelPropsForScreenshot = useCallback((): Record<string, any> => {
    const pd: any = activeParcelData?.analysisData?.parameters_data || {};
    const pv: any = pd?.parcel_values || {};
    return { ...(activeParcelData?.properties || {}), ...pd, ...pv };
  }, [activeParcelData]);

  const screenshotMergedProps = useMemo(() => getMergedParcelPropsForScreenshot(), [getMergedParcelPropsForScreenshot]);
  const screenshotAreaNum = useMemo(() => {
    const alanRaw = screenshotMergedProps.alan ?? screenshotMergedProps.area ?? screenshotMergedProps.Area ?? screenshotMergedProps.area_m2 ?? null;
    return parseAreaToNumber(alanRaw);
  }, [screenshotMergedProps]);

  const screenshotTotalNum = useMemo(() => parseTurkishPrice(screenshotTotalPriceInput), [screenshotTotalPriceInput]);
  const screenshotHasTotal = useMemo(() => {
    const t = (screenshotTotalPriceInput || '').trim();
    return t.length > 0 && screenshotTotalNum > 0;
  }, [screenshotTotalPriceInput, screenshotTotalNum]);

  const screenshotUnitNum = useMemo(() => {
    if (!screenshotHasTotal) return 0;
    if (screenshotAreaNum <= 0) return 0;
    return screenshotTotalNum / screenshotAreaNum;
  }, [screenshotHasTotal, screenshotTotalNum, screenshotAreaNum]);

  const screenshotTotalText = useMemo(() => (screenshotHasTotal ? formatTurkishPrice(screenshotTotalNum) : '-'), [screenshotHasTotal, screenshotTotalNum]);
  const screenshotUnitText = useMemo(() => (screenshotHasTotal && screenshotAreaNum > 0 ? formatTurkishPrice(screenshotUnitNum) : '-'), [screenshotHasTotal, screenshotAreaNum, screenshotUnitNum]);

  const saveUserPrintScreenPrice = useCallback(async (payload: any) => {
    // Diğer mobile istekleriyle aynı base URL'yi kullan (env varsa onu al)
    const backendUrl = (API_URL || '').replace(/\/$/, '');
    try {
      const r = await fetch(`${backendUrl}/api/user_print_screen_price/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PP-Client': 'mobile' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.warn('[saveUserPrintScreenPrice] non-OK:', r.status, t);
        // Kayıt başarısızsa kullanıcıya göster (paylaşımı bloklamaz)
        Alert.alert('Fiyat Kaydı Hatası', t || `HTTP ${r.status}`);
      }
    } catch (e) {
      console.warn('[saveUserPrintScreenPrice] request failed:', e);
      Alert.alert('Fiyat Kaydı Hatası', 'Sunucuya bağlanılamadı.');
    }
  }, []);

  const handleShare = useCallback(
    createShareHandler({
      parcelData: activeParcelData, mapRef, combinedContainerRef, mapReadyRef, isSharingRef,
      setIsProcessingShare, setCapturedMapUri, setCapturedModalUri, setShareModalVisible,
    }),
    [activeParcelData]
  );

  const handleCameraPress = useCallback(() => {
    // Her çekimde temiz başla (kullanıcı yeni fiyat girebilsin)
    setScreenshotTotalPriceInput('');
    setScreenshotPriceOverride(null);
    setScreenshotPricePanelVisible(false);
    setScreenshotPreviewMode(true);
  }, []);

  const handleConfirmScreenshot = useCallback(async () => {
    setScreenshotPreviewMode(false);

    // Arazi yoksa: fiyat alanları pasif + screenshot sadece harita olacak (container mapOnly)
    if (!hasActiveParcel) {
      setScreenshotPriceOverride(null);
      setIsProcessingShare(true);
      try {
        await handleShare();
      } catch (error) {
        // handleShare zaten alert/log yapıyor
      } finally {
        setScreenshotPriceOverride(null);
        setScreenshotTotalPriceInput('');
        setScreenshotPricePanelVisible(false);
      }
      return;
    }

    // Override fiyatları hazırla (kullanıcı toplam fiyat girdiyse)
    const totalNum = parseTurkishPrice(screenshotTotalPriceInput);
    const hasTotal = (screenshotTotalPriceInput || '').trim().length > 0 && totalNum > 0;
    const unitNum = (hasTotal && screenshotAreaNum > 0) ? (totalNum / screenshotAreaNum) : 0;

    const nextOverride = hasTotal
      ? { totalPrice: totalNum, unitPrice: (screenshotAreaNum > 0 ? unitNum : null) }
      : null;

    setScreenshotPriceOverride(nextOverride);

    // DB kaydı (paylaşımı bloklamasın)
    if (hasTotal) {
      const pickStr = (source: Record<string, any>, keys: string[]): string => {
        for (const k of keys) {
          const v = source?.[k];
          if (v === null || v === undefined) continue;
          const s = String(v).trim();
          if (s) return s;
        }
        return '';
      };

      const proparcelValue = pickStr(screenshotMergedProps, ['Proparcel_value', 'proparcel_value', 'ProparcelValue', 'proparcelValue']);
      const ada = pickStr(screenshotMergedProps, ['adaNo', 'ada', 'Ada']);
      const parsel = pickStr(screenshotMergedProps, ['parselNo', 'parsel', 'Parsel']);

      // Proparcel_value yoksa da kaydı göndermeyi deniyoruz; backend gerekirse 400 döner.
      saveUserPrintScreenPrice({
        Proparcel_value: proparcelValue ? Number(proparcelValue) : null,
        ada: ada || null,
        parse: parsel || null,
        unitPirce: (screenshotAreaNum > 0 ? unitNum : null),
        totalPrice: totalNum,
        dateTime: new Date().toISOString(),
      });
    }

    // Override state'in render'a yansıması için 1-2 frame bekle (ViewShot doğru fiyatı çeksin)
    await new Promise(res => requestAnimationFrame(() => res(null)));
    await new Promise(res => requestAnimationFrame(() => res(null)));

    setIsProcessingShare(true);
    try {
      await handleShare();
    } catch (error) {
      // handleShare zaten alert/log yapıyor
    } finally {
      // Bir sonraki çekimde backend fiyatlarına geri dön
      setScreenshotPriceOverride(null);
      setScreenshotTotalPriceInput('');
      setScreenshotPricePanelVisible(false);
    }
  }, [handleShare, hasActiveParcel, screenshotTotalPriceInput, screenshotAreaNum, screenshotMergedProps, saveUserPrintScreenPrice]);

  const handleCancelScreenshot = useCallback(() => {
    setScreenshotPreviewMode(false);
    setScreenshotPriceOverride(null);
    setScreenshotTotalPriceInput('');
    setScreenshotPricePanelVisible(false);
  }, []);

  useScreenshotListener({ activeScreen, parcelData: activeParcelData, parcelModalVisible, setShareModalVisible });

  // Map & Logic Helpers
  const normalizeGeometryCoordinates = (geometry: any): any => {
    if (!geometry || !geometry.coordinates) return geometry;
    const swap = (coords: any): any => Array.isArray(coords) ? (coords.length === 2 && typeof coords[0] === 'number' ? (Math.abs(coords[0]) > 90 ? coords : [coords[1], coords[0]]) : coords.map(swap)) : coords;
    return { ...geometry, coordinates: swap(geometry.coordinates) };
  };

  const calculateBoundsAndCamera = (geometry: any) => {
    let allCoords: [number, number][] = [];
    if (geometry.type === 'Polygon') allCoords = geometry.coordinates[0];
    else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((p: any) => allCoords.push(...p[0]));
    if (!allCoords.length) return null;
    let minLon = allCoords[0][0], maxLon = allCoords[0][0], minLat = allCoords[0][1], maxLat = allCoords[0][1];
    allCoords.forEach(([lon, lat]) => { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); });
    return { center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2] as [number, number], zoom: 16 };
  };

  // Parsel label helper fonksiyonları
  const getParcelCentroid = (geometry: any): [number, number] | null => {
    if (!geometry || !geometry.coordinates) return null;
    try {
      let allCoords: [number, number][] = [];
      if (geometry.type === 'Polygon' && geometry.coordinates[0]) {
        allCoords = geometry.coordinates[0];
      } else if (geometry.type === 'MultiPolygon' && geometry.coordinates[0] && geometry.coordinates[0][0]) {
        allCoords = geometry.coordinates[0][0];
      }
      if (!allCoords.length) return null;
      let sumLon = 0, sumLat = 0;
      allCoords.forEach(([lon, lat]) => { sumLon += lon; sumLat += lat; });
      return [sumLon / allCoords.length, sumLat / allCoords.length];
    } catch {
      return null;
    }
  };

  const pickValue = (source: Record<string, any>, keys: string[]): string => {
    for (const k of keys) {
      const v = source?.[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const formatArea = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    let n: number;
    if (typeof value === 'string') {
      const cleaned = String(value).trim().replace(/\s/g, '').replace(/m²|m2/gi, '').replace(/\./g, '').replace(',', '.');
      n = parseFloat(cleaned);
    } else {
      n = Number(value);
    }
    if (!Number.isFinite(n) || n <= 0) return '';
    return `${Math.round(n).toLocaleString('tr-TR')} m²`;
  };

  const getParcelLabelText = (properties: Record<string, any>): string => {
    const ada = pickValue(properties, ['adaNo', 'ada', 'Ada']);
    const parsel = pickValue(properties, ['parselNo', 'parsel', 'Parsel']);
    const alanRaw = properties?.alan ?? properties?.area ?? properties?.Area ?? properties?.area_m2;
    const alan = formatArea(alanRaw);
    
    const adaParselText = ada && parsel ? `${ada}/${parsel}` : (ada || parsel || '');
    const alanText = alan || '';
    
    if (adaParselText && alanText) {
      return `${adaParselText}\n${alanText}`;
    } else if (adaParselText) {
      return adaParselText;
    } else if (alanText) {
      return alanText;
    }
    return '';
  };

  const handleAdaParselSubmit = useCallback(async (payload: any) => {
    if (isLoadingParcel) return;
    setIsLoadingParcel(true);
    // Yeni parsel sorgulanacağı için kenar ölçülerini kapat
    setShowEdgeMeasurements(false);
    
    // Pro modda parcelData temizle, basit modda array'e ekleyeceğiz
    if (isProMode) {
      setParcelData(null);
    } else {
      // Basit modda da edge measure data'yı temizle
      setSimpleModeEdgeMeasureData(null);
    }
    const backendUrl = (API_URL || '').replace(/\/$/, '');
    
    try {
      if (isProMode) {
        // Pro mod: Önce TKGM sorgusu yap, property type modal aç
        const tkgmResponse = await fetch(`${backendUrl}/api/tkgm_view/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, map_mode: '2d', is3D: is3DMode })
        });
        
        if (!tkgmResponse.ok) throw new Error();
        const tkgmData = await tkgmResponse.json();
        
        if (!tkgmData.geometry) {
          setIsLoadingParcel(false);
          return;
        }

        // Nitelik metnini çıkar ve property type modal aç
        const nitelikText = extractNitelikText(tkgmData);
        const { title, suggestedType } = generatePropertyTypeTitle(nitelikText);
        
        setPendingTkgmData(tkgmData);
        setPendingCoordinates(null); // Ada/Parsel sorgusunda koordinat yok
        setPropertyTypeModalTitle(title);
        setPropertyTypeModalSuggested(suggestedType);
        setPropertyTypeModalVisible(true);
        setIsLoadingParcel(false);
      } else {
        // Basit mod: Direkt TKGM sorgusu ve array'e ekle
        // Yeni parsel sorgulanacağı için kenar ölçülerini kapat
        setShowEdgeMeasurements(false);
        setSimpleModeEdgeMeasureData(null);
        
        const response = await fetch(`${backendUrl}/api/tkgm_view/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, map_mode: '2d', is3D: is3DMode })
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.geometry) {
          setIsLoadingParcel(false);
          return;
        }
        
        const newParcel: ParcelData = { geometry: data.geometry, properties: data.properties || {}, analysisData: null };
        // Basit modda array'e ekle (30 limit kontrolü addParcelToSimpleMode içinde)
        addParcelToSimpleMode(newParcel);
        
        const settings = calculateBoundsAndCamera(data.geometry);
        if (settings && cameraRef.current) setTimeout(() => cameraRef.current.setCamera({ centerCoordinate: settings.center, zoomLevel: settings.zoom, pitch: camRef.current.pitch, animationDuration: 900 }), 100);
        setActiveScreen(null);
        setIsLoadingParcel(false);
      }
    } catch (error) {
      console.error('[handleAdaParselSubmit] Sorgu hatası:', error);
      setIsLoadingParcel(false);
      Alert.alert(
        'Bağlantı Hatası',
        'Backend sunucusuna bağlanılamadı. Lütfen Django (8000) ve FastAPI (8001) sunucularının çalıştığından emin olun.',
        [{ text: 'Tamam' }]
      );
    }
  }, [isProMode, is3DMode]);

  const toggleMode = () => setIsProMode(prev => !prev);
  const onCameraChanged = useCallback((e: any) => {
    if (isSharingRef.current) return;
    updateCamRefFromCameraChanged(e, camRef, isProgrammaticMoveRef);
    if (!isProgrammaticMoveRef.current && is3DMode && show3DSlider) {
      const p = e?.properties?.pitch; if (typeof p === 'number') setPitchValue(prev => Math.abs(prev - p) >= 2 ? p : prev);
    }
  }, [is3DMode, show3DSlider]);
  
  const toggle3DMode = () => {
    const n = !is3DMode; 
    apply3DMode({ 
      enable: n, camRef, cameraRef, setIs3DMode, 
      setMapDefaultSettings, 
      setMapViewKey, isProgrammaticMoveRef, programmaticTimerRef 
    });
    setShow3DSlider(n); setPitchValue(n ? (camRef.current.pitch || 75) : 0);
  };
  
  const handlePitchChange = (v: number) => {
    const nv = Math.max(0, Math.min(90, Math.round(v))); setPitchValue(nv);
    if (cameraRef?.current?.setCamera && is3DMode) {
      isProgrammaticMoveRef.current = true; if (programmaticTimerRef?.current) clearTimeout(programmaticTimerRef.current);
      cameraRef.current.setCamera({ pitch: nv, animationDuration: 250 }); camRef.current.pitch = nv;
      programmaticTimerRef.current = setTimeout(() => { isProgrammaticMoveRef.current = false; }, 300);
    }
  };
  
  const handleZoomChange = (d: number) => {
    if (!cameraRef?.current?.setCamera) return;
    const nz = Math.max(2, Math.min(22, (camRef.current.zoom || 4) + d));
    isProgrammaticMoveRef.current = true; cameraRef.current.setCamera({ zoomLevel: nz, animationDuration: 250 });
    camRef.current.zoom = nz; setTimeout(() => { isProgrammaticMoveRef.current = false; }, 300);
  };

  const handleHeadingChange = (d: number) => {
    if (!cameraRef?.current?.setCamera) return;
    const nh = ((camRef.current.heading || 0) + d) % 360;
    isProgrammaticMoveRef.current = true; cameraRef.current.setCamera({ heading: nh, animationDuration: 250 });
    camRef.current.heading = nh; setTimeout(() => { isProgrammaticMoveRef.current = false; }, 300);
  };

  const startHeadingChange = (delta: number) => {
    handleHeadingChange(delta);
    intervalRef.current = setInterval(() => { handleHeadingChange(delta); }, 150);
  };

  const stopHeadingChange = () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };

  const startZoomChange = (delta: number) => {
    // Önce bir kez direkt çağır (anında zoom için)
    handleZoomChange(delta);
    // Sonra interval başlat (basılı tutunca devam etmesi için)
    if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);
    zoomIntervalRef.current = setInterval(() => { handleZoomChange(delta); }, 150);
  };

  const stopZoomChange = () => { if (zoomIntervalRef.current) { clearInterval(zoomIntervalRef.current); zoomIntervalRef.current = null; } };

  const startPitchChange = (delta: number) => {
    // Önce bir kez direkt çağır (anında tepki için)
    const current = typeof camRef.current.pitch === 'number' ? camRef.current.pitch : pitchValue;
    handlePitchChange(current + delta);

    // Sonra interval başlat (basılı tutunca devam etmesi için)
    if (pitchIntervalRef.current) clearInterval(pitchIntervalRef.current);
    pitchIntervalRef.current = setInterval(() => {
      const cur = typeof camRef.current.pitch === 'number' ? camRef.current.pitch : pitchValue;
      handlePitchChange(cur + delta);
    }, 150);
  };

  const stopPitchChange = () => {
    if (pitchIntervalRef.current) {
      clearInterval(pitchIntervalRef.current);
      pitchIntervalRef.current = null;
    }
  };

  // Buton aktif durumlarını yöneten helper fonksiyon
  const getButtonActiveStyle = (buttonId: 'ruler' | 'location' | '3d') => {
    switch (buttonId) {
      case 'ruler':
        return (rulerMenuVisible || rulerQuickMenuVisible || measurementMode === 'ruler' || measurementMode === 'area') ? styles.pillButtonActive : null;
      case 'location':
        return locationMenuVisible ? styles.pillButtonActive : null;
      case '3d':
        return is3DMode ? styles.pillButtonActive : null;
      default:
        return null;
    }
  };

  const isPointInParcel = (p: [number, number], g: any): boolean => {
    const [x, y] = p; let inside = false;
    if (g?.type === 'Polygon' && g.coordinates?.[0]) {
      const r = g.coordinates[0];
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) inside = !inside; }
    }
    return inside;
  };

  const finishAreaMeasurement = () => {
    if (areaPoints.length >= 3) {
      setMeasurementFeatures(prev => [...prev.filter(f => !f.properties.isTemporary), ...createAreaFeatures(areaPoints, calculateArea(areaPoints), false)]);
      setAreaPoints([]);
    }
  };

  const handleMeasurementPress = (e: any) => {
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c) return;
    if (measurementMode === 'ruler') {
      if (rulerPoints.length === 0) {
        setRulerPoints([c]);
        setMeasurementFeatures(prev => [...prev.filter(f => !f.properties.isTemporary), { type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { measurementType: 'ruler', isTemporary: true } }]);
      } else {
        setMeasurementFeatures(prev => [...prev.filter(f => !f.properties.isTemporary), ...createRulerFeatures([...rulerPoints, c])]);
        setRulerPoints([]);
      }
    } else if (measurementMode === 'area') {
      const np = [...areaPoints, c];
      setAreaPoints(np);
      const newFeatures = createAreaFeatures(np, undefined, true);
      setMeasurementFeatures(prev => [...prev.filter(f => !f.properties.isTemporary), ...newFeatures]);
    }
  };

  const handleMapPress = async (e: any) => {
    // Mapbox bazen alt bar/overlay dokunuşlarını da "map press" olarak tetikleyebiliyor.
    // UI butonlarından hemen sonra gelen tek bir map press'i yoksay.
    if (ignoreNextMapPressRef.current) {
      ignoreNextMapPressRef.current = false;
      return;
    }
    if (menuItemClickedRef.current || locationMenuVisible || rulerMenuVisible || rulerQuickMenuVisible || show3DSlider || isLoadingParcel || activeScreen !== null) {
      menuItemClickedRef.current = false;
      setRulerMenuVisible(false);
      setRulerQuickMenuVisible(false);
      setLocationMenuVisible(false);
      setShow3DSlider(false);
      setZoomControlsVisible(false);
      return;
    }
    if (zoomControlsVisible) {
      setZoomControlsVisible(false);
    }
    if (measurementMode) { handleMeasurementPress(e); return; }
    
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c) return;
    
    // Info mode kontrolü: Pro modda veya basit modda info mode aktif değilse parsel sorgusu yapma
    if (!infoModeActive) {
      // Info mode aktif değilse sadece mevcut parsel modal açma işlemi yapılabilir
      if (isProMode) {
        // Pro modda: Tıklanan nokta mevcut parselin içindeyse modal aç
        if (parcelData?.geometry && isPointInParcel(c, parcelData.geometry)) {
          if (parcelData.analysisData) {
            setParcelModalVisible(true);
          }
        }
      } else {
        // Basit modda: Tıklanan nokta mevcut parsellerden birinin içindeyse modal aç
        const clickedParcel = simpleModeParcels.find(p => p.geometry && isPointInParcel(c!, p.geometry));
        if (clickedParcel) {
          // Farklı bir parsel seçiliyorsa kenar ölçülerini kapat
          if (selectedParcelForModal?.id !== clickedParcel.id) {
            setShowEdgeMeasurements(false);
          }
          setSelectedParcelForModal(clickedParcel);
          setParcelModalVisible(true);
        }
      }
      return;
    }
    
    // Basit modda: Tıklanan nokta mevcut parsellerden birinin içindeyse modal aç
    if (!isProMode) {
      const clickedParcel = simpleModeParcels.find(p => p.geometry && isPointInParcel(c!, p.geometry));
      if (clickedParcel) {
        // Farklı bir parsel seçiliyorsa kenar ölçülerini kapat
        if (selectedParcelForModal?.id !== clickedParcel.id) {
          setShowEdgeMeasurements(false);
        }
        setSelectedParcelForModal(clickedParcel);
        setParcelModalVisible(true);
        return;
      }
    }
    
    // Pro modda: Tıklanan nokta mevcut parselin içindeyse ve analiz yoksa return
    if (isProMode && parcelData?.geometry && isPointInParcel(c, parcelData.geometry)) {
      if (!parcelData.analysisData) return;
    }
    
    setIsLoadingParcel(true);
    // Pro modda parcelData temizle, basit modda array'e ekleyeceğiz
    if (isProMode) {
      setParcelData(null);
    }
    
    const backendUrl = (API_URL || '').replace(/\/$/, '');
    
    try {
      const response = await fetch(`${backendUrl}/api/tkgm_view/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: c[1], lon: c[0], map_mode: '2d', is3D: is3DMode })
      });
      
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      if (!data.geometry) {
        setIsLoadingParcel(false);
        return;
      }

      if (isProMode) {
        // Pro mod: Property type modal aç
        const nitelikText = extractNitelikText(data);
        const { title, suggestedType } = generatePropertyTypeTitle(nitelikText);
        
        setPendingTkgmData(data);
        setPendingCoordinates(c);
        setPropertyTypeModalTitle(title);
        setPropertyTypeModalSuggested(suggestedType);
        setPropertyTypeModalVisible(true);
        setInfoModeActive(false); // Parsel seçildi, info mode'u pasif yap
        setIsLoadingParcel(false);
      } else {
        // Basit mod: Array'e ekle
        const newParcel: ParcelData = { geometry: data.geometry, properties: data.properties || {}, analysisData: null };
        addParcelToSimpleMode(newParcel);
        
        const s = calculateBoundsAndCamera(data.geometry);
        if (s) cameraRef.current?.setCamera({ centerCoordinate: s.center, zoomLevel: s.zoom, pitch: camRef.current.pitch, animationDuration: 900 });
        setIsLoadingParcel(false);
      }
    } catch (error) {
      console.error('[handleMapPress] TKGM sorgu hatası:', error);
      setIsLoadingParcel(false);
      Alert.alert(
        'Bağlantı Hatası',
        'Backend sunucusuna bağlanılamadı. Lütfen Django (8000) ve FastAPI (8001) sunucularının çalıştığından emin olun.',
        [{ text: 'Tamam' }]
      );
    }
  };

  const handleLocationButtonPress = () => {
    ignoreNextMapPressRef.current = true;
    setLocationMenuVisible(!locationMenuVisible);
    if (!locationMenuVisible) {
      setRulerMenuVisible(false);
      setRulerQuickMenuVisible(false);
      setShow3DSlider(false);
    }
  };

  const handleStreetViewPress = () => {
    if (!parcelData || !parcelData.geometry) {
      Alert.alert('Bilgi', 'Önce bir parsel seçin veya sorgulayın.');
      return;
    }
    setStreetViewModalVisible(true);
  };

  const fetchEdgeMeasuresForSimpleMode = useCallback(async (targetParcel?: SimpleModeParcel | null) => {
    const parcelToUse = targetParcel || selectedParcelForModal;

    if (!parcelToUse || !parcelToUse.geometry) {
      Alert.alert('Bilgi', 'Önce bir parsel seçin.');
      return null;
    }

    // Django endpoint'i (8000 portu) kullan - calculate_edge_measures Django'da
    const djangoBackendUrl = 'http://78.189.238.18:8000';
    
    try {
      const coordinates = parcelToUse.geometry.type === 'Polygon' 
        ? parcelToUse.geometry.coordinates[0]
        : parcelToUse.geometry.coordinates;
      
      if (!coordinates || coordinates.length < 3) {
        Alert.alert('Hata', 'Parsel koordinatları geçersiz.');
        return null;
      }

      const requestBody = {
        coordinates: coordinates,
        mahalle: parcelToUse.properties?.mahalleAd || parcelToUse.properties?.mahalle,
        ada: parcelToUse.properties?.adaNo || parcelToUse.properties?.ada,
        parsel: parcelToUse.properties?.parselNo || parcelToUse.properties?.parsel
      };

      const response = await fetch(`${djangoBackendUrl}/api/calculate_edge_measures/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Kenar ölçüleri hesaplanamadı');
      }

      const data = await response.json();

      if (data.success && data.edge_measure_data) {
        return data.edge_measure_data as EdgeMeasureData;
      }
      
      return null;
    } catch (error) {
      console.error('[fetchEdgeMeasuresForSimpleMode] API hatası:', error);
      Alert.alert(
        'Bağlantı Hatası',
        'Backend sunucusuna bağlanılamadı. Lütfen Django (8000) sunucusunun çalıştığından emin olun.',
        [{ text: 'Tamam' }]
      );
      return null;
    }
  }, [selectedParcelForModal]);

  const handleRefresh = () => {
    // Tüm parsel çizimlerini temizle
    setParcelData(null);
    setSimpleModeParcels([]);
    setSelectedParcelForModal(null);
    
    // Tüm ölçüm çizimlerini temizle
    setMeasurementFeatures([]);
    setRulerPoints([]);
    setAreaPoints([]);
    setDynamicLineFeature(null);
    setMeasurementMode(null);
    setEdgeMeasurementFeatures([]);
    setShowEdgeMeasurements(false);
    setSimpleModeEdgeMeasureData(null);
    
    // Modalları kapat
    setParcelModalVisible(false);
    setStreetViewModalVisible(false);
    setShareModalVisible(false);
    setPropertyTypeModalVisible(false);
    
    // Menüleri kapat
    setRulerMenuVisible(false);
    setLocationMenuVisible(false);
    setShow3DSlider(false);
    
    // Info mode'u pasif yap
    setInfoModeActive(false);
  };

  const handleParcelLocation = () => {
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    
    // Pro modda parcelData kullan, basit modda selectedParcelForModal veya son parsel kullan
    const targetParcel = isProMode ? parcelData : (selectedParcelForModal || (simpleModeParcels.length > 0 ? simpleModeParcels[simpleModeParcels.length - 1] : null));
    
    if (!targetParcel || !targetParcel.geometry) {
      Alert.alert('Bilgi', 'Önce bir parsel seçin veya sorgulayın.');
      return;
    }
    
    const settings = calculateBoundsAndCamera(targetParcel.geometry);
    if (settings && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: settings.center,
        zoomLevel: settings.zoom,
        pitch: camRef.current.pitch,
        animationDuration: 900
      });
    }
  };

  // Property type seçimi sonrası ana pro sorgusunu yapan handler
  const handlePropertyTypeSelect = useCallback(async (propertyType: string, hisseM2?: string | null) => {
    if (!pendingTkgmData) {
      setPropertyTypeModalVisible(false);
      return;
    }

    setIsLoadingParcel(true);
    setPropertyTypeModalVisible(false);

    const backendUrl = (API_URL || '').replace(/\/$/, '');
    
    try {
      // Ana pro sorgusu - property type ile
      const requestBody: any = {
        tkgm_data: pendingTkgmData,
        property_type_override: propertyType,
        map_mode: '2d',
        is3D: is3DMode
      };

      // Koordinat varsa ekle (handleMapPress'ten geldiyse)
      if (pendingCoordinates) {
        requestBody.lat = pendingCoordinates[1];
        requestBody.lon = pendingCoordinates[0];
      }

      // Ada/Parsel bilgisi varsa ekle (handleAdaParselSubmit'ten geldiyse)
      const props = pendingTkgmData?.properties || {};
      if (props.mahalleAd && props.adaNo && props.parselNo) {
        requestBody.mahalle = props.mahalleAd;
        requestBody.ada = props.adaNo;
        requestBody.parsel = props.parselNo;
        if (props.mahalleId) {
          requestBody.mahalleTkgmValue = props.mahalleId;
        }
      }

      const response = await fetch(`${backendUrl}/api/get_parcel_info/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) throw new Error();
      
      const data = await response.json();
      const geometry = data.geometry || data.parameters_polygons?.parcel_polygon;
      if (!geometry) {
        setIsLoadingParcel(false);
        return;
      }

      const normalizedGeometry = normalizeGeometryCoordinates(geometry);
      // Yeni parsel seçildi, kenar ölçülerini kapat
      setShowEdgeMeasurements(false);
      setParcelData({
        geometry: normalizedGeometry,
        properties: { ...data.properties, ...data.parameters_data?.parcel_values },
        analysisData: data
      });

      // Mobil: Sorguyu kaydet (max 5) + report_mobil_viewver ekranına geç
      try {
        const pd: any = data?.parameters_data || {};
        const pv: any = pd?.parcel_values || {};
        const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};

        const proparcelValue =
          (pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null);
        const tkgmValue = (tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null);

        const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
        const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';

        const unitStr = pv?.unite_price ?? null;
        const totalStr = pv?.price_of_tarla ?? null;
        const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
        const totalNum = totalStr ? parseTurkishPrice(totalStr) : null;

        const cacheId = String(Date.now());
        putReportMemory(cacheId, data);

        if (tkgmValue && adaVal && parselVal) {
          await upsertSavedQuery({
            proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
            tkgm_value: Number(tkgmValue),
            ada: String(adaVal),
            parsel: String(parselVal),
            price_snapshot: { unit_price: unitNum, total_price: totalNum },
          });
        }

        router.push({
          pathname: '/report_mobil_viewver',
          params: {
            cacheId,
            proparcel_value: proparcelValue != null ? String(proparcelValue) : '',
            tkgm_value: tkgmValue != null ? String(tkgmValue) : '',
            ada: String(adaVal),
            parsel: String(parselVal),
            unit_price: unitNum != null ? String(unitNum) : '',
            total_price: totalNum != null ? String(totalNum) : '',
          },
        });
      } catch (e) {
        console.warn('[handlePropertyTypeSelect] save/navigate failed:', e);
      }

      const settings = calculateBoundsAndCamera(normalizedGeometry);
      if (settings && cameraRef.current) {
        setTimeout(() => cameraRef.current.setCamera({
          centerCoordinate: settings.center,
          zoomLevel: settings.zoom,
          pitch: camRef.current.pitch,
          animationDuration: 900
        }), 100);
      }

      // Ada/Parsel formundan geldiyse ekranı kapat
      setActiveScreen(null);

      // Pending state'leri temizle
      setPendingTkgmData(null);
      setPendingCoordinates(null);
      setPropertyTypeModalTitle('');
      setPropertyTypeModalSuggested(null);
      
      // Parsel seçildi, info mode'u pasif yap
      setInfoModeActive(false);
    } catch (error) {
      console.error('[handlePropertyTypeSelect] Ana pro sorgu hatası:', error);
      Alert.alert(
        'Bağlantı Hatası',
        'Backend sunucusuna bağlanılamadı. Lütfen Django (8000) ve FastAPI (8001) sunucularının çalıştığından emin olun.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsLoadingParcel(false);
    }
  }, [pendingTkgmData, pendingCoordinates, is3DMode, router]);

  const handleShowMyLocation = async () => {
    menuItemClickedRef.current = true; setLocationMenuVisible(false);
    if (!Location) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const l = await Location.getCurrentPositionAsync({});
    const c: [number, number] = [l.coords.longitude, l.coords.latitude];
    setUserLocation(c); setShowUserLocation(true);
    cameraRef.current?.setCamera({ centerCoordinate: c, zoomLevel: 16, animationDuration: 1000 });
  };

  const handleGetDirections = () => {
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    
    // Aktif parseli belirle (pro modda parcelData, basit modda selectedParcelForModal)
    const targetParcel = isProMode ? parcelData : (selectedParcelForModal || null);
    
    if (!targetParcel?.geometry) {
      Alert.alert('Hata', 'Yön tarifi almak için önce bir parsel seçmelisiniz.');
      return;
    }
    // Get centroid of parcel
    const coords = targetParcel.geometry.coordinates;
    let lat = 0, lon = 0;
    if (targetParcel.geometry.type === 'Polygon' && coords[0]) {
      const ring = coords[0];
      let sumLat = 0, sumLon = 0;
      for (const pt of ring) {
        sumLon += pt[0];
        sumLat += pt[1];
      }
      lon = sumLon / ring.length;
      lat = sumLat / ring.length;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    Linking.openURL(url).catch(err => console.error('Maps açılamadı:', err));
  };

  useEffect(() => {
    // İlk kontrolü geciktir - uygulama tamamen yüklendikten sonra kontrol et
    const initialDelay = setTimeout(() => {
      const check = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 saniye timeout
          const r = await fetch(`${(API_URL || '').replace(/\/$/, '')}/`, {
            signal: controller.signal,
            method: 'HEAD', // Sadece header kontrolü, daha hızlı
          });
          clearTimeout(timeoutId);
          setIsBackendOnline(r.ok || r.status < 500);
        } catch (error) {
          setIsBackendOnline(false);
          console.warn('[Backend Check] Backend bağlantı hatası:', error);
        }
      };
      check(); 
      const i = setInterval(check, 30000); 
      return () => { clearInterval(i); stopHeadingChange(); stopZoomChange(); };
    }, 2000); // 2 saniye bekle
    
    return () => { 
      clearTimeout(initialDelay);
      stopHeadingChange(); 
      stopZoomChange(); 
      stopPitchChange();
    };
  }, []);

  useEffect(() => {
    if (!showEdgeMeasurements) {
      setEdgeMeasurementFeatures([]);
      return;
    }

    // Pro modda: parcelData.analysisData'dan edge measure data'yı al
    if (isProMode && parcelData?.geometry) {
      const analysisData = parcelData.analysisData as any;
      const pd = analysisData?.parameters_data || {};
      const edgeMeasureData = pd.edge_measure_data || 
                              (pd.parcel_values && pd.parcel_values.edge_measure_data) ||
                              analysisData?.edge_measure_data ||
                              null;
      if (edgeMeasureData) {
        const features = createEdgeMeasurementFeatures(parcelData.geometry, edgeMeasureData as EdgeMeasureData);
        setEdgeMeasurementFeatures(features);
      } else {
        setEdgeMeasurementFeatures([]);
      }
    }
    // Basit modda: selectedParcelForModal veya son parsel ve simpleModeEdgeMeasureData kullan
    else if (!isProMode && simpleModeEdgeMeasureData) {
      const targetParcel = selectedParcelForModal || (simpleModeParcels.length > 0 ? simpleModeParcels[simpleModeParcels.length - 1] : null);

      if (targetParcel?.geometry) {
        const features = createEdgeMeasurementFeatures(
          targetParcel.geometry, 
          simpleModeEdgeMeasureData
        );
        setEdgeMeasurementFeatures(features);
      } else {
        setEdgeMeasurementFeatures([]);
      }
    } else {
      setEdgeMeasurementFeatures([]);
    }
  }, [showEdgeMeasurements, parcelData, isProMode, selectedParcelForModal, simpleModeEdgeMeasureData, simpleModeParcels]);

  return (
    <SafeAreaView testID="main-safe-area" style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View testID="header-container" style={styles.header}>
        <TouchableOpacity testID="search-toggle-button" style={styles.headerButton} onPress={handleSearchToggle}><Ionicons name="search" size={24} color="#fff" /></TouchableOpacity>
        <TouchableOpacity testID="pro-mode-toggle" style={styles.titleContainer} onPress={toggleMode} activeOpacity={0.7}>
          <Text style={styles.headerTitle}>ProParcel</Text>
          <View style={styles.subtitleRow}>{isProMode && <View style={styles.redDot} />}<Text style={styles.subtitle}>{isProMode ? 'Pro Sorgu' : 'Basit Sorgu'}</Text></View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={styles.statusContainer}><View style={[styles.statusDot, isBackendOnline ? styles.statusDotOnline : styles.statusDotOffline]} /></View>
          <TouchableOpacity testID="menu-open-button" style={styles.headerButton} onPress={() => setMenuVisible(true)}><Ionicons name="menu" size={28} color="#fff" /></TouchableOpacity>
        </View>
      </View>

      <View testID="content-area" style={styles.content}>
        <View testID="home-view" style={styles.homeContainer}>
          <View testID="map-view-container" style={styles.mapContainer}>
            {is3DMode && show3DSlider && (
              <View testID="controls-wrapper" style={[styles.controlsLayoutWrapper, { bottom: 85 + insets.bottom }]} pointerEvents="box-none">
                <View testID="map-navigation-controls" style={styles.mapControlsPanel} pointerEvents="auto">
                  <View style={styles.mapControlsRow}>
                    <View style={styles.mapControlSpacer} />
                    <TouchableOpacity onPressIn={() => startZoomChange(1.0)} onPressOut={stopZoomChange} style={styles.mapControlButton}><Ionicons name="chevron-up" size={20} color="#3b82f6" /></TouchableOpacity>
                    <View style={styles.mapControlSpacer} />
                  </View>
                  <View style={styles.mapControlsRow}>
                    <TouchableOpacity onPressIn={() => startHeadingChange(15)} onPressOut={stopHeadingChange} style={styles.mapControlButton}>
                      <Ionicons name="chevron-back" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <View style={styles.mapControlSpacer} />
                    <TouchableOpacity onPressIn={() => startHeadingChange(-15)} onPressOut={stopHeadingChange} style={styles.mapControlButton}>
                      <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.mapControlsRow}>
                    <View style={styles.mapControlSpacer} />
                    <TouchableOpacity onPressIn={() => startZoomChange(-1.0)} onPressOut={stopZoomChange} style={styles.mapControlButton}><Ionicons name="chevron-down" size={20} color="#3b82f6" /></TouchableOpacity>
                    <View style={styles.mapControlSpacer} />
                  </View>
                </View>
                <View testID="pitch-controls" style={styles.pitchControlsContainer} pointerEvents="auto">
                  <TouchableOpacity
                    onPressIn={() => startPitchChange(5)}
                    onPressOut={stopPitchChange}
                    style={styles.pitchButton}
                  >
                    <Ionicons name="add" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                  <Text style={styles.pitchValue}>{Math.round(pitchValue)}°</Text>
                  <TouchableOpacity
                    onPressIn={() => startPitchChange(-5)}
                    onPressOut={stopPitchChange}
                    style={styles.pitchButton}
                  >
                    <Ionicons name="remove" size={20} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {measurementMode === 'area' && areaPoints.length >= 3 && (
              <View style={[styles.areaFinishButtonContainer, { bottom: 100 + insets.bottom }]}>
                <TouchableOpacity style={styles.areaFinishButton} onPress={finishAreaMeasurement}>
                  <Text style={styles.areaFinishButtonText}>Tamamla</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Zoom Controls */}
            {!zoomControlsVisible ? (
              <View style={styles.zoomControlsWrapper} pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.zoomControlTrigger}
                  onPress={() => setZoomControlsVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.zoomControlLineContainer}>
                    <View style={styles.zoomControlLine} />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.zoomControlsWrapper} pointerEvents="auto">
                <View style={styles.zoomControlAreaProtector} />
                <TouchableOpacity
                  style={styles.zoomControlCloseHandle}
                  onPress={() => setZoomControlsVisible(false)}
                  activeOpacity={0.7}
                >
                  <View style={styles.zoomControlCloseLineContainer}>
                    <View style={styles.zoomControlCloseLine} />
                  </View>
                </TouchableOpacity>
                <View style={styles.zoomControlsPanel}>
                    <TouchableOpacity
                      style={[styles.zoomControlButton, { marginBottom: 4 }]}
                      onPressIn={() => startZoomChange(1.0)}
                      onPressOut={stopZoomChange}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.zoomControlButton}
                      onPressIn={() => startZoomChange(-1.0)}
                      onPressOut={stopZoomChange}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            {Mapbox ? (
              <Mapbox.MapView 
                key={mapViewKey} 
                ref={mapRef} 
                styleURL={Mapbox.StyleURL?.SatelliteStreet || Mapbox.StyleURL?.Default} 
                style={styles.map} 
                logoEnabled={false} 
                attributionEnabled={false} 
                scaleBarEnabled={false} 
                surfaceView={false} 
                onPress={handleMapPress} 
                onLongPress={(e: any) => { 
                  if (measurementMode === 'area' && areaPoints.length >= 3) {
                    finishAreaMeasurement();
                  }
                }} 
                onCameraChanged={onCameraChanged}
                onError={(error: any) => {
                  console.error('[Mapbox] Harita hatası:', error);
                }}
              >
                <Mapbox.Camera ref={cameraRef} defaultSettings={mapDefaultSettings} maxZoomLevel={22} minZoomLevel={2} />
                {is3DMode && RasterDemSource && Terrain && (<RasterDemSource id="mapbox-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxZoomLevel={15}><Terrain style={{ exaggeration: 1.2 }} /></RasterDemSource>)}
                {is3DMode && SkyLayer && (
                  <SkyLayer
                    id="sky-layer"
                    style={{
                      skyType: 'atmosphere',
                      skyAtmosphereSun: [0.0, 0.0],
                      skyAtmosphereSunIntensity: 15.0,
                      skyAtmosphereColor: 'rgba(135, 206, 235, 1)',
                      skyAtmosphereHaloColor: 'rgba(255, 223, 186, 0.5)',
                    }}
                  />
                )}
                
                {/* Pro mod: Tek parsel çizimi - seçili parsel highlight */}
                {isProMode && parcelData?.geometry && (() => {
                  const centroid = getParcelCentroid(parcelData.geometry);
                  const labelText = getParcelLabelText(parcelData.properties || {});
                  const isSelected = true; // Pro modda her zaman seçili
                  const fillColor = isSelected ? '#f87171' : '#dc2626'; // Açık kırmızı highlight
                  const fillOpacity = isSelected ? 0.5 : 0.3;
                  const lineColor = isSelected ? '#ef4444' : '#dc2626';
                  const lineWidth = isSelected ? 3 : 2;
                  return (
                    <>
                      <Mapbox.ShapeSource id="parcelSource" shape={{ type: 'Feature', geometry: parcelData.geometry, properties: parcelData.properties || {} }} onPress={() => { if (!measurementMode) setParcelModalVisible(true); }}>
                        <Mapbox.FillLayer id="parcelFill" style={{ fillColor, fillOpacity }} />
                        <Mapbox.LineLayer id="parcelStroke" style={{ lineColor, lineWidth }} />
                      </Mapbox.ShapeSource>
                      {centroid && labelText && (
                        <Mapbox.ShapeSource
                          id="parcelLabelSource"
                          shape={{
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: centroid },
                            properties: { label: labelText }
                          }}
                        >
                          <Mapbox.SymbolLayer
                            id="parcelLabelLayer"
                            style={{
                              textField: ['get', 'label'],
                              textSize: 12,
                              textColor: '#ffffff',
                              textHaloColor: '#000000',
                              textHaloWidth: 2,
                              textAnchor: 'center',
                              textAllowOverlap: true,
                            }}
                          />
                        </Mapbox.ShapeSource>
                      )}
                    </>
                  );
                })()}
                
                {/* Basit mod: Çoklu parsel çizimleri - seçili parsel highlight */}
                {!isProMode && simpleModeParcels.map((parcel) => {
                  if (!parcel.geometry) return null;
                  const centroid = getParcelCentroid(parcel.geometry);
                  const labelText = getParcelLabelText(parcel.properties || {});
                  const isSelected = selectedParcelForModal?.id === parcel.id;
                  const fillColor = isSelected ? '#f87171' : '#dc2626'; // Açık kırmızı highlight
                  const fillOpacity = isSelected ? 0.5 : 0.3;
                  const lineColor = isSelected ? '#ef4444' : '#FF0000'; // Seçili olmayan için saf kırmızı
                  const lineWidth = isSelected ? 3 : 2;
                  return (
                    <React.Fragment key={`simple-parcel-${parcel.id}`}>
                      <Mapbox.ShapeSource
                        id={`parcelSource-${parcel.id}`}
                        shape={{ type: 'Feature', geometry: parcel.geometry, properties: parcel.properties || {} }}
                        onPress={() => {
                          if (!measurementMode) {
                            // Farklı bir parsel seçiliyorsa kenar ölçülerini kapat
                            if (selectedParcelForModal?.id !== parcel.id) {
                              setShowEdgeMeasurements(false);
                            }
                            setSelectedParcelForModal(parcel);
                            setParcelModalVisible(true);
                          }
                        }}
                      >
                        <Mapbox.FillLayer id={`parcelFill-${parcel.id}`} style={{ fillColor, fillOpacity }} />
                        <Mapbox.LineLayer id={`parcelStroke-${parcel.id}`} style={{ lineColor, lineWidth }} />
                      </Mapbox.ShapeSource>
                      {centroid && labelText && (
                        <Mapbox.ShapeSource
                          id={`parcelLabelSource-${parcel.id}`}
                          shape={{
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: centroid },
                            properties: { label: labelText }
                          }}
                        >
                          <Mapbox.SymbolLayer
                            id={`parcelLabelLayer-${parcel.id}`}
                            style={{
                              textField: ['get', 'label'],
                              textSize: 12,
                              textColor: '#ffffff',
                              textHaloColor: '#000000',
                              textHaloWidth: 2,
                              textAnchor: 'center',
                              textAllowOverlap: true,
                            }}
                          />
                        </Mapbox.ShapeSource>
                      )}
                    </React.Fragment>
                  );
                })}
                {measurementFeatures.map((f, i) => {
                  const isRuler = f.properties.measurementType === 'ruler';
                  const isArea = f.properties.measurementType === 'area';
                  const hasLabel = f.properties.label && !f.properties.isTemporary;
                  const isLabelOnly = f.properties.isLabelOnly === true;
                  
                  // Point feature (nokta noktaları)
                  if (f.geometry.type === 'Point' && !hasLabel && !isLabelOnly) {
                    return (
                      <Mapbox.ShapeSource key={`meas-pt-${i}`} id={`meas-pt-${i}`} shape={f}>
                        <Mapbox.CircleLayer 
                          id={`meas-pt-layer-${i}`} 
                          style={{ 
                            circleRadius: 6, 
                            circleColor: isArea ? '#FBBF24' : '#3B82F6' 
                          }} 
                        />
                      </Mapbox.ShapeSource>
                    );
                  }
                  
                  // LineString feature (mesafe çizgileri)
                  if (f.geometry.type === 'LineString') {
                    return (
                      <Mapbox.ShapeSource key={`meas-ln-${i}`} id={`meas-ln-${i}`} shape={f}>
                        <Mapbox.LineLayer 
                          id={`meas-ln-layer-${i}`} 
                          style={{ 
                            lineColor: isRuler ? '#3B82F6' : '#FBBF24', 
                            lineWidth: 3 
                          }} 
                        />
                      </Mapbox.ShapeSource>
                    );
                  }
                  
                  // Polygon feature (alan polygon'ları)
                  if (f.geometry.type === 'Polygon') {
                    return (
                      <Mapbox.ShapeSource key={`meas-pg-${i}`} id={`meas-pg-${i}`} shape={f}>
                        <Mapbox.FillLayer 
                          id={`meas-pg-fill-${i}`} 
                          style={{ 
                            fillColor: '#FBBF24', 
                            fillOpacity: 0.3 
                          }} 
                        />
                        <Mapbox.LineLayer 
                          id={`meas-pg-stroke-${i}`} 
                          style={{ 
                            lineColor: '#FBBF24', 
                            lineWidth: 2 
                          }} 
                        />
                      </Mapbox.ShapeSource>
                    );
                  }
                  
                  // Label point (sadece label için)
                  if (f.geometry.type === 'Point' && hasLabel && isLabelOnly) {
                    return (
                      <Mapbox.ShapeSource key={`meas-label-${i}`} id={`meas-label-${i}`} shape={f}>
                        <Mapbox.SymbolLayer
                          id={`meas-label-layer-${i}`}
                          style={{
                            textField: ['get', 'label'],
                            textSize: 14,
                            textColor: '#ffffff',
                            textHaloColor: '#000000',
                            textHaloWidth: 2,
                            textAnchor: 'center',
                            textAllowOverlap: true,
                          }}
                        />
                      </Mapbox.ShapeSource>
                    );
                  }
                  
                  return null;
                })}
                {showEdgeMeasurements && edgeMeasurementFeatures.map((f, i) => {
                  const color = f.properties.color || '#2563eb';
                  const isBBox = f.properties.kind === 'bbox';
                  const isSegment = f.properties.kind === 'segment';
                  return (
                    <Mapbox.ShapeSource key={`edge-${i}`} id={`edge-feat-${i}`} shape={f}>
                      {f.geometry.type === 'LineString' && (
                        <Mapbox.LineLayer 
                          id={`edge-ln-${i}`} 
                          style={{ 
                            lineColor: isBBox ? '#ffffff' : color, 
                            lineWidth: isBBox ? 1.5 : (isSegment ? 3 : 2),
                            lineDasharray: isBBox ? [2, 2] : undefined
                          }} 
                        />
                      )}
                      {f.geometry.type === 'Point' && f.properties.text && (
                        <Mapbox.SymbolLayer
                          id={`edge-label-${i}`}
                          style={{
                            textField: ['get', 'text'],
                            textSize: 12,
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
                {showUserLocation && userLocation && (
                  <Mapbox.ShapeSource id="userLocationSource" shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: userLocation }, properties: {} }}>
                    <Mapbox.CircleLayer id="userLocationCircle" style={{ circleRadius: 8, circleColor: '#3B82F6', circleStrokeWidth: 2, circleStrokeColor: '#ffffff' }} />
                  </Mapbox.ShapeSource>
                )}
              </Mapbox.MapView>
            ) : (
              <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' }]}>
                <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', padding: 20 }}>
                  Mapbox yükleniyor...{'\n'}
                  Eğer bu mesaj uzun süre görünüyorsa, uygulamayı yeniden başlatın.
                </Text>
              </View>
            )}
            {screenshotPreviewMode && (() => {
              const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
              const dimensions = getCombinedImageDimensions();
              // Overlay tüm screenshot alanını göstermeli: harita + bilgi alanı.
              // Not: Cihaz ekranı bu alanı dikeyde taşıyamayabilir. Böyle durumlarda
              // dashed çerçeve "aşağı taşmasın" diye ekran içine sığacak şekilde orantılı ölçekliyoruz.
              const baseOverlayWidth = dimensions.totalWidth;
              const baseOverlayHeight = hasActiveParcel ? dimensions.height : dimensions.mapHeight; // arazi yoksa sadece harita

              // Üstte header, altta butonlar ve safe-area için yer bırak
              const reservedTop = 60 + (insets.top || 0);
              const reservedBottom = 120 + (insets.bottom || 0);
              const availableWidth = Math.max(0, screenWidth - 24);
              const availableHeight = Math.max(0, screenHeight - reservedTop - reservedBottom);

              const scaleW = baseOverlayWidth > 0 ? availableWidth / baseOverlayWidth : 1;
              const scaleH = baseOverlayHeight > 0 ? availableHeight / baseOverlayHeight : 1;
              const scale = Math.max(0, Math.min(1, scaleW, scaleH));

              const overlayWidth = baseOverlayWidth * scale;
              const overlayHeight = baseOverlayHeight * scale;
              const overlayLeft = (screenWidth - overlayWidth) / 2;
              const overlayTop = reservedTop + (availableHeight - overlayHeight) / 2;
              const overlayTopVisible = Math.max(0, overlayTop);
              const overlayRight = overlayLeft + overlayWidth;
              
              // Harita ve bilgi alanı arasındaki çizgiyi göstermek için
              const mapHeight = dimensions.mapHeight * scale;
              const mapTop = overlayTopVisible;
              const infoTop = mapTop + mapHeight;

              // Alt menü gizleneceği için aksiyonları daha aşağıda konumlandır
              const actionBottom = 24 + (insets.bottom || 0);
              const pricePanelBottom = actionBottom + 72;

              // İptal: kesik çizgi sınırının hemen üstünde sağ üstte
              const cancelRight = Math.max(8, screenWidth - overlayRight + 8);
              const cancelTop = Math.max(8 + (insets.top || 0), overlayTopVisible - 48);
              
              return (
                <>
                  {/* Dark overlay mask - pointerEvents="none" so map interactions work */}
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
                      {/* Top mask */}
                      {overlayTop > 0 && (
                        <Rect
                          x={0}
                          y={0}
                          width={screenWidth}
                          height={overlayTop}
                          fill="rgba(0, 0, 0, 0.5)"
                        />
                      )}
                      {/* Left mask */}
                      {overlayLeft > 0 && (
                        <Rect
                          x={0}
                          y={overlayTopVisible}
                          width={overlayLeft}
                          height={overlayHeight}
                          fill="rgba(0, 0, 0, 0.5)"
                        />
                      )}
                      {/* Right mask */}
                      {overlayLeft + overlayWidth < screenWidth && (
                        <Rect
                          x={overlayLeft + overlayWidth}
                          y={overlayTopVisible}
                          width={screenWidth - (overlayLeft + overlayWidth)}
                          height={overlayHeight}
                          fill="rgba(0, 0, 0, 0.5)"
                        />
                      )}
                      {/* Bottom mask */}
                      {overlayTop + overlayHeight < screenHeight && (
                        <Rect
                          x={0}
                          y={overlayTop + overlayHeight}
                          width={screenWidth}
                          height={screenHeight - (overlayTop + overlayHeight)}
                          fill="rgba(0, 0, 0, 0.5)"
                        />
                      )}
                      {/* Dashed border rectangle - outer border */}
                      <Rect
                        x={overlayLeft}
                        y={overlayTopVisible}
                        width={overlayWidth}
                        height={overlayHeight}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        strokeDasharray="10 5"
                      />
                      {/* Divider line between map and info section */}
                      {hasActiveParcel && infoTop < overlayTop + overlayHeight && (
                        <Rect
                          x={overlayLeft}
                          y={infoTop}
                          width={overlayWidth}
                          height={2}
                          fill="#3b82f6"
                          opacity={0.5}
                        />
                      )}
                    </Svg>
                  </View>

                  {/* İptal: çerçevenin hemen üstünde sağ üstte */}
                  <TouchableOpacity
                    style={[styles.screenshotCancelFloatingButton, { top: cancelTop, right: cancelRight }]}
                    onPress={handleCancelScreenshot}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={18} color="#475569" />
                    <Text style={styles.screenshotCancelFloatingText}>İptal</Text>
                  </TouchableOpacity>

                  {/* Fiyat Gir + Onayla yan yana (daha aşağıda) */}
                  <View style={[styles.screenshotPreviewButtons, { bottom: actionBottom }]} pointerEvents="box-none">
                    <TouchableOpacity
                      style={[
                        styles.screenshotPreviewButton,
                        styles.screenshotPriceActionButton,
                        !canOpenPricePanel && styles.screenshotActionDisabled,
                      ]}
                      onPress={handleToggleScreenshotPricePanel}
                      activeOpacity={0.85}
                      disabled={!hasActiveParcel}
                    >
                      <Ionicons name="pricetag" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={[styles.screenshotPriceActionButtonText, !canOpenPricePanel && styles.screenshotActionDisabledText]}>Fiyat Gir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.screenshotPreviewButton, styles.screenshotConfirmButton]}
                      onPress={handleConfirmScreenshot}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.screenshotConfirmButtonText}>Onayla</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Fiyat paneli (butonların üstünde) */}
                  {screenshotPricePanelVisible && (
                    <View
                      style={[styles.screenshotPricePanel, { bottom: pricePanelBottom }]}
                      pointerEvents="auto"
                    >
                      <View style={styles.screenshotPriceTitleRow}>
                        <Text style={styles.screenshotPriceTitle}>Gönderide görünecek fiyat bilgisini giriniz.</Text>
                        <TouchableOpacity
                          onPress={() => setScreenshotPricePanelVisible(false)}
                          style={styles.screenshotPriceCloseButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        value={screenshotTotalPriceInput}
                        onChangeText={setScreenshotTotalPriceInput}
                        placeholder="örn: 1.250.000"
                        placeholderTextColor="rgba(255,255,255,0.55)"
                        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                        style={styles.screenshotPriceInput}
                      />
                      <View style={styles.screenshotPriceMetaRow}>
                        <View style={styles.screenshotPriceMetaItem}>
                          <Text style={styles.screenshotPriceMetaLabel}>Birim Fiyat</Text>
                          <Text style={styles.screenshotPriceMetaValue}>{screenshotUnitText}</Text>
                        </View>
                        <View style={styles.screenshotPriceMetaItem}>
                          <Text style={styles.screenshotPriceMetaLabel}>Alan</Text>
                          <Text style={styles.screenshotPriceMetaValue}>
                            {screenshotAreaNum > 0 ? `${Math.round(screenshotAreaNum).toLocaleString('tr-TR')} m²` : '-'}
                          </Text>
                        </View>
                        <View style={styles.screenshotPriceMetaItem}>
                          <Text style={styles.screenshotPriceMetaLabel}>Toplam</Text>
                          <Text style={styles.screenshotPriceMetaValue}>{screenshotTotalText}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              );
            })()}
            {isProcessingShare && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Ekran Görüntüsü Hazırlanıyor</Text>
              </View>
            )}
            {!isProcessingShare && isSimpleLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Yükleniyor…</Text>
              </View>
            )}
          </View>
        </View>
        <ProModeThreeLoader visible={!!(isProMode && isLoadingParcel)} />
        <ParcelSearchModal visible={activeScreen === 'ada-parsel'} onClose={handleCloseForm} onSubmit={handleAdaParselSubmit} />
        <MyQueriesModal
          visible={myQueriesVisible}
          onClose={() => setMyQueriesVisible(false)}
          onSelect={handleSelectSavedQuery}
        />
        <ErrorBoundary>
          <ShapeDrawingModal
            visible={shapeDrawingModalVisible}
            onClose={() => {
              console.log('[Index] ShapeDrawingModal closing');
              setShapeDrawingModalVisible(false);
            }}
            initialCenter={camRef.current?.center}
            initialZoom={camRef.current?.zoom}
          />
        </ErrorBoundary>
      </View>

      {activeScreen === null && !screenshotPreviewMode && (
        <View testID="bottom-pill-bar-container" style={[styles.bottomFloatingContainer, { bottom: 20 + insets.bottom }]}>
          {rulerQuickMenuVisible && (
            <View
              style={{ position: 'absolute', bottom: 60, left: getSubMenuLeft(rulerButtonLayout, rulerQuickMenuWidth) }}
              pointerEvents="auto"
              onStartShouldSetResponder={() => true}
            >
              <View
                testID="ruler-quick-menu"
                style={[styles.rulerSubMenu, { minWidth: 140 }]}
                pointerEvents="auto"
                onLayout={(e) => {
                  const w = e?.nativeEvent?.layout?.width;
                  if (typeof w === 'number' && w > 0) setRulerQuickMenuWidth(w);
                }}
              >
                <TouchableOpacity
                  testID="ruler-quick-delete-opt"
                  style={styles.rulerSubMenuItem}
                  onPress={() => {
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    clearMeasurementDrawings();
                    setRulerQuickMenuVisible(false);
                    setLocationMenuVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Sil</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {rulerMenuVisible && (
            <View 
              style={{ position: 'absolute', bottom: 60, left: getSubMenuLeft(rulerButtonLayout, rulerMenuWidth) }}
              pointerEvents="auto"
              onStartShouldSetResponder={() => true}
            >
              <View
                testID="ruler-sub-menu"
                style={styles.rulerSubMenu}
                pointerEvents="auto"
                onLayout={(e) => {
                  const w = e?.nativeEvent?.layout?.width;
                  if (typeof w === 'number' && w > 0) setRulerMenuWidth(w);
                }}
              >
                <TouchableOpacity 
                  testID="show-edges-opt" 
                  style={styles.rulerSubMenuItem} 
                  onPress={async () => { 
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    setRulerMenuVisible(false);
                    setLocationMenuVisible(false);
                    
                    // Eğer zaten açıksa, kapat
                    if (showEdgeMeasurements) {
                      setShowEdgeMeasurements(false);
                      return;
                    }
                    
                    // Basit modda: API'den edge measure data'yı al
                    if (!isProMode) {
                      // Seçili parsel yoksa, son eklenen parseli kullan
                      const targetParcel = selectedParcelForModal || (simpleModeParcels.length > 0 ? simpleModeParcels[simpleModeParcels.length - 1] : null);

                      if (!targetParcel) {
                        Alert.alert('Bilgi', 'Önce bir parsel seçin.');
                        return;
                      }

                      const edgeData = await fetchEdgeMeasuresForSimpleMode(targetParcel);
                      if (edgeData) {
                        setSimpleModeEdgeMeasureData(edgeData);
                        setShowEdgeMeasurements(true);
                      }
                    } else {
                      // Pro modda: Sadece toggle
                      setShowEdgeMeasurements(!showEdgeMeasurements);
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="vector-square" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Kenar Ölçüleri</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.rulerSubMenuDivider} />
                <TouchableOpacity 
                  testID="measure-distance-opt" 
                  style={styles.rulerSubMenuItem} 
                  onPress={() => { 
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    setMeasurementMode('ruler'); 
                    setRulerMenuVisible(false); 
                    setLocationMenuVisible(false); 
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="ruler" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Mesafe Ölçüm</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.rulerSubMenuDivider} />
                <TouchableOpacity 
                  testID="measure-area-opt" 
                  style={styles.rulerSubMenuItem} 
                  onPress={() => { 
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    setMeasurementMode('area'); 
                    setRulerMenuVisible(false); 
                    setLocationMenuVisible(false); 
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="ruler-square" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Alan Ölçüm</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.rulerSubMenuDivider} />
                <TouchableOpacity 
                  testID="eraser-opt" 
                  style={styles.rulerSubMenuItem} 
                  onPress={() => { 
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    clearMeasurementDrawings();
                    setRulerMenuVisible(false); 
                    setLocationMenuVisible(false); 
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="eraser" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Silgi</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.rulerSubMenuDivider} />
                <TouchableOpacity
                  testID="clear-all-measurements-opt"
                  style={styles.rulerSubMenuItem}
                  onPress={() => {
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    clearAllMeasurementLayers();
                    setRulerMenuVisible(false);
                    setLocationMenuVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="broom" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Tümünü Temizle</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {locationMenuVisible && (
            <View 
              style={{ position: 'absolute', bottom: 60, left: getSubMenuLeft(locationButtonLayout, locationMenuWidth) }}
              pointerEvents="auto"
              onStartShouldSetResponder={() => true}
            >
              <View
                testID="location-sub-menu"
                style={styles.locationSubMenu}
                pointerEvents="auto"
                onLayout={(e) => {
                  const w = e?.nativeEvent?.layout?.width;
                  if (typeof w === 'number' && w > 0) setLocationMenuWidth(w);
                }}
              >
                <TouchableOpacity 
                  testID="parcel-location-opt" 
                  style={styles.locationSubMenuItem} 
                  onPress={handleParcelLocation}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="map-marker-radius" size={18} color="#fff" />
                    <Text style={styles.locationSubMenuText}>Parsel Konumu</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.locationSubMenuDivider} />
                <TouchableOpacity 
                  testID="get-directions-opt" 
                  style={styles.locationSubMenuItem} 
                  onPress={handleGetDirections}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="directions" size={18} color="#fff" />
                    <Text style={styles.locationSubMenuText}>Yol Tarifi Al</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.locationSubMenuDivider} />
                <TouchableOpacity 
                  testID="show-my-location-opt" 
                  style={styles.locationSubMenuItem} 
                  onPress={handleShowMyLocation}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#fff" />
                    <Text style={styles.locationSubMenuText}>Konumum</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.locationSubMenuDivider} />
                <TouchableOpacity 
                  testID="street-view-opt" 
                  style={styles.locationSubMenuItem} 
                  onPress={() => {
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    setLocationMenuVisible(false);
                    handleStreetViewPress();
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="google-street-view" size={18} color="#fff" />
                    <Text style={styles.locationSubMenuText}>Sokak Görüntüsü</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View
            testID="bottom-pill-bar"
            style={styles.pillBar}
            onLayout={(e) => {
              const { x, width } = e?.nativeEvent?.layout || {};
              if (typeof x === 'number' && typeof width === 'number') setPillBarLayout({ x, width });
            }}
          >
            <TouchableOpacity
              testID="ruler-button"
              onLayout={(e) => {
                const { x, width } = e?.nativeEvent?.layout || {};
                if (typeof x === 'number' && typeof width === 'number') setRulerButtonLayout({ x, width });
              }}
              delayLongPress={320}
              onLongPress={() => {
                ignoreNextMapPressRef.current = true;
                rulerLongPressTriggeredRef.current = true;
                setRulerQuickMenuVisible(true);
                setRulerMenuVisible(false);
                setLocationMenuVisible(false);
                setShow3DSlider(false);
              }}
              onPress={() => {
                ignoreNextMapPressRef.current = true;
                if (rulerLongPressTriggeredRef.current) {
                  rulerLongPressTriggeredRef.current = false;
                  return;
                }
                setRulerQuickMenuVisible(false);
                setRulerMenuVisible(!rulerMenuVisible);
                if (!rulerMenuVisible) {
                  setLocationMenuVisible(false);
                  setShow3DSlider(false);
                }
              }}
              style={[styles.pillButton, getButtonActiveStyle('ruler')]}
            >
              <MaterialCommunityIcons name="ruler" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity
              testID="location-tools-button"
              onLayout={(e) => {
                const { x, width } = e?.nativeEvent?.layout || {};
                if (typeof x === 'number' && typeof width === 'number') setLocationButtonLayout({ x, width });
              }}
              onPress={handleLocationButtonPress}
              style={[styles.pillButton, getButtonActiveStyle('location')]}
            >
              <Ionicons name="locate" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity
              testID="info-button"
              onPress={() => {
                setInfoModeActive(!infoModeActive);
              }}
              style={[
                styles.pillButton,
                infoModeActive ? styles.pillButtonActive : null
              ]}
            >
              <Ionicons name="information-circle" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity testID="refresh-button" onPress={handleRefresh} style={styles.pillButton}><Ionicons name="refresh" size={18} color="#fff" /></TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity testID="search-button" onPress={() => setActiveScreen('ada-parsel')} style={styles.pillButton}><Ionicons name="search" size={18} color="#fff" /></TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity
              testID="3d-building-button"
              onPress={() => {
                ignoreNextMapPressRef.current = true;
                menuItemClickedRef.current = true;
                setRulerMenuVisible(false);
                setRulerQuickMenuVisible(false);
                setLocationMenuVisible(false);
                setShow3DSlider(false);
                setShapeDrawingModalVisible(true);
              }}
              style={styles.pillButton}
            >
              <MaterialCommunityIcons name="home-group" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity testID="camera-share-button" onPress={handleCameraPress} style={styles.pillButton}><Ionicons name="camera" size={18} color="#fff" /></TouchableOpacity>
            <View style={styles.pillDivider} />
            <TouchableOpacity 
              testID="3d-mode-button" 
              onPress={() => { 
                ignoreNextMapPressRef.current = true;
                menuItemClickedRef.current = true;
                setRulerMenuVisible(false);
                setRulerQuickMenuVisible(false);
                setLocationMenuVisible(false);
                // "Yön ve açı" paneli açıksa kapat
                if (show3DSlider) setShow3DSlider(false);
                // Dağlar: tek tıkla terrain aç/kapat
                toggle3DMode();
              }} 
              style={[styles.pillButton, getButtonActiveStyle('3d')]}
            >
              <MaterialCommunityIcons name="terrain" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* 3D Submenu kaldırıldı: dağlar direkt terrain açar, bina ayrı buton */}

      {/* Ana Menü Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={animateMenuClose}
      >
        <TouchableWithoutFeedback onPress={animateMenuClose}>
          <View style={styles.menuModalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View
                style={[
                  styles.menuModalContent,
                  { paddingBottom: insets.bottom, transform: [{ translateY: menuTranslateY }] },
                ]}
              >
                <View {...menuSheetPanResponder.panHandlers}>
                  <View style={styles.menuDragHandleZone}>
                    <View style={styles.menuDragHandle} />
                  </View>
                  <View style={styles.menuModalHeader}>
                    <Text style={styles.menuModalTitle}>Menü</Text>
                    <TouchableOpacity onPress={animateMenuClose}>
                      <Ionicons name="close" size={28} color="#1f2937" />
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView
                  style={styles.menuModalList}
                  {...menuListPanResponder.panHandlers}
                  onScroll={(e) => {
                    menuScrollYRef.current = e?.nativeEvent?.contentOffset?.y || 0;
                  }}
                  scrollEventThrottle={16}
                >
                  {getMenuItems(isProMode).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.menuModalItem,
                      item.disabled && styles.menuModalItemDisabled
                    ]}
                    disabled={item.disabled}
                    onPress={() => {
                      if (!item.disabled) {
                        handleMenuItemPress(item.id);
                      }
                    }}
                  >
                    <View style={styles.menuModalItemContent}>
                      {item.icon === 'cube' ? (
                        <MaterialCommunityIcons 
                          name="cube" 
                          size={24} 
                          color={item.disabled ? '#9ca3af' : '#1f2937'} 
                        />
                      ) : item.icon === 'terrain' ? (
                        <MaterialCommunityIcons 
                          name="terrain" 
                          size={24} 
                          color={item.disabled ? '#9ca3af' : '#1f2937'} 
                        />
                      ) : item.icon === 'layers' ? (
                        <MaterialCommunityIcons 
                          name="layers" 
                          size={24} 
                          color={item.disabled ? '#9ca3af' : '#1f2937'} 
                        />
                      ) : (
                        <Ionicons 
                          name={item.icon as any} 
                          size={24} 
                          color={item.disabled ? '#9ca3af' : '#1f2937'} 
                        />
                      )}
                      <Text style={[
                        styles.menuModalItemText,
                        item.disabled && styles.menuModalItemTextDisabled
                      ]}>
                        {item.title}
                      </Text>
                    </View>
                    {item.disabled && !isProMode && item.id === '3d-bina' && (
                      <Text style={styles.menuModalItemProBadge}>Pro</Text>
                    )}
                  </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ParcelModal 
        visible={parcelModalVisible} 
        onClose={() => {
          setParcelModalVisible(false);
          // Seçim kalmalı, null yapmıyoruz
        }} 
        properties={
          isProMode 
            ? (parcelData?.properties || {}) 
            : (selectedParcelForModal?.properties || {})
        } 
        analysisData={
          isProMode 
            ? parcelData?.analysisData 
            : selectedParcelForModal?.analysisData
        } 
      />
      <PropertyTypeSelectionModal visible={propertyTypeModalVisible} onClose={() => { setPropertyTypeModalVisible(false); setPendingTkgmData(null); setPendingCoordinates(null); setPropertyTypeModalTitle(''); setPropertyTypeModalSuggested(null); }} onSelect={handlePropertyTypeSelect} title={propertyTypeModalTitle} suggestedType={propertyTypeModalSuggested} />
      <ShareModal visible={shareModalVisible} onClose={() => setShareModalVisible(false)} onShare={handleShare} isProcessing={isProcessingShare} />
      <StreetViewModal
        visible={streetViewModalVisible}
        onClose={() => setStreetViewModalVisible(false)}
        streetViewPoint={parcelData ? getFirstStreetViewPoint(parcelData.geometry, parcelData.analysisData) : null}
      />
      {/* CesiumModelViewer kaldırıldı - native Mapbox özellikleri ana ekranda */}
      
      {/* Hidden container for screenshot capture */}
      <View style={{ position: 'absolute', left: -10000, top: -10000, opacity: 0, pointerEvents: 'none' }}>
        <CombinedScreenshotContainer
          ref={combinedContainerRef}
          capturedMapUri={capturedMapUri}
          parcelData={activeParcelData}
          isProMode={isProMode}
          priceOverride={screenshotPriceOverride}
          mapOnly={!hasActiveParcel}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: '#3b82f6' },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  statusContainer: { marginRight: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  statusDotOnline: { backgroundColor: '#10b981' },
  statusDotOffline: { backgroundColor: '#ef4444' },
  titleContainer: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  subtitle: { fontSize: 12, color: '#fff' },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  content: { flex: 1, backgroundColor: '#f5f5f5' },
  homeContainer: { flex: 1 },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 },
  bottomFloatingContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  pillBar: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 30, paddingHorizontal: 6, paddingVertical: 6, alignItems: 'center', borderWidth: 1.5, borderColor: '#3b82f6', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  pillButton: { paddingHorizontal: 8, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  pillButtonActive: { backgroundColor: '#3b82f6' },
  pillButtonDisabled: { opacity: 0.5 },
  pillButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
  pillButtonTextActive: { color: '#fff' },
  pillDivider: { width: 1, height: 18, backgroundColor: 'rgba(59, 130, 246, 0.4)', marginHorizontal: 2 },
  rulerSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 180, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  rulerSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  rulerSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rulerSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  locationSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 180, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  locationSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  locationSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  locationSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  areaFinishButtonContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 101 },
  areaFinishButton: { flexDirection: 'row', backgroundColor: '#10b981', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, borderWidth: 2, borderColor: '#059669' },
  areaFinishButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  controlsLayoutWrapper: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 20, alignItems: 'flex-end', gap: 12, zIndex: 1000 },
  mapControlsPanel: { backgroundColor: '#1e293b', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: '#3b82f6', elevation: 15, width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  mapControlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  mapControlButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  mapControlSpacer: { width: 30, height: 30 },
  pitchControlsContainer: { backgroundColor: '#1e293b', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: '#3b82f6', elevation: 15, alignItems: 'center', width: 50, height: 110, justifyContent: 'center' },
  pitchButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  pitchValue: { color: '#fff', fontSize: 12, fontWeight: '700', marginVertical: 4 },
  zoomControlsWrapper: { position: 'absolute', right: 0, top: '50%', transform: [{ translateY: -32 }], zIndex: 1000 },
  zoomControlTrigger: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  zoomControlLineContainer: { width: '100%', height: 40, justifyContent: 'center', alignItems: 'center' },
  zoomControlLine: { width: 3, height: 40, backgroundColor: '#3b82f6', borderRadius: 2 },
  zoomControlsPanel: { backgroundColor: '#1e293b', borderRadius: 8, padding: 4, borderWidth: 1.5, borderColor: '#3b82f6', elevation: 15, alignItems: 'center', minWidth: 40, zIndex: 1000 },
  zoomControlAreaProtector: { position: 'absolute', left: -40, right: 0, top: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 999, width: '100%', height: '100%' },
  zoomControlCloseHandle: { position: 'absolute', left: -32, width: 32, height: 48, justifyContent: 'center', alignItems: 'center', zIndex: 1001 },
  zoomControlCloseLineContainer: { width: '100%', height: 40, justifyContent: 'center', alignItems: 'center' },
  zoomControlCloseLine: { width: 3, height: 40, backgroundColor: '#64748b', borderRadius: 2 },
  zoomControlButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  screenshotPreviewButtons: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 20, zIndex: 1001 },
  screenshotPreviewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 25, minWidth: 120, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  screenshotCancelButton: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  screenshotCancelButtonText: { color: '#475569', fontSize: 16, fontWeight: '700' },
  screenshotConfirmButton: { backgroundColor: '#3b82f6', borderWidth: 1.5, borderColor: '#2563eb' },
  screenshotConfirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  screenshotCancelFloatingButton: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(241, 245, 249, 0.96)',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1002,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  screenshotCancelFloatingText: { color: '#475569', fontSize: 14, fontWeight: '800' },
  screenshotPriceActionButton: { backgroundColor: '#0f172a', borderWidth: 1.5, borderColor: 'rgba(59, 130, 246, 0.9)' },
  screenshotPriceActionButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  screenshotActionDisabled: { opacity: 0.45 },
  screenshotActionDisabledText: { color: 'rgba(255,255,255,0.8)' },
  screenshotPricePanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 1001,
    elevation: 12,
  },
  screenshotPriceButtonRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1001 },
  screenshotPriceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.95)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  screenshotPriceButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  screenshotPriceTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  screenshotPriceTitle: { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 },
  screenshotPriceCloseButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  screenshotPriceInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  screenshotPriceMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  screenshotPriceMetaItem: { flex: 1 },
  screenshotPriceMetaLabel: { color: 'rgba(148, 163, 184, 0.9)', fontSize: 10, fontWeight: '800', marginBottom: 2 },
  screenshotPriceMetaValue: { color: '#fff', fontSize: 12, fontWeight: '800' },
  menuModalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  menuModalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 20 },
  menuDragHandleZone: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  menuDragHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.18)' },
  menuModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  menuModalTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  menuModalList: { paddingVertical: 8 },
  menuModalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  menuModalItemDisabled: { opacity: 0.5 },
  menuModalItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuModalItemText: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  menuModalItemTextDisabled: { color: '#9ca3af' },
  menuModalItemProBadge: { fontSize: 10, fontWeight: '700', color: '#3b82f6', backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});
