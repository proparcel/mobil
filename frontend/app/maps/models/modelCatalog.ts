import { Image } from "react-native";
import { MODELS_URL } from "../../../config/api";

function getModelsBaseUrl(): string {
  // Model dosyaları Django'nun /media altında servis ediliyor.
  // Ana API (ngrok) ayrı olabilir; modeller için ayrı base kullanıyoruz.
  return String(MODELS_URL || "").replace(/\/$/, "");
}

export type ModelAsset = number | string;

export type ModelCatalogEntry = {
  /**
   * Statik require() ile eklenen asset id (Metro bundling için gerekli)
   * Örn: require("../../assets/models/car/my_car.glb")
   */
  asset?: number;
  /**
   * Harici URL ile model kullanımı (opsiyonel)
   */
  url?: string;
  /**
   * Varsayılan scale (ModelLayer modelScale)
   */
  defaultScale?: [number, number, number];
  /**
   * Varsayılan rotation (ModelLayer modelRotation, euler)
   */
  defaultRotation?: [number, number, number];
  /**
   * Varsayılan translation (ModelLayer modelTranslation, meters)
   */
  defaultTranslation?: [number, number, number];
  /**
   * Varsayılan opacity (ModelLayer modelOpacity)
   */
  defaultOpacity?: number;
};

export type ModelCatalogGroup = {
  id: "car" | "house" | "tree";
  title: string;
  models: ModelCatalogEntry[];
};

/**
 * MODEL EKLEME KURALI (ZORUNLU):
 * - GLB/GLTF dosyalarını `assets/models/{car,house,tree}/` altına koy.
 * - Metro asset bundling için buraya MUTLAKA statik require() satırı ekle.
 *
 * Örnek:
 * models: [{ asset: require("../../../assets/models/car/my_car.glb") }]
 *
 * Not: Dropdown label "dosyanın kendisinden" (asset uri basename) alınır.
 */
export const MODEL_CATALOG: ModelCatalogGroup[] = [
  {
    id: "car",
    title: "Araba",
    models: [
      {
        // Modeller Git'e girmez; Django/ngrok üzerinden URL ile servis edilir.
        url: `${getModelsBaseUrl()}/media/models/car/Car.glb`,
        defaultScale: [1, 1, 1],
        defaultRotation: [0, 0, 0],
        defaultTranslation: [0, 0, 0],
        defaultOpacity: 1,
      },
    ],
  },
  {
    id: "house",
    title: "Ev",
    models: [
      // NOT:
      // - Çok büyük GLB dosyaları (örn. yüzlerce MB) Expo/Metro bundling sırasında
      //   `Cannot create a string longer than 0x1fffffe8 characters` hatasına sebep olur.
      // - Bu yüzden çok büyük modelleri asset olarak paketlemek yerine URL üzerinden yüklemek gerekir.
      //
      // Örnek (URL ile):
      // { url: "https://.../House.glb" }
      {
        // Büyük modelleri Django (ngrok) üzerinden /media/ altında servis ediyoruz.
        url: `${getModelsBaseUrl()}/media/models/house/House.glb`,
        defaultScale: [1, 1, 1],
        defaultRotation: [0, 0, 0],
        defaultTranslation: [0, 0, 0],
        defaultOpacity: 1,
      },
      {
        url: `${getModelsBaseUrl()}/media/models/house/modern_villa.glb`,
        defaultScale: [1, 1, 1],
        defaultRotation: [0, 0, 0],
        defaultTranslation: [0, 0, 0],
        defaultOpacity: 1,
      },
    ],
  },
  {
    id: "tree",
    title: "Ağaç",
    models: [
      {
        url: `${getModelsBaseUrl()}/media/models/tree/tree1.glb`,
        defaultScale: [1, 1, 1],
        defaultRotation: [0, 0, 0],
        defaultTranslation: [0, 0, 0],
        defaultOpacity: 1,
      },
    ],
  },
];

function stripQueryAndHash(input: string): string {
  const q = input.indexOf("?");
  const h = input.indexOf("#");
  const cut = Math.min(q === -1 ? input.length : q, h === -1 ? input.length : h);
  return input.slice(0, cut);
}

function basename(pathOrUrl: string): string {
  const clean = stripQueryAndHash(pathOrUrl);
  const parts = clean.split("/");
  return parts[parts.length - 1] || clean;
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

export function getModelLabelFromAsset(assetId: number): string {
  try {
    const asset = Image.resolveAssetSource(assetId);
    const uri = asset?.uri || "";
    if (!uri) return `model_${String(assetId)}`;
    return stripExtension(basename(uri));
  } catch (e) {
    return `model_${String(assetId)}`;
  }
}

export function getModelLabelFromUrl(url: string): string {
  const safe = String(url || "");
  if (!safe) return "model";
  return stripExtension(basename(safe));
}

export function getModelIdFromEntry(entry: ModelCatalogEntry): string {
  if (typeof entry.asset === "number") return getModelLabelFromAsset(entry.asset);
  if (typeof entry.url === "string" && entry.url) return getModelLabelFromUrl(entry.url);
  return "model";
}

export function getModelSourceForEntry(entry: ModelCatalogEntry): ModelAsset | null {
  if (typeof entry.asset === "number") return entry.asset;
  if (typeof entry.url === "string" && entry.url) return entry.url;
  return null;
}

