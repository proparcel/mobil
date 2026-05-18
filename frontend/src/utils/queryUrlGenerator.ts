/**
 * Query URL Generator
 * 
 * Parsel bilgilerinden deep link ve universal link URL'leri oluşturur
 */

interface ParselData {
  properties?: Record<string, any>;
  geometry?: {
    coordinates?: number[][][] | number[][] | number[];
    type?: string;
  } | null;
  analysisData?: any;
}

/**
 * Parsel bilgilerinden koordinat merkezini hesaplar
 */
function getParcelCenter(geometry: any): { lat: number; lon: number } | null {
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
        sumLon += coord[0];
        sumLat += coord[1];
        count++;
      }
    }

    if (count === 0) {
      return null;
    }

    return {
      lat: sumLat / count,
      lon: sumLon / count,
    };
  } catch (error) {
    console.warn('[queryUrlGenerator] Koordinat hesaplama hatası:', error);
    return null;
  }
}

/**
 * Merged properties'ten parsel bilgilerini çıkarır
 */
function extractParcelInfo(parcelData: ParselData): {
  ada: string | null;
  parsel: string | null;
  mahalleTkgmValue: number | null;
  lat: number | null;
  lon: number | null;
} {
  const properties = parcelData?.properties || {};
  const parametersData = parcelData?.analysisData?.parameters_data || {};
  const parcelValues = parametersData?.parcel_values || {};
  
  const mergedProperties = { ...properties, ...parametersData, ...parcelValues };

  const pickValue = (keys: string[]): string | null => {
    for (const key of keys) {
      const val = mergedProperties[key];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return null;
  };

  const ada = pickValue(['adaNo', 'ada', 'Ada', 'ada_no']);
  const parsel = pickValue(['parselNo', 'parsel', 'Parsel', 'parsel_no']);
  
  // Mahalle TKGm Value - number olarak
  let mahalleTkgmValue: number | null = null;
  const mahalleTkgmValueRaw = mergedProperties.mahalleTkgmValue || mergedProperties.mahalle_tkgm_value;
  if (mahalleTkgmValueRaw !== null && mahalleTkgmValueRaw !== undefined) {
    const parsed = Number(mahalleTkgmValueRaw);
    if (!isNaN(parsed)) {
      mahalleTkgmValue = parsed;
    }
  }

  // Koordinat hesapla
  const center = getParcelCenter(parcelData?.geometry);
  const lat = center?.lat ?? null;
  const lon = center?.lon ?? null;

  return { ada, parsel, mahalleTkgmValue, lat, lon };
}

/**
 * Deep link URL oluşturur (proparcel://)
 */
export function generateDeepLink(parcelData: ParselData): string | null {
  const info = extractParcelInfo(parcelData);

  const params = new URLSearchParams();
  
  if (info.ada && info.parsel) {
    params.append('ada', info.ada);
    params.append('parsel', info.parsel);
    if (info.mahalleTkgmValue !== null) {
      params.append('mahalleTkgmValue', String(info.mahalleTkgmValue));
    }
  } else if (info.lat !== null && info.lon !== null) {
    params.append('lat', info.lat.toFixed(6));
    params.append('lon', info.lon.toFixed(6));
  } else {
    return null;
  }

  return `proparcel://query?${params.toString()}`;
}

/**
 * Universal link URL oluşturur (https://)
 */
export function generateUniversalLink(parcelData: ParselData): string | null {
  const info = extractParcelInfo(parcelData);

  const params = new URLSearchParams();
  
  if (info.ada && info.parsel) {
    params.append('ada', info.ada);
    params.append('parsel', info.parsel);
    if (info.mahalleTkgmValue !== null) {
      params.append('mahalleTkgmValue', String(info.mahalleTkgmValue));
    }
  } else if (info.lat !== null && info.lon !== null) {
    params.append('lat', info.lat.toFixed(6));
    params.append('lon', info.lon.toFixed(6));
  } else {
    return null;
  }

  // Domain: default olarak API_URL base kullan (örn: http://78.189.238.18:8000)
  // Böylece /go ve /query aynı aktif sunucuya gider.
  // Not: Bu domain sadece paylaşım linki içindir; API çağrıları zaten API_URL ile yapılır.
  let domain = 'https://proparcel.com';
  try {
    // Lazy import to avoid circular deps in utils
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('../../config/api');
    const apiUrl: string | undefined = cfg?.API_URL;
    if (apiUrl && typeof apiUrl === 'string') {
      domain = apiUrl.replace(/\/$/, '');
    }
  } catch (_) {}
  return `${domain}/query?${params.toString()}`;
}

/**
 * Paylaşım için en uygun URL'i döndürür (önce universal link, sonra deep link)
 */
export function generateShareLink(parcelData: ParselData): string | null {
  const universalLink = generateUniversalLink(parcelData);
  if (universalLink) {
    return universalLink;
  }
  
  return generateDeepLink(parcelData);
}
