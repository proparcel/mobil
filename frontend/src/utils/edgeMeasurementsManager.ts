/**
 * Edge Measurements Manager
 * Mobil uygulama için kenar ölçüleri görselleştirme utility
 * Ana projedeki edge-measure-map.js mantığını React Native Mapbox formatına adapte eder
 */

import { GeoJSONGeometry } from '../../src/types/parcelResponse';

// Renk kodları (ana projeden aynı)
const EDGE_COLORS: Record<string, string> = {
  'edge1': '#dc2626', // kırmızı
  'edge2': '#2563eb', // mavi
  'edge3': '#059669', // yeşil
  'edge4': '#d97706', // turuncu
};

export interface BBoxInfo {
  center: [number, number]; // [lon, lat]
  rotation_deg?: number;
  width_m?: number;
  height_m?: number;
  bbox_bearings?: number[]; // [edge1, edge2, edge3, edge4] için bearing'ler
}

export interface EdgeMeasureData {
  bbox?: BBoxInfo;
  main_edges?: Array<{
    bbox_edge?: string; // 'edge1' | 'edge2' | 'edge3' | 'edge4'
    sum_m?: number;
  }>;
  segment_lengths?: number[];
  segment_assignments?: string[]; // ['edge1', 'edge2', ...]
  segment_bearings?: number[];
  all_edge_groups?: any[];
  [key: string]: any;
}

export interface EdgeMeasurementFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString' | 'Point';
    coordinates: number[] | number[][];
  };
  properties: {
    kind: 'bbox' | 'segment' | 'main_edge';
    text?: string; // Label metni (örn: "25m", "12.5m")
    color?: string; // Edge rengi (#dc2626, #2563eb, vb.)
    edgeIndex?: number; // Ring'deki segment indeksi (doğru kenar eşlemesi için)
  };
}

type RingBounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };

