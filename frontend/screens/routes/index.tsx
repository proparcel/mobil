import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
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
  AppState,
  InteractionManager,
} from 'react-native';
import { AppStatusBar } from '../../components/app/AppStatusBar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Linking } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { proparcelFavicon } from '../../components/landing/proparcelBrandAssets';
import { MapFloatingCreditBadge } from '../../components/app/MapFloatingCreditBadge';
import { useRouter, useLocalSearchParams } from '../../src/hooks/useNavigation';
import { useFocusEffect, useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import Svg, { Polyline, Rect } from 'react-native-svg';
import { cleanupTempFiles, getCombinedImageDimensions } from '../../src/utils/screenshotManager';
import { mergeParcelDisplayProperties } from '../../src/utils/mergeParcelDisplayProperties';
import { startPreviewSnapPrewarm } from '../../src/utils/shareCaptureFlow';
import { buildCameraFingerprint, type PreviewSnapCacheEntry } from '../../src/utils/captureSnapCache';
import { parseTurkishPrice, formatTurkishPrice } from '../../src/utils/priceParser';
import MyQueriesModal, { type SavedQueryItem } from '../../components/app/MyQueriesModal';
import ParcelSplitProjectsModal from '../../components/app/ParcelSplitProjectsModal';
import ThreeDDesignsModal from '../../components/app/ThreeDDesignsModal';
import AppBottomSheetModal from '../../components/app/AppBottomSheetModal';
import {
  USER_MENU_SHEET_SNAP_POINTS,
  UserMenuSheetHeader,
  userMenuSheetDarkStyles,
} from '../../components/app/UserMenuSheet';
import UserMenuSheetList from '../../components/app/UserMenuSheetList';
import { getMenuItems } from '../../components/app/userMenuItems';
import { syncLastParcelForVr, syncSelectedParcelForVr, VrPillBarButton } from '../../modules/vrParcel';
import { isAppAdminUser } from '../../src/utils/adminAccess';
import { canAccessProSorgu, isVipCustomer } from '../../src/utils/membership';
import { SavedQuery, upsertSavedQuery } from '../../src/utils/savedQueries';
import { persistTkgmResponseToMyQueries } from '../../src/utils/persistSimpleQuery';
import {
  fitParcelInViewIfNeeded,
  normalizeGeometryCoordinates as normalizeParcelGeometry,
  zoomMapToParcelGeometry,
} from '../../src/utils/parcelUtils';
import {
  DEFAULT_MAP_OVERLAY_VIEWPORT,
  type MapOverlayViewport,
} from '../../src/maps/drawing/mapOverlayViewport';
import {
  createParcelFillLayer,
  createParcelStrokeLayer,
} from '../../components/map/ParcelMapLayers';
import { ParcelPatternLayer } from '../../components/map/ParcelPatternLayer';
import { ParcelLabelLayer } from '../../components/map/ParcelLabelLayer';
import { HomeMapToolsSheet } from '../../components/app/HomeMapToolsSheet';
import HomeVoiceQueryOrb from '../../components/app/HomeVoiceQueryOrb';
import { MapHoldZoomLayer } from '../../components/app/MapHoldZoomLayer';
import { MapToolsZoomSpeedBar } from '../../components/app/MapToolsZoomSpeedBar';
import { ParcelPolygonDesignSheet } from '../../components/app/ParcelPolygonDesignSheet';
import type { ParcelPolygonDesignConfig } from '../../src/constants/parcelPolygonDesign';
import {
  loadSavedParcelPolygonDesign,
  saveParcelPolygonDesign,
} from '../../src/utils/parcelPolygonDesignStorage';
import { putReportMemory } from '../../src/utils/reportMemory';
import { buildDfaRowsFromValuationSteps, parseAreaM2 } from '../../src/utils/dfaRows';
import type { ReportPayload, ReportLocationHeader } from '../../src/types/reportPayload';
import { API_URL, FALLBACK_API_URL } from '../../config/api';
import { createSavedQueryApi } from '../../services/savedQueriesApi';
import { captureAndUploadProQueryMapImage } from '../../src/utils/proQueryMapCapture';
import { navigateAfterProQuery } from '../../src/utils/proQueryNavigation';
import {
  runProParcelQuery,
  ProQueryLimitError,
  ProQueryFailedError,
  getProQueryErrorAlert,
  getProQueryAlertButtons,
  extractProQueryCityId,
  extractProQueryIdentifiers,
  resolveDfaSnapshotId,
} from '../../src/utils/proQueryApi';
import {
  PORTAL_RECENT_QUERIES_CHANGED,
  type PortalRecentQueriesChangedPayload,
} from '../../src/constants/portalEvents';
import { fetchTkgmByCoords, fetchTkgmByIds } from '../../src/utils/tkgmApi';
import {
  resolveMahalleTkgmForDirectQuery,
} from '../../src/utils/tkgmParcelQuery';
import TkgmPassiveParcelModal from '../../components/app/TkgmPassiveParcelModal';
import {
  shouldShowNotFoundBanner,
  type PassiveParcelInfo,
} from '../../src/utils/tkgmPassiveParcel';
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
import ParcelSearchModal, { type ParcelSearchTabKey } from '../../components/ParcelSearchModal';
import {
  smartQueryPayloadToFormSeed,
  type SmartQueryParcelPayload,
} from '../../src/utils/smartQueryResolve';
import {
  canUseSmartQuery,
  promptSmartQueryUpgrade,
} from '../../src/utils/customerFeatureGates';
import type { SidebarSavedQuery } from '../../src/utils/sidebarSavedQueries';
import ProModeThreeLoader from '../../components/ProModeThreeLoader';
import PropertyTypeSelectionModal, { type ShareParcelSelection } from '../../components/PropertyTypeSelectionModal';
import WelcomeBottomSheet from '../../components/WelcomeBottomSheet';
import AppTourOverlay from '../../components/AppTourOverlay';
import FactoryEstimateModal from '../../components/FactoryEstimateModal';
import VillaEstimateModal from '../../components/VillaEstimateModal';
import BinaEstimateModal from '../../components/BinaEstimateModal';
import MustakilEvEstimateModal from '../../components/MustakilEvEstimateModal';
import KonutDaireModal from '../../components/KonutDaireModal';
import { ProQueryConfirmModal } from '../../components/ProQueryConfirmModal';
import ShareModal from '../../components/ShareModal';
import StreetViewModal from '../../components/StreetViewModal';
// 3D model görüntüleyici kaldırıldı - native Mapbox'a geçildi
import ShapeDrawingModal from '../../components/app/ShapeDrawingModal';
import { patchTextBoxShape } from '../../src/maps/drawing/textBoxLayout';
import type { ShapeType } from '../../src/maps/drawing/types';
import { trySelectShapeAtLngLat } from '../../src/maps/drawing/shapePickAtLngLat';
import { shapeNeedsOverlayRelayout } from '../../src/maps/drawing/overlayShapePolicy';
import { useShapeDrawingSession } from '../../components/app/shapeDrawingModal/useShapeDrawingSession';
import { useMeasurementSession } from '../../components/app/mapTools/useMeasurementSession';
import { tryHitMeasurementGroupAtLngLat } from '../../components/app/shapeDrawingModal/measurementMapHit';
import { MeasurementEditSheet } from '../../components/app/shapeDrawingModal/MeasurementEditSheet';
import { activateMeasurementTool, activateShapeTool } from '../../components/app/mapTools/mapToolActions';
import { isMapPlacementToolActive } from '../../components/app/mapTools/mapInteractionLock';
import { ShapeDrawingMapLayers, ShapeDrawingUiOverlays } from '../../components/app/shapeDrawingModal/ShapeDrawingOverlays';
import { TextBoxEditModal } from '../../components/app/TextBoxEditModal';
import { ErrorBoundary } from '../../components/app/ErrorBoundary';
import { ParcelModalContent } from '../../components/ParcelModalContent';
import { ProParcelResponse, TkgmViewResponse, ParcelResponse, GeoJSONGeometry } from '../../src/types/parcelResponse';
import { apply3DMode, updateCamRefFromCameraChanged } from '../../src/utils/threeDMode';
import { HomeIndexMap3DLayers } from '../../components/map/HomeIndexMap3DLayers';
import {
  TURKEY_MAP_CENTER,
  TURKEY_MAP_ZOOM,
  USER_BOOTSTRAP_ZOOM,
  USER_MENU_LOCATION_ZOOM,
  HOME_PREFERRED_CITY_ANIM_MS,
  requestAppLocationPermission,
  hasAppLocationPermission,
  getCurrentCoordinates,
  showLocationPermissionAlert,
  waitForUiSettled,
} from '../../src/utils/mapLocation';
import {
  ADMIN_BOUNDARY_STYLES,
  loadLocationBoundaryForSelection,
  getCityMapCameraFromId,
  type AdminBoundaryLevel,
  type LocationHierarchySelection,
} from '../../src/utils/locationHierarchyMap';
import { resolveHomeMapCityId } from '../../src/utils/homeMapPreferredCity';
import type { SimpleQueryDeepLinkPayload } from '../../src/utils/deepLinkRouter';
import type { GeoJsonGeometry } from '../../services/locationBoundaryApi';
import { extractNitelikText, generatePropertyTypeTitle } from '../../src/utils/propertyTypeUtils';
import { createShareHandler } from '../../src/utils/handlers/shareHandler';
import { resolveParcelShareMessageUrlForShare } from '../../src/utils/parcelShareLink';
import { useScreenshotListener } from '../../src/utils/useScreenshotListener';
import { CombinedScreenshotContainer } from '../../components/app/CombinedScreenshotContainer';
import { getFirstStreetViewPoint } from '../../src/utils/streetViewHelper';
import { useAuth } from '../contexts/AuthContext';
import { storageService, REDIRECT_TARGET_MODEL_EDITOR } from '../../services/storageService';
import { mergeParcel3dEntryFields, type Parcel3dEntry } from '../../src/utils/parcel3dPurchasedStorage';
import { resolveTkgmFor3dDesignOpen } from '../../src/utils/parcel3dOpenResolve';

/**
 * Günlük sorgu limiti aşıldığında fırlatılan özel hata sınıfı.
 * catch bloklarında `instanceof QueryLimitError` ile yakalanır.
 */
class QueryLimitError extends Error {
  dailyLimit: number;
  constructor(message: string, dailyLimit: number = 10) {
    super(message);
    this.name = 'QueryLimitError';
    this.dailyLimit = dailyLimit;
  }
}

/**
 * Backend API istekleri için auth header'lı fetch yardımcısı.
 * JWT Bearer token varsa Authorization header'ını ekler.
 * 429 (Too Many Requests) yanıtında QueryLimitError fırlatır.
 */
async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PP-Client': 'mobile',
    ...(options.headers as Record<string, string> || {}),
  };
  try {
    const tokens = await storageService.getTokens();
    if (tokens?.access) {
      headers['Authorization'] = `Bearer ${tokens.access}`;
    }
  } catch (_) {
    // Token okunamadı — anonim devam
  }
  const response = await fetch(url, { ...options, headers });

  // 429 Too Many Requests — günlük sorgu limiti aşıldı
  if (response.status === 429) {
    let msg = 'Günlük sorgu limitinize ulaştınız.';
    let limit = 10;
    try {
      const body = await response.json();
      if (body.error) msg = body.error;
      if (body.daily_limit) limit = body.daily_limit;
    } catch (_) {}
    throw new QueryLimitError(msg, limit);
  }

  return response;
}

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
import { createListingDraft } from "../../services/listingService";
// Shape drawing moved to ShapeDrawingModal component
import {
  MeasurementMode,
  getCentroid,
  getCoordinateDistance
} from '../../src/utils/measurementManager';
import {
  EdgeMeasurementFeature,
  EdgeMeasureData,
  createEdgeMeasurementFeatures
} from '../../src/utils/edgeMeasurementsManager';

function isValidMeasureColorHex(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('#') && /^#[0-9A-Fa-f]{6}$/i.test(v);
}

// Conditional Mapbox import
let Mapbox: any = null;
try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Alt toolbar (20) + sorgu şeridi (~42) + pill bar (~44) + üst boşluk (20) */
const HOME_MAP_3D_CONTROLS_BOTTOM = 114;
const THREE_D_CONTROLS_PANEL_HEIGHT = 110;
/** Kapatma çizgisi + boşluk + yön paneli + boşluk + pitch paneli */
const THREE_D_CONTROLS_SLIDE_WIDTH = 228;
/** Zoom paneli: padding + iki buton + border */
const ZOOM_CONTROLS_PANEL_HEIGHT = 80;
/** B/P kare butonları (üstte absolute; merkezleme yüksekliğine dahil değil) */
const ZOOM_QUERY_BUTTONS_GAP = 4;
/** Kapatma tutamağı + zoom paneli */
const ZOOM_CONTROLS_SLIDE_WIDTH = 76;
const PANEL_COLLAPSE_COLOR = '#5897fb';

