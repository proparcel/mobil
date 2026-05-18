/**
 * Street View Helper
 * 
 * Koordinat seçim mantığı - Ana projedeki street_view_helper.js mantığını mobil projeye uyarlar
 */

import { GeoJSONGeometry, ProParcelResponse, RoadValue } from '../../src/types/parcelResponse';

export interface StreetViewPoint {
  point: { lat: number; lng: number };
  heading: number;
  roadName?: string;
}

/**
 * Parsel merkezini hesapla
 */
function calculateParcelCenter(geometry: GeoJSONGeometry | null | undefined): { lat: number; lng: number } | null {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  try {
    let coords: number[][] = [];
    
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
      // Polygon: coordinates[0] is the outer ring
      coords = geometry.coordinates[0] as number[][];
    } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates[0])) {
      // MultiPolygon: take first polygon's outer ring
      coords = (geometry.coordinates[0] as number[][][])[0] as number[][];
    } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
      // Point format: [lon, lat]
      return {
        lat: parseFloat(geometry.coordinates[1] as any),
        lng: parseFloat(geometry.coordinates[0] as any)
      };
    } else if (Array.isArray(geometry.coordinates[0]) && Array.isArray(geometry.coordinates[0][0])) {
      // Nested array structure
      coords = geometry.coordinates[0] as number[][];
    } else if (Array.isArray(geometry.coordinates[0])) {
      // Flat array of coordinates
      coords = geometry.coordinates as number[][];
    }

    if (coords.length === 0) {
      return null;
    }

    // Calculate centroid
    let sumLat = 0;
    let sumLon = 0;
    let count = 0;

    for (const coord of coords) {
      if (Array.isArray(coord) && coord.length >= 2) {
        // GeoJSON format: [lon, lat]
        sumLon += parseFloat(coord[0] as any);
        sumLat += parseFloat(coord[1] as any);
        count++;
      }
    }

    if (count === 0) {
      return null;
    }

    return {
      lat: sumLat / count,
      lng: sumLon / count,
    };
  } catch (error) {
    console.warn('[streetViewHelper] Parsel merkezi hesaplama hatası:', error);
    return null;
  }
}

/**
 * Yol verisinden koordinat noktalarını çıkar (öncelik sırasına göre)
 */
