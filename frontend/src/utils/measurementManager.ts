// Ölçüm Yöneticisi: Cetvel (mesafe) ve alan ölçümü
// Mobil uygulama için React Native Mapbox uyumlu utility

// Turf.js paketleri dependency conflict yaratmaması için kullanılmıyor
// Fallback fonksiyonlar (Haversine, Shoelace) kullanılıyor
// Bu yaklaşım @rnmapbox/maps ile uyumlu ve ek dependency gerektirmiyor

export type MeasurementMode = null | 'ruler' | 'area' | 'pin' | 'text' | 'arrow';

export interface MeasurementFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: {
    label?: string;
    isDynamic?: boolean;
    isTemporary?: boolean;
    measurementType?: 'ruler' | 'area';
    isLabelOnly?: boolean;
    measurementGroupId?: string;
    /** Grup rengi (çizgi, dolgu, etiket); mobil harita katmanlarında kullanılır */
    measureColor?: string;
  };
}

export interface MeasurementState {
  mode: MeasurementMode;
  rulerPoints: [number, number][];
  areaPoints: [number, number][];
  features: MeasurementFeature[];
}

/**
 * İki nokta arası mesafe hesapla (metre cinsinden)
 */
export const calculateDistance = (point1: [number, number], point2: [number, number]): number => {
  // Haversine formülü kullanılıyor (Turf.js dependency conflict'i önlemek için)
  return haversineDistance(point1, point2);
};

/**
 * Haversine mesafe formülü (fallback)
 */
export const haversineDistance = (point1: [number, number], point2: [number, number]): number => {
  const R = 6371000; // Dünya yarıçapı (metre)
  const lat1 = point1[1] * Math.PI / 180;
  const lat2 = point2[1] * Math.PI / 180;
  const dLat = (point2[1] - point1[1]) * Math.PI / 180;
  const dLng = (point2[0] - point1[0]) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * Polygon alan hesapla (metrekare cinsinden)
 */
export const calculateArea = (coords: [number, number][]): number => {
  if (coords.length < 3) return 0;
  
  // Shoelace formülü kullanılıyor (Turf.js dependency conflict'i önlemek için)
  // Bu formül düz zemin varsayımıyla yaklaşık sonuç verir, ancak çoğu durumda yeterlidir
  return simpleAreaCalculation(coords);
};

/**
 * Alan hesabı (Shoelace formülü ile metrekare hesaplama)
 * Bu formül düz zemin varsayımıyla çalışır, ancak çoğu ölçüm için yeterli hassasiyet sağlar
 */
export const simpleAreaCalculation = (coords: [number, number][]): number => {
  if (coords.length < 3) return 0;
  
  // Shoelace formülü (degree² cinsinden alan)
  let area = 0;
  const n = coords.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1]; // lon1 * lat2
    area -= coords[j][0] * coords[i][1]; // lon2 * lat1
  }
  
  area = Math.abs(area / 2); // degree² cinsinden
  
  // Degree²'den metrekare'ye dönüşüm
  // Ortalama enlem için yaklaşık dönüşüm faktörü
  // 1 derece ≈ 111,320 metre (enlem için sabit)
  // 1 derece ≈ 111,320 * cos(lat) metre (boylam için enleme bağlı)
  
  // Basitleştirilmiş yaklaşım: orta nokta enlemini kullan
  const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / n;
  const latRad = avgLat * Math.PI / 180;
  
  // Metrekare dönüşümü: degree² * (111320 * cos(lat)) * 111320
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(latRad);
  
  // Alan = degree² * (metre/degree lat) * (metre/degree lon)
  // Ancak shoelace formülü zaten degree² veriyor, bu yüzden sadece faktörleri çarpıyoruz
  // Daha doğru hesaplama için her segment için ayrı hesaplama yapılabilir, ancak yaklaşık değer yeterli
  return area * metersPerDegreeLat * metersPerDegreeLon;
};

/**
 * İki nokta arası orta nokta hesapla
 */
export const getMidpoint = (point1: [number, number], point2: [number, number]): [number, number] => {
  return [
    (point1[0] + point2[0]) / 2,
    (point1[1] + point2[1]) / 2
  ];
};

/**
 * Polygon merkez noktası (centroid) hesapla
 */
export const getCentroid = (coords: [number, number][]): [number, number] => {
  if (coords.length === 0) return [0, 0];
  
  // Basit ortalama kullanılıyor (Turf.js dependency conflict'i önlemek için)
  // Bu yaklaşım çoğu durumda yeterli hassasiyet sağlar
  let sumLng = 0, sumLat = 0;
  const count = coords.length;
  for (let i = 0; i < count; i++) {
    sumLng += coords[i][0];
    sumLat += coords[i][1];
  }
  return [sumLng / count, sumLat / count];
};

/**
 * Mesafe formatla (m veya km)
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(2)} km`;
  }
};

/**
 * Alan formatla (m²)
 */
export const formatArea = (sqMeters: number): string => {
  return `${Math.round(sqMeters).toLocaleString('tr-TR')} m²`;
};

