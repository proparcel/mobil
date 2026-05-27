/** Yüksek gerilim hattı — portal detay (web portal-electric-line.js ile hizalı). */

export const ELECTRIC_LINE_COLOR = '#FF4500';
export const ELECTRIC_LINE_WIDTH = 4;

export const ELECTRIC_LEGAL_INFO: readonly string[] = [
  'Bir tarla üzerinden yüksek gerilim enerji nakil hattı geçmesi durumunda taşınmazın mülkiyeti tamamen kaybedilmez; ancak hat guzergahi boyunca belirli bir irtifak hakki (kullanim kisiti) olusur. Bu alanlarda yapilasma ve bazi tarimsal faaliyetler sinirlanabilir.',
  '1. Kamulastirma / Irtifak Bedeli Davasi: Elektrik hatti icin yapilan kamulastirma veya irtifak hakki tesisinde odenen bedelin dusuk oldugu dusunuluyorsa, malik tebligat tarihinden itibaren genellikle 30 gun icinde bedel artirimi davasi acabilir.',
  '2. Kamulastirmasiz El Atma: Eger tasinmaz uzerinden hat gecirilmis ancak herhangi bir kamulastirma yapilmamis veya bedel odenmemisse, malik kamulastirmasiz el atma davasi acabilir. Bu davalar icin uygulamada 20 yillik zamanasimi suresi kabul edilmektedir.',
  '3. Imar Uygulamasina Karsi Dava: Elektrik hatti koridoru ve imar kesintilerinin birlikte hak kaybina yol actigi dusunuluyorsa, imar uygulamasina karsi idare mahkemesinde 60 gun icinde dava acilmasi gerekir. Bu sure genellikle imar uygulamasinin aski ilaninin bitiminden itibaren baslar.',
];

export type LonLat = [number, number];

export type ElectricMapOverlay = {
  id: string;
  data: GeoJSON.FeatureCollection;
  color: string;
  lineWidth: number;
  lineDasharray?: number[];
  lineOpacity?: number;
};

export function normalizeElectricIsExist(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return false;
}

export function readElectricIsExist(electricValues: Record<string, unknown> | null | undefined): boolean {
  const ev = electricValues && typeof electricValues === 'object' ? electricValues : {};
  return normalizeElectricIsExist(ev.electric_isExist ?? ev.electric_isexist);
}

export function normalizeLonLatPair(pair: unknown): LonLat | null {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const a = Number(pair[0]);
  const b = Number(pair[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a >= 36 && a <= 43 && b >= 25 && b <= 46) return [b, a];
  return [a, b];
}

export function extractElectricLineCoordinates(
  electricLineFeature: unknown,
  electricValues?: Record<string, unknown> | null,
): LonLat[] {
  const lf = electricLineFeature && typeof electricLineFeature === 'object'
    ? (electricLineFeature as Record<string, any>)
    : null;
  const ev = electricValues && typeof electricValues === 'object' ? electricValues : {};

  const geomCoords = lf?.geometry?.coordinates ?? lf?.coordinates;
  if (Array.isArray(geomCoords) && geomCoords.length >= 2) {
    const first = geomCoords[0];
    if (Array.isArray(first) && typeof first[0] === 'number') {
      return geomCoords
        .map((c) => normalizeLonLatPair(c))
        .filter((c): c is LonLat => Boolean(c));
    }
    const pair = normalizeLonLatPair(geomCoords);
    return pair ? [pair] : [];
  }

  const electricLine = ev.electric_line;
  if (Array.isArray(electricLine) && electricLine.length >= 2) {
    const p1 = normalizeLonLatPair(electricLine[0]);
    const p2 = normalizeLonLatPair(electricLine[1]);
    if (p1 && p2) return [p1, p2];
  }

  return [];
}

export function hasElectricLineCoords(
  electricLineFeature: unknown,
  electricValues?: Record<string, unknown> | null,
): boolean {
  return extractElectricLineCoordinates(electricLineFeature, electricValues).length >= 2;
}

export function hasElectricLineData(input: {
  electricLineFeature?: unknown;
  electricValues?: Record<string, unknown> | null;
  lineOverlay?: unknown[];
} = {}): boolean {
  const electricValues = input.electricValues && typeof input.electricValues === 'object'
    ? input.electricValues
    : {};
  const overlayLen = Array.isArray(input.lineOverlay) ? input.lineOverlay.length : 0;
  const areaRaw = electricValues.electric_area;
  const areaNum = areaRaw == null || areaRaw === '' ? NaN : Number(areaRaw);
  return Boolean(
    overlayLen > 0
    || readElectricIsExist(electricValues)
    || (Number.isFinite(areaNum) && areaNum > 0)
    || hasElectricLineCoords(input.electricLineFeature, electricValues),
  );
}

export function buildElectricLineFeatureCollection(
  electricLineFeature: unknown,
  electricValues?: Record<string, unknown> | null,
): GeoJSON.FeatureCollection | null {
  const coords = extractElectricLineCoordinates(electricLineFeature, electricValues);
  if (coords.length < 2) return null;

  const lf = electricLineFeature && typeof electricLineFeature === 'object'
    ? (electricLineFeature as Record<string, any>)
    : null;
  const props = lf?.properties && typeof lf.properties === 'object'
    ? { ...lf.properties }
    : {};

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    }],
  };
}

