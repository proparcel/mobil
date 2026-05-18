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
  UIManager,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from '../../src/hooks/useNavigation';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import Svg, { Rect } from 'react-native-svg';
import { getCombinedImageDimensions } from '../../src/utils/screenshotManager';
import { parseTurkishPrice, formatTurkishPrice } from '../../src/utils/priceParser';
import MyQueriesModal, { type SavedQueryItem } from '../../components/app/MyQueriesModal';
import ParcelSplitProjectsModal from '../../components/app/ParcelSplitProjectsModal';
import ThreeDDesignsModal from '../../components/app/ThreeDDesignsModal';
import AppBottomSheetModal from '../../components/app/AppBottomSheetModal';
import { SavedQuery, upsertSavedQuery } from '../../src/utils/savedQueries';
import { putReportMemory } from '../../src/utils/reportMemory';
import { buildDfaRowsFromValuationSteps, parseAreaM2 } from '../../src/utils/dfaRows';
import type { ReportPayload, ReportLocationHeader } from '../../src/types/reportPayload';
import { API_URL, FALLBACK_API_URL } from '../../config/api';
import { createSavedQueryApi } from '../../services/savedQueriesApi';
import { fetchTkgmByCoordsWithFallback } from '../../src/utils/tkgmApi';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

// Conditional Location import
let Location: any = null;
try {
  Location = require('react-native-geolocation-service');
} catch (e) {
  console.warn('react-native-geolocation-service native module not available.', e);
  // Location modülü yoksa uygulama çalışmaya devam edebilmeli
}

// Conditional Video import (kutlama.mp4 background)
let Video: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const v = require('react-native-video');
  Video = v?.default || v;
} catch (e) {
  // Video modülü yoksa modal yine çalışır (sadece video görünmez)
  if (__DEV__) console.warn('react-native-video native module not available.', e);
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.('RCTVideo') ||
  !!(UIManager as any)?.getViewManagerConfig?.('RCTVideoView') ||
  !!(UIManager as any)?.getViewManagerConfig?.('ReactExoplayerView');

import ParcelModal from '../../components/ParcelModal';
import ParcelSearchModal from '../../components/ParcelSearchModal';
import ProModeThreeLoader from '../../components/ProModeThreeLoader';
import PropertyTypeSelectionModal from '../../components/PropertyTypeSelectionModal';
import FactoryEstimateModal from '../../components/FactoryEstimateModal';
import VillaEstimateModal from '../../components/VillaEstimateModal';
import { ProQueryConfirmModal } from '../../components/ProQueryConfirmModal';
import ShareModal from '../../components/ShareModal';
import StreetViewModal from '../../components/StreetViewModal';
// 3D model görüntüleyici kaldırıldı - native Mapbox'a geçildi
import ShapeDrawingModal from '../../components/app/ShapeDrawingModal';
import { ErrorBoundary } from '../../components/app/ErrorBoundary';
import { ParcelModalContent } from '../../components/ParcelModalContent';
import { ProParcelResponse, TkgmViewResponse, ParcelResponse, GeoJSONGeometry } from '../../src/types/parcelResponse';
import { apply3DMode, updateCamRefFromCameraChanged } from '../../src/utils/threeDMode';
import { extractNitelikText, generatePropertyTypeTitle } from '../../src/utils/propertyTypeUtils';
import { createShareHandler } from '../../src/utils/handlers/shareHandler';
import { useScreenshotListener } from '../../src/utils/useScreenshotListener';
import { CombinedScreenshotContainer } from '../../components/app/CombinedScreenshotContainer';
import { getFirstStreetViewPoint } from '../../src/utils/streetViewHelper';
import { useAuth } from '../contexts/AuthContext';
import { storageService, REDIRECT_TARGET_MODEL_EDITOR } from '../../services/storageService';

const TepeCoinIcon = require('../../assets/images/TepeCoin.png');
const TepeCoinSpinGif = require('../../assets/images/tepe_coin_spin_v2.gif');
const KutlamaVideo = require('../../assets/images/kutlama.mp4');
const ProModeButtonImg = require('../../assets/images/probutton.png');
const SimpleModeButtonImg = require('../../assets/images/basitbutton.png');
import { creditService } from '../../services/creditService';
import { authService } from '../../services/authService';
import type { UserProfile } from '../../src/types/auth';
import { listNotifications } from "../../services/notificationService";
import { getExpertBadgeCounts } from "../../services/expertRequestService";
// Shape drawing moved to ShapeDrawingModal component
import {
  MeasurementMode,
  MeasurementFeature,
  calculateArea,
  createRulerFeatures,
  createAreaFeatures,
  getCentroid,
  getCoordinateDistance
} from '../../src/utils/measurementManager';
import {
  EdgeMeasurementFeature,
  EdgeMeasureData,
  createEdgeMeasurementFeatures
} from '../../src/utils/edgeMeasurementsManager';

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
      const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
      Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    } catch (tokenError) {
      console.warn('Mapbox token yüklenemedi:', tokenError);
    }
  }
} catch (e) {
  console.warn('Mapbox native module not available.', e);
  // Mapbox yoksa uygulama çalışmaya devam edebilmeli
}

