import type { ParcelTerrain3d, ParcelTerrain3dSlopeColorStop } from '../../../src/types/portal';

/** ProParcel / backend sözleşmesi ile aynı eğim renk skalası */
export const DEFAULT_SLOPE_COLOR_STOPS: ParcelTerrain3dSlopeColorStop[] = [
  { maxSlopeDeg: 5, label: 'Düz', color: '#4CAF50' },
  { maxSlopeDeg: 10, label: 'Hafif', color: '#8BC34A' },
  { maxSlopeDeg: 20, label: 'Orta', color: '#FFC107' },
  { maxSlopeDeg: 30, label: 'Dik', color: '#FF9800' },
  { maxSlopeDeg: 999, label: 'Çok dik', color: '#F44336' },
];

export type MockParcelTerrain3dOptions = {
  ada?: string | null;
  parsel?: string | null;
  areaM2?: number | null;
  center?: { lat: number; lon: number };
};

function pointInPolygon(x: number, z: number, polygon: Array<{ x: number; z: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function computeSlopesDeg(
  width: number,
  height: number,
  cellSizeM: number,
  elevations: number[],
): number[] {
  const slopes = new Array<number>(width * height).fill(0);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const e = elevations[idx];
      let maxGrad = 0;
      const neighbors: Array<[number, number]> = [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1],
      ];
      for (const [nc, nr] of neighbors) {
        if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
        const nIdx = nr * width + nc;
        const de = Math.abs(e - elevations[nIdx]);
        const dist = cellSizeM;
        maxGrad = Math.max(maxGrad, de / dist);
      }
      slopes[idx] = (Math.atan(maxGrad) * 180) / Math.PI;
    }
  }
  return slopes;
}

/**
 * Demo parsel + eğim grid — API çağrısı yok.
 * Trapez parsel, merkezde hafif tepe; VR/terrain paket sözleşmesine uygun.
 */
export function buildMockParcelTerrain3d(options: MockParcelTerrain3dOptions = {}): ParcelTerrain3d {
  const width = 40;
  const height = 40;
  const cellSizeM = 2;
  const origin = { x: -40, z: -40 };

  const localPolygon = [
    { x: -18, z: -14 },
    { x: 16, z: -10 },
    { x: 22, z: 12 },
    { x: -12, z: 16 },
  ];

  const elevations: number[] = [];
  const mask: number[] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const x = origin.x + col * cellSizeM;
      const z = origin.z + row * cellSizeM;
      const dist2 = x * x + z * z;
      const hill = 6 * Math.exp(-dist2 / 900);
      const ripple = 1.2 * Math.sin(x * 0.12) * Math.cos(z * 0.1);
      elevations.push(102 + hill + ripple);
      mask.push(pointInPolygon(x, z, localPolygon) ? 1 : 0);
    }
  }

  const slopes = computeSlopesDeg(width, height, cellSizeM, elevations);

  const center = options.center ?? { lat: 41.015, lon: 29.004 };

  return {
    version: 1,
    type: 'parcel_terrain_3d',
    parcel: {
      ada: options.ada ?? 'Demo',
      parsel: options.parsel ?? '42',
      areaM2: options.areaM2 ?? 1250,
      center,
      localPolygon,
    },
    terrain: {
      gridType: 'regular',
      width,
      height,
      cellSizeM,
      origin,
      heightScaleSuggestion: 1.2,
      elevations,
      slopes,
      mask,
    },
    stats: {
      schemaVersion: 2,
      displaySlopeUnit: 'percent',
      slope_avg_pct: 12.4,
      slope_max_pct: 28.6,
      parcel_slope_pct_0_20: 55,
      parcel_slope_pct_20_30: 32,
      parcel_slope_pct_over_30: 13,
      elevation_min_m: 102,
      elevation_max_m: 110,
      elevation_range_m: 8,
      area_m2: options.areaM2 ?? 1250,
    },
    render: {
      slopeColorStops: DEFAULT_SLOPE_COLOR_STOPS,
      showParcelBorder: true,
      showElevationLegend: true,
      showSlopeLegend: true,
    },
    meta: {
      source: 'mock_dev',
      note: 'ProParcel demo terrain — gercek API verisi degil',
    },
  };
}

/** Mock yalnizca EXPO_PUBLIC_TERRAIN_3D_MOCK=1 ile acilir; varsayilan gercek API. */
export function isTerrain3dMockMode(): boolean {
  return (
    process.env.EXPO_PUBLIC_TERRAIN_3D_MOCK === '1' ||
    process.env.EXPO_PUBLIC_TERRAIN_3D_MOCK === 'true'
  );
}