export function buildElectricMapOverlays(
  electricLineFeature: unknown,
  electricValues?: Record<string, unknown> | null,
  options: { color?: string; lineWidth?: number; id?: string; lineDasharray?: number[]; lineOpacity?: number } = {},
): ElectricMapOverlay[] {
  const fc = buildElectricLineFeatureCollection(electricLineFeature, electricValues);
  if (!fc) return [];

  return [{
    id: options.id || 'electric-line',
    data: fc,
    color: options.color || ELECTRIC_LINE_COLOR,
    lineWidth: options.lineWidth ?? ELECTRIC_LINE_WIDTH,
    lineDasharray: options.lineDasharray ?? [2, 1],
    lineOpacity: options.lineOpacity ?? 0.9,
  }];
}

export function computeElectricLineBounds(
  electricLineFeature: unknown,
  electricValues: Record<string, unknown> | null | undefined,
  parcelCoordsLonLat?: number[][] | null,
): [LonLat, LonLat] | null {
  const coords = extractElectricLineCoordinates(electricLineFeature, electricValues);
  const all: LonLat[] = [...coords];

  if (Array.isArray(parcelCoordsLonLat)) {
    for (const c of parcelCoordsLonLat) {
      const pair = normalizeLonLatPair(c);
      if (pair) all.push(pair);
    }
  }

  const valid = all.filter(
    (c) => Number.isFinite(c[0]) && Number.isFinite(c[1])
      && Math.abs(c[0]) > 1 && Math.abs(c[1]) > 1,
  );
  if (valid.length < 1) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of valid) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng)) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function parseElectricVoltage(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const matched = String(value).match(/(\d+(?:[.,]\d+)?)/);
  if (!matched) return null;
  const parsed = Number(matched[1].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseElectricArea(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const matched = String(value).match(/(\d+(?:[.,]\d+)?)\s*m²?/i);
    if (matched) {
      const parsedFromText = Number(matched[1].replace(',', '.'));
      return Number.isFinite(parsedFromText) ? parsedFromText : null;
    }
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === -1) return 0;
  return numeric;
}

export function formatElectricArea(value: unknown): string {
  const parsedArea = parseElectricArea(value);
  if (!Number.isFinite(parsedArea) || parsedArea == null || parsedArea <= 0) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(parsedArea);
}

export function buildElectricLineSummary(input: {
  electricValues?: Record<string, unknown> | null;
  electricLineFeature?: unknown;
  hasElectricLine?: boolean;
} = {}): string {
  const electricValues = input.electricValues && typeof input.electricValues === 'object'
    ? input.electricValues
    : {};
  const lf = input.electricLineFeature && typeof input.electricLineFeature === 'object'
    ? input.electricLineFeature
    : null;
  const hasLine = input.hasElectricLine ?? hasElectricLineData({
    electricValues,
    electricLineFeature: lf,
  });

  const lfProps = lf && typeof (lf as Record<string, any>).properties === 'object'
    ? (lf as Record<string, any>).properties
    : null;

  const voltage = parseElectricVoltage(
    electricValues.KW
    || electricValues.voltage
    || lfProps?.voltage,
  );
  const affectedArea = formatElectricArea(
    electricValues.electric_area_str
    ?? electricValues.electric_area
    ?? lfProps?.area_m2,
  );

  if (hasLine) {
    const voltageText = voltage
      ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(voltage)} KV`
      : 'bir';
    return `Düşüş: Arazi üzerinden ${voltageText} Yüksek Gerilim Hattı geçmektedir. İrtifak hakkı kullanılan alan ${affectedArea} m2 dir. Bu sebeple arazinin birim fiyatında indirim uygulanmıştır.`;
  }

  return 'Sabit: Arazi üzerinden geçen Yüksek Gerilim Hattı tespit edilmediği için fiyatta bir değişim olmamıştır.';
}

export function formatElectricAreaDisplay(value: unknown): string {
  const parsed = parseElectricArea(value);
  if (parsed == null || !Number.isFinite(parsed)) return '—';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(parsed)} m²`;
}

export function formatElectricVoltageDisplay(value: unknown): string {
  const parsed = parseElectricVoltage(value);
  if (parsed == null) return '—';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(parsed)} kV`;
}

export function electricVoltageClassLabel(voltageKV: number | null): string {
  if (voltageKV == null) return 'Bilinmiyor';
  if (voltageKV >= 380) return 'Çok Yüksek Gerilim (380 kV+)';
  if (voltageKV >= 154) return 'Yüksek Gerilim (154-380 kV)';
  if (voltageKV >= 34.5) return 'Orta Gerilim (34.5-154 kV)';
  if (voltageKV >= 1) return 'Alçak Gerilim (1-34.5 kV)';
  return 'Düşük Gerilim (<1 kV)';
}
