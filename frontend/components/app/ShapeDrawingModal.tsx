/**
 * Shape Drawing Modal
 * Şekil çizim modülü - Ana sayfadan bağımsız modal sayfa
 */

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Alert,
  PanResponder,
  ActivityIndicator,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ShapeDrawingMapView } from './shapeDrawingModal/ShapeDrawingMapView';
import { ShapeDrawingDropdownSheets } from './shapeDrawingModal/ShapeDrawingDropdownSheets';
import { styles } from './shapeDrawingModal/styles';
import { useModelCatalog } from "./shapeDrawingModal/useModelCatalog";
import { ShapeEditSheet } from "./shapeDrawingModal/ShapeEditSheet";
import { MeasurementEditSheet } from "./shapeDrawingModal/MeasurementEditSheet";
import { ManagementSheet } from "./shapeDrawingModal/ManagementSheet";
import { ModeInfoBar } from "./shapeDrawingModal/ModeInfoBar";
import { FreehandDrawOverlay } from "./shapeDrawingModal/FreehandDrawOverlay";
import { ScreenShapesOverlay } from "./shapeDrawingModal/ScreenShapesOverlay";
import { TextBoxMapOverlay } from "./shapeDrawingModal/TextBoxMapOverlay";
import { DrawingToolbox } from "./shapeDrawingModal/DrawingToolbox";
import { DrawingFinishBar } from "./shapeDrawingModal/DrawingFinishBar";
import { ModelLoadingStrip } from "./shapeDrawingModal/ModelLoadingStrip";
import { patchTextBoxShape } from "@/src/maps/drawing/textBoxLayout";
import { PurchaseModelModal } from "./shapeDrawingModal/PurchaseModelModal";
import { MapNavControls } from "./shapeDrawingModal/MapNavControls";
import { useModelSelectHandler } from "./shapeDrawingModal/useModelSelectHandler";
import { useMapCameraControls } from "./shapeDrawingModal/useMapCameraControls";
import { ModelDebugBanner } from "./shapeDrawingModal/ModelDebugBanner";
import { ModelDebugPanel } from "./shapeDrawingModal/ModelDebugPanel";
import { useModelFocus } from "./shapeDrawingModal/useModelFocus";
import { useShapeDrawingHandlers } from "./shapeDrawingModal/useShapeDrawingHandlers";
import { getMeasurementName as getMeasurementNameUtil, getParcelName as getParcelNameUtil, getShapeName as getShapeNameUtil } from "./shapeDrawingModal/naming";
import { useConfirmDeleteMeasurement } from "./shapeDrawingModal/useConfirmDeleteMeasurement";
import { useParcelSelectHandler } from "./shapeDrawingModal/useParcelSelectHandler";
import { useMeasurementHandlers } from "./shapeDrawingModal/useMeasurementHandlers";
import { useShapeEditGestures, type RotationMode } from "./shapeDrawingModal/useShapeEditGestures";
import { useMapPressHandler, trySelectModelInstanceAtLngLat, normalizeLngLat } from "./shapeDrawingModal/useMapPressHandler";
import { tryHitMeasurementForDelete } from "./shapeDrawingModal/measurementMapHit";
import { ParcelSelectModal } from "./shapeDrawingModal/ParcelSelectModal";
import {
  formatModelDisplayName,
  getModelSourceByRowId,
  type ModelCatalogFlatItem,
} from "@/src/maps/models/modelCatalog";
import { useModelUsage } from "./shapeDrawingModal/useModelUsage";
import { decrementModelUsage } from "@/src/services/modelUsageService";
import { ensureModelAvailable } from "@/src/services/modelDelivery";
import { UsageInfoPanel } from "./shapeDrawingModal/UsageInfoPanel";
import { isFreeRole } from "@/src/maps/models/modelAvailability";
import { useModelManager, CATEGORY_SCALE } from "@/src/maps/models/ModelManager";
import {
  computeFootprintAreaM2,
  getDefaultScaleMultiplierForCatalogItem,
  getTranslationForCatalogItem,
} from "@/src/maps/models/modelFootprint";
import { TextBoxEditModal } from './TextBoxEditModal';
import AdaParselForm from '../AdaParselForm';
import AppBottomSheetModal from './AppBottomSheetModal';
import type { ShapeType, ShapeProperties } from '../../src/maps/drawing/types';
import {
  resizeShape,
  rotateShape,
  findNearestHandle,
  getShapeBounds,
} from '../../src/maps/drawing/shapeResizeUtils';
import {
  calculateDistance,
  calculateArea,
  createRulerFeatures,
  createAreaFeatures,
  formatDistance,
  formatArea,
  type MeasurementFeature,
} from '../../src/utils/measurementManager';
import { createPenFreehandShape } from "../../src/maps/drawing/ShapeDrawingManager";
import { API_URL, FALLBACK_API_URL } from '../../config/api';
import { createEdgeMeasurementFeatures, type EdgeMeasureData } from '../../src/utils/edgeMeasurementsManager';
import { useRouter } from '../../src/hooks/useNavigation';
import { waitForMapIdle, tryMapboxSnap } from "../../src/utils/mapboxSnapshot";
import {
  loadCaptures,
  saveTmpToGallery,
  persistCaptures,
  deleteCaptureFiles,
  enforceMaxCaptures,
  getModelEditorCaptureDimensions,
  type CaptureItem,
} from "../../src/utils/captureGallery";
import { shareManyImages } from "../../src/utils/handlers/modelEditorShareHandler";
import { checkTotalModelSize, getTotalModelSizeForDisplay } from "../../src/utils/modelSizeLimit";
import { cleanupTempFiles } from "../../src/utils/screenshotManager";
import { CaptureComposeContainer } from "./shapeDrawingModal/CaptureComposeContainer";
import { CaptureModeBar } from "./shapeDrawingModal/CaptureModeBar";
import { CaptureBottomSheet } from "./shapeDrawingModal/CaptureBottomSheet";
import { CapturePreviewModal } from "./shapeDrawingModal/CapturePreviewModal";
import type { BuildingPolyFeature } from "./shapeDrawingModal/BuildingExtrusionLayer";
import { BuildingUnifiedSheet, type BuildingSheetTab } from "./shapeDrawingModal/BuildingUnifiedSheet";
import { trySelectBuildingAtLngLat } from "./shapeDrawingModal/trySelectBuildingAtLngLat";
import { useBuildingTransformBar } from "./shapeDrawingModal/useBuildingTransformBar";
import {
  computeBuildingFootprint,
  defaultBuildingSettings,
  getBuildingGuideLimits,
  type BuildingSettings,
} from "@/src/maps/building/computeBuildingFootprint";
import { computeInsetGuideGeometry } from "@/src/maps/building/computeInsetGuideGeometry";
import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from "geojson";
import {
  DEFAULT_BUILDING_HEX,
  hexToRgb,
  ringAreaM2Approx,
  scaleRingUniform,
} from "@/src/maps/building/buildingRingGeometry";
import {
  generateWindowFramePolygonsFeatureCollection,
  type BuildingFrameTemplateKey,
} from "@/src/maps/building/buildingFrameTemplates";
import { mergeBuildingsRoofGeoJSON } from "@/src/maps/building/roofTemplates";
import { ModelTransformBar } from "./shapeDrawingModal/ModelTransformBar";
import { useModelTransformBar } from "./shapeDrawingModal/useModelDragPinch";
import { useScreenShield } from "../../screens/contexts/ScreenShieldContext";
import { useAuth } from "../../screens/contexts/AuthContext";
import { creditService } from "../../services/creditService";
import { Parcel3dPurchaseModal } from "./shapeDrawingModal/Parcel3dPurchaseModal";
import { cacheParcel3dTkgmAfterPurchase } from "../../src/utils/parcel3dPurchasedStorage";
import { parcel3dReferenceId } from "../../src/utils/parcel3dReference";
import { saveImageUrisToPhotoLibrary } from "../../src/utils/saveToDeviceGallery";
import { calculateBoundsAndCamera, normalizeGeometryCoordinates } from "@/src/utils/parcelUtils";

const TepeCoinIcon = require("../../assets/images/TepeCoin.png");

