/**
 * Shape Drawing Modal
 * Şekil çizim modülü - Ana sayfadan bağımsız modal sayfa
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ShapesLayer } from '../maps/drawing/ShapesLayer';
import { TextBoxEditModal } from './TextBoxEditModal';
import {
  createRectangleShape,
  createTriangleShape,
  createCircleShape,
  createEllipseShape,
  createPolygonShape,
  createLineShape,
  createArrowShape,
  createMarkerShape,
  createTextBoxShape,
} from '../maps/drawing/ShapeDrawingManager';
import type { ShapeType, ShapeProperties } from '../maps/drawing/types';
import {
  resizeShape,
  rotateShape,
  findNearestHandle,
  getShapeBounds,
} from '../maps/drawing/shapeResizeUtils';
import {
  calculateDistance,
  calculateArea,
  createRulerFeatures,
  createAreaFeatures,
  formatDistance,
  formatArea,
  type MeasurementFeature,
} from '../utils/measurementManager';

// Conditional Mapbox import - Ana sayfadaki yapıyla aynı
let Mapbox: any = null;
let RasterDemSource: any = null;
let Terrain: any = null;
try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
  if (mapboxModule.RasterDemSource) RasterDemSource = mapboxModule.RasterDemSource;
  if (mapboxModule.Terrain) Terrain = mapboxModule.Terrain;
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

interface ShapeDrawingModalProps {
  visible: boolean;
  onClose: () => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ShapeDrawingModal: React.FC<ShapeDrawingModalProps> = ({
  visible,
  onClose,
  initialCenter,
  initialZoom,
}) => {
  // TÜM HOOK'LAR HER ZAMAN ÇAĞRILMALI - React Rules of Hooks
  // Hook'lar conditional return'lerden ÖNCE olmalı
  const insets = useSafeAreaInsets();
  
  // Default values - Önce tanımla
  const defaultCenter: [number, number] = [34.0, 39.0];
  const defaultZoom = 10;
  const center = initialCenter || defaultCenter;
  const zoom = initialZoom || defaultZoom;
  
  // Debug log - Modal açıldığında (center ve zoom tanımlandıktan sonra)
  useEffect(() => {
    if (visible) {
      console.log('[ShapeDrawingModal] Modal açılıyor', { 
        Mapbox: !!Mapbox, 
        MapView: !!Mapbox?.MapView,
        Camera: !!Mapbox?.Camera,
        center,
        zoom,
        insetsBottom: insets.bottom,
        screenHeight: SCREEN_HEIGHT
      });
    }
  }, [visible, center, zoom, insets.bottom]);
  
  // Shape drawing state
  const [shapeDrawingMode, setShapeDrawingMode] = useState<ShapeType | null>(null);
  const [shapeDrawingPoints, setShapeDrawingPoints] = useState<[number, number][]>([]);
  const [shapes, setShapes] = useState<ShapeProperties[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapeEditPanelVisible, setShapeEditPanelVisible] = useState(false);
  const [shapeEditPanelMinimized, setShapeEditPanelMinimized] = useState(false);

  // TextBox: çift dokunuşla metin düzenleme
  const [textBoxEditVisible, setTextBoxEditVisible] = useState(false);
  const [textBoxEditShapeId, setTextBoxEditShapeId] = useState<string | null>(null);
  const [textBoxEditInitialText, setTextBoxEditInitialText] = useState<string>('');
  
  // Model sayfası: 3D yön/açı kontrolleri (index ile aynı mantık)
  const [navControlsVisible, setNavControlsVisible] = useState(false);
  const [pitchValue, setPitchValue] = useState(0);

  // Resize/Rotation state - Basit mod: sadece mod tipi
  const [resizeMode, setResizeMode] = useState<{ shapeId: string } | null>(null);
  const [moveMode, setMoveMode] = useState<{ shapeId: string; lastTouchPos: [number, number] } | null>(null);
  const [rotationMode, setRotationMode] = useState<{ shapeId: string; startAngle: number; startCenter: [number, number]; startTouchPos: [number, number] } | null>(null);
  
  // Dropdown state
  const [shapesDropdownOpen, setShapesDropdownOpen] = useState(false);
  const [measurementDropdownOpen, setMeasurementDropdownOpen] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  
  // Tab management state
  const [activeTab, setActiveTab] = useState<'shapes' | 'measurements' | 'parcels'>('shapes');
  const [managementPanelVisible, setManagementPanelVisible] = useState(false);
  
  // Measurement state
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'area' | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<[number, number][]>([]);
  const [measurementFeatures, setMeasurementFeatures] = useState<MeasurementFeature[]>([]);
  const [isLoadingParcel, setIsLoadingParcel] = useState(false);
  
  // Parsel seç state
  const [parcelSelectMode, setParcelSelectMode] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]); // Birden fazla parsel için
  
  // Map refs
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const camRef = useRef({ center, zoom, pitch: 0, heading: 0 });
  const [cameraZoom, setCameraZoom] = useState<number>(zoom);
  const isProgrammaticMoveRef = useRef(false);
  const zoomIntervalRef = useRef<any>(null);
  const headingIntervalRef = useRef<any>(null);
  const pitchIntervalRef = useRef<any>(null);

  // Modal açıldığında state'leri sıfırla
  useEffect(() => {
    if (visible) {
      setShapeDrawingMode(null);
      setShapeDrawingPoints([]);
      setMeasurementMode(null);
      setMeasurementPoints([]);
      setMeasurementFeatures([]);
      setShapesDropdownOpen(false);
      setMeasurementDropdownOpen(false);
      setParcelSelectMode(false);
      setSelectedParcel(null);
      setShapeEditPanelVisible(false);
      setSelectedShapeId(null);
      setNavControlsVisible(false);
      // Şekilleri koru (kullanıcı isterse temizleyebilir)
    }
  }, [visible]);

  // Interval temizliği
  useEffect(() => {
    return () => {
      if (zoomIntervalRef.current) {
        clearInterval(zoomIntervalRef.current);
        zoomIntervalRef.current = null;
      }
      if (headingIntervalRef.current) {
        clearInterval(headingIntervalRef.current);
        headingIntervalRef.current = null;
      }
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
    };
  }, []);

  const handleShapeDrawingPress = useCallback((e: any) => {
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c || !shapeDrawingMode) return;

    const mode = shapeDrawingMode;

    try {
      // Rectangle: 2 nokta (başlangıç, bitiş)
      if (mode === 'rectangle') {
        if (shapeDrawingPoints.length === 0) {
          setShapeDrawingPoints([c]);
        } else {
          const shape = createRectangleShape(shapeDrawingPoints[0], c);
          setShapes(prev => [...prev, shape]);
          setShapeDrawingPoints([]);
          setShapeDrawingMode(null);
        }
        return;
      }

      // Triangle: 3 nokta
      if (mode === 'triangle') {
        if (shapeDrawingPoints.length < 2) {
          setShapeDrawingPoints(prev => [...prev, c]);
        } else {
          const shape = createTriangleShape(shapeDrawingPoints[0], shapeDrawingPoints[1], c);
          setShapes(prev => [...prev, shape]);
          setShapeDrawingPoints([]);
          setShapeDrawingMode(null);
        }
        return;
      }

      // Circle: 2 nokta (merkez, yarıçap)
      if (mode === 'circle') {
        if (shapeDrawingPoints.length === 0) {
          setShapeDrawingPoints([c]);
        } else {
          const shape = createCircleShape(shapeDrawingPoints[0], c);
          setShapes(prev => [...prev, shape]);
          setShapeDrawingPoints([]);
          setShapeDrawingMode(null);
        }
        return;
      }

      // Ellipse: 3 nokta (merkez, eksen1, eksen2)
      if (mode === 'ellipse') {
        if (shapeDrawingPoints.length < 2) {
          setShapeDrawingPoints(prev => [...prev, c]);
        } else {
          const shape = createEllipseShape(shapeDrawingPoints[0], shapeDrawingPoints[1], c);
          setShapes(prev => [...prev, shape]);
          setShapeDrawingPoints([]);
          setShapeDrawingMode(null);
        }
        return;
      }

      // Polygon: Çoklu nokta (long press ile bitir)
      if (mode === 'polygon') {
        setShapeDrawingPoints(prev => [...prev, c]);
        return;
      }

      // Line: Çoklu nokta (long press ile bitir)
      if (mode === 'line') {
        setShapeDrawingPoints(prev => [...prev, c]);
        return;
      }

      // Arrow: 2 nokta (başlangıç, bitiş)
      if (mode === 'arrow') {
        if (shapeDrawingPoints.length === 0) {
          setShapeDrawingPoints([c]);
        } else {
          const shape = createArrowShape(shapeDrawingPoints[0], c);
          setShapes(prev => [...prev, shape]);
          setShapeDrawingPoints([]);
          setShapeDrawingMode(null);
        }
        return;
      }

      // Marker: 1 nokta
      if (mode === 'marker') {
        const shape = createMarkerShape(c);
        setShapes(prev => [...prev, shape]);
        setShapeDrawingMode(null);
        return;
      }

      // TextBox: 1 nokta + text input (basit çözüm: varsayılan metin)
      if (mode === 'textbox') {
        const defaultText = 'Metin';
        const shape = createTextBoxShape(c, defaultText);
        setShapes(prev => [...prev, shape]);
        setShapeDrawingMode(null);
        return;
      }
    } catch (error) {
      console.error('[handleShapeDrawingPress] Hata:', error);
      Alert.alert('Hata', 'Şekil çizilirken bir hata oluştu.');
      setShapeDrawingPoints([]);
      setShapeDrawingMode(null);
    }
  }, [shapeDrawingMode, shapeDrawingPoints]);

  const openTextBoxEditor = useCallback((shapeId: string) => {
    const s = shapes.find(x => x.id === shapeId);
    if (!s || s.type !== 'textbox') return;
    setTextBoxEditShapeId(shapeId);
    setTextBoxEditInitialText(String(s.text ?? ''));
    setTextBoxEditVisible(true);
  }, [shapes]);

  // ================================
  // Model sayfası: 3D camera controls
  // ================================
  const handleZoomChange = useCallback((delta: number) => {
    if (!cameraRef?.current?.setCamera) return;
    const current = typeof camRef.current.zoom === 'number' ? camRef.current.zoom : zoom;
    const next = Math.max(2, Math.min(22, current + delta));
    isProgrammaticMoveRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: camRef.current.center,
      zoomLevel: next,
      pitch: typeof camRef.current.pitch === 'number' ? camRef.current.pitch : pitchValue,
      heading: typeof camRef.current.heading === 'number' ? camRef.current.heading : 0,
      animationDuration: 250,
    });
    camRef.current.zoom = next;
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 300);
  }, [zoom, pitchValue]);

  const startZoomChange = useCallback((delta: number) => {
    handleZoomChange(delta);
    if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);
    zoomIntervalRef.current = setInterval(() => handleZoomChange(delta), 150);
  }, [handleZoomChange]);

  const stopZoomChange = useCallback(() => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  }, []);

  const handleHeadingChange = useCallback((delta: number) => {
    if (!cameraRef?.current?.setCamera) return;
    const current = typeof camRef.current.heading === 'number' ? camRef.current.heading : 0;
    const next = ((current + delta) % 360 + 360) % 360;
    isProgrammaticMoveRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: camRef.current.center,
      heading: next,
      pitch: typeof camRef.current.pitch === 'number' ? camRef.current.pitch : pitchValue,
      zoomLevel: typeof camRef.current.zoom === 'number' ? camRef.current.zoom : zoom,
      animationDuration: 250,
    });
    camRef.current.heading = next;
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 300);
  }, [pitchValue, zoom]);

  const startHeadingChange = useCallback((delta: number) => {
    handleHeadingChange(delta);
    if (headingIntervalRef.current) clearInterval(headingIntervalRef.current);
    headingIntervalRef.current = setInterval(() => handleHeadingChange(delta), 150);
  }, [handleHeadingChange]);

  const stopHeadingChange = useCallback(() => {
    if (headingIntervalRef.current) {
      clearInterval(headingIntervalRef.current);
      headingIntervalRef.current = null;
    }
  }, []);

  const handlePitchChange = useCallback((nextPitch: number) => {
    if (!cameraRef?.current?.setCamera) return;
    const nv = Math.max(0, Math.min(85, nextPitch));
    isProgrammaticMoveRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: camRef.current.center,
      pitch: nv,
      heading: typeof camRef.current.heading === 'number' ? camRef.current.heading : 0,
      zoomLevel: typeof camRef.current.zoom === 'number' ? camRef.current.zoom : zoom,
      animationDuration: 250,
    });
    camRef.current.pitch = nv;
    setPitchValue(nv);
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 300);
  }, [zoom]);

  const startPitchChange = useCallback((delta: number) => {
    const current = typeof camRef.current.pitch === 'number' ? camRef.current.pitch : pitchValue;
    handlePitchChange(current + delta);
    if (pitchIntervalRef.current) clearInterval(pitchIntervalRef.current);
    pitchIntervalRef.current = setInterval(() => {
      const cur = typeof camRef.current.pitch === 'number' ? camRef.current.pitch : pitchValue;
      handlePitchChange(cur + delta);
    }, 150);
  }, [handlePitchChange, pitchValue]);

  const stopPitchChange = useCallback(() => {
    if (pitchIntervalRef.current) {
      clearInterval(pitchIntervalRef.current);
      pitchIntervalRef.current = null;
    }
  }, []);

  const handleMapLongPress = useCallback((e: any) => {
    // Resize/Rotation modunu bitir
    if (resizeMode || rotationMode) {
      setResizeMode(null);
      setRotationMode(null);
      return;
    }
    
    if (measurementMode === 'area' && measurementPoints.length >= 3) {
      // Alan ölçümünü tamamla
      const measurementGroupId = `meas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const area = calculateArea(measurementPoints);
      const newFeatures = createAreaFeatures(measurementPoints, area, false).map(f => ({
        ...f,
        properties: { ...f.properties, measurementGroupId }
      }));
      setMeasurementFeatures(prev => [
        ...prev.filter(f => !f.properties.isTemporary),
        ...newFeatures
      ]);
      setMeasurementPoints([]);
      setMeasurementMode(null);
      return;
    }
    
    if (shapeDrawingMode === 'polygon' && shapeDrawingPoints.length >= 3) {
      // Polygon'u tamamla
      const shape = createPolygonShape(shapeDrawingPoints);
      setShapes(prev => [...prev, shape]);
      setShapeDrawingPoints([]);
      setShapeDrawingMode(null);
    } else if (shapeDrawingMode === 'line' && shapeDrawingPoints.length >= 2) {
      // Line'ı tamamla
      const shape = createLineShape(shapeDrawingPoints);
      setShapes(prev => [...prev, shape]);
      setShapeDrawingPoints([]);
      setShapeDrawingMode(null);
    }
  }, [shapeDrawingMode, shapeDrawingPoints, measurementMode, measurementPoints, resizeMode, rotationMode]);

  // Ölçüm handler
  const handleMeasurementPress = useCallback((e: any) => {
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c || !measurementMode) return;

    if (measurementMode === 'distance') {
      if (measurementPoints.length === 0) {
        setMeasurementPoints([c]);
        setMeasurementFeatures(prev => [
          ...prev.filter(f => !f.properties.isTemporary),
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: c },
            properties: { measurementType: 'ruler', isTemporary: true }
          }
        ]);
      } else {
        const measurementGroupId = `meas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newPoints = [...measurementPoints, c];
        const newFeatures = createRulerFeatures(newPoints).map(f => ({
          ...f,
          properties: { ...f.properties, measurementGroupId }
        }));
        setMeasurementFeatures(prev => [
          ...prev.filter(f => !f.properties.isTemporary),
          ...newFeatures
        ]);
        setMeasurementPoints([]);
        setMeasurementMode(null);
      }
    } else if (measurementMode === 'area') {
      const newPoints = [...measurementPoints, c];
      setMeasurementPoints(newPoints);
      const newFeatures = createAreaFeatures(newPoints, undefined, true);
      setMeasurementFeatures(prev => [
        ...prev.filter(f => !f.properties.isTemporary),
        ...newFeatures
      ]);
    }
  }, [measurementMode, measurementPoints]);

  // Parsel seç handler
  const handleParcelSelect = useCallback(async (e: any) => {
    if (!parcelSelectMode) return;
    
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c) return;

    setIsLoadingParcel(true);
    const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8000';

    try {
      const response = await fetch(`${backendUrl}/api/tkgm_view/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: c[1],
          lon: c[0],
        }),
      });

      if (!response.ok) {
        throw new Error('Parsel sorgusu başarısız');
      }

      const data = await response.json();
      if (data.geometry) {
        // Parsel ID oluştur
        const parcelId = `parcel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const parcelWithId = { ...data, id: parcelId };
        
        // Parseller listesine ekle (duplicate kontrolü)
        setParcels(prev => {
          // Aynı koordinatlarda parsel var mı kontrol et
          const exists = prev.some(p => 
            p.properties?.adaNo === data.properties?.adaNo && 
            p.properties?.parselNo === data.properties?.parselNo
          );
          if (exists) return prev;
          return [...prev, parcelWithId];
        });
        
        setSelectedParcel(parcelWithId);
        // Parsel bilgilerini göster
        const props = data.properties || {};
        const info = props.mahalleAd && props.adaNo && props.parselNo
          ? `${props.mahalleAd} - Ada: ${props.adaNo}, Parsel: ${props.parselNo}`
          : 'Parsel seçildi';
        Alert.alert('Başarılı', info);
      } else {
        Alert.alert('Bilgi', 'Bu konumda parsel bulunamadı');
      }
    } catch (error) {
      console.error('[handleParcelSelect] Hata:', error);
      Alert.alert('Hata', 'Parsel sorgusu sırasında bir hata oluştu');
    } finally {
      setIsLoadingParcel(false);
    }
  }, [parcelSelectMode]);

  // Handle press handler (resize/rotation) - Basit: sadece mod aktif et
  const handleHandlePress = useCallback((shapeId: string, handleIndex: number) => {
    console.log('[ShapeDrawingModal] Handle press:', { shapeId, handleIndex });
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) {
      console.warn('[ShapeDrawingModal] Shape bulunamadı:', shapeId);
      return;
    }
    
    if (handleIndex === -1) {
      // Rotation handle - Yeşil
      const bounds = getShapeBounds(shape);
      console.log('[ShapeDrawingModal] Rotation mode aktif');
      setRotationMode({
        shapeId,
        startAngle: shape.rotation || 0,
        startCenter: bounds.center,
        startTouchPos: [bounds.center[0], bounds.maxLat + 0.0008], // Rotation handle pozisyonu
      });
      setResizeMode(null); // Diğer modu kapat
      setMoveMode(null);
    } else if (handleIndex === 0) {
      // Resize handle - Mavi
      console.log('[ShapeDrawingModal] Resize mode aktif');
      setResizeMode({ shapeId });
      setRotationMode(null); // Diğer modu kapat
      setMoveMode(null);
    } else if (handleIndex === 1) {
      // Move handle - (şimdilik textbox için)
      console.log('[ShapeDrawingModal] Move mode aktif');
      setMoveMode({ shapeId, lastTouchPos: shape.geometry.type === 'Point' ? (shape.geometry.coordinates as [number, number]) : getShapeBounds(shape).center });
      setResizeMode(null);
      setRotationMode(null);
    }
  }, [shapes]);

  // Handle drag (resize/rotation) - Haritanın herhangi bir yerine dokunarak hareket ettir
  const handleHandleDrag = useCallback((e: any) => {
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c) {
      console.warn('[ShapeDrawingModal] handleHandleDrag: coordinates bulunamadı', e);
      return;
    }

    console.log('[ShapeDrawingModal] handleHandleDrag called:', { 
      resizeMode: !!resizeMode, 
      rotationMode: !!rotationMode,
      coordinates: c 
    });

    if (resizeMode) {
      // Resize işlemi - Yeni pozisyon sağ üst köşe olacak
      const shape = shapes.find(s => s.id === resizeMode.shapeId);
      if (!shape) {
        console.warn('[ShapeDrawingModal] Resize: Shape bulunamadı', resizeMode.shapeId);
        return;
      }
      
      console.log('[ShapeDrawingModal] Resize:', c);
      if (shape.type === 'textbox' && shape.geometry.type === 'Point') {
        const center = shape.geometry.coordinates as [number, number];
        const rot = (shape.rotation || 0) * (Math.PI / 180);
        const dx = c[0] - center[0];
        const dy = c[1] - center[1];
        // local'e çevir (rotate -rot)
        const lx = dx * Math.cos(-rot) - dy * Math.sin(-rot);
        const ly = dx * Math.sin(-rot) + dy * Math.cos(-rot);
        const nextW = Math.max(0.0001, Math.abs(lx) * 2);
        const nextH = Math.max(0.0001, Math.abs(ly) * 2);
        setShapes(prev =>
          prev.map(s => (s.id === resizeMode.shapeId ? { ...s, boxWidth: nextW, boxHeight: nextH } : s))
        );
      } else {
        const resizedShape = resizeShape(shape, c);
        setShapes(prev => prev.map(s => s.id === resizeMode.shapeId ? resizedShape : s));
      }
    } else if (rotationMode) {
      // Rotation işlemi - Dokunma pozisyonuna göre açı hesapla
      const shape = shapes.find(s => s.id === rotationMode.shapeId);
      if (!shape) {
        console.warn('[ShapeDrawingModal] Rotation: Shape bulunamadı', rotationMode.shapeId);
        return;
      }
      
      // Başlangıç açısı (yukarı = 90 derece)
      const startDx = rotationMode.startTouchPos[0] - rotationMode.startCenter[0];
      const startDy = rotationMode.startTouchPos[1] - rotationMode.startCenter[1];
      const startAngleRad = Math.atan2(startDy, startDx);
      
      // Yeni açı
      const dx = c[0] - rotationMode.startCenter[0];
      const dy = c[1] - rotationMode.startCenter[1];
      const newAngleRad = Math.atan2(dy, dx);
      
      // Açı farkı
      const angleDiffRad = newAngleRad - startAngleRad;
      const angleDiffDeg = angleDiffRad * (180 / Math.PI);
      // Rotation çok hızlı olmasın: hassasiyet azalt
      const ROTATION_SENSITIVITY = 0.35;
      const finalAngle = (rotationMode.startAngle + angleDiffDeg * ROTATION_SENSITIVITY + 360) % 360;
      
      console.log('[ShapeDrawingModal] Rotation:', { finalAngle, touchPos: c });
      if (shape.type === 'textbox') {
        setShapes(prev => prev.map(s => (s.id === rotationMode.shapeId ? { ...s, rotation: finalAngle } : s)));
      } else {
        const rotatedShape = rotateShape(shape, finalAngle);
        setShapes(prev => prev.map(s => s.id === rotationMode.shapeId ? rotatedShape : s));
      }
    } else {
      if (moveMode) {
        const shape = shapes.find(s => s.id === moveMode.shapeId);
        if (!shape) return;
        const prevTouch = moveMode.lastTouchPos;
        const dx = c[0] - prevTouch[0];
        const dy = c[1] - prevTouch[1];
        if (shape.geometry.type === 'Point') {
          const p = shape.geometry.coordinates as [number, number];
          const nextP: [number, number] = [p[0] + dx, p[1] + dy];
          setShapes(prev => prev.map(s => (s.id === moveMode.shapeId ? { ...s, geometry: { type: 'Point', coordinates: nextP } } : s)));
        }
        setMoveMode({ shapeId: moveMode.shapeId, lastTouchPos: c });
        return;
      }
      console.warn('[ShapeDrawingModal] handleHandleDrag: Ne resizeMode ne de rotationMode aktif');
    }
  }, [resizeMode, rotationMode, moveMode, shapes]);

  // Gerçek sürükleme: screen(px) -> lng/lat -> handleHandleDrag
  const handleDragFromScreenPoint = useCallback(async (x: number, y: number) => {
    const map = mapRef.current;
    if (!map || typeof map.getCoordinateFromView !== 'function') return;
    try {
      const res = await map.getCoordinateFromView([x, y]);
      let coord: [number, number] | null = null;

      if (Array.isArray(res) && res.length >= 2) {
        coord = [Number(res[0]), Number(res[1])];
      } else if (res && typeof res === 'object') {
        const lng = (res as any).lng ?? (res as any).longitude ?? (res as any)[0];
        const lat = (res as any).lat ?? (res as any).latitude ?? (res as any)[1];
        if (typeof lng === 'number' && typeof lat === 'number') coord = [lng, lat];
      }

      if (!coord || Number.isNaN(coord[0]) || Number.isNaN(coord[1])) return;
      handleHandleDrag({ geometry: { coordinates: coord }, lngLat: { lng: coord[0], lat: coord[1] } });
    } catch (err) {
      console.warn('[ShapeDrawingModal] getCoordinateFromView failed:', err);
    }
  }, [handleHandleDrag]);

  const endResizeRotation = useCallback(() => {
    if (resizeMode || rotationMode || moveMode) {
      console.log('[ShapeDrawingModal] Resize/Rotation bitti');
    }
    setResizeMode(null);
    setRotationMode(null);
    setMoveMode(null);
  }, [resizeMode, rotationMode, moveMode]);

  // Resize/Rotation modunda parmak sürüklemeyi yakalayan overlay responder
  // Not: useMemo ile mode değişince handler'lar güncellenir (stale closure olmaz)
  const dragPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !!(resizeMode || rotationMode || moveMode),
      onMoveShouldSetPanResponder: () => !!(resizeMode || rotationMode || moveMode),
      onPanResponderGrant: (evt) => {
        if (!(resizeMode || rotationMode || moveMode)) return;
        const { locationX, locationY } = evt.nativeEvent;
        handleDragFromScreenPoint(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        if (!(resizeMode || rotationMode || moveMode)) return;
        const { locationX, locationY } = evt.nativeEvent;
        handleDragFromScreenPoint(locationX, locationY);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {
        // Parmağı kaldırınca otomatik bitir
        endResizeRotation();
      },
      onPanResponderTerminate: () => {
        // Gesture başka bir şey tarafından kesilirse de bitir
        endResizeRotation();
      },
    });
  }, [resizeMode, rotationMode, moveMode, handleDragFromScreenPoint, endResizeRotation]);

  const handleMapPress = useCallback((e: any) => {
    let c: [number, number] | null = e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
    if (!c) return;

    // Resize/Rotation modu varsa önce onu kontrol et
    if (resizeMode || rotationMode) {
      console.log('[ShapeDrawingModal] handleMapPress: resize/rotation mode aktif, calling handleHandleDrag');
      handleHandleDrag(e);
      return;
    }
    
    // Seçili şekil varsa handle kontrolü yap (sadece 2 handle: mavi ve yeşil)
    if (selectedShapeId && !resizeMode && !rotationMode) {
      const selectedShape = shapes.find(s => s.id === selectedShapeId);
      if (selectedShape) {
        const bounds = getShapeBounds(selectedShape);
        
        // Mavi Resize Handle kontrolü (sağ üst köşe)
        const resizeHandlePos: [number, number] = [bounds.maxLon, bounds.maxLat];
        const distToResizeHandle = Math.sqrt(
          Math.pow(resizeHandlePos[0] - c[0], 2) +
          Math.pow(resizeHandlePos[1] - c[1], 2)
        );
        if (distToResizeHandle < 0.003) {
          console.log('[ShapeDrawingModal] Resize handle bulundu');
          handleHandlePress(selectedShapeId, 0);
          return;
        }
        
        // Yeşil Rotation Handle kontrolü (merkezin üstünde)
        if (selectedShape.type === 'rectangle' || selectedShape.type === 'triangle' || selectedShape.type === 'polygon' || selectedShape.geometry.type === 'LineString') {
          const rotationHandlePos: [number, number] = [bounds.center[0], bounds.maxLat + 0.0008];
          const distToRotationHandle = Math.sqrt(
            Math.pow(rotationHandlePos[0] - c[0], 2) +
            Math.pow(rotationHandlePos[1] - c[1], 2)
          );
          if (distToRotationHandle < 0.003) {
            console.log('[ShapeDrawingModal] Rotation handle bulundu');
            handleHandlePress(selectedShapeId, -1);
            return;
          }
        }
      }
    }
    
    if (measurementMode) {
      handleMeasurementPress(e);
      return;
    }
    if (parcelSelectMode) {
      handleParcelSelect(e);
      return;
    }
    if (shapeDrawingMode) {
      handleShapeDrawingPress(e);
    }
  }, [shapeDrawingMode, measurementMode, parcelSelectMode, resizeMode, rotationMode, selectedShapeId, shapes, handleShapeDrawingPress, handleMeasurementPress, handleParcelSelect, handleHandleDrag, handleHandlePress]);

  // index.tsx ile aynı yaklaşım: zoom/pitch/heading her zaman güncellenir, center programmatik animasyonda kesilir.
  const onCameraChanged = useCallback((e: any) => {
    const properties = e?.properties;
    const geometry = e?.geometry;

    const z = properties?.zoom ?? properties?.zoomLevel;
    const p = properties?.pitch;
    const h = properties?.heading ?? properties?.bearing;
    const c = geometry?.coordinates ?? properties?.centerCoordinate ?? properties?.center;

    if (typeof z === 'number') {
      camRef.current.zoom = z;
      setCameraZoom(prev => (Math.abs(prev - z) >= 0.1 ? z : prev));
    }
    if (typeof p === 'number') camRef.current.pitch = p;
    if (typeof h === 'number') camRef.current.heading = h;

    // UI pitch değerini güncelle (çok sık setState yapmayalım)
    if (typeof p === 'number' && !isProgrammaticMoveRef.current) {
      setPitchValue(prev => (Math.abs(prev - p) >= 2 ? p : prev));
    }

    // Programmatik animasyonda center güncellemesini kes (geri besleme riskli)
    if (isProgrammaticMoveRef.current) return;

    if (Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
      camRef.current.center = [c[0], c[1]];
    }
  }, []);

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

  // Şekil adı oluştur
  const getShapeName = (shape: ShapeProperties): string => {
    const typeNames: Record<ShapeType, string> = {
      rectangle: 'Kare',
      triangle: 'Üçgen',
      circle: 'Yuvarlak',
      ellipse: 'Elips',
      polygon: 'Çokgen',
      line: 'Çizgi',
      arrow: 'Ok',
      marker: 'Nokta',
      textbox: 'Metin',
    };
    return `${typeNames[shape.type]} ${shapes.indexOf(shape) + 1}`;
  };

  // Ölçüm adı oluştur
  const getMeasurementName = (feature: MeasurementFeature, index: number): string => {
    if (feature.properties.measurementType === 'ruler') {
      const label = feature.properties.label || '';
      return label ? `Mesafe: ${label}` : `Mesafe ${index + 1}`;
    } else if (feature.properties.measurementType === 'area') {
      const label = feature.properties.label || '';
      return label ? `Alan: ${label}` : `Alan ${index + 1}`;
    }
    return `Ölçüm ${index + 1}`;
  };

  const confirmDeleteMeasurement = useCallback((feature: MeasurementFeature, index: number) => {
    Alert.alert(
      'Ölçümü Sil',
      `${getMeasurementName(feature, index)} silinsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            const groupId = feature.properties.measurementGroupId;
            // Yeni akış: groupId üzerinden sil (label çakışmalarını önler)
            if (groupId) {
              setMeasurementFeatures(prev => prev.filter(f => f.properties.measurementGroupId !== groupId));
              return;
            }
            // Fallback: Eski davranış (groupId yoksa)
            const label = feature.properties.label;
            setMeasurementFeatures(prev => prev.filter(f => {
              if (f.properties.label === label && f.properties.measurementType === feature.properties.measurementType) {
                return false;
              }
              return true;
            }));
          },
        },
      ]
    );
  }, []);

  // Parsel adı oluştur
  const getParcelName = (parcel: any): string => {
    const props = parcel.properties || {};
    if (props.mahalleAd && props.adaNo && props.parselNo) {
      return `${props.mahalleAd} - Ada: ${props.adaNo}, Parsel: ${props.parselNo}`;
    }
    return `Parsel ${parcels.indexOf(parcel) + 1}`;
  };

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
            <Text style={styles.headerTitle}>Şekil Çizim</Text>
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Compact Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setToolbarCollapsed(!toolbarCollapsed)}
              style={styles.menuButton}
            >
              <Ionicons name={toolbarCollapsed ? "chevron-down" : "chevron-up"} size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Harita Araçları</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setManagementPanelVisible(!managementPanelVisible)}
              style={styles.managementButton}
            >
              <Ionicons name="list" size={18} color="#fff" />
              <Text style={styles.managementButtonText}>
                {managementPanelVisible ? 'Gizle' : 'Yönet'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Toolbar */}
        {!toolbarCollapsed && (
          <View style={styles.toolbarContainer}>
            {/* Şekiller Dropdown */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={[styles.dropdownButton, shapesDropdownOpen && styles.dropdownButtonActive]}
                onPress={() => {
                  setShapesDropdownOpen(!shapesDropdownOpen);
                  setMeasurementDropdownOpen(false);
                }}
              >
                <Ionicons name="shapes" size={16} color={shapesDropdownOpen ? '#3b82f6' : '#94a3b8'} />
                <Text style={[styles.dropdownButtonText, shapesDropdownOpen && styles.dropdownButtonTextActive]}>
                  Şekiller
                </Text>
                <Ionicons 
                  name={shapesDropdownOpen ? "chevron-up" : "chevron-down"} 
                  size={14} 
                  color={shapesDropdownOpen ? '#3b82f6' : '#94a3b8'} 
                />
              </TouchableOpacity>
              
              {shapesDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={styles.dropdownScrollView}>
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'rectangle' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'rectangle' ? null : 'rectangle');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="square-outline" size={16} color={shapeDrawingMode === 'rectangle' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'rectangle' && styles.dropdownMenuItemTextActive]}>
                    Kare
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'triangle' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'triangle' ? null : 'triangle');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="triangle-outline" size={16} color={shapeDrawingMode === 'triangle' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'triangle' && styles.dropdownMenuItemTextActive]}>
                    Üçgen
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'circle' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'circle' ? null : 'circle');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="ellipse-outline" size={16} color={shapeDrawingMode === 'circle' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'circle' && styles.dropdownMenuItemTextActive]}>
                    Yuvarlak
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'ellipse' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'ellipse' ? null : 'ellipse');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="ellipse" size={16} color={shapeDrawingMode === 'ellipse' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'ellipse' && styles.dropdownMenuItemTextActive]}>
                    Elips
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'polygon' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'polygon' ? null : 'polygon');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="git-merge-outline" size={16} color={shapeDrawingMode === 'polygon' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'polygon' && styles.dropdownMenuItemTextActive]}>
                    Çokgen
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'line' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'line' ? null : 'line');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="remove-outline" size={16} color={shapeDrawingMode === 'line' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'line' && styles.dropdownMenuItemTextActive]}>
                    Çizgi
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'arrow' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'arrow' ? null : 'arrow');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="arrow-forward-outline" size={16} color={shapeDrawingMode === 'arrow' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'arrow' && styles.dropdownMenuItemTextActive]}>
                    Ok
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'marker' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'marker' ? null : 'marker');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color={shapeDrawingMode === 'marker' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'marker' && styles.dropdownMenuItemTextActive]}>
                    Nokta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownMenuItem, shapeDrawingMode === 'textbox' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setShapeDrawingMode(shapeDrawingMode === 'textbox' ? null : 'textbox');
                    setShapeDrawingPoints([]);
                    setMeasurementMode(null);
                    setShapesDropdownOpen(false);
                  }}
                >
                  <Ionicons name="text-outline" size={16} color={shapeDrawingMode === 'textbox' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === 'textbox' && styles.dropdownMenuItemTextActive]}>
                    Metin
                  </Text>
                </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Ölçüm Dropdown */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={[styles.dropdownButton, measurementDropdownOpen && styles.dropdownButtonActive]}
                onPress={() => {
                  setMeasurementDropdownOpen(!measurementDropdownOpen);
                  setShapesDropdownOpen(false);
                }}
              >
                <Ionicons name="resize" size={16} color={measurementDropdownOpen ? '#3b82f6' : '#94a3b8'} />
                <Text style={[styles.dropdownButtonText, measurementDropdownOpen && styles.dropdownButtonTextActive]}>
                  Ölçüm
                </Text>
                <Ionicons 
                  name={measurementDropdownOpen ? "chevron-up" : "chevron-down"} 
                  size={14} 
                  color={measurementDropdownOpen ? '#3b82f6' : '#94a3b8'} 
                />
              </TouchableOpacity>
              
              {measurementDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={styles.dropdownScrollView}>
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, measurementMode === 'distance' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setMeasurementMode(measurementMode === 'distance' ? null : 'distance');
                    setMeasurementPoints([]);
                    setShapeDrawingMode(null);
                    setMeasurementDropdownOpen(false);
                  }}
                >
                  <Ionicons name="resize" size={16} color={measurementMode === 'distance' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, measurementMode === 'distance' && styles.dropdownMenuItemTextActive]}>
                    Mesafe
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, measurementMode === 'area' && styles.dropdownMenuItemActive]}
                  onPress={() => {
                    setMeasurementMode(measurementMode === 'area' ? null : 'area');
                    setMeasurementPoints([]);
                    setShapeDrawingMode(null);
                    setMeasurementDropdownOpen(false);
                  }}
                >
                  <Ionicons name="square" size={16} color={measurementMode === 'area' ? '#3b82f6' : '#94a3b8'} />
                  <Text style={[styles.dropdownMenuItemText, measurementMode === 'area' && styles.dropdownMenuItemTextActive]}>
                    Alan
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    setMeasurementFeatures([]);
                    setMeasurementPoints([]);
                    setMeasurementMode(null);
                    setMeasurementDropdownOpen(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.dropdownMenuItemText}>
                    Ölçümleri Temizle
                  </Text>
                </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Parsel Seç Butonu */}
            <TouchableOpacity
              style={[styles.parcelSelectButton, parcelSelectMode && styles.parcelSelectButtonActive]}
              onPress={() => {
                setParcelSelectMode(!parcelSelectMode);
                setShapeDrawingMode(null);
                setMeasurementMode(null);
                setShapesDropdownOpen(false);
                setMeasurementDropdownOpen(false);
              }}
            >
              <Ionicons name="location" size={16} color={parcelSelectMode ? '#fff' : '#94a3b8'} />
              <Text style={[styles.parcelSelectButtonText, parcelSelectMode && styles.parcelSelectButtonTextActive]}>
                {isLoadingParcel ? 'Yükleniyor...' : 'Parsel Seç'}
              </Text>
            </TouchableOpacity>
          </View>
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

              return (
                <View style={styles.mapWrapper}>
                  <Mapbox.MapView
                    ref={mapRef}
                    style={styles.map}
                    styleURL={Mapbox.StyleURL?.Satellite || Mapbox.StyleURL?.Default || Mapbox.StyleURL?.Street}
                    logoEnabled={false}
                    attributionEnabled={false}
                  scaleBarEnabled={false}
                    scrollEnabled={!(resizeMode || rotationMode || moveMode)} // Edit modunda harita hareketini engelle
                    zoomEnabled={!(resizeMode || rotationMode || moveMode)} // Edit modunda zoom'u engelle
                    pitchEnabled={!(resizeMode || rotationMode || moveMode)} // Edit modunda pitch'i engelle
                    rotateEnabled={!(resizeMode || rotationMode || moveMode)} // Edit modunda rotate'i engelle
                    onPress={handleMapPress}
                    onLongPress={handleMapLongPress}
                    onCameraChanged={onCameraChanged}
                    onError={(error: any) => {
                      console.error('[ShapeDrawingModal] MapView error:', error);
                    }}
                  >
                  {Mapbox.Camera && (
                    <Mapbox.Camera
                      ref={cameraRef}
                      defaultSettings={{
                        centerCoordinate: center,
                        zoomLevel: zoom,
                        pitch: 0,
                        heading: 0,
                      }}
                    />
                  )}

                  {/* Terrain (DEM) */}
                  {RasterDemSource && Terrain && (
                    <RasterDemSource
                      id="terrain-source-modal"
                      url="mapbox://mapbox.terrain-rgb"
                      tileSize={512}
                      maxZoomLevel={15}
                    >
                      <Terrain style={{ exaggeration: 1.2 }} />
                    </RasterDemSource>
                  )}

                  {/* Measurement Layer */}
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
                        <Mapbox.ShapeSource key={`meas-poly-${i}`} id={`meas-poly-${i}`} shape={f}>
                          <Mapbox.FillLayer 
                            id={`meas-poly-fill-${i}`} 
                            style={{ 
                              fillColor: '#FBBF24', 
                              fillOpacity: 0.3 
                            }} 
                          />
                          <Mapbox.LineLayer 
                            id={`meas-poly-line-${i}`} 
                            style={{ 
                              lineColor: '#FBBF24', 
                              lineWidth: 3 
                            }} 
                          />
                        </Mapbox.ShapeSource>
                      );
                    }
                    
                    // Label feature (mesafe/alan etiketleri)
                    if (hasLabel && isLabelOnly) {
                      return (
                        <Mapbox.ShapeSource key={`meas-label-${i}`} id={`meas-label-${i}`} shape={f}>
                          <Mapbox.SymbolLayer 
                            id={`meas-label-layer-${i}`} 
                            style={{ 
                              textField: ['get', 'label'],
                              textSize: 12,
                              textColor: isRuler ? '#3B82F6' : '#FBBF24',
                              textHaloColor: '#ffffff',
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

                  {/* Selected Parcels Layer */}
                  {parcels.map((parcel) => {
                    if (!parcel.geometry) return null;
                    const isSelected = selectedParcel?.id === parcel.id;
                    return (
                      <Mapbox.ShapeSource
                        key={parcel.id}
                        id={`parcel-${parcel.id}`}
                        shape={{
                          type: 'Feature',
                          geometry: parcel.geometry,
                          properties: {},
                        }}
                      >
                        <Mapbox.FillLayer
                          id={`parcel-fill-${parcel.id}`}
                          style={{
                            fillColor: isSelected ? '#3b82f6' : '#64748b',
                            fillOpacity: isSelected ? 0.3 : 0.2,
                          }}
                        />
                        <Mapbox.LineLayer
                          id={`parcel-line-${parcel.id}`}
                          style={{
                            lineColor: isSelected ? '#3b82f6' : '#94a3b8',
                            lineWidth: isSelected ? 3 : 2,
                          }}
                        />
                      </Mapbox.ShapeSource>
                    );
                  })}

                  {/* Shapes Layer */}
                  {shapes.length > 0 && (
                    <ShapesLayer
                      shapes={shapes}
                      selectedShapeId={selectedShapeId}
                      cameraZoom={cameraZoom}
                      onShapePress={(shapeId) => {
                        // Resize/Rotation modu varsa önce onu bitir
                        if (resizeMode || rotationMode) {
                          setResizeMode(null);
                          setRotationMode(null);
                          return;
                        }
                        const pressedShape = shapes.find(s => s.id === shapeId);

                        // TextBox: tek tıkla "özellik panelini" aç
                        if (pressedShape?.type === 'textbox') {
                          setSelectedShapeId(shapeId);
                          setShapeEditPanelVisible(true);
                          setShapeEditPanelMinimized(false);
                          return;
                        }

                        setSelectedShapeId(prev => {
                          const shouldDeselect = prev === shapeId && pressedShape?.type !== 'textbox';
                          const newSelected = shouldDeselect ? null : shapeId;
                          setShapeEditPanelVisible(newSelected !== null);
                          setShapeEditPanelMinimized(false); // Panel açıldığında minimize durumunu sıfırla
                          return newSelected;
                        });
                      }}
                      onHandlePress={handleHandlePress}
                      Mapbox={Mapbox}
                    />
                  )}
                  </Mapbox.MapView>

                  {/* Model sayfası: sağ-orta 3D yön/açı kontrolleri (zoom panel mantığı) */}
                  {!navControlsVisible ? (
                    <View style={styles.navControlsWrapper} pointerEvents="box-none">
                      <TouchableOpacity
                        style={styles.navControlTrigger}
                        onPress={() => setNavControlsVisible(true)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.navControlLineContainer}>
                          <View style={styles.navControlLine} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.navControlsWrapper} pointerEvents="auto">
                      <View style={styles.navControlAreaProtector} />
                      <TouchableOpacity
                        style={styles.navControlCloseHandle}
                        onPress={() => {
                          stopHeadingChange();
                          stopZoomChange();
                          stopPitchChange();
                          setNavControlsVisible(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.navControlCloseLineContainer}>
                          <View style={styles.navControlCloseLine} />
                        </View>
                      </TouchableOpacity>

                      <View style={styles.navControlsPanel}>
                        <View style={styles.controlsLayoutWrapper}>
                          {/* Zoom + Heading grid */}
                          <View style={styles.mapControlsPanel} pointerEvents="auto">
                            <View style={styles.mapControlsRow}>
                              <View style={styles.mapControlSpacer} />
                              <TouchableOpacity
                                onPressIn={() => startZoomChange(1.0)}
                                onPressOut={stopZoomChange}
                                style={styles.mapControlButton}
                              >
                                <Ionicons name="chevron-up" size={20} color="#3b82f6" />
                              </TouchableOpacity>
                              <View style={styles.mapControlSpacer} />
                            </View>
                            <View style={styles.mapControlsRow}>
                              <TouchableOpacity
                                onPressIn={() => startHeadingChange(15)}
                                onPressOut={stopHeadingChange}
                                style={styles.mapControlButton}
                              >
                                <Ionicons name="chevron-back" size={20} color="#3b82f6" />
                              </TouchableOpacity>
                              <View style={styles.mapControlSpacer} />
                              <TouchableOpacity
                                onPressIn={() => startHeadingChange(-15)}
                                onPressOut={stopHeadingChange}
                                style={styles.mapControlButton}
                              >
                                <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.mapControlsRow}>
                              <View style={styles.mapControlSpacer} />
                              <TouchableOpacity
                                onPressIn={() => startZoomChange(-1.0)}
                                onPressOut={stopZoomChange}
                                style={styles.mapControlButton}
                              >
                                <Ionicons name="chevron-down" size={20} color="#3b82f6" />
                              </TouchableOpacity>
                              <View style={styles.mapControlSpacer} />
                            </View>
                          </View>

                          {/* Pitch controls */}
                          <View style={styles.pitchControlsContainer} pointerEvents="auto">
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
                      </View>
                    </View>
                  )}

                  {(resizeMode || rotationMode || moveMode) && (
                    <View
                      style={styles.dragOverlay}
                      pointerEvents="auto"
                      {...dragPanResponder.panHandlers}
                    />
                  )}
                </View>
              );
            } catch (error) {
              console.error('[ShapeDrawingModal] Map render error:', error);
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

        {/* Selected Parcel Info Panel */}
        {selectedParcel && !shapeEditPanelVisible && !managementPanelVisible && (
          <View style={[styles.parcelInfoPanel, { bottom: insets.bottom + 20 }]}>
            <View style={styles.parcelInfoHeader}>
              <Ionicons name="location" size={16} color="#3b82f6" />
              <Text style={styles.parcelInfoTitle}>Seçili Parsel</Text>
              <TouchableOpacity
                onPress={() => setSelectedParcel(null)}
                style={styles.parcelInfoCloseButton}
              >
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {selectedParcel.properties && (
              <View style={styles.parcelInfoContent}>
                {selectedParcel.properties.mahalleAd && (
                  <Text style={styles.parcelInfoText}>
                    <Text style={styles.parcelInfoLabel}>Mahalle: </Text>
                    {selectedParcel.properties.mahalleAd}
                  </Text>
                )}
                {selectedParcel.properties.adaNo && (
                  <Text style={styles.parcelInfoText}>
                    <Text style={styles.parcelInfoLabel}>Ada: </Text>
                    {selectedParcel.properties.adaNo}
                  </Text>
                )}
                {selectedParcel.properties.parselNo && (
                  <Text style={styles.parcelInfoText}>
                    <Text style={styles.parcelInfoLabel}>Parsel: </Text>
                    {selectedParcel.properties.parselNo}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Shape Edit Panel */}
        {shapeEditPanelVisible && selectedShapeId && (() => {
          const selectedShape = shapes.find(s => s.id === selectedShapeId);
          if (!selectedShape) return null;
          
          // Panel footer'a kadar gitsin, boşluk panel içinde olacak
          const bottomOffset = Math.max(insets.bottom, 0); // Footer'a kadar
          // Panel yüksekliği: Ekran yüksekliği - footer yüksekliği (boşluk içeride olacak)
          const maxPanelHeight = Math.min(SCREEN_HEIGHT * 0.5, 300); // Maksimum 300px veya ekranın %50'si
          const headerHeight = 50; // Header yaklaşık yüksekliği
          const scrollViewMaxHeight = maxPanelHeight - headerHeight;
          
          return (
            <View 
              style={[
                styles.editPanel, 
                { 
                  bottom: bottomOffset, // Footer'a kadar, içeride boşluk olacak
                  maxHeight: shapeEditPanelMinimized ? 50 : maxPanelHeight, // Minimize edildiğinde sadece header
                }
              ]}
              pointerEvents={shapeEditPanelMinimized ? "none" : "auto"} // Minimize edildiğinde tıklamalar geçsin
            >
              <View 
                style={styles.editPanelHeader}
                pointerEvents="auto" // Header her zaman tıklanabilir
              >
                <Text style={styles.editPanelTitle}>Şekil Düzenle</Text>
                <View style={styles.editPanelHeaderButtons}>
                  <TouchableOpacity
                    onPress={() => {
                      setShapeEditPanelMinimized(!shapeEditPanelMinimized);
                    }}
                    style={styles.editPanelMinimizeButton}
                  >
                    <Ionicons 
                      name={shapeEditPanelMinimized ? "chevron-up" : "chevron-down"} 
                      size={18} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShapeEditPanelVisible(false);
                      setSelectedShapeId(null);
                      setShapeEditPanelMinimized(false);
                    }}
                    style={styles.editPanelCloseButton}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {!shapeEditPanelMinimized && (
                <ScrollView 
                  style={[
                    styles.editPanelContent,
                    { maxHeight: scrollViewMaxHeight }
                  ]}
                  contentContainerStyle={[
                    styles.editPanelContentContainer,
                    { paddingBottom: Math.max(insets.bottom, 0) + 100 } // Footer için içeride boşluk
                  ]}
                >
                {/* Renk Düzenleme */}
                <View style={styles.editSection}>
                  <Text style={styles.editSectionTitle}>Renkler</Text>
                  <View style={styles.colorRow}>
                    <View style={styles.colorInputGroup}>
                      <Text style={styles.colorLabel}>Çizgi</Text>
                      <TouchableOpacity
                        style={[styles.colorButton, { backgroundColor: selectedShape.outlineColor || '#2563eb' }]}
                        onPress={() => {
                          // Basit renk seçimi - daha sonra color picker eklenebilir
                          const colors = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                          const currentIndex = colors.indexOf(selectedShape.outlineColor || '#2563eb');
                          const nextColor = colors[(currentIndex + 1) % colors.length];
                          setShapes(prev => prev.map(s => 
                            s.id === selectedShapeId ? { ...s, outlineColor: nextColor } : s
                          ));
                        }}
                      />
                    </View>
                    {(selectedShape.geometry.type === 'Polygon' || selectedShape.type === 'circle' || selectedShape.type === 'ellipse' || selectedShape.type === 'textbox') && (
                      <View style={styles.colorInputGroup}>
                        <Text style={styles.colorLabel}>Dolgu</Text>
                        <TouchableOpacity
                          style={[styles.colorButton, { backgroundColor: selectedShape.fillColor || '#3b82f6' }]}
                          onPress={() => {
                            const colors = ['#3b82f6', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];
                            const currentIndex = colors.indexOf(selectedShape.fillColor || '#3b82f6');
                            const nextColor = colors[(currentIndex + 1) % colors.length];
                            setShapes(prev => prev.map(s => 
                              s.id === selectedShapeId ? { ...s, fillColor: nextColor } : s
                            ));
                          }}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* Kalınlık ve Opaklık */}
                {(selectedShape.geometry.type === 'Polygon' || selectedShape.geometry.type === 'LineString' || selectedShape.type === 'textbox') && (
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Kalınlık: {selectedShape.outlineWidth || 2}px</Text>
                    <View style={styles.sliderRow}>
                      <Text style={styles.sliderLabel}>1</Text>
                      <View style={styles.sliderContainer}>
                        <View style={[styles.sliderTrack, { width: `${((selectedShape.outlineWidth || 2) - 1) / 9 * 100}%` }]} />
                      </View>
                      <Text style={styles.sliderLabel}>10</Text>
                    </View>
                    <View style={styles.sliderButtons}>
                      {[1, 2, 3, 4, 5].map(w => (
                        <TouchableOpacity
                          key={w}
                          style={[styles.sliderButton, (selectedShape.outlineWidth || 2) === w && styles.sliderButtonActive]}
                          onPress={() => {
                            setShapes(prev => prev.map(s => 
                              s.id === selectedShapeId ? { ...s, outlineWidth: w } : s
                            ));
                          }}
                        >
                          <Text style={styles.sliderButtonText}>{w}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* TextBox gelişmiş ayarlar */}
                {selectedShape.type === 'textbox' && (
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Metin Kutusu</Text>

                    <View style={styles.sliderButtons}>
                      <TouchableOpacity
                        style={[styles.sliderButton, styles.sliderButtonActive]}
                        onPress={() => {
                          if (selectedShapeId) openTextBoxEditor(selectedShapeId);
                        }}
                      >
                        <Text style={styles.sliderButtonText}>Metni Düzenle</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>
                      Yazı Boyutu: {(selectedShape as any).textSize || 14}
                    </Text>
                    <View style={styles.sliderButtons}>
                      {[12, 14, 16, 18, 20, 24].map(sz => (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sliderButton, ((selectedShape as any).textSize || 14) === sz && styles.sliderButtonActive]}
                          onPress={() => {
                            setShapes(prev => prev.map(s =>
                              s.id === selectedShapeId ? { ...s, textSize: sz } : s
                            ));
                          }}
                        >
                          <Text style={styles.sliderButtonText}>{sz}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>
                      Yazı Rengi
                    </Text>
                    <View style={styles.sliderButtons}>
                      {['#ffffff', '#000000', '#f8fafc', '#f59e0b', '#10b981', '#3b82f6'].map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.sliderButton, { backgroundColor: c, borderWidth: 1, borderColor: '#334155' }]}
                          onPress={() => {
                            setShapes(prev => prev.map(s =>
                              s.id === selectedShapeId ? { ...s, textColor: c } : s
                            ));
                          }}
                        >
                          <Text style={styles.sliderButtonText}></Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>
                      Köşe Radius
                    </Text>
                    <View style={styles.sliderButtons}>
                      {[
                        { label: '0', v: 0 },
                        { label: 'S', v: 0.00004 },
                        { label: 'M', v: 0.00008 },
                        { label: 'L', v: 0.00012 },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.sliderButton, ((selectedShape as any).boxCornerRadius || 0) === opt.v && styles.sliderButtonActive]}
                          onPress={() => {
                            setShapes(prev => prev.map(s =>
                              s.id === selectedShapeId ? { ...s, boxCornerRadius: opt.v } : s
                            ));
                          }}
                        >
                          <Text style={styles.sliderButtonText}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>
                      Gölge
                    </Text>
                    <View style={styles.sliderButtons}>
                      <TouchableOpacity
                        style={[styles.sliderButton, (selectedShape as any).shadowEnabled !== false && styles.sliderButtonActive]}
                        onPress={() => {
                          const enabled = (selectedShape as any).shadowEnabled !== false;
                          setShapes(prev => prev.map(s =>
                            s.id === selectedShapeId ? { ...s, shadowEnabled: !enabled } : s
                          ));
                        }}
                      >
                        <Text style={styles.sliderButtonText}>
                          {(selectedShape as any).shadowEnabled !== false ? 'Açık' : 'Kapalı'}
                        </Text>
                      </TouchableOpacity>
                      {[0.15, 0.25, 0.35, 0.5].map(op => (
                        <TouchableOpacity
                          key={op}
                          style={[styles.sliderButton, ((selectedShape as any).shadowOpacity || 0.35) === op && styles.sliderButtonActive]}
                          onPress={() => {
                            setShapes(prev => prev.map(s =>
                              s.id === selectedShapeId ? { ...s, shadowOpacity: op, shadowEnabled: true } : s
                            ));
                          }}
                        >
                          <Text style={styles.sliderButtonText}>{Math.round(op * 100)}%</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.editSectionTitle, { marginTop: 10 }]}>
                      Yazı Tipi
                    </Text>
                    <View style={styles.sliderButtons}>
                      {['Open Sans Regular', 'Open Sans Semibold', 'Arial Unicode MS Regular'].map(f => (
                        <TouchableOpacity
                          key={f}
                          style={[styles.sliderButton, ((selectedShape as any).textFont || 'Open Sans Regular') === f && styles.sliderButtonActive]}
                          onPress={() => {
                            setShapes(prev => prev.map(s =>
                              s.id === selectedShapeId ? { ...s, textFont: f } : s
                            ));
                          }}
                        >
                          <Text style={styles.sliderButtonText}>{f.split(' ')[0]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Sil Butonu */}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    Alert.alert(
                      'Şekli Sil',
                      'Bu şekli silmek istediğinize emin misiniz?',
                      [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'Sil',
                          style: 'destructive',
                          onPress: () => {
                            setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
                            setSelectedShapeId(null);
                            setShapeEditPanelVisible(false);
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                  <Text style={styles.deleteButtonText}>Şekli Sil</Text>
                </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          );
        })()}

        {/* Management Panel - Tab System */}
        {managementPanelVisible && (() => {
          const bottomOffset = Math.max(insets.bottom, 0) + 30; // En az 30px yukarıda
          // Panel'in maksimum yüksekliği: Ekran yüksekliğinin %40'ı veya maksimum 350px
          // Footer'ı hesaba katarak
          const availableHeight = SCREEN_HEIGHT - bottomOffset;
          const maxPanelHeight = Math.min(availableHeight * 0.4, 350);
          const finalMaxHeight = Math.max(maxPanelHeight, 250); // Minimum 250px
          const tabNavHeight = 50; // Tab navigation yaklaşık yüksekliği
          const scrollViewMaxHeight = finalMaxHeight - tabNavHeight; // ScrollView için kalan alan
          
          console.log('[ShapeDrawingModal] Management Panel', { 
            insetsBottom: insets.bottom, 
            bottomOffset, 
            availableHeight,
            maxPanelHeight,
            finalMaxHeight,
            scrollViewMaxHeight,
            screenHeight: SCREEN_HEIGHT 
          });
          return (
            <View style={[
              styles.managementPanel, 
              { 
                bottom: bottomOffset,
                maxHeight: finalMaxHeight,
              }
            ]}>
            {/* Tab Navigation */}
            <View style={styles.tabNavigation}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'shapes' && styles.tabButtonActive]}
                onPress={() => setActiveTab('shapes')}
              >
                <Ionicons name="shapes" size={16} color={activeTab === 'shapes' ? '#fff' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, activeTab === 'shapes' && styles.tabButtonTextActive]}>
                  Şekiller ({shapes.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'measurements' && styles.tabButtonActive]}
                onPress={() => setActiveTab('measurements')}
              >
                <Ionicons name="resize" size={16} color={activeTab === 'measurements' ? '#fff' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, activeTab === 'measurements' && styles.tabButtonTextActive]}>
                  Ölçümler ({measurementFeatures.filter(f => !f.properties.isTemporary && !f.properties.isLabelOnly).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'parcels' && styles.tabButtonActive]}
                onPress={() => setActiveTab('parcels')}
              >
                <Ionicons name="location" size={16} color={activeTab === 'parcels' ? '#fff' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, activeTab === 'parcels' && styles.tabButtonTextActive]}>
                  Parseller ({parcels.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <ScrollView 
              style={[
                styles.tabContent,
                { maxHeight: scrollViewMaxHeight } // Tab navigation yüksekliği çıkarılmış
              ]}
              contentContainerStyle={[
                styles.tabContentContainer,
                { paddingBottom: Math.max(insets.bottom, 0) + 100 } // Footer + ekstra padding
              ]}
              showsVerticalScrollIndicator={true}
            >
              {/* Shapes Tab */}
              {activeTab === 'shapes' && (
                <View style={styles.tabContentInner}>
                  {shapes.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="shapes-outline" size={32} color="#64748b" />
                      <Text style={styles.emptyStateText}>Henüz şekil çizilmedi</Text>
                    </View>
                  ) : (
                    shapes.map((shape, index) => (
                      <View key={shape.id} style={styles.listItem}>
                        <View style={styles.listItemContent}>
                          <Ionicons 
                            name={shape.type === 'rectangle' ? 'square-outline' : 
                                  shape.type === 'triangle' ? 'triangle-outline' :
                                  shape.type === 'circle' ? 'ellipse-outline' :
                                  shape.type === 'ellipse' ? 'ellipse' :
                                  shape.type === 'polygon' ? 'git-merge-outline' :
                                  shape.type === 'line' ? 'remove-outline' :
                                  shape.type === 'arrow' ? 'arrow-forward-outline' :
                                  shape.type === 'marker' ? 'location-outline' :
                                  'text-outline'} 
                            size={20} 
                            color={selectedShapeId === shape.id ? '#3b82f6' : '#94a3b8'} 
                          />
                          <Text style={[styles.listItemText, selectedShapeId === shape.id && styles.listItemTextActive]}>
                            {getShapeName(shape)}
                          </Text>
                        </View>
                        <View style={styles.listItemActions}>
                          <TouchableOpacity
                            style={styles.listItemActionButton}
                            onPress={() => {
                              setSelectedShapeId(shape.id);
                              setShapeEditPanelVisible(true);
                              setShapeEditPanelMinimized(false); // Panel açıldığında minimize durumunu sıfırla
                              setManagementPanelVisible(false);
                            }}
                          >
                            <Ionicons name="create-outline" size={18} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.listItemActionButton}
                            onPress={() => {
                              Alert.alert(
                                'Şekli Sil',
                                `${getShapeName(shape)} silinsin mi?`,
                                [
                                  { text: 'İptal', style: 'cancel' },
                                  {
                                    text: 'Sil',
                                    style: 'destructive',
                                    onPress: () => {
                                      setShapes(prev => prev.filter(s => s.id !== shape.id));
                                      if (selectedShapeId === shape.id) {
                                        setSelectedShapeId(null);
                                        setShapeEditPanelVisible(false);
                                      }
                                    },
                                  },
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                  {/* Footer için ekstra boşluk */}
                  <View style={{ height: Math.max(insets.bottom, 0) + 150 }} />
                </View>
              )}

              {/* Measurements Tab */}
              {activeTab === 'measurements' && (
                <View style={styles.tabContentInner}>
                  {measurementFeatures.filter(f => !f.properties.isTemporary && !f.properties.isLabelOnly).length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="resize-outline" size={32} color="#64748b" />
                      <Text style={styles.emptyStateText}>Henüz ölçüm yapılmadı</Text>
                    </View>
                  ) : (
                    measurementFeatures
                      .filter(f => !f.properties.isTemporary && !f.properties.isLabelOnly)
                      .map((feature, index) => (
                        <TouchableOpacity
                          key={`meas-${index}`}
                          style={styles.listItem}
                          activeOpacity={0.85}
                          delayLongPress={320}
                          onLongPress={() => confirmDeleteMeasurement(feature, index)}
                        >
                          <View style={styles.listItemContent}>
                            <Ionicons 
                              name={feature.properties.measurementType === 'ruler' ? 'resize' : 'square'} 
                              size={20} 
                              color="#3b82f6" 
                            />
                            <Text style={styles.listItemText}>
                              {getMeasurementName(feature, index)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.listItemActionButton}
                            onPress={() => confirmDeleteMeasurement(feature, index)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))
                  )}
                  {/* Footer için ekstra boşluk */}
                  <View style={{ height: Math.max(insets.bottom, 0) + 150 }} />
                </View>
              )}

              {/* Parcels Tab */}
              {activeTab === 'parcels' && (
                <View style={styles.tabContentInner}>
                  {parcels.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="location-outline" size={32} color="#64748b" />
                      <Text style={styles.emptyStateText}>Henüz parsel seçilmedi</Text>
                    </View>
                  ) : (
                    parcels.map((parcel) => (
                      <View key={parcel.id} style={styles.listItem}>
                        <View style={styles.listItemContent}>
                          <Ionicons 
                            name="location" 
                            size={20} 
                            color={selectedParcel?.id === parcel.id ? '#3b82f6' : '#94a3b8'} 
                          />
                          <Text style={[styles.listItemText, selectedParcel?.id === parcel.id && styles.listItemTextActive]}>
                            {getParcelName(parcel)}
                          </Text>
                        </View>
                        <View style={styles.listItemActions}>
                          <TouchableOpacity
                            style={styles.listItemActionButton}
                            onPress={() => {
                              setSelectedParcel(parcel);
                              setManagementPanelVisible(false);
                            }}
                          >
                            <Ionicons name="eye-outline" size={18} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.listItemActionButton}
                            onPress={() => {
                              Alert.alert(
                                'Parseli Sil',
                                `${getParcelName(parcel)} silinsin mi?`,
                                [
                                  { text: 'İptal', style: 'cancel' },
                                  {
                                    text: 'Sil',
                                    style: 'destructive',
                                    onPress: () => {
                                      setParcels(prev => prev.filter(p => p.id !== parcel.id));
                                      if (selectedParcel?.id === parcel.id) {
                                        setSelectedParcel(null);
                                      }
                                    },
                                  },
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                  {/* Footer için ekstra boşluk */}
                  <View style={{ height: Math.max(insets.bottom, 0) + 150 }} />
                </View>
              )}
            </ScrollView>
          </View>
          );
        })()}

        {/* Info Text */}
        {(shapeDrawingMode || measurementMode || parcelSelectMode || resizeMode || rotationMode) && !shapeEditPanelVisible && !managementPanelVisible && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {resizeMode && 'Haritanın herhangi bir yerine dokunarak şekli büyütüp küçültebilirsiniz. Uzun basarak bitirin.'}
              {rotationMode && 'Haritanın herhangi bir yerine dokunarak şekli döndürebilirsiniz. Uzun basarak bitirin.'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'rectangle' && 'İki nokta tıklayın (başlangıç, bitiş)'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'triangle' && 'Üç nokta tıklayın'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'circle' && 'İki nokta tıklayın (merkez, yarıçap)'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'ellipse' && 'Üç nokta tıklayın (merkez, eksen1, eksen2)'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'polygon' && 'Noktalar tıklayın, uzun basarak bitirin'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'line' && 'Noktalar tıklayın, uzun basarak bitirin'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'arrow' && 'İki nokta tıklayın (başlangıç, bitiş)'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'marker' && 'Bir nokta tıklayın'}
              {!resizeMode && !rotationMode && shapeDrawingMode === 'textbox' && 'Bir nokta tıklayın'}
              {!resizeMode && !rotationMode && measurementMode === 'distance' && 'İki nokta tıklayın (mesafe ölçümü)'}
              {!resizeMode && !rotationMode && measurementMode === 'area' && 'Noktalar tıklayın, uzun basarak bitirin (alan ölçümü)'}
              {!resizeMode && !rotationMode && parcelSelectMode && 'Haritada bir noktaya tıklayın (parsel seçimi)'}
            </Text>
          </View>
        )}

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
            setShapes(prev => prev.map(s => (s.id === id ? { ...s, text: String(nextText ?? '') } : s)));
            setTextBoxEditVisible(false);
            setTextBoxEditShapeId(null);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#334155',
    borderRadius: 6,
    gap: 6,
  },
  managementButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  menuButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  toolbarContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'flex-start',
  },
  dropdownContainer: {
    flex: 1,
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 6,
    gap: 6,
    minHeight: 32,
  },
  dropdownButtonActive: {
    backgroundColor: '#3b82f6',
  },
  dropdownButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  dropdownButtonTextActive: {
    color: '#fff',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dropdownMenuItemActive: {
    backgroundColor: '#334155',
  },
  dropdownMenuItemText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  dropdownMenuItemTextActive: {
    color: '#3b82f6',
  },
  parcelSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 6,
    gap: 6,
    minHeight: 32,
    minWidth: 100,
  },
  parcelSelectButtonActive: {
    backgroundColor: '#3b82f6',
  },
  parcelSelectButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  parcelSelectButtonTextActive: {
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  // Sağ-orta aç/kapat (index sayfasındaki zoom panel mantığı)
  navControlsWrapper: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -32 }],
    zIndex: 900, // dragOverlay (999) üstüne çıkmasın
  },
  navControlTrigger: {
    width: 44,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navControlLineContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navControlLine: {
    width: 3,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  navControlsPanel: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    elevation: 15,
    alignItems: 'center',
    minWidth: 170,
    // navControlAreaProtector (zIndex: 899) üstünde kalsın ki butonlar tıklanabilsin
    zIndex: 900,
  },
  navControlAreaProtector: {
    position: 'absolute',
    left: -40,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 899,
    width: '100%',
    height: '100%',
  },
  navControlCloseHandle: {
    position: 'absolute',
    left: -32,
    width: 32,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 901,
  },
  navControlCloseLineContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navControlCloseLine: {
    width: 3,
    height: 40,
    backgroundColor: '#64748b',
    borderRadius: 2,
  },
  controlsLayoutWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 12,
  },
  mapControlsPanel: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    elevation: 15,
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  mapControlButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  mapControlSpacer: {
    width: 30,
    height: 30,
  },
  pitchControlsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    elevation: 15,
    alignItems: 'center',
    width: 50,
    height: 110,
    justifyContent: 'center',
  },
  pitchButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  pitchValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginVertical: 4,
  },
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
  },
  infoContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderTopWidth: 1,
    borderTopColor: '#475569',
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
  },
  editPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10, // Handle'ların üstünde olmamalı - düşük z-index
    // bottom ve maxHeight değerleri dinamik olarak ayarlanacak
  },
  editPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  editPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  editPanelHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPanelMinimizeButton: {
    padding: 4,
  },
  editPanelCloseButton: {
    padding: 4,
  },
  editPanelContent: {
    flex: 1, // ScrollView'in tüm alanı kullanmasını sağla
  },
  editPanelContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editSection: {
    marginBottom: 16,
  },
  editSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 16,
  },
  colorInputGroup: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 10,
    color: '#94a3b8',
    width: 20,
  },
  sliderContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  sliderButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sliderButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 6,
    alignItems: 'center',
  },
  sliderButtonActive: {
    backgroundColor: '#3b82f6',
  },
  sliderButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  parcelInfoPanel: {
    position: 'absolute',
    // bottom değeri dinamik olarak insets.bottom ile ayarlanacak
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  parcelInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  parcelInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  parcelInfoCloseButton: {
    padding: 4,
  },
  parcelInfoContent: {
    gap: 4,
  },
  parcelInfoText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  parcelInfoLabel: {
    fontWeight: '600',
    color: '#fff',
  },
  managementPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    // bottom ve maxHeight değerleri dinamik olarak ayarlanacak
  },
  tabNavigation: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#0f172a',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1, // ScrollView'in tüm alanı kullanmasını sağla
    maxHeight: 280, // ScrollView'in maksimum yüksekliği - footer için yer bırak
  },
  tabContentContainer: {
    paddingBottom: 150, // Footer için yeterli padding - ScrollView içeriği için
    flexGrow: 1, // İçeriğin büyümesine izin ver
  },
  tabContentInner: {
    padding: 12,
    paddingBottom: 20, // İçerik için padding
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    marginBottom: 8,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  listItemText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  listItemTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  listItemActionButton: {
    padding: 6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ShapeDrawingModal;
