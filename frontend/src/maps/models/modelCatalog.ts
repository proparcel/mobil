import { API_URL, MODELS_URL } from "../../../config/api";
import { sanitizeAsciiFileStem } from "../../utils/modelsCache";
import { storageService } from "../../../services/storageService";
import { authService } from "../../../services/authService";
import { computeIsAvailable } from "./modelAvailability";

/**
 * 3D model katalogu:
 * - Liste: backend'deki `/api/3d-models-list/` endpoint'inden gelir (veritabanından).
 * - Dosya: Backend'den gelen `path` alanı kullanılarak `/static/<path>` formatında servis edilir.
 *
 * Not: API_URL ile MODELS_URL farklı olabilir; liste için önce MODELS_URL denenir,
 * olmazsa API_URL'e fallback yapılır. Dosya URL'leri ise MODELS_URL base ile kurulur.
 */

function normalizeBaseUrl(input: string): string {
  return String(input || "").trim().replace(/\/$/, "");
}

function getModelsBaseUrl(): string {
  return normalizeBaseUrl(MODELS_URL);
}

function getApiBaseCandidates(): string[] {
  // Sadece Django kullanılıyor (7000 portu)
  // MODELS_URL ve API_URL aynı Django backend'i işaret ediyor
  const a = normalizeBaseUrl(MODELS_URL);
  const b = normalizeBaseUrl(API_URL);
  const out = [a, b].filter(Boolean);
  // Tekrarları kaldır (MODELS_URL ve API_URL aynı olabilir)
  return out.filter((x, i) => out.indexOf(x) === i);
}

/**
 * Web model galerisi ile aynı mantık: DB'den gelen göreli yolu mobilde yüklenebilir tam URL'ye çevirir.
 * "Benim modellerim" sekmesindeki kartlarla (ShapeDrawingDropdownSheets) uyumlu.
 */
/** Backend `normalize_model_static_path` ile aynı: yalnızca indirme URL'si için. */
export function pathForStaticUrl(path: string): string {
  let p = String(path || "").replace(/\\/g, "/").trim();
  for (const prefix of ["myapp/static/", "static/", "assets/"]) {
    if (p.startsWith(prefix)) {
      p = p.slice(prefix.length);
      break;
    }
  }
  return p;
}

/** @deprecated pathForStaticUrl kullanın */
export function normalizeModelBackendPath(backendPath: string): string {
  return pathForStaticUrl(backendPath);
}

