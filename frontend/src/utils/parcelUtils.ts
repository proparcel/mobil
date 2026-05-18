import { GeoJSONGeometry } from '../../src/types/parcelResponse';

/**
 * Bir noktanın parsel polygon içinde olup olmadığını kontrol et (ray-casting algoritması)
 */
export const isPointInParcel = (point: [number, number], geometry: any): boolean => {
  if (!geometry || !point || !point[0] || !point[1]) return false;
  
  try {
    const [x, y] = point; // [lon, lat]
    let inside = false;
    
    if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
      const ring = geometry.coordinates[0]; // Dış halka
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        // Ray-casting algoritması
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
      // MultiPolygon için her polygon'u kontrol et
      for (const polygon of geometry.coordinates) {
        if (polygon && polygon[0]) {
          const ring = polygon[0];
          let polygonInside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) polygonInside = !polygonInside;
          }
          if (polygonInside) {
            inside = true;
            break;
          }
        }
      }
    }
    
    return inside;
  } catch (e) {
    console.error('[parcelUtils.ts:48] Point in polygon kontrolü hatası:', e);
    return false;
  }
};

/**
 * GeoJSON koordinatlarını normalize et: [lat, lon] -> [lon, lat]
 * Mapbox GeoJSON [lon, lat] bekler. TKGM / bazı kaynaklar [lat, lon] dönebilir.
 *
 * ÖNEMLİ: `Math.abs(x) > 90` gibi kaba kurallar standart [lon, lat] çiftlerini (ör. TR'de lon≈27)
 * yanlışlıkla swap edip kamera merkezini ve bbox'ı bozuyordu. Ana ekran (index.tsx) ile aynı
 * Türkiye bbox tespiti kullanılır — sadece gerçekten [lat, lon] görünen çiftler çevrilir.
 */
export const normalizeGeometryCoordinates = (geometry: any): any => {
  if (!geometry || !geometry.coordinates) return geometry;

  let first: [number, number] | null = null;
  try {
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) {
      first = geometry.coordinates[0][0];
    } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0]?.[0])) {
      first = geometry.coordinates[0][0][0];
    } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
      first = [geometry.coordinates[0], geometry.coordinates[1]];
    } else if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates?.[0])) {
      first = geometry.coordinates[0];
    }
  } catch {
    /* ignore */
  }

  if (!first || typeof first[0] !== 'number' || typeof first[1] !== 'number') return geometry;

  const x = first[0];
  const y = first[1];
  // TR lat (35-43) ve lon (25-46): x bu lat bandında ve y lon bandında ise → [lat,lon] kabul et, swap
  const looksLikeLatLonTR =
    Number.isFinite(x) && Number.isFinite(y) && x >= 35 && x <= 43 && y >= 25 && y <= 46;
  if (!looksLikeLatLonTR) return geometry;

  const swap = (coords: any): any => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return [coords[1], coords[0], ...coords.slice(2)];
    }
    return coords.map(swap);
  };

  return { ...geometry, coordinates: swap(geometry.coordinates) };
};

/**
 * Parsel polygon için bounding box hesapla ve kamera ayarlarını döndür
 */
export const calculateBoundsAndCamera = (geometry: any): { center: [number, number]; zoom: number } | null => {
  try {
    let allCoords: [number, number][] = [];
    
    // Tüm koordinatları topla
    if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
      // Polygon: coordinates[0] dış halka
      const ring = geometry.coordinates[0];
      for (const coord of ring) {
        if (coord && coord.length >= 2) {
          allCoords.push([coord[0], coord[1]]); // [lon, lat]
        }
      }
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
      // MultiPolygon: her polygon için koordinatları topla
      for (const polygon of geometry.coordinates) {
        if (polygon && polygon[0]) {
          const ring = polygon[0];
          for (const coord of ring) {
            if (coord && coord.length >= 2) {
              allCoords.push([coord[0], coord[1]]);
            }
          }
        }
      }
    }
    
    if (allCoords.length === 0) {
      return null;
    }
    
    // Bounding box hesapla
    let minLon = allCoords[0][0];
    let maxLon = allCoords[0][0];
    let minLat = allCoords[0][1];
    let maxLat = allCoords[0][1];
    
    for (const [lon, lat] of allCoords) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    
    // Merkez hesapla
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    
    // Zoom seviyesi hesapla (bounding box'a göre)
    // En ve boy hesapla (derece cinsinden)
    const lonDiff = maxLon - minLon;
    const latDiff = maxLat - minLat;
    
    // Daha büyük olan farkı kullanarak zoom hesapla
    // Yaklaşık formül: zoom = log2(360 / diff)
    const maxDiff = Math.max(lonDiff, latDiff);
    
    // Padding eklemek için maxDiff'i biraz artır (%20 padding)
    const adjustedDiff = maxDiff * 1.2;
    
    // Zoom hesaplama (deneme-yanılma ile ayarlanmış)
    // 0.01 derece ≈ 1km için zoom ~13
    // 0.001 derece ≈ 100m için zoom ~16
    // 0.0001 derece ≈ 10m için zoom ~19
    let zoom = 15; // Varsayılan
    if (adjustedDiff > 0.1) {
      zoom = 10; // Çok büyük alan
    } else if (adjustedDiff > 0.05) {
      zoom = 11;
    } else if (adjustedDiff > 0.02) {
      zoom = 12;
    } else if (adjustedDiff > 0.01) {
      zoom = 13;
    } else if (adjustedDiff > 0.005) {
      zoom = 14;
    } else if (adjustedDiff > 0.002) {
      zoom = 15;
    } else if (adjustedDiff > 0.001) {
      zoom = 16;
    } else if (adjustedDiff > 0.0005) {
      zoom = 17;
    } else if (adjustedDiff > 0.0002) {
      zoom = 18;
    } else if (adjustedDiff > 0.0001) {
      zoom = 19;
    } else {
      zoom = 20; // Çok küçük alan
    }
    
    // Zoom'u sınırla (çok yakın veya çok uzak olmasın)
    zoom = Math.max(10, Math.min(20, zoom));
    
    return {
      center: [centerLon, centerLat],
      zoom: zoom,
    };
  } catch (error) {
    console.error('[parcelUtils.ts:151] Bounds hesaplama hatası:', error);
    return null;
  }
};

/**
 * Backend durum kontrolü
 */
export const checkBackendStatus = async (): Promise<boolean> => {
  try {
    const { API_URL } = await import("../../config/api");
    const backendUrl = (API_URL || "").replace(/\/$/, "");
    // FastAPI health check endpoint'i (eğer yoksa root endpoint'i deneriz)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 saniye timeout
    
    const response = await fetch(`${backendUrl}/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    // Herhangi bir yanıt alırsak backend çalışıyor demektir
    return response.ok || response.status < 500;
  } catch (error: any) {
    // Network hatası veya timeout
    console.log('[parcelUtils.ts:176] Backend durum kontrolü başarısız:', error.message);
    return false;
  }
};
