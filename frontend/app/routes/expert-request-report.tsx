import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Dimensions,
  Modal,
  FlatList,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useNavigation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTurkishPrice, parseTurkishPrice } from '../../src/utils/priceParser';
import { API_URL, FALLBACK_API_URL } from '../../config/api';
import { useAuth } from '../contexts/AuthContext';
import { markExpertRequestSeen, claimExpertRequest } from '../../services/expertRequestService';
import { DeviceEventEmitter } from 'react-native';

// Helper: relative URL'yi tam URL'ye çevir
const resolveImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  // Zaten tam URL ise dokunma
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Relative URL ise API_URL ile prefix ekle
  const baseUrl = API_URL || FALLBACK_API_URL || '';
  // Baştaki / karakterini kaldır (base URL sonunda / olabilir)
  const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBase}/${cleanUrl}`;
};
import { launchImageLibrary } from 'react-native-image-picker';
import { respondExpertRequest } from '../../services/expertRequestService';
import { authJsonFetch, authFormFetch } from '../../services/apiClient';
import AppBottomSheetModal from '../../components/app/AppBottomSheetModal';
import { expertRequestCache, type CachedExpertRequestData } from '../../src/utils/expertRequestCache';
import { findSavedQueryByKey, upsertSavedQuery, type SavedQuery } from '../../src/utils/savedQueries';
import { buildDfaRowsFromValuationSteps } from '../../src/utils/dfaRows';

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
      console.warn('[expert-request-report] Mapbox token yüklenemedi:', tokenError);
    }
  }
} catch (e) {
  console.warn('[expert-request-report] Mapbox native module not available.', e);
}

const COLORS = {
  brandNavy: '#0f172a',
  accentBlue: '#3b82f6',
  accentGreen: '#22c55e',
  pageBg: '#f8fafc',
  headerBg: '#1e293b',
  cardBg: '#ffffff',
  textMuted: '#64748b',
  borderSoft: '#e2e8f0',
} as const;

const { width: WINDOW_WIDTH } = Dimensions.get('window');

// Koordinat normalizasyonu: TKGM [lat,lng] -> Mapbox [lng,lat]
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

type Params = {
  expertRequestId?: string;
  mode?: 'mine' | 'incoming';
  savedQueryId?: string;
};

type TabKey = 'rapor' | 'harita' | 'yanit';

type ReportData = {
  location: {
    city?: string;
    district?: string;
    neighborhood?: string;
    ada?: string;
    parsel?: string;
  };
  pricing?: {
    unitPrice?: number;
    totalPrice?: number;
    areaM2?: number;
  };
  dfaRows?: Array<{ desc: string; kind?: string }>;
  geometry?: any;
  parcelRef?: any;
  areaM2?: number;
};

type ExpertResponse = {
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
  emsalParcels?: {
    entries?: Array<{
      ada: string;
      parsel: string;
      fiyat?: number;
      alan?: number;
      polygon?: any;
    }>;
  };
  attachments: string[];
  approvedAt: string | null;
  expert: {
    userId: number;
    fullName: string | null;
  };
};

type RequesterInfo = {
  userId: number;
  fullName: string | null;
  profilePhotoUrl: string | null;
  companyName: string | null;
  phone: string | null;
};

type UploadedImage = {
  uri: string;
  attachmentId?: string;
  attachmentUrl?: string;
};

// Dinamik Survey Question tipi (API'den gelir)
type SurveyQuestion = {
  id: number;
  code: string;
  label: string;
  type: 'boolean' | 'text' | 'single_choice' | 'multi_choice' | 'number' | 'date' | 'file' | 'ada_parsel';
  options: string[];
  placeholder: string;
  isRequired: boolean;
  dependsOn: {
    questionCode: string;
    value: string;
  } | null;
};

export default function ExpertRequestReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { user } = useAuth();

  const mode = params.mode || 'mine';
  const expertRequestId = params.expertRequestId ? Number(params.expertRequestId) : null;
  const savedQueryId = params.savedQueryId ? Number(params.savedQueryId) : null;

  const [activeTab, setActiveTab] = useState<TabKey>('yanit');
  const [loading, setLoading] = useState(true);
  
  // Tab swiper ref and config
  const tabSwiperRef = useRef<FlatList>(null);
  const TABS: TabKey[] = ['yanit', 'rapor', 'harita'];
  const tabIndex = TABS.indexOf(activeTab);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [expertResponses, setExpertResponses] = useState<ExpertResponse[]>([]);
  const [allImages, setAllImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Image viewer modal state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  
  // Inline image slider current index per response (responseId -> currentIndex)
  const [inlineImageIndices, setInlineImageIndices] = useState<Record<number, number>>({});
  
  // Collapsible response cards - track which ones are expanded (responseId -> boolean)
  const [expandedResponses, setExpandedResponses] = useState<Record<number, boolean>>({});
  
  // Window dimensions for responsive layout
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  
  // Requester info for BottomSheet (incoming mode)
  const [requesterInfo, setRequesterInfo] = useState<RequesterInfo | null>(null);
  const [neighborhoodName, setNeighborhoodName] = useState<string>('');
  const [welcomeSheetVisible, setWelcomeSheetVisible] = useState(false);

  // Response form state (incoming mode)
  const [responseText, setResponseText] = useState('');
  // Dinamik survey answers - key: question code, value: any
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>({});
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Dinamik Survey Questions (API'den gelir)
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [surveyQuestionsLoading, setSurveyQuestionsLoading] = useState(false);

  // Survey sorularını API'den çek (hem form için hem display için)
  useEffect(() => {
    const fetchSurveyQuestions = async () => {
      setSurveyQuestionsLoading(true);
      try {
        const res = await authJsonFetch('/api/expert-requests/survey-questions/');
        if (res.ok && res.data?.questions) {
          console.log('[expert-request-report] Survey questions loaded:', res.data.questions.length);
          setSurveyQuestions(res.data.questions);
        } else {
          console.warn('[expert-request-report] Survey questions yüklenemedi:', res);
        }
      } catch (err) {
        console.error('[expert-request-report] Survey questions fetch error:', err);
      } finally {
        setSurveyQuestionsLoading(false);
      }
    };
    
    fetchSurveyQuestions();
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      console.log('[expert-request-report] Loading data...', { expertRequestId, savedQueryId, mode });
      
      if (!expertRequestId) {
        setLoading(false);
        return;
      }
      
      try {
        // 1. Önce cache'den oku
        let cachedData: CachedExpertRequestData | null = null;
        try {
          cachedData = await expertRequestCache.get(expertRequestId);
          if (cachedData) {
            console.log('[expert-request-report] Found cached data, savedAt:', new Date(cachedData.savedAt).toISOString());
            
            // Cache'den hızlıca UI'ı doldur (önce göster, sonra güncelle)
            setReportData({
              location: cachedData.location,
              pricing: cachedData.pricing || undefined,
              dfaRows: cachedData.dfaRows || [],
              geometry: cachedData.geometry || undefined,
              parcelRef: cachedData.parcelRef,
              areaM2: cachedData.pricing?.areaM2 ?? null,
            });
            setExpertResponses(cachedData.responses || []);
            
            // Images from cache
            const cachedImages: string[] = [];
            (cachedData.responses || []).forEach((r) => {
              if (r.attachments && Array.isArray(r.attachments)) {
                cachedImages.push(...r.attachments);
              }
            });
            setAllImages(cachedImages);
            
            // Requester info from cache
            if (cachedData.requester) {
              setRequesterInfo(cachedData.requester);
            }
            setNeighborhoodName(cachedData.location?.neighborhood || '');
          }
        } catch (cacheError) {
          console.warn('[expert-request-report] Cache read error:', cacheError);
        }
        
        // 2. API'den güncel veri çek (her zaman)
        let reportMeta: any = null;
        let savedQueryData: any = null;

        console.log('[expert-request-report] Fetching report-data for expertRequestId:', expertRequestId);
        
        const reportDataResult = await authJsonFetch<{ success: boolean; data: any }>(
          `/api/expert-requests/${expertRequestId}/report-data/`,
          { method: 'GET' }
        );
        
        console.log('[expert-request-report] API response:', reportDataResult.ok ? 'OK' : 'ERROR');
        
        if (reportDataResult.ok) {
          const json = reportDataResult.data;
          console.log('[expert-request-report] Raw API response:', JSON.stringify(json, null, 2));
          reportMeta = json.data || json;
          console.log('[expert-request-report] reportMeta parsed:', JSON.stringify(reportMeta, null, 2));
        } else {
          console.error('[expert-request-report] API error:', reportDataResult.error, reportDataResult.status);
          Alert.alert('API Hatası', reportDataResult.error || 'Rapor verisi alınamadı');
        }

        // 3. YEREL savedQueries cache'den veri al (pricing, dfaRows, geometry)
        // Pro sorgu yapıldığında bu cache'e kaydedilmiş olmalı
        let localSavedQuery: SavedQuery | null = null;
        
        // Parametreleri çoklu kaynaklardan çek (fallback zinciri)
        const tkgmValue = reportMeta?.tkgmValue 
          || reportMeta?.proQueryParams?.mahalle 
          || reportMeta?.parcelRef?.tkgm_value
          || cachedData?.tkgmValue;
        const adaVal = reportMeta?.location?.ada 
          || reportMeta?.proQueryParams?.ada 
          || reportMeta?.parcelRef?.ada
          || cachedData?.location?.ada;
        const parselVal = reportMeta?.location?.parsel 
          || reportMeta?.proQueryParams?.parsel 
          || reportMeta?.parcelRef?.parsel
          || cachedData?.location?.parsel;
        
        console.log('[expert-request-report] Pro sorgu parametreleri (fallback zinciri):', { 
          tkgmValue, adaVal, parselVal,
          sources: {
            'reportMeta.tkgmValue': reportMeta?.tkgmValue,
            'reportMeta.proQueryParams.mahalle': reportMeta?.proQueryParams?.mahalle,
            'reportMeta.parcelRef.tkgm_value': reportMeta?.parcelRef?.tkgm_value,
            'cachedData.tkgmValue': cachedData?.tkgmValue,
          }
        });
        
        if (tkgmValue && adaVal && parselVal) {
          try {
            localSavedQuery = await findSavedQueryByKey(Number(tkgmValue), String(adaVal), String(parselVal));
            if (localSavedQuery) {
              console.log('[expert-request-report] Found local savedQuery:', {
                id: localSavedQuery.id,
                hasPrice: !!localSavedQuery.price_snapshot?.unit_price,
                hasDfaRows: (localSavedQuery.dfaRows?.length || 0) > 0,
                location: localSavedQuery.location_header,
              });
            } else {
              console.log('[expert-request-report] No local savedQuery found for this parcel');
            }
          } catch (localCacheErr) {
            console.warn('[expert-request-report] Local savedQueries lookup error:', localCacheErr);
          }
        } else {
          console.log('[expert-request-report] Missing params for local savedQueries lookup');
        }
        
        // 4. Backend saved query API'den de veri al (yedek olarak)
        const queryId = savedQueryId || reportMeta?.savedQueryId;
        console.log('[expert-request-report] Backend queryId check:', { 
          paramSavedQueryId: savedQueryId, 
          reportMetaSavedQueryId: reportMeta?.savedQueryId,
          hasSavedQuery: reportMeta?.hasSavedQuery,
          finalQueryId: queryId 
        });
        
        if (queryId && !localSavedQuery) {
          console.log('[expert-request-report] Fetching backend saved-query for queryId:', queryId);
          
          const savedQueryResult = await authJsonFetch<any>(
            `/api/user/saved-queries/${queryId}/detail/`,
            { method: 'GET' }
          );
          
          console.log('[expert-request-report] Backend saved-query response:', savedQueryResult.ok ? 'OK' : 'ERROR');
          
          if (savedQueryResult.ok) {
            savedQueryData = savedQueryResult.data;
            console.log('[expert-request-report] Backend saved-query data loaded, keys:', Object.keys(savedQueryData || {}));
          } else {
            console.warn('[expert-request-report] Backend saved-query error:', savedQueryResult.error);
          }
        } else if (!queryId) {
          console.log('[expert-request-report] No savedQueryId available, skipping backend saved-query fetch');
        }

        // 5. Cache'de rapor verisi yoksa PRO SORGU YAP (cross-platform senaryo)
        // Önce mevcut veri kaynaklarında pricing VE geometry olup olmadığını kontrol et
        const pricingFromLocalSaved = localSavedQuery?.price_snapshot?.unit_price;
        const pricingFromCache = cachedData?.pricing?.unitPrice;
        const pricingFromBackend = savedQueryData?.unitPrice || savedQueryData?.unit_price;
        
        const geometryFromLocalSaved = localSavedQuery?.geometry;
        const geometryFromCache = cachedData?.geometry;
        const geometryFromBackend = savedQueryData?.geometry || savedQueryData?.parcel_polygon;
        
        const hasPricingInAnySource = pricingFromLocalSaved || pricingFromCache || pricingFromBackend;
        const hasGeometryInAnySource = geometryFromLocalSaved || geometryFromCache || geometryFromBackend;
        
        // Pro sorgu gerekli mi? Fiyat VEYA geometry eksikse yapılmalı
        const needsProQuery = !hasPricingInAnySource || !hasGeometryInAnySource;
        
        console.log('[expert-request-report] === PRO SORGU KARAR NOKTASI ===');
        console.log('[expert-request-report] Pricing kaynakları:', {
          localSavedQuery: pricingFromLocalSaved || null,
          cachedData: pricingFromCache || null,
          backendSavedQuery: pricingFromBackend || null,
          hasPricingInAnySource: !!hasPricingInAnySource
        });
        console.log('[expert-request-report] Geometry kaynakları (karar öncesi):', {
          localSavedQuery: !!geometryFromLocalSaved,
          cachedData: !!geometryFromCache,
          backendSavedQuery: !!geometryFromBackend,
          hasGeometryInAnySource: !!hasGeometryInAnySource
        });
        console.log('[expert-request-report] Pro sorgu parametreleri:', {
          tkgmValue: tkgmValue || 'EKSİK!',
          adaVal: adaVal || 'EKSİK!',
          parselVal: parselVal || 'EKSİK!',
          hepsiVar: !!(tkgmValue && adaVal && parselVal)
        });
        console.log('[expert-request-report] Pro sorgu gerekli mi?', {
          needsProQuery,
          reason: !hasPricingInAnySource ? 'Fiyat yok' : !hasGeometryInAnySource ? 'Geometry yok' : 'Her ikisi de var'
        });
        
        let proQueryResult: any = null;
        
        // Pro sorgu yapılmama nedenlerini logla
        if (!needsProQuery) {
          console.log('[expert-request-report] ✓ Cache\'de fiyat VE geometry VAR, pro sorgu ATLANACAK');
        } else if (!tkgmValue || !adaVal || !parselVal) {
          console.warn('[expert-request-report] ✗ Pro sorgu parametreleri EKSİK! tkgmValue:', tkgmValue, 'ada:', adaVal, 'parsel:', parselVal);
          if (!tkgmValue && !adaVal && !parselVal) {
            console.error('[expert-request-report] Tüm parametreler eksik - API yanıtını kontrol edin');
          }
        } else {
          console.log('[expert-request-report] ★ Pro sorgu YAPILACAK, sebep:', !hasPricingInAnySource ? 'Fiyat eksik' : 'Geometry eksik');
        }
        
        if (needsProQuery && tkgmValue && adaVal && parselVal) {
          console.log('[expert-request-report] ★★★ PRO SORGU BAŞLIYOR ★★★');
          console.log('[expert-request-report] Parametreler:', { tkgmValue, adaVal, parselVal });
          
          try {
            // 1. TKGM verisini al (POST /api/tkgm_view/)
            console.log('[expert-request-report] [1/2] TKGM verisi alınıyor...');
            const tkgmResult = await authJsonFetch<any>(
              `/api/tkgm_view/`,
              { 
                method: 'POST',
                json: {
                  mahalleTkgmValue: tkgmValue,
                  ada: adaVal,
                  parsel: parselVal,
                  map_mode: '2d'
                }
              }
            );
            
            console.log('[expert-request-report] TKGM sonucu:', { ok: tkgmResult.ok, hasData: !!tkgmResult.data, error: tkgmResult.error });
            
            if (tkgmResult.ok && tkgmResult.data) {
              console.log('[expert-request-report] ✓ TKGM verisi alındı');
              
              // 2. Pro sorgu yap
              console.log('[expert-request-report] [2/2] Pro sorgu yapılıyor...');
              const proResult = await authJsonFetch<any>(
                `/api/get_parcel_info/`,
                {
                  method: 'POST',
                  json: {
                    tkgm_data: tkgmResult.data,
                    is3D: false,
                    map_mode: '2d'
                  }
                }
              );
              
              console.log('[expert-request-report] Pro sorgu sonucu:', { ok: proResult.ok, hasData: !!proResult.data, error: proResult.error });
              
              if (proResult.ok && proResult.data) {
                console.log('[expert-request-report] ✓✓ PRO SORGU BAŞARILI ✓✓');
                proQueryResult = proResult.data;
                
                // 3. savedQueries cache'e kaydet (sonraki açılışlarda kullanılacak)
                const pd = proQueryResult.parameters_data || {};
                const pv = pd.parcel_values || {};
                const valSteps = pd.valuation_steps || [];
                const dfaRowsFromPro = buildDfaRowsFromValuationSteps(valSteps);
                const areaRaw =
                  pv?.alan || pv?.parcel_area || proQueryResult?.properties?.alan || proQueryResult?.properties?.yuzolcumu || null;
                const areaM2FromPro = areaRaw ? parseTurkishPrice(areaRaw) : 0;
                
                // Fiyat ve Geometry bilgisini logla
                const proGeometry = proQueryResult.parcel_polygon || proQueryResult.geometry || proQueryResult.parameters_polygons?.parcel_polygon || null;
                console.log('[expert-request-report] ✓ Alınan fiyat:', {
                  unite_price: pv.unite_price,
                  price_of_tarla: pv.price_of_tarla
                });
                console.log('[expert-request-report] ✓ Alınan geometry:', {
                  hasParcelPolygon: !!proQueryResult.parcel_polygon,
                  hasGeometry: !!proQueryResult.geometry,
                  hasParametersPolygons: !!proQueryResult.parameters_polygons?.parcel_polygon,
                  geometryType: proGeometry?.type,
                  coordinatesLength: proGeometry?.coordinates?.[0]?.length || 0
                });
                
                await upsertSavedQuery({
                  tkgm_value: Number(tkgmValue),
                  ada: String(adaVal),
                  parsel: String(parselVal),
                  proparcel_value: proQueryResult.properties?.Proparcel_value || pv?.Proparcel_value || null,
                  price_snapshot: {
                    unit_price: pv?.unite_price ? parseFloat(String(pv.unite_price).replace(/[^\d.,]/g, '').replace(',', '.')) : null,
                    total_price: pv?.price_of_tarla ? parseFloat(String(pv.price_of_tarla).replace(/[^\d.,]/g, '').replace(',', '.')) : null,
                    area_m2: areaM2FromPro > 0 ? areaM2FromPro : null,
                  },
                  dfaRows: dfaRowsFromPro,
                  location_header: {
                    ilAd: proQueryResult.properties?.ilAd || null,
                    ilceAd: proQueryResult.properties?.ilceAd || null,
                    mahalleAd: proQueryResult.properties?.mahalleAd || null,
                    adaNo: pv?.adaNo || adaVal,
                    parselNo: pv?.parselNo || parselVal,
                  },
                  geometry: proGeometry,
                });
                console.log('[expert-request-report] Pro sorgu sonucu savedQueries\'e kaydedildi');
              } else {
                console.warn('[expert-request-report] Pro sorgu başarısız:', proResult.error);
              }
            } else {
              console.warn('[expert-request-report] TKGM verisi alınamadı:', tkgmResult.error);
            }
          } catch (proErr) {
            console.warn('[expert-request-report] Pro sorgu hatası:', proErr);
          }
        }

        // 6. Verileri birleştir (Pro Sorgu > Local SavedQuery > Expert Request Cache > Backend API)
        console.log('[expert-request-report] Data sources check:', {
          hasReportMeta: !!reportMeta,
          hasProQueryResult: !!proQueryResult,
          hasLocalSavedQuery: !!localSavedQuery,
          hasSavedQueryData: !!savedQueryData,
          hasCachedData: !!cachedData,
        });
        
        // Location birleştirme (proQueryResult > local savedQuery > reportMeta > cache)
        const proProps = proQueryResult?.properties || {};
        const proPv = proQueryResult?.parameters_data?.parcel_values || {};
        
        const location = proQueryResult ? {
          city: proProps.ilAd || '',
          district: proProps.ilceAd || '',
          neighborhood: proProps.mahalleAd || '',
          ada: proPv.adaNo || adaVal || '',
          parsel: proPv.parselNo || parselVal || '',
        } : localSavedQuery?.location_header ? {
          city: localSavedQuery.location_header.ilAd || '',
          district: localSavedQuery.location_header.ilceAd || '',
          neighborhood: localSavedQuery.location_header.mahalleAd || '',
          ada: localSavedQuery.location_header.adaNo || localSavedQuery.ada || '',
          parsel: localSavedQuery.location_header.parselNo || localSavedQuery.parsel || '',
        } : (reportMeta?.location || reportMeta?.parcelRef || cachedData?.location || {});
        
        // Pricing birleştirme (proQueryResult > local savedQuery > cache)
        const mergedAreaRaw =
          proPv?.alan ||
          proPv?.parcel_area ||
          proQueryResult?.properties?.alan ||
          proQueryResult?.properties?.yuzolcumu ||
          null;
        const mergedParsedArea = mergedAreaRaw ? parseTurkishPrice(mergedAreaRaw) : 0;
        const mergedAreaM2 =
          (mergedParsedArea > 0 ? mergedParsedArea : null) ??
          localSavedQuery?.price_snapshot?.area_m2 ??
          cachedData?.pricing?.areaM2 ??
          null;
        const pricing = {
          unitPrice: proPv?.unite_price 
            ? parseTurkishPrice(proPv.unite_price) 
            : (localSavedQuery?.price_snapshot?.unit_price || cachedData?.pricing?.unitPrice || null),
          totalPrice: proPv?.price_of_tarla 
            ? parseTurkishPrice(proPv.price_of_tarla) 
            : (localSavedQuery?.price_snapshot?.total_price || cachedData?.pricing?.totalPrice || null),
          areaM2: mergedAreaM2,
        };
        
        // DFA rows birleştirme (proQueryResult > local savedQuery > cache)
        let dfaRows: Array<{ desc: string; kind?: string }> = [];
        if (proQueryResult) {
          const valSteps = proQueryResult.parameters_data?.valuation_steps || [];
          const builtRows = buildDfaRowsFromValuationSteps(valSteps);
          dfaRows = builtRows.map((row: any) => ({
            desc: row.aciklama || row.desc || row.label || '',
            kind: row.tur || row.kind || '',
          }));
        } else if (localSavedQuery?.dfaRows && Array.isArray(localSavedQuery.dfaRows) && localSavedQuery.dfaRows.length > 0) {
          dfaRows = localSavedQuery.dfaRows.map((row: any) => ({
            desc: row.aciklama || row.desc || row.label || '',
            kind: row.tur || row.kind || '',
          }));
        } else if (cachedData?.dfaRows && cachedData.dfaRows.length > 0) {
          dfaRows = cachedData.dfaRows;
        }
        
        // Geometry birleştirme (proQueryResult > local savedQuery > expertRequestCache > backend saved query)
        const geometry = proQueryResult?.parcel_polygon 
          || proQueryResult?.geometry 
          || proQueryResult?.parameters_polygons?.parcel_polygon
          || localSavedQuery?.geometry 
          || cachedData?.geometry 
          || savedQueryData?.geometry 
          || savedQueryData?.parcel_polygon 
          || null;
        
        console.log('[expert-request-report] Geometry kaynakları:', {
          proQueryParcelPolygon: !!proQueryResult?.parcel_polygon,
          proQueryGeometry: !!proQueryResult?.geometry,
          proQueryParametersPolygons: !!proQueryResult?.parameters_polygons?.parcel_polygon,
          localSavedQuery: !!localSavedQuery?.geometry,
          cachedData: !!cachedData?.geometry,
          savedQueryData: !!savedQueryData?.geometry,
          finalGeometry: !!geometry,
          geometryType: geometry?.type
        });
        
        // Responses (expert request API'den)
        const responses = reportMeta?.responses || cachedData?.responses || [];

        console.log('[expert-request-report] Final merged data:', { 
          location, 
          pricing, 
          dfaRowsCount: dfaRows.length, 
          hasGeometry: !!geometry,
          responsesCount: responses.length 
        });
        
        // Debug: Yanıt verilerini detaylı logla
        console.log('[expert-request-report] Responses detail:', JSON.stringify(responses, null, 2));
        if (responses.length > 0) {
          responses.forEach((r: any, idx: number) => {
            console.log(`[expert-request-report] Response ${idx}:`, {
              id: r.id,
              hasResponseText: !!r.responseText,
              responseTextPreview: r.responseText?.substring(0, 50),
              surveyAnswers: r.surveyAnswers,
              attachmentsCount: r.attachments?.length || 0,
              attachments: r.attachments,
              expertName: r.expert?.fullName,
            });
          });
        }

        setReportData({
          location,
          pricing,
          dfaRows,
          geometry,
          parcelRef: reportMeta?.parcelRef || {},
          areaM2: pricing?.areaM2 ?? null,
        });

        // Parse expert responses
        setExpertResponses(responses);

        // Collect all images from responses (with full URL resolution)
        const images: string[] = [];
        responses.forEach((r: any) => {
          if (r.attachments && Array.isArray(r.attachments)) {
            r.attachments.forEach((att: string) => {
              const fullUrl = resolveImageUrl(att);
              if (fullUrl) images.push(fullUrl);
            });
          }
        });
        console.log('[expert-request-report] All images (resolved):', images);
        setAllImages(images);

        // Store requester info for BottomSheet (incoming mode)
        const requester = reportMeta?.requester || cachedData?.requester || null;
        if (requester) {
          console.log('[expert-request-report] Requester info:', requester);
          setRequesterInfo(requester);
        }
        
        // Store neighborhood name for welcome message
        const neighborhoodFromLocation = location?.neighborhood || reportMeta?.parcelRef?.neighborhood || '';
        setNeighborhoodName(neighborhoodFromLocation);
        
        // 6. Cache'e kaydet (güncel veri ile)
        if (reportMeta) {
          try {
            await expertRequestCache.save(expertRequestId, {
              expertRequestId,
              neighborhoodValue: reportMeta.neighborhoodValue || null,
              tkgmValue: reportMeta.tkgmValue || null,
              location,
              parcelRef: reportMeta.parcelRef || {},
              note: reportMeta.note || '',
              createdAt: reportMeta.createdAt || null,
              status: reportMeta.status || '',
              proQueryParams: reportMeta.proQueryParams || { mahalle: null, ada: '', parsel: '' },
              queryUrl: reportMeta.queryUrl || null,
              requester: requester,
              responseStatus: responses.length > 0 ? 'answered' : 'waiting',
              responseCount: responses.length,
              responses,
              hasSavedQuery: reportMeta.hasSavedQuery || false,
              savedQueryId: reportMeta.savedQueryId || null,
              pricing: pricing.unitPrice || pricing.totalPrice || pricing.areaM2 ? pricing : null,
              dfaRows,
              geometry,
            });
            console.log('[expert-request-report] Data cached successfully');
          } catch (cacheError) {
            console.warn('[expert-request-report] Cache save error:', cacheError);
          }
        }
        
        // Show welcome BottomSheet for incoming mode (only if first time viewing and no cached data)
        if (mode === 'incoming' && !cachedData) {
          // Delay showing the sheet until data is loaded
          setTimeout(() => setWelcomeSheetVisible(true), 500);
        }

        // Mine mode'da talebi "görüldü" olarak işaretle
        if (mode === 'mine' && expertRequestId) {
          markExpertRequestSeen(expertRequestId)
            .then(() => {
              console.log('[expert-request-report] Request marked as seen');
              DeviceEventEmitter.emit('refreshExpertBadges');
            })
            .catch((err) => console.warn('[expert-request-report] Mark seen error:', err));
        }
        
        // Incoming mode'da PENDING durumdaki talebi otomatik "üstlen" (claim)
        // Bu sayede durum IN_REVIEW olur ve uzman bilgisi gönderene gösterilir
        const canClaim = reportMeta?.permissions?.canClaim;
        const isPending = (reportMeta?.status || '').toUpperCase() === 'PENDING';
        if (mode === 'incoming' && expertRequestId && isPending && canClaim) {
          claimExpertRequest(expertRequestId)
            .then((res) => {
              if (res.ok) {
                console.log('[expert-request-report] Request claimed (auto) - status now IN_REVIEW');
                DeviceEventEmitter.emit('refreshExpertBadges');
              } else {
                console.warn('[expert-request-report] Claim error:', res.error);
              }
            })
            .catch((err) => console.warn('[expert-request-report] Claim error:', err));
        } else if (mode === 'incoming' && expertRequestId) {
          // Zaten claim edilmiş ama görüldü olarak işaretle
          markExpertRequestSeen(expertRequestId)
            .then(() => {
              console.log('[expert-request-report] Request marked as seen (incoming)');
              DeviceEventEmitter.emit('refreshExpertBadges');
            })
            .catch((err) => console.warn('[expert-request-report] Mark seen error:', err));
        }

      } catch (e) {
        console.error('[expert-request-report] Load error:', e);
        Alert.alert('Hata', 'Rapor verisi yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [expertRequestId, savedQueryId, mode]);

  // Image picker
  const handlePickImage = useCallback(async () => {
    if (uploadedImages.length >= 4) {
      Alert.alert('Uyarı', 'En fazla 4 resim yükleyebilirsiniz.');
      return;
    }

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 4 - uploadedImages.length,
    });

    if (!result.didCancel && result.assets) {
      const newImages = result.assets.map((a) => ({ uri: a.uri || '' }));
      setUploadedImages((prev) => [...prev, ...newImages].slice(0, 4));
    }
  }, [uploadedImages.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Submit response
  const handleSubmitResponse = useCallback(async () => {
    if (!expertRequestId) return;
    if (!responseText.trim()) {
      Alert.alert('Uyarı', 'Lütfen yanıt metnini giriniz.');
      return;
    }
    const validationError = validateRequiredSurveyAnswers();
    if (validationError) {
      Alert.alert('Uyarı', validationError);
      return;
    }

    setSubmitting(true);
    try {
      // First upload images if any
      const attachmentIds: string[] = [];
      for (const img of uploadedImages) {
        if (!img.attachmentId) {
          const formData = new FormData();
          formData.append('file', {
            uri: img.uri,
            type: 'image/jpeg',
            name: 'attachment.jpg',
          } as any);

          const uploadResult = await authFormFetch<{ success: boolean; attachmentId?: string; attachmentUrl?: string }>(
            `/api/expert-requests/${expertRequestId}/upload-attachment/`,
            formData
          );

          if (uploadResult.ok && uploadResult.data.attachmentUrl) {
            // URL'yi kullan (görüntüleme için)
            attachmentIds.push(uploadResult.data.attachmentUrl);
          } else if (uploadResult.ok && uploadResult.data.attachmentId) {
            // Fallback: ID kullan
            attachmentIds.push(uploadResult.data.attachmentId);
          }
        } else if (img.attachmentUrl) {
          attachmentIds.push(img.attachmentUrl);
        } else if (img.attachmentId) {
          attachmentIds.push(img.attachmentId);
        }
      }

      // Submit response with attachments (URLs)
      const respondResult = await authJsonFetch<{ success: boolean; error?: string }>(
        `/api/expert-requests/${expertRequestId}/respond/`,
        {
          method: 'POST',
          json: {
            responseText: responseText.trim(),
            surveyAnswers,
            attachments: attachmentIds, // URL listesi olarak gönder
          },
        }
      );

      if (respondResult.ok) {
        Alert.alert('Başarılı', 'Yanıtınız gönderildi.', [
          { text: 'Tamam', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Hata', respondResult.error || 'Yanıt gönderilemedi.');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Yanıt gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  }, [expertRequestId, responseText, surveyAnswers, uploadedImages, router]);

  // Render Rapor tab
  const renderRaporTab = () => {
    const loc = reportData?.location || {};
    const locationText = [loc.city, loc.district, loc.neighborhood]
      .filter(Boolean)
      .join(' / ');
    const adaParselText = [loc.ada ? `Ada ${loc.ada}` : null, loc.parsel ? `Parsel ${loc.parsel}` : null]
      .filter(Boolean)
      .join(' / ');

    const hasPricing = reportData?.pricing && (reportData.pricing.unitPrice || reportData.pricing.totalPrice);
    const hasDfa = reportData?.dfaRows && reportData.dfaRows.length > 0;

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Konum Bilgisi</Text>
          {locationText ? (
            <Text style={styles.locationText}>{locationText}</Text>
          ) : (
            <Text style={styles.muted}>Konum bilgisi yok</Text>
          )}
          {adaParselText ? <Text style={styles.adaParselText}>{adaParselText}</Text> : null}
        </View>

        {/* Pricing Card */}
        {hasPricing ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fiyat</Text>
            <View style={styles.priceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.priceLabel}>Birim</Text>
                <Text style={styles.priceValue}>
                  {formatTurkishPrice(reportData!.pricing!.unitPrice)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.priceLabel}>Toplam</Text>
                <Text style={styles.priceValue}>
                  {formatTurkishPrice(reportData!.pricing!.totalPrice)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fiyat Bilgisi</Text>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#64748b" />
              <Text style={styles.infoText}>
                Fiyat bilgisi için pro sorgu yapılması gerekiyor.
              </Text>
            </View>
          </View>
        )}

        {/* DFA Table */}
        {hasDfa && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Detaylı Fiyat Analizi</Text>
            <View style={styles.dfaTable}>
              {reportData!.dfaRows!.map((row, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dfaRow,
                    row.kind === 'inc' && styles.dfaRowInc,
                    row.kind === 'dec' && styles.dfaRowDec,
                    row.kind === 'warn' && styles.dfaRowWarn,
                    row.kind === 'initial' && styles.dfaRowInitial,
                  ]}
                >
                  <Text style={styles.dfaCell}>{row.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Expert Response Summary */}
        {expertResponses.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Uzman Değerlendirmesi</Text>
            <View style={styles.responseStatusBox}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              <Text style={styles.responseStatusText}>
                {expertResponses.length} uzman yanıtı mevcut
              </Text>
            </View>
            <Text style={styles.infoText}>
              Detaylar için "Yanıt" sekmesine bakın.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // Poligonun merkez noktasını hesapla
  const getParcelCentroid = (geom: any): [number, number] | null => {
    if (!geom || !geom.coordinates) return null;
    try {
      let allCoords: [number, number][] = [];
      if (geom.type === 'Polygon' && geom.coordinates[0]) {
        allCoords = geom.coordinates[0];
      } else if (geom.type === 'MultiPolygon' && geom.coordinates[0] && geom.coordinates[0][0]) {
        allCoords = geom.coordinates[0][0];
      }
      if (!allCoords.length) return null;
      let sumLon = 0, sumLat = 0;
      allCoords.forEach(([lon, lat]) => { sumLon += lon; sumLat += lat; });
      return [sumLon / allCoords.length, sumLat / allCoords.length];
    } catch {
      return null;
    }
  };

  // Render Harita tab
  const renderHaritaTab = () => {
    // TKGM [lat,lng] -> Mapbox [lng,lat] koordinat normalizasyonu
    const rawGeometry = reportData?.geometry;
    const geometry = normalizeGeometryLonLatForTurkey(rawGeometry);
    const loc = reportData?.location;
    const areaM2 = reportData?.areaM2 ?? reportData?.pricing?.areaM2 ?? null;
    // Yeşil tonları
    const greenShades = [
      { fill: 'rgba(34, 197, 94, 0.35)', line: '#16a34a', halo: '#16a34a' },
      { fill: 'rgba(74, 222, 128, 0.35)', line: '#22c55e', halo: '#22c55e' },
      { fill: 'rgba(21, 128, 61, 0.35)', line: '#15803d', halo: '#15803d' },
      { fill: 'rgba(134, 239, 172, 0.35)', line: '#4ade80', halo: '#4ade80' },
      { fill: 'rgba(5, 150, 105, 0.35)', line: '#059669', halo: '#059669' },
    ];
    
    // Ana parsel ada/parsel (karşılaştırma için)
    const mainAda = loc?.ada?.toString() || '';
    const mainParsel = loc?.parsel?.toString() || '';
    const mainKey = mainAda && mainParsel ? `${mainAda}-${mainParsel}` : '';
    
    // Emsalleri ada/parsel'e göre grupla (tekrar çizim olmasın)
    const emsalMap = new Map<string, {
      key: string;
      ada: string;
      parsel: string;
      alan: number | null;
      fiyat: number | null;
      geometry: any;
      centroid: [number, number] | null;
      experts: string[];  // Bu parseli gösteren uzmanlar (ad soyad)
      colorIdx: number;   // İlk ekleyen uzmanın renk indeksi
      isMainParcel: boolean; // Ana parsel ile aynı mı?
    }>();
    
    expertResponses.forEach((response, responseIdx) => {
      // Ad ve soyad dahil tam isim
      const expertName = response.expert?.fullName || `Uzman ${responseIdx + 1}`;
      const entries = response.emsalParcels?.entries || response.surveyAnswers?.emsal_ada_parsel?.entries || [];
      
      entries.forEach((entry: any) => {
        const normalized = normalizeGeometryLonLatForTurkey(entry.polygon);
        if (!normalized || !entry.ada || !entry.parsel) return;
        
        const key = `${entry.ada}-${entry.parsel}`;
        const isMainParcel = key === mainKey;
        const existing = emsalMap.get(key);
        
        if (existing) {
          // Aynı parsel zaten var, sadece uzman adını ekle
          if (!existing.experts.includes(expertName)) {
            existing.experts.push(expertName);
          }
          // Alan ve fiyat bilgisi yoksa güncelle
          if (!existing.alan && entry.alan) existing.alan = entry.alan;
          if (!existing.fiyat && entry.fiyat) existing.fiyat = entry.fiyat;
        } else {
          // Yeni parsel ekle
          emsalMap.set(key, {
            key,
            ada: entry.ada,
            parsel: entry.parsel,
            alan: entry.alan || null,
            fiyat: entry.fiyat || null,
            geometry: normalized,
            centroid: getParcelCentroid(normalized),
            experts: [expertName],
            colorIdx: responseIdx % greenShades.length,
            isMainParcel,
          });
        }
      });
    });
    
    // Map'i array'e çevir
    const uniqueEmsals = Array.from(emsalMap.values());
    
    // Ana parsel ile aynı olan emsal var mı?
    const mainParcelHasEmsal = uniqueEmsals.some(e => e.isMainParcel);
    const formattedArea = areaM2 ? areaM2.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '';

    // Geometry yoksa bilgi mesajı göster
    if (!geometry) {
      return (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={48} color="#64748b" />
          <Text style={styles.muted}>Harita verisi mevcut değil</Text>
          {loc && (loc.ada || loc.parsel) && (
            <View style={[styles.card, { marginTop: 16, width: '90%' }]}>
              <Text style={styles.cardTitle}>Parsel Bilgisi</Text>
              <Text style={styles.locationText}>
                {[loc.city, loc.district, loc.neighborhood].filter(Boolean).join(' / ')}
              </Text>
              <Text style={styles.adaParselText}>
                {loc.ada ? `Ada: ${loc.ada}` : ''} {loc.parsel ? `Parsel: ${loc.parsel}` : ''}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (!Mapbox) {
      return (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={48} color="#64748b" />
          <Text style={styles.muted}>Harita kullanılamıyor</Text>
        </View>
      );
    }

    // Calculate center from geometry
    let center: [number, number] = [29.0, 41.0]; // Default Istanbul
    if (geometry?.coordinates) {
      try {
        const coords = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates;
        if (Array.isArray(coords) && coords.length > 0) {
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          center = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2,
          ];
        }
      } catch (e) {
        console.warn('Center calculation failed:', e);
      }
    }

    const featureCollection = geometry
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: geometry,
            },
          ],
        }
      : null;

    // Parsel label için centroid ve text
    const parcelCentroid = geometry ? getParcelCentroid(geometry) : null;
    const adaText = loc?.ada || '';
    const parselText = loc?.parsel || '';
    const adaParselText = adaText && parselText ? `${adaText}/${parselText}` : (adaText || parselText || '');
    const alanText = formattedArea ? `${formattedArea} m²` : '';
    const parcelLabelText = adaParselText && alanText ? `${adaParselText}\n${alanText}` : (adaParselText || alanText);

    return (
      <View style={{ flex: 1 }}>
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL={Mapbox.StyleURL?.SatelliteStreet || 'mapbox://styles/mapbox/satellite-streets-v12'}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={true}
          scaleBarEnabled={false}
        >
          <Mapbox.Camera
            centerCoordinate={center}
            zoomLevel={17}
            animationMode="flyTo"
            animationDuration={1000}
          />
          {/* Ana parsel - KIRMIZI */}
          {featureCollection && (
            <Mapbox.ShapeSource id="parcel-source" shape={featureCollection}>
              <Mapbox.FillLayer
                id="parcel-fill"
                style={{
                  fillColor: 'rgba(239, 68, 68, 0.35)',
                  fillOutlineColor: '#dc2626',
                }}
              />
              <Mapbox.LineLayer
                id="parcel-line"
                style={{
                  lineColor: '#dc2626',
                  lineWidth: 3,
                }}
              />
            </Mapbox.ShapeSource>
          )}
          {/* Ana parsel label - sadece emsal olarak gösterilmiyorsa */}
          {parcelCentroid && parcelLabelText && !mainParcelHasEmsal && (
            <Mapbox.ShapeSource
              id="parcel-label-source"
              shape={{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: parcelCentroid },
                properties: { label: parcelLabelText }
              }}
            >
              <Mapbox.SymbolLayer
                id="parcel-label-layer"
                style={{
                  textField: ['get', 'label'],
                  textSize: 14,
                  textColor: '#ffffff',
                  textHaloColor: '#dc2626',
                  textHaloWidth: 2,
                  textAnchor: 'center',
                  textAllowOverlap: true,
                }}
              />
            </Mapbox.ShapeSource>
          )}
          {/* Emsal parselleri - benzersiz (ada/parsel'e göre) */}
          {uniqueEmsals.map((emsal, idx) => {
            // Ana parsel ile aynıysa kırmızı, değilse yeşil tonları
            const isMain = emsal.isMainParcel;
            const color = isMain 
              ? { fill: 'rgba(239, 68, 68, 0.35)', line: '#dc2626', halo: '#dc2626' }
              : greenShades[emsal.colorIdx];
            
            const adaParsel = `${emsal.ada}/${emsal.parsel}`;
            const alanStr = emsal.alan ? `${Math.round(emsal.alan).toLocaleString('tr-TR')} m²` : '';
            const fiyatStr = emsal.fiyat ? `${Math.round(emsal.fiyat).toLocaleString('tr-TR')} ₺` : '';
            // Ana label: ada/parsel + alan + fiyat
            const mainLabel = [adaParsel, alanStr, fiyatStr].filter(Boolean).join('\n');
            // Uzman isimleri (poligon dışına)
            const expertsLabel = emsal.experts.join('\n');
            
            return (
              <React.Fragment key={`emsal-${emsal.key}`}>
                {/* Emsal poligonu - ana parsel ile aynıysa çizme (zaten çizili) */}
                {!isMain && (
                  <Mapbox.ShapeSource
                    id={`emsal-source-${idx}`}
                    shape={{
                      type: 'Feature',
                      geometry: emsal.geometry,
                      properties: {}
                    }}
                  >
                    <Mapbox.FillLayer
                      id={`emsal-fill-${idx}`}
                      style={{
                        fillColor: color.fill,
                        fillOutlineColor: color.line,
                      }}
                    />
                    <Mapbox.LineLayer
                      id={`emsal-line-${idx}`}
                      style={{
                        lineColor: color.line,
                        lineWidth: 2,
                      }}
                    />
                  </Mapbox.ShapeSource>
                )}
                {/* Ana label - merkez */}
                {emsal.centroid && mainLabel && (
                  <Mapbox.ShapeSource
                    id={`emsal-label-source-${idx}`}
                    shape={{
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: emsal.centroid },
                      properties: { label: mainLabel }
                    }}
                  >
                    <Mapbox.SymbolLayer
                      id={`emsal-label-layer-${idx}`}
                      style={{
                        textField: ['get', 'label'],
                        textSize: isMain ? 14 : 12,
                        textColor: '#ffffff',
                        textHaloColor: color.halo,
                        textHaloWidth: 2,
                        textAnchor: 'center',
                        textAllowOverlap: true,
                      }}
                    />
                  </Mapbox.ShapeSource>
                )}
                {/* Uzman isimleri - poligon dışına (sağ üst) */}
                {emsal.centroid && expertsLabel && (
                  <Mapbox.ShapeSource
                    id={`emsal-expert-source-${idx}`}
                    shape={{
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: emsal.centroid },
                      properties: { label: expertsLabel }
                    }}
                  >
                    <Mapbox.SymbolLayer
                      id={`emsal-expert-layer-${idx}`}
                      style={{
                        textField: ['get', 'label'],
                        textSize: 11,
                        textColor: '#fef08a',
                        textHaloColor: '#000000',
                        textHaloWidth: 1.5,
                        textAnchor: 'top-left',
                        textOffset: [3, -3],
                        textAllowOverlap: true,
                      }}
                    />
                  </Mapbox.ShapeSource>
                )}
              </React.Fragment>
            );
          })}
        </Mapbox.MapView>

        {/* Ada/Parsel overlay */}
        {loc && (loc.ada || loc.parsel) && (
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayText}>
              {loc.ada ? `Ada: ${loc.ada}` : ''} {loc.parsel ? `Parsel: ${loc.parsel}` : ''}
            </Text>
            {formattedArea ? (
              <Text style={styles.mapOverlaySubText}>Alan: {formattedArea} m²</Text>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  // Render Yanıt tab
  const renderYanitTab = () => {
    if (mode === 'mine') {
      // Read-only view for sent requests
      if (expertResponses.length === 0) {
        return (
          <View style={styles.center}>
            <Ionicons name="hourglass-outline" size={48} color="#fbbf24" />
            <Text style={{ fontSize: 16, color: '#fbbf24', marginTop: 12 }}>Yanıt bekleniyor...</Text>
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
              Uzman görüşü henüz gönderilmedi.
            </Text>
          </View>
        );
      }

      // Toggle response card expand/collapse
      const toggleResponseExpand = (responseId: number) => {
        setExpandedResponses((prev) => ({
          ...prev,
          [responseId]: !prev[responseId],
        }));
      };

      return (
        <ScrollView contentContainerStyle={styles.tabContent}>
          {/* Yanıt sayısı özeti */}
          <View style={styles.responseSummaryHeader}>
            <Ionicons name="chatbubbles" size={20} color="#3b82f6" />
            <Text style={styles.responseSummaryText}>
              {expertResponses.length} uzman yanıtı
            </Text>
          </View>

          {expertResponses.map((r, idx) => {
            const isExpanded = expandedResponses[r.id] || false;
            const responseId = r.id || idx;
            // İsmin ilk harfini büyük yap
            const rawFirstName = (r.expert?.fullName || 'Uzman').split(' ')[0];
            const expertFirstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase();
            // Fiyatı kuruş olmadan formatla (virgülden sonrasını gösterme)
            const formatPriceNoDecimals = (price: number) => Math.round(price).toLocaleString('tr-TR') + ' ₺';
            const totalPriceLabel = reportData?.pricing?.totalPrice ? formatPriceNoDecimals(reportData.pricing.totalPrice) : '—';
            const suggestedPrice = r.surveyAnswers?.expert_price_suggestion
              ? parseTurkishPrice(r.surveyAnswers.expert_price_suggestion)
              : 0;
            const priceApprovalText =
              suggestedPrice > 0
                ? `${expertFirstName} bey ${formatPriceNoDecimals(suggestedPrice)} fiyat önerisinde bulundu.`
                : r.surveyAnswers?.is_price_appropriate === true
                  ? `${expertFirstName} bey ${totalPriceLabel} fiyatı onayladı.`
                  : '';

            return (
              <View key={responseId} style={styles.collapsibleCard}>
                {/* Collapsible Header - Her zaman görünür */}
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => toggleResponseExpand(responseId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <View style={styles.expertAvatar}>
                      <Text style={styles.expertAvatarText}>
                        {r.expert?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.expertName}>{r.expert?.fullName || 'Uzman'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        {r.approvedAt && (
                          <Text style={styles.expertDate}>
                            {new Date(r.approvedAt).toLocaleDateString('tr-TR')}
                          </Text>
                        )}
                        {r.attachments && r.attachments.length > 0 && (
                          <View style={styles.attachmentBadge}>
                            <Ionicons name="image" size={12} color="#64748b" />
                            <Text style={styles.attachmentBadgeText}>{r.attachments.length}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {/* Collapsible Content - Sadece açıkken görünür */}
                {isExpanded && (
                  <View style={styles.collapsibleContent}>
                    {/* Survey Answers - Dinamik gösterim */}
                    {(!r.surveyAnswers || Object.keys(r.surveyAnswers).length === 0) ? (
                      <View style={styles.surveySection}>
                        <Text style={styles.surveyValue}>Anket cevabı yok</Text>
                      </View>
                    ) : surveyQuestions.length > 0 ? (
                      // Dinamik soru-cevap gösterimi
                      surveyQuestions.map((q) => {
                        const answerValue = r.surveyAnswers?.[q.code];
                        if (answerValue === undefined || answerValue === null || answerValue === '') return null;
                        
                        // Değeri okunabilir formata çevir
                        let displayValue = '-';
                        const formatNum = (n: number) => n?.toLocaleString('tr-TR') || '-';
                        const totalPriceLabel = reportData?.pricing?.totalPrice ? formatTurkishPrice(reportData.pricing.totalPrice) : '—';
                        const labelText = (q.label || '').replace('{{toplam_fiyat}}', totalPriceLabel).replace('****', totalPriceLabel);
                        
                        if (q.type === 'boolean') {
                          displayValue = answerValue === true || answerValue === 'true' ? 'Evet' : 'Hayır';
                        } else if (q.type === 'ada_parsel' && typeof answerValue === 'object') {
                          // Ada/Parsel entries array formatı (yeni)
                          if (answerValue.entries && Array.isArray(answerValue.entries)) {
                            return (
                              <View key={q.id} style={styles.surveySection}>
                                <Text style={styles.surveyLabel}>{q.label}</Text>
                                {answerValue.entries.map((entry: any, entryIdx: number) => (
                                  <View key={entryIdx} style={styles.entryDisplayRow}>
                                    <Text style={styles.surveyValue}>
                                      <Text style={{ fontWeight: '700' }}>{entry.ada}/{entry.parsel}</Text>
                                      {entry.alan ? ` - ${formatNum(entry.alan)} m²` : ''}
                                      {entry.fiyat ? ` - ${formatNum(entry.fiyat)} TL` : ''}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            );
                          }
                          // Eski format (geriye uyumluluk)
                          const ada = answerValue.ada || '-';
                          const parsel = answerValue.parsel || '-';
                          displayValue = `Ada: ${ada}, Parsel: ${parsel}`;
                        } else if (typeof answerValue === 'object') {
                          displayValue = JSON.stringify(answerValue);
                        } else {
                          displayValue = String(answerValue);
                        }
                        
                        return (
                          <View key={q.id} style={styles.surveySection}>
                            <Text style={styles.surveyLabel}>{labelText}</Text>
                            <Text style={styles.surveyValue}>{displayValue}</Text>
                          </View>
                        );
                      })
                    ) : (
                      // Fallback: eski hardcoded gösterim (sorular yüklenemezse)
                      <>
                        {r.surveyAnswers?.similar_sale_exists !== undefined && (
                          <View style={styles.surveySection}>
                            <Text style={styles.surveyLabel}>Yakında satılan benzer arazi var mı?</Text>
                            <Text style={styles.surveyValue}>
                              {r.surveyAnswers.similar_sale_exists ? 'Evet' : 'Hayır'}
                            </Text>
                          </View>
                        )}
                        {r.surveyAnswers?.emsal_ada_parsel?.entries && r.surveyAnswers.emsal_ada_parsel.entries.length > 0 && (
                          <View style={styles.surveySection}>
                            <Text style={styles.surveyLabel}>Satılan Araziler</Text>
                            {r.surveyAnswers.emsal_ada_parsel.entries.map((entry, entryIdx) => (
                              <View key={entryIdx} style={styles.entryDisplayRow}>
                                <Text style={styles.surveyValue}>
                                  <Text style={{ fontWeight: '700' }}>{entry.ada}/{entry.parsel}</Text>
                                  {entry.alan ? ` - ${entry.alan.toLocaleString('tr-TR')} m²` : ''}
                                  {entry.fiyat ? ` - ${entry.fiyat.toLocaleString('tr-TR')} TL` : ''}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {r.surveyAnswers?.special_conditions && (
                          <View style={styles.surveySection}>
                            <Text style={styles.surveyLabel}>Özel koşullar</Text>
                            <Text style={styles.surveyValue}>{r.surveyAnswers.special_conditions}</Text>
                          </View>
                        )}
                        {r.surveyAnswers?.is_low_terrain && (
                          <View style={styles.surveySection}>
                            <Text style={styles.surveyLabel}>Arazi çukur mu?</Text>
                            <Text style={styles.surveyValue}>{r.surveyAnswers.is_low_terrain}</Text>
                          </View>
                        )}
                      </>
                    )}

                    {priceApprovalText ? (
                      <View style={styles.surveySection}>
                        <Text style={styles.priceApprovalText}>{priceApprovalText}</Text>
                      </View>
                    ) : null}

                    <View style={styles.responseSection}>
                      <Text style={styles.surveyLabel}>Uzman Açıklaması</Text>
                      <Text style={styles.responseText}>{r.responseText || '-'}</Text>
                    </View>
              
              {/* Yanıta ait resimler - Full width slider */}
              {r.attachments && r.attachments.length > 0 && (() => {
                const imageWidth = windowWidth - 48;
                const currentIdx = inlineImageIndices[r.id] || 0;
                return (
                  <View style={styles.responseSection}>
                    <Text style={styles.surveyLabel}>Fotoğraflar ({r.attachments.length})</Text>
                    <View style={{ marginTop: 8 }}>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled
                        onMomentumScrollEnd={(e) => {
                          const newIndex = Math.round(e.nativeEvent.contentOffset.x / (imageWidth + 8));
                          setInlineImageIndices((prev) => ({ ...prev, [r.id]: newIndex }));
                        }}
                        snapToInterval={imageWidth + 8}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingRight: 8 }}
                      >
                        {r.attachments.map((att: string, attIdx: number) => {
                          const imgUrl = resolveImageUrl(att);
                          return (
                            <TouchableOpacity
                              key={`img-${r.id}-${attIdx}`}
                              activeOpacity={0.9}
                              onPress={() => {
                                const resolvedImages = r.attachments.map((a: string) => resolveImageUrl(a) || '');
                                setViewerImages(resolvedImages);
                                setViewerInitialIndex(attIdx);
                                setImageViewerVisible(true);
                              }}
                            >
                              <Image
                                source={{ uri: imgUrl || '' }}
                                style={{
                                  width: imageWidth,
                                  height: imageWidth * 0.75,
                                  borderRadius: 12,
                                  marginRight: 8,
                                }}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      {r.attachments.length > 1 && (
                        <View style={styles.imageIndicatorContainer}>
                          {r.attachments.map((_: string, idx: number) => (
                            <View
                              key={idx}
                              style={[
                                styles.imageIndicatorDot,
                                idx === currentIdx && styles.imageIndicatorDotActive,
                              ]}
                            />
                          ))}
                        </View>
                      )}
                      <Text style={styles.imageTapHint}>Büyütmek için resme dokunun</Text>
                    </View>
                  </View>
                );
              })()}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      );
    }

    // Dinamik soru görünürlük kontrolü - karşılaştırma operatörleri destekler
    const isQuestionVisible = (q: SurveyQuestion): boolean => {
      if (!q.dependsOn) return true;
      const parentValue = surveyAnswers[q.dependsOn.questionCode];
      const condition = q.dependsOn.value || '';
      
      // Ada/Parsel entries array kontrolü (yeni format)
      if (typeof parentValue === 'object' && parentValue !== null && 'entries' in parentValue) {
        const hasEntries = parentValue.entries && parentValue.entries.length > 0;
        if (condition === '!=' || condition === '!empty') return hasEntries;
        if (condition === 'filled') return hasEntries;
        return hasEntries;
      }
      
      // Eski ada/parsel format (geriye uyumluluk)
      if (typeof parentValue === 'object' && parentValue !== null && 'ada' in parentValue) {
        const hasAda = parentValue.ada && String(parentValue.ada).trim() !== '';
        const hasParsel = parentValue.parsel && String(parentValue.parsel).trim() !== '';
        
        if (condition === '!=' || condition === '!empty') {
          return hasAda || hasParsel;
        }
        if (condition === 'filled') {
          return hasAda && hasParsel;
        }
        return hasAda || hasParsel;
      }
      
      // Boolean karşılaştırması için string'e çevir
      const parentStr = parentValue === true ? 'true' : parentValue === false ? 'false' : String(parentValue || '');
      const parentNum = parseFloat(parentStr) || 0;
      
      // Karşılaştırma operatörleri
      if (condition === '!=' || condition === '!empty') {
        // Boş değil kontrolü
        return parentStr !== '' && parentStr !== '0' && parentStr !== 'false';
      }
      if (condition.startsWith('!=')) {
        // Eşit değil
        return parentStr !== condition.slice(2);
      }
      if (condition.startsWith('>=')) {
        return parentNum >= parseFloat(condition.slice(2));
      }
      if (condition.startsWith('<=')) {
        return parentNum <= parseFloat(condition.slice(2));
      }
      if (condition.startsWith('>')) {
        return parentNum > parseFloat(condition.slice(1));
      }
      if (condition.startsWith('<')) {
        return parentNum < parseFloat(condition.slice(1));
      }
      
      // Varsayılan: tam eşleşme
      return parentStr === condition;
    };

  const validateRequiredSurveyAnswers = () => {
    for (const q of surveyQuestions) {
      if (!q.isRequired || !isQuestionVisible(q)) continue;
      const val = surveyAnswers[q.code];
      if (q.type === 'boolean') {
        if (val !== true && val !== false) {
          return `${q.label} zorunludur.`;
        }
        continue;
      }
      if (q.type === 'ada_parsel') {
        const entries = val && val.entries;
        if (!entries || entries.length === 0) {
          return `${q.label} zorunludur.`;
        }
        continue;
      }
      if (q.code === 'expert_price_suggestion') {
        const numVal = parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;
        if (numVal <= 0) {
          return `${q.label} zorunludur.`;
        }
        continue;
      }
      if (val === undefined || val === null || val === '') {
        return `${q.label} zorunludur.`;
      }
    }
    return null;
  };

    // Dinamik soru render
    const renderSurveyQuestion = (q: SurveyQuestion) => {
      if (!isQuestionVisible(q)) return null;
      
      const value = surveyAnswers[q.code];
      const totalPriceLabel = reportData?.pricing?.totalPrice ? formatTurkishPrice(reportData.pricing.totalPrice) : '—';
      const rawLabel = q.label || '';
      const labelText = rawLabel.replace('{{toplam_fiyat}}', totalPriceLabel).replace('****', totalPriceLabel);
      
      switch (q.type) {
        case 'boolean':
          return (
            <View key={q.id} style={styles.surveyQuestion}>
              <Text style={styles.surveyQuestionLabel}>
                {labelText}{q.isRequired ? ' *' : ''}
              </Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={[styles.radioBtn, value === true && styles.radioBtnActive]}
                  onPress={() => setSurveyAnswers((s) => ({ ...s, [q.code]: true }))}
                >
                  <Text style={[styles.radioBtnText, value === true && styles.radioBtnTextActive]}>
                    Evet
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioBtn, value === false && styles.radioBtnActive]}
                  onPress={() => setSurveyAnswers((s) => ({ ...s, [q.code]: false }))}
                >
                  <Text style={[styles.radioBtnText, value === false && styles.radioBtnTextActive]}>
                    Hayır
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        
        case 'text':
          return (
            <View key={q.id} style={styles.surveyQuestion}>
              <Text style={styles.surveyQuestionLabel}>
                {labelText}{q.isRequired ? ' *' : ''}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={q.placeholder || 'Yanıtınızı yazınız...'}
                placeholderTextColor="#94a3b8"
                value={value || ''}
                onChangeText={(t) => setSurveyAnswers((s) => ({ ...s, [q.code]: t }))}
              />
            </View>
          );
        
        case 'single_choice':
          return (
            <View key={q.id} style={styles.surveyQuestion}>
              <Text style={styles.surveyQuestionLabel}>
                {labelText}{q.isRequired ? ' *' : ''}
              </Text>
              <View style={styles.radioRow}>
                {(q.options || []).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.radioBtn, value === opt && styles.radioBtnActive]}
                    onPress={() => setSurveyAnswers((s) => ({ ...s, [q.code]: opt }))}
                  >
                    <Text style={[styles.radioBtnText, value === opt && styles.radioBtnTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        
        case 'number': {
          // Para birimi alanı için TL formatı
          const isCurrency = q.code.includes('price') || q.code.includes('fiyat');
          const formatCurrency = (val: string | number) => {
            const num = parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;
            return num > 0 ? num.toLocaleString('tr-TR') : '';
          };
          const handleCurrencyChange = (text: string) => {
            const numVal = parseFloat(text.replace(/\./g, '').replace(',', '.')) || 0;
            setSurveyAnswers((s) => ({ ...s, [q.code]: numVal > 0 ? numVal : '' }));
          };
          return (
            <View key={q.id} style={styles.surveyQuestion}>
              <Text style={styles.surveyQuestionLabel}>
                {labelText}{q.isRequired ? ' *' : ''}
              </Text>
              {isCurrency ? (
                <View style={styles.currencyInputContainer}>
                  <TextInput
                    style={[styles.input, styles.currencyInput]}
                    placeholder={q.placeholder || '0'}
                    placeholderTextColor="#94a3b8"
                    value={value ? formatCurrency(value) : ''}
                    onChangeText={handleCurrencyChange}
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencySuffix}>TL</Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder={q.placeholder || '0'}
                  placeholderTextColor="#94a3b8"
                  value={value ? String(value) : ''}
                  onChangeText={(t) => setSurveyAnswers((s) => ({ ...s, [q.code]: t }))}
                  keyboardType="numeric"
                />
              )}
            </View>
          );
        }
        
        case 'ada_parsel': {
          // Çoklu ada/parsel girişi
          const adaParselData = value || { entries: [], tempAda: '', tempParsel: '', tempFiyat: '' };
          const entries = adaParselData.entries || [];
          
          const formatCurrencyLocal = (val: number) => val.toLocaleString('tr-TR');
          
          const addEntry = () => {
            const ada = adaParselData.tempAda?.trim();
            const parsel = adaParselData.tempParsel?.trim();
            const fiyat = parseFloat(String(adaParselData.tempFiyat || '').replace(/\./g, '').replace(',', '.')) || 0;
            
            if (!ada || !parsel) {
              Alert.alert('Uyarı', 'Lütfen Ada ve Parsel numaralarını giriniz.');
              return;
            }
            
            setSurveyAnswers((s) => ({
              ...s,
              [q.code]: {
                entries: [...entries, { ada, parsel, fiyat: fiyat > 0 ? fiyat : null }],
                tempAda: '',
                tempParsel: '',
                tempFiyat: ''
              }
            }));
          };
          
          const removeEntry = (idx: number) => {
            setSurveyAnswers((s) => ({
              ...s,
              [q.code]: {
                ...adaParselData,
                entries: entries.filter((_, i) => i !== idx)
              }
            }));
          };
          
          return (
            <View key={q.id} style={styles.surveyQuestion}>
              <Text style={styles.surveyQuestionLabel}>
                {labelText}{q.isRequired ? ' *' : ''}
              </Text>
              
              {/* Giriş alanları */}
              <View style={styles.adaParselRow}>
                <View style={styles.adaParselField}>
                  <Text style={styles.adaParselLabel}>Ada</Text>
                  <TextInput
                    style={styles.adaParselInput}
                    placeholder="Ada No"
                    placeholderTextColor="#94a3b8"
                    value={adaParselData.tempAda || ''}
                    onChangeText={(t) => setSurveyAnswers((s) => ({
                      ...s,
                      [q.code]: { ...adaParselData, tempAda: t }
                    }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.adaParselField}>
                  <Text style={styles.adaParselLabel}>Parsel</Text>
                  <TextInput
                    style={styles.adaParselInput}
                    placeholder="Parsel No"
                    placeholderTextColor="#94a3b8"
                    value={adaParselData.tempParsel || ''}
                    onChangeText={(t) => setSurveyAnswers((s) => ({
                      ...s,
                      [q.code]: { ...adaParselData, tempParsel: t }
                    }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <View style={[styles.adaParselRow, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adaParselLabel}>Fiyat (TL)</Text>
                  <TextInput
                    style={styles.adaParselInput}
                    placeholder="500.000"
                    placeholderTextColor="#94a3b8"
                    value={adaParselData.tempFiyat || ''}
                    onChangeText={(t) => setSurveyAnswers((s) => ({
                      ...s,
                      [q.code]: { ...adaParselData, tempFiyat: t }
                    }))}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.addEntryBtn}
                  onPress={addEntry}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addEntryBtnText}>Ekle</Text>
                </TouchableOpacity>
              </View>
              
              {/* Eklenen satırlar */}
              {entries.length > 0 && (
                <View style={styles.entriesList}>
                  <Text style={styles.entriesTitle}>Eklenen Satılan Araziler:</Text>
                  {entries.map((entry: any, idx: number) => (
                    <View key={idx} style={styles.entryRow}>
                      <Text style={styles.entryText}>
                        <Text style={{ fontWeight: '700' }}>{entry.ada}/{entry.parsel}</Text>
                        {entry.alan ? ` - ${formatCurrencyLocal(entry.alan)} m²` : ''}
                        {entry.fiyat ? ` - ${formatCurrencyLocal(entry.fiyat)} TL` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => removeEntry(idx)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }
        
        default:
          // Diğer tipler için basit text input
          return (
            <View key={q.id} style={styles.surveyQuestion}>
              <Text style={styles.surveyQuestionLabel}>
                {q.label}{q.isRequired ? ' *' : ''}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={q.placeholder || ''}
                placeholderTextColor="#94a3b8"
                value={value || ''}
                onChangeText={(t) => setSurveyAnswers((s) => ({ ...s, [q.code]: t }))}
              />
            </View>
          );
      }
    };

    // Incoming mode - Response form
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yanıtınız</Text>

          {/* Fotoğraflar - En üstte */}
          <View style={styles.surveyQuestion}>
            <Text style={styles.surveyQuestionLabel}>Fotoğraflar (En fazla 4)</Text>
            <View style={styles.imageGrid}>
              {uploadedImages.map((img, idx) => (
                <View key={idx} style={styles.imageSlot}>
                  <Image source={{ uri: img.uri }} style={styles.uploadedImage} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => handleRemoveImage(idx)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {uploadedImages.length < 4 && (
                <TouchableOpacity style={styles.addImageSlot} onPress={handlePickImage}>
                  <Ionicons name="add" size={32} color="#94a3b8" />
                  <Text style={styles.addImageText}>Ekle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Açıklama / Uzman Görüşü */}
          <View style={styles.surveyQuestion}>
            <Text style={styles.surveyQuestionLabel}>Açıklamanız *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Değerlendirmenizi yazınız..."
              placeholderTextColor="#94a3b8"
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Dinamik Survey Soruları */}
          {surveyQuestionsLoading ? (
            <ActivityIndicator size="small" color={COLORS.accentBlue} style={{ marginVertical: 16 }} />
          ) : (
            surveyQuestions.map((q) => renderSurveyQuestion(q))
          )}
        </View>
      </ScrollView>
    );
  };

  // Render Resimler tab
  const renderResimlerTab = () => {
    if (mode === 'mine') {
      // Read-only image viewer
      if (allImages.length === 0) {
        return (
          <View style={styles.center}>
            <Ionicons name="images-outline" size={48} color="#64748b" />
            <Text style={styles.muted}>Henüz resim yok</Text>
          </View>
        );
      }

      return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Image
              source={{ uri: allImages[currentImageIndex] }}
              style={{ width: WINDOW_WIDTH - 32, height: WINDOW_WIDTH - 32, borderRadius: 12 }}
              resizeMode="contain"
            />
          </View>

          {/* Navigation */}
          {allImages.length > 1 && (
            <View style={styles.imageNav}>
              <TouchableOpacity
                style={styles.imageNavBtn}
                onPress={() => setCurrentImageIndex((i) => (i > 0 ? i - 1 : allImages.length - 1))}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.imageNavText}>
                {currentImageIndex + 1} / {allImages.length}
              </Text>
              <TouchableOpacity
                style={styles.imageNavBtn}
                onPress={() => setCurrentImageIndex((i) => (i < allImages.length - 1 ? i + 1 : 0))}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    // Incoming mode - Image picker
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fotoğraflar (En fazla 4)</Text>
          <View style={styles.imageGrid}>
            {uploadedImages.map((img, idx) => (
              <View key={idx} style={styles.imageSlot}>
                <Image source={{ uri: img.uri }} style={styles.uploadedImage} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => handleRemoveImage(idx)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {uploadedImages.length < 4 && (
              <TouchableOpacity style={styles.addImageSlot} onPress={handlePickImage}>
                <Ionicons name="add" size={32} color="#94a3b8" />
                <Text style={styles.addImageText}>Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, height: 54 + insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'mine' ? 'Talep Raporu' : 'Yanıt Raporu'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => {
              setActiveTab(tab);
              tabSwiperRef.current?.scrollToIndex({ index: idx, animated: true });
            }}
          >
            <Ionicons
              name={
                tab === 'rapor'
                  ? 'document-text-outline'
                  : tab === 'harita'
                  ? 'map-outline'
                  : 'chatbubble-outline'
              }
              size={18}
              color={activeTab === tab ? COLORS.accentBlue : '#64748b'}
            />
            <Text style={[styles.tabItemText, activeTab === tab && styles.tabItemTextActive]}>
              {tab === 'rapor'
                ? 'Rapor'
                : tab === 'harita'
                ? 'Harita'
                : 'Yanıt'}
            </Text>
            {tab === 'yanit' && expertResponses.length > 0 && mode === 'mine' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{expertResponses.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Swipeable Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accentBlue} />
          <Text style={styles.muted}>Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          ref={tabSwiperRef}
          data={TABS}
          horizontal
          pagingEnabled
          scrollEnabled={activeTab !== 'harita'}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          initialScrollIndex={tabIndex}
          nestedScrollEnabled
          bounces={false}
          style={{ flex: 1 }}
          getItemLayout={(_, index) => ({
            length: windowWidth,
            offset: windowWidth * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
            if (newIndex >= 0 && newIndex < TABS.length) {
              setActiveTab(TABS[newIndex]);
            }
          }}
          keyExtractor={(item) => item}
          renderItem={({ item: tab }) => (
            <View style={{ width: windowWidth, flex: 1 }}>
              {tab === 'rapor' && renderRaporTab()}
              {tab === 'harita' && renderHaritaTab()}
              {tab === 'yanit' && renderYanitTab()}
            </View>
          )}
        />
      )}

      {/* Submit Button (incoming mode only) */}
      {mode === 'incoming' && !loading && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmitResponse}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Raporu Tamamla</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Welcome BottomSheet (incoming mode only) */}
      <AppBottomSheetModal
        visible={welcomeSheetVisible}
        onClose={() => setWelcomeSheetVisible(false)}
        snapPoints={['62%']}
        enablePanDownToClose={true}
        backdropPressBehavior="close"
        backdropOpacity={0.5}
      >
        <View style={styles.welcomeSheet}>
          {/* Requester Header - Gönderenin tam adı soyadı */}
          <View style={styles.requesterHeader}>
            {(() => {
              const avatarUrl = resolveImageUrl(requesterInfo?.profilePhotoUrl);
              const requesterName = (requesterInfo?.fullName || 'Kullanıcı')
                .split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
              return avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.requesterAvatar}
                />
              ) : (
                <View style={styles.requesterAvatarPlaceholder}>
                  <Text style={styles.requesterAvatarText}>
                    {requesterName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.requesterInfo}>
              <Text style={styles.requesterName}>
                {(requesterInfo?.fullName || 'Kullanıcı')
                  .split(' ')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')}
              </Text>
              <Text style={styles.requesterMeta}>
                {[requesterInfo?.companyName, requesterInfo?.phone]
                  .filter(Boolean)
                  .join(' | ')}
              </Text>
            </View>
          </View>

          {/* Welcome Message - Uzmanın kendi adı soyadı (baş harfler büyük) */}
          <View style={styles.welcomeMessage}>
            <Text style={styles.welcomeText}>
              Değerli meslektaşım{' '}
              <Text style={styles.welcomeHighlight}>
                {(user?.full_name || 'Meslektaşım')
                  .split(' ')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')}
              </Text>
              ,
            </Text>
            <Text style={styles.welcomeText}>
              {'\n'}Uzmanı olduğun{' '}
              <Text style={styles.welcomeHighlight}>{neighborhoodName}</Text>{' '}
              bölgesinde bir portföyümüz için senin değerli görüşlerine ihtiyacımız var.
            </Text>
            <Text style={styles.welcomeText}>
              {'\n'}Bizimle fikirlerini paylaşırsan çok memnun oluruz.
            </Text>
            <Text style={[styles.welcomeText, styles.welcomeSignature]}>
              {'\n'}Şimdiden Teşekkür Eder, Saygılarımı Sunarım
            </Text>
          </View>

          {/* Close hint */}
          <View style={styles.welcomeHint}>
            <Ionicons name="chevron-down" size={20} color="#94a3b8" />
            <Text style={styles.welcomeHintText}>Kapatmak için aşağı kaydırın</Text>
          </View>
        </View>
      </AppBottomSheetModal>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={[styles.imageViewerContainer, isLandscape && styles.imageViewerContainerLandscape]}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.imageViewerCloseBtn}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Image counter */}
          <View style={styles.imageViewerCounter}>
            <Text style={styles.imageViewerCounterText}>
              {viewerInitialIndex + 1} / {viewerImages.length}
            </Text>
          </View>

          {/* Swipeable image gallery */}
          <FlatList
            key={`viewer-${isLandscape ? 'landscape' : 'portrait'}-${windowWidth}`}
            data={viewerImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerInitialIndex}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
              setViewerInitialIndex(newIndex);
            }}
            keyExtractor={(_, idx) => `viewer-img-${idx}-${isLandscape ? 'l' : 'p'}`}
            renderItem={({ item: imgUrl }) => (
              <View style={{ width: windowWidth, height: windowHeight, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={{ uri: imgUrl }}
                  style={{
                    width: isLandscape ? windowWidth * 0.85 : windowWidth * 0.95,
                    height: isLandscape ? windowHeight * 0.8 : windowHeight * 0.6,
                    maxWidth: windowWidth * 0.95,
                    maxHeight: windowHeight * 0.85,
                  }}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          {/* Navigation dots */}
          {viewerImages.length > 1 && (
            <View style={styles.imageViewerDots}>
              {viewerImages.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.imageViewerDot,
                    idx === viewerInitialIndex && styles.imageViewerDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
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
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.accentBlue,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabItemTextActive: {
    color: COLORS.accentBlue,
  },
  badge: {
    backgroundColor: COLORS.accentGreen,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brandNavy,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#334155',
  },
  adaParselText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  responseStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  responseStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22c55e',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 16,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brandNavy,
    marginTop: 4,
  },
  dfaTable: {
    marginTop: 8,
  },
  dfaRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#f8fafc',
  },
  dfaRowInc: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  dfaRowDec: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dfaRowWarn: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  dfaRowInitial: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  dfaCell: {
    fontSize: 13,
    color: '#334155',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapOverlaySubText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  expertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expertAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expertAvatarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  expertName: {
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 15,
  },
  expertDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Collapsible card styles
  collapsibleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collapsibleContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  responseSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  responseSummaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attachmentBadgeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  surveySection: {
    marginBottom: 12,
  },
  surveyLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  surveyValue: {
    color: '#1f2937',
    fontSize: 14,
  },
  priceApprovalText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  responseSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 12,
  },
  responseText: {
    color: '#1f2937',
    fontSize: 14,
    lineHeight: 22,
  },
  surveyQuestion: {
    marginBottom: 16,
  },
  surveyQuestionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  adaParselRow: {
    flexDirection: 'row',
    gap: 12,
  },
  adaParselField: {
    flex: 1,
  },
  adaParselLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  adaParselInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  currencyInput: {
    flex: 1,
    paddingRight: 40,
  },
  currencySuffix: {
    position: 'absolute',
    right: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
    alignSelf: 'flex-end',
    gap: 4,
  },
  addEntryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  entriesList: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  entriesTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  entryText: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  entryDisplayRow: {
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 10,
  },
  radioBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radioBtnActive: {
    backgroundColor: COLORS.accentBlue,
    borderColor: COLORS.accentBlue,
  },
  radioBtnText: {
    fontSize: 14,
    color: '#64748b',
  },
  radioBtnTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    marginTop: 8,
  },
  textArea: {
    minHeight: 120,
  },
  imageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 24,
  },
  imageNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageNavText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageSlot: {
    width: (WINDOW_WIDTH - 32 - 36) / 2,
    height: (WINDOW_WIDTH - 32 - 36) / 2,
    borderRadius: 12,
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addImageSlot: {
    width: (WINDOW_WIDTH - 32 - 36) / 2,
    height: (WINDOW_WIDTH - 32 - 36) / 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accentGreen,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Welcome BottomSheet styles
  welcomeSheet: {
    flex: 1,
    padding: 20,
    paddingTop: 8,
  },
  requesterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  requesterAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  requesterAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  requesterInfo: {
    marginLeft: 14,
    flex: 1,
  },
  requesterName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.brandNavy,
  },
  requesterMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  welcomeMessage: {
    flex: 1,
    paddingTop: 20,
  },
  welcomeText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  welcomeHighlight: {
    fontWeight: '700',
    color: COLORS.accentBlue,
  },
  welcomeSignature: {
    fontStyle: 'italic',
    color: '#64748b',
  },
  welcomeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  welcomeHintText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  // Image slider styles
  imageIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  imageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  imageIndicatorDotActive: {
    backgroundColor: COLORS.accentBlue,
  },
  imageTapHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  // Image Viewer Modal styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContainerLandscape: {
    flexDirection: 'row',
  },
  imageViewerCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  imageViewerCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  imageViewerCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageViewerDots: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imageViewerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  imageViewerDotActive: {
    backgroundColor: '#fff',
  },
});