/**
 * Ruler (mesafe) ölçümü için GeoJSON feature oluştur
 */
export const createRulerFeatures = (
  points: [number, number][],
  distanceValue?: number,
  measureColor?: string
): MeasurementFeature[] => {
  const colorProps = measureColor ? { measureColor } : {};
  const features: MeasurementFeature[] = [];

  points.forEach((coord) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coord
      },
      properties: {
        measurementType: 'ruler',
        ...colorProps,
      }
    });
  });

  if (points.length === 2) {
    const [p1, p2] = points;
    const dist = distanceValue !== undefined ? distanceValue : calculateDistance(p1, p2);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [p1, p2]
      },
      properties: {
        measurementType: 'ruler',
        ...colorProps,
      }
    });

    const midpoint = getMidpoint(p1, p2);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: midpoint
      },
      properties: {
        label: formatDistance(dist),
        measurementType: 'ruler',
        isLabelOnly: true,
        ...colorProps,
      }
    });
  }

  return features;
};

/**
 * Area (alan) ölçümü için GeoJSON feature oluştur
 */
export const createAreaFeatures = (
  points: [number, number][],
  areaValue?: number,
  isTemporary: boolean = false,
  measureColor?: string
): MeasurementFeature[] => {
  if (!points || points.length === 0) {
    return [];
  }

  const colorProps = measureColor ? { measureColor } : {};
  const features: MeasurementFeature[] = [];

  points.forEach((coord) => {
    if (coord && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coord
        },
        properties: {
          measurementType: 'area',
          ...(isTemporary && { isTemporary: true }),
          ...colorProps,
        }
      });
    }
  });
  
  // En az 2 nokta varsa polygon ekle
  if (points.length >= 2) {
    const closedPoints: [number, number][] = [...points];
    
    // Polygon'u kapat (ilk noktayı sona ekle)
    const firstPoint = closedPoints[0];
    const lastPoint = closedPoints[closedPoints.length - 1];
    if (!firstPoint || !lastPoint) {
      return features;
    }
    
    const needsClose = firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1];
    if (needsClose) {
      closedPoints.push([firstPoint[0], firstPoint[1]]);
    }
    
    // Polygon feature oluştur
    const polygonFeature: MeasurementFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [closedPoints]
      },
      properties: {
        measurementType: 'area',
        isTemporary,
        ...colorProps,
      }
    };
    
    features.push(polygonFeature);
    
    // Etiket (sadece tamamlanmış ölçümlerde ve en az 3 nokta varsa)
    if (points.length >= 3 && !isTemporary) {
      const areaM2 = areaValue !== undefined ? areaValue : calculateArea(points);
      if (areaM2 > 0) {
        const centroid = getCentroid(points);
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: centroid
          },
          properties: {
            label: formatArea(areaM2),
            measurementType: 'area',
            isLabelOnly: true,
            ...colorProps,
          }
        });
      }
    }
  }
  
  return features;
};

/**
 * Dinamik çizgi için GeoJSON feature oluştur (ruler modu için)
 */
export const createDynamicRulerLine = (
  startPoint: [number, number],
  currentPoint: [number, number]
): MeasurementFeature => {
  const dist = calculateDistance(startPoint, currentPoint);
  const midpoint = getMidpoint(startPoint, currentPoint);
  
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [startPoint, currentPoint]
    },
    properties: {
      label: formatDistance(dist),
      isDynamic: true
    }
  };
};

/**
 * Dinamik çizgi için GeoJSON feature oluştur (area modu için)
 */
export const createDynamicAreaLine = (
  lastPoint: [number, number],
  currentPoint: [number, number],
  allPoints: [number, number][]
): MeasurementFeature[] => {
  const features: MeasurementFeature[] = [];
  
  // Son noktadan mevcut noktaya çizgi
  features.push({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [lastPoint, currentPoint]
    },
    properties: {
      isDynamic: true
    }
  });
  
  // En az 2 nokta varsa geçici alan hesapla ve etiket ekle
  if (allPoints.length >= 2) {
    const tempPoints = [...allPoints, currentPoint];
    if (tempPoints.length >= 3) {
      const tempArea = calculateArea(tempPoints);
      const centroid = getCentroid(tempPoints);
      
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: centroid
        },
        properties: {
          label: formatArea(tempArea),
          isDynamic: true
        }
      });
    }
  }
  
  return features;
};

/**
 * İki nokta arası pixel mesafesi hesapla (ilk noktaya yakınlık kontrolü için)
 * Not: React Native Mapbox'ta bu fonksiyon map instance'ı gerektirir
 * Basit bir yaklaşım olarak koordinat farkını kullanabiliriz
 */
export const getCoordinateDistance = (coords1: [number, number], coords2: [number, number]): number => {
  // Haversine mesafesini metre cinsinden hesapla
  const dist = haversineDistance(coords1, coords2);
  // Yaklaşık olarak 1 metre = 0.00001 derece (küçük zoom seviyelerinde)
  // Bu değer zoom seviyesine göre değişir, ancak yaklaşık bir değer için kullanılabilir
  return dist;
};