function PanelCollapseChevrons() {
  return (
    <Svg width={22} height={28} viewBox="0 0 22 28">
      <Polyline
        points="3,6 9,14 3,22"
        fill="none"
        stroke={PANEL_COLLAPSE_COLOR}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="11,6 17,14 11,22"
        fill="none"
        stroke={PANEL_COLLAPSE_COLOR}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Açık panelde yalnızca içeri (sağa) bakan çift chevron (sadece çizgi) */
function PanelCollapseHandle() {
  return (
    <View style={styles.panelCollapseHandle}>
      <PanelCollapseChevrons />
    </View>
  );
}

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
  const isScreenFocused = useIsFocused();
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuSheetIndex, setMenuSheetIndex] = useState(0);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [parcelSearchInitialTab, setParcelSearchInitialTab] = useState<ParcelSearchTabKey>('parcel');
  const [incomingParcelFormSeed, setIncomingParcelFormSeed] = useState<SidebarSavedQuery | null>(null);
  const [isProMode, setIsProMode] = useState(false);

  // Not: Basit/Pro mod sadece işlevsel; tema aynı kalır. Sadece bazı border'lar basit modda beyaz.

  const [is3DMode, setIs3DMode] = useState(false);
  const [mapViewKey, setMapViewKey] = useState(0);
  const [mapDefaultSettings, setMapDefaultSettings] = useState({
    centerCoordinate: TURKEY_MAP_CENTER,
    zoomLevel: TURKEY_MAP_ZOOM,
    pitch: 0,
    heading: 0,
  });
  // Kredi bakiyesi state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);
  // İlk üyelik hoşgeldin bottom sheet
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  // İlk giriş tour overlay (ekran görüntüsü + Pro Sorgu)
  const [tourVisible, setTourVisible] = useState(false);
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
      setQueryModeChoice('pro');
      // Params temizle (bir kere çalışsın)
      navigation.setParams({ proQueryMahalle: undefined, proQueryAda: undefined, proQueryParsel: undefined } as any);
    }
  }, [route.params, isProMode, navigation]);

  // Profil state (avatar için)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  /** Parsel sorgu sheet: il / ilçe / mahalle idari sınırı */
  const [adminBoundary, setAdminBoundary] = useState<{
    level: AdminBoundaryLevel;
    geometry: GeoJsonGeometry;
  } | null>(null);
  const hierarchyMapReqRef = useRef(0);
  const [isLoadingParcel, setIsLoadingParcel] = useState(false);
  /** Overlay hangi sorgu modu için — isProMode ile karışmasın (async setState gecikmesi) */
  const [parcelLoadUiMode, setParcelLoadUiMode] = useState<'simple' | 'pro' | null>(null);
  const parcelQueryLoadSeqRef = useRef(0);
  const parcelQueryLoadSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginParcelQueryLoad = useCallback((mode: 'simple' | 'pro'): number => {
    parcelQueryLoadSeqRef.current += 1;
    const seq = parcelQueryLoadSeqRef.current;
    setParcelLoadUiMode(mode);
    setIsLoadingParcel(true);
    if (parcelQueryLoadSafetyTimerRef.current) {
      clearTimeout(parcelQueryLoadSafetyTimerRef.current);
    }
    parcelQueryLoadSafetyTimerRef.current = setTimeout(() => {
      if (seq !== parcelQueryLoadSeqRef.current) return;
      setIsLoadingParcel(false);
      setParcelLoadUiMode(null);
    }, 60_000);
    return seq;
  }, []);

  const endParcelQueryLoad = useCallback((seq: number) => {
    if (seq !== parcelQueryLoadSeqRef.current) return;
    if (parcelQueryLoadSafetyTimerRef.current) {
      clearTimeout(parcelQueryLoadSafetyTimerRef.current);
      parcelQueryLoadSafetyTimerRef.current = null;
    }
    setIsLoadingParcel(false);
    setParcelLoadUiMode(null);
  }, []);

  const waitForSheetDismiss = useCallback(
    () =>
      new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      }),
    [],
  );

  const startProAnalysisLoad = useCallback(async (): Promise<number> => {
    proAnalysisLoadingRef.current = true;
    await waitForSheetDismiss();
    return beginParcelQueryLoad('pro');
  }, [beginParcelQueryLoad, waitForSheetDismiss]);

  const finishProAnalysisLoad = useCallback((seq: number) => {
    proAnalysisLoadingRef.current = false;
    endParcelQueryLoad(seq);
  }, [endParcelQueryLoad]);

  const isParcelQueryLoadStale = useCallback(
    (seq: number) => seq !== parcelQueryLoadSeqRef.current,
    [],
  );

  useEffect(() => {
    return () => {
      if (parcelQueryLoadSafetyTimerRef.current) {
        clearTimeout(parcelQueryLoadSafetyTimerRef.current);
      }
    };
  }, []);
  const [parcelModalVisible, setParcelModalVisible] = useState(false);
  // TKGM pasif / toplulaştırılmış parsel onay modalı
  const [passiveParcelInfo, setPassiveParcelInfo] = useState<PassiveParcelInfo | null>(null);
  const [passiveParcelVisible, setPassiveParcelVisible] = useState(false);
  const passiveParcelResolverRef = useRef<(() => void) | null>(null);
  const [myQueriesVisible, setMyQueriesVisible] = useState(false);
  const [parcelSplitProjectsVisible, setParcelSplitProjectsVisible] = useState(false);
  const [threeDDesignsVisible, setThreeDDesignsVisible] = useState(false);
  const [submenuOpenId, setSubmenuOpenId] = useState<string | null>(null);
  const [uzmanGorusuOpen, setUzmanGorusuOpen] = useState(false);

  /**
   * TKGM pasif/toplulaştırılmış parsel onayı: modal açar, "Tamam"'a basılınca
   * resolve olan Promise döndürür. TKGM çağrılarına callback olarak geçilir.
   */
  const confirmPassiveParcel = useCallback((info: PassiveParcelInfo): Promise<void> => {
    return new Promise<void>((resolve) => {
      passiveParcelResolverRef.current = resolve;
      setPassiveParcelInfo(info);
      setPassiveParcelVisible(true);
    });
  }, []);

  const handlePassiveParcelClose = useCallback(() => {
    setPassiveParcelVisible(false);
    const resolve = passiveParcelResolverRef.current;
    passiveParcelResolverRef.current = null;
    setPassiveParcelInfo(null);
    if (resolve) resolve();
  }, []);

  // Dosyalarım hub ekranından dönüş: kayıtlı sorgu / parsel / 3D modalları
  useEffect(() => {
    const params = route.params as { launch?: 'my-queries' | 'parcel-split' | '3d-designs' } | undefined;
    const launch = params?.launch;
    if (!launch) return;
    if (launch === 'my-queries') setMyQueriesVisible(true);
    else if (launch === 'parcel-split') setParcelSplitProjectsVisible(true);
    else if (launch === '3d-designs') setThreeDDesignsVisible(true);
    navigation.setParams({ launch: undefined } as any);
  }, [route.params, navigation]);

  // Basit mod için çoklu parsel yönetimi
  const [simpleModeParcels, setSimpleModeParcels] = useState<SimpleModeParcel[]>([]);
  const [selectedParcelForModal, setSelectedParcelForModal] = useState<SimpleModeParcel | null>(null);

  useEffect(() => {
    syncSelectedParcelForVr(selectedParcelForModal);
  }, [selectedParcelForModal]);
  
  // Basit mod için helper fonksiyonlar
  const MAX_SIMPLE_MODE_PARCELS = 30;
  
  const generateParcelId = (): string => {
    return `parcel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addParcelToSimpleMode = useCallback((parcel: ParcelData): SimpleModeParcel | null => {
    if (!parcel.geometry) return null;

    const newParcel: SimpleModeParcel = {
      ...parcel,
      geometry: normalizeParcelGeometry(parcel.geometry),
      id: generateParcelId(),
    };

    setSimpleModeParcels(prev => {
      const updated = [...prev, newParcel];
      if (updated.length > MAX_SIMPLE_MODE_PARCELS) {
        return updated.slice(1);
      }
      return updated;
    });
    setSelectedParcelForModal(newParcel);
    syncLastParcelForVr(newParcel);
    return newParcel;
  }, []);
  
  const [propertyTypeModalVisible, setPropertyTypeModalVisible] = useState(false);
  const [factoryEstimateModalVisible, setFactoryEstimateModalVisible] = useState(false);
  const [pendingFactoryPropertyType, setPendingFactoryPropertyType] = useState<string | null>(null);
  const [villaEstimateModalVisible, setVillaEstimateModalVisible] = useState(false);
  const [binaEstimateModalVisible, setBinaEstimateModalVisible] = useState(false);
  const [mustakilEvEstimateModalVisible, setMustakilEvEstimateModalVisible] = useState(false);
  const [konutDaireModalVisible, setKonutDaireModalVisible] = useState(false);
  const isTransitioningToSubModalRef = useRef(false); // Villa/Fabrika modalına geçiş sırasında pendingTkgmData'yı korumak için
  const proAnalysisLoadingRef = useRef(false); // Tip seçimi sonrası analiz yüklenirken onClose state temizlemesin
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
  const [pendingShareData, setPendingShareData] = useState<ShareParcelSelection | null>(null);
  
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const [capturedMapUri, setCapturedMapUri] = useState<string | null>(null);
  const previewSnapCacheRef = useRef<PreviewSnapCacheEntry | null>(null);
  const previewPrewarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPrewarmInFlightRef = useRef<Promise<void> | null>(null);
  const screenshotPreviewModeRef = useRef(false);

  const applyShareSelectionToRequest = useCallback((
    requestBody: any,
    shareData?: ShareParcelSelection | null,
  ) => {
    const source = shareData ?? pendingShareData;
    if (!source) return requestBody;
    const hisseM2 = String(source.hisseM2 || '').replace(/[^\d]/g, '').trim();
    const parcelLocationStatus = source.parcelLocationStatus === 'parselbelirli' || source.parcelLocationStatus === 'parselbelirlidegil'
      ? source.parcelLocationStatus
      : null;
    if (!hisseM2 && !parcelLocationStatus) return requestBody;
    requestBody.hisseli = true;
    if (hisseM2) requestBody.hisse_m2 = hisseM2;
    if (parcelLocationStatus) requestBody.parcel_location_status = parcelLocationStatus;
    return requestBody;
  }, [pendingShareData]);

  const clearPendingPropertyTypeState = useCallback(() => {
    setPendingTkgmData(null);
    setPendingCoordinates(null);
    setPropertyTypeModalTitle('');
    setPropertyTypeModalSuggested(null);
    setPendingShareData(null);
  }, []);
  const [capturedModalUri, setCapturedModalUri] = useState<string | null>(null);
  const [screenshotPreviewMode, setScreenshotPreviewMode] = useState(false);
  const [screenshotTotalPriceInput, setScreenshotTotalPriceInput] = useState('');
  const [screenshotPriceOverride, setScreenshotPriceOverride] = useState<{ totalPrice?: number | null; unitPrice?: number | null } | null>(null);
  const [screenshotPricePanelVisible, setScreenshotPricePanelVisible] = useState(false);
  const shareCoinContextRef = useRef<{ awardCoin: boolean; priceText?: string }>({ awardCoin: true });
  const prefetchedShareLinkRef = useRef<Promise<string | null> | null>(null);
  const [priceWarningVisible, setPriceWarningVisible] = useState(false);
  const [multiParcelPriceWarningVisible, setMultiParcelPriceWarningVisible] = useState(false);
  
  const [streetViewModalVisible, setStreetViewModalVisible] = useState(false);
  // cesiumModalVisible kaldırıldı - native Mapbox'a geçildi

  const measurement = useMeasurementSession({
    defaultRulerColor: '#3b82f6',
    defaultAreaColor: '#fbbf24',
  });
  const [selectedMeasurementGroupId, setSelectedMeasurementGroupId] = useState<string | null>(null);
  const [measurementEditPanelVisible, setMeasurementEditPanelVisible] = useState(false);
  const [measurementEditPanelMinimized, setMeasurementEditPanelMinimized] = useState(true);

  const mapToolLockRef = useRef({
    measurementActive: false,
    shapeDrawingMode: null as import('../../src/maps/drawing/types').ShapeType | null,
    freehandActive: false,
    parcelSelectMode: false,
  });

  // Menus & 3D state
  const [shapeDrawingModalVisible, setShapeDrawingModalVisible] = useState(false);
  const [homeMapToolsSheetOpen, setHomeMapToolsSheetOpen] = useState(false);
  const [homeParcelDesignSheetOpen, setHomeParcelDesignSheetOpen] = useState(false);
  /** Onaylanmış parsel poligon stili; null = varsayılan tema */
  const [homeParcelPolygonDesign, setHomeParcelPolygonDesign] = useState<ParcelPolygonDesignConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadSavedParcelPolygonDesign();
      if (!cancelled && saved) {
        setHomeParcelPolygonDesign(saved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirmParcelPolygonDesign = useCallback((cfg: ParcelPolygonDesignConfig) => {
    setHomeParcelPolygonDesign(cfg);
    void saveParcelPolygonDesign(cfg);
  }, []);
  const [showEdgeMeasurements, setShowEdgeMeasurements] = useState(false);
  const [locationMenuVisible, setLocationMenuVisible] = useState(false);
  const [show3DSlider, setShow3DSlider] = useState(false);
  const [pitchValue, setPitchValue] = useState(0);
  const threeDPanelAnim = useRef(new Animated.Value(0)).current;
  const zoomPanelAnim = useRef(new Animated.Value(0)).current;
  const zoomQueryButtonsOpacity = useRef(new Animated.Value(1)).current;
  const [holdMapToolsActive, setHoldMapToolsActive] = useState(false);
  const holdMapToolsActiveRef = useRef(false);
  const [plusZoomMapScrollLocked, setPlusZoomMapScrollLocked] = useState(false);
  const [plusZoomUiDirection, setPlusZoomUiDirection] = useState<1 | -1 | null>(null);
  const [plusZoomSpeedT, setPlusZoomSpeedT] = useState(0);
  const holdMapToolsPlusCenterRef = useRef<[number, number] | null>(null);
  const mapPlusCenterRef = useRef<[number, number] | null>(null);
  const pendingOpenHoldToolsRef = useRef(false);
  const plusZoomAnchorGeoRef = useRef<[number, number] | null>(null);
  const plusZoomDirectionRef = useRef<1 | -1 | null>(null);
  const plusZoomTouchAnchorYRef = useRef(0);
  const plusZoomSpeedMultRef = useRef(1);
  const plusZoomHoldingRef = useRef(false);
  const PLUS_TOOLS_ZOOM_STEP = 0.06;
  const PLUS_TOOLS_ZOOM_INTERVAL_MS = 48;
  const PLUS_ZOOM_SPEED_SLOP_PX = 8;
  const PLUS_ZOOM_SPEED_RAMP_PX = 72;
  const PLUS_ZOOM_SPEED_MAX_MULT = 3.2;
  const [edgeMeasurementFeatures, setEdgeMeasurementFeatures] = useState<EdgeMeasurementFeature[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [infoModeActive, setInfoModeActive] = useState(false);
  /** Alt sorgu çubuğu: Pro / Basit seçimi */
  const [queryModeChoice, setQueryModeChoice] = useState<'pro' | 'simple' | null>(null);
  const [simpleModeEdgeMeasureData, setSimpleModeEdgeMeasureData] = useState<EdgeMeasureData | null>(null);

  // Bottom pill bar submenu positioning (anchor each submenu above its button)
  const [pillBarLayout, setPillBarLayout] = useState<{ x: number; width: number } | null>(null);
  const [rulerButtonLayout, setRulerButtonLayout] = useState<{ x: number; width: number } | null>(null);
  const [locationButtonLayout, setLocationButtonLayout] = useState<{ x: number; width: number } | null>(null);
  const [locationMenuWidth, setLocationMenuWidth] = useState(180);

  const getSubMenuLeft = (button: { x: number; width: number } | null, menuWidth: number) => {
    // 8px padding from screen edges
    const padding = 8;
    if (!pillBarLayout || !button || !menuWidth) return padding;
    const centerX = pillBarLayout.x + button.x + button.width / 2;
    const unclampedLeft = centerX - menuWidth / 2;
    return Math.max(padding, Math.min(unclampedLeft, SCREEN_WIDTH - menuWidth - padding));
  };
  
  const mapRef = useRef<any>(null);
  const homeMapViewportRef = useRef<MapOverlayViewport>(DEFAULT_MAP_OVERLAY_VIEWPORT);
  const suppressNextMapPressRef = useRef(false);

  const drawing = useShapeDrawingSession({
    mapRef,
    defaultOutlineColor: '#3b82f6',
    defaultFillColor: 'rgba(59, 130, 246, 0.45)',
    defaultOutlineWidth: 4,
    isShapeTapBlocked: () => isMapPlacementToolActive(mapToolLockRef.current),
    closeModeAfterPenCommit: false,
  });

  mapToolLockRef.current = {
    measurementActive: measurement.isActive,
    shapeDrawingMode: drawing.shapeDrawingMode,
    freehandActive: drawing.freehandActive,
    parcelSelectMode: false,
  };
  const isMapInteractionLocked = isMapPlacementToolActive(mapToolLockRef.current);

  const cameraRef = useRef<any>(null);
  const isProgrammaticMoveRef = useRef(false);
  const programmaticTimerRef = useRef<any>(null);
  const combinedContainerRef = useRef<any>(null);
  /** Ekran görüntüsü / pro sorgu capture anında sabitlenen parsel (state commit gecikmesine karşı) */
  const [screenshotTargetParcelData, setScreenshotTargetParcelData] = useState<ParcelData | null>(null);
  const modalContentRef = useRef<any>(null);
  const camRef = useRef({
    center: TURKEY_MAP_CENTER,
    zoom: TURKEY_MAP_ZOOM,
    pitch: 0,
    heading: 0,
  });
  const [parcelPatternLayoutTick, setParcelPatternLayoutTick] = useState(0);
  const parcelPatternRelayoutPendingRef = useRef(false);
  const parcelPatternVisibleRef = useRef(false);

  useEffect(() => {
    const hasPattern =
      homeParcelPolygonDesign?.patternId != null &&
      homeParcelPolygonDesign.patternId !== 'none';
    const hasGeometry =
      (isProMode && !!parcelData?.geometry) ||
      (!isProMode && simpleModeParcels.some((p) => !!p.geometry));
    parcelPatternVisibleRef.current = hasPattern && hasGeometry;
  }, [
    homeParcelPolygonDesign?.patternId,
    isProMode,
    parcelData?.geometry,
    simpleModeParcels,
  ]);

  /** Kamera hareketi — rAF ile tek karede bir projeksiyon (sonsuz setState döngüsünü önler). */
  const bumpParcelPatternLayout = useCallback(() => {
    if (!parcelPatternVisibleRef.current) return;
    if (parcelPatternRelayoutPendingRef.current) return;
    parcelPatternRelayoutPendingRef.current = true;
    requestAnimationFrame(() => {
      parcelPatternRelayoutPendingRef.current = false;
      setParcelPatternLayoutTick((t) => t + 1);
    });
  }, []);
  const mapReadyRef = useRef({ didFinishLoadingMap: false, didFinishLoadingStyle: false, isIdle: false });
  const mapTurkeyAppliedRef = useRef(false);

  useEffect(() => {
    screenshotPreviewModeRef.current = screenshotPreviewMode;
  }, [screenshotPreviewMode]);

  const getCameraFingerprint = useCallback(
    () =>
      buildCameraFingerprint({
        center: camRef.current.center,
        zoom: camRef.current.zoom,
        pitch: camRef.current.pitch,
        heading: camRef.current.heading,
      }),
    [],
  );

  const runPreviewSnapPrewarm = useCallback(
    (debounceMs = 0) => {
      const params = {
        mapRef,
        mapReadyRef,
        dimensions: getCombinedImageDimensions(),
        mapViewport: drawing.mapOverlayViewport,
        shapes: drawing.shapes,
        bumpOverlayLayout: drawing.bumpTextBoxLayoutOnCamera,
        getCameraFingerprint,
        previewSnapCacheRef,
        previewPrewarmInFlightRef,
      };
      if (debounceMs <= 0) {
        startPreviewSnapPrewarm(params);
        return;
      }
      if (previewPrewarmTimerRef.current) clearTimeout(previewPrewarmTimerRef.current);
      previewPrewarmTimerRef.current = setTimeout(() => {
        startPreviewSnapPrewarm(params);
      }, debounceMs);
    },
    [
      drawing.mapOverlayViewport,
      drawing.shapes,
      drawing.bumpTextBoxLayoutOnCamera,
      getCameraFingerprint,
    ],
  );

  useEffect(() => {
    if (!screenshotPreviewMode) return;
    runPreviewSnapPrewarm(0);
    return () => {
      if (previewPrewarmTimerRef.current) clearTimeout(previewPrewarmTimerRef.current);
    };
  }, [screenshotPreviewMode, runPreviewSnapPrewarm]);

  const locationBootstrapRef = useRef(false);
  const homeLaunchBootstrapRef = useRef(false);
  /** Pro sorgu bitince harita görüntüsü yükle + son 30 gün detayına git (rapor ekranına değil). */
  const finishProQueryNavigation = useCallback(
    async (
      data: any,
      normalizedGeometry: any | null,
      unitNum: number | null,
      totalNum: number | null,
      captureParcel: ParcelData | null = null,
    ) => {
      setScreenshotTargetParcelData(captureParcel);

      if (normalizedGeometry) {
        setShowEdgeMeasurements(false);
        setParcelData(captureParcel);
        try {
          const settings = calculateBoundsAndCamera(normalizedGeometry);
          if (settings && cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: settings.center,
              zoomLevel: settings.zoom,
              pitch: camRef.current.pitch,
              animationDuration: 0,
            });
          }
        } catch (_) {}
      }

      // Loader haritayı kapatır — static map / snapshot için
      setIsLoadingParcel(false);
      setParcelLoadUiMode(null);
      await new Promise((r) => setTimeout(r, 200));

      const identifiers = extractProQueryIdentifiers(data);
      let snapshotId =
        data?.parameters_data?.dfa_snapshot_id != null
          ? Number(data.parameters_data.dfa_snapshot_id)
          : null;
      if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
        snapshotId = null;
      }
      if (!snapshotId) {
        snapshotId = await resolveDfaSnapshotId(data, identifiers);
        if (snapshotId && data?.parameters_data) {
          data.parameters_data.dfa_snapshot_id = snapshotId;
        }
      }

      if (isAuthenticated) {
        if (unitNum != null || totalNum != null) {
          setScreenshotPriceOverride({ unitPrice: unitNum, totalPrice: totalNum });
          await new Promise((r) => setTimeout(r, 80));
        }
        await captureAndUploadProQueryMapImage({
          mapRef,
          mapReadyRef,
          combinedContainerRef,
          setCapturedMapUri,
          data,
          normalizedGeometry,
          snapshotId,
          identifiers,
          parcelDesign: homeParcelPolygonDesign,
        });
        setScreenshotPriceOverride(null);
      }

      setScreenshotTargetParcelData(null);

      const navResult = await navigateAfterProQuery(router, data);
      const finalSnapshotId = navResult.snapshotId ?? snapshotId;
      const cityId = navResult.cityId ?? extractProQueryCityId(data);

      const eventPayload: PortalRecentQueriesChangedPayload = {
        snapshotId: finalSnapshotId ?? undefined,
        cityId: cityId ?? undefined,
      };
      DeviceEventEmitter.emit(PORTAL_RECENT_QUERIES_CHANGED, eventPayload);

      setActiveScreen(null);
      clearPendingPropertyTypeState();
      setInfoModeActive(false);
    },
    [router, isAuthenticated, homeParcelPolygonDesign, clearPendingPropertyTypeState],
  );
  const isSharingRef = useRef(false);
  const menuItemClickedRef = useRef(false);
  /** Alt menü satırına basıldıktan sonra Mapbox’un ürettiği hayalet harita onPress’ini kısa süre yut (sonraki gerçek tıklamayı engelleme) */
  const ghostMapPressUntilRef = useRef(0);
  const GHOST_MAP_PRESS_SUPPRESS_MS = 400;
  const suppressGhostMapPress = useCallback(() => {
    ghostMapPressUntilRef.current = Date.now() + GHOST_MAP_PRESS_SUPPRESS_MS;
  }, []);
  const intervalRef = useRef<any>(null);
  const zoomIntervalRef = useRef<any>(null);
  const pitchIntervalRef = useRef<any>(null);

  // Ölçüm çizimlerini temizle (Silgi davranışı)
  const clearMeasurementDrawings = useCallback(() => {
    measurement.clearMeasurements();
    setSelectedMeasurementGroupId(null);
  }, [measurement.clearMeasurements]);

  const handleMeasurementGroupPress = useCallback(
    (groupId: string) => {
      setSelectedMeasurementGroupId((prev) => (prev === groupId ? null : groupId));
      drawing.clearShapeSelection();
      setHomeMapToolsSheetOpen(false);
    },
    [drawing.clearShapeSelection]
  );

  const handleDeleteSelectedMeasurement = useCallback(() => {
    const gid = selectedMeasurementGroupId;
    if (!gid) return;
    Alert.alert(
      'Ölçümü sil',
      'Seçili mesafe veya alan ölçümünü haritadan kaldırmak istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            measurement.setMeasurementFeatures((prev) =>
              prev.filter((f) => f.properties?.measurementGroupId !== gid)
            );
            setSelectedMeasurementGroupId(null);
          },
        },
      ]
    );
  }, [selectedMeasurementGroupId, measurement.setMeasurementFeatures]);

  useEffect(() => {
    if (measurement.isActive) {
      setSelectedMeasurementGroupId(null);
    }
  }, [measurement.isActive]);

  useEffect(() => {
    if (selectedMeasurementGroupId) {
      setMeasurementEditPanelVisible(true);
      setMeasurementEditPanelMinimized(true);
    } else {
      setMeasurementEditPanelVisible(false);
      setMeasurementEditPanelMinimized(true);
    }
  }, [selectedMeasurementGroupId]);

  const clearAllMeasurementLayers = useCallback(() => {
    clearMeasurementDrawings();
    setShowEdgeMeasurements(false);
    setSimpleModeEdgeMeasureData(null);
    setEdgeMeasurementFeatures([]);
    drawing.clearAllShapes();
  }, [clearMeasurementDrawings, drawing]);

  const handleHomeMapSheetSetMode = useCallback((m: MeasurementMode) => {
    activateMeasurementTool(drawing, measurement, m);
  }, [drawing, measurement]);

  const handleCloseHomeMapToolbox = useCallback(() => {
    measurement.closeMeasurementMode();
    drawing.exitDrawToolMode();
  }, [measurement.closeMeasurementMode, drawing.exitDrawToolMode]);

  const handleHomeMapToolsSheetDismiss = useCallback(() => {
    setHomeMapToolsSheetOpen(false);
    if (drawing.shapeDrawingMode === 'marker') {
      drawing.exitDrawToolMode();
    }
  }, [drawing]);

  const handleHomeMapSheetSelectShape = useCallback((next: ShapeType | null) => {
    activateShapeTool(drawing, measurement, next, {
      onAfterActivate: () => setHomeMapToolsSheetOpen(false),
    });
  }, [drawing, measurement]);

  const hasParcelForHisseliHome = useMemo(() => {
    const targetParcel = isProMode ? parcelData : (selectedParcelForModal || (simpleModeParcels.length > 0 ? simpleModeParcels[simpleModeParcels.length - 1] : null));
    return Boolean(targetParcel?.geometry);
  }, [isProMode, parcelData, selectedParcelForModal, simpleModeParcels]);

  const handleHisseliFromHomeMapSheet = useCallback(() => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
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
  }, [isProMode, parcelData, selectedParcelForModal, simpleModeParcels, router, suppressGhostMapPress]);

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
    if (isAuthLoading || !isAuthenticated) {
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
  }, [isAuthenticated, isAuthLoading]);

  // Uzman görüşü badge counts (incoming + my replies)
  const badgeReqIdRef = useRef(0);
  const refreshExpertBadges = useCallback(async () => {
    const reqId = ++badgeReqIdRef.current;
    if (isAuthLoading || !isAuthenticated) {
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
  }, [isAuthenticated, isAuthLoading]);

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
    if (isAuthLoading || !isAuthenticated) return;
    const id = setInterval(() => {
      refreshNotificationsUnread();
      refreshExpertBadges();
    }, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, isAuthLoading, refreshNotificationsUnread, refreshExpertBadges]);

  // --- Handlers ---
  const openParcelSearchModal = useCallback((tab: ParcelSearchTabKey = 'parcel') => {
    setParcelSearchInitialTab(tab);
    setActiveScreen('ada-parsel');
  }, []);

  const handleHomeVoiceQueryResolved = useCallback(
    (payload: SmartQueryParcelPayload) => {
      setIncomingParcelFormSeed(smartQueryPayloadToFormSeed(payload));
      openParcelSearchModal('parcel');
    },
    [openParcelSearchModal]
  );

  const handleSearchToggle = useCallback(() => {
    setActiveScreen(prev => {
      if (prev === 'ada-parsel') return null;
      return 'ada-parsel';
    });
    setParcelSearchInitialTab('parcel');
  }, []);

  const openIlanVer = useCallback(async () => {
    if (!isAuthenticated) {
      setMenuVisible(false);
      Alert.alert('Giriş gerekli', 'İlan vermek için giriş yapın veya kayıt olun.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Giriş', onPress: () => router.push('login') },
      ]);
      return;
    }
    menuItemClickedRef.current = true;
    setMenuVisible(false);
    setSubmenuOpenId(null);
    setMenuSheetIndex(0);
    try {
      const res = await createListingDraft();
      if (!res.ok) {
        Alert.alert('İlan oluşturulamadı', res.error || 'Sunucu yanıtı alınamadı.');
        return;
      }
      const lid = (res.data as { data?: { listing_id?: string } })?.data?.listing_id;
      if (!lid) {
        Alert.alert('İlan oluşturulamadı', 'Tanıtıcı alınamadı.');
        return;
      }
      router.push('portal-webview', {
        path: `/portal/ilan/${lid}/duzenle/`,
        title: 'İlan düzenle',
      });
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'İlan oluşturulamadı.');
    }
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
    if (itemId === 'ilan-islemleri') {
      setSubmenuOpenId((prev) => {
        const next = prev === 'ilan-islemleri' ? null : 'ilan-islemleri';
        setMenuSheetIndex(next ? 1 : 0);
        return next;
      });
      return;
    }
    if (itemId === 'ai-video') {
      setSubmenuOpenId((prev) => {
        const next = prev === 'ai-video' ? null : 'ai-video';
        setMenuSheetIndex(next ? 1 : 0);
        return next;
      });
      return;
    }
    if (itemId === 'sorgularim') {
      setMenuVisible(false);
      setSubmenuOpenId(null);
      setMenuSheetIndex(0);
      setMyQueriesVisible(true);
      return;
    }
    if (itemId === 'cikis') {
      // Onay diyaloğu menü kapanmadan gösterilmeli; aksi halde Android'de Activity bağlı değilken Alert çöküyor.
      Alert.alert(
        'Çıkış Yap',
        'Çıkış yapmak istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Çıkış Yap',
            style: 'destructive',
            onPress: async () => {
              menuItemClickedRef.current = true;
              setMenuVisible(false);
              setSubmenuOpenId(null);
              setUzmanGorusuOpen(false);
              setMenuSheetIndex(0);
              try {
                await logout();
                console.log('[Index] Logout successful');
              } catch (error) {
                console.error('[Index] Logout error:', error);
                InteractionManager.runAfterInteractions(() => {
                  Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
                });
              }
            },
          },
        ]
      );
      return;
    }
    menuItemClickedRef.current = true;
    setMenuVisible(false);
    setSubmenuOpenId(null);
    setUzmanGorusuOpen(false);
    setMenuSheetIndex(0);
    if (itemId === 'landing-intro') {
      router.push('landing', { skipIntro: true });
    } else if (itemId === 'emlak-vitrini') {
      router.replace('emlak-vitrini-liste');
    } else if (itemId === 'son-30-gun-pro') {
      router.push('son-30-gun');
    } else if (itemId === 'promahalle') {
      router.push('promahalle', { title: 'ProMahalle' });
    } else if (itemId === 'sosyal-medya-sablonu') {
      router.push('sosyal-medya-sablonu', { source: 'menu' });
    } else if (itemId === 'aranacaklar') {
      router.push('aranacaklar');
    } else if (itemId === 'hisseli-parsel-projelerim') {
      setParcelSplitProjectsVisible(true);
    } else if (itemId === '3d-tasarimlarim') {
      setThreeDDesignsVisible(true);
    } else if (itemId === 'chatbot') {
      router.push('chatbot');
    } else if (itemId === 'kredi-paketleri') {
      router.push('pricing');
    } else if (itemId === 'bildirimler') {
      router.push('notifications');
    } else if (itemId === 'uzman-gorusu-isteklerim') {
      router.push({ pathname: 'expert-requests', params: { mode: 'mine' } });
    } else if (itemId === 'uzman-gorusu-gelen') {
      router.push({ pathname: 'expert-requests', params: { mode: 'incoming' } });
    } else if (itemId === 'kullanici') {
      router.push(isAuthenticated ? 'profile' : 'login');
    } else if (itemId === 'admin-panel') {
      router.push('admin');
    } else if (itemId === 'emsal-satis-bildir') {
      router.push('sales-report');
    } else if (itemId === 'giris') {
      // Giriş sayfasına yönlendir
      router.push('login');
    } else if (itemId === 'hukuki-metinler') {
      router.push('legal-hub');
    } else if (itemId === 'ilan-ver') {
      void openIlanVer();
    } else if (itemId === 'ilanlarim') {
      router.push('ilanlarim');
    } else if (itemId === 'ai-video-studio') {
      if (!isAuthenticated) {
        Alert.alert('Giriş gerekli', 'AI Video için giriş yapın.', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Giriş', onPress: () => router.push('login') },
        ]);
        return;
      }
      router.push('ai-video-studio');
    } else if (itemId === 'ai-image-animation') {
      if (!isAuthenticated) {
        Alert.alert('Giriş gerekli', 'AI Resim için giriş yapın.', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Giriş', onPress: () => router.push('login') },
        ]);
        return;
      }
      router.push('ai-image-animation-purchase');
    } else if (itemId === 'ai-drone-video') {
      router.push('ai-drone-hub');
    } else if (itemId === 'ai-drone-jobs') {
      if (!isAuthenticated) {
        Alert.alert('Giriş gerekli', 'İşlerinizi görmek için giriş yapın.', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Giriş', onPress: () => router.push('login') },
        ]);
        return;
      }
      router.push('ai-drone-jobs');
    } else if (itemId === 'ilan-mesajlar') {
      if (!isAuthenticated) {
        Alert.alert('Giriş gerekli', 'Mesajları görmek için giriş yapın.', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Giriş', onPress: () => router.push('login') },
        ]);
        return;
      }
      router.push('portal-webview', {
        path: '/portal/ilan/mesajlar/',
        title: 'Mesajlar',
      });
    } else {
      console.log('[Index] Unknown menu item:', itemId);
    }
  }, [router, logout, openIlanVer, isAuthenticated]);

  const handleCloseForm = useCallback(() => {
    setActiveScreen(null);
  }, []);

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

  const streetViewParcel = useMemo(() => {
    if (isProMode) return parcelData;
    return selectedParcelForModal || (simpleModeParcels.length > 0 ? simpleModeParcels[simpleModeParcels.length - 1] : null);
  }, [isProMode, parcelData, selectedParcelForModal, simpleModeParcels]);

  const streetViewPoint = useMemo(() => {
    if (!streetViewParcel?.geometry) return null;
    return getFirstStreetViewPoint(streetViewParcel.geometry, streetViewParcel.analysisData);
  }, [streetViewParcel]);

  // Redirect-after-login: giriş/kayıt sonrası model editöre dön (hasActiveParcel tanımından sonra)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const target = await storageService.getRedirectAfterLogin();
        if (cancelled) return;
        if (target === REDIRECT_TARGET_MODEL_EDITOR) {
          await storageService.clearRedirectAfterLogin();
          if (!hasActiveParcel) {
            Alert.alert(
              'Parsel seçin',
              '3D model editörü için önce ana sayfada bir parsel sorgulayıp haritadan seçin; ardından editörü yeniden açın.',
            );
            return;
          }
          setShapeDrawingModalVisible(true);
        }
      })();
      return () => { cancelled = true; };
    }, [hasActiveParcel])
  );

  const openModelEditorOrRequireAuth = useCallback(() => {
    if (isAuthenticated) {
      if (!hasActiveParcel) {
        Alert.alert(
          'Parsel seçin',
          '3D model editörünü kullanmak için önce ana sayfada bir parsel sorgulayıp haritadan seçin.',
        );
        return;
      }
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
  }, [isAuthenticated, hasActiveParcel, router]);

  const isSimpleLoading = isLoadingParcel && parcelLoadUiMode === 'simple';
  const showProModeLoader =
    isLoadingParcel &&
    parcelLoadUiMode === 'pro' &&
    !proQueryConfirmVisible &&
    !propertyTypeModalVisible;
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
    if (isAuthLoading) {
      return;
    }
    if (!isAuthenticated) {
      setUserProfile(null);
      return;
    }

    try {
      const response = await authService.getProfile();
      if (response.success && response.data?.profile) {
        const { profile, user: profileUser, public: publicProfile } = response.data;
        setUserProfile({
          ...profile,
          is_expert:
            publicProfile?.is_expert ??
            profileUser?.is_expert ??
            profile.is_expert,
          membership_display:
            publicProfile?.membership_display ??
            profile.membership_display ??
            profileUser?.membership_display,
          effective_corporate_type:
            publicProfile?.effective_corporate_type ??
            profile.effective_corporate_type,
        });
      }
    } catch (error) {
      console.error('[Index] Profil yükleme hatası:', {
        isAuthenticated,
        isAuthLoading,
        error,
      });
    }
  }, [isAuthenticated, isAuthLoading]);

  // Profil verilerini yükle
  useEffect(() => {
    if (isAuthLoading) return;
    loadUserProfile();
  }, [isAuthLoading, loadUserProfile]);

  // Kredi bakiyesini API'den güncel olarak yükle (veritabanından gerçek kullanım hakkı)
  const loadCreditBalance = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }
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
      console.error('[Index] Kredi bakiyesi yüklenemedi:', {
        isAuthenticated,
        isAuthLoading,
        endpoint: '/api/credit/balance/',
        error,
      });
      setCreditBalance(null);
    } finally {
      setIsLoadingCredit(false);
    }
  }, [isAuthenticated, isAuthLoading]);

  // İlk mount'ta ve her sayfa girişinde / başka sayfalardan geri gelindiğinde bakiyeyi güncelle
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) loadCreditBalance();
  }, [isAuthenticated, isAuthLoading, loadCreditBalance]);

  // İlk üyelik hoşgeldin kontrolü
  useEffect(() => {
    if (isAuthenticated && user && user.has_seen_welcome === false) {
      const timer = setTimeout(() => setWelcomeVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  // İlk giriş tour kontrolü (welcome zaten görüldüyse veya welcome kapandıktan sonra)
  useEffect(() => {
    if (!isAuthenticated || !user || user.has_seen_app_tour !== false) return;
    if (user.has_seen_welcome === false) return;
    const timer = setTimeout(() => setTourVisible(true), 800);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthLoading) return;
      loadCreditBalance();
      loadUserProfile();
    }, [isAuthLoading, loadCreditBalance, loadUserProfile])
  );

  const handleToggleScreenshotPricePanel = useCallback(() => {
    if (hasMultipleVisibleParcels) {
      setMultiParcelPriceWarningVisible(true);
      return;
    }
    if (!hasActiveParcel) return;
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

  const screenshotParcelForCapture = screenshotTargetParcelData ?? activeParcelData;

  const getMergedParcelPropsForScreenshot = useCallback((): Record<string, any> => {
    return mergeParcelDisplayProperties(screenshotParcelForCapture);
  }, [screenshotParcelForCapture]);

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
      const r = await fetchWithAuth(`${backendUrl}/api/user_print_screen_price/`, {
        method: 'POST',
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
      parcelData: screenshotParcelForCapture,
      mapRef,
      combinedContainerRef,
      mapReadyRef,
      isSharingRef,
      setIsProcessingShare,
      setCapturedMapUri,
      setCapturedModalUri,
      setShareModalVisible,
      parcelDesign: homeParcelPolygonDesign,
      mapViewport: drawing.mapOverlayViewport,
      shapes: drawing.shapes,
      bumpOverlayLayout: drawing.bumpTextBoxLayoutOnCamera,
      prefetchedShareLinkRef,
      previewSnapCacheRef,
      previewPrewarmInFlightRef,
      getCameraFingerprint,
      hasActiveParcel,
    }),
    [
      screenshotParcelForCapture,
      activeParcelData,
      homeParcelPolygonDesign,
      drawing.mapOverlayViewport,
      drawing.shapes,
      drawing.bumpTextBoxLayoutOnCamera,
      getCameraFingerprint,
      hasActiveParcel,
    ]
  );

  const handleCameraPress = useCallback(() => {
    // Her çekimde temiz başla (kullanıcı yeni fiyat girebilsin)
    setScreenshotTotalPriceInput('');
    setScreenshotPriceOverride(null);
    setScreenshotPricePanelVisible(false);
    if (previewSnapCacheRef.current) {
      void cleanupTempFiles([previewSnapCacheRef.current.mapUri]);
      previewSnapCacheRef.current = null;
    }
    setScreenshotTargetParcelData(activeParcelData);
    if (activeParcelData) {
      prefetchedShareLinkRef.current = resolveParcelShareMessageUrlForShare(activeParcelData);
    } else {
      prefetchedShareLinkRef.current = null;
    }
    setScreenshotPreviewMode(true);
    runPreviewSnapPrewarm(0);
  }, [activeParcelData, runPreviewSnapPrewarm]);

  const handleConfirmScreenshot = useCallback(async () => {
    // Giriş yapmamış kullanıcılar için Coin Kazan modalı açılmaz, direkt paylaş
    if (!isAuthenticated) {
      await doConfirmScreenshot(true); // skipCoin = true
      return;
    }
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
  }, [isAuthenticated, hasActiveParcel, canOpenPricePanel, screenshotTotalPriceInput, screenshotAreaNum, screenshotMergedProps, saveUserPrintScreenPrice, handleShare]);

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
        setScreenshotTargetParcelData(null);
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

    // Fiyat şablonu değiştiyse ViewShot'un güncel metni alması için kısa frame bekle
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
      setScreenshotTargetParcelData(null);
    }
  }, [handleShare, hasActiveParcel, screenshotTotalPriceInput, screenshotAreaNum, screenshotMergedProps, saveUserPrintScreenPrice]);

  const handleCancelScreenshot = useCallback(() => {
    setScreenshotPreviewMode(false);
    setScreenshotPriceOverride(null);
    setScreenshotTotalPriceInput('');
    setScreenshotPricePanelVisible(false);
    setScreenshotTargetParcelData(null);
    if (previewSnapCacheRef.current) {
      void cleanupTempFiles([previewSnapCacheRef.current.mapUri]);
      previewSnapCacheRef.current = null;
    }
  }, []);

  useScreenshotListener({ activeScreen, parcelData: activeParcelData, parcelModalVisible, setShareModalVisible });

  // Map & Logic Helpers
  /**
   * GeoJSON koordinat normalizasyonu: [lat,lon] -> [lon,lat]
   * Mapbox [lon,lat] bekler. TKGM verisi [lat,lon] gelebilir.
   * Server (swap_latlon_in_geometry) zaten swap yapiyorsa tekrar swap etmemeli.
   * TR bbox tespiti ile sadece gerekli olduğunda swap yapar.
   */
  const normalizeGeometryCoordinates = (geometry: any): any => {
    if (!geometry || !geometry.coordinates) return geometry;
    // İlk koordinat çiftini al
    let first: [number, number] | null = null;
    try {
      if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) {
        first = geometry.coordinates[0][0];
      } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0]?.[0])) {
        first = geometry.coordinates[0][0][0];
      } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
        first = [geometry.coordinates[0], geometry.coordinates[1]];
      }
    } catch {}
    if (!first || typeof first[0] !== 'number' || typeof first[1] !== 'number') return geometry;
    const x = first[0];
    const y = first[1];
    // TR lat aralığı (35-43) ve lon aralığı (25-46):
    // Eğer x lat aralığında VE y lon aralığında ise → [lat,lon] formatı → swap gerekli
    // Eğer x lon aralığında (25-46) ve y lat aralığında (35-43) değilse → zaten [lon,lat] → swap gereksiz
    const looksLikeLatLonTR = Number.isFinite(x) && Number.isFinite(y) && x >= 35 && x <= 43 && y >= 25 && y <= 46;
    if (!looksLikeLatLonTR) return geometry; // Zaten [lon,lat] formatında, dokunma
    // Swap gerekli: [lat,lon] -> [lon,lat]
    const swap = (coords: any): any => {
      if (!Array.isArray(coords)) return coords;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[1], coords[0], ...coords.slice(2)];
      }
      return coords.map(swap);
    };
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

  const maybeFitSimpleQueryParcel = useCallback(
    (geometry: any) => {
      setTimeout(() => {
        void fitParcelInViewIfNeeded({
          mapRef,
          cameraRef,
          camRef,
          geometry,
          viewport: homeMapViewportRef.current,
          currentZoom: camRef.current.zoom ?? 4,
          currentPitch: camRef.current.pitch ?? 0,
          animationDuration: 900,
          isProgrammaticMoveRef,
          programmaticTimerRef,
        });
      }, 150);
    },
    [],
  );

  const zoomToParcelOnMap = useCallback((geometry: any) => {
    setTimeout(() => {
      zoomMapToParcelGeometry({
        cameraRef,
        camRef,
        geometry,
        animationDuration: 900,
        isProgrammaticMoveRef,
        programmaticTimerRef,
      });
    }, 150);
  }, []);

  /** 3D Tasarımlarım listesinden parsel seçildiğinde TKGM ile yükle ve 3D editörü aç */
  const handleOpenParcelFrom3dDesignList = useCallback(
    async (entry: Parcel3dEntry) => {
      if (!String(entry.ada ?? "").trim() || !String(entry.parsel ?? "").trim()) {
        Alert.alert("Bilgi", "Geçersiz ada/parsel bilgisi.");
        return;
      }

      const resolved = resolveTkgmFor3dDesignOpen(entry);
      let mahalleTkgmValue = resolved.mahalleTkgmValue;
      let proparcelValue = resolved.proparcelValue;

      if (mahalleTkgmValue == null && proparcelValue == null) {
        Alert.alert(
          "Mahalle bilgisi eksik",
          "Bu parsel için TKGM mahalle kodu bulunamadı. Ana sayfada Ada/Parsel ile parseli yeniden sorgulayıp 3D düzenleme satın alın; böylece kayıt güncellenir.",
        );
        return;
      }

      setIsLoadingParcel(true);
      try {
        const mahalleResolved = await resolveMahalleTkgmForDirectQuery(
          mahalleTkgmValue,
          proparcelValue,
        );
        if (!mahalleResolved.ok) {
          Alert.alert("Mahalle bilgisi eksik", mahalleResolved.error);
          return;
        }

        const data = await fetchTkgmByIds(
          mahalleResolved.mahalleTkgmValue,
          String(entry.ada).trim(),
          String(entry.parsel).trim(),
          undefined,
          confirmPassiveParcel,
        );
        if (!data.geometry) {
          Alert.alert("Bilgi", "Parsel bulunamadı.");
          return;
        }

        const respProps = (data.properties || {}) as Record<string, unknown>;
        const p = respProps as any;
        const resolvedMid = Number(p?.mahalleId ?? p?.MahalleId ?? p?.tkgm_value ?? p?.Tkgm_value);
        const resolvedPp = Number(p?.Proparcel_value ?? p?.proparcel_value);
        if (Number.isFinite(resolvedMid) || Number.isFinite(resolvedPp)) {
          await mergeParcel3dEntryFields(
            {
              mahalle: entry.mahalle,
              ada: entry.ada,
              parsel: entry.parsel,
            },
            {
              ...(Number.isFinite(resolvedMid) ? { mahalleTkgmValue: resolvedMid } : {}),
              ...(Number.isFinite(resolvedPp) ? { proparcelValue: resolvedPp } : {}),
            }
          );
        }

        const normalizedGeom = normalizeGeometryCoordinates(data.geometry);
        const settings = calculateBoundsAndCamera(normalizedGeom);
        if (isProMode) {
          setParcelData({ geometry: normalizedGeom, properties: data.properties || {}, analysisData: null });
        } else {
          setShowEdgeMeasurements(false);
          setSimpleModeEdgeMeasureData(null);
          const newParcel: SimpleModeParcel = {
            geometry: normalizedGeom,
            properties: data.properties || {},
            analysisData: null,
            id: generateParcelId(),
          };
          setSimpleModeParcels((prev) => {
            const updated = [...prev, newParcel];
            return updated.length > MAX_SIMPLE_MODE_PARCELS ? updated.slice(1) : updated;
          });
          setSelectedParcelForModal(newParcel);
        }
        if (settings && cameraRef.current) {
          setTimeout(() => {
            if (isProMode) {
              cameraRef.current?.setCamera?.({
                centerCoordinate: settings.center,
                zoomLevel: settings.zoom,
                pitch: camRef.current.pitch,
                animationDuration: 900,
              });
            } else {
              maybeFitSimpleQueryParcel(normalizedGeom);
            }
          }, 100);
        }
        setShapeDrawingModalVisible(true);
      } catch (e: any) {
        console.error("[Index] handleOpenParcelFrom3dDesignList", e);
        Alert.alert("Hata", e?.message || "Parsel yüklenemedi.");
      } finally {
        setIsLoadingParcel(false);
      }
    },
    [isProMode, is3DMode, cameraRef, camRef, maybeFitSimpleQueryParcel]
  );

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

  const handleAdaParselSubmit = useCallback(async (payload: any, options?: { forcePro?: boolean; zoomToParcel?: boolean }) => {
    setActiveScreen(null);
    const runAsPro = isProMode || options?.forcePro === true;
    if (options?.forcePro) {
      setIsProMode(true);
      setQueryModeChoice('pro');
    }
    const loadSeq = beginParcelQueryLoad(runAsPro ? 'pro' : 'simple');
    // Yeni parsel sorgulanacağı için kenar ölçülerini kapat
    setShowEdgeMeasurements(false);

    // Pro modda parcelData temizle, basit modda array'e ekleyeceğiz
    if (runAsPro) {
      setParcelData(null);
    } else {
      setSimpleModeEdgeMeasureData(null);
    }
    try {
      if (runAsPro) {
        console.log('[handleAdaParselSubmit] PRO MOD: Başlangıç, runAsPro:', runAsPro);
        // Pro mod: Önce TKGM sorgusu yap, parseli çiz, sonra onay al (property type modal onaydan sonra açılacak)
        console.log('[handleAdaParselSubmit] PRO MOD: TKGM sorgusu başlatılıyor (doğrudan TKGM)...');
        const tkgmData = await fetchTkgmByIds(
          payload.mahalleTkgmValue,
          payload.ada,
          payload.parsel,
          undefined,
          confirmPassiveParcel,
        );
        console.log('[handleAdaParselSubmit] PRO MOD: TKGM sorgusu tamamlandı, geometry var mı:', !!tkgmData.geometry);
        
        if (!tkgmData.geometry) {
          console.warn('[handleAdaParselSubmit] PRO MOD: Geometry yok, işlem sonlandırılıyor');
          return;
        }
        if (isParcelQueryLoadStale(loadSeq)) return;

        // Parseli haritada çiz (kullanıcı onaylamadan önce parseli görsün) — TKGM raw [lat,lon] → normalize
        try {
          const normalizedTkgmGeomAda = normalizeGeometryCoordinates(tkgmData.geometry);
          setParcelData({ geometry: normalizedTkgmGeomAda, properties: tkgmData.properties || {}, analysisData: null });
          if (options?.zoomToParcel) {
            zoomToParcelOnMap(normalizedTkgmGeomAda);
          } else {
            const s = calculateBoundsAndCamera(normalizedTkgmGeomAda);
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
          }
          setActiveScreen(null);
        } catch (_) {}

        void persistTkgmResponseToMyQueries(tkgmData, !!isAuthenticated, 'pro', payload).catch((saveErr) => {
          console.warn('[handleAdaParselSubmit] PRO MOD: Sorgularım kaydı başarısız:', saveErr);
        });

        const nitelikText = extractNitelikText(tkgmData);
        const { title, suggestedType } = generatePropertyTypeTitle(nitelikText);

        setPendingTkgmData(tkgmData);
        setPendingCoordinates(null);
        setPendingShareData(null);
        setPropertyTypeModalTitle(title);
        setPropertyTypeModalSuggested(suggestedType);
        setProQueryConfirmVisible(true);
      } else {
        console.log('[handleAdaParselSubmit] BASIT MOD: Başlangıç, runAsPro:', runAsPro);
        // Basit mod: Direkt TKGM sorgusu ve array'e ekle
        // Yeni parsel sorgulanacağı için kenar ölçülerini kapat
        setShowEdgeMeasurements(false);
        setSimpleModeEdgeMeasureData(null);
        
        const data = await fetchTkgmByIds(
          payload.mahalleTkgmValue,
          payload.ada,
          payload.parsel,
          undefined,
          confirmPassiveParcel,
        );
        if (!data.geometry) return;
        if (isParcelQueryLoadStale(loadSeq)) return;

        const normalizedGeom = normalizeParcelGeometry(data.geometry);
        addParcelToSimpleMode({
          geometry: normalizedGeom,
          properties: data.properties || {},
          analysisData: null,
        });

        if (options?.zoomToParcel) {
          zoomToParcelOnMap(normalizedGeom);
        } else {
          maybeFitSimpleQueryParcel(normalizedGeom);
        }
        setActiveScreen(null);

        void persistTkgmResponseToMyQueries(data, !!isAuthenticated, 'simple', payload).catch((saveErr) => {
          console.warn('[handleAdaParselSubmit] BASIT MOD: Sorgularım kaydı başarısız:', saveErr);
        });
      }
    } catch (error: any) {
      console.error('[handleAdaParselSubmit] Sorgu hatası:', error);
      if (error?.type === 'TKGM_PARCEL_NOT_FOUND') {
        Alert.alert('Parsel Bulunamadı', error.message || 'Parsel bulunamadı.', [{ text: 'Tamam' }]);
        return;
      }
      if (error?.type === 'TKGM_RATE_LIMIT') {
        Alert.alert(
          'Günlük Sorgu Limiti',
          error.message || 'TKGM günlük sorgu limiti aşıldı. Lütfen daha sonra tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
        return;
      }
      if (error?.type === 'TIMEOUT' || error?.type === 'CORS_OR_NETWORK_ERROR') {
        Alert.alert('Bağlantı Hatası', error.message || 'TKGM sunucusuna bağlanılamadı.', [{ text: 'Tamam' }]);
        return;
      }
      if (error instanceof QueryLimitError) {
        Alert.alert(
          'Günlük Sorgu Limiti',
          `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
          isAuthenticated
            ? [{ text: 'Tamam' }]
            : [
                { text: 'Kapat', style: 'cancel' },
                { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) },
              ]
        );
      } else {
        Alert.alert(
          'Bağlantı Hatası',
          'Parsel sorgusu tamamlanamadı. Lütfen internet bağlantınızı kontrol edin.',
          [{ text: 'Tamam' }]
        );
      }
    } finally {
      endParcelQueryLoad(loadSeq);
    }
  }, [
    isProMode,
    is3DMode,
    isAuthenticated,
    router,
    addParcelToSimpleMode,
    maybeFitSimpleQueryParcel,
    zoomToParcelOnMap,
    beginParcelQueryLoad,
    endParcelQueryLoad,
    isParcelQueryLoadStale,
    confirmPassiveParcel,
  ]);

  /** Web sidebar "Sorgularım" — kayıtlı sorguyu basit modda haritada yeniden çalıştır */
  const openMyQueriesSheet = useCallback(() => {
    setMenuVisible(false);
    setSubmenuOpenId(null);
    setUzmanGorusuOpen(false);
    setMenuSheetIndex(0);
    setMyQueriesVisible(true);
  }, []);

  const runSimpleQueryFromSaved = useCallback(
    (q: SavedQueryItem) => {
      setMyQueriesVisible(false);
      closeMenu();
      if (isProMode) setIsProMode(false);
      setQueryModeChoice('simple');
      const proparcelVal =
        ('proparcel_value' in q && q.proparcel_value != null ? q.proparcel_value : null) ??
        (q as SavedQuery).proparcel_value;
      const payload: {
        mahalleTkgmValue: number;
        mahalle: string;
        ada: string;
        parsel: string;
        proparcelValue?: number;
      } = {
        mahalleTkgmValue: Number(q.tkgm_value),
        mahalle: '',
        ada: String(q.ada),
        parsel: String(q.parsel),
      };
      if (proparcelVal != null && Number.isFinite(Number(proparcelVal))) {
        payload.proparcelValue = Number(proparcelVal);
      }
      setActiveScreen(null);
      void handleAdaParselSubmit(payload);
    },
    [closeMenu, isProMode, handleAdaParselSubmit]
  );

  // Deep link (App.tsx) veya pro→basit geçiş sonrası basit sorgu
  useEffect(() => {
    const params = route.params as { deepLinkSimpleQuery?: SimpleQueryDeepLinkPayload } | undefined;
    if (params?.deepLinkSimpleQuery) {
      pendingDeepLinkPayloadRef.current = params.deepLinkSimpleQuery;
      navigation.setParams({ deepLinkSimpleQuery: undefined } as any);
      if (isProMode) {
        setIsProMode(false);
        return;
      }
    }
    if (isProMode) return;
    const payload = pendingDeepLinkPayloadRef.current;
    if (!payload) return;
    pendingDeepLinkPayloadRef.current = null;
    setActiveScreen(null);
    handleAdaParselSubmit(payload);
  }, [route.params, isProMode, handleAdaParselSubmit, navigation]);
  
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
  const applyMapCamera = useCallback(
    (
      center: [number, number],
      zoom: number,
      animated = true,
      animationDurationMs = 800,
    ) => {
      if (!cameraRef.current?.setCamera) return false;
      isProgrammaticMoveRef.current = true;
      if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
      const pitch = camRef.current.pitch || 0;
      const heading = camRef.current.heading || 0;
      camRef.current = { center, zoom, pitch, heading };
      const duration = animated ? animationDurationMs : 0;
      // defaultSettings güncellemesi Android'de Camera remount → izin sonrası çökme
      try {
        cameraRef.current.setCamera({
          centerCoordinate: center,
          zoomLevel: zoom,
          pitch,
          heading,
          animationDuration: duration,
        });
      } catch (camErr) {
        if (__DEV__) console.warn("[Index] setCamera:", camErr);
        return false;
      }
      programmaticTimerRef.current = setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, animated ? duration + 100 : 80);
      return true;
    },
    [],
  );

  const focusTurkeyOnMap = useCallback(
    (animated = false) => {
      applyMapCamera(TURKEY_MAP_CENTER, TURKEY_MAP_ZOOM, animated);
    },
    [applyMapCamera],
  );

  const applyMapCameraWithRetry = useCallback(
    async (
      center: [number, number],
      zoom: number,
      animated = true,
      animationDurationMs = 800,
    ) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (applyMapCamera(center, zoom, animated, animationDurationMs)) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    },
    [applyMapCamera],
  );

  const waitForHomeMapReady = useCallback(async (maxMs = 5000): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      if (mapReadyRef.current.didFinishLoadingMap) return true;
      await new Promise((r) => setTimeout(r, 80));
    }
    return mapReadyRef.current.didFinishLoadingMap;
  }, []);

  const handleLocationHierarchySelect = useCallback(
    async (sel: LocationHierarchySelection) => {
      const reqId = ++hierarchyMapReqRef.current;
      setAdminBoundary(null);
      try {
        const result = await loadLocationBoundaryForSelection(sel);
        if (reqId !== hierarchyMapReqRef.current) return;
        setAdminBoundary(
          result.geometry ? { level: result.level, geometry: result.geometry } : null,
        );
        if (result.center != null && result.zoom != null) {
          await applyMapCameraWithRetry(result.center, result.zoom, true);
        }
      } catch (err) {
        if (__DEV__) console.warn('[Index] il/ilçe/mahalle harita:', err);
      }
    },
    [applyMapCameraWithRetry],
  );

  const moveMapToUserLocation = useCallback(
    async (
      zoom: number,
      options: { showBlueDot?: boolean; animated?: boolean } = {},
    ): Promise<boolean> => {
      const { showBlueDot = false, animated = true } = options;
      try {
        if (AppState.currentState !== "active") {
          await waitForUiSettled(400);
        }
        const { longitude, latitude } = await getCurrentCoordinates();
        const center: [number, number] = [longitude, latitude];
        const moved = await applyMapCameraWithRetry(center, zoom, animated);
        if (moved && showBlueDot) {
          setUserLocation(center);
          setShowUserLocation(true);
        }
        return moved;
      } catch (err) {
        if (__DEV__) console.warn("[Index] Konum alınamadı:", err);
        return false;
      }
    },
    [applyMapCameraWithRetry],
  );

  const focusUserLocationBootstrap = useCallback(
    (animated = true) =>
      moveMapToUserLocation(USER_BOOTSTRAP_ZOOM, { showBlueDot: false, animated }),
    [moveMapToUserLocation],
  );

  const scheduleFocusUserLocation = useCallback(
    (delayMs = 2000) => {
      if (locationBootstrapRef.current) return;
      locationBootstrapRef.current = true;
      setTimeout(() => {
        if (AppState.currentState !== "active") return;
        void focusUserLocationBootstrap(true);
      }, delayMs);
    },
    [focusUserLocationBootstrap],
  );

  const requestLocationPermissionOnLaunch = useCallback(async () => {
    try {
      const already = await hasAppLocationPermission();
      if (already) {
        scheduleFocusUserLocation(2500);
        return;
      }
      const granted = await requestAppLocationPermission();
      if (granted) {
        scheduleFocusUserLocation(2500);
      }
    } catch (err) {
      if (__DEV__) console.warn("[Index] Konum izni:", err);
    }
  }, [scheduleFocusUserLocation]);

  const focusPreferredCityOnMap = useCallback(
    async (animated = true): Promise<boolean> => {
      const cityId = await resolveHomeMapCityId(user);
      if (!cityId) return false;
      const cam = getCityMapCameraFromId(cityId);
      if (!cam) return false;
      locationBootstrapRef.current = true;
      mapTurkeyAppliedRef.current = true;
      const animMs = animated ? HOME_PREFERRED_CITY_ANIM_MS : 0;
      return applyMapCameraWithRetry(cam.center, cam.zoom, animated, animMs);
    },
    [user, applyMapCameraWithRetry],
  );

  const onHomeMapLoaded = useCallback(() => {
    mapReadyRef.current.didFinishLoadingMap = true;
    mapReadyRef.current.didFinishLoadingStyle = true;
    if (__DEV__) console.log("[Mapbox] Harita yüklendi");
    if (mapTurkeyAppliedRef.current) return;
    if (!isAuthLoading && isAuthenticated) {
      return;
    }
    mapTurkeyAppliedRef.current = true;
    focusTurkeyOnMap(false);
  }, [focusTurkeyOnMap, isAuthLoading, isAuthenticated]);

  const onHomeMapIdle = useCallback(() => {
    mapReadyRef.current.isIdle = true;
    bumpParcelPatternLayout();
  }, [bumpParcelPatternLayout]);

  useEffect(() => {
    if (isAuthLoading || homeLaunchBootstrapRef.current) return;
    homeLaunchBootstrapRef.current = true;

    let gpsTimer: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      if (isAuthenticated) {
        await waitForHomeMapReady();
        await new Promise((r) => setTimeout(r, 550));
        const moved = await focusPreferredCityOnMap(true);
        if (moved) return;
      }
      gpsTimer = setTimeout(() => {
        void requestLocationPermissionOnLaunch();
      }, 1200);
    })();

    return () => {
      if (gpsTimer) clearTimeout(gpsTimer);
    };
  }, [
    isAuthLoading,
    isAuthenticated,
    user?.city_id,
    focusPreferredCityOnMap,
    waitForHomeMapReady,
    requestLocationPermissionOnLaunch,
  ]);

  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!mapTurkeyAppliedRef.current) {
        mapTurkeyAppliedRef.current = true;
        focusTurkeyOnMap(false);
      }
    }, 2000);
    return () => clearTimeout(fallback);
  }, [focusTurkeyOnMap]);

  // Oturum kontrolü bitince harita [0,0] / Afrika'ya kaymışsa Türkiye'ye al (misafir açılış)
  useEffect(() => {
    if (isAuthLoading || !mapTurkeyAppliedRef.current) return;
    const [lng, lat] = camRef.current.center;
    const looksLikeWorldDefault =
      (Math.abs(lng) < 1 && Math.abs(lat) < 1) ||
      lat < 10 ||
      lat > 50 ||
      lng < 20 ||
      lng > 50;
    if (looksLikeWorldDefault && !parcelData?.geometry && simpleModeParcels.length === 0) {
      focusTurkeyOnMap(false);
    }
  }, [isAuthLoading, parcelData?.geometry, simpleModeParcels.length, focusTurkeyOnMap]);

  const onCameraChanged = useCallback((e: any) => {
    if (isSharingRef.current) return;
    if (!isProgrammaticMoveRef.current) {
      mapReadyRef.current.isIdle = false;
    }
    if (!plusZoomHoldingRef.current) {
      updateCamRefFromCameraChanged(e, camRef, isProgrammaticMoveRef);
    }
    if (!isProgrammaticMoveRef.current && is3DMode && show3DSlider) {
      const p = e?.properties?.pitch; if (typeof p === 'number') setPitchValue(prev => Math.abs(prev - p) >= 2 ? p : prev);
    }
    if (shapeNeedsOverlayRelayout(drawing.shapes)) {
      drawing.bumpTextBoxLayoutOnCamera();
    }
    bumpParcelPatternLayout();
    if (screenshotPreviewModeRef.current) {
      runPreviewSnapPrewarm(180);
    }
  }, [is3DMode, show3DSlider, drawing.shapes, drawing.bumpTextBoxLayoutOnCamera, runPreviewSnapPrewarm, bumpParcelPatternLayout]);
  
  const toggle3DMode = () => {
    const n = !is3DMode; 
    apply3DMode({ 
      enable: n, camRef, cameraRef, setIs3DMode, 
      setMapDefaultSettings, 
      setMapViewKey, isProgrammaticMoveRef, programmaticTimerRef 
    });
    setShow3DSlider(n); setPitchValue(n ? (camRef.current.pitch || 75) : 0);
  };

  useEffect(() => {
    Animated.spring(threeDPanelAnim, {
      toValue: show3DSlider ? 1 : 0,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();
  }, [show3DSlider, threeDPanelAnim]);

  useEffect(() => {
    Animated.spring(zoomPanelAnim, {
      toValue: holdMapToolsActive ? 1 : 0,
      useNativeDriver: true,
      tension: 68,
      friction: 11,
    }).start();
  }, [holdMapToolsActive, zoomPanelAnim]);

  useEffect(() => {
    Animated.timing(zoomQueryButtonsOpacity, {
      toValue: plusZoomUiDirection == null ? 1 : 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [plusZoomUiDirection, zoomQueryButtonsOpacity]);
  
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
    if (intervalRef.current) clearInterval(intervalRef.current);
    handleHeadingChange(delta);
    intervalRef.current = setInterval(() => { handleHeadingChange(delta); }, 150);
  };

  const stopHeadingChange = () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };

  const startZoomChange = (delta: number) => {
    handleZoomChange(delta);
    if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);
    zoomIntervalRef.current = setInterval(() => { handleZoomChange(delta); }, 150);
  };

  const stopZoomChange = () => { if (zoomIntervalRef.current) { clearInterval(zoomIntervalRef.current); zoomIntervalRef.current = null; } };

  const parseCoordFromView = (res: unknown): [number, number] | null => {
    if (Array.isArray(res) && res.length >= 2) {
      const lng = Number(res[0]);
      const lat = Number(res[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    if (res && typeof res === 'object') {
      const o = res as Record<string, unknown>;
      const lng = Number(o.lng ?? o.longitude ?? o[0]);
      const lat = Number(o.lat ?? o.latitude ?? o[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    return null;
  };


  type HoldZoomDirection = "in" | "out";

  const holdZoomSessionRef = useRef<{
    active: boolean;
    direction: HoldZoomDirection | null;
    geoAnchor: [number, number] | null;
    zoomCenterX: number;
    zoomCenterY: number;
    touchAnchorX: number;
    touchAnchorY: number;
    fingerX: number;
    fingerY: number;
    preparing: boolean;
  }>({
    active: false,
    direction: null,
    geoAnchor: null,
    zoomCenterX: 0,
    zoomCenterY: 0,
    touchAnchorX: 0,
    touchAnchorY: 0,
    fingerX: 0,
    fingerY: 0,
    preparing: false,
  });

  const HOLD_ZOOM_MIN_ZOOM = 2;
  const HOLD_ZOOM_MAX_ZOOM = 22;

  const resetHoldMapZoom = useCallback(() => {
    holdZoomSessionRef.current = {
      active: false,
      direction: null,
      geoAnchor: null,
      zoomCenterX: 0,
      zoomCenterY: 0,
      touchAnchorX: 0,
      touchAnchorY: 0,
      fingerX: 0,
      fingerY: 0,
      preparing: false,
    };
  }, []);

  const refreshPlusZoomAnchor = useCallback(async (): Promise<[number, number] | null> => {
    const map = mapRef.current;
    const plus = holdMapToolsPlusCenterRef.current;
    if (!map?.getCoordinateFromView || !plus) return null;

    try {
      const anchor = parseCoordFromView(await map.getCoordinateFromView(plus));
      if (anchor) {
        plusZoomAnchorGeoRef.current = anchor;
      }
      return anchor;
    } catch (_) {
      return null;
    }
  }, []);

  const applyPlusAnchoredZoomStep = useCallback(
    (delta: number, anchorBefore: [number, number]) => {
      const camera = cameraRef.current;
      const plus = holdMapToolsPlusCenterRef.current;
      if (!camera?.setCamera || !plus) return;

      const [plusX, plusY] = plus;

      const centerBefore = camRef.current.center as [number, number] | undefined;
      if (!centerBefore || centerBefore.length < 2) return;

      const currentZoom = camRef.current.zoom || 4;
      const nextZoom = Math.max(
        HOLD_ZOOM_MIN_ZOOM,
        Math.min(HOLD_ZOOM_MAX_ZOOM, currentZoom + delta),
      );
      const zoomDiff = nextZoom - currentZoom;
      if (zoomDiff === 0) return;

      const scale = Math.pow(2, zoomDiff);
      const centerShift = 1 - 1 / scale;
      const newCenter: [number, number] = [
        centerBefore[0] + (anchorBefore[0] - centerBefore[0]) * centerShift,
        centerBefore[1] + (anchorBefore[1] - centerBefore[1]) * centerShift,
      ];

      isProgrammaticMoveRef.current = true;
      camera.setCamera({
        centerCoordinate: newCenter,
        zoomLevel: nextZoom,
        animationDuration: 0,
      });
      camRef.current.zoom = nextZoom;
      camRef.current.center = newCenter;
      isProgrammaticMoveRef.current = false;
      holdZoomSessionRef.current.geoAnchor = anchorBefore;
      holdZoomSessionRef.current.active = true;
      holdZoomSessionRef.current.zoomCenterX = plusX;
      holdZoomSessionRef.current.zoomCenterY = plusY;
    },
    [],
  );

  const updatePlusZoomSpeedFromTouch = useCallback((pageY: number) => {
    const direction = plusZoomDirectionRef.current;
    const anchorY = plusZoomTouchAnchorYRef.current;
    if (direction == null || !Number.isFinite(anchorY)) return;

    let boostT = 0;
    if (direction > 0) {
      const upPx = anchorY - pageY;
      boostT = Math.min(1, Math.max(0, (upPx - PLUS_ZOOM_SPEED_SLOP_PX) / PLUS_ZOOM_SPEED_RAMP_PX));
    } else {
      const downPx = pageY - anchorY;
      boostT = Math.min(1, Math.max(0, (downPx - PLUS_ZOOM_SPEED_SLOP_PX) / PLUS_ZOOM_SPEED_RAMP_PX));
    }

    plusZoomSpeedMultRef.current = 1 + boostT * (PLUS_ZOOM_SPEED_MAX_MULT - 1);
    setPlusZoomSpeedT(boostT);
  }, []);

  const getPlusZoomDelta = useCallback(() => {
    const direction = plusZoomDirectionRef.current ?? 1;
    return direction * PLUS_TOOLS_ZOOM_STEP * plusZoomSpeedMultRef.current;
  }, []);

  const stopMapToolsZoomChange = useCallback(() => {
    plusZoomHoldingRef.current = false;
    plusZoomDirectionRef.current = null;
    plusZoomSpeedMultRef.current = 1;
    plusZoomAnchorGeoRef.current = null;
    setPlusZoomUiDirection(null);
    setPlusZoomSpeedT(0);
    setPlusZoomMapScrollLocked(false);
    stopZoomChange();
  }, []);

  const startMapToolsZoomChange = useCallback(
    (direction: number, touchPageY: number) => {
      if (!holdMapToolsActiveRef.current) return;
      if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);

      plusZoomHoldingRef.current = true;
      setPlusZoomMapScrollLocked(true);
      setPlusZoomUiDirection(direction > 0 ? 1 : -1);
      setPlusZoomSpeedT(0);
      plusZoomDirectionRef.current = direction > 0 ? 1 : -1;
      plusZoomTouchAnchorYRef.current = touchPageY;
      plusZoomSpeedMultRef.current = 1;
      plusZoomAnchorGeoRef.current = null;

      void refreshPlusZoomAnchor().then((anchor) => {
        if (!anchor || !plusZoomHoldingRef.current || plusZoomDirectionRef.current == null) return;

        const lockedAnchor = anchor;
        const tick = () => {
          if (!plusZoomHoldingRef.current || plusZoomDirectionRef.current == null) return;
          applyPlusAnchoredZoomStep(getPlusZoomDelta(), lockedAnchor);
        };

        tick();
        zoomIntervalRef.current = setInterval(tick, PLUS_TOOLS_ZOOM_INTERVAL_MS);
      });
    },
    [applyPlusAnchoredZoomStep, getPlusZoomDelta, refreshPlusZoomAnchor],
  );

  const mapToolsZoomInGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          runOnJS(startMapToolsZoomChange)(1, event.absoluteY);
        })
        .onUpdate((event) => {
          runOnJS(updatePlusZoomSpeedFromTouch)(event.absoluteY);
        })
        .onFinalize(() => {
          runOnJS(stopMapToolsZoomChange)();
        }),
    [startMapToolsZoomChange, stopMapToolsZoomChange, updatePlusZoomSpeedFromTouch],
  );

  const mapToolsZoomOutGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          runOnJS(startMapToolsZoomChange)(-1, event.absoluteY);
        })
        .onUpdate((event) => {
          runOnJS(updatePlusZoomSpeedFromTouch)(event.absoluteY);
        })
        .onFinalize(() => {
          runOnJS(stopMapToolsZoomChange)();
        }),
    [startMapToolsZoomChange, stopMapToolsZoomChange, updatePlusZoomSpeedFromTouch],
  );

  const activateHoldMapTools = useCallback(
    (zoomCenterX: number, zoomCenterY: number) => {
      holdMapToolsActiveRef.current = true;
      holdMapToolsPlusCenterRef.current = [zoomCenterX, zoomCenterY];
      setHoldMapToolsActive(true);

      holdZoomSessionRef.current = {
        active: true,
        direction: null,
        geoAnchor: null,
        zoomCenterX,
        zoomCenterY,
        touchAnchorX: 0,
        touchAnchorY: 0,
        fingerX: 0,
        fingerY: 0,
        preparing: false,
      };
    },
    [],
  );

  const closeHoldMapTools = useCallback(() => {
    holdMapToolsActiveRef.current = false;
    stopMapToolsZoomChange();
    resetHoldMapZoom();
    holdMapToolsPlusCenterRef.current = null;
    setHoldMapToolsActive(false);
  }, [resetHoldMapZoom, stopMapToolsZoomChange]);

  const handleMapPlusCenterReady = useCallback(
    (x: number, y: number) => {
      mapPlusCenterRef.current = [x, y];
      if (pendingOpenHoldToolsRef.current) {
        pendingOpenHoldToolsRef.current = false;
        activateHoldMapTools(x, y);
      }
    },
    [activateHoldMapTools],
  );

  const openHoldMapTools = useCallback(() => {
    const center = mapPlusCenterRef.current;
    if (center) {
      activateHoldMapTools(center[0], center[1]);
      return;
    }
    pendingOpenHoldToolsRef.current = true;
  }, [activateHoldMapTools]);

  useFocusEffect(
    useCallback(() => () => {
      stopZoomChange();
      stopHeadingChange();
      closeHoldMapTools();
    }, [closeHoldMapTools]),
  );

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
        return (homeMapToolsSheetOpen || drawing.shapeDrawingMode !== null || measurement.isActive) ? styles.pillButtonActive : null;
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

  const executeParcelQueryAtLngLat = useCallback(
    async (c: [number, number], queryMode: 'simple' | 'pro') => {
      const useProMode = queryMode === 'pro';
      console.log('[executeParcelQueryAtLngLat] Başlangıç, queryMode:', queryMode, 'koordinat:', c);

      if (useProMode) {
        setIsProMode(true);
        setQueryModeChoice('pro');
      } else {
        setIsProMode(false);
        setQueryModeChoice('simple');
      }

      const loadSeq = beginParcelQueryLoad(useProMode ? 'pro' : 'simple');
      if (useProMode) {
        console.log('[executeParcelQueryAtLngLat] PRO MOD: parcelData temizleniyor');
        setParcelData(null);
      }

      const backendUrl = (API_URL || '').replace(/\/$/, '');

      try {
        console.log('[executeParcelQueryAtLngLat] TKGM sorgusu başlatılıyor, queryMode:', queryMode);

        let data;
        try {
          // Pasif/toplulaştırılmış parsel ise onay modalı sonrası aktif geometri döner.
          data = await fetchTkgmByCoords(c[1], c[0], undefined, confirmPassiveParcel);
        } catch (error: any) {
          // Gerçek "parsel bulunamadı" (pasif değil) → harita tıklamasında sessiz geç.
          if (error?.type === 'TKGM_PARCEL_NOT_FOUND' && shouldShowNotFoundBanner(error)) {
            console.log('[executeParcelQueryAtLngLat] Parsel bulunamadı');
            return;
          }
          if (error?.type === 'TKGM_PARCEL_NOT_FOUND') {
            // pasif kaynaklı ama kurtarılamadı → sessiz
            return;
          }

          console.error('[executeParcelQueryAtLngLat] TKGM sorgusu başarısız:', error);
          throw error;
        }
        console.log('[executeParcelQueryAtLngLat] TKGM sorgusu tamamlandı, geometry var mı:', !!data.geometry, 'queryMode:', queryMode);

        if (!data.geometry) {
          console.warn('[executeParcelQueryAtLngLat] Geometry yok, işlem sonlandırılıyor');
          return;
        }
        if (isParcelQueryLoadStale(loadSeq)) return;

        if (useProMode) {
          console.log('[executeParcelQueryAtLngLat] PRO MOD: Pro mod akışı başlatılıyor');
          const nitelikText = extractNitelikText(data);
          const { title, suggestedType } = generatePropertyTypeTitle(nitelikText);

          try {
            const normalizedTkgmGeom = normalizeGeometryCoordinates(data.geometry);
            console.log('[executeParcelQueryAtLngLat] TKGM geometry normalized, first coord:', JSON.stringify(normalizedTkgmGeom?.coordinates?.[0]?.[0] ?? normalizedTkgmGeom?.coordinates?.[0]?.[0]?.[0]).slice(0, 40));
            setParcelData({ geometry: normalizedTkgmGeom, properties: data.properties || {}, analysisData: null });
            const s = calculateBoundsAndCamera(normalizedTkgmGeom);
            if (s) cameraRef.current?.setCamera?.({ centerCoordinate: s.center, zoomLevel: s.zoom, pitch: camRef.current.pitch, animationDuration: 900 });
          } catch (_) {}

          setPendingTkgmData(data);
          setPendingCoordinates(c);
          setPendingShareData(null);
          setPropertyTypeModalTitle(title);
          setPropertyTypeModalSuggested(suggestedType);
          setInfoModeActive(false);
          void persistTkgmResponseToMyQueries(data, !!isAuthenticated, 'pro').catch((saveErr) => {
            console.warn('[executeParcelQueryAtLngLat] PRO MOD: Sorgularım kaydı başarısız:', saveErr);
          });
          setProQueryConfirmVisible(true);
        } else {
          console.log('[executeParcelQueryAtLngLat] BASIT MOD: Basit mod akışı, array\'e ekleniyor');
          const normalizedGeom = normalizeParcelGeometry(data.geometry);
          addParcelToSimpleMode({
            geometry: normalizedGeom,
            properties: data.properties || {},
            analysisData: null,
          });
          maybeFitSimpleQueryParcel(normalizedGeom);

          void persistTkgmResponseToMyQueries(data, !!isAuthenticated, 'simple').catch((saveErr) => {
            console.warn('[executeParcelQueryAtLngLat] BASIT MOD: Sorgularım kaydı başarısız:', saveErr);
          });
        }
      } catch (error: any) {
        console.error('[executeParcelQueryAtLngLat] TKGM sorgu hatası:', error);
        if (error instanceof QueryLimitError) {
          Alert.alert(
            'Günlük Sorgu Limiti',
            `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
            isAuthenticated
              ? [{ text: 'Tamam' }]
              : [
                  { text: 'Kapat', style: 'cancel' },
                  { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) },
                ],
          );
        } else if (error?.type === 'TKGM_RATE_LIMIT') {
          Alert.alert(
            'Günlük Sorgu Limiti',
            error.message || 'TKGM günlük sorgu limiti aşıldı. Lütfen daha sonra tekrar deneyin.',
            [{ text: 'Tamam' }],
          );
        } else if (error?.type === 'TIMEOUT' || error?.type === 'CORS_OR_NETWORK_ERROR') {
          Alert.alert(
            'Bağlantı Hatası',
            error.message || 'TKGM sunucusuna bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.',
            [{ text: 'Tamam' }],
          );
        } else if (typeof error?.type === 'string' && error?.message) {
          // TKGM 500 / beklenmeyen sunucu hataları → çökme yerine uyarı modalı.
          Alert.alert('Uyarı', error.message, [{ text: 'Tamam' }]);
        } else {
          Alert.alert(
            'Bağlantı Hatası',
            'Parsel sorgusu tamamlanamadı. Lütfen internet bağlantınızı kontrol edin.',
            [{ text: 'Tamam' }],
          );
        }
      } finally {
        endParcelQueryLoad(loadSeq);
      }
    },
    [
      addParcelToSimpleMode,
      isAuthenticated,
      router,
      maybeFitSimpleQueryParcel,
      beginParcelQueryLoad,
      endParcelQueryLoad,
      isParcelQueryLoadStale,
      confirmPassiveParcel,
    ],
  );

  const runMapQueryAtPlusCenter = useCallback(
    async (queryMode: 'simple' | 'pro') => {
      if (drawing.freehandActive || measurement.isActive) return;

      ghostMapPressUntilRef.current = Date.now() + 400;

      let c = await refreshPlusZoomAnchor();
      if (!c) {
        const map = mapRef.current;
        const plus = holdMapToolsPlusCenterRef.current ?? mapPlusCenterRef.current;
        if (map?.getCoordinateFromView && plus) {
          try {
            c = parseCoordFromView(await map.getCoordinateFromView(plus));
          } catch (_) {}
        }
      }
      if (!c) return;

      await executeParcelQueryAtLngLat(c, queryMode);
    },
    [drawing.freehandActive, executeParcelQueryAtLngLat, measurement.isActive, refreshPlusZoomAnchor],
  );

  const handleMapPress = async (e: any) => {
    if (suppressNextMapPressRef.current) {
      suppressNextMapPressRef.current = false;
      return;
    }
    // Alt menü satırından hemen sonra gelen hayalet harita onPress'ini yut
    if (Date.now() < ghostMapPressUntilRef.current) {
      return;
    }
    if (drawing.freehandActive) {
      return;
    }
    if (measurement.isActive) {
      measurement.handleMeasurementPress(e);
      return;
    }
    if (locationMenuVisible || homeMapToolsSheetOpen || show3DSlider || activeScreen !== null) {
      menuItemClickedRef.current = false;
      setHomeMapToolsSheetOpen(false);
      setLocationMenuVisible(false);
      setShow3DSlider(false);
      if (holdMapToolsActive) {
        closeHoldMapTools();
      }
      return;
    }
    
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c) return;

    if (drawing.shapeDrawingMode) {
      drawing.handleShapeDrawingPress(e);
      return;
    }

    if (
      !measurement.isActive &&
      measurement.measurementFeatures.length > 0
    ) {
      const groupId = await tryHitMeasurementGroupAtLngLat(mapRef, c, measurement.measurementFeatures);
      if (groupId) {
        handleMeasurementGroupPress(groupId);
        return;
      }
    }

    if (drawing.shapes.length > 0) {
      const hitId = await trySelectShapeAtLngLat(
        mapRef,
        c,
        drawing.shapes,
        undefined,
        drawing.mapOverlayViewport
      );
      if (hitId) {
        setSelectedMeasurementGroupId(null);
        drawing.handleShapeTap(hitId);
        return;
      }
    }
    
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
    await executeParcelQueryAtLngLat(c, isProMode ? 'pro' : 'simple');
  };

  const handleLocationButtonPress = () => {
    setLocationMenuVisible(!locationMenuVisible);
    if (!locationMenuVisible) {
      setHomeMapToolsSheetOpen(false);
      setShow3DSlider(false);
    }
  };

  const handleStreetViewPress = () => {
    suppressGhostMapPress();
    if (!streetViewParcel?.geometry) {
      Alert.alert('Bilgi', 'Önce bir parsel seçin veya sorgulayın.');
      return;
    }
    setStreetViewModalVisible(true);
  };

  const handleQueryActionSmartQuery = useCallback(() => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    setHomeMapToolsSheetOpen(false);
    setShow3DSlider(false);
    if (!canUseSmartQuery(user)) {
      promptSmartQueryUpgrade(() => router.push('pricing'));
      return;
    }
    openParcelSearchModal('smart');
  }, [suppressGhostMapPress, openParcelSearchModal, user, router]);

  const handleQueryActionSimple = () => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    setHomeMapToolsSheetOpen(false);
    setShow3DSlider(false);
    if (queryModeChoice === 'simple' && infoModeActive) {
      setInfoModeActive(false);
    } else {
      setQueryModeChoice('simple');
      setIsProMode(false);
      setInfoModeActive(true);
    }
  };

  const handleQueryActionPro = () => {
    if (!isAuthenticated) return;
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    setHomeMapToolsSheetOpen(false);
    setShow3DSlider(false);
    if (queryModeChoice === 'pro' && infoModeActive) {
      setInfoModeActive(false);
    } else {
      setQueryModeChoice('pro');
      setIsProMode(true);
      setInfoModeActive(true);
    }
  };

  const handleOpenMyQueriesFromActionBar = useCallback(() => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    setHomeMapToolsSheetOpen(false);
    setShow3DSlider(false);
    openMyQueriesSheet();
  }, [suppressGhostMapPress, openMyQueriesSheet]);

  const fetchEdgeMeasuresForSimpleMode = useCallback(async (targetParcel?: SimpleModeParcel | null) => {
    const parcelToUse = targetParcel || selectedParcelForModal;

    if (!parcelToUse || !parcelToUse.geometry) {
      Alert.alert('Bilgi', 'Önce bir parsel seçin.');
      return null;
    }

    // Django endpoint'i (7000 portu) kullan - calculate_edge_measures Django'da
    // Ngrok üzerinden erişim için API_URL base'ini kullan
    // API_URL mobil backend için 7001, Django için aynı base URL'i 7000 portuna çevir
    let djangoBackendUrl = API_URL;
    // Port 7001'i 7000'e çevir
    if (djangoBackendUrl.includes(':7001')) {
      djangoBackendUrl = djangoBackendUrl.replace(':7001', ':7000');
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
        'Backend sunucusuna bağlanılamadı. Lütfen Django (7000) sunucusunun çalıştığından emin olun.',
        [{ text: 'Tamam' }]
      );
      return null;
    }
  }, [selectedParcelForModal]);

  const handleHomeMapToggleEdgeMeasures = useCallback(async () => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setHomeMapToolsSheetOpen(false);
    setLocationMenuVisible(false);

    if (showEdgeMeasurements) {
      setShowEdgeMeasurements(false);
      return;
    }

    if (!isProMode) {
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
      setShowEdgeMeasurements(!showEdgeMeasurements);
    }
  }, [showEdgeMeasurements, isProMode, selectedParcelForModal, simpleModeParcels, fetchEdgeMeasuresForSimpleMode, suppressGhostMapPress]);

  const handleRefresh = () => {
    // Tüm parsel çizimlerini temizle
    setParcelData(null);
    setSimpleModeParcels([]);
    setSelectedParcelForModal(null);
    
    // Tüm ölçüm çizimlerini temizle
    measurement.clearMeasurements();
    setEdgeMeasurementFeatures([]);
    setShowEdgeMeasurements(false);
    setSimpleModeEdgeMeasureData(null);
    
    // Modalları kapat
    setParcelModalVisible(false);
    setStreetViewModalVisible(false);
    setShareModalVisible(false);
    setPropertyTypeModalVisible(false);
    
    // Menüleri kapat
    setHomeMapToolsSheetOpen(false);
    setLocationMenuVisible(false);
    setShow3DSlider(false);
    
    // Info mode'u pasif yap
    setInfoModeActive(false);
  };

  const handleParcelLocation = () => {
    suppressGhostMapPress();
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
  const handlePropertyTypeSelect = useCallback(async (propertyType: string, shareData?: ShareParcelSelection | null) => {
    console.log('[handlePropertyTypeSelect] Başlangıç, propertyType:', propertyType, 'pendingTkgmData var mı:', !!pendingTkgmData);
    if (!pendingTkgmData) {
      console.warn('[handlePropertyTypeSelect] pendingTkgmData yok, işlem sonlandırılıyor');
      setPropertyTypeModalVisible(false);
      return;
    }

    const normalizedShareData = shareData && (shareData.hisseli || shareData.hisseM2 || shareData.parcelLocationStatus)
      ? {
          hisseli: true,
          hisseM2: String(shareData.hisseM2 || '').replace(/[^\d]/g, '').trim() || null,
          parcelLocationStatus:
            shareData.parcelLocationStatus === 'parselbelirli' || shareData.parcelLocationStatus === 'parselbelirlidegil'
              ? shareData.parcelLocationStatus
              : null,
        }
      : null;
    setPendingShareData(normalizedShareData);

    // --- Villa: VillaEstimateModal ac ---
    if (propertyType === 'Villa') {
      console.log('[handlePropertyTypeSelect] Villa tipi secildi, VillaEstimateModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setVillaEstimateModalVisible(true);
      return;
    }

    // --- Fabrika: FactoryEstimateModal ac (OSB Fabrika arsası için açılmaz) ---
    if (propertyType === 'Fabrika') {
      console.log('[handlePropertyTypeSelect] Fabrika tipi secildi, FactoryEstimateModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setPendingFactoryPropertyType(propertyType);
      setFactoryEstimateModalVisible(true);
      return;
    }

    // --- Bina: BinaEstimateModal ac ---
    if (propertyType === 'Bina') {
      console.log('[handlePropertyTypeSelect] Bina tipi secildi, BinaEstimateModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setBinaEstimateModalVisible(true);
      return;
    }

    // --- Müstakil Ev: MustakilEvEstimateModal ac ---
    if (propertyType === 'Müstakil Ev') {
      console.log('[handlePropertyTypeSelect] Mustakil Ev tipi secildi, MustakilEvEstimateModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setMustakilEvEstimateModalVisible(true);
      return;
    }

    // --- Konut Maliyeti + Daire: KonutDaireModal ac ---
    if (propertyType === 'Konut Maliyeti + Daire Satış Fiyatı Hesaplama') {
      console.log('[handlePropertyTypeSelect] Konut + Daire tipi secildi, KonutDaireModal aciliyor');
      isTransitioningToSubModalRef.current = true;
      setPropertyTypeModalVisible(false);
      setKonutDaireModalVisible(true);
      return;
    }

    console.log('[handlePropertyTypeSelect] Overlay açılıyor ve pro sorgu başlatılıyor');
    setPropertyTypeModalVisible(false);
    const loadSeq = await startProAnalysisLoad();

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
      applyShareSelectionToRequest(requestBody, normalizedShareData);

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

      console.log('[handlePropertyTypeSelect] Pro sorgu başlatılıyor (dağıtık modda poll dahil)');
      const data = await runProParcelQuery(requestBody);
      console.log('[handlePropertyTypeSelect] Pro sorgu tamamlandı, data keys:', Object.keys(data));
      if (data.error) {
        console.error('[handlePropertyTypeSelect] Backend hata:', data.error);
        throw new Error(data.error);
      }

      // Geometri opsiyonel - yoksa harita güncellenmez ama rapor açılır
      // parcel_polygon server swap'ı bazen başarısız olabiliyor — HER ZAMAN normalize et
      const parcelPoly = data.parameters_polygons?.parcel_polygon;
      let geometryRaw: any = parcelPoly || data.geometry;
      if (geometryRaw?.type === 'Feature' && geometryRaw.geometry) {
        geometryRaw = geometryRaw.geometry;
      }
      let normalizedGeometry: any = null;
      if (geometryRaw?.coordinates) {
        normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
      }
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

      // Kayıt işlemleri (hata olursa navigasyonu engellemesin)
      try {
        if (tkgmValue && adaVal && parselVal) {
          await upsertSavedQuery({
            proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
            tkgm_value: Number(tkgmValue),
            ada: String(adaVal),
            parsel: String(parselVal),
            mode: "pro",
            price_snapshot: {
              unit_price: unitNum,
              total_price: totalNum,
              area_m2: areaM2 > 0 ? areaM2 : null,
            },
            dfaRows,
            location_header: propertiesSlice,
            geometry: normalizedGeometry || undefined,
          });
          if (isAuthenticated) {
            const mahalleAd = propertiesSlice.mahalleAd || '';
            const apiTitle = mahalleAd ? `${mahalleAd} - ${adaVal}/${parselVal}` : `${adaVal}/${parselVal}`;
            try {
              const apiRes = await createSavedQueryApi({
                tkgm_value: Number(tkgmValue),
                ada: String(adaVal),
                parsel: String(parselVal),
                title: apiTitle,
                proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
              });
              if (!apiRes.ok) console.warn('[handlePropertyTypeSelect] API kayıt hatası:', apiRes.error);
              else console.log('[handlePropertyTypeSelect] API kayıt başarılı, id:', apiRes.data?.id);
            } catch (apiErr) {
              console.warn('[handlePropertyTypeSelect] API kayıt exception:', apiErr);
            }
          }
        }
      } catch (saveErr) {
        console.warn('[handlePropertyTypeSelect] save failed:', saveErr);
      }

      const captureParcel: ParcelData | null = normalizedGeometry
        ? {
            geometry: normalizedGeometry,
            properties: { ...data.properties, ...pd?.parcel_values },
            analysisData: data,
          }
        : null;
      await finishProQueryNavigation(data, normalizedGeometry, unitNum, totalNum, captureParcel);
      console.log('[handlePropertyTypeSelect] İşlem başarıyla tamamlandı, portal detaya yönlendirildi');
    } catch (error: any) {
      console.error('[handlePropertyTypeSelect] Ana pro sorgu hatası:', error);
      if (error instanceof ProQueryFailedError && error.failedTask) {
        console.warn('[handlePropertyTypeSelect] Celery görev hatası:', error.failedTask, error.rawMessage);
      }
      if (error instanceof QueryLimitError || error instanceof ProQueryLimitError) {
        const limitErr = error as QueryLimitError | ProQueryLimitError;
        Alert.alert(
          'Günlük Sorgu Limiti',
          `${limitErr.message}\n\nGünlük ücretsiz sorgu hakkınız: ${limitErr.dailyLimit}`,
          isAuthenticated
            ? [{ text: 'Tamam' }]
            : [
                { text: 'Kapat', style: 'cancel' },
                { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) },
              ]
        );
      } else {
        const alert = getProQueryErrorAlert(error);
        Alert.alert(
          alert.title,
          alert.message,
          getProQueryAlertButtons(alert, {
            isAuthenticated,
            onLogin: () => router.push('/auth/login' as any),
          }),
        );
      }
    } finally {
      console.log('[handlePropertyTypeSelect] finally: finishProAnalysisLoad çağrılıyor');
      finishProAnalysisLoad(loadSeq);
    }
  }, [pendingTkgmData, pendingCoordinates, is3DMode, router, isAuthenticated, applyShareSelectionToRequest, clearPendingPropertyTypeState, finishProQueryNavigation, startProAnalysisLoad, finishProAnalysisLoad]);

  const handleShowMyLocation = useCallback(async () => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);
    setHomeMapToolsSheetOpen(false);

    try {
      const granted = await requestAppLocationPermission();
      if (!granted) {
        showLocationPermissionAlert();
        return;
      }
      await waitForUiSettled(400);
      const ok = await moveMapToUserLocation(USER_MENU_LOCATION_ZOOM, {
        showBlueDot: true,
        animated: true,
      });
      if (!ok) {
        Alert.alert(
          "Konum alınamadı",
          "GPS açık mı kontrol edin veya bir süre sonra tekrar deneyin.",
          [{ text: "Tamam" }],
        );
      }
    } catch (err) {
      if (__DEV__) console.warn("[Index] handleShowMyLocation:", err);
      Alert.alert(
        "Konum alınamadı",
        "GPS açık mı kontrol edin veya bir süre sonra tekrar deneyin.",
        [{ text: "Tamam" }],
      );
    }
  }, [suppressGhostMapPress, moveMapToUserLocation]);

  const handleGetDirections = () => {
    suppressGhostMapPress();
    menuItemClickedRef.current = true;
    setLocationMenuVisible(false);

    const targetParcel = streetViewParcel;

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

  const holdZoomEnabled = useMemo(
    () =>
      !measurement.isActive &&
      !drawing.freehandActive &&
      !drawing.shapeDrawingMode &&
      !isMapInteractionLocked &&
      !locationMenuVisible &&
      !homeMapToolsSheetOpen &&
      !isLoadingParcel &&
      activeScreen === null &&
      !screenshotPreviewMode,
    [
      measurement.isActive,
      drawing.freehandActive,
      drawing.shapeDrawingMode,
      isMapInteractionLocked,
      locationMenuVisible,
      homeMapToolsSheetOpen,
      isLoadingParcel,
      activeScreen,
      screenshotPreviewMode,
    ],
  );

  useEffect(() => {
    if (!holdZoomEnabled && holdMapToolsActive) {
      closeHoldMapTools();
    }
  }, [closeHoldMapTools, holdMapToolsActive, holdZoomEnabled]);

  const homeMapGesturesAllowed = !isMapInteractionLocked && !screenshotPreviewMode;
  /** 3D yönetim paneli açıkken pitch panelden; parmak pitch pinch zoom ile çakışmasın. */
  const homeMapFingerPitchEnabled = homeMapGesturesAllowed && !show3DSlider;
  /** Tek parmak pan — zoom butonu basılıyken kapatılır; scrollEnabled buna bağlanmaz (pinch/rotate kesilmesin). */
  const homeMapSinglePanEnabled = homeMapGesturesAllowed && !plusZoomMapScrollLocked;

  const homeMapGestureSettings = useMemo(
    () => ({
      panEnabled: homeMapSinglePanEnabled,
      pinchPanEnabled: homeMapGesturesAllowed,
      pinchZoomEnabled: homeMapGesturesAllowed,
      rotateEnabled: homeMapGesturesAllowed,
      pitchEnabled: homeMapFingerPitchEnabled,
      doubleTapToZoomInEnabled: homeMapGesturesAllowed,
      doubleTouchToZoomOutEnabled: homeMapGesturesAllowed,
      quickZoomEnabled: homeMapGesturesAllowed,
      simultaneousRotateAndPinchZoomEnabled: true,
    }),
    [homeMapGesturesAllowed, homeMapSinglePanEnabled, homeMapFingerPitchEnabled],
  );

  useEffect(() => {
    if (!holdMapToolsActive) {
      stopMapToolsZoomChange();
    }
  }, [holdMapToolsActive, stopMapToolsZoomChange]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        stopMapToolsZoomChange();
      }
    });
    return () => sub.remove();
  }, [stopMapToolsZoomChange]);

  return (
    <SafeAreaView testID="main-safe-area" style={styles.container} edges={['top']}>
      <AppStatusBar />
      <View
        testID="header-container"
        style={[
          styles.header,
          !isProMode && { borderBottomColor: '#ffffff' },
          Platform.OS === 'android' && styles.headerAndroidLayer,
        ]}
      >
        <View style={styles.headerSideLeft}>
          <TouchableOpacity
            testID="notifications-button"
            style={styles.headerIconBtn}
            onPress={() => router.push('notifications')}
            activeOpacity={0.75}
            accessibilityLabel="Bildirimler"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {isAuthenticated && notificationsUnread > 0 ? (
              <View testID="header-notif-dot" style={styles.headerNotifDot} />
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.headerLogoOrb}>
            <Image
              source={proparcelFavicon}
              style={styles.headerLogo}
              resizeMode="cover"
              accessibilityLabel="ProParcel"
            />
          </View>
          <TouchableOpacity
            onPress={() => router.push('landing', { skipIntro: true })}
            activeOpacity={0.75}
            accessibilityLabel="ProParcel ana sayfa"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 12 }}
          >
            <Text style={styles.headerTitle}>ProParcel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerSideRight}>
          {isAuthenticated && isVipCustomer(user) && (
            <View style={styles.topbarVipBadge}>
              <Ionicons name="star" size={11} color="#fff" />
              <Text style={styles.topbarVipText}>VIP</Text>
            </View>
          )}
          <TouchableOpacity
            testID="menu-open-button"
            style={styles.headerButton}
            onPress={() => {
              setSubmenuOpenId(null);
              setUzmanGorusuOpen(false);
              setMenuVisible(true);
            }}
            accessibilityLabel="Menü"
          >
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View testID="content-area" style={styles.content}>
        <MapFloatingCreditBadge
          testID="credit-badge"
          label={
            isAuthenticated && creditBalance !== null
              ? `${creditBalance.toLocaleString('tr-TR')} K`
              : '— K'
          }
          onPress={() => router.push('pricing')}
        />
        <View testID="home-view" style={styles.homeContainer}>
          <View testID="map-view-container" style={styles.mapContainer}>
            {is3DMode && (
              <View
                testID="controls-wrapper"
                style={[styles.controlsLayoutWrapper, { bottom: HOME_MAP_3D_CONTROLS_BOTTOM + insets.bottom }]}
                pointerEvents="box-none"
              >
                <View style={styles.threeDControlsOuter} pointerEvents="box-none">
                  <Animated.View
                    pointerEvents={show3DSlider ? 'none' : 'auto'}
                    style={[
                      styles.threeDControlTriggerWrap,
                      {
                        opacity: threeDPanelAnim.interpolate({
                          inputRange: [0, 0.45, 1],
                          outputRange: [1, 0, 0],
                        }),
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.threeDControlTrigger}
                      onPress={() => setShow3DSlider(true)}
                      activeOpacity={0.7}
                      accessibilityLabel="3D yönetim panelini aç"
                    >
                      <View style={styles.zoomControlLineContainer}>
                        <View style={styles.zoomControlLine} />
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View
                    pointerEvents={show3DSlider ? 'box-none' : 'none'}
                    style={[
                      styles.threeDControlsExpandedRow,
                      {
                        opacity: threeDPanelAnim,
                        transform: [
                          {
                            translateX: threeDPanelAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [THREE_D_CONTROLS_SLIDE_WIDTH, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.threeDControlCloseHandle}
                      onPress={() => setShow3DSlider(false)}
                      activeOpacity={0.7}
                      accessibilityLabel="3D yönetim panelini kapat"
                    >
                      <PanelCollapseHandle />
                    </TouchableOpacity>
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
                  </Animated.View>
                </View>
              </View>
            )}
            {/* Zoom Controls */}
            <View style={styles.zoomControlsWrapper} pointerEvents="box-none">
              <View style={styles.zoomControlsOuter} pointerEvents="box-none">
                <Animated.View
                  pointerEvents={holdMapToolsActive ? 'none' : 'auto'}
                  style={[
                    styles.zoomControlTriggerWrap,
                    {
                      opacity: zoomPanelAnim.interpolate({
                        inputRange: [0, 0.45, 1],
                        outputRange: [1, 0, 0],
                      }),
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.zoomControlTrigger}
                    onPress={openHoldMapTools}
                    activeOpacity={0.7}
                  >
                    <View style={styles.zoomControlLineContainer}>
                      <View style={styles.zoomControlLine} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View
                  pointerEvents={holdMapToolsActive ? 'box-none' : 'none'}
                  style={[
                    styles.zoomControlsExpandedRow,
                    {
                      opacity: zoomPanelAnim,
                      transform: [
                        {
                          translateX: zoomPanelAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [ZOOM_CONTROLS_SLIDE_WIDTH, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.zoomControlCloseHandle}
                    onPress={closeHoldMapTools}
                    activeOpacity={0.7}
                  >
                    <PanelCollapseHandle />
                  </TouchableOpacity>
                  <View style={styles.zoomControlsStack}>
                    <Animated.View
                      style={[
                        styles.zoomQueryButtonsStack,
                        {
                          opacity: zoomQueryButtonsOpacity,
                        },
                      ]}
                      pointerEvents={plusZoomUiDirection == null ? 'auto' : 'none'}
                    >
                      <TouchableOpacity
                        style={styles.zoomQuerySquareButton}
                        onPress={() => void runMapQueryAtPlusCenter('simple')}
                        activeOpacity={0.75}
                        accessibilityLabel="Basit sorgu"
                      >
                        <Text style={styles.zoomQuerySquareButtonText}>B</Text>
                      </TouchableOpacity>
                      {isAuthenticated ? (
                        <TouchableOpacity
                          style={styles.zoomQuerySquareButton}
                          onPress={() => void runMapQueryAtPlusCenter('pro')}
                          activeOpacity={0.75}
                          accessibilityLabel="Pro sorgu"
                        >
                          <Text style={styles.zoomQuerySquareButtonText}>P</Text>
                        </TouchableOpacity>
                      ) : null}
                    </Animated.View>
                    <View style={styles.zoomControlsPanel} pointerEvents="auto">
                      <View style={styles.zoomControlButtonWrap}>
                        <MapToolsZoomSpeedBar
                          visible={plusZoomUiDirection === 1}
                          mode="in"
                          speedT={plusZoomSpeedT}
                        />
                        {holdMapToolsActive ? (
                          <GestureDetector gesture={mapToolsZoomInGesture}>
                            <View style={[styles.zoomControlButton, { marginBottom: 4 }]}>
                              <Ionicons name="add" size={18} color="#3b82f6" />
                            </View>
                          </GestureDetector>
                        ) : null}
                      </View>
                      <View style={styles.zoomControlButtonWrap}>
                        <MapToolsZoomSpeedBar
                          visible={plusZoomUiDirection === -1}
                          mode="out"
                          speedT={plusZoomSpeedT}
                        />
                        {holdMapToolsActive ? (
                          <GestureDetector gesture={mapToolsZoomOutGesture}>
                            <View style={styles.zoomControlButton}>
                              <Ionicons name="remove" size={18} color="#3b82f6" />
                            </View>
                          </GestureDetector>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </View>
            {/* 3D editör açıkken ana haritayı unmount et: iki MapView aynı anda OOM (607MB alloc) yapıyor */}
            {Mapbox && !shapeDrawingModalVisible && isScreenFocused ? (
              <View
                style={{ flex: 1 }}
                collapsable={false}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  if (width > 1 && height > 1) {
                    const next = { width, height };
                    homeMapViewportRef.current = next;
                  }
                }}
              >
              <MapHoldZoomLayer
                sessionActive={holdMapToolsActive}
                onZoomCenterReady={handleMapPlusCenterReady}
              >
              <Mapbox.MapView 
                key={mapViewKey} 
                ref={mapRef} 
                styleURL={Mapbox.StyleURL?.SatelliteStreet || Mapbox.StyleURL?.Default} 
                style={[styles.map, { backgroundColor: '#1e293b' }]} 
                logoEnabled={false} 
                attributionEnabled={false} 
                scaleBarEnabled={false} 
                // Android: GLSurfaceView (surfaceView=true) dokunuşları RN üstündeki header/alt barın üstüne "alıp"
                // ilk dokunuşun haritaya gitmesine yol açabiliyor. TextureView (surfaceView=false) normal view hiyerarşisinde kalır.
                surfaceView={Platform.OS === 'android' ? false : undefined}
                scrollEnabled={homeMapGesturesAllowed}
                zoomEnabled={homeMapGesturesAllowed}
                pitchEnabled={homeMapFingerPitchEnabled}
                rotateEnabled={homeMapGesturesAllowed}
                gestureSettings={homeMapGestureSettings}
                requestDisallowInterceptTouchEvent={false}
                onPress={handleMapPress} 
                onLongPress={(e: any) => { 
                  if (measurement.measurementMode === 'area' && measurement.measurementPoints.length >= 3) {
                    measurement.finalizeAreaMeasurement();
                    return;
                  }
                  if (drawing.shapeDrawingMode === 'polygon' && drawing.shapeDrawingPoints.length >= 3) {
                    drawing.finalizePolygonOrLine('polygon');
                    return;
                  }
                  if (drawing.shapeDrawingMode === 'line' && drawing.shapeDrawingPoints.length >= 2) {
                    drawing.finalizePolygonOrLine('line');
                  }
                }} 
                onCameraChanged={onCameraChanged}
                onError={(error: any) => {
                  console.error('[Mapbox] Harita hatası:', error);
                }}
                onDidFinishLoadingMap={onHomeMapLoaded}
                onDidFinishLoadingStyle={onHomeMapLoaded}
                onMapIdle={onHomeMapIdle}
                onMapLoadingError={(error: any) => {
                  console.error('[Mapbox] Yükleme hatası:', error);
                }}
              >
                <Mapbox.Camera ref={cameraRef} defaultSettings={mapDefaultSettings} maxZoomLevel={22} minZoomLevel={2} />
                {is3DMode ? <HomeIndexMap3DLayers idPrefix="home-index" /> : null}
                
                {adminBoundary?.geometry ? (
                  <Mapbox.ShapeSource
                    id="admin-boundary-source"
                    shape={{
                      type: 'Feature',
                      geometry: adminBoundary.geometry,
                      properties: { level: adminBoundary.level },
                    }}
                  >
                    <Mapbox.LineLayer
                      id="admin-boundary-line"
                      style={{
                        lineColor: ADMIN_BOUNDARY_STYLES[adminBoundary.level].stroke,
                        lineWidth: 2.5,
                      }}
                    />
                  </Mapbox.ShapeSource>
                ) : null}

                {/* Pro mod: Tek parsel çizimi - seçili parsel highlight */}
                {isProMode && parcelData?.geometry && (() => {
                  const centroid = getParcelCentroid(parcelData.geometry);
                  const labelText = getParcelLabelText(parcelData.properties || {});
                  return (
                    <>
                      <Mapbox.ShapeSource
                        id="parcelSource"
                        shape={{ type: 'Feature', geometry: parcelData.geometry, properties: parcelData.properties || {} }}
                        onPress={isMapInteractionLocked ? undefined : () => setParcelModalVisible(true)}
                      >
                        {createParcelFillLayer(Mapbox, 'parcel', true, homeParcelPolygonDesign)}
                      </Mapbox.ShapeSource>
                      {homeParcelPolygonDesign?.patternId &&
                      homeParcelPolygonDesign.patternId !== 'none' ? (
                        <ParcelPatternLayer
                          Mapbox={Mapbox}
                          idPrefix="parcel"
                          geometry={parcelData.geometry}
                          patternId={homeParcelPolygonDesign.patternId}
                          tintColor={homeParcelPolygonDesign.strokeColor}
                          patternSizeScale={homeParcelPolygonDesign.patternSizeScale}
                          mapRef={mapRef}
                          layoutTick={parcelPatternLayoutTick}
                        />
                      ) : null}
                      <Mapbox.ShapeSource
                        id="parcelStrokeSource"
                        shape={{ type: 'Feature', geometry: parcelData.geometry, properties: {} }}
                      >
                        {createParcelStrokeLayer(Mapbox, 'parcel', true, homeParcelPolygonDesign)}
                      </Mapbox.ShapeSource>
                    </>
                  );
                })()}
                
                {/* Basit mod: Çoklu parsel çizimleri - seçili parsel highlight */}
                {!isProMode && simpleModeParcels.map((parcel) => {
                  if (!parcel.geometry) return null;
                  const centroid = getParcelCentroid(parcel.geometry);
                  const labelText = getParcelLabelText(parcel.properties || {});
                  const isSelected = selectedParcelForModal?.id === parcel.id;
                  return (
                    <React.Fragment key={`simple-parcel-${parcel.id}`}>
                      <Mapbox.ShapeSource
                        id={`parcelSource-${parcel.id}`}
                        shape={{ type: 'Feature', geometry: parcel.geometry, properties: parcel.properties || {} }}
                        onPress={
                          isMapInteractionLocked
                            ? undefined
                            : () => {
                                if (selectedParcelForModal?.id !== parcel.id) {
                                  setShowEdgeMeasurements(false);
                                }
                                setSelectedParcelForModal(parcel);
                                setParcelModalVisible(true);
                              }
                        }
                      >
                        {createParcelFillLayer(
                          Mapbox,
                          `parcel-${parcel.id}`,
                          isSelected,
                          homeParcelPolygonDesign
                        )}
                      </Mapbox.ShapeSource>
                      {homeParcelPolygonDesign?.patternId &&
                      homeParcelPolygonDesign.patternId !== 'none' ? (
                        <ParcelPatternLayer
                          Mapbox={Mapbox}
                          idPrefix={`parcel-${parcel.id}`}
                          geometry={parcel.geometry}
                          patternId={homeParcelPolygonDesign.patternId}
                          tintColor={homeParcelPolygonDesign.strokeColor}
                          patternSizeScale={homeParcelPolygonDesign.patternSizeScale}
                          mapRef={mapRef}
                          layoutTick={parcelPatternLayoutTick}
                        />
                      ) : null}
                      <Mapbox.ShapeSource
                        id={`parcelStrokeSource-${parcel.id}`}
                        shape={{ type: 'Feature', geometry: parcel.geometry, properties: {} }}
                      >
                        {createParcelStrokeLayer(
                          Mapbox,
                          `parcel-${parcel.id}`,
                          isSelected,
                          homeParcelPolygonDesign
                        )}
                      </Mapbox.ShapeSource>
                    </React.Fragment>
                  );
                })}
                {measurement.measurementFeatures.map((f, i) => {
                  const isRuler = f.properties.measurementType === 'ruler';
                  const hasLabel = f.properties.label && !f.properties.isTemporary;
                  const isLabelOnly = f.properties.isLabelOnly === true;
                  const mc = f.properties.measureColor;
                  const measGid = f.properties.measurementGroupId;
                  const hasMeasGroup = typeof measGid === 'string' && measGid.length > 0;
                  const isMeasSelected = hasMeasGroup && selectedMeasurementGroupId === measGid;
                  const pressMeasGroup =
                    hasMeasGroup && !isMapInteractionLocked
                      ? () => handleMeasurementGroupPress(String(measGid))
                      : undefined;
                  const lineColor = isValidMeasureColorHex(mc)
                    ? mc
                    : isRuler
                      ? isMeasSelected
                        ? '#93c5fd'
                        : '#3B82F6'
                      : isMeasSelected
                        ? '#fcd34d'
                        : '#FBBF24';
                  const fillColor = isValidMeasureColorHex(mc) ? mc : '#FBBF24';

                  // Point feature (nokta noktaları)
                  if (f.geometry.type === 'Point' && !hasLabel && !isLabelOnly) {
                    return (
                      <Mapbox.ShapeSource
                        key={`meas-pt-${i}`}
                        id={`meas-pt-${i}`}
                        shape={f}
                        onPress={pressMeasGroup}
                      >
                        <Mapbox.CircleLayer
                          id={`meas-pt-layer-${i}`}
                          style={{
                            circleRadius: isMeasSelected ? 9 : 6,
                            circleColor: lineColor,
                            circleStrokeWidth: isMeasSelected ? 2 : 0,
                            circleStrokeColor: '#ffffff',
                          }}
                        />
                      </Mapbox.ShapeSource>
                    );
                  }

                  // LineString feature (mesafe çizgileri)
                  if (f.geometry.type === 'LineString') {
                    return (
                      <Mapbox.ShapeSource
                        key={`meas-ln-${i}`}
                        id={`meas-ln-${i}`}
                        shape={f}
                        onPress={pressMeasGroup}
                      >
                        <Mapbox.LineLayer
                          id={`meas-ln-layer-${i}`}
                          style={{
                            lineColor,
                            lineWidth: isMeasSelected ? 5 : 3,
                          }}
                        />
                      </Mapbox.ShapeSource>
                    );
                  }

                  // Polygon feature (alan polygon'ları)
                  if (f.geometry.type === 'Polygon') {
                    return (
                      <Mapbox.ShapeSource
                        key={`meas-pg-${i}`}
                        id={`meas-pg-${i}`}
                        shape={f}
                        onPress={pressMeasGroup}
                      >
                        <Mapbox.FillLayer
                          id={`meas-pg-fill-${i}`}
                          style={{
                            fillColor,
                            fillOpacity: isMeasSelected ? 0.42 : 0.3,
                          }}
                        />
                        <Mapbox.LineLayer
                          id={`meas-pg-stroke-${i}`}
                          style={{
                            lineColor,
                            lineWidth: isMeasSelected ? 4 : 2,
                          }}
                        />
                      </Mapbox.ShapeSource>
                    );
                  }

                  // Label point (sadece label için)
                  if (f.geometry.type === 'Point' && hasLabel && isLabelOnly) {
                    return (
                      <Mapbox.ShapeSource
                        key={`meas-label-${i}`}
                        id={`meas-label-${i}`}
                        shape={f}
                        onPress={pressMeasGroup}
                      >
                        <Mapbox.SymbolLayer
                          id={`meas-label-layer-${i}`}
                          style={{
                            textField: ['get', 'label'],
                            textSize: isMeasSelected ? 14 : 13,
                            textColor: isValidMeasureColorHex(mc) ? mc : isRuler ? '#bfdbfe' : '#fef08a',
                            textHaloColor: '#020617',
                            textHaloWidth: isMeasSelected ? 3 : 2.5,
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
                <ShapeDrawingMapLayers
                  session={drawing}
                  Mapbox={Mapbox}
                  idPrefix="home-sketch"
                  interactionLocked={isMapInteractionLocked}
                  onHandlePress={drawing.handleHandlePress}
                />
                {/* Parsel etiketleri en üstte — desen gliflerinin üzerinde */}
                {isProMode &&
                  parcelData?.geometry &&
                  (() => {
                    const centroid = getParcelCentroid(parcelData.geometry);
                    const labelText = getParcelLabelText(parcelData.properties || {});
                    if (!centroid || !labelText) return null;
                    return (
                      <ParcelLabelLayer
                        Mapbox={Mapbox}
                        idPrefix="parcel"
                        centroid={centroid}
                        labelText={labelText}
                        is3DMode={is3DMode}
                      />
                    );
                  })()}
                {!isProMode &&
                  simpleModeParcels.map((parcel) => {
                    if (!parcel.geometry) return null;
                    const centroid = getParcelCentroid(parcel.geometry);
                    const labelText = getParcelLabelText(parcel.properties || {});
                    if (!centroid || !labelText) return null;
                    return (
                      <ParcelLabelLayer
                        key={`parcel-label-${parcel.id}`}
                        Mapbox={Mapbox}
                        idPrefix={`parcel-${parcel.id}`}
                        centroid={centroid}
                        labelText={labelText}
                        is3DMode={is3DMode}
                      />
                    );
                  })}
              </Mapbox.MapView>
              </MapHoldZoomLayer>
              {!shapeDrawingModalVisible ? (
                <ShapeDrawingUiOverlays
                  session={drawing}
                  mapRef={mapRef}
                  insetsBottom={insets.bottom}
                  insetsTop={insets.top}
                  mapInteractionLocked={isMapInteractionLocked}
                  measurementActive={measurement.isActive}
                  onFinishMeasurement={measurement.finishActiveMeasurement}
                  measurementFinishLabel={measurement.measurementFinishBarLabel}
                  finishBarPlacement="top"
                  finishBarTopOffset={8}
                  finishBarLabel="Bitir"
                />
              ) : null}
              </View>
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
                      disabled={visibleParcelCount === 0}
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
        <ParcelSearchModal
          visible={activeScreen === 'ada-parsel'}
          initialTab={parcelSearchInitialTab}
          incomingFormSeed={incomingParcelFormSeed}
          onIncomingFormSeedConsumed={() => setIncomingParcelFormSeed(null)}
          onClose={handleCloseForm}
          onSubmit={handleAdaParselSubmit}
          onProSubmit={
            canAccessProSorgu(user, userProfile)
              ? (payload, options) => handleAdaParselSubmit(payload, { forcePro: true, ...options })
              : undefined
          }
          onHierarchySelect={handleLocationHierarchySelect}
          onBeforeSavedQueryRun={() => {
            if (isProMode) setIsProMode(false);
            setQueryModeChoice('simple');
          }}
        />
        <MyQueriesModal
          visible={myQueriesVisible}
          onClose={() => setMyQueriesVisible(false)}
          onSelect={runSimpleQueryFromSaved}
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
        <>
        <View
          testID="bottom-pill-bar-container"
          pointerEvents="box-none"
          style={[styles.bottomFloatingContainer, styles.bottomFloatingContainerAndroid, { bottom: 20 + insets.bottom }]}
        >
          <View pointerEvents="box-none" style={styles.bottomMenuColumn}>
          {locationMenuVisible && (
            <View 
              style={{ position: 'absolute', bottom: 88, left: getSubMenuLeft(locationButtonLayout, locationMenuWidth) }}
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
                  onPress={() => {
                    suppressGhostMapPress();
                    setTimeout(() => {
                      void handleShowMyLocation();
                    }, 0);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#fff" />
                    <Text style={styles.locationSubMenuText}>Konumum</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View
            testID="bottom-toolbar-stack"
            style={[styles.bottomToolbarStack, !isProMode && { borderColor: '#ffffff' }]}
          >
            <View testID="query-action-bar" style={styles.queryActionBar}>
              <TouchableOpacity
                testID="query-action-smart-query"
                style={[styles.queryActionItem, styles.queryActionItemWide]}
                onPress={handleQueryActionSmartQuery}
              >
                <Text style={styles.queryActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  Akıllı Sorgu
                </Text>
              </TouchableOpacity>
              <View style={[styles.queryActionDivider, !isProMode && styles.queryActionDividerSimple]} />
              <View style={[styles.queryActionItem, styles.queryActionItemSimple]}>
                <TouchableOpacity
                  testID="query-action-simple"
                  style={styles.queryActionSimpleMain}
                  onPress={handleQueryActionSimple}
                >
                  <Text
                    style={[
                      styles.queryActionText,
                      queryModeChoice === 'simple' && infoModeActive && styles.queryActionTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    Basit Sorgu
                  </Text>
                  {queryModeChoice === 'simple' && infoModeActive ? (
                    <View style={styles.queryActionUnderline} pointerEvents="none" />
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="query-action-my-queries"
                  style={styles.queryActionMenuIconBtn}
                  onPress={handleOpenMyQueriesFromActionBar}
                  accessibilityLabel="Sorgularım"
                  hitSlop={{ top: 6, bottom: 6, left: 2, right: 4 }}
                >
                  <Ionicons name="menu" size={17} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.queryActionDivider, !isProMode && styles.queryActionDividerSimple]} />
              <TouchableOpacity
                testID="query-action-pro"
                style={[styles.queryActionItem, !isAuthenticated && { opacity: 0.45 }]}
                disabled={!isAuthenticated}
                onPress={handleQueryActionPro}
              >
                <Text
                  style={[
                    styles.queryActionText,
                    queryModeChoice === 'pro' && infoModeActive && styles.queryActionTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Pro Sorgu
                </Text>
                {queryModeChoice === 'pro' && infoModeActive ? (
                  <View style={styles.queryActionUnderline} />
                ) : null}
              </TouchableOpacity>
            </View>
          <View
            testID="bottom-pill-bar"
            style={[styles.pillBar, styles.pillBarStacked, !isProMode && { borderColor: '#ffffff' }]}
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
              onPress={() => {
                setHomeMapToolsSheetOpen(!homeMapToolsSheetOpen);
                if (!homeMapToolsSheetOpen) {
                  setLocationMenuVisible(false);
                  setShow3DSlider(false);
                }
              }}
              style={[styles.pillButton, styles.pillButtonEven, getButtonActiveStyle('ruler')]}
            >
              <MaterialCommunityIcons
                name="ruler"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity
              testID="location-tools-button"
              onLayout={(e) => {
                const { x, width } = e?.nativeEvent?.layout || {};
                if (typeof x === 'number' && typeof width === 'number') setLocationButtonLayout({ x, width });
              }}
              onPress={handleLocationButtonPress}
              style={[styles.pillButton, styles.pillButtonEven, getButtonActiveStyle('location')]}
            >
              <Ionicons
                name="locate"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity testID="refresh-button" onPress={handleRefresh} style={[styles.pillButton, styles.pillButtonEven]}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="3d-building-button"
              disabled={!isAuthenticated}
              onPress={() => {
                menuItemClickedRef.current = true;
                setHomeMapToolsSheetOpen(false);
                setLocationMenuVisible(false);
                setShow3DSlider(false);
                openModelEditorOrRequireAuth();
              }}
              style={[styles.pillButton, styles.pillButtonEven, !isAuthenticated && { opacity: 0.4 }]}
            >
              <MaterialCommunityIcons name="home-group" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity testID="camera-share-button" onPress={handleCameraPress} style={[styles.pillButton, styles.pillButtonEven]}>
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity testID="3d-mode-button" 
              onPress={() => { 
                menuItemClickedRef.current = true;
                setHomeMapToolsSheetOpen(false);
                setLocationMenuVisible(false);
                // "Yön ve açı" paneli açıksa kapat
                if (show3DSlider) setShow3DSlider(false);
                // Dağlar: tek tıkla terrain aç/kapat
                toggle3DMode();
              }} 
              style={[styles.pillButton, styles.pillButtonEven, getButtonActiveStyle('3d')]}
            >
              <Text style={styles.pillButton3dLabel}>3D</Text>
            </TouchableOpacity>
            <VrPillBarButton
              styles={styles}
              onInteraction={() => {
                menuItemClickedRef.current = true;
                setHomeMapToolsSheetOpen(false);
                setLocationMenuVisible(false);
                setShow3DSlider(false);
              }}
            />
            <TouchableOpacity testID="search-button" onPress={() => openParcelSearchModal('parcel')} style={[styles.pillButton, styles.pillButtonEven]}>
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          </View>
          </View>
        </View>
        <View
          pointerEvents="box-none"
          style={[styles.homeVoiceOrbLayer, { bottom: 62 + insets.bottom }]}
        >
          <HomeVoiceQueryOrb
            onInteraction={() => {
              suppressGhostMapPress();
              menuItemClickedRef.current = true;
              setLocationMenuVisible(false);
              setHomeMapToolsSheetOpen(false);
              setShow3DSlider(false);
            }}
            onQueryResolved={handleHomeVoiceQueryResolved}
          />
        </View>
        <HomeMapToolsSheet
          visible={homeMapToolsSheetOpen}
          onClose={handleHomeMapToolsSheetDismiss}
          insetsBottom={insets.bottom}
          measurementMode={measurement.measurementMode}
          onSetMeasurementMode={handleHomeMapSheetSetMode}
          drawShapeMode={drawing.shapeDrawingMode}
          onSelectDrawShape={handleHomeMapSheetSelectShape}
          drawPinVariant={drawing.drawPinVariant}
          onSelectPinVariant={drawing.setDrawPinVariant}
          drawArrowVariant={drawing.drawArrowVariant}
          onSelectArrowVariant={drawing.setDrawArrowVariant}
          onClearSketchShapes={() => {
            drawing.clearAllShapes();
          }}
          onHisseliParsellereBol={handleHisseliFromHomeMapSheet}
          onToggleEdgeMeasures={handleHomeMapToggleEdgeMeasures}
          onClearMeasurementDrawings={() => {
            suppressGhostMapPress();
            menuItemClickedRef.current = true;
            clearMeasurementDrawings();
            setLocationMenuVisible(false);
          }}
          onClearAllLayers={() => {
            suppressGhostMapPress();
            menuItemClickedRef.current = true;
            clearAllMeasurementLayers();
            setLocationMenuVisible(false);
          }}
          hasParcelForHisseli={hasParcelForHisseliHome}
          onOpenParcelPolygonDesign={() => {
            setHomeParcelDesignSheetOpen(true);
          }}
        />
        <ParcelPolygonDesignSheet
          visible={homeParcelDesignSheetOpen}
          onClose={() => setHomeParcelDesignSheetOpen(false)}
          insetsBottom={insets.bottom}
          initialConfig={homeParcelPolygonDesign}
          onConfirm={handleConfirmParcelPolygonDesign}
        />
        <MeasurementEditSheet
          visible={measurementEditPanelVisible}
          selectedMeasurementGroupId={selectedMeasurementGroupId}
          measurementFeatures={measurement.measurementFeatures}
          setMeasurementFeatures={measurement.setMeasurementFeatures}
          insetsBottom={insets.bottom}
          minimized={measurementEditPanelMinimized}
          setMinimized={setMeasurementEditPanelMinimized}
          onClose={() => setMeasurementEditPanelVisible(false)}
          onDelete={handleDeleteSelectedMeasurement}
        />
        <TextBoxEditModal
          visible={drawing.textBoxEditVisible}
          initialText={drawing.textBoxEditInitialText}
          onCancel={() => {
            drawing.setTextBoxEditVisible(false);
            drawing.setTextBoxEditShapeId(null);
          }}
          onSave={(nextText) => {
            if (!drawing.textBoxEditShapeId) return;
            drawing.setShapes((prev) =>
              prev.map((s) =>
                s.id === drawing.textBoxEditShapeId
                  ? patchTextBoxShape(s, { text: String(nextText ?? "") })
                  : s
              )
            );
            drawing.setTextBoxEditVisible(false);
            drawing.setTextBoxEditShapeId(null);
          }}
        />
        </>
      )}
      
      {/* 3D Submenu kaldırıldı: dağlar direkt terrain açar, bina ayrı buton */}

      {/* Ana Menü Modal */}
      <AppBottomSheetModal
        visible={menuVisible}
        onClose={closeMenu}
        snapPoints={[...USER_MENU_SHEET_SNAP_POINTS]}
        index={menuSheetIndex}
        initialIndex={0}
        variant="dark"
      >
        <>
          <UserMenuSheetHeader
            variant="dark"
            isAuthenticated={!!isAuthenticated}
            user={user}
            profile={userProfile}
            creditBalance={creditBalance}
            onPressProfile={() => {
              closeMenu();
              router.push(isAuthenticated ? 'profile' : 'login');
            }}
            onPressCredits={() => {
              closeMenu();
              router.push('pricing');
            }}
          />
          <UserMenuSheetList
            items={getMenuItems(isProMode, isAuthenticated, isAppAdminUser(user), user, userProfile)}
            st={userMenuSheetDarkStyles}
            variant="dark"
            submenuOpenId={submenuOpenId}
            uzmanGorusuOpen={uzmanGorusuOpen}
            setUzmanGorusuOpen={setUzmanGorusuOpen}
            onItemPress={handleMenuItemPress}
            notificationsUnread={notificationsUnread}
            expertIncomingUnread={expertIncomingUnread}
            expertMyRepliesUnread={expertMyRepliesUnread}
            user={user}
            userProfile={userProfile}
            footerInsetBottom={insets.bottom}
          />
        </>
      </AppBottomSheetModal>

      {/* İlk Üyelik Hoşgeldin Bottom Sheet */}
      <WelcomeBottomSheet
        visible={welcomeVisible}
        onClose={() => {
          setWelcomeVisible(false);
          if (user) user.has_seen_welcome = true;
          if (user && user.has_seen_app_tour === false) {
            setTimeout(() => setTourVisible(true), 500);
          }
        }}
      />

      {/* İlk Giriş Tour Overlay */}
      <AppTourOverlay
        visible={tourVisible}
        onClose={() => {
          setTourVisible(false);
          if (user) user.has_seen_app_tour = true;
        }}
      />

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
          setQueryModeChoice('pro');
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
      <ProModeThreeLoader visible={showProModeLoader} />
      <PropertyTypeSelectionModal 
        visible={propertyTypeModalVisible} 
        onClose={() => { 
          console.log('[PropertyTypeSelectionModal] onClose çağrıldı, isTransitioning:', isTransitioningToSubModalRef.current);
          setPropertyTypeModalVisible(false); 
          // Villa veya Fabrika modalına geçiş sırasında pendingTkgmData'yı temizleme
          // (BottomSheetModal unmount olunca onDismiss tetiklenir ve burayı çağırır)
          if (isTransitioningToSubModalRef.current) {
            isTransitioningToSubModalRef.current = false;
          } else if (proAnalysisLoadingRef.current) {
            // Tip seçimi sonrası pro analiz yüklenirken pending state korunur
          } else {
            clearPendingPropertyTypeState();
          }
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
          const loadSeq = beginParcelQueryLoad('pro');
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: propertyType,
              factory_params: factoryParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            applyShareSelectionToRequest(requestBody);
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
            const data = await runProParcelQuery(requestBody);
            console.log('[FactoryEstimateModal] Backend yanıt anahtarları:', Object.keys(data));

            // Geometri opsiyonel - yoksa harita güncellenmez ama rapor açılır
            // parcel_polygon server swap'ı bazen başarısız olabiliyor — HER ZAMAN normalize et
            const geometryRawF = data.parameters_polygons?.parcel_polygon || data.geometry;
            let normalizedGeometry: any = null;
            if (geometryRawF && geometryRawF.coordinates) {
              normalizedGeometry = normalizeGeometryCoordinates(geometryRawF);
            }
            if (normalizedGeometry) {
              setShowEdgeMeasurements(false);
              setParcelData({
                geometry: normalizedGeometry,
                properties: { ...data.properties, ...data.parameters_data?.parcel_values },
                analysisData: data,
              });
              try {
                const camF = calculateBoundsAndCamera(normalizedGeometry);
                if (camF) cameraRef.current?.setCamera?.({ centerCoordinate: camF.center, zoomLevel: camF.zoom, pitch: camRef.current.pitch, animationDuration: 600 });
              } catch (_) {}
              console.log('[FactoryEstimateModal] Geometry güncellendi, first coord:', JSON.stringify(normalizedGeometry?.coordinates?.[0]?.[0]).slice(0, 40));
            } else {
              console.warn('[FactoryEstimateModal] Geometri bulunamadı — parcelPolyF:', !!parcelPolyF, 'data.geometry:', !!data.geometry);
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

            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  mode: "pro",
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  const mahalleAd = propertiesSlice.mahalleAd || '';
                  const apiTitle = mahalleAd ? `${mahalleAd} - ${adaVal}/${parselVal}` : `${adaVal}/${parselVal}`;
                  try {
                    const apiRes = await createSavedQueryApi({
                      tkgm_value: Number(tkgmValue),
                      ada: String(adaVal),
                      parsel: String(parselVal),
                      title: apiTitle,
                      proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                    });
                    if (!apiRes.ok) console.warn('[FactoryEstimateModal] API kayıt hatası:', apiRes.error);
                    else console.log('[FactoryEstimateModal] API kayıt başarılı, id:', apiRes.data?.id);
                  } catch (apiErr) {
                    console.warn('[FactoryEstimateModal] API kayıt exception:', apiErr);
                  }
                }
              }
            } catch (saveErr) {
              console.warn('[FactoryEstimateModal] save failed:', saveErr);
            }

            const captureParcel: ParcelData | null = normalizedGeometry
              ? {
                  geometry: normalizedGeometry,
                  properties: { ...data.properties, ...pd?.parcel_values },
                  analysisData: data,
                }
              : null;
            await finishProQueryNavigation(data, normalizedGeometry, unitNum, totalNum, captureParcel);
          } catch (error: any) {
            console.error('[FactoryEstimateModal] Pro sorgu hatasi:', error);
            if (error instanceof QueryLimitError || error instanceof ProQueryLimitError) {
              Alert.alert(
                'Günlük Sorgu Limiti',
                `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
                isAuthenticated
                  ? [{ text: 'Tamam' }]
                  : [{ text: 'Kapat', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) }]
              );
            } else {
              const alert = getProQueryErrorAlert(error);
              Alert.alert(
                alert.title,
                alert.message,
                getProQueryAlertButtons(alert, {
                  isAuthenticated,
                  onLogin: () => router.push('/auth/login' as any),
                }),
              );
            }
          } finally {
            endParcelQueryLoad(loadSeq);
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
          const loadSeq = beginParcelQueryLoad('pro');
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: 'Villa',
              villa_params: villaParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            applyShareSelectionToRequest(requestBody);
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
            const data = await runProParcelQuery(requestBody);
            console.log('[VillaEstimateModal] Backend yanıt anahtarları:', Object.keys(data));

            // Geometri opsiyonel - yoksa harita güncellenmez ama rapor açılır
            // parcel_polygon server swap'ı bazen başarısız olabiliyor — HER ZAMAN normalize et
            const geometryRawV = data.parameters_polygons?.parcel_polygon || data.geometry;
            let normalizedGeometry: any = null;
            if (geometryRawV && geometryRawV.coordinates) {
              normalizedGeometry = normalizeGeometryCoordinates(geometryRawV);
            }
            if (normalizedGeometry) {
              setShowEdgeMeasurements(false);
              setParcelData({
                geometry: normalizedGeometry,
                properties: { ...data.properties, ...data.parameters_data?.parcel_values },
                analysisData: data,
              });
              try {
                const camV = calculateBoundsAndCamera(normalizedGeometry);
                if (camV) cameraRef.current?.setCamera?.({ centerCoordinate: camV.center, zoomLevel: camV.zoom, pitch: camRef.current.pitch, animationDuration: 600 });
              } catch (_) {}
              console.log('[VillaEstimateModal] Geometry güncellendi, first coord:', JSON.stringify(normalizedGeometry?.coordinates?.[0]?.[0]).slice(0, 40));
            } else {
              console.warn('[VillaEstimateModal] Geometri bulunamadı — parcelPolyV:', !!parcelPolyV, 'data.geometry:', !!data.geometry);
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

            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  mode: "pro",
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  const mahalleAd = propertiesSlice.mahalleAd || '';
                  const apiTitle = mahalleAd ? `${mahalleAd} - ${adaVal}/${parselVal}` : `${adaVal}/${parselVal}`;
                  try {
                    const apiRes = await createSavedQueryApi({
                      tkgm_value: Number(tkgmValue),
                      ada: String(adaVal),
                      parsel: String(parselVal),
                      title: apiTitle,
                      proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                    });
                    if (!apiRes.ok) console.warn('[VillaEstimateModal] API kayıt hatası:', apiRes.error);
                    else console.log('[VillaEstimateModal] API kayıt başarılı, id:', apiRes.data?.id);
                  } catch (apiErr) {
                    console.warn('[VillaEstimateModal] API kayıt exception:', apiErr);
                  }
                }
              }
            } catch (saveErr) {
              console.warn('[VillaEstimateModal] save failed:', saveErr);
            }

            const captureParcel: ParcelData | null = normalizedGeometry
              ? {
                  geometry: normalizedGeometry,
                  properties: { ...data.properties, ...pd?.parcel_values },
                  analysisData: data,
                }
              : null;
            await finishProQueryNavigation(data, normalizedGeometry, unitNum, totalNum, captureParcel);
          } catch (error: any) {
            console.error('[VillaEstimateModal] Pro sorgu hatasi:', error);
            if (error instanceof QueryLimitError || error instanceof ProQueryLimitError) {
              Alert.alert(
                'Günlük Sorgu Limiti',
                `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
                isAuthenticated
                  ? [{ text: 'Tamam' }]
                  : [{ text: 'Kapat', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) }]
              );
            } else {
              const alert = getProQueryErrorAlert(error);
              Alert.alert(
                alert.title,
                alert.message,
                getProQueryAlertButtons(alert, {
                  isAuthenticated,
                  onLogin: () => router.push('/auth/login' as any),
                }),
              );
            }
          } finally {
            endParcelQueryLoad(loadSeq);
          }
        }}
        areaM2={0}
      />
      <BinaEstimateModal
        visible={binaEstimateModalVisible}
        onClose={() => setBinaEstimateModalVisible(false)}
        onResult={async (binaParams) => {
          setBinaEstimateModalVisible(false);
          if (!binaParams || !pendingTkgmData) return;
          const loadSeq = beginParcelQueryLoad('pro');
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: 'Bina',
              bina_params: binaParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            applyShareSelectionToRequest(requestBody);
            if (pendingCoordinates) { requestBody.lat = pendingCoordinates[1]; requestBody.lon = pendingCoordinates[0]; }
            const props = pendingTkgmData?.properties || {};
            if (props.mahalleAd && props.adaNo && props.parselNo) {
              requestBody.mahalle = props.mahalleAd;
              requestBody.ada = props.adaNo;
              requestBody.parsel = props.parselNo;
              if (props.mahalleId) requestBody.mahalleTkgmValue = props.mahalleId;
            }
            const data = await runProParcelQuery(requestBody);
            const geometryRaw = data.parameters_polygons?.parcel_polygon || data.geometry;
            let normalizedGeometry: any = null;
            if (geometryRaw?.coordinates) normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
            if (normalizedGeometry) {
              setShowEdgeMeasurements(false);
              setParcelData({ geometry: normalizedGeometry, properties: { ...data.properties, ...data.parameters_data?.parcel_values }, analysisData: data });
              try { const cam = calculateBoundsAndCamera(normalizedGeometry); if (cam) cameraRef.current?.setCamera?.({ centerCoordinate: cam.center, zoomLevel: cam.zoom, pitch: camRef.current.pitch, animationDuration: 600 }); } catch (_) {}
            }
            const pd: any = data?.parameters_data || {};
            const pv: any = pd?.parcel_values || {};
            const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};
            const propsData: any = data?.properties || {};
            const proparcelValue = pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null;
            const tkgmValue = tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null;
            const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
            const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';
            const unitStr = pv?.unite_price ?? null;
            const totalStr = pv?.price_of_tarla ?? null;
            const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
            const binaResult = pd?.bina_result;
            const totalNum = binaResult?.bina_final_total_tl ?? (totalStr ? parseTurkishPrice(totalStr) : null);
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
            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  mode: "pro",
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  const mahalleAd = propertiesSlice.mahalleAd || '';
                  const apiTitle = mahalleAd ? `${mahalleAd} - ${adaVal}/${parselVal}` : `${adaVal}/${parselVal}`;
                  try {
                    const apiRes = await createSavedQueryApi({
                      tkgm_value: Number(tkgmValue),
                      ada: String(adaVal),
                      parsel: String(parselVal),
                      title: apiTitle,
                      proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                    });
                    if (!apiRes.ok) console.warn('[BinaEstimateModal] API kayıt hatası:', apiRes.error);
                  } catch (apiErr) { console.warn('[BinaEstimateModal] API kayıt exception:', apiErr); }
                }
              }
            } catch (saveErr) { console.warn('[BinaEstimateModal] save failed:', saveErr); }
            const captureParcel: ParcelData | null = normalizedGeometry
              ? {
                  geometry: normalizedGeometry,
                  properties: { ...data.properties, ...pd?.parcel_values },
                  analysisData: data,
                }
              : null;
            await finishProQueryNavigation(data, normalizedGeometry, unitNum, totalNum, captureParcel);
          } catch (error: any) {
            if (error instanceof QueryLimitError || error instanceof ProQueryLimitError) {
              Alert.alert('Günlük Sorgu Limiti', `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
                isAuthenticated ? [{ text: 'Tamam' }] : [{ text: 'Kapat', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) }]);
            } else {
              const alert = getProQueryErrorAlert(error);
              Alert.alert(
                alert.title,
                alert.message,
                getProQueryAlertButtons(alert, {
                  isAuthenticated,
                  onLogin: () => router.push('/auth/login' as any),
                }),
              );
            }
          } finally {
            endParcelQueryLoad(loadSeq);
          }
        }}
        areaM2={0}
      />
      <MustakilEvEstimateModal
        visible={mustakilEvEstimateModalVisible}
        onClose={() => setMustakilEvEstimateModalVisible(false)}
        onResult={async (mustakilEvParams) => {
          setMustakilEvEstimateModalVisible(false);
          if (!mustakilEvParams || !pendingTkgmData) return;
          const loadSeq = beginParcelQueryLoad('pro');
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: 'Müstakil Ev',
              mustakil_ev_params: mustakilEvParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            applyShareSelectionToRequest(requestBody);
            if (pendingCoordinates) { requestBody.lat = pendingCoordinates[1]; requestBody.lon = pendingCoordinates[0]; }
            const props = pendingTkgmData?.properties || {};
            if (props.mahalleAd && props.adaNo && props.parselNo) {
              requestBody.mahalle = props.mahalleAd;
              requestBody.ada = props.adaNo;
              requestBody.parsel = props.parselNo;
              if (props.mahalleId) requestBody.mahalleTkgmValue = props.mahalleId;
            }
            const data = await runProParcelQuery(requestBody);
            const geometryRaw = data.parameters_polygons?.parcel_polygon || data.geometry;
            let normalizedGeometry: any = null;
            if (geometryRaw?.coordinates) normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
            if (normalizedGeometry) {
              setShowEdgeMeasurements(false);
              setParcelData({ geometry: normalizedGeometry, properties: { ...data.properties, ...data.parameters_data?.parcel_values }, analysisData: data });
              try { const cam = calculateBoundsAndCamera(normalizedGeometry); if (cam) cameraRef.current?.setCamera?.({ centerCoordinate: cam.center, zoomLevel: cam.zoom, pitch: camRef.current.pitch, animationDuration: 600 }); } catch (_) {}
            }
            const pd: any = data?.parameters_data || {};
            const pv: any = pd?.parcel_values || {};
            const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};
            const propsData: any = data?.properties || {};
            const proparcelValue = pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null;
            const tkgmValue = tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null;
            const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
            const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';
            const unitStr = pv?.unite_price ?? null;
            const totalStr = pv?.price_of_tarla ?? null;
            const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
            const mustakilResult = pd?.mustakil_ev_result;
            const totalNum = mustakilResult?.mustakil_ev_final_total_tl ?? (totalStr ? parseTurkishPrice(totalStr) : null);
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
            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  mode: "pro",
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  const mahalleAd = propertiesSlice.mahalleAd || '';
                  const apiTitle = mahalleAd ? `${mahalleAd} - ${adaVal}/${parselVal}` : `${adaVal}/${parselVal}`;
                  try {
                    const apiRes = await createSavedQueryApi({
                      tkgm_value: Number(tkgmValue),
                      ada: String(adaVal),
                      parsel: String(parselVal),
                      title: apiTitle,
                      proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                    });
                    if (!apiRes.ok) console.warn('[MustakilEvEstimateModal] API kayıt hatası:', apiRes.error);
                  } catch (apiErr) { console.warn('[MustakilEvEstimateModal] API kayıt exception:', apiErr); }
                }
              }
            } catch (saveErr) { console.warn('[MustakilEvEstimateModal] save failed:', saveErr); }
            const captureParcel: ParcelData | null = normalizedGeometry
              ? {
                  geometry: normalizedGeometry,
                  properties: { ...data.properties, ...pd?.parcel_values },
                  analysisData: data,
                }
              : null;
            await finishProQueryNavigation(data, normalizedGeometry, unitNum, totalNum, captureParcel);
          } catch (error: any) {
            if (error instanceof QueryLimitError || error instanceof ProQueryLimitError) {
              Alert.alert('Günlük Sorgu Limiti', `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
                isAuthenticated ? [{ text: 'Tamam' }] : [{ text: 'Kapat', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) }]);
            } else {
              const alert = getProQueryErrorAlert(error);
              Alert.alert(
                alert.title,
                alert.message,
                getProQueryAlertButtons(alert, {
                  isAuthenticated,
                  onLogin: () => router.push('/auth/login' as any),
                }),
              );
            }
          } finally {
            endParcelQueryLoad(loadSeq);
          }
        }}
        areaM2={0}
      />
      <KonutDaireModal
        visible={konutDaireModalVisible}
        onClose={() => setKonutDaireModalVisible(false)}
        onResult={async (konutDaireParams) => {
          setKonutDaireModalVisible(false);
          if (!konutDaireParams || !pendingTkgmData) return;
          const loadSeq = beginParcelQueryLoad('pro');
          const backendUrl = (API_URL || '').replace(/\/$/, '');
          try {
            const requestBody: any = {
              tkgm_data: pendingTkgmData,
              property_type_override: 'Konut Maliyeti + Daire Satış Fiyatı Hesaplama',
              konut_daire_params: konutDaireParams,
              map_mode: '2d',
              is3D: is3DMode,
            };
            applyShareSelectionToRequest(requestBody);
            if (pendingCoordinates) { requestBody.lat = pendingCoordinates[1]; requestBody.lon = pendingCoordinates[0]; }
            const props = pendingTkgmData?.properties || {};
            if (props.mahalleAd && props.adaNo && props.parselNo) {
              requestBody.mahalle = props.mahalleAd;
              requestBody.ada = props.adaNo;
              requestBody.parsel = props.parselNo;
              if (props.mahalleId) requestBody.mahalleTkgmValue = props.mahalleId;
            }
            const data = await runProParcelQuery(requestBody);
            const geometryRaw = data.parameters_polygons?.parcel_polygon || data.geometry;
            let normalizedGeometry: any = null;
            if (geometryRaw?.coordinates) normalizedGeometry = normalizeGeometryCoordinates(geometryRaw);
            if (normalizedGeometry) {
              setShowEdgeMeasurements(false);
              setParcelData({ geometry: normalizedGeometry, properties: { ...data.properties, ...data.parameters_data?.parcel_values }, analysisData: data });
              try { const cam = calculateBoundsAndCamera(normalizedGeometry); if (cam) cameraRef.current?.setCamera?.({ centerCoordinate: cam.center, zoomLevel: cam.zoom, pitch: camRef.current.pitch, animationDuration: 600 }); } catch (_) {}
            }
            const pd: any = data?.parameters_data || {};
            const pv: any = pd?.parcel_values || {};
            const tkgmProps: any = pd?.tkgm_data?.properties || pendingTkgmData?.properties || {};
            const propsData: any = data?.properties || {};
            const proparcelValue = pd?.proparcel_value ?? pv?.proparcel_value ?? pv?.Proparcel_value ?? data?.properties?.Proparcel_value ?? null;
            const tkgmValue = tkgmProps?.mahalleId ?? tkgmProps?.tkgm_value ?? null;
            const adaVal = pv?.adaNo ?? pv?.ada ?? tkgmProps?.adaNo ?? tkgmProps?.ada ?? props?.adaNo ?? props?.ada ?? requestBody.ada ?? '';
            const parselVal = pv?.parselNo ?? pv?.parsel ?? tkgmProps?.parselNo ?? tkgmProps?.parsel ?? props?.parselNo ?? props?.parsel ?? requestBody.parsel ?? '';
            const unitStr = pv?.unite_price ?? null;
            const totalStr = pv?.price_of_tarla ?? null;
            const unitNum = unitStr ? parseTurkishPrice(unitStr) : null;
            const konutResult = pd?.konut_daire_result;
            const totalNum = konutResult?.daire_satis_fiyati_tl ?? konutResult?.konut_final_total_tl ?? (totalStr ? parseTurkishPrice(totalStr) : null);
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
            try {
              if (tkgmValue && adaVal && parselVal) {
                await upsertSavedQuery({
                  proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  mode: "pro",
                  price_snapshot: { unit_price: unitNum, total_price: totalNum },
                  dfaRows,
                  location_header: propertiesSlice,
                  geometry: normalizedGeometry || undefined,
                });
                if (isAuthenticated) {
                  const mahalleAd = propertiesSlice.mahalleAd || '';
                  const apiTitle = mahalleAd ? `${mahalleAd} - ${adaVal}/${parselVal}` : `${adaVal}/${parselVal}`;
                  try {
                    const apiRes = await createSavedQueryApi({
                      tkgm_value: Number(tkgmValue),
                      ada: String(adaVal),
                      parsel: String(parselVal),
                      title: apiTitle,
                      proparcel_value: proparcelValue != null ? Number(proparcelValue) : null,
                    });
                    if (!apiRes.ok) console.warn('[KonutDaireModal] API kayıt hatası:', apiRes.error);
                  } catch (apiErr) { console.warn('[KonutDaireModal] API kayıt exception:', apiErr); }
                }
              }
            } catch (saveErr) { console.warn('[KonutDaireModal] save failed:', saveErr); }
            const captureParcel: ParcelData | null = normalizedGeometry
              ? {
                  geometry: normalizedGeometry,
                  properties: { ...data.properties, ...pd?.parcel_values },
                  analysisData: data,
                }
              : null;
            await finishProQueryNavigation(data, normalizedGeometry, unitNum, totalNum, captureParcel);
          } catch (error: any) {
            if (error instanceof QueryLimitError || error instanceof ProQueryLimitError) {
              Alert.alert('Günlük Sorgu Limiti', `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
                isAuthenticated ? [{ text: 'Tamam' }] : [{ text: 'Kapat', style: 'cancel' }, { text: 'Giriş Yap', onPress: () => router.push('/auth/login' as any) }]);
            } else {
              const alert = getProQueryErrorAlert(error);
              Alert.alert(
                alert.title,
                alert.message,
                getProQueryAlertButtons(alert, {
                  isAuthenticated,
                  onLogin: () => router.push('/auth/login' as any),
                }),
              );
            }
          } finally {
            endParcelQueryLoad(loadSeq);
          }
        }}
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

      {/* Çoklu parsel — fiyat girişi uyarı modalı */}
      <Modal
        visible={multiParcelPriceWarningVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMultiParcelPriceWarningVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMultiParcelPriceWarningVisible(false)}>
          <View style={styles.priceWarnOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.priceWarnCard}>
                <View style={styles.priceWarnHeader}>
                  <View style={styles.priceWarnHeaderLeft} pointerEvents="none">
                    <Ionicons name="information-circle" size={28} color="#fbbf24" />
                  </View>
                  <View style={styles.priceWarnHeaderCenter} pointerEvents="none">
                    <Text style={styles.priceWarnTitle}>FİYAT GİRİLEMİYOR</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.priceWarnClose}
                    onPress={() => setMultiParcelPriceWarningVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color="#e2e8f0" />
                  </TouchableOpacity>
                </View>

                <View style={styles.priceWarnBody}>
                  <Text style={styles.priceWarnText}>
                    Haritada birden fazla parsel görünüyor. Fiyat girebilmek için ekranda yalnızca bir parsel olmalıdır.
                  </Text>
                  <Text style={[styles.priceWarnText, { marginTop: 10 }]}>
                    Fiyat girmek istiyorsanız diğer parselleri silip tek bir parsel bırakın; ardından tekrar Fiyat Gir butonuna basabilirsiniz.
                  </Text>
                </View>

                <View style={styles.priceWarnButtons}>
                  <TouchableOpacity
                    style={[styles.priceWarnBtn, styles.priceWarnBtnPrimary]}
                    activeOpacity={0.85}
                    onPress={() => setMultiParcelPriceWarningVisible(false)}
                  >
                    <Text style={styles.priceWarnBtnPrimaryText}>Tamam</Text>
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
        onOpenParcelInEditor={handleOpenParcelFrom3dDesignList}
      />
      <StreetViewModal
        visible={streetViewModalVisible}
        onClose={() => setStreetViewModalVisible(false)}
        streetViewPoint={streetViewPoint}
      />
      {/* 3D model görüntüleyici kaldırıldı - native Mapbox özellikleri ana ekranda */}
      
      {/* Hidden container for screenshot capture */}
      <View
        collapsable={false}
        style={{ position: 'absolute', left: -10000, top: -10000, opacity: 0.01, pointerEvents: 'none' }}
      >
        <CombinedScreenshotContainer
          ref={combinedContainerRef}
          capturedMapUri={capturedMapUri}
          parcelData={screenshotParcelForCapture}
          isProMode={isProMode}
          priceOverride={screenshotPriceOverride}
          mapOnly={!hasActiveParcel}
        />
      </View>

      {/* TKGM pasif / toplulaştırılmış parsel onay modalı */}
      <TkgmPassiveParcelModal
        visible={passiveParcelVisible}
        info={passiveParcelInfo}
        onClose={handlePassiveParcelClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: '#3b82f6' },
  /** Android: Mapbox SurfaceView ile aynı pencerede üstte kalarak dokunuşların header'a düşmesi */
  headerAndroidLayer: { elevation: 12, zIndex: 20 },
  headerSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    minWidth: 0,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  headerSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerNotifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#36AAFF',
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  headerLogoOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 26, 55, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(57, 223, 255, 0.35)',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  headerButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', borderRadius: 6 },
  // Topbar VIP rozeti
  topbarVipBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#d97706', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, height: 32 },
  topbarVipText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  // Basit/Pro switch: headerModeImgBtn
  headerModeImgBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerModeImg: { width: 34, height: 34 },
  // Ana sayfa coin alanı: 3D sayfası ölçülerine göre
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  content: { flex: 1, backgroundColor: '#1e293b', position: 'relative', overflow: 'visible' },
  homeContainer: { flex: 1 },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 },
  bottomFloatingContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 110 },
  bottomFloatingContainerAndroid: Platform.OS === 'android' ? { elevation: 24 } : {},
  homeVoiceOrbLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  bottomMenuColumn: {
    width: SCREEN_WIDTH - 12,
    maxWidth: SCREEN_WIDTH - 12,
    alignItems: 'center',
  },
  bottomToolbarStack: {
    width: SCREEN_WIDTH - 12,
    maxWidth: SCREEN_WIDTH - 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  queryActionBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.35)',
  },
  queryActionItem: {
    flex: 1,
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  queryActionItemWide: {
    flex: 1.35,
    paddingHorizontal: 8,
  },
  queryActionItemSimple: {
    position: 'relative',
    paddingHorizontal: 2,
    paddingRight: 24,
  },
  queryActionSimpleMain: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  queryActionMenuIconBtn: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    margin: 0,
  },
  queryActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  queryActionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  queryActionUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  queryActionDivider: {
    width: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
    marginVertical: 4,
  },
  queryActionDividerSimple: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  pillBar: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 30, paddingHorizontal: 2, paddingVertical: 2, alignItems: 'center', borderWidth: 1.5, borderColor: '#3b82f6', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  pillBarStacked: { borderWidth: 0, borderRadius: 0, elevation: 0, shadowOpacity: 0, width: '100%' },
  pillButton: { height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  pillButtonEven: { flex: 1, minWidth: 0 },
  pillButton3dLabel: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  pillButtonActive: { backgroundColor: '#3b82f6' },
  pillButtonDisabled: { opacity: 0.5 },
  pillButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
  pillButtonTextActive: { color: '#fff' },
  pillDivider: { width: 1, height: 18, backgroundColor: 'rgba(59, 130, 246, 0.4)', marginHorizontal: 2 },
  pillDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  rulerSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 180, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  rulerSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  rulerSubMenuItemActive: { backgroundColor: 'rgba(59, 130, 246, 0.22)' },
  rulerSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rulerSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  rulerSubMenuDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  infoSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 160, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  infoSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  infoSubMenuItemActive: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
  infoSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  infoSubMenuTextActive: { color: '#3b82f6' },
  infoSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  infoSubMenuDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  locationSubMenu: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', padding: 4, minWidth: 180, elevation: 15, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  locationSubMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  locationSubMenuText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  locationSubMenuDivider: { height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)', marginHorizontal: 8 },
  locationSubMenuDividerSimple: { backgroundColor: 'rgba(30, 41, 59, 0.18)' },
  areaFinishButtonContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 101 },
  areaFinishButton: { flexDirection: 'row', backgroundColor: '#10b981', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, borderWidth: 2, borderColor: '#059669' },
  areaFinishButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  controlsLayoutWrapper: {
    position: 'absolute',
    right: 0,
    width: THREE_D_CONTROLS_SLIDE_WIDTH,
    zIndex: 1000,
    overflow: 'visible',
  },
  threeDControlsOuter: {
    height: THREE_D_CONTROLS_PANEL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
    position: 'relative',
    width: THREE_D_CONTROLS_SLIDE_WIDTH,
    overflow: 'visible',
  },
  threeDControlTriggerWrap: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', width: 44 },
  threeDControlTrigger: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  threeDControlsExpandedRow: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  threeDControlCloseHandle: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  mapControlsPanel: { backgroundColor: 'rgba(30, 41, 59, 0.78)', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: 'rgba(59, 130, 246, 0.9)', elevation: 15, width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  mapControlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  mapControlButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  mapControlSpacer: { width: 30, height: 30 },
  pitchControlsContainer: { backgroundColor: 'rgba(30, 41, 59, 0.78)', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: 'rgba(59, 130, 246, 0.9)', elevation: 15, alignItems: 'center', width: 50, height: 110, justifyContent: 'center' },
  pitchButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  pitchValue: { color: '#fff', fontSize: 12, fontWeight: '700', marginVertical: 4 },
  zoomControlsWrapper: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -ZOOM_CONTROLS_PANEL_HEIGHT / 2 }],
    zIndex: 1000,
    overflow: 'visible',
  },
  zoomControlsOuter: {
    height: ZOOM_CONTROLS_PANEL_HEIGHT,
    width: ZOOM_CONTROLS_SLIDE_WIDTH,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-end',
    overflow: 'visible',
  },
  zoomControlTriggerWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
  },
  zoomControlTrigger: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  zoomControlLineContainer: { width: '100%', height: 40, justifyContent: 'center', alignItems: 'center' },
  zoomControlLine: { width: 3, height: 40, backgroundColor: '#3b82f6', borderRadius: 2 },
  zoomControlsExpandedRow: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 1001, overflow: 'visible' },
  zoomControlsStack: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  zoomControlsPanel: { backgroundColor: '#1e293b', borderRadius: 8, padding: 4, borderWidth: 1.5, borderColor: '#3b82f6', elevation: 15, alignItems: 'center', minWidth: 40, zIndex: 1002, overflow: 'visible' },
  zoomQueryButtonsStack: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 6,
    alignItems: 'center',
    gap: ZOOM_QUERY_BUTTONS_GAP,
    zIndex: 1003,
  },
  zoomQuerySquareButton: {
    alignSelf: 'stretch',
    width: '100%',
    height: 32,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  zoomQuerySquareButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  zoomControlButtonWrap: { position: 'relative', alignItems: 'center', overflow: 'visible' },
  zoomControlCloseHandle: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, zIndex: 1001 },
  panelCollapseHandle: { justifyContent: 'center', alignItems: 'center', height: 40, width: 28 },
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