// menuItems array - isProMode ve isAuthenticated parametreleri ile dinamik
// Sıra: Profil, Kullanım, Bildirimler, Dosyalarım (alt: Sorgularım, Hisseli Parsel Projelerim), Tepe Coin, Giriş, Çıkış
const getMenuItems = (isProMode: boolean, isAuthenticated: boolean) => [
  { id: 'kullanici', title: 'Profil', icon: 'person', disabled: !isAuthenticated },
  { id: 'dashboard', title: 'Kullanım', icon: 'speedometer', disabled: !isAuthenticated },
  { id: 'bildirimler', title: 'Bildirimler', icon: 'notifications', disabled: !isAuthenticated },
  { id: 'dosyalarim', title: 'Dosyalarım', icon: 'folder', disabled: false, hasSubmenu: true },
  { id: 'kredi-paketleri', title: 'Tepe Coin', icon: 'logo-bitcoin', disabled: !isAuthenticated },
  { id: 'giris', title: 'Giriş', icon: 'log-in', disabled: isAuthenticated },
  { id: 'cikis', title: 'Çıkış', icon: 'log-out', disabled: !isAuthenticated },
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
  const { isAuthenticated, user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuSheetIndex, setMenuSheetIndex] = useState(0);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [isProMode, setIsProMode] = useState(false);

  // Not: Basit/Pro mod sadece işlevsel; tema aynı kalır. Sadece bazı border'lar basit modda beyaz.

  const [is3DMode, setIs3DMode] = useState(false);
  const [mapViewKey, setMapViewKey] = useState(0);
  const [mapDefaultSettings, setMapDefaultSettings] = useState({ centerCoordinate: [34.0, 39.0] as [number, number], zoomLevel: 4, pitch: 0, heading: 0 });
  // Kredi bakiyesi state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);
  // Bildirim sayısı (hamburger menü badge)
  const [notificationsUnread, setNotificationsUnread] = useState<number>(0);
  const [expertIncomingUnread, setExpertIncomingUnread] = useState<number>(0);
  const [expertMyRepliesUnread, setExpertMyRepliesUnread] = useState<number>(0);

  // Deep link üzerinden gelen "basit sorgu" payload'ı (proparcel://query?... / https://proparcel.com/query?...).
  const pendingDeepLinkPayloadRef = useRef<any | null>(null);
  
  // Navigation params üzerinden gelen pro query payload'ı (expert-requests sayfasından "Görüntüle" butonu)
  const pendingNavProQueryRef = useRef<{ mahalleTkgmValue: number; ada: string; parsel: string } | null>(null);
  const route = useRoute();
  const navigation = useNavigation();

  const handleIncomingQueryUrl = useCallback((url: string) => {
    if (!url) return;
    const isProParcelDeep = url.startsWith('proparcel://query?');
    const isProParcelWeb = url.includes('://proparcel.com/query?') || url.includes('://www.proparcel.com/query?');
    if (!isProParcelDeep && !isProParcelWeb) return;

    const qs = url.split('?')[1] || '';
    if (!qs) return;
    try {
      const params = new URLSearchParams(qs);
      const ada = params.get('ada');
      const parsel = params.get('parsel');
      const mtv = params.get('mahalleTkgmValue');
      const lat = params.get('lat');
      const lon = params.get('lon');

      let payload: any | null = null;
      if (ada && parsel && mtv) {
        const n = Number(mtv);
        if (!isNaN(n)) {
          payload = { mahalleTkgmValue: n, mahalle: '', ada, parsel };
        }
      } else if (lat && lon) {
        const nlat = Number(lat);
        const nlon = Number(lon);
        if (!isNaN(nlat) && !isNaN(nlon)) {
          payload = { lat: nlat, lon: nlon };
        }
      }

      if (!payload) return;
      pendingDeepLinkPayloadRef.current = payload;
      // Basit moda çek
      if (isProMode) setIsProMode(false);
    } catch (_) {}
  }, [isProMode]);

  // App installed iken tarayıcıdan proparcel:// açılırsa buraya düşer
  useEffect(() => {
    let sub: any = null;
    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingQueryUrl(url);
    });
    // RN 0.81+: addEventListener returns subscription
    // @ts-ignore
    sub = Linking.addEventListener('url', (e: any) => {
      const url = e?.url;
      if (url) handleIncomingQueryUrl(url);
    });
    return () => {
      try { sub?.remove?.(); } catch (_) {}
    };
  }, [handleIncomingQueryUrl]);
  
  // Navigation params üzerinden gelen pro query'yi işle (expert-requests -> "Görüntüle" butonu)
  useEffect(() => {
    const params = route.params as { proQueryMahalle?: number; proQueryAda?: string; proQueryParsel?: string } | undefined;
    if (!params?.proQueryMahalle) return;
    
    const mahalle = Number(params.proQueryMahalle);
    const ada = String(params.proQueryAda || '').trim();
    const parsel = String(params.proQueryParsel || '').trim();
    
    if (!isNaN(mahalle) && ada && parsel) {
      console.log('[Index] Navigation pro query params alındı:', { mahalle, ada, parsel });
      pendingNavProQueryRef.current = { mahalleTkgmValue: mahalle, ada, parsel };
      // Pro moda geç
      if (!isProMode) setIsProMode(true);
      // Params temizle (bir kere çalışsın)
      navigation.setParams({ proQueryMahalle: undefined, proQueryAda: undefined, proQueryParsel: undefined } as any);
    }
  }, [route.params, isProMode, navigation]);

  // Install Referrer'dan gelen deferred deep link'i ilk index açılışında uygula
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dl = await storageService.getDeferredOpenDeepLink();
        if (cancelled) return;
        if (dl) {
          await storageService.clearDeferredOpenDeepLink();
          handleIncomingQueryUrl(dl);
        }
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [handleIncomingQueryUrl]);

  // Profil state (avatar için)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  const [isLoadingParcel, setIsLoadingParcel] = useState(false);
  const [parcelModalVisible, setParcelModalVisible] = useState(false);
  const [myQueriesVisible, setMyQueriesVisible] = useState(false);
  const [parcelSplitProjectsVisible, setParcelSplitProjectsVisible] = useState(false);
  const [threeDDesignsVisible, setThreeDDesignsVisible] = useState(false);
  const [submenuOpenId, setSubmenuOpenId] = useState<string | null>(null);
  const [uzmanGorusuOpen, setUzmanGorusuOpen] = useState(false);
  
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
  const [factoryEstimateModalVisible, setFactoryEstimateModalVisible] = useState(false);
  const [pendingFactoryPropertyType, setPendingFactoryPropertyType] = useState<string | null>(null);
  const [villaEstimateModalVisible, setVillaEstimateModalVisible] = useState(false);
  const isTransitioningToSubModalRef = useRef(false); // Villa/Fabrika modalına geçiş sırasında pendingTkgmData'yı korumak için
  const [proQueryConfirmVisible, setProQueryConfirmVisible] = useState(false);
  
  // PropertyTypeModal visible değişikliklerini logla
  React.useEffect(() => {
    console.log('[Index] propertyTypeModalVisible değişti:', propertyTypeModalVisible);
  }, [propertyTypeModalVisible]);
  
  // ProQueryConfirmVisible değişikliklerini logla
  React.useEffect(() => {
    console.log('[Index] proQueryConfirmVisible değişti:', proQueryConfirmVisible);
  }, [proQueryConfirmVisible]);
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
  const shareCoinContextRef = useRef<{ awardCoin: boolean; priceText?: string }>({ awardCoin: true });
  const [priceWarningVisible, setPriceWarningVisible] = useState(false);
  
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

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setSubmenuOpenId(null);
    setUzmanGorusuOpen(false);
    setMenuSheetIndex(0);
  }, []);

  // Bildirim badge (unread) refresh kontrolü
  const unreadReqIdRef = useRef(0);

  const refreshNotificationsUnread = useCallback(async () => {
    const reqId = ++unreadReqIdRef.current;
    if (!isAuthenticated) {
      setNotificationsUnread(0);
      return;
    }
    try {
      const r = await listNotifications(1, 0);
      if (unreadReqIdRef.current !== reqId) return;
      if (r.ok) setNotificationsUnread(r.unread_count);
    } catch {
      // best-effort
    }
  }, [isAuthenticated]);

  // Uzman görüşü badge counts (incoming + my replies)
  const badgeReqIdRef = useRef(0);
  const refreshExpertBadges = useCallback(async () => {
    const reqId = ++badgeReqIdRef.current;
    if (!isAuthenticated) {
      setExpertIncomingUnread(0);
      setExpertMyRepliesUnread(0);
      return;
    }
    try {
      const r = await getExpertBadgeCounts();
      if (badgeReqIdRef.current !== reqId) return;
      if (r.ok) {
        setExpertIncomingUnread(Number(r.data.unreadIncomingCount || 0));
        setExpertMyRepliesUnread(Number(r.data.unreadMyRepliesCount || 0));
      }
    } catch {
      // best-effort
    }
  }, [isAuthenticated]);

  // Menü açılınca unread sayısını güncelle
  useEffect(() => {
    if (!menuVisible) return;
    refreshNotificationsUnread();
    refreshExpertBadges();
  }, [menuVisible, refreshNotificationsUnread, refreshExpertBadges]);

  // Expert badge'leri güncelleme event'ini dinle (silme sonrası vb.)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('refreshExpertBadges', () => {
      refreshExpertBadges();
    });
    return () => subscription.remove();
  }, [refreshExpertBadges]);

  // Ekran focus olduğunda unread sayısını güncelle (bildirim ekranından dönünce dot kaybolsun)
  useFocusEffect(
    useCallback(() => {
      refreshNotificationsUnread();
      refreshExpertBadges();
    }, [refreshNotificationsUnread, refreshExpertBadges])
  );

  // "bildirim geldiğinde" daha yakın deneyim için hafif polling
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      refreshNotificationsUnread();
      refreshExpertBadges();
    }, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, refreshNotificationsUnread, refreshExpertBadges]);

  // Redirect-after-login: giriş/kayıt sonrası model editöre dön
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const target = await storageService.getRedirectAfterLogin();
        if (cancelled) return;
        if (target === REDIRECT_TARGET_MODEL_EDITOR) {
          await storageService.clearRedirectAfterLogin();
          setShapeDrawingModalVisible(true);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  // --- Handlers ---
  const handleSearchToggle = useCallback(() => {
    setActiveScreen(prev => prev === 'ada-parsel' ? null : 'ada-parsel');
  }, []);

  const openModelEditorOrRequireAuth = useCallback(() => {
    if (isAuthenticated) {
      setShapeDrawingModalVisible(true);
      return;
    }
    Alert.alert(
      'Giriş gerekli',
      'Model editörü kullanmak için giriş yapın veya kayıt olun.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Giriş Yap',
          onPress: async () => {
            await storageService.setRedirectAfterLogin(REDIRECT_TARGET_MODEL_EDITOR);
            router.push('login');
          },
        },
        {
          text: 'Kayıt Ol',
          onPress: async () => {
            await storageService.setRedirectAfterLogin(REDIRECT_TARGET_MODEL_EDITOR);
            router.push('register');
          },
        },
      ]
    );
  }, [isAuthenticated, router]);

  const handleMenuItemPress = useCallback((itemId: string) => {
    console.log('[Index] handleMenuItemPress called with itemId:', itemId);
    if (itemId === 'dosyalarim') {
      setSubmenuOpenId((prev) => {
        const next = prev === 'dosyalarim' ? null : 'dosyalarim';
        setMenuSheetIndex(next ? 1 : 0);
        return next;
      });
      return;
    }
    menuItemClickedRef.current = true;
    setMenuVisible(false);
    setSubmenuOpenId(null);
    setUzmanGorusuOpen(false);
    setMenuSheetIndex(0);
    if (itemId === 'sorgularim') {
      setMyQueriesVisible(true);
    } else if (itemId === 'hisseli-parsel-projelerim') {
      setParcelSplitProjectsVisible(true);
    } else if (itemId === '3d-tasarimlarim') {
      setThreeDDesignsVisible(true);
    } else if (itemId === 'dashboard') {
      router.push('dashboard');
    } else if (itemId === 'kredi-paketleri') {
      router.push('pricing');
    } else if (itemId === 'bildirimler') {
      router.push('notifications');
    } else if (itemId === 'uzman-gorusu-isteklerim') {
      router.push({ pathname: 'expert-requests', params: { mode: 'mine' } });
    } else if (itemId === 'uzman-gorusu-gelen') {
      router.push({ pathname: 'expert-requests', params: { mode: 'incoming' } });
    } else if (itemId === 'kullanici') {
      router.push('profile');
    } else if (itemId === 'giris') {
      // Giriş sayfasına yönlendir
      router.push('login');
    } else if (itemId === 'cikis') {
      // Çıkış yap
      Alert.alert(
        'Çıkış Yap',
        'Çıkış yapmak istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Çıkış Yap',
            style: 'destructive',
            onPress: async () => {
              try {
                await logout();
                console.log('[Index] Logout successful');
              } catch (error) {
                console.error('[Index] Logout error:', error);
                Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
              }
            },
          },
        ]
      );
    } else {
      console.log('[Index] Unknown menu item:', itemId);
    }
  }, [router, logout, openModelEditorOrRequireAuth]);

  const handleSelectSavedQuery = useCallback((q: SavedQueryItem) => {
    setMyQueriesVisible(false);
    const local = '_fromApi' in q && q._fromApi ? q.local : undefined;
    const hasLocalDfa = local && Array.isArray(local.dfaRows) && local.dfaRows.length > 0 && local.location_header;
    const pushParams = (unitPrice?: number | null, totalPrice?: number | null, createdAt?: string, dfaRows?: string, locationHeader?: string) => ({
      pathname: 'report_mobil_viewver',
      params: {
        proparcel_value: (q.proparcel_value ?? local?.proparcel_value) != null ? String(q.proparcel_value ?? local?.proparcel_value) : '',
        tkgm_value: String(q.tkgm_value),
        ada: String(q.ada),
        parsel: String(q.parsel),
        unit_price: unitPrice != null ? String(unitPrice) : '',
        total_price: totalPrice != null ? String(totalPrice) : '',
        createdAt: createdAt ?? '',
        dfaRows: dfaRows ?? '',
        location_header: locationHeader ?? '',
      },
    });
    if (hasLocalDfa) {
      router.push(pushParams(
        local!.price_snapshot?.unit_price,
        local!.price_snapshot?.total_price,
        local!.createdAt,
        JSON.stringify(local!.dfaRows),
        JSON.stringify(local!.location_header)
      ));
      return;
    }
    if ('_fromApi' in q && q._fromApi && !local) {
      const backendUrl = (FALLBACK_API_URL || API_URL || '').replace(/\/$/, '');
      fetch(`${backendUrl}/api/mobile/report_payload/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PP-Client': 'mobile', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          tkgm_value: q.tkgm_value,
          ada: q.ada,
          parsel: q.parsel,
          proparcel_value: q.proparcel_value ?? undefined,
          map_mode: '2d',
          is3D: false,
        }),
      })
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
        .then(async (payload: ReportPayload) => {
          const dfaRows = payload.dfaRows ?? buildDfaRowsFromValuationSteps(payload.valuation_steps);
          const location_header = payload.properties ?? {};
          await upsertSavedQuery({
            proparcel_value: q.proparcel_value ?? null,
            tkgm_value: q.tkgm_value,
            ada: q.ada,
            parsel: q.parsel,
            price_snapshot: { unit_price: null, total_price: null },
            dfaRows,
            location_header,
          });
          router.push(pushParams(null, null, undefined, JSON.stringify(dfaRows), JSON.stringify(location_header)));
        })
        .catch((e) => {
          Alert.alert('Bağlantı Hatası', e?.message ?? 'Rapor verisi alınamadı.');
        });
      return;
    }
    const sq = q as SavedQuery;
    router.push(pushParams(
      sq.price_snapshot?.unit_price,
      sq.price_snapshot?.total_price,
      sq.createdAt,
      Array.isArray(sq.dfaRows) && sq.dfaRows.length > 0 ? JSON.stringify(sq.dfaRows) : '',
      sq.location_header ? JSON.stringify(sq.location_header) : ''
    ));
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

  // 3D editör açılırken seçili/tek parseli otomatik seçtirmek için
  const initialParcelFor3d = useMemo(() => {
    const p = activeParcelData as any;
    if (!p?.geometry) return null;
    const props = (p?.properties || {}) as any;
    const mahalle = String(props.mahalleAd ?? props.mahalle ?? "").trim();
    const ada = String(props.adaNo ?? props.ada ?? "").trim();
    const parsel = String(props.parselNo ?? props.parsel ?? "").trim();
    const id = (p?.id != null ? String(p.id) : (mahalle || ada || parsel ? `${mahalle}|${ada}|${parsel}` : "active_parcel"));
    return { id, geometry: p.geometry, properties: props };
  }, [activeParcelData]);

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

  // Profil verilerini yükle (avatar için)
  const loadUserProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setUserProfile(null);
      return;
    }

    try {
      const response = await authService.getProfile();
      if (response.success && response.data?.profile) {
        setUserProfile(response.data.profile);
      }
    } catch (error) {
      console.error('[Index] Profil yükleme hatası:', error);
    }
  }, [isAuthenticated]);

  // Profil verilerini yükle
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Kredi bakiyesini API'den güncel olarak yükle (veritabanından gerçek kullanım hakkı)
  const loadCreditBalance = useCallback(async () => {
    if (!isAuthenticated) {
      setCreditBalance(null);
      return;
    }
    setIsLoadingCredit(true);
    try {
      const response = await creditService.getBalance();
      if (response.success && response.data != null) {
        setCreditBalance(response.data.balance);
      } else {
        setCreditBalance(null);
      }
    } catch (error) {
      console.error('[Index] Kredi bakiyesi yüklenemedi:', error);
      setCreditBalance(null);
    } finally {
      setIsLoadingCredit(false);
    }
  }, [isAuthenticated]);

  // İlk mount'ta ve her sayfa girişinde / başka sayfalardan geri gelindiğinde bakiyeyi güncelle
  useEffect(() => {
    if (isAuthenticated) loadCreditBalance();
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      loadCreditBalance();
      loadUserProfile();
    }, [loadCreditBalance, loadUserProfile])
  );

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
      getCoinAwardContext: () => shareCoinContextRef.current,
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
    // Fiyat girme kriterleri sağlanıyorsa ama kullanıcı fiyat girmediyse:
    // - "Tamam" → fiyat panelini aç
    // - "İstemiyorum" → paylaş ama coin verme
    const totalNum0 = parseTurkishPrice(screenshotTotalPriceInput);
    const hasTotal0 = (screenshotTotalPriceInput || '').trim().length > 0 && totalNum0 > 0;
    if (hasActiveParcel && canOpenPricePanel && !hasTotal0) {
      setPriceWarningVisible(true);
      return;
    }
    await doConfirmScreenshot(false);
  }, [hasActiveParcel, canOpenPricePanel, screenshotTotalPriceInput, screenshotAreaNum, screenshotMergedProps, saveUserPrintScreenPrice, handleShare]);

  const doConfirmScreenshot = useCallback(async (skipCoinBecauseNoPrice: boolean) => {
    setScreenshotPreviewMode(false);

    // Arazi yoksa: fiyat alanları pasif + screenshot sadece harita olacak (container mapOnly)
    if (!hasActiveParcel) {
      shareCoinContextRef.current = { awardCoin: false };
      setScreenshotPriceOverride(null);
      setIsProcessingShare(true);
      try {
        await handleShare();
      } catch (error) {
        // handleShare zaten alert/log yapıyor
      } finally {
        shareCoinContextRef.current = { awardCoin: true };
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
      // Coin sadece fiyat girildiyse (ve kullanıcı özellikle istemiyorum demediyse)
      if (skipCoinBecauseNoPrice) {
        shareCoinContextRef.current = { awardCoin: false };
      } else if (hasTotal) {
        shareCoinContextRef.current = { awardCoin: true, priceText: (screenshotTotalPriceInput || '').trim() };
      } else {
        shareCoinContextRef.current = { awardCoin: false };
      }
      await handleShare();
    } catch (error) {
      // handleShare zaten alert/log yapıyor
    } finally {
      shareCoinContextRef.current = { awardCoin: true };
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
        console.log('[handleAdaParselSubmit] PRO MOD: Başlangıç, isProMode:', isProMode);
        // Pro mod: Önce TKGM sorgusu yap, parseli çiz, sonra onay al (property type modal onaydan sonra açılacak)
        console.log('[handleAdaParselSubmit] PRO MOD: TKGM sorgusu başlatılıyor...');
        const tkgmResponse = await fetch(`${backendUrl}/api/tkgm_view/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, map_mode: '2d', is3D: is3DMode })
        });
        
        if (!tkgmResponse.ok) {
          console.error('[handleAdaParselSubmit] PRO MOD: TKGM sorgusu başarısız');
          throw new Error();
        }
        const tkgmData = await tkgmResponse.json();
        console.log('[handleAdaParselSubmit] PRO MOD: TKGM sorgusu tamamlandı, geometry var mı:', !!tkgmData.geometry);
        
        if (!tkgmData.geometry) {
          console.warn('[handleAdaParselSubmit] PRO MOD: Geometry yok, işlem sonlandırılıyor');
          setIsLoadingParcel(false);
          return;
        }

        // Parseli haritada çiz (kullanıcı onaylamadan önce parseli görsün)
        try {
          setParcelData({ geometry: tkgmData.geometry, properties: tkgmData.properties || {}, analysisData: null });
          const s = calculateBoundsAndCamera(tkgmData.geometry);
          if (s && cameraRef.current) {
            setTimeout(() => {
              try {
                cameraRef.current?.setCamera?.({
                  centerCoordinate: s.center,
                  zoomLevel: s.zoom,
                  pitch: camRef.current.pitch,
                  animationDuration: 900,
                });
              } catch (_) {}
            }, 100);
          }
          // Formu kapat
          setActiveScreen(null);
        } catch (_) {}

        // Nitelik metnini çıkar (property type modal başlığı onaydan sonra kullanılacak)
        const nitelikText = extractNitelikText(tkgmData);
        const { title, suggestedType } = generatePropertyTypeTitle(nitelikText);
        
        setPendingTkgmData(tkgmData);
        setPendingCoordinates(null); // Ada/Parsel sorgusunda koordinat yok
        setPropertyTypeModalTitle(title);
        setPropertyTypeModalSuggested(suggestedType);
        console.log('[handleAdaParselSubmit] PRO MOD: Overlay kapatılıyor ve onay modal açılıyor');
        // Overlay kapat ve onay modal'ı aç
        setIsLoadingParcel(false);
        setProQueryConfirmVisible(true);
        console.log('[handleAdaParselSubmit] PRO MOD: setIsLoadingParcel(false) ve setProQueryConfirmVisible(true) çağrıldı');
      } else {
        console.log('[handleAdaParselSubmit] BASIT MOD: Başlangıç, isProMode:', isProMode);
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

  // Basit moda geçtikten sonra pending payload varsa otomatik sorgu çalıştır
  useEffect(() => {
    if (isProMode) return;
    const payload = pendingDeepLinkPayloadRef.current;
    if (!payload) return;
    pendingDeepLinkPayloadRef.current = null;
    // Ada/Parsel formunu kapat, direkt sorgula
    setActiveScreen(null);
    handleAdaParselSubmit(payload);
  }, [isProMode, handleAdaParselSubmit]);
  
  // Pro moda geçtikten sonra navigation'dan gelen pro query varsa otomatik çalıştır
  useEffect(() => {
    if (!isProMode) return;
    const payload = pendingNavProQueryRef.current;
    if (!payload) return;
    pendingNavProQueryRef.current = null;
    console.log('[Index] Pro query başlatılıyor (navigation params):', payload);
    // Ada/Parsel formunu kapat, direkt pro sorgula
    setActiveScreen(null);
    handleAdaParselSubmit(payload);
  }, [isProMode, handleAdaParselSubmit]);

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
    
    // Info mode kontrolü: Basit modda info mode aktif değilse parsel sorgusu yapma
    // Pro modda info mode kontrolü yok - direkt sorgu yapılabilir
    if (!infoModeActive && !isProMode) {
      // Basit modda info mode aktif değilse sadece mevcut parsel modal açma işlemi yapılabilir
      const clickedParcel = simpleModeParcels.find(p => p.geometry && isPointInParcel(c!, p.geometry));
      if (clickedParcel) {
        // Farklı bir parsel seçiliyorsa kenar ölçülerini kapat
        if (selectedParcelForModal?.id !== clickedParcel.id) {
          setShowEdgeMeasurements(false);
        }
        setSelectedParcelForModal(clickedParcel);
        setParcelModalVisible(true);
      }
      return;
    }
    
    // Pro modda: Info mode aktif değilse bile mevcut parsel modal açma işlemi yapılabilir
    if (!infoModeActive && isProMode) {
      // Pro modda: Tıklanan nokta mevcut parselin içindeyse modal aç
      if (parcelData?.geometry && isPointInParcel(c, parcelData.geometry)) {
        if (parcelData.analysisData) {
          setParcelModalVisible(true);
        }
      }
      // Pro modda info mode aktif değilse bile sorgu yapılabilir, bu yüzden return etmiyoruz
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
    
    console.log('[handleMapPress] Başlangıç, isProMode:', isProMode, 'koordinat:', c);
    setIsLoadingParcel(true);
    // Pro modda parcelData temizle, basit modda array'e ekleyeceğiz
    if (isProMode) {
      console.log('[handleMapPress] PRO MOD: parcelData temizleniyor');
      setParcelData(null);
    }
    
    const backendUrl = (API_URL || '').replace(/\/$/, '');
    
    try {
      console.log('[handleMapPress] TKGM sorgusu başlatılıyor, isProMode:', isProMode);
      
      // Direkt TKGM API çağrısı (fallback ile)
      let data;
      try {
        data = await fetchTkgmByCoordsWithFallback(c[1], c[0], backendUrl);
      } catch (error: any) {
        // Özel durum: TKGM "Parsel Bulunamadı"
        if (error.type === 'TKGM_PARCEL_NOT_FOUND') {
          console.log('[handleMapPress] Parsel bulunamadı');
          setIsLoadingParcel(false);
          return;
        }
        
        // Diğer hatalar
        console.error('[handleMapPress] TKGM sorgusu başarısız:', error);
        throw error;
      }
      console.log('[handleMapPress] TKGM sorgusu tamamlandı, geometry var mı:', !!data.geometry, 'isProMode:', isProMode);
      
      if (!data.geometry) {
        console.warn('[handleMapPress] Geometry yok, işlem sonlandırılıyor');
        setIsLoadingParcel(false);
        return;
      }

      if (isProMode) {
        console.log('[handleMapPress] PRO MOD: Pro mod akışı başlatılıyor');
        // Pro mod: Önce parseli çiz + onay al, sonra property type modal aç
        const nitelikText = extractNitelikText(data);
        const { title, suggestedType } = generatePropertyTypeTitle(nitelikText);

        // Parseli haritada çiz
        try {
          setParcelData({ geometry: data.geometry, properties: data.properties || {}, analysisData: null });
          const s = calculateBoundsAndCamera(data.geometry);
          if (s) cameraRef.current?.setCamera?.({ centerCoordinate: s.center, zoomLevel: s.zoom, pitch: camRef.current.pitch, animationDuration: 900 });
        } catch (_) {}
        
        setPendingTkgmData(data);
        setPendingCoordinates(c);
        setPropertyTypeModalTitle(title);
        setPropertyTypeModalSuggested(suggestedType);
        setInfoModeActive(false); // Parsel seçildi, info mode'u pasif yap
        console.log('[handleMapPress] PRO MOD: Overlay kapatılıyor ve onay modal açılıyor');
        // Overlay kapat ve onay modal'ı aç
        setIsLoadingParcel(false);
        setProQueryConfirmVisible(true);
        console.log('[handleMapPress] PRO MOD: setIsLoadingParcel(false) ve setProQueryConfirmVisible(true) çağrıldı');
      } else {
        console.log('[handleMapPress] BASIT MOD: Basit mod akışı, array\'e ekleniyor');
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
    // Ngrok üzerinden erişim için API_URL base'ini kullan
    // API_URL genelde FastAPI için (8001), Django için aynı base URL'i port 8000 ile kullan
    let djangoBackendUrl = API_URL;
    // Port 8001'i 8000'e çevir (ngrok aynı base URL'i kullanır)
    if (djangoBackendUrl.includes(':8001')) {
      djangoBackendUrl = djangoBackendUrl.replace(':8001', ':8000');
    }
    // /api path'ini kaldır (Django'da /api prefix yok)
    djangoBackendUrl = djangoBackendUrl.replace('/api', '').replace(/\/$/, '');
    
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
    console.log('[handlePropertyTypeSelect] Başlangıç, propertyType:', propertyType, 'pendingTkgmData var mı:', !!pendingTkgmData);
    if (!pendingTkgmData) {
      console.warn('[handlePropertyTypeSelect] pendingTkgmData yok, işlem sonlandırılıyor');
      setPropertyTypeModalVisible(false);
      return;
    }

    // --- Villa: VillaEstimateModal ac ---
    if (propertyType === 'Villa') {
      console.log('[handlePropertyTypeSelect] Villa tipi secildi, VillaEstimateModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setVillaEstimateModalVisible(true);
      return;
    }

    // --- Fabrika / Fabrika Arsası: FactoryEstimateModal ac ---
    if (propertyType === 'Fabrika' || propertyType === 'Fabrika Arsası') {
      console.log('[handlePropertyTypeSelect] Fabrika tipi secildi, FactoryEstimateModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setPendingFactoryPropertyType(propertyType);
      setFactoryEstimateModalVisible(true);
      return;
    }

    console.log('[handlePropertyTypeSelect] Overlay açılıyor ve pro sorgu başlatılıyor');
    setIsLoadingParcel(true);
    setPropertyTypeModalVisible(false);

    const backendUrl = (API_URL || '').replace(/\/$/, '');
    
    try {
      console.log('[handlePropertyTypeSelect] Ana pro sorgusu başlatılıyor...');
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

      if (!response.ok) {
        console.error('[handlePropertyTypeSelect] Pro sorgu başarısız, response.ok:', response.ok);
        throw new Error();
      }
      
      const data = await response.json();
      console.log('[handlePropertyTypeSelect] Pro sorgu tamamlandı, data keys:', Object.keys(data));
      if (data.error) {
        console.error('[handlePropertyTypeSelect] Backend hata:', data.error);
        throw new Error(data.error);
      }

      // Geometri opsiyonel - yoksa harita güncellenmez ama rapor açılır
      const geometryRaw = data.geometry || data.parameters_polygons?.parcel_polygon;
      let normalizedGeometry: any = null;
      if (geometryRaw) {
        normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
        setShowEdgeMeasurements(false);
        setParcelData({
          geometry: normalizedGeometry,
          properties: { ...data.properties, ...data.parameters_data?.parcel_values },
          analysisData: data
        });
        console.log('[handlePropertyTypeSelect] Geometry bulundu, parsel data güncellendi');
      } else {
        console.warn('[handlePropertyTypeSelect] Geometry yok, rapor yine açılacak');
      }

      // Mobil: Rapor için minimal payload (DFA + parsel eğimi + konum); kaydet + report_mobil_viewver ekranına geç
      const pd: any = data?.parameters_data || {};
      const pv: any = pd?.parcel_values || {};
      const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};
      const propsData: any = data?.properties || {};

      const proparcelValue =
        (pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null);
      const tkgmValue = (tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null);

      const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
      const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';

      const unitStr = pv?.unite_price ?? null;
      const totalStr = pv?.price_of_tarla ?? null;
      const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
      const totalNum = totalStr ? parseTurkishPrice(totalStr) : null;

      const areaRaw = pv?.arazi_m2 ?? pv?.area_m2 ?? pv?.alan ?? pv?.yuzolcum;
      const areaM2 = parseAreaM2(areaRaw);
      const valuationSteps = Array.isArray(pd?.valuation_steps) ? pd.valuation_steps : [];
      const dfaRows = buildDfaRowsFromValuationSteps(valuationSteps, areaM2);

      const propertiesSlice: ReportLocationHeader = {
        ilAd: propsData?.ilAd ?? pv?.ilAd ?? null,
        ilceAd: propsData?.ilceAd ?? pv?.ilceAd ?? null,
        mahalleAd: propsData?.mahalleAd ?? pv?.mahalleAd ?? null,
        adaNo: pv?.adaNo ?? pv?.ada ?? (adaVal || null),
        parselNo: pv?.parselNo ?? pv?.parsel ?? (parselVal || null),
      };

      const pg: any = data?.parameters_graphics || {};
      const parametersGraphicsSlice = {
        ...(pg.parcel_slope_graphics != null && { parcel_slope_graphics: pg.parcel_slope_graphics }),
        ...(pg.slope_surface != null && { slope_surface: pg.slope_surface }),
      };

      const reportPayload: ReportPayload = {
        properties: propertiesSlice,
        valuation_steps: valuationSteps,
        parameters_graphics: Object.keys(parametersGraphicsSlice).length ? parametersGraphicsSlice : undefined,
        dfaRows,
      };

      const cacheId = String(Date.now());
      putReportMemory(cacheId, reportPayload);

      // Kayıt işlemleri (hata olursa navigasyonu engellemesin)
      try {
        if (tkgmValue && adaVal && parselVal) {
          await upsertSavedQuery({
            proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
            tkgm_value: Number(tkgmValue),
            ada: String(adaVal),
            parsel: String(parselVal),
            price_snapshot: { unit_price: unitNum, total_price: totalNum },
            dfaRows,
            location_header: propertiesSlice,
            geometry: normalizedGeometry || undefined,
          });
          if (isAuthenticated) {
            createSavedQueryApi({
              tkgm_value: Number(tkgmValue),
              ada: String(adaVal),
              parsel: String(parselVal),
              title: `${adaVal}/${parselVal}`,
              proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
            }).catch(() => {});
          }
        }
      } catch (saveErr) {
        console.warn('[handlePropertyTypeSelect] save failed:', saveErr);
      }

      router.push({
        pathname: '/routes/report_mobil_viewver',
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

      if (normalizedGeometry) {
        const settings = calculateBoundsAndCamera(normalizedGeometry);
        if (settings && cameraRef.current) {
          setTimeout(() => cameraRef.current.setCamera({
            centerCoordinate: settings.center,
            zoomLevel: settings.zoom,
            pitch: camRef.current.pitch,
            animationDuration: 900
          }), 100);
        }
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
      console.log('[handlePropertyTypeSelect] İşlem başarıyla tamamlandı, overlay kapatılıyor');
    } catch (error) {
      console.error('[handlePropertyTypeSelect] Ana pro sorgu hatası:', error);
      Alert.alert(
        'Bağlantı Hatası',
        'Backend sunucusuna bağlanılamadı. Lütfen Django (8000) ve FastAPI (8001) sunucularının çalıştığından emin olun.',
        [{ text: 'Tamam' }]
      );
    } finally {
      console.log('[handlePropertyTypeSelect] finally: setIsLoadingParcel(false) çağrılıyor');
      setIsLoadingParcel(false);
    }
  }, [pendingTkgmData, pendingCoordinates, is3DMode, router, isAuthenticated]);

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
      <View
        testID="header-container"
        style={[styles.header, !isProMode && { borderBottomColor: '#ffffff' }]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            testID="query-mode-toggle"
            onPress={() => setIsProMode(prev => !prev)}
            activeOpacity={0.85}
            style={styles.headerModeImgBtn}
          >
            <Image
              source={isProMode ? ProModeButtonImg : SimpleModeButtonImg}
              style={styles.headerModeImg}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>ProParcel</Text>
        </View>
        <View style={styles.headerRight}>
          {isAuthenticated && (user?.role === 'vip' || user?.role === 'vip_limited') && (
            <View style={styles.topbarVipBadge}>
              <Ionicons name="star" size={11} color="#fff" />
              <Text style={styles.topbarVipText}>VIP</Text>
            </View>
          )}
          <TouchableOpacity
            testID="credit-badge"
            style={styles.creditBadge}
            onPress={() => router.push('pricing')}
            activeOpacity={0.7}
          >
            <Image source={TepeCoinIcon} style={styles.creditBadgeIcon} resizeMode="contain" />
            <Text style={styles.creditBadgeText}>
              {isAuthenticated && creditBalance !== null ? creditBalance.toLocaleString('tr-TR') : '—'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="menu-open-button"
            style={styles.headerButton}
            onPress={() => {
              setSubmenuOpenId(null);
              setUzmanGorusuOpen(false);
              setMenuVisible(true);
            }}
          >
            <View style={styles.headerMenuIconWrapper}>
              <Ionicons name="menu" size={28} color="#fff" />
              {isAuthenticated && notificationsUnread > 0 ? (
                <View
                  testID="menu-unread-dot"
                  style={[styles.headerMenuUnreadDot, !isProMode && styles.headerMenuUnreadDotSimple]}
                />
              ) : null}
            </View>
          </TouchableOpacity>
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
            {/* 3D editör açıkken ana haritayı unmount et: iki MapView aynı anda OOM (607MB alloc) yapıyor */}
            {Mapbox && !shapeDrawingModalVisible ? (
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
                  {shapeDrawingModalVisible
                    ? '3D Model Editörü açık'
                    : 'Mapbox yükleniyor...\nEğer bu mesaj uzun süre görünüyorsa, uygulamayı yeniden başlatın.'}
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
        <ProModeThreeLoader visible={(() => {
          const shouldShow = !!(isProMode && isLoadingParcel && !proQueryConfirmVisible && !propertyTypeModalVisible);
          if (isProMode) {
            console.log('[ProModeThreeLoader] visible kontrolü:', {
              isProMode,
              isLoadingParcel,
              proQueryConfirmVisible,
              propertyTypeModalVisible,
              shouldShow
            });
          }
          return shouldShow;
        })()} />
        <ParcelSearchModal visible={activeScreen === 'ada-parsel'} onClose={handleCloseForm} onSubmit={handleAdaParselSubmit} />
        <MyQueriesModal
          visible={myQueriesVisible}
          onClose={() => setMyQueriesVisible(false)}
          onSelect={handleSelectSavedQuery}
          isAuthenticated={isAuthenticated}
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
            initialParcel={initialParcelFor3d ?? undefined}
          />
        </ErrorBoundary>
      </View>

      {activeScreen === null && !screenshotPreviewMode && !proQueryConfirmVisible && !propertyTypeModalVisible && (
        <View testID="bottom-pill-bar-container" style={[styles.bottomFloatingContainer, { bottom: 20 + insets.bottom }]}>
          {rulerQuickMenuVisible && (
            <View
              style={{ position: 'absolute', bottom: 60, left: getSubMenuLeft(rulerButtonLayout, rulerQuickMenuWidth) }}
              pointerEvents="auto"
              onStartShouldSetResponder={() => true}
            >
              <View
                testID="ruler-quick-menu"
                style={[styles.rulerSubMenu, !isProMode && { borderColor: '#ffffff' }, { minWidth: 140 }]}
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
                style={[styles.rulerSubMenu, !isProMode && { borderColor: '#ffffff' }]}
                pointerEvents="auto"
                onLayout={(e) => {
                  const w = e?.nativeEvent?.layout?.width;
                  if (typeof w === 'number' && w > 0) setRulerMenuWidth(w);
                }}
              >
                <TouchableOpacity
                  testID="hisseli-parsellere-bol-opt"
                  style={styles.rulerSubMenuItem}
                  onPress={() => {
                    ignoreNextMapPressRef.current = true;
                    menuItemClickedRef.current = true;
                    setRulerMenuVisible(false);
                    setLocationMenuVisible(false);
                    const targetParcel = isProMode ? parcelData : (selectedParcelForModal || (simpleModeParcels.length > 0 ? simpleModeParcels[simpleModeParcels.length - 1] : null));
                    if (!targetParcel?.geometry) {
                      Alert.alert('Uyarı', 'Parsel seçiniz.');
                      return;
                    }
                    const props = targetParcel.properties || {};
                    const mahalle = props.mahalleAd ?? props.mahalle ?? '';
                    const ada = props.adaNo ?? props.ada ?? '';
                    const parsel = props.parselNo ?? props.parsel ?? '';
                    router.push({
                      pathname: 'parcel-split',
                      params: {
                        parentPolygon: JSON.stringify(targetParcel.geometry),
                        parcelId: 'id' in targetParcel && targetParcel.id != null ? String(targetParcel.id) : undefined,
                        mahalle,
                        ada,
                        parsel,
                      },
                    });
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="git-branch-outline" size={18} color="#fff" />
                    <Text style={styles.rulerSubMenuText}>Hisseli Parsellere Böl</Text>
                  </View>
                </TouchableOpacity>
                <View style={[styles.rulerSubMenuDivider, !isProMode && styles.rulerSubMenuDividerSimple]} />
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
                <View style={[styles.rulerSubMenuDivider, !isProMode && styles.rulerSubMenuDividerSimple]} />
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
                <View style={[styles.rulerSubMenuDivider, !isProMode && styles.rulerSubMenuDividerSimple]} />
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
                <View style={[styles.rulerSubMenuDivider, !isProMode && styles.rulerSubMenuDividerSimple]} />
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
                <View style={[styles.rulerSubMenuDivider, !isProMode && styles.rulerSubMenuDividerSimple]} />
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
                style={[styles.locationSubMenu, !isProMode && { borderColor: '#ffffff' }]}
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
                <View style={[styles.locationSubMenuDivider, !isProMode && styles.locationSubMenuDividerSimple]} />
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
                <View style={[styles.locationSubMenuDivider, !isProMode && styles.locationSubMenuDividerSimple]} />
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
                <View style={[styles.locationSubMenuDivider, !isProMode && styles.locationSubMenuDividerSimple]} />
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
            style={[styles.pillBar, !isProMode && { borderColor: '#ffffff' }]}
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
              <MaterialCommunityIcons
                name="ruler"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
            <TouchableOpacity
              testID="location-tools-button"
              onLayout={(e) => {
                const { x, width } = e?.nativeEvent?.layout || {};
                if (typeof x === 'number' && typeof width === 'number') setLocationButtonLayout({ x, width });
              }}
              onPress={handleLocationButtonPress}
              style={[styles.pillButton, getButtonActiveStyle('location')]}
            >
              <Ionicons
                name="locate"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
            <TouchableOpacity testID="refresh-button" onPress={handleRefresh} style={styles.pillButton}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
            <TouchableOpacity
              testID="3d-building-button"
              onPress={() => {
                ignoreNextMapPressRef.current = true;
                menuItemClickedRef.current = true;
                setRulerMenuVisible(false);
                setRulerQuickMenuVisible(false);
                setLocationMenuVisible(false);
                setShow3DSlider(false);
                openModelEditorOrRequireAuth();
              }}
              style={styles.pillButton}
            >
              <MaterialCommunityIcons name="home-group" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
            <TouchableOpacity testID="camera-share-button" onPress={handleCameraPress} style={styles.pillButton}>
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
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
              <MaterialCommunityIcons
                name="terrain"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
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
              <Ionicons
                name="information-circle"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <View style={[styles.pillDivider, !isProMode && styles.pillDividerSimple]} />
            <TouchableOpacity testID="search-button" onPress={() => setActiveScreen('ada-parsel')} style={styles.pillButton}>
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* 3D Submenu kaldırıldı: dağlar direkt terrain açar, bina ayrı buton */}

      {/* Ana Menü Modal */}
      <AppBottomSheetModal
        visible={menuVisible}
        onClose={closeMenu}
        snapPoints={["55%", "88%"]}
        index={menuSheetIndex}
        initialIndex={0}
        variant="dark"
      >
        <View style={{ paddingBottom: insets.bottom }}>
          <View style={styles.menuModalHeader}>
            <TouchableOpacity
              style={styles.menuModalUserRow}
              onPress={() => { closeMenu(); router.push('profile'); }}
              activeOpacity={0.7}
              accessibilityLabel={isAuthenticated ? 'Profili aç' : 'Giriş yap'}
            >
              {isAuthenticated ? (() => {
                const avatarUrl = userProfile?.avatar_url || userProfile?.avatar;
                const isApproved = userProfile?.avatar_approved === true;
                const fullName = userProfile
                  ? [userProfile.first_name, userProfile.last_name]
                      .filter(Boolean)
                      .map((s) => (s.charAt(0).toUpperCase() + (s.slice(1) || '').toLowerCase()))
                      .join(' ') || user?.full_name || user?.email || 'Kullanıcı'
                  : (user?.full_name || user?.email || 'Kullanıcı');
                const canShowExpert = user?.role === "consultant" || user?.role === "broker";
                const isVip = user?.role === "vip" || user?.role === "vip_limited";
                const current = (userProfile as any)?.expert_score_current ?? 0;
                const peak = (userProfile as any)?.expert_score_peak ?? 0;
                const level = (userProfile as any)?.expert_level as string | null | undefined;
                const levelLabel =
                  level === "platinum" ? "Platin" :
                  level === "gold" ? "Altın" :
                  level === "silver" ? "Gümüş" :
                  level === "bronze" ? "Bronz" :
                  "";
                if (avatarUrl && isApproved) {
                  return (
                    <>
                      <Image source={{ uri: avatarUrl }} style={styles.menuModalAvatar} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.menuModalUserName, { flexShrink: 1 }]} numberOfLines={1}>{fullName}</Text>
                          {isVip && (
                            <View style={styles.menuModalVipBadge}>
                              <Ionicons name="star" size={10} color="#fff" />
                              <Text style={styles.menuModalVipText}>VIP</Text>
                            </View>
                          )}
                        </View>
                        {canShowExpert ? (
                          <Text style={styles.menuModalUserMeta} numberOfLines={1}>
                            Uzmanlık Puanı: {Number(current || 0)}{levelLabel ? ` (${levelLabel})` : ""} • Peak: {Number(peak || 0)}
                          </Text>
                        ) : null}
                      </View>
                    </>
                  );
                }
                return (
                  <>
                    <View style={styles.menuModalAvatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#94a3b8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.menuModalUserName, { flexShrink: 1 }]} numberOfLines={1}>{fullName}</Text>
                        {isVip && (
                          <View style={styles.menuModalVipBadge}>
                            <Ionicons name="star" size={10} color="#fff" />
                            <Text style={styles.menuModalVipText}>VIP</Text>
                          </View>
                        )}
                      </View>
                      {canShowExpert ? (
                        <Text style={styles.menuModalUserMeta} numberOfLines={1}>
                          Uzmanlık Puanı: {Number(current || 0)}{levelLabel ? ` (${levelLabel})` : ""} • Peak: {Number(peak || 0)}
                        </Text>
                      ) : null}
                    </View>
                  </>
                );
              })() : (
                <>
                  <View style={styles.menuModalAvatarPlaceholder}>
                    <Ionicons name="person-outline" size={24} color="#94a3b8" />
                  </View>
                  <Text style={styles.menuModalUserName}>Giriş yapın</Text>
                </>
              )}
            </TouchableOpacity>
            {isAuthenticated && creditBalance !== null && (
              <TouchableOpacity
                style={styles.menuModalCreditBadge}
                onPress={() => { closeMenu(); router.push('pricing'); }}
                activeOpacity={0.7}
              >
                <Image source={TepeCoinIcon} style={styles.menuModalCreditIcon} resizeMode="contain" />
                <Text style={styles.menuModalCreditText}>{creditBalance.toLocaleString('tr-TR')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.menuModalHeaderSpacer} />

          <BottomSheetScrollView style={styles.menuModalList} contentContainerStyle={{ flexGrow: 1 }} scrollEventThrottle={16} nestedScrollEnabled={true}>
            {getMenuItems(isProMode, isAuthenticated).map((item) => (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  style={[
                    styles.menuModalItem,
                    item.disabled && styles.menuModalItemDisabled,
                  ]}
                  disabled={item.disabled}
                  onPress={() => {
                    if (!item.disabled) handleMenuItemPress(item.id);
                  }}
                >
                  <View style={styles.menuModalItemContent}>
                    {item.icon === 'cube' ? (
                      <MaterialCommunityIcons
                        name="cube"
                        size={24}
                        color={item.disabled ? '#64748b' : '#e2e8f0'}
                      />
                    ) : item.icon === 'terrain' ? (
                      <MaterialCommunityIcons
                        name="terrain"
                        size={24}
                        color={item.disabled ? '#64748b' : '#e2e8f0'}
                      />
                    ) : item.icon === 'layers' ? (
                      <MaterialCommunityIcons
                        name="layers"
                        size={24}
                        color={item.disabled ? '#64748b' : '#e2e8f0'}
                      />
                    ) : item.icon === 'folder' ? (
                      <Ionicons name="folder" size={24} color={item.disabled ? '#64748b' : '#e2e8f0'} />
                    ) : item.id === 'kredi-paketleri' ? (
                      <Image source={TepeCoinIcon} style={{ width: 24, height: 24 }} resizeMode="contain" />
                    ) : (
                      <Ionicons name={item.icon as any} size={24} color={item.disabled ? '#64748b' : '#e2e8f0'} />
                    )}
                    <Text
                      style={[
                        styles.menuModalItemText,
                        item.disabled && styles.menuModalItemTextDisabled,
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.id === "bildirimler" && notificationsUnread > 0 && (
                      <View style={styles.menuModalUnreadBadge}>
                        <Text style={styles.menuModalUnreadBadgeText}>
                          {notificationsUnread > 99 ? "99+" : String(notificationsUnread)}
                        </Text>
                      </View>
                    )}
                    {(item as any).hasSubmenu && (
                      <Ionicons
                        name={submenuOpenId === 'dosyalarim' ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#94a3b8"
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
                {item.id === 'dosyalarim' && submenuOpenId === 'dosyalarim' && (
                  <>
                    <TouchableOpacity
                      style={[styles.menuModalItem, styles.menuModalSubItem]}
                      onPress={() => handleMenuItemPress('sorgularim')}
                    >
                      <View style={styles.menuModalItemContent}>
                        <Ionicons name="list" size={22} color="#e2e8f0" style={{ marginLeft: 8 }} />
                        <Text style={styles.menuModalItemText}>Sorgularım</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.menuModalItem, styles.menuModalSubItem]}
                      onPress={() => handleMenuItemPress('hisseli-parsel-projelerim')}
                    >
                      <View style={styles.menuModalItemContent}>
                        <MaterialCommunityIcons name="file-document-outline" size={22} color="#e2e8f0" style={{ marginLeft: 8 }} />
                        <Text style={styles.menuModalItemText}>Hisseli Parsel Projelerim</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.menuModalItem, styles.menuModalSubItem]}
                      onPress={() => handleMenuItemPress('3d-tasarimlarim')}
                    >
                      <View style={styles.menuModalItemContent}>
                        <Ionicons name="cube-outline" size={22} color="#e2e8f0" style={{ marginLeft: 8 }} />
                        <Text style={styles.menuModalItemText}>3D Tasarımlarım</Text>
                      </View>
                    </TouchableOpacity>
                    {/* Uzman Görüşleri - Açılır Alt Menü */}
                    <TouchableOpacity
                      style={[styles.menuModalItem, styles.menuModalSubItem]}
                      onPress={() => setUzmanGorusuOpen((prev) => !prev)}
                    >
                      <View style={styles.menuModalItemContent}>
                        <Ionicons name="person-outline" size={22} color="#e2e8f0" style={{ marginLeft: 8 }} />
                        <Text style={styles.menuModalItemText}>Uzman Görüşleri</Text>
                        {(expertMyRepliesUnread > 0 || expertIncomingUnread > 0) && (
                          <View style={[
                            styles.menuModalUnreadBadgeGreen,
                            expertIncomingUnread > 0 && styles.menuModalUnreadBadgeRed
                          ]}>
                            <Text style={styles.menuModalUnreadBadgeText}>
                              {(expertMyRepliesUnread + expertIncomingUnread) > 99 ? "99+" : String(expertMyRepliesUnread + expertIncomingUnread)}
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          name={uzmanGorusuOpen ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#94a3b8"
                          style={{ marginLeft: 'auto' }}
                        />
                      </View>
                    </TouchableOpacity>
                    {/* Uzman Görüşleri Alt Menüleri */}
                    {uzmanGorusuOpen && (
                      <>
                        <TouchableOpacity
                          style={[styles.menuModalItem, styles.menuModalSubItem, styles.menuModalSubSubItem]}
                          onPress={() => handleMenuItemPress('uzman-gorusu-isteklerim')}
                        >
                          <View style={styles.menuModalItemContent}>
                            <Ionicons name="paper-plane-outline" size={20} color="#e2e8f0" style={{ marginLeft: 16 }} />
                            <Text style={styles.menuModalItemText}>İsteklerim</Text>
                            {expertMyRepliesUnread > 0 ? (
                              <View style={styles.menuModalUnreadBadgeGreen}>
                                <Text style={styles.menuModalUnreadBadgeText}>
                                  {expertMyRepliesUnread > 99 ? "99+" : String(expertMyRepliesUnread)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                        {(user?.role === "consultant" || user?.role === "broker") && (
                          <TouchableOpacity
                            style={[styles.menuModalItem, styles.menuModalSubItem, styles.menuModalSubSubItem]}
                            onPress={() => handleMenuItemPress('uzman-gorusu-gelen')}
                          >
                            <View style={styles.menuModalItemContent}>
                              <Ionicons name="download-outline" size={20} color="#e2e8f0" style={{ marginLeft: 16 }} />
                              <Text style={styles.menuModalItemText}>Gelen Talepler</Text>
                              {expertIncomingUnread > 0 ? (
                                <View style={styles.menuModalUnreadBadgeRed}>
                                  <Text style={styles.menuModalUnreadBadgeText}>
                                    {expertIncomingUnread > 99 ? "99+" : String(expertIncomingUnread)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </>
                )}
              </React.Fragment>
            ))}
            <View style={[styles.menuModalFooterSpacer, { height: 56 + insets.bottom }]} />
          </BottomSheetScrollView>
        </View>
      </AppBottomSheetModal>

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
        onGetDirections={handleGetDirections}
        onStreetView={handleStreetViewPress}
        onToggle3D={toggle3DMode}
        is3DMode={is3DMode}
        onSwitchToProMode={() => {
          if (!isProMode) {
            setIsProMode(true);
          }
        }}
      />
      <ProQueryConfirmModal
        visible={proQueryConfirmVisible}
        tkgmData={pendingTkgmData}
        onCancel={() => {
          console.log('[ProQueryConfirmModal] onCancel: İptal edildi, pro akışı sonlandırılıyor');
          setProQueryConfirmVisible(false);
          // Reddederse: parsel çizimi ekranda kalsın, pro akışı iptal olsun
          setPendingTkgmData(null);
          setPendingCoordinates(null);
          console.log('[ProQueryConfirmModal] onCancel: State temizlendi');
        }}
        onConfirm={() => {
          console.log('[ProQueryConfirmModal] onConfirm: Onay verildi, nitelik modal açılıyor');
          // Overlay zaten kapalı (onay modal açılırken kapanmış olacak)
          // Sadece modal geçişi yap: onay modal kapat, nitelik modal aç
          setProQueryConfirmVisible(false);
          setPropertyTypeModalVisible(true);
          console.log('[ProQueryConfirmModal] onConfirm: setProQueryConfirmVisible(false) ve setPropertyTypeModalVisible(true) çağrıldı');
        }}
      />
      <PropertyTypeSelectionModal 
        visible={propertyTypeModalVisible} 
        onClose={() => { 
          console.log('[PropertyTypeSelectionModal] onClose çağrıldı, isTransitioning:', isTransitioningToSubModalRef.current);
          setPropertyTypeModalVisible(false); 
          // Villa veya Fabrika modalına geçiş sırasında pendingTkgmData'yı temizleme
          // (BottomSheetModal unmount olunca onDismiss tetiklenir ve burayı çağırır)
          if (isTransitioningToSubModalRef.current) {
            isTransitioningToSubModalRef.current = false;
          } else {
            setPendingTkgmData(null); 
            setPendingCoordinates(null); 
          }
          setPropertyTypeModalTitle(''); 
          setPropertyTypeModalSuggested(null); 
        }} 
        onSelect={handlePropertyTypeSelect} 
        title={propertyTypeModalTitle} 
        suggestedType={propertyTypeModalSuggested} 
      />
      <FactoryEstimateModal
        visible={factoryEstimateModalVisible}
        onClose={() => {
          setFactoryEstimateModalVisible(false);
          setPendingFactoryPropertyType(null);
        }}
        onResult={async (factoryParams) => {
          console.log('[FactoryEstimateModal] Sonuc:', factoryParams ? 'var' : 'iptal');
          setFactoryEstimateModalVisible(false);
          if (!factoryParams || !pendingTkgmData) {
            setPendingFactoryPropertyType(null);
            return;
          }
          // Fabrika parametreleri ile birlikte pro sorguyu calistir
          const propertyType = pendingFactoryPropertyType || 'Fabrika';
          setPendingFactoryPropertyType(null);
          setIsLoadingParcel(true);
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: propertyType,
              factory_params: factoryParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            if (pendingCoordinates) {
              requestBody.lat = pendingCoordinates[1];
              requestBody.lon = pendingCoordinates[0];
            }
            const props = pendingTkgmData?.properties || {};
            if (props.mahalleAd && props.adaNo && props.parselNo) {
              requestBody.mahalle = props.mahalleAd;
              requestBody.ada = props.adaNo;
              requestBody.parsel = props.parselNo;
              if (props.mahalleId) requestBody.mahalleTkgmValue = props.mahalleId;
            }
            const response = await fetch(`${backendUrl}/api/get_parcel_info/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            console.log('[FactoryEstimateModal] Backend yanıt anahtarları:', Object.keys(data));
            if (data.error) {
              console.error('[FactoryEstimateModal] Backend hata:', data.error);
              throw new Error(data.error);
            }

            // Geometri opsiyonel - yoksa harita güncellenmez ama rapor açılır
            const geometryRaw = data.geometry || data.parameters_polygons?.parcel_polygon;
            let normalizedGeometry: any = null;
            if (geometryRaw) {
              normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
              setShowEdgeMeasurements(false);
              setParcelData({
                geometry: normalizedGeometry,
                properties: { ...data.properties, ...data.parameters_data?.parcel_values },
                analysisData: data,
              });
            } else {
              console.warn('[FactoryEstimateModal] Geometri bulunamadı, rapor yine açılacak');
            }

            // Rapor kaydet + yönlendir
            const pd: any = data?.parameters_data || {};
            const pv: any = pd?.parcel_values || {};
            const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};
            const propsData: any = data?.properties || {};

            const proparcelValue =
              (pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null);
            const tkgmValue = (tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null);

            const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
            const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';

            const unitStr = pv?.unite_price ?? null;
            const totalStr = pv?.price_of_tarla ?? null;
            const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
            // Fabrika toplam fiyat: factory_final_total_tl > price_of_tarla
            const factoryResult = pd?.factory_result;
            const factoryTotal = factoryResult?.factory_final_total_tl ?? null;
            const totalNum = factoryTotal != null ? factoryTotal : (totalStr ? parseTurkishPrice(totalStr) : null);
            console.log('[FactoryEstimateModal] Fiyat bilgisi: unit=', unitNum, 'total=', totalNum, 'factoryTotal=', factoryTotal);

            const areaRaw = pv?.arazi_m2 ?? pv?.area_m2 ?? pv?.alan ?? pv?.yuzolcum;
            const areaM2 = parseAreaM2(areaRaw);
            const valuationSteps = Array.isArray(pd?.valuation_steps) ? pd.valuation_steps : [];
            const dfaRows = buildDfaRowsFromValuationSteps(valuationSteps, areaM2);

            const propertiesSlice: ReportLocationHeader = {
              ilAd: propsData?.ilAd ?? pv?.ilAd ?? null,
              ilceAd: propsData?.ilceAd ?? pv?.ilceAd ?? null,
              mahalleAd: propsData?.mahalleAd ?? pv?.mahalleAd ?? null,
              adaNo: pv?.adaNo ?? pv?.ada ?? (adaVal || null),
              parselNo: pv?.parselNo ?? pv?.parsel ?? (parselVal || null),
            };

            const pg: any = data?.parameters_graphics || {};
            const parametersGraphicsSlice = {
              ...(pg.parcel_slope_graphics != null && { parcel_slope_graphics: pg.parcel_slope_graphics }),
              ...(pg.slope_surface != null && { slope_surface: pg.slope_surface }),
            };

            const reportPayload: ReportPayload = {
              properties: propertiesSlice,
              valuation_steps: valuationSteps,
              parameters_graphics: Object.keys(parametersGraphicsSlice).length ? parametersGraphicsSlice : undefined,
              dfaRows,
              factory_result: factoryResult || null,
            };

            const cacheId = String(Date.now());
            putReportMemory(cacheId, reportPayload);

            // Kayıt işlemleri (hata olursa navigasyonu engellemesin)
            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  createSavedQueryApi({
                    tkgm_value: Number(tkgmValue),
                    ada: String(adaVal),
                    parsel: String(parselVal),
                    title: `${adaVal}/${parselVal}`,
                    proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  }).catch(() => {});
                }
              }
            } catch (saveErr) {
              console.warn('[FactoryEstimateModal] save failed:', saveErr);
            }

            console.log('[FactoryEstimateModal] Rapor sayfasına yönlendiriliyor, cacheId:', cacheId);
            router.push({
              pathname: '/routes/report_mobil_viewver',
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
            if (normalizedGeometry) {
              const settings = calculateBoundsAndCamera(normalizedGeometry);
              if (settings && cameraRef.current) {
                setTimeout(() => cameraRef.current.setCamera({
                  centerCoordinate: settings.center,
                  zoomLevel: settings.zoom,
                  pitch: camRef.current.pitch,
                  animationDuration: 900
                }), 100);
              }
            }
            // Pending state'leri temizle
            setActiveScreen(null);
            setPendingTkgmData(null);
            setPendingCoordinates(null);
            setPropertyTypeModalTitle('');
            setPropertyTypeModalSuggested(null);
            setInfoModeActive(false);
          } catch (error) {
            console.error('[FactoryEstimateModal] Pro sorgu hatasi:', error);
            Alert.alert('Baglanti Hatasi', 'Backend sunucusuna baglanılamadı.', [{ text: 'Tamam' }]);
          } finally {
            setIsLoadingParcel(false);
          }
        }}
        areaM2={0}
        location={{}}
      />
      <VillaEstimateModal
        visible={villaEstimateModalVisible}
        onClose={() => {
          setVillaEstimateModalVisible(false);
        }}
        onResult={async (villaParams) => {
          console.log('[VillaEstimateModal] Sonuc:', villaParams ? 'var' : 'iptal');
          setVillaEstimateModalVisible(false);
          if (!villaParams || !pendingTkgmData) {
            return;
          }
          setIsLoadingParcel(true);
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: 'Villa',
              villa_params: villaParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            if (pendingCoordinates) {
              requestBody.lat = pendingCoordinates[1];
              requestBody.lon = pendingCoordinates[0];
            }
            // Ada/Parsel bilgisi varsa ekle
            const props = pendingTkgmData?.properties || {};
            if (props.mahalleAd && props.adaNo && props.parselNo) {
              requestBody.mahalle = props.mahalleAd;
              requestBody.ada = props.adaNo;
              requestBody.parsel = props.parselNo;
              if (props.mahalleId) requestBody.mahalleTkgmValue = props.mahalleId;
            }
            const resp = await fetch(`${backendUrl}/api/get_parcel_info/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            console.log('[VillaEstimateModal] Backend yanıt anahtarları:', Object.keys(data));
            if (data.error) {
              console.error('[VillaEstimateModal] Backend hata:', data.error);
              throw new Error(data.error);
            }

            // Geometri opsiyonel - yoksa harita güncellenmez ama rapor açılır
            const geometryRaw = data.geometry || data.parameters_polygons?.parcel_polygon;
            let normalizedGeometry: any = null;
            if (geometryRaw) {
              normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
              setShowEdgeMeasurements(false);
              setParcelData({
                geometry: normalizedGeometry,
                properties: { ...data.properties, ...data.parameters_data?.parcel_values },
                analysisData: data,
              });
            } else {
              console.warn('[VillaEstimateModal] Geometri bulunamadı, rapor yine açılacak');
            }

            // Rapor kaydet + yönlendir
            const pd: any = data?.parameters_data || {};
            const pv: any = pd?.parcel_values || {};
            const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};
            const propsData: any = data?.properties || {};

            const proparcelValue =
              (pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null);
            const tkgmValue = (tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null);

            const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
            const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';

            const unitStr = pv?.unite_price ?? null;
            const totalStr = pv?.price_of_tarla ?? null;
            const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
            // Villa toplam fiyat: villa_final_total_tl > price_of_tarla
            const villaResult = pd?.villa_result;
            const villaTotal = villaResult?.villa_final_total_tl ?? null;
            const totalNum = villaTotal != null ? villaTotal : (totalStr ? parseTurkishPrice(totalStr) : null);
            console.log('[VillaEstimateModal] Fiyat bilgisi: unit=', unitNum, 'total=', totalNum, 'villaTotal=', villaTotal);

            const areaRaw = pv?.arazi_m2 ?? pv?.area_m2 ?? pv?.alan ?? pv?.yuzolcum;
            const areaM2 = parseAreaM2(areaRaw);
            const valuationSteps = Array.isArray(pd?.valuation_steps) ? pd.valuation_steps : [];
            const dfaRows = buildDfaRowsFromValuationSteps(valuationSteps, areaM2);
            console.log('[VillaEstimateModal] DFA satır sayısı:', dfaRows.length, 'areaM2:', areaM2);

            const propertiesSlice: ReportLocationHeader = {
              ilAd: propsData?.ilAd ?? pv?.ilAd ?? null,
              ilceAd: propsData?.ilceAd ?? pv?.ilceAd ?? null,
              mahalleAd: propsData?.mahalleAd ?? pv?.mahalleAd ?? null,
              adaNo: pv?.adaNo ?? pv?.ada ?? (adaVal || null),
              parselNo: pv?.parselNo ?? pv?.parsel ?? (parselVal || null),
            };

            const pg: any = data?.parameters_graphics || {};
            const parametersGraphicsSlice = {
              ...(pg.parcel_slope_graphics != null && { parcel_slope_graphics: pg.parcel_slope_graphics }),
              ...(pg.slope_surface != null && { slope_surface: pg.slope_surface }),
            };

            const reportPayload: ReportPayload = {
              properties: propertiesSlice,
              valuation_steps: valuationSteps,
              parameters_graphics: Object.keys(parametersGraphicsSlice).length ? parametersGraphicsSlice : undefined,
              dfaRows,
              villa_result: villaResult || null,
            };

            const cacheId = String(Date.now());
            putReportMemory(cacheId, reportPayload);

            // Kayıt işlemleri (hata olursa navigasyonu engellemesin)
            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  createSavedQueryApi({
                    tkgm_value: Number(tkgmValue),
                    ada: String(adaVal),
                    parsel: String(parselVal),
                    title: `${adaVal}/${parselVal}`,
                    proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  }).catch(() => {});
                }
              }
            } catch (saveErr) {
              console.warn('[VillaEstimateModal] save failed:', saveErr);
            }

            console.log('[VillaEstimateModal] Rapor sayfasına yönlendiriliyor, cacheId:', cacheId);
            router.push({
              pathname: '/routes/report_mobil_viewver',
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
            if (normalizedGeometry) {
              const settings = calculateBoundsAndCamera(normalizedGeometry);
              if (settings && cameraRef.current) {
                setTimeout(() => cameraRef.current.setCamera({
                  centerCoordinate: settings.center,
                  zoomLevel: settings.zoom,
                  pitch: camRef.current.pitch,
                  animationDuration: 900
                }), 100);
              }
            }
            // Pending state'leri temizle
            setActiveScreen(null);
            setPendingTkgmData(null);
            setPendingCoordinates(null);
            setPropertyTypeModalTitle('');
            setPropertyTypeModalSuggested(null);
            setInfoModeActive(false);
          } catch (error) {
            console.error('[VillaEstimateModal] Pro sorgu hatasi:', error);
            Alert.alert('Baglanti Hatasi', 'Backend sunucusuna baglanılamadı.', [{ text: 'Tamam' }]);
          } finally {
            setIsLoadingParcel(false);
          }
        }}
        areaM2={0}
      />
      <ShareModal visible={shareModalVisible} onClose={() => setShareModalVisible(false)} onShare={handleShare} isProcessing={isProcessingShare} />

      {/* Fiyat zorunluluğu uyarı modalı */}
      <Modal
        visible={priceWarningVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceWarningVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPriceWarningVisible(false)}>
          <View style={styles.priceWarnOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.priceWarnCard}>
                {Video && hasNativeVideoView ? (
                  <Video
                    source={KutlamaVideo}
                    style={styles.priceWarnVideo}
                    resizeMode="cover"
                    repeat
                    muted
                    playInBackground={false}
                    playWhenInactive={false}
                    ignoreSilentSwitch="obey"
                  />
                ) : null}
                <View style={styles.priceWarnVideoShade} pointerEvents="none" />
                <View style={styles.priceWarnHeader}>
                  <View style={styles.priceWarnHeaderLeft} pointerEvents="none">
                    <Image source={TepeCoinSpinGif} style={styles.priceWarnGif} resizeMode="contain" />
                  </View>
                  <View style={styles.priceWarnHeaderCenter} pointerEvents="none">
                    <Text style={styles.priceWarnTitle}>TEPE COIN KAZAN</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.priceWarnClose}
                    onPress={() => setPriceWarningVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color="#e2e8f0" />
                  </TouchableOpacity>
                </View>

                <View style={styles.priceWarnBody}>
                  <Text style={styles.priceWarnText}>
                    Bedava Tepe Coin Kazanmak İçin Lütfen Fiyat Bilgisi Giriniz
                  </Text>
                </View>

                <View style={styles.priceWarnButtons}>
                  <TouchableOpacity
                    style={[styles.priceWarnBtn, styles.priceWarnBtnGhost]}
                    activeOpacity={0.85}
                    onPress={async () => {
                      setPriceWarningVisible(false);
                      shareCoinContextRef.current = { awardCoin: false };
                      await doConfirmScreenshot(true);
                    }}
                  >
                    <Text style={styles.priceWarnBtnGhostText}>İstemiyorum</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.priceWarnBtn, styles.priceWarnBtnPrimary]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setPriceWarningVisible(false);
                      setScreenshotPricePanelVisible(true);
                    }}
                  >
                    <Ionicons name="pricetag" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.priceWarnBtnPrimaryText}>Fiyat Gir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ParcelSplitProjectsModal
        visible={parcelSplitProjectsVisible}
        onClose={() => setParcelSplitProjectsVisible(false)}
      />
      <ThreeDDesignsModal
        visible={threeDDesignsVisible}
        onClose={() => setThreeDDesignsVisible(false)}
      />
      <StreetViewModal
        visible={streetViewModalVisible}
        onClose={() => setStreetViewModalVisible(false)}
        streetViewPoint={parcelData ? getFirstStreetViewPoint(parcelData.geometry, parcelData.analysisData) : null}
      />
      {/* 3D model görüntüleyici kaldırıldı - native Mapbox özellikleri ana ekranda */}
      
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Ana sayfa header butonları: 3D sayfası ölçülerine göre
  headerButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', borderRadius: 6 },
  headerMenuIconWrapper: { position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerMenuUnreadDot: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#1e293b' },
  headerMenuUnreadDotSimple: { borderColor: '#ffffff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Topbar VIP rozeti
  topbarVipBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#d97706', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, height: 32 },
  topbarVipText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  // Basit/Pro switch: headerModeImgBtn
  headerModeImgBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerModeImg: { width: 34, height: 34 },
  // Ana sayfa coin alanı: 3D sayfası ölçülerine göre
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 10,
    backgroundColor: '#334155',
    borderRadius: 6,
    gap: 6,
  },
  creditBadgeIcon: { width: 16, height: 16 },
  creditBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  titleContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
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
  pillDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  rulerSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 180, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  rulerSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  rulerSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rulerSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  rulerSubMenuDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  locationSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 180, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  locationSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  locationSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  locationSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  locationSubMenuDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  areaFinishButtonContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 101 },
  areaFinishButton: { flexDirection: 'row', backgroundColor: '#10b981', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, borderWidth: 2, borderColor: '#059669' },
  areaFinishButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  controlsLayoutWrapper: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 20, alignItems: 'flex-end', gap: 12, zIndex: 1000 },
  mapControlsPanel: { backgroundColor: 'rgba(30, 41, 59, 0.78)', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: 'rgba(59, 130, 246, 0.9)', elevation: 15, width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  mapControlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  mapControlButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  mapControlSpacer: { width: 30, height: 30 },
  pitchControlsContainer: { backgroundColor: 'rgba(30, 41, 59, 0.78)', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: 'rgba(59, 130, 246, 0.9)', elevation: 15, alignItems: 'center', width: 50, height: 110, justifyContent: 'center' },
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
  menuModalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 20 },
  menuDragHandleZone: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  menuDragHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: 'rgba(148, 163, 184, 0.35)' },
  menuModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuModalHeaderSimple: { borderBottomColor: '#e2e8f0' },
  menuModalHeaderSpacer: { height: 16 },
  menuModalFooterSpacer: { minHeight: 56 },
  menuModalTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  menuModalUserRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuModalAvatar: { width: 44, height: 44, borderRadius: 22 },
  menuModalAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  menuModalAvatarPlaceholderSimple: { backgroundColor: '#f1f5f9' },
  menuModalUserName: { fontSize: 17, fontWeight: '600', color: '#e2e8f0', flex: 1 },
  menuModalUserNameSimple: { color: '#334155' },
  menuModalUserMeta: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  menuModalUserMetaSimple: { color: '#475569' },
  menuModalVipBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#d97706', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  menuModalVipText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  menuModalCreditBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 32, gap: 6, backgroundColor: '#334155', paddingHorizontal: 10, borderRadius: 6 },
  menuModalCreditBadgeSimple: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  menuModalCreditIcon: { width: 20, height: 20 },
  menuModalCreditText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  menuModalCreditTextSimple: { color: '#334155' },
  menuModalList: { paddingVertical: 8 },
  menuModalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuModalSubItem: { paddingLeft: 36, backgroundColor: '#0f172a' },
  menuModalSubSubItem: { paddingLeft: 52, backgroundColor: '#0f172a' },
  menuModalSubItemSimple: { backgroundColor: '#f8fafc' },
  menuModalItemDisabled: { opacity: 0.5 },
  menuModalItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuModalItemText: { fontSize: 16, fontWeight: '600', color: '#e2e8f0' },
  menuModalItemTextDisabled: { color: '#64748b' },
  menuModalItemTextSimple: { color: '#334155' },
  menuModalItemSimple: { borderBottomColor: '#334155' },
  menuModalUnreadBadge: { marginLeft: "auto", backgroundColor: "#ef4444", borderRadius: 10, paddingHorizontal: 8, height: 20, alignItems: "center", justifyContent: "center" },
  menuModalUnreadBadgeRed: { marginLeft: "auto", backgroundColor: "#ef4444", borderRadius: 10, paddingHorizontal: 8, height: 20, alignItems: "center", justifyContent: "center" },
  menuModalUnreadBadgeGreen: { marginLeft: "auto", backgroundColor: "#22c55e", borderRadius: 10, paddingHorizontal: 8, height: 20, alignItems: "center", justifyContent: "center" },
  menuModalUnreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  menuModalItemProBadge: { fontSize: 10, fontWeight: '800', color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },

  // Price warning modal (corporate theme)
  priceWarnOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  priceWarnCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
  },
  priceWarnVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  priceWarnVideoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  priceWarnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  priceWarnGif: {
    width: 44,
    height: 44,
  },
  priceWarnHeaderLeft: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  priceWarnHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  priceWarnClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  priceWarnTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center' },
  priceWarnBody: { paddingHorizontal: 14, paddingVertical: 14 },
  priceWarnText: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  priceWarnButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  priceWarnBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  priceWarnBtnGhost: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  priceWarnBtnGhostText: { color: '#e2e8f0', fontWeight: '900' },
  priceWarnBtnPrimary: { backgroundColor: '#3b82f6' },
  priceWarnBtnPrimaryText: { color: '#fff', fontWeight: '900' },
});