function extractRoadPoints(road: RoadValue | any): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  
  // Öncelik 1: nearest_poly_point
  if (road.nearest_poly_point) {
    if (Array.isArray(road.nearest_poly_point) && road.nearest_poly_point.length >= 2) {
      const coord1 = parseFloat(road.nearest_poly_point[0]);
      const coord2 = parseFloat(road.nearest_poly_point[1]);
      if (!isNaN(coord1) && !isNaN(coord2)) {
        // Türkiye aralığına göre sezgi: [lon, lat] veya [lat, lon]
        if (coord1 >= 25 && coord1 <= 46 && coord2 >= 35 && coord2 <= 43) {
          points.push({ lat: coord2, lng: coord1 });
        } else {
          points.push({ lat: coord1, lng: coord2 });
        }
      }
    } else if (typeof road.nearest_poly_point === 'object' && road.nearest_poly_point.lat && road.nearest_poly_point.lon) {
      points.push({ 
        lat: parseFloat(road.nearest_poly_point.lat), 
        lng: parseFloat(road.nearest_poly_point.lon) 
      });
    }
  }
  
  // Öncelik 2: best_road_point_latlon (tarla için özel)
  if (road.best_road_point_latlon) {
    if (Array.isArray(road.best_road_point_latlon) && road.best_road_point_latlon.length >= 2) {
      const coord1 = parseFloat(road.best_road_point_latlon[0]);
      const coord2 = parseFloat(road.best_road_point_latlon[1]);
      if (!isNaN(coord1) && !isNaN(coord2)) {
        if (coord1 >= 25 && coord1 <= 46 && coord2 >= 35 && coord2 <= 43) {
          points.push({ lat: coord2, lng: coord1 });
        } else {
          points.push({ lat: coord1, lng: coord2 });
        }
      }
    } else if (typeof road.best_road_point_latlon === 'object' && road.best_road_point_latlon.lat && road.best_road_point_latlon.lon) {
      points.push({ 
        lat: parseFloat(road.best_road_point_latlon.lat), 
        lng: parseFloat(road.best_road_point_latlon.lon) 
      });
    }
  }
  
  // Öncelik 3: field_road_point_latlon (FAR modu için)
  if (road.field_road_point_latlon) {
    if (Array.isArray(road.field_road_point_latlon) && road.field_road_point_latlon.length >= 2) {
      const coord1 = parseFloat(road.field_road_point_latlon[0]);
      const coord2 = parseFloat(road.field_road_point_latlon[1]);
      if (!isNaN(coord1) && !isNaN(coord2)) {
        if (coord1 >= 25 && coord1 <= 46 && coord2 >= 35 && coord2 <= 43) {
          points.push({ lat: coord2, lng: coord1 });
        } else {
          points.push({ lat: coord1, lng: coord2 });
        }
      }
    } else if (typeof road.field_road_point_latlon === 'object' && road.field_road_point_latlon.lat && road.field_road_point_latlon.lon) {
      points.push({ 
        lat: parseFloat(road.field_road_point_latlon.lat), 
        lng: parseFloat(road.field_road_point_latlon.lon) 
      });
    }
  }
  
  // Öncelik 4: road_target
  if (road.road_target) {
    if (Array.isArray(road.road_target) && road.road_target.length >= 2) {
      const coord1 = parseFloat(road.road_target[0]);
      const coord2 = parseFloat(road.road_target[1]);
      if (!isNaN(coord1) && !isNaN(coord2)) {
        if (coord1 >= 25 && coord1 <= 46 && coord2 >= 35 && coord2 <= 43) {
          points.push({ lat: coord2, lng: coord1 });
        } else {
          points.push({ lat: coord1, lng: coord2 });
        }
      }
    } else if (typeof road.road_target === 'object' && road.road_target.lat && road.road_target.lon) {
      points.push({ 
        lat: parseFloat(road.road_target.lat), 
        lng: parseFloat(road.road_target.lon) 
      });
    }
  }
  
  // Öncelik 5: road_coord
  if (road.road_coord) {
    if (Array.isArray(road.road_coord) && road.road_coord.length >= 2) {
      const coord1 = parseFloat(road.road_coord[0]);
      const coord2 = parseFloat(road.road_coord[1]);
      if (!isNaN(coord1) && !isNaN(coord2)) {
        if (coord1 >= -180 && coord1 <= 180 && (coord2 < -90 || coord2 > 90)) {
          points.push({ lat: coord2, lng: coord1 });
        } else {
          points.push({ lat: coord1, lng: coord2 });
        }
      }
    } else if (typeof road.road_coord === 'object' && road.road_coord.lat && road.road_coord.lon) {
      points.push({ 
        lat: parseFloat(road.road_coord.lat), 
        lng: parseFloat(road.road_coord.lon) 
      });
    }
  }
  
  // Öncelik 6: road_lat / road_lng
  if (road.road_lat && road.road_lng) {
    points.push({ 
      lat: parseFloat(road.road_lat), 
      lng: parseFloat(road.road_lng) 
    });
  }
  
  // Geometry'den al (son çare)
  if (points.length === 0 && road.geometry && road.geometry.type === 'LineString' && Array.isArray(road.geometry.coordinates)) {
    const coords = road.geometry.coordinates;
    if (coords.length >= 2) {
      points.push({ lat: parseFloat(coords[0][1] as any), lng: parseFloat(coords[0][0] as any) });
      if (coords.length > 2) {
        const midIndex = Math.floor(coords.length / 2);
        points.push({ lat: parseFloat(coords[midIndex][1] as any), lng: parseFloat(coords[midIndex][0] as any) });
      }
      points.push({ lat: parseFloat(coords[coords.length - 1][1] as any), lng: parseFloat(coords[coords.length - 1][0] as any) });
    }
  }
  
  // Duplicate'leri kaldır
  const uniquePoints: Array<{ lat: number; lng: number }> = [];
  const seen = new Set<string>();
  for (const point of points) {
    if (isNaN(point.lat) || isNaN(point.lng) || 
        point.lat < -90 || point.lat > 90 || 
        point.lng < -180 || point.lng > 180) {
      continue;
    }
    
    const key = `${point.lat.toFixed(6)}_${point.lng.toFixed(6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(point);
    }
  }
  
  return uniquePoints;
}

/**
 * Heading hesapla (yol noktasından parsel merkezine)
 */
function calculateHeading(roadPoint: { lat: number; lng: number }, parcelCenter: { lat: number; lng: number } | null): number {
  if (!parcelCenter) return 180;
  
  const lat1 = roadPoint.lat * Math.PI / 180;
  const lat2 = parcelCenter.lat * Math.PI / 180;
  const dLon = (parcelCenter.lng - roadPoint.lng) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  
  return bearing;
}

/**
 * Parsel sınırından bir nokta seç (merkeze en yakın, minimum 10m uzaklıkta)
 */
function extractBoundaryPoint(geometry: GeoJSONGeometry | null | undefined, parcelCenter: { lat: number; lng: number } | null): { lat: number; lng: number } | null {
  if (!geometry || !parcelCenter) {
    return null;
  }

  try {
    let coords: number[][] = [];
    
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
      coords = geometry.coordinates[0] as number[][];
    } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates[0])) {
      if (geometry.coordinates[0] && Array.isArray(geometry.coordinates[0][0])) {
        coords = geometry.coordinates[0][0] as number[][];
      }
    }
    
    if (coords.length === 0) {
      return null;
    }
    
    // Merkeze en yakın sınır noktasını bul (minimum 10m uzaklıkta)
    let minDistance = Infinity;
    let closestPoint: { lat: number; lng: number } | null = null;
    
    for (const coord of coords) {
      if (Array.isArray(coord) && coord.length >= 2) {
        let lat: number, lon: number;
        const coord1 = parseFloat(coord[0] as any);
        const coord2 = parseFloat(coord[1] as any);
        
        // Türkiye aralığına göre sezgi
        if (coord1 >= 25 && coord1 <= 46 && coord2 >= 35 && coord2 <= 43) {
          lon = coord1;
          lat = coord2;
        } else {
          lat = coord1;
          lon = coord2;
        }
        
        // Merkeze uzaklığı hesapla (basit Euclidean distance)
        const dx = (lon - parcelCenter.lng) * 111320 * Math.cos(parcelCenter.lat * Math.PI / 180);
        const dy = (lat - parcelCenter.lat) * 111320;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // En yakın noktayı bul (ama merkeze çok yakın olmasın, sınırda olsun)
        // Minimum 10m uzaklıkta bir nokta seç
        if (distance > 10 && distance < minDistance) {
          minDistance = distance;
          closestPoint = { lat, lng: lon };
        }
      }
    }
    
    // Eğer uygun nokta bulunamadıysa, ilk geçerli sınır noktasını kullan
    if (!closestPoint && coords.length > 0) {
      const firstCoord = coords[0];
      if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
        const coord1 = parseFloat(firstCoord[0] as any);
        const coord2 = parseFloat(firstCoord[1] as any);
        
        if (coord1 >= 25 && coord1 <= 46 && coord2 >= 35 && coord2 <= 43) {
          closestPoint = { lat: coord2, lng: coord1 };
        } else {
          closestPoint = { lat: coord1, lng: coord2 };
        }
      }
    }
    
    return closestPoint;
  } catch (error) {
    console.warn('[streetViewHelper] Sınır noktası seçim hatası:', error);
    return null;
  }
}

/**
 * Street View için ilk noktayı al (yol varsa yol, yoksa parsel sınırı/merkezi)
 */
export function getFirstStreetViewPoint(
  geometry: GeoJSONGeometry | null | undefined,
  analysisData: ProParcelResponse | null | undefined
): StreetViewPoint | null {
  if (!geometry) {
    return null;
  }

  const parcelCenter = calculateParcelCenter(geometry);
  const parametersData = analysisData?.parameters_data;
  
  // Öncelik 1: Yol verisi varsa onu kullan
  const roadValues = parametersData?.road_values;
  if (Array.isArray(roadValues) && roadValues.length > 0) {
    // Bağlantısı olan yolları filtrele
    const connectedRoads = roadValues.filter(road => {
      const roadConnection = road.roadConnection;
      const frontage = (road as any).road_parcel_isnotConnection_but_frontage;
      const hasConnection = roadConnection === true || 
                           String(roadConnection) === 'true' || 
                           frontage === true ||
                           String(frontage) === 'true';
      return hasConnection;
    });
    
    if (connectedRoads.length > 0) {
      // İlk bağlantılı yol için nokta al
      const firstRoad = connectedRoads[0];
      const roadPoints = extractRoadPoints(firstRoad);
      
      if (roadPoints.length > 0) {
        const point = roadPoints[0];
        const heading = calculateHeading(point, parcelCenter);
        
        return {
          point,
          heading,
          roadName: firstRoad.road_type || (firstRoad as any).name || (firstRoad as any).road_name || 'Yol'
        };
      }
    }
    
    // Bağlantısı olmayan yollar varsa onları da dene (field_mode="FAR" gibi)
    for (const road of roadValues) {
      const roadPoints = extractRoadPoints(road);
      if (roadPoints.length > 0) {
        const point = roadPoints[0];
        const heading = calculateHeading(point, parcelCenter);
        
        return {
          point,
          heading,
          roadName: road.road_type || (road as any).name || (road as any).road_name || 'Yol'
        };
      }
    }
  }
  
  // Öncelik 2: Parsel sınırından bir nokta seç
  const boundaryPoint = extractBoundaryPoint(geometry, parcelCenter);
  if (boundaryPoint) {
    const heading = calculateHeading(boundaryPoint, parcelCenter);
    return {
      point: boundaryPoint,
      heading,
      roadName: 'Parsel Sınırı'
    };
  }
  
  // Öncelik 3: Fallback - Parsel merkezi veya test_Point_Target
  const testPointTarget = parametersData?.parcel_values?.test_Point_Target;
  if (testPointTarget && Array.isArray(testPointTarget) && testPointTarget.length >= 2) {
    return {
      point: {
        lat: parseFloat(testPointTarget[0] as any),
        lng: parseFloat(testPointTarget[1] as any)
      },
      heading: 180,
      roadName: 'Parsel Noktası'
    };
  }
  
  if (parcelCenter) {
    return {
      point: parcelCenter,
      heading: 180,
      roadName: 'Parsel Merkezi'
    };
  }
  
  return null;
}