function fixStaticAssetsUrl(url: string): string {
  const u = String(url || "").trim();
  if (!u) return u;
  return u.replace(/\/static\/assets\//gi, "/static/");
}

/** Katalog satırından veya ham path/file ile tam GLB HTTPS URL üretir. */
export function buildModelGlbSourceUrl(params: {
  path?: string;
  groupId?: ModelType;
  filename?: string;
  modelsBase?: string;
}): string | null {
  const modelsBase = normalizeBaseUrl(params.modelsBase || getModelsBaseUrl());
  const backendPath = String(params.path || "").trim();
  const fileField = String(params.filename || "").trim();
  if (backendPath) {
    const normalizedPath = pathForStaticUrl(backendPath);
    return encodeURI(`${modelsBase}/static/${normalizedPath}`);
  }
  if (fileField && params.groupId) {
    return encodeURI(`${modelsBase}/static/models/${params.groupId}/${fileField}`);
  }
  return null;
}

/** Flat katalog öğesi için indirme URL'si (source boşsa path/filename'den üretir). */
export function resolveModelGlbSourceUrl(item: {
  source?: string;
  path?: string;
  groupId?: ModelType;
  filename?: string;
}): string | null {
  const direct = String(item?.source || "").trim();
  if (direct) return fixStaticAssetsUrl(direct);
  return buildModelGlbSourceUrl({
    path: (item as { path?: string }).path,
    groupId: item.groupId,
    filename: item.filename,
  });
}

export function resolveModelStaticImageUri(rawPath: string | undefined | null): string | null {
  const raw = String(rawPath ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = normalizeBaseUrl(API_URL);
  if (raw.startsWith("/static/") || raw.startsWith("/media/")) {
    return `${base}${raw}`;
  }
  return `${base}/static/${raw.replace(/^\//, "")}`;
}

export type ModelType = "car" | "house" | "tree" | "grass";

export type RemoteModelListEntry = {
  id?: number;
  /** Programatik anahtar (API'den; örn. model_1). Yoksa mobil tarafta model_${id} türetilir. */
  model_id?: string;
  file: string;
  path?: string; // Backend'den gelen relative path (örn: "models/house/modern_villa.glb")
  name?: string;
  /** Galeri önizlemesi (API: normalize_model_static_path) */
  picture_path?: string | null;
  thumbnail_path?: string | null;
  remaining_uses?: number | null;
  is_available?: boolean;
  is_owned?: boolean;
  tepe_credits?: number;
  /** DB alanı: ürün erişim rolü (örn: "free") */
  role?: string;
  /** Yapı: mobilde taban poligonu + m² */
  is_yapi?: boolean;
  /** Scale=1 iken referans taban alanı (m²) */
  footprint_base_m2?: number | null;
};

export type RemoteModelsListResponse = Partial<Record<ModelType, RemoteModelListEntry[]>>;

export type ModelCatalogFlatItem = {
  groupId: ModelType;
  groupTitle: string;
  /** Tablo id'nin string hali (örn. "20"); Mapbox/instance key olarak kullanılır, model_id alanı kullanılmaz */
  modelId: string;
  source: string;
  filename: string;
  /** Tablo id (model_3d_objects.id); pack adı pp_model_<id> ile eşleşir */
  id?: number;
  remainingUses?: number | null; // null = sınırsız
  isAvailable: boolean;
  /** API is_owned; use to show usage badge only for owned models */
  isOwned?: boolean;
  tepeCredits?: number;
  /** DB name from model_3d_objects; use for display when present */
  name?: string;
  /** Önizleme görselleri (API: picture_path / thumbnail_path) */
  picturePath?: string | null;
  thumbnailPath?: string | null;
  /** DB alanı: ürün erişim rolü (örn: "free") */
  role?: string;
  /** Yapı modeli: taban poligonu ve dinamik m² */
  isYapi?: boolean;
  /** Scale=1 iken referans taban alanı (m²); API footprint_base_m2 */
  footprintBaseM2?: number | null;
};

const MODEL_GROUP_META: Array<{ id: ModelType; title: string }> = [
  { id: "car", title: "Araba" },
  { id: "house", title: "Ev" },
  { id: "tree", title: "Ağaç" },
  { id: "grass", title: "Çim" },
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

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function coerceArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

async function fetchModelsListFromApiWithBase(): Promise<{ baseUrl: string | null; data: RemoteModelsListResponse }> {
  console.log("[modelCatalog] fetchModelsListFromApiWithBase başladı");
  await authService.refreshToken();
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  const token = await storageService.getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[modelCatalog] Bearer token var, 3d-models-list auth ile çağrılacak, token len=" + token.length);
  } else {
    console.log("[modelCatalog] Bearer token yok, 3d-models-list anonymous çağrılacak");
  }
  const timeoutMs = 60000; // 60 saniye timeout (Django endpoint optimizasyonu sonrası artırıldı)
  const errors: string[] = [];

  const candidates = getApiBaseCandidates();
  console.log("[modelCatalog] API base candidates:", candidates);

  for (const base of candidates) {
    const url = `${base}/api/3d-models-list/?platform=mobil`;
    console.log("[modelCatalog] Denenen URL:", url);

    // Create AbortController for timeout
    const controller = new AbortController();
    const startTime = Date.now();
    const timeoutId = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      console.warn(`[modelCatalog] ⏱️ Timeout tetiklendi (${elapsed}ms > ${timeoutMs}ms):`, url);
      controller.abort();
    }, timeoutMs);

    try {
      console.log("[modelCatalog] Fetch başlatılıyor:", url);
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal as any,
      });
      const duration = Date.now() - startTime;
      clearTimeout(timeoutId);
      console.log("[modelCatalog] ✅ Fetch tamamlandı:", { url, status: res.status, duration: `${duration}ms` });
      
      if (!res.ok) {
        const errorMsg = `${base}: HTTP ${res.status}`;
        console.warn("[modelCatalog] HTTP hatası:", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      console.log("[modelCatalog] Response text okunuyor...");
      const raw = await res.text();
      console.log("[modelCatalog] Response text uzunluğu:", raw.length, "ilk 200 karakter:", raw.substring(0, 200));
      
      const data = safeJsonParse(raw);
      console.log("[modelCatalog] JSON parse sonucu:", { 
        isObject: typeof data === "object" && data !== null,
        hasData: !!data,
        keys: data && typeof data === "object" ? Object.keys(data) : null
      });
      
      if (data && typeof data === "object") {
        // Kategori sayılarını logla
        const categoryCounts: Record<string, number> = {};
        for (const meta of MODEL_GROUP_META) {
          const entries = coerceArray((data as any)?.[meta.id]);
          categoryCounts[meta.id] = entries.length;
        }
        console.log("[modelCatalog] ✅ Başarılı! Model kategorileri:", categoryCounts);
        // Debug: ilk kategorideki ilk birkaç modelde is_owned, is_available, remaining_uses
        for (const meta of MODEL_GROUP_META) {
          const entries = coerceArray((data as any)?.[meta.id]);
          if (entries.length > 0) {
            const sample = entries.slice(0, 3).map((m: any) => ({
              id: m?.id,
              name: m?.name,
              is_owned: m?.is_owned,
              is_available: m?.is_available,
              remaining_uses: m?.remaining_uses,
            }));
            console.log(`[modelCatalog] Örnek ${meta.id} (is_owned/is_available/remaining_uses):`, JSON.stringify(sample));
            break;
          }
        }
        return { baseUrl: base, data: data as RemoteModelsListResponse };
      } else {
        const errorMsg = `${base}: Geçersiz response formatı`;
        console.error("[modelCatalog] Geçersiz response formatı:", { data, type: typeof data });
        errors.push(errorMsg);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("[modelCatalog] Fetch hatası:", { url, error: error?.message || String(error), name: error?.name });
      
      // Handle timeout
      if (error?.name === "AbortError" || error?.name === "TimeoutError") {
        const elapsed = Date.now() - startTime;
        const errorMsg = `${base}: Zaman aşımı (${elapsed}ms > ${timeoutMs}ms)`;
        console.warn("[modelCatalog] ⏱️ Timeout hatası:", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      // Handle network errors
      if (error?.message?.includes("Network request failed") || error?.message?.includes("Failed to fetch")) {
        const errorMsg = `${base}: Ağ hatası`;
        console.warn("[modelCatalog] Ağ hatası:", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      // Other errors
      const errorMsg = `${base}: ${error?.message || String(error)}`;
      console.error("[modelCatalog] Diğer hata:", errorMsg);
      errors.push(errorMsg);
    }
  }
  
  // Tüm denemeler başarısız olduysa hata fırlat
  const finalError = `Model listesi alınamadı. Denenen URL'ler: ${candidates.join(", ")}. Hatalar: ${errors.join("; ")}`;
  console.error("[modelCatalog] ❌ Tüm denemeler başarısız:", finalError);
  throw new Error(finalError);
}

/**
 * Backend'den (veritabanından) katalogu çekip dropdown için flatten eder.
 * - modelId: dosya adından türetilir (ext'siz)
 * - source: Backend'den gelen `path` kullanılarak baseUrl + /static/<path> formatında oluşturulur
 *   Eğer `path` yoksa fallback olarak eski format kullanılır: baseUrl + /static/models/<kategori>/<dosya>
 *
 * Not:
 * - MODELS_URL ile API_URL farklı olabilir.
 * - Eğer MODELS_URL erişilemiyorsa liste API_URL'den gelebilir; bu durumda model dosyası base'i de aynı URL olmalıdır.
 */
/** Harita / indirme için satır id (model_3d_objects.id) ile katalog kaydı. */
export function getModelSourceByRowId(
  catalog: ModelCatalogFlatItem[],
  rowId: number
): string | null {
  const item = catalog.find((m) => m.id === rowId);
  const src = item?.source?.trim();
  return src || null;
}

export async function fetchModelCatalogFlat(): Promise<ModelCatalogFlatItem[]> {
  console.log("[modelCatalog] fetchModelCatalogFlat başladı");
  try {
    const { baseUrl, data } = await fetchModelsListFromApiWithBase();
    console.log("[modelCatalog] API'den veri alındı:", { baseUrl, hasData: !!data });
    const modelsBase = baseUrl || getModelsBaseUrl();
    console.log("[modelCatalog] Models base URL:", modelsBase);
    const out: ModelCatalogFlatItem[] = [];

    for (const meta of MODEL_GROUP_META) {
      const entries = coerceArray<RemoteModelListEntry>((data as any)?.[meta.id]);
      console.log(`[modelCatalog] Kategori ${meta.id}: ${entries.length} model bulundu`);
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const e of entries) {
        // Backend'den gelen path alanını kullan (yeni veritabanı formatı)
        // Eğer path yoksa file alanından dosya adını al (eski format için fallback)
        const backendPath = String((e as any)?.path || "").trim();
        const fileField = String((e as any)?.file || "").trim();
        
        if (!backendPath && !fileField) {
          console.warn(`[modelCatalog] ${meta.id}: path ve file alanı boş, atlanıyor:`, e);
          skippedCount++;
          continue;
        }
        
        // Dosya adını belirle: path varsa path'ten, yoksa file alanından
        let filename: string;
        if (backendPath) {
          // path'ten dosya adını çıkar (örn: "models/house/modern_villa.glb" -> "modern_villa.glb")
          filename = basename(backendPath);
        } else if (fileField) {
          filename = fileField;
        } else {
          skippedCount++;
          continue;
        }
        
        if (!filename) {
          console.warn(`[modelCatalog] ${meta.id}: filename boş, atlanıyor:`, { backendPath, fileField });
          skippedCount++;
          continue;
        }
        
        const rawModelId = stripExtension(basename(filename));
        if (!rawModelId) {
          console.warn(`[modelCatalog] ${meta.id}: rawModelId boş, atlanıyor:`, filename);
          skippedCount++;
          continue;
        }
        
        // Tablonun id alanı kullanılır; model_id / model_1 gibi string kullanılmaz.
        const id = typeof (e as any)?.id === "number" ? (e as any).id : undefined;
        if (id == null || !Number.isFinite(id)) {
          console.warn(`[modelCatalog] ${meta.id}: id yok, atlanıyor:`, { rawModelId });
          skippedCount++;
          continue;
        }
        const modelId = String(id);
        
        // URL oluştur: Backend'den gelen path kullan (yeni format)
        // Eğer path yoksa fallback olarak eski formatı kullan
        let source: string;
        const built = buildModelGlbSourceUrl({
          path: backendPath || undefined,
          groupId: meta.id,
          filename,
          modelsBase,
        });
        if (!built) {
          skippedCount++;
          continue;
        }
        source = built;
        
        // Extract usage count and other metadata from API response.
        // IMPORTANT:
        // Backend `remaining_uses` is only meaningful when `is_owned === true`.
        // Some responses may include `remaining_uses: null` even for non-owned models; that must NOT be treated as "unlimited".
        const role = typeof (e as any)?.role === "string" ? String((e as any).role).trim().toLowerCase() : undefined;
        const isAvailable = computeIsAvailable({
          role,
          is_available: (e as any)?.is_available,
        });
        const isOwned = (e as any)?.is_owned === true;
        const remainingUses =
          isOwned
            ? ((e as any)?.remaining_uses !== undefined ? (e as any).remaining_uses : null)
            : undefined;
        const tepeCredits = typeof (e as any)?.tepe_credits === "number" ? (e as any).tepe_credits : undefined;
        const name = typeof (e as any)?.name === "string" ? (e as any).name : undefined;
        const thumbRaw = (e as any)?.thumbnail_path;
        const picRaw = (e as any)?.picture_path;
        const thumbnailPath =
          typeof thumbRaw === "string" && thumbRaw.trim() ? thumbRaw.trim() : null;
        const picturePath =
          typeof picRaw === "string" && picRaw.trim() ? picRaw.trim() : null;

        const rawYapi = (e as any)?.is_yapi;
        const isYapi = rawYapi === true || rawYapi === "true" || rawYapi === 1;
        const rawFp = (e as any)?.footprint_base_m2;
        const footprintBaseM2 =
          typeof rawFp === "number" && Number.isFinite(rawFp) && rawFp > 0 ? rawFp : null;

        out.push({
          groupId: meta.id,
          groupTitle: meta.title,
          modelId,
          source,
          filename,
          id,
          remainingUses,
          isAvailable,
          isOwned,
          tepeCredits,
          name,
          thumbnailPath,
          picturePath,
          role,
          isYapi,
          footprintBaseM2,
        });
        processedCount++;
      }
      
      console.log(`[modelCatalog] ${meta.id}: ${processedCount} işlendi, ${skippedCount} atlandı`);
    }

    console.log(`[modelCatalog] ✅ Toplam ${out.length} model işlendi`);
    out.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const flatSample = out.slice(0, 5).map((m) => ({
      id: m.id,
      modelId: m.modelId,
      isOwned: m.isOwned,
      isAvailable: m.isAvailable,
      remainingUses: m.remainingUses,
    }));
    console.log("[modelCatalog] Flat örnek (isOwned/isAvailable/remainingUses):", JSON.stringify(flatSample));
    console.log("[modelCatalog] fetchModelCatalogFlat tamamlandı");
    return out;
  } catch (error: any) {
    console.error("[modelCatalog] ❌ fetchModelCatalogFlat hatası:", error);
    throw error;
  }
}

/**
 * Dosya adını kullanıcıya güzel gösterilecek label'a çevirir:
 * - "_" ve "-" → boşluk
 * - kelime başları büyük
 * - Türkçe karakterlere kaba dönüşüm (ç, ğ, ı, ö, ş, ü)
 *
 * Örn: "Cam_Agaci" → "Çam Ağacı"
 */
export function formatModelDisplayName(input: string): string {
  const raw = stripExtension(basename(String(input || "").trim()));
  if (!raw) return "Model";

  const normalized = raw.replace(/[_-]+/g, " ").trim();
  const parts = normalized.split(/\s+/g).filter(Boolean);

  const toTrLower = (s: string) => {
    try {
      return s.toLocaleLowerCase("tr-TR");
    } catch {
      return s.toLowerCase();
    }
  };
  const toTrUpper = (s: string) => {
    try {
      return s.toLocaleUpperCase("tr-TR");
    } catch {
      return s.toUpperCase();
    }
  };

  const titleCaseWord = (w: string) => {
    const lower = toTrLower(w);
    if (!lower) return lower;
    return toTrUpper(lower[0]) + lower.slice(1);
  };

  return parts.map(titleCaseWord).join(" ");
}

