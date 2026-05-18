/**
 * Yapı modelleri: kare taban poligonu (kalibre footprint_base_m2 × ölçek²), kenar uzunlukları.
 */
import { offsetCoordinateMeters, type ModelInstance } from "./ModelManager";
import type { ModelCatalogFlatItem } from "./modelCatalog";

/**
 * house kategorisi için API'de footprint_base_m2 yoksa kullanılan varsayılan (m²).
 * Web MODEL_METADATA.house.baseArea (500) ile aynı hizada; 95 kullanıldığında poligon mesh'ten küçük kalıyordu.
 */
export const DEFAULT_HOUSE_FOOTPRINT_BASE_M2 = 500;

function filenameStemLower(item: { filename?: string }): string {
  return String(item.filename || "")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase();
}

/**
 * GLB'nin birim boyutu modele göre çok değişiyor; DB'de footprint_base_m2 yokken bilinen büyük mesh'ler için taban referansını artırır.
 * (Örn. farm_house yerleştirmede scale ~0.28; referans düşük kalırsa alan scale² ile aşırı küçülür.)
 */
export function getFootprintStemBaseMultiplier(item: ModelCatalogFlatItem): number {
  const stem = filenameStemLower(item);
  if (stem === "farm_house" || stem.includes("farm_house")) return 12;
  if (item.id === 5) return 12;
  return 1;
}

/** Dosya adına göre ilk yerleştirmede ek küçültme (farm_house büyük mesh). */
export function getDefaultScaleMultiplierForCatalogItem(item: {
  filename: string;
  id?: number;
}): number {
  const stem = String(item.filename || "")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase();
  if (stem === "farm_house" || stem.includes("farm_house")) return 0.28;
  if (item.id === 5) return 0.28;
  return 1;
}

export function getUniformScale(inst: ModelInstance): number {
  const sc = (inst.modelScale || [1, 1, 1]) as [number, number, number];
  const a = Number.isFinite(sc[0]) ? sc[0] : 1;
  const b = Number.isFinite(sc[1]) ? sc[1] : 1;
  const c = Number.isFinite(sc[2]) ? sc[2] : 1;
  const u = (a + b + c) / 3;
  return u > 0 ? u : 1;
}

export function resolveFootprintBaseM2(item: ModelCatalogFlatItem | undefined): number | null {
  if (!item?.isYapi) return null;
  const raw = item.footprintBaseM2;
  /** Admin panelinden girilmiş kalibrasyon: olduğu gibi kullan (stem çarpanı uygulanmaz). */
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (item.groupId === "house") {
    return DEFAULT_HOUSE_FOOTPRINT_BASE_M2 * getFootprintStemBaseMultiplier(item);
  }
  return null;
}

/** Dinamik taban alanı (m²) = referans × (uniform scale)² */
export function computeFootprintAreaM2(
  inst: ModelInstance,
  item: ModelCatalogFlatItem | undefined
): number | null {
  const base = resolveFootprintBaseM2(item);
  if (base == null) return null;
  const u = getUniformScale(inst);
  return base * u * u;
}

export type FootprintLabelFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { label: string };
};

export type FootprintGeometry = {
  polygonRing: [number, number][]; // kapalı halka [lng,lat] (ilk=son)
  labelFeatures: FootprintLabelFeature[];
};

/**
 * Kare taban: merkez + alan + Z ekseni dönüşü (derece, Mapbox modelRotation[2] ile uyumlu).
 */
export function buildSquareFootprintGeometry(
  center: [number, number],
  areaM2: number,
  rotationDegZ: number
): FootprintGeometry {
  const area = Math.max(areaM2, 1e-6);
  const L = Math.sqrt(area);
  const h = L / 2;
  const theta = (rotationDegZ * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const rotate = (east: number, north: number): [number, number] => [
    east * cos - north * sin,
    east * sin + north * cos,
  ];

  const cornersLocal: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];

  const ring: [number, number][] = cornersLocal.map(([e, n]) => {
    const [east, north] = rotate(e, n);
    return offsetCoordinateMeters(center, east, north);
  });
  ring.push(ring[0]);

  const labelFeatures: FootprintLabelFeature[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rotate(...cornersLocal[i]);
    const b = rotate(...cornersLocal[(i + 1) % 4]);
    const midE = (a[0] + b[0]) / 2;
    const midN = (a[1] + b[1]) / 2;
    const coord = offsetCoordinateMeters(center, midE, midN);
    labelFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { label: `${L.toFixed(1)} m` },
    });
  }

  return { polygonRing: ring, labelFeatures };
}
