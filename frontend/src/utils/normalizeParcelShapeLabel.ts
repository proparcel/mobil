const PARCEL_SHAPE_CODE_TR: Record<string, string> = {
  square: 'Kare',
  rectangle: 'Dikdörtgen',
  triangle: 'Üçgen',
  polygon: 'Çokgen',
  poligon: 'Çokgen',
  cokgen: 'Çokgen',
  l_type: 'L tipi',
};

function formatTitleCaseTr(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
    .join(' ');
}

export function normalizeParcelShapeLabel(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return value as null | undefined;
  }
  const s = String(value).trim();
  if (!s) {
    return value as string;
  }
  if (/^poligon$/i.test(s) || /^polygon$/i.test(s) || /^cokgen$/i.test(s)) {
    return 'Çokgen';
  }
  const key = s.toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'u_type' || key === 'u_tipi' || key === 't_type' || key === 't_tipi') {
    return 'Çokgen';
  }
  if (key === 'dar_uzun') {
    return 'Dikdörtgen';
  }
  if (PARCEL_SHAPE_CODE_TR[key]) {
    return PARCEL_SHAPE_CODE_TR[key];
  }
  return formatTitleCaseTr(s) || s;
}