function getRingBounds(ring: [number, number][]): RingBounds | null {
  if (!ring || ring.length === 0) return null;
  let minLon = ring[0][0];
  let maxLon = ring[0][0];
  let minLat = ring[0][1];
  let maxLat = ring[0][1];

  for (let i = 1; i < ring.length; i++) {
    const p = ring[i];
    if (!p || p.length < 2) continue;
    const lon = Number(p[0]);
    const lat = Number(p[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLon, maxLon, minLat, maxLat };
}

function isPointInsideBounds(point: [number, number], bounds: RingBounds, epsilon = 1e-6): boolean {
  const lon = Number(point?.[0]);
  const lat = Number(point?.[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return (
    lon >= bounds.minLon - epsilon &&
    lon <= bounds.maxLon + epsilon &&
    lat >= bounds.minLat - epsilon &&
    lat <= bounds.maxLat + epsilon
  );
}

/**
 * Parsel geometrisinden ring koordinatlarını çıkar
 */
export function extractParcelRing(parcelGeometry: GeoJSONGeometry): [number, number][] {
  if (!parcelGeometry || !parcelGeometry.coordinates) {
    return [];
  }

  let ring: [number, number][] = [];

  if (parcelGeometry.type === 'Polygon' && Array.isArray(parcelGeometry.coordinates) && parcelGeometry.coordinates[0]) {
    ring = parcelGeometry.coordinates[0] as [number, number][];
  } else if (parcelGeometry.type === 'MultiPolygon' && Array.isArray(parcelGeometry.coordinates)) {
    // MultiPolygon için ilk polygon'un dış halkasını al
    const firstPolygon = parcelGeometry.coordinates[0];
    if (firstPolygon && Array.isArray(firstPolygon) && firstPolygon[0]) {
      ring = firstPolygon[0] as [number, number][];
    }
  }

  // Son nokta ilk nokta ile aynıysa çıkar (kapalı ring)
  if (ring.length > 0 && 
      ring[0][0] === ring[ring.length - 1][0] && 
      ring[0][1] === ring[ring.length - 1][1]) {
    ring = ring.slice(0, -1);
  }

  return ring;
}

/**
 * BBox köşelerini hesapla (ana projedeki calculateBBoxCorners mantığı)
 */
export function calculateBBoxCorners(
  ring: [number, number][],
  bboxInfo: BBoxInfo
): [number, number][] {
  if (!ring || ring.length === 0 || !bboxInfo || !bboxInfo.center) {
    return [];
  }

  const centerLon = bboxInfo.center[0];
  const centerLat = bboxInfo.center[1];
  const rotationDeg = bboxInfo.rotation_deg || 0;
  const rotationRad = rotationDeg * Math.PI / 180;

  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);

  // Koordinatları metreye çevir (Python mantığı)
  const pointsCentered: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const dxM = (lon - centerLon) * 111000 * Math.cos(centerLat * Math.PI / 180);
    const dyM = (lat - centerLat) * 111000;
    pointsCentered.push([dxM, dyM]);
  }

  // Rotasyon ile projeksiyon (u, v sistemi)
  const projected: [number, number][] = [];
  for (let i = 0; i < pointsCentered.length; i++) {
    const [dx, dy] = pointsCentered[i];
    const u = dx * cosR + dy * sinR;
    const v = -dx * sinR + dy * cosR;
    projected.push([u, v]);
  }

  // min_u, max_u, min_v, max_v bul
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < projected.length; i++) {
    const [u, v] = projected[i];
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  // BBox'ı araziden biraz uzaklaştır (padding ekle - metre cinsinden)
  const paddingM = 7.0; // 7 metre padding
  minU -= paddingM;
  maxU += paddingM;
  minV -= paddingM;
  maxV += paddingM;

  // BBox köşeleri (u, v sisteminde)
  const cornersUV: [number, number][] = [
    [minU, minV],
    [maxU, minV],
    [maxU, maxV],
    [minU, maxV]
  ];

  // Köşeleri lon/lat'a geri çevir
  const bboxCornersLonLat: [number, number][] = [];
  for (let i = 0; i < cornersUV.length; i++) {
    const [u, v] = cornersUV[i];
    const dx = u * cosR - v * sinR;
    const dy = u * sinR + v * cosR;
    const lon = centerLon + dx / (111000 * Math.cos(centerLat * Math.PI / 180));
    const lat = centerLat + dy / 111000;
    bboxCornersLonLat.push([lon, lat]);
  }

  // Son noktayı ekle (ring kapatma)
  bboxCornersLonLat.push([bboxCornersLonLat[0][0], bboxCornersLonLat[0][1]]);

  return bboxCornersLonLat;
}

/** İki (lon, lat) noktası arası mesafe (m) – Haversine. Segment etiketinde BBox/indeks karışıklığını önlemek için kullanılır. */
function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Polygon merkez noktası (centroid) hesapla
 */
function calculateCentroid(ring: [number, number][]): [number, number] {
  if (ring.length === 0) return [0, 0];
  
  let sumLon = 0, sumLat = 0;
  for (let i = 0; i < ring.length; i++) {
    sumLon += ring[i][0];
    sumLat += ring[i][1];
  }
  return [sumLon / ring.length, sumLat / ring.length];
}

/**
 * Segment label pozisyonlarını hesapla
 * Her segment için label pozisyonunu parsel dışına doğru hesaplar
 */
function calculateSegmentLabelPositions(
  ring: [number, number][],
  segmentLengths: number[],
  segmentAssignments: string[],
  centroid: [number, number]
): EdgeMeasurementFeature[] {
  if (!ring || ring.length === 0 || !segmentLengths || !segmentAssignments) {
    return [];
  }

  const features: EdgeMeasurementFeature[] = [];
  const n = Math.min(ring.length, segmentLengths.length, segmentAssignments.length);

  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    
    if (!p1 || !p2 || p1.length < 2 || p2.length < 2) continue;

    const lon1 = p1[0];
    const lat1 = p1[1];
    const lon2 = p2[0];
    const lat2 = p2[1];

    if (!Number.isFinite(lon1) || !Number.isFinite(lat1) || 
        !Number.isFinite(lon2) || !Number.isFinite(lat2)) {
      continue;
    }

    // Segment orta noktası
    const midLon = (lon1 + lon2) / 2;
    const midLat = (lat1 + lat2) / 2;

    // Segment vektörü ve normalize
    let dx = lon2 - lon1;
    let dy = lat2 - lat1;
    const length = Math.hypot(dx, dy);
    
    if (!Number.isFinite(length) || length < 1e-10) continue;
    
    dx /= length;
    dy /= length;

    // Normal vector (90 derece döndür - parsel dışına doğru)
    let nx = -dy;
    let ny = dx;

    // Centroid'e göre yön kontrolü - centroid'den uzaklaşacak şekilde
    const vx = midLon - centroid[0];
    const vy = midLat - centroid[1];
    if (nx * vx + ny * vy < 0) {
      nx = -nx;
      ny = -ny;
    }

    // Offset uygula (metre cinsinden, yaklaşık olarak dereceye çevir)
    // 1 metre ≈ 0.000009 derece (küçük mesafeler için yaklaşık)
    const baseOffset = 0.000126; // ~14 metre
    const labelLon = midLon + nx * baseOffset;
    const labelLat = midLat + ny * baseOffset;

    const edgeAssignment = segmentAssignments[i] || 'edge1';
    const color = EDGE_COLORS[edgeAssignment] || '#1d4ed8';
    const lengthM = Number(segmentLengths[i] || 0);
    const labelText = `${Number.isFinite(lengthM) ? Math.round(lengthM) : 0}m`;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [labelLon, labelLat]
      },
      properties: {
        kind: 'segment',
        text: labelText,
        color: color,
        edgeIndex: i
      }
    });
  }

  return features;
}