function readMahalleTkgmFromParcelProps(props: Record<string, unknown> | null | undefined): number | undefined {
  const p = props as any;
  const v =
    p?.mahalleId ??
    p?.MahalleId ??
    p?.mahalle_id ??
    p?.tkgm_value ??
    p?.Tkgm_value ??
    p?.quarterTkgmValue ??
    p?.mahalleTkgmValue;
  if (v == null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function readProparcelFromParcelProps(props: Record<string, unknown> | null | undefined): number | undefined {
  const p = props as any;
  const v = p?.Proparcel_value ?? p?.proparcel_value ?? p?.proparcelValue ?? p?.ProparcelValue;
  if (v == null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 3D modal: props.initialParcel ile aynı id üretimi (liste + seçim tutarlılığı) */
function buildModalParcelRow(initialParcel: any): any | null {
  if (!initialParcel?.geometry) return null;
  const props = (initialParcel as any)?.properties || {};
  const mahalle = String(props.mahalleAd ?? props.mahalle ?? "").trim();
  const ada = String(props.adaNo ?? props.ada ?? "").trim();
  const parsel = String(props.parselNo ?? props.parsel ?? "").trim();
  const id =
    (initialParcel as any)?.id != null
      ? String((initialParcel as any).id)
      : mahalle || ada || parsel
        ? `${mahalle}|${ada}|${parsel}`
        : "initial_parcel";
  return { ...(initialParcel as any), id };
}

// Conditional Mapbox import - Ana sayfadaki yapıyla aynı
let Mapbox: any = null;
let RasterDemSource: any = null;
let Terrain: any = null;
let RNMapboxVersion: string | null = null;
try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
  if (mapboxModule.RasterDemSource) RasterDemSource = mapboxModule.RasterDemSource;
  if (mapboxModule.Terrain) Terrain = mapboxModule.Terrain;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RNMapboxVersion = require("@rnmapbox/maps/package.json")?.version || null;
  } catch {
    RNMapboxVersion = null;
  }
  if (Mapbox && Mapbox.setAccessToken) {
    try {
      const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
      Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    } catch (tokenError) {
      console.warn('[ShapeDrawingModal] Mapbox token yüklenemedi:', tokenError);
    }
  }
} catch (e) {
  console.warn('[ShapeDrawingModal] Mapbox native module not available:', e);
}

/** Kenar ölçüsü / bina akışında parsel kimliği (id veya ada/parsel) — farklı referanslarda aynı parseli eşleştirmek için */
function parcelEdgeContextKey(parcel: { id?: string | number; properties?: any } | null | undefined): string {
  if (!parcel) return "";
  const props = parcel.properties || {};
  const m = String(props.mahalleAd ?? props.mahalle ?? "").trim().toLowerCase();
  const a = String(props.adaNo ?? props.ada ?? "").trim().toLowerCase();
  const p = String(props.parselNo ?? props.parsel ?? "").trim().toLowerCase();
  if (m && a && p) return `ref:${m}|${a}|${p}`;
  if (parcel.id != null && String(parcel.id).length > 0) return `id:${String(parcel.id)}`;
  return "";
}

interface ShapeDrawingModalProps {
  visible: boolean;
  onClose: () => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Ana ekrandan seçili/tek parsel ile otomatik açmak için */
  initialParcel?: any;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ShapeDrawingModal: React.FC<ShapeDrawingModalProps> = ({
  visible,
  onClose,
  initialCenter,
  initialZoom,
  initialParcel,
}) => {
  // Build marker (eski bundle/HMR karışıklığını ayırt etmek için)
  const SHAPE_DRAWING_MODAL_BUILD = "2026-01-14-model-cache-debug-v2";

  // TÜM HOOK'LAR HER ZAMAN ÇAĞRILMALI - React Rules of Hooks
  // Hook'lar conditional return'lerden ÖNCE olmalı
  const insets = useSafeAreaInsets();
  const { enableShield, disableShield } = useScreenShield();
  const { user, isAuthenticated } = useAuth();

  // Default values - Önce tanımla
  const defaultCenter: [number, number] = [34.0, 39.0];
  const defaultZoom = 10;
  /** Aktif parsel varsa kamera parseli çerçeveleyecek şekilde (ana harita merkezi yerine) */
  const parcelCameraFromInitial = useMemo(() => {
    const row = buildModalParcelRow(initialParcel);
    if (!row?.geometry) return null;
    try {
      const norm = normalizeGeometryCoordinates(row.geometry);
      return calculateBoundsAndCamera(norm);
    } catch {
      return null;
    }
  }, [initialParcel]);

  const center: [number, number] = parcelCameraFromInitial?.center ?? initialCenter ?? defaultCenter;
  const zoom = parcelCameraFromInitial?.zoom ?? initialZoom ?? defaultZoom;
  
  // Debug log - Modal açıldığında (center ve zoom tanımlandıktan sonra)
  useEffect(() => {
    if (visible) {
      console.log('[3DEDIT] Modal açıldı (visible=true)', {
        Mapbox: !!Mapbox,
        MapView: !!Mapbox?.MapView,
        Camera: !!Mapbox?.Camera,
        center,
        zoom,
        Platform: Platform.OS,
        apiLevel: Platform.OS === 'android' ? Platform.Version : null,
      });
      console.log('[3DEDIT] Build:', SHAPE_DRAWING_MODAL_BUILD);
      console.log('[3DEDIT] Env: ModelLayer=', !!Mapbox?.ModelLayer, 'Models=', !!Mapbox?.Models);
    } else {
      console.log('[3DEDIT] Modal kapalı (visible=false)');
    }
  }, [visible, center, zoom]);

  useEffect(() => {
    if (visible) {
      console.log('[3DEDIT] Modal render durumu: visible=true, hasMapbox=', !!Mapbox);
    }
  }, [visible, Mapbox]);
  
  // Shape drawing state
  const [shapeDrawingMode, setShapeDrawingMode] = useState<ShapeType | null>(null);
  const [shapeDrawingPoints, setShapeDrawingPoints] = useState<[number, number][]>([]);
  const [shapes, setShapes] = useState<ShapeProperties[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapeEditPanelVisible, setShapeEditPanelVisible] = useState(false);
  const [shapeEditPanelMinimized, setShapeEditPanelMinimized] = useState(true);
  const [textBoxLayoutTick, setTextBoxLayoutTick] = useState(0);
  const bumpTextBoxLayout = useCallback(() => {
    setTextBoxLayoutTick((t) => t + 1);
  }, []);
  const [measurementEditPanelVisible, setMeasurementEditPanelVisible] = useState(false);
  const [measurementEditPanelMinimized, setMeasurementEditPanelMinimized] = useState(true);

  // TextBox: çift dokunuşla metin düzenleme
  const [textBoxEditVisible, setTextBoxEditVisible] = useState(false);
  const [textBoxEditShapeId, setTextBoxEditShapeId] = useState<string | null>(null);
  const [textBoxEditInitialText, setTextBoxEditInitialText] = useState<string>('');
  
  // Model sayfası: 3D yön/açı kontrolleri (index ile aynı mantık)
  const [navControlsVisible, setNavControlsVisible] = useState(false);
  
  // Model debug panel state
  const [modelDebugPanelVisible, setModelDebugPanelVisible] = useState(false);

  // Terrain: 2D başlat; kullanıcı Kontroller ile 3D'ye geçince aç (OOM riski azalır)
  const [terrainEnabled, setTerrainEnabled] = useState(false);

  // Harita mount gecikmesi: 3D editör açılırken MapView hemen mount edilmez; JS thread yanıt verir
  const [mapMountReady, setMapMountReady] = useState(false);

  // Capture (ekran görüntüsü) state
  const [captureItems, setCaptureItems] = useState<CaptureItem[]>([]);
  const [captureSheetVisible, setCaptureSheetVisible] = useState(false);
  const [captureSheetInitialIndex, setCaptureSheetInitialIndex] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [capturedMapUri, setCapturedMapUri] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [captureMode, setCaptureMode] = useState(false);
  const [captureInProgress, setCaptureInProgress] = useState(false);
  // 3D tasarım satın alma (parsel bazlı) gate
  const [parcel3dPurchaseVisible, setParcel3dPurchaseVisible] = useState(false);
  const [pendingPaidAction, setPendingPaidAction] = useState<"shareSelected" | "saveSelected" | null>(null);
  const [pendingParcelInfo, setPendingParcelInfo] = useState<{
    mahalle: string;
    ada: string;
    parsel: string;
    referenceId: string;
    mahalleTkgmValue?: number;
    proparcelValue?: number;
  } | null>(null);
  const composeDims = useMemo(() => {
    const d = getModelEditorCaptureDimensions();
    return { width: d.mapWidth, height: d.mapHeight };
  }, []);
  useEffect(() => {
    if (!visible) {
      setMapMountReady(false);
      return;
    }
    console.log('[3DEDIT] Harita mount zamanlayıcı başlatıldı (350ms)');
    const t = setTimeout(() => {
      console.log('[3DEDIT] Harita mount zamanlayıcı tetiklendi -> mapMountReady=true');
      setMapMountReady(true);
    }, 350);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      import("@/src/utils/modelsCache")
        .then(({ clearAllCachedModels }) => clearAllCachedModels())
        .then((r) => {
          if (__DEV__ && r.deletedFiles > 0) {
            console.log("[ShapeDrawingModal] Model cache temizlendi:", r.deletedFiles, "dosya");
          }
        })
        .catch((e) => {
          if (__DEV__) console.warn("[ShapeDrawingModal] Model cache temizlenirken hata:", e);
        });
    }
  }, [visible]);

  // Ekran koruma: 3D editör sayfası açıkken (modal visible) FLAG_SECURE + overlay; Hisseli Parsel ile aynı strateji.
  useEffect(() => {
    if (visible) {
      enableShield();
      return () => { disableShield(); };
    }
    disableShield();
  }, [visible, enableShield, disableShield]);

  // Resize/Rotation state - Basit mod: sadece mod tipi
  const [resizeMode, setResizeMode] = useState<{ shapeId: string } | null>(null);
  const [moveMode, setMoveMode] = useState<{ shapeId: string; lastTouchPos: [number, number] } | null>(null);
  const [rotationMode, setRotationMode] = useState<RotationMode>(null);
  
  // Dropdown state
  const [mapToolsSheetOpen, setMapToolsSheetOpen] = useState(false);
  const [modelsDropdownOpen, setModelsDropdownOpen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  /** Araç çubuğunda tek menü: Şekil / Nesne / Ölçüm / Resim */
  const [mainActionMenuOpen, setMainActionMenuOpen] = useState(false);
  
  // Tab management state
  const [activeTab, setActiveTab] = useState<'shapes' | 'measurements' | 'parcels'>('shapes');
  const [managementPanelVisible, setManagementPanelVisible] = useState(false);

  // Kredi bakiyesi (Tepe Coin) - ana sayfadaki gibi
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);

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
      console.error("[ShapeDrawingModal] Kredi bakiyesi yüklenemedi:", error);
      setCreditBalance(null);
    } finally {
      setIsLoadingCredit(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!visible) return;
    loadCreditBalance();
  }, [visible, loadCreditBalance]);
  
  // Measurement state
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'area' | null>(null);
  /** Web Araç Takımı ile uyumlu: yeni şekiller ve ölçüm çizgileri */
  const [drawOutlineColor, setDrawOutlineColor] = useState("#2563eb");
  const [drawFillColor, setDrawFillColor] = useState("#3b82f6");
  const [drawOutlineWidth, setDrawOutlineWidth] = useState(4);
  const [drawSurface, setDrawSurface] = useState<"map" | "screen">("map");
  const [measureRulerColor, setMeasureRulerColor] = useState("#3b82f6");
  const [measureAreaColor, setMeasureAreaColor] = useState("#f97316");
  const [measurementPoints, setMeasurementPoints] = useState<[number, number][]>([]);
  const [measurementFeatures, setMeasurementFeatures] = useState<MeasurementFeature[]>([]);
  /** Haritada seçili mesafe/alan ölçümü (measurementGroupId) — şekil seçimi gibi */
  const [selectedMeasurementGroupId, setSelectedMeasurementGroupId] = useState<string | null>(null);
  const [edgeMeasurementFeatures, setEdgeMeasurementFeatures] = useState<any[]>([]);
  const [showEdgeMeasurements, setShowEdgeMeasurements] = useState(false);

  /** Bina oluştur (web Bina sekmesi / calculate_edge_measures ile aynı veri) */
  const [lastEdgeMeasureData, setLastEdgeMeasureData] = useState<EdgeMeasureData | null>(null);
  const [edgeDataParcelId, setEdgeDataParcelId] = useState<string | number | null>(null);
  const [edgeMeasureParcelKey, setEdgeMeasureParcelKey] = useState<string>("");
  const [buildingCreateSheetVisible, setBuildingCreateSheetVisible] = useState(false);
  const [buildingSheetTab, setBuildingSheetTab] = useState<BuildingSheetTab>("create");
  const [buildingSettings, setBuildingSettings] = useState<BuildingSettings>(() => defaultBuildingSettings());
  const [buildingExtrusionFeatures, setBuildingExtrusionFeatures] = useState<BuildingPolyFeature[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [buildingScaleSlider01, setBuildingScaleSlider01] = useState(0.5);
  const buildingScaleRingSnapshotRef = useRef<[number, number][] | null>(null);
  const [buildingExtrusionMapVisible, setBuildingExtrusionMapVisible] = useState(true);
  const [buildingEdgeLoading, setBuildingEdgeLoading] = useState(false);
  /** İşlemler menüsü kapanınca Bina sheet açılacak (onDismiss ile; zamanlayıcı yedek) */
  const openBuildingAfterMenuCloseRef = useRef(false);
  const buildingMenuFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (buildingMenuFallbackTimerRef.current) {
        clearTimeout(buildingMenuFallbackTimerRef.current);
        buildingMenuFallbackTimerRef.current = null;
      }
    };
  }, []);

  const mergedMeasurementForMap = useMemo(
    () => (showEdgeMeasurements ? [...measurementFeatures, ...edgeMeasurementFeatures] : measurementFeatures),
    [showEdgeMeasurements, measurementFeatures, edgeMeasurementFeatures]
  );

  const closeMeasurementDrawing = useCallback(() => {
    setMeasurementMode(null);
    setMeasurementPoints([]);
    setMeasurementFeatures((prev) => prev.filter((f) => !(f as any)?.properties?.isTemporary));
    setSelectedMeasurementGroupId(null);
  }, []);

  const handleCloseDrawingToolbox = useCallback(() => {
    setShapeDrawingMode(null);
    setShapeDrawingPoints([]);
    closeMeasurementDrawing();
  }, [closeMeasurementDrawing]);

  // Çizim sırasında "dokunulan noktaları" gösteren geçici preview layer (kare/yuvarlak/üçgen/ok dahil)
  const shapeDraftPreview = useMemo(() => {
    if (!shapeDrawingMode) return null;
    if (!shapeDrawingPoints || shapeDrawingPoints.length === 0) return null;

    const points = shapeDrawingPoints;

    const pointFeatures = points.map((p, idx) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p },
      properties: { kind: 'shapeDraftPoint', idx },
    }));

    const lineFeature =
      (shapeDrawingMode === 'line' || shapeDrawingMode === 'polygon') && points.length >= 2
        ? {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: points },
            properties: { kind: 'shapeDraftLine' },
          }
        : null;

    const polygonFeature =
      shapeDrawingMode === 'polygon' && points.length >= 3
        ? {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[...points, points[0]]],
            },
            properties: { kind: 'shapeDraftPolygon' },
          }
        : null;

    return {
      pointFeatures,
      lineFeature,
      polygonFeature,
    };
  }, [shapeDrawingMode, shapeDrawingPoints]);
  const [isLoadingParcel, setIsLoadingParcel] = useState(false);
  
  // Parsel seç state
  const [parcelSelectMode, setParcelSelectMode] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]); // Birden fazla parsel için
  const [parcelSelectModalVisible, setParcelSelectModalVisible] = useState(false);
  const [parcelSelectMethod, setParcelSelectMethod] = useState<'ada-parsel' | 'click'>('ada-parsel');

  // Model state (native ModelLayer)
  const [modelState, modelActions] = useModelManager();
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadingText, setModelLoadingText] = useState<string>("Model yükleniyor...");
  const [modelLoadingProgress, setModelLoadingProgress] = useState<number | null>(null);
  /** İndirme bittikten sonra: yeni yerleştirilen model haritada çizilene kadar (onMapIdle ile kapanır) */
  const [modelMapRenderLoading, setModelMapRenderLoading] = useState(false);
  const [modelCatalogRefreshKey, setModelCatalogRefreshKey] = useState(0);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [purchaseModel, setPurchaseModel] = useState<ModelCatalogFlatItem | null>(null);
  const {
    modelCatalogFlat,
    isModelCatalogLoading,
    modelCatalogError,
    modelsProp,
  } = useModelCatalog(visible, modelCatalogRefreshKey);

  /**
   * Boyut limiti (HEAD Content-Length) için kaynak URL.
   * Katalog `source` alanı Django /static altındaki orijinal GLB olabilir (MB düzeyinde).
   */
  const getModelSourceForSizeLimit = useCallback(
    (modelId: string): string | undefined => {
      const catalogItem = modelCatalogFlat.find(
        (m) => String(m.id) === modelId || m.modelId === modelId
      );
      if (catalogItem?.source) return catalogItem.source;
      const num = parseInt(modelId, 10);
      if (Number.isFinite(num) && num > 0) {
        return `https://pp-local/models/model_${num}.glb`;
      }
      return undefined;
    },
    [modelCatalogFlat]
  );

  // Mapbox.Models'a sadece kullanılan modelleri ver (key = tablo id string, örn. "20")
  const modelsPropUsed = useMemo(() => {
    const used: Record<string, string | number> = {};
    const ids = new Set<string>();
    for (const inst of modelState.instances) ids.add(inst.modelId);
    if (modelState.placingModelId) ids.add(modelState.placingModelId);
    for (const idStr of ids) {
      const catalogItem = modelCatalogFlat.find((m) => m.id != null && String(m.id) === idStr);
      // Öncelik: API katalog `source` (sunucudaki gerçek path). PAD/APK içindeki model_<id>.glb bazen yanlış dosyayla paketlenince
      // (ör. ev seçilince çam görünür) pp-local yanlış mesh yükler; HTTPS source satırla birebir aynı GLB olur.
      if (catalogItem?.source) {
        used[idStr] = catalogItem.source;
        continue;
      }
      if (modelsProp[idStr]) {
        used[idStr] = modelsProp[idStr];
      } else {
        const num = parseInt(idStr, 10);
        if (Number.isFinite(num) && num > 0) {
          used[idStr] = `https://pp-local/models/model_${num}.glb`;
        }
      }
    }
    return used;
  }, [modelCatalogFlat, modelsProp, modelState.instances, modelState.placingModelId]);

  // Usage count management
  const {
    modelUsageMap,
    updateModelUsage,
    getRemainingUses,
    isModelUsableById,
    initializeUsageMap,
  } = useModelUsage();

  // Initialize usage map from model catalog when it loads
  useEffect(() => {
    if (modelCatalogFlat.length > 0) {
      initializeUsageMap(modelCatalogFlat);
    }
  }, [modelCatalogFlat, initializeUsageMap]);

  // stringId = tablo id (string, örn. "20"). Sayıya çevir veya katalogdan bul.
  const getModelIdFromStringId = useCallback((stringId: string): number | undefined => {
    const num = parseInt(stringId, 10);
    if (Number.isFinite(num)) return num;
    const model = modelCatalogFlat.find((m) => m.id != null && String(m.id) === stringId);
    return model?.id;
  }, [modelCatalogFlat]);

  // modelId = tablo id string (örn. "20"). Kategoriye göre scale; farm_house vb. için ek küçültme.
  const getScaleForModelId = useCallback((modelId: string): [number, number, number] => {
    const item = modelCatalogFlat.find((m) => m.id != null && String(m.id) === modelId);
    const base = item?.groupId ? CATEGORY_SCALE[item.groupId] ?? [1, 1, 1] : [1, 1, 1];
    const mult = item ? getDefaultScaleMultiplierForCatalogItem(item) : 1;
    return [base[0] * mult, base[1] * mult, base[2] * mult];
  }, [modelCatalogFlat]);

  const getTranslationForModelId = useCallback(
    (modelId: string): [number, number, number] => {
      const item = modelCatalogFlat.find((m) => m.id != null && String(m.id) === modelId);
      return getTranslationForCatalogItem(item);
    },
    [modelCatalogFlat]
  );

  const handleRequestModelPurchase = useCallback((m: ModelCatalogFlatItem) => {
    if (m.id == null) return;
    setPurchaseModel(m);
    setPurchaseModalVisible(true);
  }, []);

  // Haritada zaten olan instance'ların modellerini arka planda indir (cache'e al).
  useEffect(() => {
    if (!visible || modelState.instances.length === 0) return;
    const uniqueRowIds = new Set<number>();
    for (const inst of modelState.instances) {
      const rowId = getModelIdFromStringId(inst.modelId);
      if (rowId !== undefined && Number.isFinite(rowId) && rowId > 0) uniqueRowIds.add(rowId);
    }
    if (__DEV__ && uniqueRowIds.size > 0) {
      console.log(`[ShapeDrawingModal] Pre-fetch: haritadaki modeller için indirme (id'ler: ${[...uniqueRowIds].join(", ")})`);
    }
    uniqueRowIds.forEach((rowId) => {
      const remoteUrl = getModelSourceByRowId(modelCatalogFlat, rowId);
      if (!remoteUrl) return;
      ensureModelAvailable(rowId, { timeoutMs: 300_000, remoteUrl })
        .then((r) => {
          if (__DEV__) {
            if (r.ok) console.log(`[ShapeDrawingModal] Pre-fetch model_${rowId}: VAR – çizilebilir`);
            else console.warn(`[ShapeDrawingModal] Pre-fetch model_${rowId}: YOK – ${r.lastState?.statusName ?? "zaman aşımı"}`);
          }
        })
        .catch((err) => {
          if (__DEV__) console.warn(`[ShapeDrawingModal] Pre-fetch model_${rowId}: HATA –`, err?.message || err);
        });
    });
  }, [visible, modelState.instances, modelCatalogFlat, getModelIdFromStringId]);

  // Yerleştirme moduna alınan modeli tap'ten önce hazırla (sunucudan cache'e indir).
  useEffect(() => {
    if (!visible || !modelState.placingModelId || modelCatalogFlat.length === 0) return;
    const rowId = getModelIdFromStringId(modelState.placingModelId);
    if (rowId === undefined || rowId <= 0) return;
    const remoteUrl = getModelSourceByRowId(modelCatalogFlat, rowId);
    if (!remoteUrl) return;
    if (__DEV__) console.log(`[ShapeDrawingModal] Yerleştirme: model_${rowId} için model hazırlığı`);
    ensureModelAvailable(rowId, { timeoutMs: 300_000, remoteUrl })
      .then((r) => {
        if (__DEV__) {
          if (r.ok) console.log(`[ShapeDrawingModal] Yerleştirme model_${rowId}: VAR – haritaya tıklanınca çizilebilir`);
          else console.warn(`[ShapeDrawingModal] Yerleştirme model_${rowId}: YOK – ${r.lastState?.statusName ?? "dosya yok"}`);
        }
      })
      .catch((err) => {
        if (__DEV__) console.warn(`[ShapeDrawingModal] Yerleştirme model_${rowId}: HATA –`, err?.message || err);
      });
  }, [visible, modelState.placingModelId, modelCatalogFlat, getModelIdFromStringId]);

  // Handler for before adding model (decrement usage)
  const onBeforeAddModel = useCallback(async (modelId: number): Promise<{ success: boolean; remainingUses: number | null }> => {
    try {
      // role=free => kullanım decrement yapılmaz ve her zaman kullanılabilir kabul edilir
      const meta = modelCatalogFlat.find((m) => m.id === modelId);
      if (isFreeRole(meta?.role)) {
        updateModelUsage(modelId, null);
        return { success: true, remainingUses: null };
      }

      // Optimistic update: decrease usage count immediately
      const currentUses = getRemainingUses(modelId);
      if (currentUses !== null && currentUses > 0) {
        updateModelUsage(modelId, currentUses - 1);
      }

      // Call API to decrement usage
      const result = await decrementModelUsage(modelId);
      
      if (result.success) {
        // Update with server response
        updateModelUsage(modelId, result.remaining_uses);
        return { success: true, remainingUses: result.remaining_uses };
      } else {
        // Rollback optimistic update on failure
        updateModelUsage(modelId, currentUses);
        return { success: false, remainingUses: currentUses };
      }
    } catch (error) {
      // Rollback optimistic update on error
      const currentUses = getRemainingUses(modelId);
      updateModelUsage(modelId, currentUses);
      throw error;
    }
  }, [getRemainingUses, updateModelUsage, modelCatalogFlat]);

  const clearModelPlacementMode = useCallback(() => {
    // Model seçimi aktifken başka bir araç seçilirse model yerleştirme modu kapanmalı
    modelActions.setPlacingModelId(null);
  }, [modelActions]);

  // Model boyut limiti kontrolü (500KB) - eklemeden önce çağrılır
  const onCheckModelSizeLimit = useCallback(
    async (instances: Array<{ modelId: string }>, newModelId: string) => {
      const result = await checkTotalModelSize(
        instances,
        modelCatalogFlat,
        newModelId,
        getModelSourceForSizeLimit
      );
      return { allowed: result.allowed, message: result.message };
    },
    [modelCatalogFlat, getModelSourceForSizeLimit]
  );

  // Her eklenen modelde dinamik güncellenen toplam boyut (instances veya yerleştirme modunda)
  const [totalModelSize, setTotalModelSize] = useState<{ totalKb: number; limitKb: number } | null>(null);
  useEffect(() => {
    const hasInstances = modelState.instances.length > 0;
    const hasPlacing = !!modelState.placingModelId;
    if ((!hasInstances && !hasPlacing) || modelCatalogFlat.length === 0) {
      setTotalModelSize(null);
      return;
    }
    let cancelled = false;
    getTotalModelSizeForDisplay(
      modelState.instances,
      modelCatalogFlat,
      getModelSourceForSizeLimit,
      modelState.placingModelId
    ).then((r) => {
      if (!cancelled) {
        setTotalModelSize({ totalKb: Math.round(r.totalBytes / 1024), limitKb: Math.round(r.limitBytes / 1024) });
      }
    });
    return () => { cancelled = true; };
  }, [modelState.placingModelId, modelState.instances, modelCatalogFlat, getModelSourceForSizeLimit]);

  const router = useRouter();
  const handleHisseliParsellereBol = useCallback(() => {
    if (!selectedParcel?.geometry) return;
    setMapToolsSheetOpen(false);
    setMainActionMenuOpen(false);
    onClose();
    const props = selectedParcel.properties || {};
    const mahalle = props.mahalleAd ?? props.mahalle ?? "";
    const ada = props.adaNo ?? props.ada ?? "";
    const parsel = props.parselNo ?? props.parsel ?? "";
    router.push({
      pathname: "parcel-split",
      params: {
        parentPolygon: JSON.stringify(selectedParcel.geometry),
        parcelId: selectedParcel.id != null ? String(selectedParcel.id) : undefined,
        mahalle,
        ada,
        parsel,
      },
    });
  }, [selectedParcel, onClose, router]);

  const onSelectModel = useModelSelectHandler({
    placingModelId: modelState.placingModelId,
    setPlacingModelId: modelActions.setPlacingModelId,
    setModelsDropdownOpen,
    setShapeDrawingMode,
    setMeasurementMode,
    setParcelSelectMode,
    setIsModelLoading,
    setModelLoadingText,
    setModelLoadingProgress,
    formatModelDisplayName,
    getRemainingUses,
  });

  /** İlk karede state henüz dolmadan haritada parsel çizimi (initialParcel ile açılış) */
  const fallbackParcelRow = useMemo(() => buildModalParcelRow(initialParcel), [initialParcel]);
  const effectiveParcels = useMemo(() => {
    if (parcels.length > 0) return parcels;
    if (visible && fallbackParcelRow) return [fallbackParcelRow];
    return parcels;
  }, [parcels, visible, fallbackParcelRow]);

  const requestEdgeMeasureData = useCallback(
    async (opts?: { showOnMap?: boolean }): Promise<EdgeMeasureData | null> => {
      const parcelForEdges =
        selectedParcel?.geometry ? selectedParcel : effectiveParcels.length === 1 ? effectiveParcels[0] : null;
      if (!parcelForEdges || !parcelForEdges.geometry) {
        Alert.alert('Bilgi', 'Önce bir parsel seçin.');
        return null;
      }

      let djangoBackendUrl = API_URL;
      if (djangoBackendUrl.includes(':7001')) {
        djangoBackendUrl = djangoBackendUrl.replace(':7001', ':7000');
      }
      djangoBackendUrl = djangoBackendUrl.replace('/api', '').replace(/\/$/, '');

      try {
        const coordinates =
          parcelForEdges.geometry.type === 'Polygon'
            ? parcelForEdges.geometry.coordinates[0]
            : parcelForEdges.geometry.coordinates;

        if (!coordinates || coordinates.length < 3) {
          Alert.alert('Hata', 'Parsel koordinatları geçersiz.');
          return null;
        }

        const requestBody = {
          coordinates: coordinates,
          mahalle: parcelForEdges.properties?.mahalleAd || parcelForEdges.properties?.mahalle,
          ada: parcelForEdges.properties?.adaNo || parcelForEdges.properties?.ada,
          parsel: parcelForEdges.properties?.parselNo || parcelForEdges.properties?.parsel,
        };

        const response = await fetch(`${djangoBackendUrl}/api/calculate_edge_measures/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error('Kenar ölçüleri hesaplanamadı');
        }

        const data = await response.json();

        if (data.success && data.edge_measure_data) {
          const em = data.edge_measure_data as EdgeMeasureData;
          setLastEdgeMeasureData(em);
          setEdgeDataParcelId(parcelForEdges.id ?? null);
          setEdgeMeasureParcelKey(parcelEdgeContextKey(parcelForEdges));
          if (opts?.showOnMap !== false) {
            const features = createEdgeMeasurementFeatures(parcelForEdges.geometry, em);
            setEdgeMeasurementFeatures(features);
            setShowEdgeMeasurements(true);
            setMapToolsSheetOpen(false);
            setMainActionMenuOpen(false);
          }
          return em;
        }
        Alert.alert('Hata', 'Kenar ölçüleri hesaplanamadı.');
        return null;
      } catch (error) {
        console.error('[requestEdgeMeasureData] API hatası:', error);
        Alert.alert(
          'Bağlantı Hatası',
          'Backend sunucusuna bağlanılamadı. Lütfen Django (7000) sunucusunun çalıştığından emin olun.',
          [{ text: 'Tamam' }]
        );
        return null;
      }
    },
    [selectedParcel, effectiveParcels]
  );

  const fetchEdgeMeasures = useCallback(async () => {
    await requestEdgeMeasureData({ showOnMap: true });
  }, [requestEdgeMeasureData]);

  /** Bina bottom sheet: parsel için kenar ölçüsü (haritada bbox çizgisi açmadan) */
  useEffect(() => {
    if (!buildingCreateSheetVisible) return;
    const parcelForEdges =
      selectedParcel?.geometry ? selectedParcel : effectiveParcels.length === 1 ? effectiveParcels[0] : null;
    if (!parcelForEdges?.geometry) return;
    const pid = parcelForEdges.id ?? null;
    const pk = parcelEdgeContextKey(parcelForEdges);
    if (
      lastEdgeMeasureData &&
      edgeDataParcelId != null &&
      pid != null &&
      String(edgeDataParcelId) === String(pid)
    ) {
      return;
    }
    if (lastEdgeMeasureData && edgeMeasureParcelKey && pk && edgeMeasureParcelKey === pk) {
      return;
    }
    setBuildingEdgeLoading(true);
    requestEdgeMeasureData({ showOnMap: false })
      .catch(() => {})
      .finally(() => setBuildingEdgeLoading(false));
  }, [
    buildingCreateSheetVisible,
    selectedParcel?.id,
    effectiveParcels,
    lastEdgeMeasureData,
    edgeDataParcelId,
    edgeMeasureParcelKey,
    requestEdgeMeasureData,
  ]);

  // Seçili parselin çizimi her zaman en üstte kalsın (layer order)
  const orderedParcels = useMemo(() => {
    const selectedId = selectedParcel?.id;
    if (!selectedId) return effectiveParcels;
    const selected = effectiveParcels.find((p) => p?.id === selectedId);
    if (!selected) return effectiveParcels;
    const rest = effectiveParcels.filter((p) => p?.id !== selectedId);
    return [...rest, selected];
  }, [effectiveParcels, selectedParcel?.id]);

  const mapSelectedParcelId = useMemo(() => {
    if (selectedParcel?.id != null) return selectedParcel.id;
    if (effectiveParcels.length === 1 && effectiveParcels[0]?.id != null) return effectiveParcels[0].id;
    return null;
  }, [selectedParcel?.id, effectiveParcels]);
  
  // Map refs
  const mapRef = useRef<any>(null);
  const mapReadyRef = useRef({ didFinishLoadingMap: false, didFinishLoadingStyle: false, isIdle: false });
  const modelMapIdleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelIdleWaitRef = useRef(false);
  const prevInstancesLenRef = useRef<number | null>(null);
  const captureComposeRef = useRef<any>(null);

  const clearModelMapIdleDebounce = useCallback(() => {
    if (modelMapIdleDebounceRef.current) {
      clearTimeout(modelMapIdleDebounceRef.current);
      modelMapIdleDebounceRef.current = null;
    }
  }, []);

  const handleMapIdleForModel = useCallback(() => {
    if (!modelIdleWaitRef.current) return;
    clearModelMapIdleDebounce();
    modelMapIdleDebounceRef.current = setTimeout(() => {
      modelMapIdleDebounceRef.current = null;
      modelIdleWaitRef.current = false;
      setModelMapRenderLoading(false);
    }, 420);
  }, [clearModelMapIdleDebounce]);

  useEffect(() => {
    return () => {
      clearModelMapIdleDebounce();
    };
  }, [clearModelMapIdleDebounce]);

  useEffect(() => {
    const n = modelState.instances.length;
    if (prevInstancesLenRef.current === null) {
      prevInstancesLenRef.current = n;
      return;
    }
    if (n > prevInstancesLenRef.current) {
      modelIdleWaitRef.current = true;
      setModelMapRenderLoading(true);
    }
    prevInstancesLenRef.current = n;
  }, [modelState.instances.length]);

  useEffect(() => {
    if (!modelMapRenderLoading || !modelIdleWaitRef.current) return;
    const maxWait = setTimeout(() => {
      if (!modelIdleWaitRef.current) return;
      modelIdleWaitRef.current = false;
      setModelMapRenderLoading(false);
    }, 8000);
    return () => clearTimeout(maxWait);
  }, [modelMapRenderLoading]);
  const {
    cameraRef,
    camRef,
    cameraZoom,
    cameraCenter,
    cameraHeading,
    pitchValue,
    setPitchValue,
    setCameraZoom,
    setCameraCenter,
    setCameraHeading,
    onCameraChanged,
    apply3DView,
    easeZoomOutForModelSelection,
    startZoomChange,
    stopZoomChange,
    startHeadingChange,
    stopHeadingChange,
    startPitchChange,
    stopPitchChange,
  } = useMapCameraControls({ center, zoom, initialPitch: 0 });

  useEffect(() => {
    if (visible && mapMountReady) bumpTextBoxLayout();
  }, [visible, mapMountReady, bumpTextBoxLayout]);

  useEffect(() => {
    if (shapes.some((s) => s.type === "textbox")) bumpTextBoxLayout();
  }, [shapes, bumpTextBoxLayout]);

  const handleMapCameraChanged = useCallback(
    (e: any) => {
      onCameraChanged(e);
      bumpTextBoxLayout();
    },
    [onCameraChanged, bumpTextBoxLayout]
  );

  const handleMapIdleWithTextBoxLayout = useCallback(() => {
    bumpTextBoxLayout();
    handleMapIdleForModel();
  }, [bumpTextBoxLayout, handleMapIdleForModel]);

  // Pitch 35+ olduğunda Terrain aç (Kontroller dışında pitch butonu ile de 3D'ye geçilebilir)
  useEffect(() => {
    if (pitchValue >= 35) setTerrainEnabled(true);
  }, [pitchValue]);

  // allowUpdates=false olduğu için ilk kamerayı bir kez imperative setCamera ile ver (açılınca sıçrama önlenir)
  const hasInitialCameraSetRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      hasInitialCameraSetRef.current = false;
      return;
    }
    if (!mapMountReady) return;
    if (hasInitialCameraSetRef.current) return;
    const t = setTimeout(() => {
      if (hasInitialCameraSetRef.current) return;
      if (!cameraRef?.current?.setCamera) return;
      hasInitialCameraSetRef.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: center,
        zoomLevel: zoom,
        pitch: 0,
        heading: 20,
        animationDuration: 0,
      });
    }, 80);
    return () => clearTimeout(t);
  }, [visible, mapMountReady, center, zoom]);

  // Model focus hook
  const { focusOnAllModels, focusOnModel } = useModelFocus({
    cameraRef,
    setPitchValue,
    setCameraZoom,
    setCameraCenter,
    setCameraHeading,
  });

  // Modal açıldığında capture listesini yükle
  useEffect(() => {
    if (visible) {
      loadCaptures().then((items) => {
        setCaptureItems(items);
        console.log("[ShapeDrawingModal:CAPTURE] loadCaptures:", items.length);
      });
    }
  }, [visible]);

  // Modal açıldığında state'leri sıfırla (sadece ilk açılışta)
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    // Sadece visible false -> true geçişinde state'leri sıfırla
    if (visible && !prevVisibleRef.current) {
      setShapeDrawingMode(null);
      setShapeDrawingPoints([]);
      setMeasurementMode(null);
      setMeasurementPoints([]);
      setMeasurementFeatures([]);
      setSelectedMeasurementGroupId(null);
      setMapToolsSheetOpen(false);
      setModelsDropdownOpen(false);
      setCameraMenuOpen(false);
      setMainActionMenuOpen(false);
      setParcelSelectMode(false);
      // Yeni açılışta parsel listesini temizle; initialParcel varsa onu otomatik seç.
      setParcels([]);
      const p0 = buildModalParcelRow(initialParcel);
      if (p0) {
        setParcels([p0]);
        setSelectedParcel(p0);
      } else {
        setSelectedParcel(null);
      }
      setShapeEditPanelVisible(false);
      setMeasurementEditPanelVisible(false);
      setMeasurementEditPanelMinimized(true);
      setSelectedShapeId(null);
      setNavControlsVisible(false);
      setTerrainEnabled(false);
      // Şekilleri koru (kullanıcı isterse temizleyebilir)
      modelActions.setPlacingModelId(null);
    }
    prevVisibleRef.current = visible;
  }, [visible, modelActions, initialParcel]);

  const drawOptionsMemo = useMemo(
    () => ({
      outlineColor: drawOutlineColor,
      fillColor: drawFillColor,
      outlineWidth: drawOutlineWidth,
      fillOpacity: 0.45 as const,
    }),
    [drawOutlineColor, drawFillColor, drawOutlineWidth],
  );

  const { handleShapeDrawingPress, openTextBoxEditor, finalizePolygonOrLine } = useShapeDrawingHandlers({
    shapeDrawingMode,
    shapeDrawingPoints,
    setShapeDrawingPoints,
    setShapeDrawingMode,
    shapes,
    setShapes,
    setTextBoxEditVisible,
    setTextBoxEditShapeId,
    setTextBoxEditInitialText,
    drawOptions: drawOptionsMemo,
  });

  const { handleMeasurementPress, finalizeAreaMeasurement, finishPendingMeasurement } = useMeasurementHandlers({
    measurementMode,
    measurementPoints,
    setMeasurementPoints,
    setMeasurementFeatures,
    setMeasurementMode,
    rulerColor: measureRulerColor,
    areaColor: measureAreaColor,
  });

  const handleMapLongPress = useCallback(
    async (e: any) => {
      if (resizeMode || rotationMode) {
        setResizeMode(null);
        setRotationMode(null);
        return;
      }

      let c: [number, number] | null =
        e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
      const normalized = c ? normalizeLngLat(c) : null;

      if (normalized && mergedMeasurementForMap.length > 0) {
        const del = await tryHitMeasurementForDelete(mapRef, normalized, mergedMeasurementForMap);
        if (del?.type === "edge") {
          Alert.alert(
            "Kenar ölçümleri",
            "Tüm kenar ölçümlerini kaldırmak istiyor musunuz?",
            [
              { text: "İptal", style: "cancel" },
              {
                text: "Kaldır",
                style: "destructive",
                onPress: () => {
                  setEdgeMeasurementFeatures([]);
                  setShowEdgeMeasurements(false);
                },
              },
            ]
          );
          return;
        }
        if (del?.type === "group") {
          const gid = del.groupId;
          Alert.alert("Ölçümü sil", "Bu ölçüm grubunu haritadan kaldırmak istiyor musunuz?", [
            { text: "İptal", style: "cancel" },
            {
              text: "Sil",
              style: "destructive",
              onPress: () => {
                setMeasurementFeatures((prev) =>
                  prev.filter((f) => (f as any)?.properties?.measurementGroupId !== gid)
                );
                setSelectedMeasurementGroupId((prev) => (prev === gid ? null : prev));
              },
            },
          ]);
          return;
        }
      }

      if (finalizeAreaMeasurement()) return;

      if (
        normalized &&
        !parcelSelectMode &&
        !modelState.placingModelId &&
        (modelState.instances?.length ?? 0) > 0
      ) {
        const id = await trySelectModelInstanceAtLngLat(mapRef, normalized);
        if (id) {
          modelActions.setSelectedModelId(id);
          setSelectedBuildingId(null);
          setSelectedMeasurementGroupId(null);
          easeZoomOutForModelSelection(normalized);
          return;
        }
      }

      if (
        normalized &&
        !parcelSelectMode &&
        !modelState.placingModelId &&
        buildingExtrusionFeatures.length > 0
      ) {
        const bid = await trySelectBuildingAtLngLat(mapRef, normalized);
        if (bid) {
          setSelectedBuildingId(bid);
          modelActions.setSelectedModelId(null);
          setSelectedMeasurementGroupId(null);
          easeZoomOutForModelSelection(normalized);
          return;
        }
      }

      if (shapeDrawingMode === "polygon" && shapeDrawingPoints.length >= 3) {
        finalizePolygonOrLine("polygon");
      } else if (shapeDrawingMode === "line" && shapeDrawingPoints.length >= 2) {
        finalizePolygonOrLine("line");
      }
    },
    [
      finalizeAreaMeasurement,
      finalizePolygonOrLine,
      shapeDrawingMode,
      shapeDrawingPoints.length,
      resizeMode,
      rotationMode,
      parcelSelectMode,
      modelState.placingModelId,
      modelState.instances,
      modelActions,
      mergedMeasurementForMap,
      easeZoomOutForModelSelection,
      buildingExtrusionFeatures,
    ]
  );

  // Parsel seç handler
  const handleParcelSelect = useParcelSelectHandler({
    parcelSelectMode,
    setIsLoadingParcel,
    setParcels,
    setSelectedParcel,
    apiUrl: API_URL,
    fallbackApiUrl: FALLBACK_API_URL,
  });

  const shapeSheetMinimizedDrag = useMemo(
    () =>
      shapeEditPanelVisible &&
      shapeEditPanelMinimized &&
      Boolean(selectedShapeId) &&
      !captureMode,
    [shapeEditPanelVisible, shapeEditPanelMinimized, selectedShapeId, captureMode]
  );

  const { handleHandlePress, handleHandleDrag, dragPanResponder } = useShapeEditGestures({
    mapRef,
    shapes,
    setShapes,
    resizeMode,
    setResizeMode,
    rotationMode,
    setRotationMode,
    moveMode,
    setMoveMode,
    sheetMinimizedDragEnabled: shapeSheetMinimizedDrag,
    selectedShapeId,
  });

  const clearShapeSelection = useCallback(() => {
    setSelectedShapeId(null);
    setShapeEditPanelVisible(false);
    setShapeEditPanelMinimized(true);
    setResizeMode(null);
    setRotationMode(null);
    setMoveMode(null);
  }, []);

  const handleDeleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) return;
    setShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
    clearShapeSelection();
  }, [selectedShapeId, clearShapeSelection]);

  const freehandActive = shapeDrawingMode === "pen" || shapeDrawingMode === "freehand";

  const handleToolboxClose = useCallback(() => {
    if (selectedShapeId && !shapeDrawingMode && !measurementMode) {
      clearShapeSelection();
      return;
    }
    handleCloseDrawingToolbox();
  }, [selectedShapeId, shapeDrawingMode, measurementMode, clearShapeSelection, handleCloseDrawingToolbox]);

  const handleFreehandCommitMap = useCallback(
    (coords: [number, number][]) => {
      const mode = shapeDrawingMode;
      if (mode !== "pen" && mode !== "freehand") return;
      const shape = createPenFreehandShape(
        coords,
        mode,
        { outlineColor: drawOutlineColor, outlineWidth: drawOutlineWidth },
        false
      );
      setShapes((prev) => [...prev, shape]);
      setShapeDrawingPoints([]);
    },
    [shapeDrawingMode, drawOutlineColor, drawOutlineWidth, setShapeDrawingPoints]
  );

  const handleFreehandCommitScreen = useCallback(
    (norm: [number, number][]) => {
      const mode = shapeDrawingMode;
      if (mode !== "pen" && mode !== "freehand") return;
      const shape = createPenFreehandShape(
        norm,
        mode,
        { outlineColor: drawOutlineColor, outlineWidth: drawOutlineWidth },
        true
      );
      setShapes((prev) => [...prev, shape]);
      setShapeDrawingPoints([]);
    },
    [shapeDrawingMode, drawOutlineColor, drawOutlineWidth, setShapeDrawingPoints]
  );

  const handleFinishActiveDrawing = useCallback(() => {
    const mode = shapeDrawingMode;
    if (mode === "polygon") {
      if (shapeDrawingPoints.length >= 3) {
        finalizePolygonOrLine("polygon");
      } else {
        setShapeDrawingPoints([]);
      }
    } else if (mode === "line") {
      if (shapeDrawingPoints.length >= 2) {
        finalizePolygonOrLine("line");
      } else {
        setShapeDrawingPoints([]);
      }
    } else {
      setShapeDrawingPoints([]);
    }
    setShapeDrawingMode(null);
  }, [shapeDrawingMode, shapeDrawingPoints.length, finalizePolygonOrLine]);

  const shapeTapDedupeRef = useRef<{ id: string; at: number } | null>(null);

  const handleShapeTap = useCallback(
    (shapeId: string) => {
      const now = Date.now();
      if (
        shapeTapDedupeRef.current?.id === shapeId &&
        now - shapeTapDedupeRef.current.at < 400
      ) {
        return;
      }
      shapeTapDedupeRef.current = { id: shapeId, at: now };

      if (measurementMode) return;
      setSelectedBuildingId(null);
      setSelectedMeasurementGroupId(null);
      modelActions.setSelectedModelId(null);
      if (resizeMode || rotationMode) {
        setResizeMode(null);
        setRotationMode(null);
        return;
      }
      if (selectedShapeId === shapeId) {
        clearShapeSelection();
        return;
      }
      const tapped = shapes.find((s) => s.id === shapeId);
      setSelectedShapeId(shapeId);
      setResizeMode(null);
      setRotationMode(null);
      setMoveMode(null);
      setShapeEditPanelVisible(true);
      setShapeEditPanelMinimized(tapped?.type !== "textbox");
      setMapToolsSheetOpen(false);
      setModelsDropdownOpen(false);
      setMainActionMenuOpen(false);
      setManagementPanelVisible(false);
    },
    [measurementMode, resizeMode, rotationMode, clearShapeSelection, selectedShapeId, shapes, modelActions]
  );

  const selectedInstance = useMemo(
    () =>
      modelState.selectedModelId
        ? modelState.instances.find((m) => m.id === modelState.selectedModelId) ?? null
        : null,
    [modelState.selectedModelId, modelState.instances]
  );

  const selectedCatalogItem = useMemo(() => {
    if (!selectedInstance?.modelId) return undefined;
    const mid = selectedInstance.modelId;
    return modelCatalogFlat.find((c) => c.modelId === mid || String(c.id) === String(mid));
  }, [selectedInstance, modelCatalogFlat]);

  const footprintAreaM2 = useMemo(() => {
    if (!selectedInstance || !selectedCatalogItem?.isYapi) return null;
    return computeFootprintAreaM2(selectedInstance, selectedCatalogItem);
  }, [selectedInstance, selectedCatalogItem]);

  const modelTransformBar = useModelTransformBar({
    selectedModelId: modelState.selectedModelId,
    selectedInstance,
    updateModelInstance: modelActions.updateModelInstance,
  });

  const handleModelDelete = useCallback(() => {
    if (!modelState.selectedModelId) return;
    modelActions.removeModelInstance(modelState.selectedModelId);
    modelActions.setSelectedModelId(null);
  }, [modelState.selectedModelId, modelActions]);

  const handleMeasurementGroupPress = useCallback(
    (groupId: string) => {
      setSelectedMeasurementGroupId((prev) => (prev === groupId ? null : groupId));
      setSelectedShapeId(null);
      setSelectedBuildingId(null);
      setShapeEditPanelVisible(false);
      setShapeEditPanelMinimized(true);
      modelActions.setSelectedModelId(null);
      setMapToolsSheetOpen(false);
      setModelsDropdownOpen(false);
      setMainActionMenuOpen(false);
      setManagementPanelVisible(false);
    },
    [modelActions]
  );

  const handleDeleteSelectedMeasurement = useCallback(() => {
    const gid = selectedMeasurementGroupId;
    if (!gid) return;
    Alert.alert(
      "Ölçümü sil",
      "Seçili mesafe veya alan ölçümünü haritadan kaldırmak istiyor musunuz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            setMeasurementFeatures((prev) =>
              prev.filter((f) => (f as any)?.properties?.measurementGroupId !== gid)
            );
            setSelectedMeasurementGroupId(null);
          },
        },
      ]
    );
  }, [selectedMeasurementGroupId]);

  useEffect(() => {
    if (selectedMeasurementGroupId) {
      setMeasurementEditPanelVisible(true);
      setMeasurementEditPanelMinimized(true);
    } else {
      setMeasurementEditPanelVisible(false);
      setMeasurementEditPanelMinimized(true);
    }
  }, [selectedMeasurementGroupId]);

  const handleMapPress = useMapPressHandler({
    shapeDrawingMode,
    measurementMode,
    parcelSelectMode,
    resizeMode,
    rotationMode,
    handleShapeDrawingPress,
    handleMeasurementPress,
    handleParcelSelect,
    handleHandleDrag,
    mapRef,
    placingModelId: modelState.placingModelId,
    instancesCount: modelState.instances?.length ?? 0,
    instances: modelState.instances ?? [],
    modelsProp: modelsPropUsed,
    modelActions,
    getScaleForModelId,
    getTranslationForModelId,
    getModelIdFromStringId,
    onBeforeAddModel,
    onCheckModelSizeLimit,
    selectedModelId: modelState.selectedModelId,
    updateModelInstance: modelActions.updateModelInstance,
    shapes,
    onShapePress: handleShapeTap,
  });

  // Kamera / Resim Kaydet: BottomSheet menü açar (Resim Çek | Resimler)
  const handleCameraPress = useCallback(() => {
    setMainActionMenuOpen(false);
    setManagementPanelVisible(false);
    setMeasurementEditPanelVisible(false);
    setMapToolsSheetOpen(false);
    setModelsDropdownOpen(false);
    setCameraMenuOpen(true);
  }, []);

  const openMapToolsSheet = useCallback(() => {
    setMainActionMenuOpen(false);
    setManagementPanelVisible(false);
    setShapeEditPanelVisible(false);
    setMeasurementEditPanelVisible(false);
    setSelectedShapeId(null);
    setShapeEditPanelMinimized(true);
    setMapToolsSheetOpen(true);
    setModelsDropdownOpen(false);
    setCameraMenuOpen(false);
  }, []);

  const openToolbarModelsSheet = useCallback(() => {
    setMainActionMenuOpen(false);
    setManagementPanelVisible(false);
    setShapeEditPanelVisible(false);
    setMeasurementEditPanelVisible(false);
    setSelectedShapeId(null);
    setShapeEditPanelMinimized(true);
    setModelsDropdownOpen(true);
    setMapToolsSheetOpen(false);
    setCameraMenuOpen(false);
  }, []);

  /** İşlemler bottom sheet kapanırken (onDismiss) veya yedek zamanlayıcı ile Bina sheet açılır */
  const handleCloseMainActionMenu = useCallback(() => {
    if (buildingMenuFallbackTimerRef.current) {
      clearTimeout(buildingMenuFallbackTimerRef.current);
      buildingMenuFallbackTimerRef.current = null;
    }
    setMainActionMenuOpen(false);
    if (openBuildingAfterMenuCloseRef.current) {
      openBuildingAfterMenuCloseRef.current = false;
      setBuildingCreateSheetVisible(true);
    }
  }, []);

  const openToolbarBuildingSheet = useCallback(() => {
    openBuildingAfterMenuCloseRef.current = true;
    setManagementPanelVisible(false);
    setShapeEditPanelVisible(false);
    setMeasurementEditPanelVisible(false);
    setSelectedShapeId(null);
    setShapeEditPanelMinimized(true);
    setMapToolsSheetOpen(false);
    setModelsDropdownOpen(false);
    setCameraMenuOpen(false);
    setMainActionMenuOpen(false);
    if (buildingMenuFallbackTimerRef.current) {
      clearTimeout(buildingMenuFallbackTimerRef.current);
    }
    buildingMenuFallbackTimerRef.current = setTimeout(() => {
      buildingMenuFallbackTimerRef.current = null;
      if (openBuildingAfterMenuCloseRef.current) {
        openBuildingAfterMenuCloseRef.current = false;
        setBuildingCreateSheetVisible(true);
      }
    }, 700);
  }, []);

  const buildingEdgeReady = useMemo(() => {
    const parcelForEdges =
      selectedParcel?.geometry ? selectedParcel : effectiveParcels.length === 1 ? effectiveParcels[0] : null;
    if (!lastEdgeMeasureData || !parcelForEdges?.geometry) return false;
    const pid = parcelForEdges.id ?? null;
    const pk = parcelEdgeContextKey(parcelForEdges);
    if (edgeDataParcelId != null && pid != null && String(edgeDataParcelId) === String(pid)) return true;
    if (edgeMeasureParcelKey && pk && edgeMeasureParcelKey === pk) return true;
    return false;
  }, [lastEdgeMeasureData, edgeDataParcelId, edgeMeasureParcelKey, selectedParcel, effectiveParcels]);

  /** Parsel geometrisi (kenar ölçüsü ile aynı bağlam — web drawInsetGuides için) */
  const parcelForBuildingGuide = useMemo(() => {
    return selectedParcel?.geometry ? selectedParcel : effectiveParcels.length === 1 ? effectiveParcels[0] : null;
  }, [selectedParcel, effectiveParcels]);

  /** Kılavuz (çekme sonrası max ölçüler) — sheet kapalıyken de hesaplanır */
  const buildingGuideLimits = useMemo(() => {
    if (!lastEdgeMeasureData || !buildingEdgeReady) return null;
    return getBuildingGuideLimits(lastEdgeMeasureData, buildingSettings);
  }, [lastEdgeMeasureData, buildingEdgeReady, buildingSettings]);

  const buildingSheetVisible = buildingCreateSheetVisible || !!selectedBuildingId;

  useLayoutEffect(() => {
    if (!buildingSheetVisible) return;
    if (buildingCreateSheetVisible) setBuildingSheetTab("create");
    else if (selectedBuildingId) setBuildingSheetTab("edit");
  }, [buildingSheetVisible, buildingCreateSheetVisible, selectedBuildingId]);

  /** Bina sheet: web ile aynı çekme kılavuz çizgileri (parsel buffer veya bbox fallback) — bina oluşturulduktan sonra da görünür */
  const buildingGuideFeature = useMemo((): Feature<LineString | MultiLineString> | null => {
    if (!lastEdgeMeasureData || !buildingEdgeReady) return null;
    return computeInsetGuideGeometry(lastEdgeMeasureData, buildingSettings, parcelForBuildingGuide?.geometry ?? null);
  }, [lastEdgeMeasureData, buildingEdgeReady, buildingSettings, parcelForBuildingGuide]);

  /** Oluştur sekmesi açıkken canlı taban önizlemesi */
  const liveBuildingFootprintResult = useMemo(() => {
    if (
      !buildingSheetVisible ||
      buildingSheetTab !== "create" ||
      !lastEdgeMeasureData ||
      !buildingEdgeReady
    ) {
      return null;
    }
    const r = computeBuildingFootprint(lastEdgeMeasureData, buildingSettings);
    return r.ok ? r : null;
  }, [buildingSheetVisible, buildingSheetTab, lastEdgeMeasureData, buildingEdgeReady, buildingSettings]);

  const buildingExtrusionFeaturesForMap = useMemo((): BuildingPolyFeature[] => {
    if (!liveBuildingFootprintResult) return buildingExtrusionFeatures;
    const r = liveBuildingFootprintResult;
    const rgb = hexToRgb("#64748b");
    const draft: BuildingPolyFeature = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [r.ring] },
      properties: {
        id: "building-draft-preview",
        height: Math.max(3, r.heightMeters * 0.35),
        opacity: Math.min(0.5, r.opacity01 * 0.55),
        cr: rgb.r,
        cg: rgb.g,
        cb: rgb.b,
      },
    };
    return [...buildingExtrusionFeatures, draft];
  }, [buildingExtrusionFeatures, liveBuildingFootprintResult]);

  const selectedBuildingOutlineRing = useMemo((): [number, number][] | null => {
    if (!selectedBuildingId) return null;
    const f = buildingExtrusionFeatures.find((x) => x.properties.id === selectedBuildingId);
    const c = f?.geometry?.coordinates?.[0];
    if (!c || c.length < 3) return null;
    return c.map(([lng, lat]) => [lng, lat] as [number, number]);
  }, [selectedBuildingId, buildingExtrusionFeatures]);

  const selectedBuildingAreaM2 = useMemo(() => {
    if (!selectedBuildingOutlineRing) return 0;
    return ringAreaM2Approx(selectedBuildingOutlineRing);
  }, [selectedBuildingOutlineRing]);

  const selectedBuildingColorHex = useMemo(() => {
    const f = buildingExtrusionFeatures.find((x) => x.properties.id === selectedBuildingId);
    const h = (f?.properties as { colorHex?: string })?.colorHex;
    if (typeof h === "string" && h.startsWith("#")) return h;
    return DEFAULT_BUILDING_HEX;
  }, [buildingExtrusionFeatures, selectedBuildingId]);

  useEffect(() => {
    if (selectedBuildingId) setBuildingScaleSlider01(0.5);
  }, [selectedBuildingId]);

  useEffect(() => {
    if (modelState.selectedModelId) setSelectedBuildingId(null);
  }, [modelState.selectedModelId]);

  const patchBuildingRing = useCallback((id: string, ring: [number, number][]) => {
    const closed =
      ring.length > 0 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring
        : [...ring, ring[0]];
    setBuildingExtrusionFeatures((prev) =>
      prev.map((f) => {
        if (f.properties.id !== id) return f;
        return {
          ...f,
          geometry: { ...f.geometry, coordinates: [closed] },
        };
      })
    );
  }, []);

  const patchBuildingColor = useCallback((id: string, hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    setBuildingExtrusionFeatures((prev) =>
      prev.map((f) =>
        f.properties.id === id
          ? {
              ...f,
              properties: {
                ...f.properties,
                cr: r,
                cg: g,
                cb: b,
                colorHex: hex,
              },
            }
          : f
      )
    );
  }, []);

  const buildingTransformBar = useBuildingTransformBar({
    selectedBuildingId,
    buildingFeatures: buildingExtrusionFeatures,
    patchBuildingRing,
  });

  const onBuildingScaleSlidingStart = useCallback(() => {
    const f = buildingExtrusionFeatures.find((x) => x.properties.id === selectedBuildingId);
    const c = f?.geometry?.coordinates?.[0];
    if (!c?.length) return;
    buildingScaleRingSnapshotRef.current = c.map(([lng, lat]) => [lng, lat] as [number, number]);
  }, [buildingExtrusionFeatures, selectedBuildingId]);

  const onBuildingScaleValueChange = useCallback(
    (t: number) => {
      setBuildingScaleSlider01(t);
      const snap = buildingScaleRingSnapshotRef.current;
      if (!snap || !selectedBuildingId) return;
      const factor = 0.5 * Math.pow(4, Math.max(0, Math.min(1, t)));
      patchBuildingRing(selectedBuildingId, scaleRingUniform(snap, factor));
    },
    [selectedBuildingId, patchBuildingRing]
  );

  const handleDeleteSelectedBuilding = useCallback(() => {
    if (!selectedBuildingId) return;
    setBuildingExtrusionFeatures((p) => p.filter((f) => f.properties.id !== selectedBuildingId));
    setSelectedBuildingId(null);
  }, [selectedBuildingId]);

  const patchBuildingProperties = useCallback((id: string, patch: Partial<BuildingPolyFeature["properties"]>) => {
    setBuildingExtrusionFeatures((prev) =>
      prev.map((f) => (f.properties.id === id ? { ...f, properties: { ...f.properties, ...patch } } : f))
    );
  }, []);

  const selectedBuildingFrameTemplate = useMemo(() => {
    const f = buildingExtrusionFeatures.find((x) => x.properties.id === selectedBuildingId);
    return f?.properties?.frameTemplate ?? "none";
  }, [buildingExtrusionFeatures, selectedBuildingId]);

  const selectedBuildingRoofTemplate = useMemo(() => {
    const f = buildingExtrusionFeatures.find((x) => x.properties.id === selectedBuildingId);
    return f?.properties?.roofTemplate ?? "flat_roof";
  }, [buildingExtrusionFeatures, selectedBuildingId]);

  const buildingWindowFramePolygons = useMemo((): FeatureCollection<import("geojson").Polygon> | null => {
    const feats: import("geojson").Feature<import("geojson").Polygon>[] = [];
    for (const f of buildingExtrusionFeatures) {
      const tmpl = f.properties.frameTemplate;
      if (!tmpl || tmpl === "none") continue;
      const ring = f.geometry.coordinates[0] as [number, number][];
      const fc = generateWindowFramePolygonsFeatureCollection(
        ring,
        f.properties.height,
        f.properties.floorHeightM ?? 3.2,
        f.properties.floorCount ?? 1,
        tmpl as BuildingFrameTemplateKey,
        {
          glassColor: f.properties.windowGlassColor ?? "#475569",
          borderColor: f.properties.windowBorderColor ?? "#0f172a",
        }
      );
      if (fc?.features?.length) feats.push(...fc.features);
    }
    return feats.length ? ({ type: "FeatureCollection" as const, features: feats }) : null;
  }, [buildingExtrusionFeatures]);

  const buildingRoofGeoJSON = useMemo(() => {
    const items = buildingExtrusionFeatures.map((f) => ({
      id: f.properties.id,
      ring: f.geometry.coordinates[0] as [number, number][],
      heightM: f.properties.height,
      roofTemplate: f.properties.roofTemplate,
    }));
    return mergeBuildingsRoofGeoJSON(items);
  }, [buildingExtrusionFeatures]);

  const handleCreateBuildingFromSheet = useCallback(() => {
    if (!lastEdgeMeasureData) {
      Alert.alert('Bilgi', 'Kenar ölçü verisi yok. Lütfen bekleyin veya yeniden deneyin.');
      return;
    }
    const result = computeBuildingFootprint(lastEdgeMeasureData, buildingSettings);
    if (!result.ok) {
      Alert.alert('Bina', result.reason);
      return;
    }
    const id = `building-${Date.now()}`;
    const ring = result.ring.map(([lng, lat]) => [lng, lat] as [number, number]);
    const rgb = hexToRgb(DEFAULT_BUILDING_HEX);
    const feature: BuildingPolyFeature = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        id,
        height: result.heightMeters,
        opacity: result.opacity01,
        cr: rgb.r,
        cg: rgb.g,
        cb: rgb.b,
        colorHex: DEFAULT_BUILDING_HEX,
        frameTemplate: buildingSettings.frameTemplate ?? "none",
        roofTemplate: buildingSettings.roofTemplate ?? "flat_roof",
        floorCount: buildingSettings.katSayisi,
        floorHeightM: buildingSettings.katYuksekligi,
        windowGlassColor: buildingSettings.windowGlassColor,
        windowBorderColor: buildingSettings.windowBorderColor,
        windowBorderThicknessM: buildingSettings.windowBorderThicknessM,
        windowCrossMullion: buildingSettings.windowCrossMullion,
      },
    };
    setBuildingExtrusionFeatures((prev) => [...prev, feature]);
    setSelectedBuildingId(id);
    modelActions.setSelectedModelId(null);
  }, [lastEdgeMeasureData, buildingSettings, modelActions]);

  const handleClearBuildingExtrusions = useCallback(() => {
    setBuildingExtrusionFeatures([]);
    setSelectedBuildingId(null);
  }, []);

  const handleRefreshBuildingEdgeData = useCallback(() => {
    setBuildingEdgeLoading(true);
    requestEdgeMeasureData({ showOnMap: false })
      .catch(() => {})
      .finally(() => setBuildingEdgeLoading(false));
  }, [requestEdgeMeasureData]);

  /** İşlemler menüsü → Bina Oluştur (bottom sheet) */
  const onMainMenuSelectBinaOlustur = useCallback(() => {
    openToolbarBuildingSheet();
  }, [openToolbarBuildingSheet]);

  // Resim Çek seçildiğinde
  const handleSelectResimCek = useCallback(() => {
    setCaptureMode(true);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShapeEditPanelVisible(false);
    setMeasurementEditPanelVisible(false);
    setSelectedShapeId(null);
    setCaptureSheetVisible(false);
  }, []);

  // Resimler seçildiğinde
  const handleSelectResimler = useCallback(() => {
    setCaptureSheetInitialIndex(1);
    setCaptureSheetVisible(true);
  }, []);

  // Capture Mode aç (doğrudan - hazırlık modundan)
  const handleOpenCamera = useCallback(() => {
    setCaptureMode(true);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setManagementPanelVisible(false);
    setMapToolsSheetOpen(false);
    setModelsDropdownOpen(false);
    setMainActionMenuOpen(false);
    setShapeEditPanelVisible(false);
    setMeasurementEditPanelVisible(false);
    setSelectedShapeId(null);
    setCaptureSheetVisible(false);
  }, []);

  // Capture işlemi (Hazırlık Modunda Çek butonu)
  const handleCapturePress = useCallback(async () => {
    if (!mapRef?.current || captureInProgress) return;
    setCaptureInProgress(true);
    mapReadyRef.current.isIdle = false;

    const dims = getModelEditorCaptureDimensions();

    let mapUri: string | null = null;
    let tmpFinalUri: string | null = null;

    try {
      if (!mapRef.current) {
        let retries = 0;
        while (!mapRef.current && retries < 20) {
          await new Promise((r) => setTimeout(r, 100));
          retries++;
        }
      }
      if (!mapRef.current) throw new Error("MapView ref bulunamadı");

      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 150));
      await waitForMapIdle(mapReadyRef, 5000);

      mapUri = await tryMapboxSnap(mapRef, { mapWidth: dims.mapWidth, mapHeight: dims.mapHeight });
      if (!mapUri) throw new Error("Mapbox snapshot başarısız");

      setCapturedMapUri(mapUri);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 200));

      let retries = 0;
      while (!captureComposeRef.current?.capture && retries < 30) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
      if (!captureComposeRef.current?.capture) throw new Error("CaptureComposeContainer ref hazır değil");

      tmpFinalUri = await captureComposeRef.current.capture({ format: "jpg", quality: 0.9, result: "tmpfile" });
      if (!tmpFinalUri) throw new Error("ViewShot capture başarısız");

      const savedFileUri = await saveTmpToGallery(tmpFinalUri);
      const newItem: CaptureItem = {
        id: `capture_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        fileUri: savedFileUri,
        createdAt: Date.now(),
        width: dims.mapWidth,
        height: dims.mapHeight,
        context: { screen: "ShapeDrawingModal" },
      };

      const nextItems = [newItem, ...captureItems];
      const trimmed = await enforceMaxCaptures(nextItems);
      setCaptureItems(trimmed);
      await       persistCaptures(trimmed);
      setCaptureSheetVisible(true);
      console.log("[ShapeDrawingModal:CAPTURE] Başarılı:", newItem.id);
    } catch (e) {
      console.error("[ShapeDrawingModal:CAPTURE] Hata:", e);
      Alert.alert("Hata", "Ekran görüntüsü alınamadı.");
    } finally {
      setCapturedMapUri(null);
      setCaptureInProgress(false);
      if (mapUri) await cleanupTempFiles([mapUri]);
      if (tmpFinalUri) await cleanupTempFiles([tmpFinalUri]);
    }
  }, [captureInProgress, captureItems, shapes]);

  // Seçim modu toggle
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (!prev) return true;
      setSelectedIds(new Set());
      return false;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(captureItems.map((x) => x.id)));
  }, [captureItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSaveSelected = useCallback(async () => {
    const uris = captureItems.filter((x) => selectedIds.has(x.id)).map((x) => x.fileUri);
    if (uris.length === 0) {
      Alert.alert("Uyarı", "Kaydedilecek görsel seçin.");
      return;
    }

    const isAdmin = String((user as any)?.role || "").toLowerCase() === "admin";
    if (!isAdmin) {
      if (!isAuthenticated) {
        Alert.alert(
          "Giriş Gerekli",
          "Kaydetmek için giriş yapmanız gerekiyor.",
          [
            { text: "İptal", style: "cancel" },
            { text: "Giriş Yap", onPress: () => router.push("login") },
          ]
        );
        return;
      }

      const baseParcel = selectedParcel || (parcels?.length === 1 ? parcels[0] : null);
      const props = (baseParcel?.properties || {}) as any;
      const mahalle = String(props.mahalleAd ?? props.mahalle ?? "").trim();
      const ada = String(props.adaNo ?? props.ada ?? "").trim();
      const parsel = String(props.parselNo ?? props.parsel ?? "").trim();
      if (!mahalle || !ada || !parsel) {
        Alert.alert("Parsel Gerekli", "Kaydetmek için önce bir parsel seçin.");
        return;
      }

      const referenceId = parcel3dReferenceId(mahalle, ada, parsel);
      const hasPurchased = await creditService.check3dDesignLicense(referenceId);
      if (!hasPurchased) {
        setPendingPaidAction("saveSelected");
        setPendingParcelInfo({
          mahalle,
          ada,
          parsel,
          referenceId,
          mahalleTkgmValue: readMahalleTkgmFromParcelProps(props),
          proparcelValue: readProparcelFromParcelProps(props),
        });
        setParcel3dPurchaseVisible(true);
        return;
      }
    }

    const baseParcel = selectedParcel || (parcels?.length === 1 ? parcels[0] : null);
    const props = (baseParcel?.properties || {}) as any;
    const mahalle = String(props.mahalleAd ?? props.mahalle ?? "").trim();
    const ada = String(props.adaNo ?? props.ada ?? "").trim();
    const parsel = String(props.parselNo ?? props.parsel ?? "").trim();

    const galleryResult = await saveImageUrisToPhotoLibrary(uris);

    let message: string;
    if (galleryResult.ok && galleryResult.savedCount > 0) {
      message = `${galleryResult.savedCount} görsel fotoğraf galerinize kaydedildi.`;
    } else if (galleryResult.error) {
      message = `Galeriye kayıt başarısız: ${galleryResult.error}`;
    } else {
      message = "Kayıt tamamlandı.";
    }
    Alert.alert("Kaydedildi", message);
  }, [captureItems, selectedIds, user, isAuthenticated, router, selectedParcel, parcels]);

  const handleShareSelected = useCallback(async () => {
    console.log("[ShapeDrawingModal:CAPTURE] handleShareSelected: captureItems.length=", captureItems.length, "selectedIds.size=", selectedIds.size, "selectedIds=", Array.from(selectedIds));
    const uris = captureItems.filter((x) => selectedIds.has(x.id)).map((x) => x.fileUri);
    console.log("[ShapeDrawingModal:CAPTURE] handleShareSelected: seçilenlerden uris sayısı=", uris.length, "uris[0]=", uris[0] ?? "(yok)");
    if (uris.length === 0) {
      console.warn("[ShapeDrawingModal:CAPTURE] handleShareSelected: paylaşılacak görsel yok, uyarı gösteriliyor");
      Alert.alert("Uyarı", "Paylaşılacak görsel seçin.");
      return;
    }

    // Satın alma kapısı (parsel bazlı): Kaydet/Paylaş aşamasında kredi düşümü.
    // Admin her zaman serbest. Kullanıcı giriş yapmadıysa satın alma yapamaz.
    const isAdmin = String((user as any)?.role || "").toLowerCase() === "admin";
    if (!isAdmin) {
      if (!isAuthenticated) {
        Alert.alert(
          "Giriş Gerekli",
          "Paylaşmak için giriş yapmanız gerekiyor.",
          [
            { text: "İptal", style: "cancel" },
            { text: "Giriş Yap", onPress: () => router.push("login") },
          ]
        );
        return;
      }

      const baseParcel = selectedParcel || (parcels?.length === 1 ? parcels[0] : null);
      const props = (baseParcel?.properties || {}) as any;
      const mahalle = String(props.mahalleAd ?? props.mahalle ?? "").trim();
      const ada = String(props.adaNo ?? props.ada ?? "").trim();
      const parsel = String(props.parselNo ?? props.parsel ?? "").trim();
      if (!mahalle || !ada || !parsel) {
        Alert.alert("Parsel Gerekli", "Paylaşmak için önce bir parsel seçin.");
        return;
      }

      const referenceId = parcel3dReferenceId(mahalle, ada, parsel);
      const hasPurchased = await creditService.check3dDesignLicense(referenceId);
      if (!hasPurchased) {
        setPendingPaidAction("shareSelected");
        setPendingParcelInfo({
          mahalle,
          ada,
          parsel,
          referenceId,
          mahalleTkgmValue: readMahalleTkgmFromParcelProps(props),
          proparcelValue: readProparcelFromParcelProps(props),
        });
        setParcel3dPurchaseVisible(true);
        return;
      }
    }

    console.log("[ShapeDrawingModal:CAPTURE] handleShareSelected: shareManyImages çağrılıyor");
    const res = await shareManyImages(uris);
    console.log("[ShapeDrawingModal:CAPTURE] handleShareSelected: shareManyImages sonucu ok=", res.ok, "error=", res.error ?? "(yok)");
    if (!res.ok && res.error) {
      Alert.alert("Paylaşım Hatası", res.error);
    }
  }, [captureItems, selectedIds, user, isAuthenticated, router, selectedParcel, parcels]);

  const on3dPurchaseSuccess = useCallback(async () => {
    const ctx = pendingParcelInfo;
    if (!ctx) {
      setPendingPaidAction(null);
      return;
    }
    await cacheParcel3dTkgmAfterPurchase(ctx.mahalle, ctx.ada, ctx.parsel, ctx.mahalleTkgmValue, ctx.proparcelValue);
    const action = pendingPaidAction;
    setPendingPaidAction(null);
    setPendingParcelInfo(null);
    if (action === "shareSelected") {
      // Satın alma sonrası paylaşımı tekrar dene (seçim hala duruyor).
      handleShareSelected();
    } else if (action === "saveSelected") {
      // Satın alma sonrası kaydetmeyi tekrar dene.
      handleSaveSelected();
    }
  }, [pendingParcelInfo, pendingPaidAction, handleShareSelected, handleSaveSelected]);

  const handleDeleteSelected = useCallback(() => {
    const idsToDelete = new Set(selectedIds);
    deleteCaptureFiles(captureItems, idsToDelete).then((remaining) => {
      setCaptureItems(remaining);
      persistCaptures(remaining);
      setSelectedIds(new Set());
    });
  }, [captureItems, selectedIds]);

  const handleDeleteFromPreview = useCallback(() => {
    if (!previewId) return;
    deleteCaptureFiles(captureItems, new Set([previewId])).then((remaining) => {
      setCaptureItems(remaining);
      persistCaptures(remaining);
      setPreviewId(null);
    });
  }, [captureItems, previewId]);

  // Get selected model's remaining uses for info panel
  const selectedModelRemainingUses = useMemo(() => {
    if (!modelState.placingModelId) return null;
    const modelId = getModelIdFromStringId(modelState.placingModelId);
    if (modelId === undefined) return null;
    return getRemainingUses(modelId);
  }, [modelState.placingModelId, getModelIdFromStringId, getRemainingUses]);

  const clearAllShapes = useCallback(() => {
    Alert.alert(
      'Tümünü Temizle',
      'Tüm şekilleri, ölçümleri ve parselleri silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: () => {
            setShapes([]);
            setSelectedShapeId(null);
            setShapeDrawingPoints([]);
            setShapeDrawingMode(null);
            setMeasurementFeatures([]);
            setSelectedMeasurementGroupId(null);
            setMeasurementPoints([]);
            setMeasurementMode(null);
            setSelectedParcel(null);
            setParcels([]);
            setParcelSelectMode(false);
          },
        },
      ]
    );
  }, []);

  const getShapeName = useCallback((shape: ShapeProperties) => getShapeNameUtil(shapes, shape), [shapes]);
  const getMeasurementName = useCallback(getMeasurementNameUtil, []);
  const getParcelName = useCallback((parcel: any) => getParcelNameUtil(effectiveParcels, parcel), [effectiveParcels]);
  const onMeasurementGroupDeleted = useCallback((gid: string) => {
    setSelectedMeasurementGroupId((prev) => (prev === gid ? null : prev));
  }, []);

  const confirmDeleteMeasurement = useConfirmDeleteMeasurement(setMeasurementFeatures, onMeasurementGroupDeleted);

  // TÜM HOOK'LAR ÇAĞRILDI - Şimdi conditional render yapabiliriz
  // React Rules of Hooks: Hook'lar conditional return'lerden ÖNCE olmalı
  
  if (!visible) {
    return <Modal visible={false} animationType="slide" onRequestClose={onClose} />;
  }

  if (!Mapbox) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Şekil Çizim</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Mapbox modülü yüklenemedi.</Text>
            <Text style={[styles.errorText, { marginTop: 8, fontSize: 14 }]}>
              Lütfen @rnmapbox/maps paketinin yüklü olduğundan emin olun.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* NOTE: native Modal içinde BottomSheet için provider/gesture root gerekli */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <SafeAreaView style={styles.container}>
            {captureMode && (
              <CaptureModeBar
                captureInProgress={captureInProgress}
                onCapture={handleCapturePress}
                onClose={() => setCaptureMode(false)}
                onOpenResimler={() => {
                  setCaptureSheetInitialIndex(1);
                  setCaptureSheetVisible(true);
                }}
              />
            )}
            {!captureMode && (
            <>
            {/* Compact Header: Yönet, başlık ve kapat orta hizalı */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setMapToolsSheetOpen(false);
                    setModelsDropdownOpen(false);
                    setCameraMenuOpen(false);
                    setMainActionMenuOpen(false);
                    setShapeEditPanelVisible(false);
                    setMeasurementEditPanelVisible(false);
                    setSelectedShapeId(null);
                    setShapeEditPanelMinimized(true);
                    setManagementPanelVisible(!managementPanelVisible);
                  }}
                  style={styles.managementButton}
                >
                  <Ionicons name="list" size={18} color="#fff" />
                  <Text style={styles.managementButtonText}>
                    {managementPanelVisible ? "Gizle" : "Yönet"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>3D Model Editörü</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  testID="credit-badge"
                  style={styles.creditBadge}
                  onPress={() => router.push("pricing")}
                  activeOpacity={0.7}
                  disabled={isLoadingCredit}
                >
                  <Image source={TepeCoinIcon} style={styles.creditBadgeIcon} resizeMode="contain" />
                  <Text style={styles.creditBadgeText}>
                    {isAuthenticated && creditBalance !== null ? creditBalance.toLocaleString("tr-TR") : "—"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeButtonWrapper} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

        {/* Dropdown overlay kaldırıldı: seçimler alttan BottomSheet ile açılıyor */}

        {/* Toolbar: kompakt İşlemler menüsü */}
        <View style={styles.toolbarContainer}>
            <View style={{ flex: 0, zIndex: 2000 }}>
              <TouchableOpacity
                style={[
                  styles.toolbarActionMenuButton,
                  (mainActionMenuOpen ||
                    mapToolsSheetOpen ||
                    modelsDropdownOpen ||
                    cameraMenuOpen) &&
                    styles.toolbarActionMenuButtonActive,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setManagementPanelVisible(false);
                  setShapeEditPanelVisible(false);
                  setMeasurementEditPanelVisible(false);
                  setSelectedShapeId(null);
                  setShapeEditPanelMinimized(true);
                  const next = !mainActionMenuOpen;
                  setMainActionMenuOpen(next);
                  if (next) {
                    setMapToolsSheetOpen(false);
                    setModelsDropdownOpen(false);
                    setMapToolsSheetOpen(false);
                    setCameraMenuOpen(false);
                  }
                }}
                accessibilityLabel="İşlemler menüsü"
              >
                <Ionicons
                  name="apps-outline"
                  size={14}
                  color={
                    mainActionMenuOpen ||
                    mapToolsSheetOpen ||
                    modelsDropdownOpen ||
                    cameraMenuOpen
                      ? "#fff"
                      : "#94a3b8"
                  }
                />
                <Text
                  style={[
                    styles.toolbarActionMenuTitle,
                    (mainActionMenuOpen ||
                      mapToolsSheetOpen ||
                      modelsDropdownOpen ||
                      mapToolsSheetOpen ||
                      cameraMenuOpen) &&
                      styles.toolbarActionMenuTitleActive,
                  ]}
                >
                  İşlemler
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={
                    mainActionMenuOpen ||
                    mapToolsSheetOpen ||
                    modelsDropdownOpen ||
                    cameraMenuOpen
                      ? "#e2e8f0"
                      : "#64748b"
                  }
                />
              </TouchableOpacity>
            </View>
        </View>
            </>
            )}

        {/* Map Area */}
        <View style={styles.mapContainer}>
          {(() => {
            try {
              if (!Mapbox || !Mapbox.MapView) {
                return (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Mapbox haritası yüklenemedi.</Text>
                    <Text style={[styles.errorText, { marginTop: 8, fontSize: 12 }]}>
                      Mapbox: {Mapbox ? 'Yüklü' : 'Yüklenemedi'}
                    </Text>
                    <Text style={[styles.errorText, { marginTop: 4, fontSize: 12 }]}>
                      MapView: {Mapbox?.MapView ? 'Mevcut' : 'Yok'}
                    </Text>
                  </View>
                );
              }

              if (!mapMountReady) {
                return (
                  <View style={[styles.mapWrapper, styles.errorContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={styles.errorText}>Harita yükleniyor...</Text>
                  </View>
                );
              }

              // Harita her zaman görünür; Terrain sadece terrainEnabled iken (modelsPropUsed ile OOM önlendi)
              console.log('[3DEDIT] ShapeDrawingMapView render ediliyor (MapView + Terrain + Models)');
              const MapContent = (
                <>
                  <ShapeDrawingMapView
                    Mapbox={Mapbox}
                    RasterDemSource={RasterDemSource}
                    Terrain={Terrain}
                    terrainEnabled={terrainEnabled && !captureMode}
                    mapRef={mapRef}
                    mapReadyRef={mapReadyRef}
                    onMapIdle={handleMapIdleWithTextBoxLayout}
                    cameraRef={cameraRef}
                    center={center}
                    zoom={zoom}
                    cameraZoom={cameraZoom}
                    cameraCenter={cameraCenter}
                    cameraHeading={cameraHeading}
                    scrollEnabled={
                      captureMode
                        ? false
                        : !(resizeMode || rotationMode || moveMode || shapeSheetMinimizedDrag || freehandActive)
                    }
                    zoomEnabled={
                      captureMode
                        ? false
                        : !(resizeMode || rotationMode || moveMode || shapeSheetMinimizedDrag || freehandActive)
                    }
                    pitchEnabled={
                      captureMode
                        ? false
                        : !(resizeMode || rotationMode || moveMode || shapeSheetMinimizedDrag || freehandActive)
                    }
                    rotateEnabled={
                      captureMode
                        ? false
                        : !(resizeMode || rotationMode || moveMode || shapeSheetMinimizedDrag || freehandActive)
                    }
                    onPress={handleMapPress}
                    onLongPress={handleMapLongPress}
                    onCameraChanged={handleMapCameraChanged}
                    modelsProp={modelsPropUsed}
                    modelInstances={modelState.instances}
                    measurementFeatures={mergedMeasurementForMap}
                    shapeDraftPreview={shapeDraftPreview}
                    orderedParcels={orderedParcels}
                    selectedParcelId={mapSelectedParcelId}
                    shapes={shapes}
                    selectedShapeId={selectedShapeId}
                    pitchValue={pitchValue}
                    captureMode={captureMode}
                    selectedModelId={modelState.selectedModelId}
                    modelCatalogFlat={modelCatalogFlat}
                    shapeInteractionLocked={Boolean(measurementMode)}
                    selectedMeasurementGroupId={selectedMeasurementGroupId}
                    onMeasurementGroupPress={handleMeasurementGroupPress}
                    buildingExtrusionFeatures={buildingExtrusionFeaturesForMap}
                    buildingExtrusionVisible={buildingExtrusionMapVisible}
                    buildingGuideFeature={buildingGuideFeature}
                    buildingGuideVisible={Boolean(buildingEdgeReady && lastEdgeMeasureData)}
                    buildingSelectionOutlineRing={selectedBuildingOutlineRing}
                    buildingWindowFramePolygons={buildingWindowFramePolygons}
                    buildingRoofGeoJSON={buildingRoofGeoJSON}
                    onShapePress={handleShapeTap}
                    onHandlePress={handleHandlePress}
                  />
                </>
              );
              return (
                <View style={styles.mapWrapper}>
                  {/* NativeViewGestureHandler kaldırıldı: RNGH ile Mapbox tek parmak pan’i çalıyordu; iki parmak pinch farklı yol kullanıyordu. */}
                  <View style={{ flex: 1 }}>{MapContent}</View>

                  <ScreenShapesOverlay shapes={shapes} selectedShapeId={selectedShapeId} onShapePress={handleShapeTap} />

                  <TextBoxMapOverlay
                    shapes={shapes}
                    mapRef={mapRef}
                    layoutTick={textBoxLayoutTick}
                    selectedShapeId={selectedShapeId}
                    onShapePress={handleShapeTap}
                    enabled={!captureMode && !freehandActive && !measurementMode}
                  />

                  <FreehandDrawOverlay
                    active={freehandActive && !captureMode}
                    mode={shapeDrawingMode === "freehand" ? "freehand" : "pen"}
                    drawSurface={drawSurface}
                    mapRef={mapRef}
                    onCommitMap={handleFreehandCommitMap}
                    onCommitScreen={handleFreehandCommitScreen}
                    strokePreviewColor={drawOutlineColor}
                    strokeWidth={Math.max(2, drawOutlineWidth)}
                  />

                  <DrawingFinishBar
                    visible={Boolean(!captureMode && shapeDrawingMode)}
                    bottomInset={insets.bottom}
                    onFinish={handleFinishActiveDrawing}
                  />

                  {!captureMode &&
                    !shapeDrawingMode &&
                    Boolean(measurementMode) &&
                    !shapeEditPanelVisible &&
                    !measurementEditPanelVisible &&
                    !managementPanelVisible && (
                      <DrawingToolbox
                        visible
                        measurementMode={measurementMode}
                        rulerColor={measureRulerColor}
                        onRulerColorChange={setMeasureRulerColor}
                        areaColor={measureAreaColor}
                        onAreaColorChange={setMeasureAreaColor}
                        onFinishMeasurement={() => {
                          finishPendingMeasurement();
                        }}
                        onClose={handleToolboxClose}
                        topInset={insets.top}
                      />
                    )}

                  {!captureMode && (Boolean(measurementMode) || Boolean(selectedMeasurementGroupId)) && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: Math.max(insets.bottom, 8) + 72,
                        left: 0,
                        right: 0,
                        alignItems: "center",
                        zIndex: 1300,
                        gap: 10,
                      }}
                      pointerEvents="box-none"
                    >
                      {selectedMeasurementGroupId && (
                        <TouchableOpacity
                          onPress={handleDeleteSelectedMeasurement}
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.95)",
                            paddingHorizontal: 22,
                            paddingVertical: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.35)",
                          }}
                          accessibilityLabel="Seçili ölçümü sil"
                        >
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Sil</Text>
                        </TouchableOpacity>
                      )}
                      {Boolean(measurementMode) && (
                        <TouchableOpacity
                          onPress={closeMeasurementDrawing}
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.95)",
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.35)",
                          }}
                          accessibilityLabel="Ölçüm modunu kapat"
                        >
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Ölçüm Kapat</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Model loading overlay */}
                  {/* Mapbox native view üstüne garanti için Modal ile göster */}
                  <ModelLoadingStrip
                    visible={isModelLoading || modelMapRenderLoading}
                    text={isModelLoading ? modelLoadingText : "Model görüntüleniyor…"}
                    progress={isModelLoading ? modelLoadingProgress : null}
                  />

                  {/* Model sayfası: sağ-orta 3D yön/açı kontrolleri (zoom panel mantığı) */}
                  {/* Model placement status (kullanıcıya yerleştirme modunu göster) - captureMode'da gizle */}
                  {!captureMode && modelState.placingModelId && (
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        right: 12,
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderWidth: 1,
                        borderColor: "rgba(59, 130, 246, 0.35)",
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        zIndex: 1200,
                      }}
                      pointerEvents="box-none"
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                            Yerleştirme modu: {formatModelDisplayName(modelState.placingModelId)}
                          </Text>
                          <Text style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>
                            Haritaya dokun → model eklenir.
                          </Text>
                          {totalModelSize && (
                            <Text
                              style={{
                                color: totalModelSize.totalKb > totalModelSize.limitKb ? "#f87171" : "#94a3b8",
                                fontSize: 11,
                                marginTop: 6,
                              }}
                            >
                              Toplam boyut: {totalModelSize.totalKb} KB / {totalModelSize.limitKb} KB
                            </Text>
                          )}
                          {/* Usage Info Panel */}
                          {selectedModelRemainingUses !== null && (
                            <View style={{ marginTop: 8 }}>
                              <UsageInfoPanel
                                remainingUses={selectedModelRemainingUses}
                                modelName={formatModelDisplayName(modelState.placingModelId)}
                              />
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            modelActions.setPlacingModelId(null);
                          }}
                          style={{
                            marginLeft: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: 'rgba(59, 130, 246, 0.25)',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(59, 130, 246, 0.5)',
                          }}
                          accessibilityLabel="Yerleştirme modunu kapat"
                        >
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Modu Kapat</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Model Debug Banner - Model instance varsa görünür - captureMode'da gizle */}
                  {!captureMode && modelState.instances.length > 0 && (
                    <ModelDebugBanner
                      instances={modelState.instances}
                      onFocusAll={() => focusOnAllModels(modelState.instances)}
                      onTogglePanel={() => setModelDebugPanelVisible((prev) => !prev)}
                      panelVisible={modelDebugPanelVisible}
                      hasPlacementStatus={!!modelState.placingModelId}
                    />
                  )}

                  {/* Model Debug Panel - Altta detaylı model listesi - captureMode'da gizle */}
                  {!captureMode && modelDebugPanelVisible && (
                    <ModelDebugPanel
                      instances={modelState.instances}
                      modelsProp={modelsPropUsed as any}
                      pitch={pitchValue}
                      hasTerrain={terrainEnabled && !!(RasterDemSource && Terrain)}
                      onFocusModel={focusOnModel}
                      onRemoveInstance={(id) => {
                        modelActions.removeModelInstance(id);
                        if (modelState.selectedModelId === id) modelActions.setSelectedModelId(null);
                      }}
                      bottomInset={insets.bottom}
                    />
                  )}

                  {/* Model Transform Bar - seçili model varken: döndür (basılı tut) + sil */}
                  {!captureMode && modelState.selectedModelId && (
                    <ModelTransformBar
                      visible={true}
                      bottomInset={insets.bottom}
                      footprintAreaM2={footprintAreaM2}
                      scaleValue={selectedInstance?.modelScale?.[0] ?? 1}
                      onScaleChange={(scale) => {
                        const id = modelState.selectedModelId;
                        if (!id) return;
                        modelActions.updateModelInstance(id, { scale });
                      }}
                      onRotateLeftPressIn={modelTransformBar.onRotateLeftPressIn}
                      onRotateLeftPressOut={modelTransformBar.onRotateLeftPressOut}
                      onRotateRightPressIn={modelTransformBar.onRotateRightPressIn}
                      onRotateRightPressOut={modelTransformBar.onRotateRightPressOut}
                      onNudgePressIn={modelTransformBar.onNudgePressIn}
                      onNudgePressOut={modelTransformBar.onNudgePressOut}
                      onDelete={handleModelDelete}
                      onClose={() => modelActions.setSelectedModelId(null)}
                    />
                  )}

                  {!captureMode && (
                  <MapNavControls
                    visible={navControlsVisible}
                    bottomInset={insets.bottom}
                    pitchValue={pitchValue}
                    onOpen={() => {
                      setNavControlsVisible(true);
                      // Önce pitch 50 uygula (hook programmatic ref ile onCameraChanged'ı geçici yok sayar)
                      const currentPitch = camRef.current.pitch ?? 0;
                      if (currentPitch < 50) apply3DView(50);
                      // Terrain'i kısa gecikmeyle aç; harita önce 50° açıya geçsin, sonra DEM yüklensin (yanıp sönme önlenir)
                      setTimeout(() => setTerrainEnabled(true), 200);
                    }}
                    onClose={() => {
                      setNavControlsVisible(false);
                      // Pitch değerini koru (3D görünüm kalsın)
                      // Eğer pitch 50 derece veya üzerindeyse, değeri koru
                      if (cameraRef?.current?.setCamera && pitchValue >= 50) {
                        // Pitch değerini koru, sıfırlama
                        cameraRef.current.setCamera({ 
                          pitch: pitchValue, 
                          animationDuration: 0 
                        });
                        camRef.current.pitch = pitchValue;
                      }
                    }}
                    startZoomChange={startZoomChange}
                    stopZoomChange={stopZoomChange}
                    startHeadingChange={startHeadingChange}
                    stopHeadingChange={stopHeadingChange}
                    startPitchChange={startPitchChange}
                    stopPitchChange={stopPitchChange}
                  />
                  )}

                  {(resizeMode || rotationMode || moveMode || shapeSheetMinimizedDrag) && (
                    <View
                      style={styles.dragOverlay}
                      pointerEvents="auto"
                      {...dragPanResponder.panHandlers}
                    />
                  )}

                  {!captureMode && selectedShapeId && (
                    <TouchableOpacity
                      style={styles.shapeSelectionClearButton}
                      onPress={clearShapeSelection}
                      accessibilityLabel="Şekil seçimini kaldır"
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={22} color="#fff" />
                    </TouchableOpacity>
                  )}

                  {/* Capture: gizli ViewShot container (ekran dışında) */}
                  <CaptureComposeContainer
                    ref={captureComposeRef}
                    capturedMapUri={capturedMapUri}
                    width={composeDims.width}
                    height={composeDims.height}
                    screenOverlayShapes={shapes.filter((s) => s.screenSpace)}
                  />
                </View>
              );
            } catch (error) {
              console.error('[3DEDIT] Map render catch:', error);
              return (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Harita render hatası.</Text>
                  <Text style={[styles.errorText, { marginTop: 8, fontSize: 12 }]}>
                    {error instanceof Error ? error.message : String(error)}
                  </Text>
                </View>
              );
            }
          })()}
        </View>

        {/* Capture Bottom Sheet (thumbnail galerisi + seçim modu) */}
        <CaptureBottomSheet
          visible={captureSheetVisible}
          onClose={() => setCaptureSheetVisible(false)}
          items={captureItems}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          initialSnapIndex={captureSheetInitialIndex}
          onToggleSelectionMode={toggleSelectionMode}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onOpenPreview={(id) => setPreviewId(id)}
          onSaveSelected={handleSaveSelected}
          onShareSelected={handleShareSelected}
          onDeleteSelected={handleDeleteSelected}
        />

        {/* Capture Preview Modal */}
        <CapturePreviewModal
          visible={Boolean(previewId)}
          item={captureItems.find((x) => x.id === previewId) ?? null}
          onClose={() => setPreviewId(null)}
          onDelete={() => {
            handleDeleteFromPreview();
          }}
        />

        {/* 3D Tasarım (parsel bazlı) satın alma modalı */}
        <Parcel3dPurchaseModal
          visible={parcel3dPurchaseVisible}
          onClose={() => setParcel3dPurchaseVisible(false)}
          referenceId={pendingParcelInfo?.referenceId}
          mahalle={pendingParcelInfo?.mahalle}
          ada={pendingParcelInfo?.ada}
          parsel={pendingParcelInfo?.parsel}
          mahalleTkgmValue={pendingParcelInfo?.mahalleTkgmValue}
          proparcelValue={pendingParcelInfo?.proparcelValue}
          onPurchaseSuccess={on3dPurchaseSuccess}
        />

        {/* Parsel mahalle satırı editörde gösterilmez (kullanıcı isteği) */}

        {/* Shape Edit Panel (BottomSheet) */}
        <ShapeEditSheet
          visible={shapeEditPanelVisible}
          selectedShapeId={selectedShapeId}
          shapes={shapes}
          setShapes={setShapes}
          insetsBottom={insets.bottom}
          minimized={shapeEditPanelMinimized}
          setMinimized={setShapeEditPanelMinimized}
          onClose={() => {
            setShapeEditPanelVisible(false);
          }}
          onDeleteShape={handleDeleteSelectedShape}
          openTextBoxEditor={openTextBoxEditor}
        />

        <MeasurementEditSheet
          visible={measurementEditPanelVisible}
          selectedMeasurementGroupId={selectedMeasurementGroupId}
          measurementFeatures={measurementFeatures}
          setMeasurementFeatures={setMeasurementFeatures}
          insetsBottom={insets.bottom}
          minimized={measurementEditPanelMinimized}
          setMinimized={setMeasurementEditPanelMinimized}
          onClose={() => setMeasurementEditPanelVisible(false)}
          onDelete={handleDeleteSelectedMeasurement}
        />

        <ManagementSheet
          visible={managementPanelVisible}
          onClose={() => setManagementPanelVisible(false)}
          insetsBottom={insets.bottom}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          shapes={shapes}
          measurementFeatures={measurementFeatures}
          parcels={effectiveParcels}
          selectedShapeId={selectedShapeId}
          selectedParcelId={mapSelectedParcelId}
          getShapeName={getShapeName}
          getMeasurementName={getMeasurementName}
          getParcelName={getParcelName}
          onEditShape={(shapeId) => {
            const tapped = shapes.find((s) => s.id === shapeId);
            setSelectedMeasurementGroupId(null);
            setSelectedShapeId(shapeId);
            setShapeEditPanelVisible(true);
            setShapeEditPanelMinimized(tapped?.type !== "textbox");
            setManagementPanelVisible(false);
          }}
          onDeleteShape={(shapeId) => {
            setShapes((prev) => prev.filter((s) => s.id !== shapeId));
            if (selectedShapeId === shapeId) {
              setSelectedShapeId(null);
              setShapeEditPanelVisible(false);
            }
          }}
          onDeleteMeasurement={(feature, index) => confirmDeleteMeasurement(feature, index)}
          onViewParcel={(parcel) => {
            setSelectedParcel(parcel);
            setManagementPanelVisible(false);
          }}
          onDeleteParcel={(parcelId) => {
            setParcels((prev) => prev.filter((p) => p.id !== parcelId));
            if (selectedParcel?.id === parcelId) setSelectedParcel(null);
          }}
        />

        {/* Info Text */}
        <ModeInfoBar
          visible={
            Boolean(shapeDrawingMode || measurementMode || parcelSelectMode || resizeMode || rotationMode) &&
            !shapeEditPanelVisible &&
            !measurementEditPanelVisible &&
            !managementPanelVisible
          }
          shapeDrawingMode={shapeDrawingMode}
          measurementMode={measurementMode}
          parcelSelectMode={parcelSelectMode}
          resizeMode={resizeMode}
          rotationMode={rotationMode}
          drawSurface={drawSurface}
          showDrawSurfaceToggle={freehandActive}
          onToggleDrawSurface={() => setDrawSurface((d) => (d === "map" ? "screen" : "map"))}
        />

        <ShapeDrawingDropdownSheets
          insetsBottom={insets.bottom}
          mainActionMenuOpen={mainActionMenuOpen}
          onCloseMainActionMenu={handleCloseMainActionMenu}
          onMainMenuSelectMapTools={openMapToolsSheet}
          onMainMenuSelectModels={openToolbarModelsSheet}
          onMainMenuSelectBinaOlustur={onMainMenuSelectBinaOlustur}
          onMainMenuSelectResim={handleCameraPress}
          mapToolsOpen={mapToolsSheetOpen}
          onCloseMapTools={() => setMapToolsSheetOpen(false)}
          modelsOpen={modelsDropdownOpen}
          onCloseModels={() => setModelsDropdownOpen(false)}
          cameraMenuOpen={cameraMenuOpen}
          onCloseCameraMenu={() => setCameraMenuOpen(false)}
          onSelectResimCek={handleSelectResimCek}
          onSelectResimler={handleSelectResimler}
          shapeDrawingMode={shapeDrawingMode}
          measurementMode={measurementMode}
          onSelectShape={(next) => {
            clearModelPlacementMode();
            clearShapeSelection();
            setShapeDrawingMode(next);
            setShapeDrawingPoints([]);
            setMeasurementMode(null);
            setMeasurementPoints([]);
            setMeasurementFeatures((prev) => prev.filter((f) => !(f as any)?.properties?.isTemporary));
            if (next !== null) setSelectedMeasurementGroupId(null);
            setMapToolsSheetOpen(false);
          }}
          onSelectMeasurement={(next) => {
            clearModelPlacementMode();
            clearShapeSelection();
            setMeasurementMode(next);
            setMeasurementPoints([]);
            setMeasurementFeatures((prev) => prev.filter((f) => !(f as any)?.properties?.isTemporary));
            setSelectedMeasurementGroupId(null);
            setShapeDrawingMode(null);
            setShapeDrawingPoints([]);
            setMapToolsSheetOpen(false);
          }}
          onClearMeasurements={() => {
            setMeasurementFeatures([]);
            setSelectedMeasurementGroupId(null);
            setMeasurementPoints([]);
            setMeasurementMode(null);
            setMapToolsSheetOpen(false);
            setEdgeMeasurementFeatures([]);
            setShowEdgeMeasurements(false);
          }}
          onClearAllShapes={() => {
            setShapes([]);
            setSelectedShapeId(null);
            setShapeEditPanelVisible(false);
            setShapeDrawingMode(null);
            setShapeDrawingPoints([]);
          }}
          onEdgeMeasures={fetchEdgeMeasures}
          hasSingleParcelSelected={Boolean(selectedParcel)}
          onHisseliParsellereBolPress={handleHisseliParsellereBol}
          isModelCatalogLoading={isModelCatalogLoading}
          modelCatalogFlat={modelCatalogFlat}
          modelCatalogError={modelCatalogError}
          placingModelId={modelState.placingModelId}
          onSelectModel={onSelectModel}
          onClearModels={() => {
            modelActions.clearModelInstances();
            modelActions.setPlacingModelId(null);
            setModelsDropdownOpen(false);
          }}
          formatModelDisplayName={formatModelDisplayName}
          getRemainingUses={getRemainingUses}
          onSelectOwnedModel={(ownedModel) => {
            const oid = ownedModel.model_id;
            const oidNum = typeof oid === "number" ? oid : Number(oid);
            const byId =
              modelCatalogFlat.find((m) => m.id === oid) ??
              (Number.isFinite(oidNum) ? modelCatalogFlat.find((m) => m.id === oidNum) : undefined) ??
              modelCatalogFlat.find((m) => m.id != null && String(m.id) === String(oid));
            if (byId) {
              onSelectModel(byId);
              return;
            }
            const sameName = modelCatalogFlat.filter((m) => m.filename === ownedModel.file);
            if (sameName.length === 1) onSelectModel(sameName[0]);
          }}
          onModelCatalogRefresh={() => {
            setModelCatalogRefreshKey((prev) => prev + 1);
          }}
          onRequestPurchase={handleRequestModelPurchase}
        />

        <BuildingUnifiedSheet
          visible={buildingSheetVisible}
          onClose={() => {
            setBuildingCreateSheetVisible(false);
            setSelectedBuildingId(null);
          }}
          tab={buildingSheetTab}
          onTabChange={setBuildingSheetTab}
          insetsBottom={insets.bottom}
          hasSelectedBuilding={!!selectedBuildingId}
          createForm={{
            insetsBottom: insets.bottom,
            settings: buildingSettings,
            onChangeSettings: (patch) => setBuildingSettings((prev) => ({ ...prev, ...patch })),
            onCreateBuilding: handleCreateBuildingFromSheet,
            onClearBuildings: handleClearBuildingExtrusions,
            buildingMapVisible: buildingExtrusionMapVisible,
            onToggleBuildingMapVisible: () => setBuildingExtrusionMapVisible((v) => !v),
            edgeLoading: buildingEdgeLoading,
            edgeReady: buildingEdgeReady,
            onRefreshEdgeData: handleRefreshBuildingEdgeData,
            guideLimits: buildingGuideLimits,
          }}
          editPanel={
            selectedBuildingId
              ? {
                  footprintAreaM2: selectedBuildingAreaM2,
                  scaleSlider01: buildingScaleSlider01,
                  onScaleSlidingStart: onBuildingScaleSlidingStart,
                  onScaleValueChange: onBuildingScaleValueChange,
                  selectedColorHex: selectedBuildingColorHex,
                  onSelectColor: (hex) => {
                    if (selectedBuildingId) patchBuildingColor(selectedBuildingId, hex);
                  },
                  frameTemplate: selectedBuildingFrameTemplate,
                  onFrameTemplateChange: (v) => {
                    if (selectedBuildingId) patchBuildingProperties(selectedBuildingId, { frameTemplate: v });
                  },
                  roofTemplate: selectedBuildingRoofTemplate,
                  onRoofTemplateChange: (v) => {
                    if (selectedBuildingId) patchBuildingProperties(selectedBuildingId, { roofTemplate: v });
                  },
                  onRotateLeftPressIn: buildingTransformBar.onRotateLeftPressIn,
                  onRotateLeftPressOut: buildingTransformBar.onRotateLeftPressOut,
                  onRotateRightPressIn: buildingTransformBar.onRotateRightPressIn,
                  onRotateRightPressOut: buildingTransformBar.onRotateRightPressOut,
                  onNudgePressIn: buildingTransformBar.onNudgePressIn,
                  onNudgePressOut: buildingTransformBar.onNudgePressOut,
                  onDelete: handleDeleteSelectedBuilding,
                }
              : null
          }
        />

            <TextBoxEditModal
              visible={textBoxEditVisible}
              initialText={textBoxEditInitialText}
              onCancel={() => {
                setTextBoxEditVisible(false);
                setTextBoxEditShapeId(null);
              }}
              onSave={(nextText) => {
                const id = textBoxEditShapeId;
                if (!id) {
                  setTextBoxEditVisible(false);
                  return;
                }
                setShapes((prev) =>
                  prev.map((s) =>
                    s.id === id ? patchTextBoxShape(s, { text: String(nextText ?? "") }) : s
                  )
                );
                setTextBoxEditVisible(false);
                setTextBoxEditShapeId(null);
              }}
            />

            {/* Parsel Seçim Modal - AppBottomSheetModal kullan */}
            <AppBottomSheetModal
              visible={parcelSelectModalVisible}
              onClose={() => setParcelSelectModalVisible(false)}
              snapPoints={['75%', '90%']}
              initialIndex={0}
              enablePanDownToClose={true}
              backdropOpacity={0.45}
              backdropPressBehavior="close"
            >
              <View style={{ flex: 1, paddingBottom: insets.bottom }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>Parsel Seç</Text>
                  <TouchableOpacity
                    onPress={() => setParcelSelectModalVisible(false)}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={22} color="#334155" />
                  </TouchableOpacity>
                </View>

                {/* Seçim Yöntemi */}
                <View style={{ flexDirection: 'row', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      backgroundColor: parcelSelectMethod === 'ada-parsel' ? '#1e40af' : '#f1f5f9',
                      alignItems: 'center',
                    }}
                    onPress={() => setParcelSelectMethod('ada-parsel')}
                  >
                    <Text style={{ color: parcelSelectMethod === 'ada-parsel' ? '#fff' : '#1f2937', fontWeight: '600' }}>
                      Ada/Parsel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      backgroundColor: parcelSelectMethod === 'click' ? '#1e40af' : '#f1f5f9',
                      alignItems: 'center',
                    }}
                    onPress={() => setParcelSelectMethod('click')}
                  >
                    <Text style={{ color: parcelSelectMethod === 'click' ? '#fff' : '#1f2937', fontWeight: '600' }}>
                      Haritadan Tıkla
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* İçerik */}
                {parcelSelectMethod === 'ada-parsel' ? (
                  <AdaParselForm
                    onClose={() => setParcelSelectModalVisible(false)}
                    onSubmit={async (payload) => {
                        try {
                          setIsLoadingParcel(true);
                          const backendUrl = String(API_URL || "").replace(/\/$/, "");
                          const fallbackUrl = String(FALLBACK_API_URL || "").replace(/\/$/, "");

                          const fetchParcel = async (baseUrl: string) => {
                            const url = `${baseUrl}/api/tkgm_view/`;
                            const response = await fetch(url, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                mahalleTkgmValue: payload.mahalleTkgmValue,
                                ada: payload.ada,
                                parsel: payload.parsel,
                                map_mode: "3d",
                                is3D: true,
                              }),
                            });

                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({}));
                              throw new Error(errorData.error || `HTTP ${response.status}`);
                            }

                            return await response.json();
                          };

                          let data: any = null;
                          try {
                            const base = backendUrl || fallbackUrl;
                            data = await fetchParcel(base);
                          } catch (primaryErr: any) {
                            if (fallbackUrl && fallbackUrl !== backendUrl) {
                              try {
                                data = await fetchParcel(fallbackUrl);
                              } catch (fallbackErr: any) {
                                throw primaryErr;
                              }
                            } else {
                              throw primaryErr;
                            }
                          }

                          if (data?.geometry) {
                            const parcelId = `parcel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            const parcelWithId = { ...data, id: parcelId };

                            setParcels((prev) => {
                              const exists = prev.some(
                                (p) => p?.properties?.adaNo === data?.properties?.adaNo && p?.properties?.parselNo === data?.properties?.parselNo
                              );
                              if (exists) return prev;
                              return [...prev, parcelWithId];
                            });

                            setSelectedParcel(parcelWithId);
                            setParcelSelectModalVisible(false);
                            Alert.alert("Başarılı", "Parsel seçildi");
                          } else {
                            Alert.alert("Bilgi", "Parsel bulunamadı");
                          }
                        } catch (error: any) {
                          console.error("[ParcelSelectModal] Error:", error);
                          Alert.alert("Hata", error?.message || "Parsel sorgulanırken bir hata oluştu");
                        } finally {
                          setIsLoadingParcel(false);
                        }
                      }}
                    />
                  ) : (
                    <View style={{ padding: 16 }}>
                      <Text style={{ fontSize: 16, color: '#64748b', marginBottom: 16, textAlign: 'center' }}>
                        Haritada bir yere tıklayarak parsel seçebilirsiniz.
                      </Text>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#1e40af',
                          paddingVertical: 14,
                          paddingHorizontal: 24,
                          borderRadius: 10,
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          setParcelSelectMode(true);
                          setParcelSelectModalVisible(false);
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                          Tıklama Modunu Aktif Et
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
              </View>
            </AppBottomSheetModal>

          </SafeAreaView>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>

    {purchaseModalVisible && purchaseModel?.id != null && (
      <PurchaseModelModal
        visible={purchaseModalVisible}
        onClose={() => {
          setPurchaseModalVisible(false);
          setPurchaseModel(null);
        }}
        modelId={purchaseModel.id}
        modelName={
          purchaseModel.name?.trim()
            ? purchaseModel.name
            : formatModelDisplayName(purchaseModel.filename)
        }
        modelCategory={purchaseModel.groupId}
        credits={purchaseModel.tepeCredits ?? 0}
        onPurchaseSuccess={() => {
          setPurchaseModalVisible(false);
          setPurchaseModel(null);
          setModelCatalogRefreshKey((prev) => prev + 1);
        }}
      />
    )}
    </>
  );
};

export default ShapeDrawingModal;
