/**
 * Parsel kartı / ekran görüntüsü için birleşik özellik kaynağı.
 * TKGM, pro sorgu parcel_values ve üst düzey parameters_data alanlarını tek yerde toplar.
 */

export type ParcelDisplaySource = {
  properties?: Record<string, any> | null;
  analysisData?: {
    properties?: Record<string, any> | null;
    parameters_data?: Record<string, any> | null;
  } | null;
} | null | undefined;

const isNonEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  return s.length > 0 && s !== '-';
};

/** Boş olmayan alanları sırayla üst üste yazar (son kaynak kazanır). */
function mergeDefinedLayers(...layers: Array<Record<string, any> | null | undefined>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const [key, value] of Object.entries(layer)) {
      if (isNonEmpty(value)) out[key] = value;
    }
  }
  return out;
}

export function mergeParcelDisplayProperties(parcel: ParcelDisplaySource): Record<string, any> {
  if (!parcel) return {};

  const parametersData = parcel.analysisData?.parameters_data || {};
  const parcelValues = parametersData.parcel_values || {};
  const tkgmProps = parametersData.tkgm_data?.properties || {};
  const responseProps = parcel.analysisData?.properties || {};

  const quarterName = parametersData.quarter_name;
  const quarterLayer =
    isNonEmpty(quarterName)
      ? { mahalleAd: quarterName, quarter_name: quarterName, mahalle: quarterName }
      : {};

  return mergeDefinedLayers(
    tkgmProps,
    responseProps,
    parcel.properties || {},
    quarterLayer,
    parcelValues,
  );
}

export const LOCATION_IL_KEYS = ['ilAd', 'il', 'city', 'city_name', 'cityName', 'CityName'] as const;
export const LOCATION_ILCE_KEYS = ['ilceAd', 'ilce', 'town', 'town_name', 'townName', 'TownName'] as const;
export const LOCATION_MAHALLE_KEYS = [
  'mahalleAd',
  'mahalle',
  'quarter',
  'quarter_name',
  'QuarterName',
] as const;

export function pickParcelDisplayValue(source: Record<string, any>, keys: readonly string[]): string {
  for (const key of keys) {
    const val = source[key];
    if (isNonEmpty(val)) return String(val).trim();
  }
  return '-';
}