/**
 * Ana kenar label pozisyonlarını hesapla
 * 4 ana kenar için label pozisyonunu BBox dışına doğru hesaplar
 */
function calculateMainEdgeLabelPositions(
  bboxCorners: [number, number][],
  mainEdges: Array<{ bbox_edge?: string; sum_m?: number }>,
  bboxCenter: [number, number]
): EdgeMeasurementFeature[] {
  if (!bboxCorners || bboxCorners.length < 5 || !mainEdges || mainEdges.length === 0) {
    return [];
  }

  const features: EdgeMeasurementFeature[] = [];

  for (let i = 0; i < 4; i++) {
    const edge = mainEdges[i];
    if (!edge) continue;

    const corner1 = bboxCorners[i];
    const corner2 = bboxCorners[i + 1];
    
    if (!corner1 || !corner2 || corner1.length < 2 || corner2.length < 2) continue;

    const lon1 = corner1[0];
    const lat1 = corner1[1];
    const lon2 = corner2[0];
    const lat2 = corner2[1];

    if (!Number.isFinite(lon1) || !Number.isFinite(lat1) || 
        !Number.isFinite(lon2) || !Number.isFinite(lat2)) {
      continue;
    }

    // BBox kenarının orta noktası
    const midLon = (lon1 + lon2) / 2;
    const midLat = (lat1 + lat2) / 2;

    // Kenar vektörü ve normalize
    let dx = lon2 - lon1;
    let dy = lat2 - lat1;
    const length = Math.hypot(dx, dy);
    
    if (!Number.isFinite(length) || length < 1e-10) continue;
    
    dx /= length;
    dy /= length;

    // Normal vector (90 derece döndür - BBox dışına doğru)
    let nx = -dy;
    let ny = dx;

    // BBox center'a göre yön kontrolü
    const vx = midLon - bboxCenter[0];
    const vy = midLat - bboxCenter[1];
    if (nx * vx + ny * vy < 0) {
      nx = -nx;
      ny = -ny;
    }

    // Offset uygula – BBox'a yakın (~9 m, eskisi ~24 m idi)
    const baseOffset = 0.00008;
    const labelLon = midLon + nx * baseOffset;
    const labelLat = midLat + ny * baseOffset;

    const edgeName = edge.bbox_edge || `edge${i + 1}`;
    const color = EDGE_COLORS[edgeName] || '#1d4ed8';
    const sumM = Number(edge.sum_m || 0);
    const labelText = `${Number.isFinite(sumM) ? sumM.toFixed(1) : '0.0'}m`;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [labelLon, labelLat]
      },
      properties: {
        kind: 'main_edge',
        text: labelText,
        color: color
      }
    });
  }

  return features;
}

/**
 * Ana fonksiyon: Edge measurement GeoJSON feature'larını oluştur
 */
export function createEdgeMeasurementFeatures(
  parcelGeometry: GeoJSONGeometry,
  edgeMeasureData: EdgeMeasureData
): EdgeMeasurementFeature[] {
  console.log('[edgeMeasurementsManager] createEdgeMeasurementFeatures çağrıldı');
  console.log('[edgeMeasurementsManager] parcelGeometry:', {
    type: parcelGeometry?.type,
    hasCoordinates: !!parcelGeometry?.coordinates
  });
  console.log('[edgeMeasurementsManager] edgeMeasureData:', {
    hasBBox: !!edgeMeasureData?.bbox,
    hasMainEdges: !!edgeMeasureData?.main_edges,
    mainEdgesCount: edgeMeasureData?.main_edges?.length || 0,
    hasSegmentLengths: !!edgeMeasureData?.segment_lengths,
    segmentLengthsCount: edgeMeasureData?.segment_lengths?.length || 0,
    hasSegmentAssignments: !!edgeMeasureData?.segment_assignments,
    segmentAssignmentsCount: edgeMeasureData?.segment_assignments?.length || 0
  });
  
  if (!parcelGeometry || !edgeMeasureData) {
    console.log('[edgeMeasurementsManager] parcelGeometry veya edgeMeasureData yok');
    return [];
  }

  const bboxInfoRaw = edgeMeasureData.bbox;
  if (!bboxInfoRaw || !bboxInfoRaw.center) {
    console.log('[edgeMeasurementsManager] BBox bilgisi bulunamadı');
    return [];
  }

  // Parsel ring'ini çıkar
  const ring = extractParcelRing(parcelGeometry);
  console.log('[edgeMeasurementsManager] Parsel ring çıkarıldı, nokta sayısı:', ring.length);
  
  if (ring.length === 0) {
    console.log('[edgeMeasurementsManager] Parsel ring çıkarılamadı');
    return [];
  }

  // Bazı akışlarda bbox.center [lat, lon] gibi ters gelebiliyor.
  // Ring bbox'ına göre merkez koordinatını tutarlı hale getir.
  let bboxInfo: BBoxInfo = bboxInfoRaw;
  const bounds = getRingBounds(ring);
  if (bounds && Array.isArray(bboxInfoRaw.center) && bboxInfoRaw.center.length >= 2) {
    const c: [number, number] = [Number(bboxInfoRaw.center[0]), Number(bboxInfoRaw.center[1])];
    const swapped: [number, number] = [c[1], c[0]];
    const isOriginalInside = isPointInsideBounds(c, bounds);
    const isSwappedInside = isPointInsideBounds(swapped, bounds);

    if (!isOriginalInside && isSwappedInside) {
      console.warn('[edgeMeasurementsManager] bbox.center swap uygulandı (muhtemel lat/lon sırası):', {
        original: c,
        swapped,
        bounds,
      });
      bboxInfo = { ...bboxInfoRaw, center: swapped };
    }
  }

  console.log('[edgeMeasurementsManager] BBox bilgisi:', {
    center: bboxInfo.center,
    rotation_deg: bboxInfo.rotation_deg,
    width_m: bboxInfo.width_m,
    height_m: bboxInfo.height_m
  });

  const features: EdgeMeasurementFeature[] = [];

  // BBox köşelerini hesapla
  const bboxCorners = calculateBBoxCorners(ring, bboxInfo);
  console.log('[edgeMeasurementsManager] BBox köşeleri hesaplandı, nokta sayısı:', bboxCorners.length);
  
  if (bboxCorners.length >= 5) {
    // BBox LineString feature oluştur (son nokta ilk nokta ile aynı, bu yüzden 5 nokta)
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: bboxCorners
      },
      properties: {
        kind: 'bbox'
      }
    });
    console.log('[edgeMeasurementsManager] BBox LineString feature eklendi');
  } else {
    console.log('[edgeMeasurementsManager] BBox köşeleri yeterli değil (en az 5 nokta gerekli)');
  }

  // Centroid hesapla
  const centroid = calculateCentroid(ring);

  // Segment label'larını oluştur
  const segmentLengths = edgeMeasureData.segment_lengths || [];
  let segmentAssignments = edgeMeasureData.segment_assignments || [];
  
  // Eğer segment_assignments yoksa hesapla (segment_bearings ve bbox_bearings varsa)
  if (segmentAssignments.length === 0 && edgeMeasureData.segment_bearings && bboxInfo.bbox_bearings) {
    const segmentBearings = edgeMeasureData.segment_bearings || [];
    const bboxBearings = bboxInfo.bbox_bearings || [];
    segmentAssignments = [];
    
    for (let i = 0; i < segmentBearings.length; i++) {
      const segBearing = segmentBearings[i];
      let bestEdge = 'edge1';
      let minDiff = Infinity;
      
      for (let j = 0; j < 4; j++) {
        const edgeBearing = bboxBearings[j] || 0;
        let diff = Math.abs(segBearing - edgeBearing);
        if (diff > 180) diff = 360 - diff;
        
        if (diff < minDiff) {
          minDiff = diff;
          bestEdge = `edge${j + 1}`;
        }
      }
      
      segmentAssignments.push(bestEdge);
    }
  }

  if (segmentLengths.length > 0 && segmentAssignments.length > 0) {
    console.log('[edgeMeasurementsManager] Segment çizgileri ve label\'ları oluşturuluyor...', {
      segmentLengthsCount: segmentLengths.length,
      segmentAssignmentsCount: segmentAssignments.length
    });
    
    // Segment çizgilerini ve label'ları oluştur (sadece parsel üzerinde)
    const n = Math.min(ring.length, segmentLengths.length, segmentAssignments.length);
    for (let i = 0; i < n; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % ring.length];
      
      if (!p1 || !p2 || p1.length < 2 || p2.length < 2) continue;

      const lon1 = p1[0];
      const lat1 = p1[1];
      const lon2 = p2[0];
      const lat2 = p2[1];

      if (!Number.isFinite(lon1) || !Number.isFinite(lat1) || 
          !Number.isFinite(lon2) || !Number.isFinite(lat2)) {
        continue;
      }

      const edgeAssignment = segmentAssignments[i] || 'edge1';
      const color = EDGE_COLORS[edgeAssignment] || '#1d4ed8';
      // Segment uzunluğunu bu ring'den hesapla (BBox/indeks karışıklığını önler; backend ring sırası farklı olsa bile doğru değer)
      const lengthM = haversineMeters(lon1, lat1, lon2, lat2);
      const labelText = `${Number.isFinite(lengthM) ? Math.round(lengthM) : 0}m`;

      // Segment çizgisi (LineString)
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[lon1, lat1], [lon2, lat2]]
        },
        properties: {
          kind: 'segment',
          color: color
        }
      });

      // Segment orta noktası (parsel üzerinde label)
      const midLon = (lon1 + lon2) / 2;
      const midLat = (lat1 + lat2) / 2;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [midLon, midLat]
        },
        properties: {
          kind: 'segment',
          text: labelText,
          color: color,
          edgeIndex: i
        }
      });
    }
    
    console.log('[edgeMeasurementsManager] Segment çizgileri ve label\'ları oluşturuldu, sayı:', n * 2);
  } else {
    console.log('[edgeMeasurementsManager] Segment label\'ları oluşturulamadı:', {
      hasSegmentLengths: segmentLengths.length > 0,
      hasSegmentAssignments: segmentAssignments.length > 0
    });
  }

  // Main edge label'larını oluştur
  const mainEdges = edgeMeasureData.main_edges || [];
  console.log('[edgeMeasurementsManager] Main edges:', {
    mainEdgesCount: mainEdges.length,
    bboxCornersCount: bboxCorners.length
  });
  
  if (mainEdges.length > 0 && bboxCorners.length >= 5) {
    console.log('[edgeMeasurementsManager] Main edge label\'ları oluşturuluyor...');
    const mainEdgeFeatures = calculateMainEdgeLabelPositions(
      bboxCorners,
      mainEdges,
      bboxInfo.center
    );
    console.log('[edgeMeasurementsManager] Main edge label\'ları oluşturuldu, sayı:', mainEdgeFeatures.length);
    features.push(...mainEdgeFeatures);
  } else {
    console.log('[edgeMeasurementsManager] Main edge label\'ları oluşturulamadı:', {
      hasMainEdges: mainEdges.length > 0,
      hasBBoxCorners: bboxCorners.length >= 5
    });
  }

  console.log('[edgeMeasurementsManager] Toplam feature sayısı:', features.length);
  return features;
}
