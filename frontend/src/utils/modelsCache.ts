// react-native-fs kullanıyoruz
import RNFS from "react-native-fs";

// Not: Mobilde "proje klasörü" (bundle/assets) runtime'da yazılamaz (read-only).
// Kalıcı indirme için uygulamanın sandbox alanındaki DocumentDirectoryPath kullanılır.
function getModelsCacheDir(): string | null {
  // react-native-fs kullanıyoruz
  const doc = RNFS.DocumentDirectoryPath || "";
  const cache = RNFS.CachesDirectoryPath || "";
  const base = doc || cache || "";
  if (!base) return null;
  return `${base}/pp_models_cache_v1/`;
}

/** Cache klasörü absolute path (StaticServer vb. için). Trailing slash yok. */
export function getModelsCacheDirPath(): string | null {
  const d = getModelsCacheDir();
  return d ? d.replace(/\/+$/, "") : null;
}

type ModelsManifestEntry = {
  urlHash: string;
  expectedSize?: number; // bytes
  ext?: string;
  updatedAt?: number; // epoch ms
};

function getModelsManifestPath(): string | null {
  const dir = getModelsCacheDir();
  if (!dir) return null;
  return `${dir}pp_models_manifest_v1.json`;
}

/**
 * ASCII-safe, stable, file-system safe model ID sanitization.
 * - Normalizes diacritics (ç → c, ğ → g, etc.)
 * - Converts to lowercase
 * - Replaces non-ASCII/alphanumeric with underscore
 * - Used for consistent model IDs across cache, registry, and instances
 */
export function sanitizeAsciiFileStem(input: string): string {
  // ASCII-only, stable, file-system safe (keep it short-ish)
  const s = String(input || "").trim();
  if (!s) return "";
  const out = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase() // lowercase for consistency
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return out;
}

async function readManifest(): Promise<Record<string, ModelsManifestEntry>> {
  const path = getModelsManifestPath();
  if (!path) return {};
  try {
    const exists = await RNFS.exists(path);
    if (!exists) return {};
  } catch {
    return {};
  }
  try {
    const raw = await RNFS.readFile(path, 'utf8');
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") return parsed as any;
  } catch {
    // ignore
  }
  return {};
}

async function writeManifest(next: Record<string, ModelsManifestEntry>): Promise<void> {
  const path = getModelsManifestPath();
  if (!path) return;
  try {
    await RNFS.writeFile(path, JSON.stringify(next || {}), 'utf8');
  } catch {
    // ignore
  }
}

function stripQueryAndHash(input: string): string {
  const q = input.indexOf("?");
  const h = input.indexOf("#");
  const cut = Math.min(q === -1 ? input.length : q, h === -1 ? input.length : h);
  return input.slice(0, cut);
}

function basename(pathOrUrl: string): string {
  const clean = stripQueryAndHash(pathOrUrl);
  const parts = clean.split("/");
  return parts[parts.length - 1] || "model.glb";
}

function getExtensionFromUrl(url: string): string {
  const name = basename(url);
  const idx = name.lastIndexOf(".");
  if (idx > 0 && idx < name.length - 1) {
    const ext = name.slice(idx);
    // Çok agresif olmadan sadece temel güvenlik: boşluk vb olmasın
    if (/^\.[a-z0-9]+$/i.test(ext)) return ext;
  }
  return ".glb";
}

// Kısa/stabil bir hash (FNV-1a 32-bit)
function hash32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 ile unsigned'a çeviriyoruz
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function ensureCacheDir(): Promise<void> {
  const dir = getModelsCacheDir();
  // Web gibi ortamlarda FileSystem directory'leri null olabilir.
  // Bu durumda cache devre dışı kalır; çağıran taraf remote ile devam edebilir.
  if (!dir) return;
  try {
    const exists = await RNFS.exists(dir);
    if (exists) return;
  } catch (e) {
    // devam edeceğiz; mkdir dene
  }
  try {
    await RNFS.mkdir(dir);
  } catch (e) {
    // Cache dizini oluşturulamıyorsa cache'i devre dışı bırak (remote ile devam edilecek).
    return;
  }
}

function isRemoteHttpUrl(url: string): boolean {
  const u = String(url || "").trim().toLowerCase();
  return u.startsWith("http://") || u.startsWith("https://");
}

function dirname(uri: string): string {
  const s = String(uri || "");
  const idx = s.lastIndexOf("/");
  return idx >= 0 ? s.slice(0, idx + 1) : s;
}

function extname(uri: string): string {
  const base = basename(uri);
  const idx = base.lastIndexOf(".");
  if (idx > 0 && idx < base.length - 1) return base.slice(idx);
  return ".glb";
}

async function sanitizeLocalFileUriIfNeeded(inputUri: string): Promise<string> {
  const uri = String(inputUri || "").trim();
  if (!uri.startsWith("file://")) return uri;

  // Bazı native loader'lar file URI içindeki percent-encoded parçaları decode edip
  // farklı bir path arayabiliyor. Güvenli tarafta kalmak için `%` içeren dosyaları
  // ASCII isimli bir kopyaya taşıyoruz ve onu kullanıyoruz.
  if (!uri.includes("%")) return uri;

  try {
    const path = uri.replace("file://", "");
    const exists = await RNFS.exists(path);
    if (!exists) return uri;
  } catch {
    return uri;
  }

  const dir = dirname(uri);
  const ext = extname(uri);
  const safeUri = `${dir}${hash32(uri)}${ext}`;
  const safePath = safeUri.replace("file://", "");

  try {
    const exists = await RNFS.exists(safePath);
    if (exists) {
      const stat = await RNFS.stat(safePath);
      if (stat && typeof stat.size === "number" && stat.size > 0) {
        return safeUri;
      }
    }
  } catch {
    // ignore
  }

  try {
    const fromPath = uri.replace("file://", "");
    await RNFS.copyFile(fromPath, safePath);
    // Eski dosyayı silmiyoruz (geri dönüş için); istersen sonra cleanup ekleriz.
    if (__DEV__) console.log("[modelsCache] Sanitized local model uri", { from: uri, to: safeUri });
    return safeUri;
  } catch (e) {
    if (__DEV__) {
      console.warn("[modelsCache] sanitizeLocalFileUri failed (using original)", {
        uri,
        err: String((e as any)?.message || e),
      });
    }
    return uri;
  }
}

/**
 * Cache key oluşturma stratejisi:
 * - Öncelik 1: model_id (DB unique ID, number) -> "model_123.glb" formatında
 * - Öncelik 2: modelId (string, dosya adından türetilen) -> legacy support
 * - Fallback: URL hash -> eski sistemler için
 */
function getLocalUriForRemoteUrl(url: string, modelId?: string, modelIdDb?: number): string | null {
  const u = String(url || "").trim();
  if (!u) return null;
  if (!isRemoteHttpUrl(u)) return null;
  const dir = getModelsCacheDir();
  if (!dir) return null;
  // ÖNEMLİ:
  // Remote URL encodeURI ile geldiğinde basename `%C3%87...` gibi percent-encoded içerebilir.
  const ext = getExtensionFromUrl(u);
  
  // ÖNCE model_id (DB unique ID) kullan - bu en stabil ve unique
  let stem: string;
  if (typeof modelIdDb === "number" && modelIdDb > 0) {
    stem = `model_${modelIdDb}`;
    if (__DEV__) {
      console.log("[modelsCache] Cache key için model_id kullanılıyor:", { modelIdDb, stem });
    }
  } else if (modelId) {
    // Fallback: modelId (string, dosya adından türetilen) - legacy support
    stem = sanitizeAsciiFileStem(modelId);
    if (__DEV__) {
      console.log("[modelsCache] Cache key için modelId (string) kullanılıyor:", { modelId, stem });
    }
  } else {
    // Fallback: URL hash - eski sistemler için
    stem = hash32(u);
    if (__DEV__) {
      console.log("[modelsCache] Cache key için URL hash kullanılıyor:", { url: u.substring(0, 60), stem });
    }
  }
  
  const key = `${stem}${ext}`;
  const path = `${dir}${key}`;
  return path.startsWith("/") ? `file://${path}` : path;
}

const GLB_HEADER_FETCH_TIMEOUT_MS = 15000;

/**
 * GLB dosyasının ilk 4 byte'ını kontrol eder (glTF signature).
 * react-native-fs ile binary okuma sınırlı olduğu için fetch kullanıyoruz.
 */
async function validateGlbHeader(uri: string): Promise<{ isValid: boolean; header?: string; error?: string }> {
  try {
    // file:// URI'leri fetch ile okuyamayız, bu yüzden sadece remote URL'ler için kontrol ediyoruz
    // Local dosyalar için size ve exists kontrolü yeterli
    if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
      // Local file için header kontrolü yapmıyoruz (react-native-fs binary okuma sınırlı)
      return { isValid: true };
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), GLB_HEADER_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(uri, {
        method: "GET",
        headers: { Range: "bytes=0-11", "ngrok-skip-browser-warning": "true" }, // İlk 12 byte (glTF header + version)
        signal: ac.signal as any,
      });

      if (!response.ok) {
        return { isValid: false, error: `HTTP ${response.status}` };
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // GLB formatı: ilk 4 byte "glTF" olmalı (ASCII: 0x67 0x6C 0x54 0x46)
      // veya GLB binary format: ilk 4 byte magic number (0x46546C67 = "glTF" little-endian)
      const headerStr = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      const isValid = headerStr === "glTF" || bytes[0] === 0x67 || bytes[0] === 0x46;

      if (__DEV__) {
        console.log("[modelsCache] GLB header validation:", {
          uri: uri.substring(0, 60),
          headerStr,
          firstBytes: Array.from(bytes.slice(0, 4)).map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(" "),
          isValid,
        });
      }

      return { isValid, header: headerStr };
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    const errMsg = String((e as any)?.message || e);
    if (__DEV__) {
      console.warn("[modelsCache] GLB header validation failed:", { uri: uri.substring(0, 60), error: errMsg });
    }
    // Hata durumunda false dönmek yerine "unknown" döndürüyoruz (dosya bozuk olmayabilir, sadece kontrol edemedik)
    return { isValid: true, error: errMsg };
  }
}

/**
 * Dosya bilgilerini detaylı loglar
 */
async function logFileInfo(uri: string, context: string): Promise<void> {
  try {
    const path = uri.replace("file://", "");
    const exists = await RNFS.exists(path);
    let stat: any = null;
    if (exists) {
      stat = await RNFS.stat(path);
    }
    const logData: any = {
      context,
      uri: uri.substring(0, 80),
      exists,
      size: stat && typeof stat.size === "number" ? stat.size : null,
      modificationTime: stat && typeof stat.mtime === "number" ? stat.mtime : null,
    };

    if (typeof logData.modificationTime === "number") {
      logData.modificationTimeReadable = new Date(logData.modificationTime).toISOString();
    }

    // GLB dosyaları genelde KB değil MB seviyesinde olur
    if (typeof logData.size === "number") {
      if (logData.size < 1024) {
        logData.warning = "Dosya çok küçük (<1KB) - şüpheli";
      } else if (logData.size < 100 * 1024) {
        logData.warning = "Dosya küçük (<100KB) - GLB için şüpheli";
      }
    }

    console.log(`[modelsCache] ${context}:`, logData);
  } catch (e) {
    console.warn(`[modelsCache] ${context} - stat failed:`, {
      uri: uri.substring(0, 80),
      error: String((e as any)?.message || e),
    });
  }
}

async function isValidCachedFile(params: { uri: string; expectedSize?: number | null }): Promise<boolean> {
  const uri = String(params.uri || "").trim();
  if (!uri) {
    if (__DEV__) {
      console.warn("[modelsCache] isValidCachedFile: URI boş");
    }
    return false;
  }
  try {
    await logFileInfo(uri, "Cache doğrulama");
    const path = uri.replace("file://", "");
    const exists = await RNFS.exists(path);
    
    if (!exists) {
      if (__DEV__) {
        console.warn("[modelsCache] Cache dosya mevcut değil:", {
          uri: uri.substring(0, 80),
          exists: false,
        });
      }
      return false;
    }

    const stat = await RNFS.stat(path);
    const size = stat && typeof stat.size === "number" ? stat.size : 0;

    if (size <= 0) {
      console.warn("[modelsCache] Cache dosya boş (size <= 0):", {
        uri: uri.substring(0, 80),
        size,
      });
      return false;
    }

    const expected = typeof params.expectedSize === "number" && params.expectedSize > 0 ? params.expectedSize : null;
    // En sık sorun: app kapanır, download yarım kalır ama size>0 olur → "var" sanılır.
    // expectedSize biliyorsak eşleşmeyeni invalid say.
    if (expected !== null && size !== expected) {
      console.warn("[modelsCache] Cache dosya boyutu beklenenden farklı (yarım indirme olabilir):", {
        uri: uri.substring(0, 80),
        expected,
        got: size,
        diff: size - expected,
      });
      return false;
    }

    console.log("[modelsCache] Cache dosya geçerli:", {
      uri: uri.substring(0, 80),
      size,
      expectedSize: expected || "unknown",
    });
    return true;
  } catch (e) {
    const errMsg = String((e as any)?.message || e);
    console.warn("[modelsCache] Cache doğrulama hatası:", {
      uri: uri.substring(0, 80),
      error: errMsg,
    });
    return false;
  }
}

/**
 * Remote model URL'ini telefona indirip cache'ten local `file://` URI döndürür.
 * - Dosya daha önce indiyse tekrar indirmez.
 * - Remote erişim için ngrok header'ı ekler (ngrok uyarı sayfası bypass).
 * 
 * Cache stratejisi:
 * - model_id (DB unique ID) varsa: "model_123.glb" formatında cache'e kaydeder
 * - modelId (string) varsa: legacy support için kullanılır
 * - Cache'te varsa tekrar indirmez
 */
export async function ensureCachedModelUri(params: {
  url: string;
  modelId?: string; // Legacy: string modelId (dosya adından türetilen)
  modelIdDb?: number; // Yeni: DB model_id (unique ID)
  onProgress?: (p: { written: number; total: number; percent: number | null }) => void;
  timeoutMs?: number;
}): Promise<string> {
  const url = String(params?.url || "").trim();
  if (!url) throw new Error("Model URL boş");
  if (!isRemoteHttpUrl(url)) {
    // zaten local/asset olabilir; legacy file:// uri'leri sanitize et
    return await sanitizeLocalFileUriIfNeeded(url);
  }

  // FileSystem cache desteklemiyorsa remote ile devam et
  const cacheDir = getModelsCacheDir();
  if (!cacheDir) {
    console.warn("[modelsCache] Cache dir yok, remote kullanılacak", {
      modelId: params?.modelId,
      documentDirectory: RNFS.DocumentDirectoryPath,
      cacheDirectory: RNFS.CachesDirectoryPath,
      hasDownloadFile: typeof RNFS.downloadFile === "function",
    });
    try {
      params?.onProgress?.({ written: 0, total: 0, percent: null });
    } catch {
      // ignore
    }
    return url;
  }

  await ensureCacheDir();

  const localUri = getLocalUriForRemoteUrl(url, params?.modelId, params?.modelIdDb);
  if (!localUri) {
    // Cache path üretilemiyorsa remote ile devam et
    return url;
  }

  const urlHash = hash32(url);
  // Manifest key: Önce model_id (DB unique ID), sonra modelId (string), sonra basename
  let manifestKey: string;
  if (typeof params?.modelIdDb === "number" && params.modelIdDb > 0) {
    manifestKey = `model_${params.modelIdDb}`;
  } else if (params?.modelId) {
    manifestKey = sanitizeAsciiFileStem(params.modelId);
  } else {
    manifestKey = basename(localUri);
  }

  // Varsa direkt kullan (ama "yarım download" durumunu yakala)
  console.log("[modelsCache] 🔍 Cache kontrolü yapılıyor...", {
    modelId: params?.modelId,
    modelIdDb: params?.modelIdDb,
    manifestKey,
    localUri: localUri.substring(0, 80),
    urlHash,
    cacheStrategy: typeof params?.modelIdDb === "number" ? "model_id (DB unique ID)" : params?.modelId ? "modelId (string)" : "URL hash",
  });

  const manifest = await readManifest();
  const expectedSize = manifest?.[manifestKey]?.expectedSize ?? null;
  const manifestUrlHash = manifest?.[manifestKey]?.urlHash;

  console.log("[modelsCache] Manifest bilgisi:", {
    manifestKey,
    hasManifestEntry: Boolean(manifest?.[manifestKey]),
    expectedSize: expectedSize || "unknown",
    manifestUrlHash: manifestUrlHash || "unknown",
    urlHashMatches: manifestUrlHash === urlHash,
  });

  const hasValidCached = await isValidCachedFile({ uri: localUri, expectedSize });
  
  if (hasValidCached && manifestUrlHash === urlHash) {
    console.log("[modelsCache] ✅ Cache'de geçerli dosya bulundu, tekrar indirme gerekmiyor:", {
      modelId: params?.modelId,
      localUri: localUri.substring(0, 80),
      size: expectedSize || "unknown",
    });
    return localUri;
  }

  if (hasValidCached && manifestUrlHash !== urlHash) {
    console.log("[modelsCache] Cache'de dosya var ama URL hash farklı (yeniden indirilecek):", {
      modelId: params?.modelId,
      oldHash: manifestUrlHash,
      newHash: urlHash,
    });
  } else if (!hasValidCached) {
    console.log("[modelsCache] ⚠️ Cache'de geçerli dosya yok (indirilecek):", {
      modelId: params?.modelId,
      localUri: localUri.substring(0, 80),
    });
  }
  // URL değiştiyse veya dosya invalid ise: temizle
  try {
    const localPath = localUri.replace("file://", "");
    const exists = await RNFS.exists(localPath);
    if (exists) {
      await RNFS.unlink(localPath);
    }
  } catch {
    // ignore
  }

  // Bağlantı ön kontrolü (opsiyonel):
  // - Bazı ortamlarda (özellikle ngrok/https) ilk bağlantı 60sn'ye kadar sürebilir (HeadersTimeout önlemi).
  // - Bu yüzden burada hata fırlatmak yerine sadece uyarı loglayıp indirmeyi yine de deniyoruz.
  const PREFLIGHT_TIMEOUT_MS = 60000;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
    try {
      const preflightHeaders: Record<string, string> = {
        "ngrok-skip-browser-warning": "true",
        Range: "bytes=0-0",
      };
      const res = await fetch(url, { method: "GET", headers: preflightHeaders, signal: controller.signal as any });
      if (!(res.status >= 200 && res.status < 400)) {
        const status = res.status;
        const urlPreview = url.substring(0, 100);
        if (status === 404) {
          console.warn("[modelsCache] ⚠️ Preflight 404 - Model dosyası bulunamadı (URL kontrol edilmeli):", { 
            status, 
            url: urlPreview,
            tip: "URL'de çift '/static/' olabilir veya dosya yolu yanlış olabilir"
          });
        } else {
          console.warn("[modelsCache] Preflight HTTP not OK (will still try download)", { status, url: urlPreview });
        }
      }
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    console.warn("[modelsCache] Preflight failed (will still try download)", {
      url,
      err: String((e as any)?.message || e),
    });
  }

  // Yoksa indir (progress destekli). Büyük GLB'ler için 5 dk timeout, yavaş ağlarda retry.
  const DEFAULT_DOWNLOAD_TIMEOUT_MS = 300000; // 5 dakika (MB boyutlu modeller için)
  const MAX_DOWNLOAD_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  const timeoutMs = typeof params?.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_DOWNLOAD_TIMEOUT_MS;

  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  let lastPercent = -1;
  const tmpUri = `${localUri}.tmp`;
  const tmpPath = tmpUri.replace("file://", "");

  function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  let lastTotalBytesExpected: number | null = null;
  let uri = tmpUri;
  // RNFS.downloadFile() { jobId, promise } döndürür; stop için stopDownload(jobId) kullanılır.
  let downloadJob: { jobId: number; promise: Promise<any> } | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt++) {
    lastTotalBytesExpected = null;
    lastPercent = -1;
    // Önceki yarım tmp kalmışsa temizle
    try {
      const exists = await RNFS.exists(tmpPath);
      if (exists) await RNFS.unlink(tmpPath);
    } catch {
      /* ignore */
    }

    try {
      if (attempt > 1) {
        console.warn("[modelsCache] İndirme yeniden deneniyor...", {
          attempt,
          maxRetries: MAX_DOWNLOAD_RETRIES,
          modelId: params?.modelId,
          lastError: String(lastError?.message || lastError),
        });
      }

      downloadJob = RNFS.downloadFile({
        fromUrl: url,
        toFile: tmpPath,
        headers,
        progress: (res: any) => {
          const written = res?.bytesWritten ?? 0;
          const total = res?.contentLength ?? 0;
          if (typeof total === "number" && total > 0) lastTotalBytesExpected = total;
          const percent = total > 0 ? Math.floor((written / total) * 100) : null;
          if (percent !== null && percent === lastPercent) return;
          if (percent !== null) lastPercent = percent;
          try {
            params?.onProgress?.({ written, total, percent });
          } catch {
            /* ignore */
          }
        },
      });

      const downloadPromise = downloadJob!.promise;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`İndirme zaman aşımına uğradı (${timeoutMs}ms). URL: ${url}`)),
          timeoutMs
        );
      });

      const res: any = await Promise.race([downloadPromise, timeoutPromise]);

      const statusCode = res?.statusCode;
      const tmpExists = await RNFS.exists(tmpPath);
      let tmpSize = 0;
      if (tmpExists) {
        try {
          const st = await RNFS.stat(tmpPath);
          tmpSize = st && typeof st.size === "number" ? st.size : 0;
        } catch {
          tmpSize = 0;
        }
      }

      // Android RNFS bazen statusCode döndürmez; dosya var ve boyutu >0 ise kabul et.
      if (statusCode && statusCode >= 400) {
        throw new Error(`İndirme başarısız: HTTP ${statusCode} - ${url.substring(0, 60)}`);
      }
      if (!tmpExists || tmpSize <= 0) {
        const errorMsg = statusCode
          ? `İndirme başarısız: HTTP ${statusCode}, dosya yok/boş - ${url.substring(0, 60)}`
          : `İndirme başarısız: dosya oluşmadı - ${url.substring(0, 60)}`;
        throw new Error(errorMsg);
      }
      
      uri = tmpUri;
      break; // başarılı, döngüden çık
    } catch (e) {
      lastError = e as Error;
      try {
        if (downloadJob && typeof (RNFS as any).stopDownload === "function") {
          (RNFS as any).stopDownload(downloadJob.jobId);
        }
      } catch {
        /* ignore */
      }
      try {
        const exists = await RNFS.exists(tmpPath);
        if (exists) await RNFS.unlink(tmpPath);
      } catch {
        /* ignore */
      }
      if (attempt < MAX_DOWNLOAD_RETRIES) {
        await delay(RETRY_DELAY_MS);
      } else {
        throw lastError;
      }
    }
  }

  // DETAYLI KONTROL 1: İndirme sonrası tmp dosya doğrulama
  console.log("[modelsCache] ⚠️ İndirme tamamlandı, tmp dosya doğrulanıyor...", {
    modelId: params?.modelId,
    url: url.substring(0, 100),
    tmpUri: uri.substring(0, 100),
  });

  try {
    await logFileInfo(uri, "İndirme sonrası tmp dosya");
    const path = uri.replace("file://", "");
    const exists = await RNFS.exists(path);
    
    if (!exists) {
      throw new Error("İndirilen tmp dosya mevcut değil (exists=false)");
    }

    const stat = await RNFS.stat(path);
    const size = stat && typeof stat.size === "number" ? stat.size : 0;
    if (size <= 0) {
      throw new Error(`İndirilen model dosyası boş görünüyor (size=${size})`);
    }

    // GLB dosyaları genelde KB değil MB seviyesinde olur
    if (size < 1024) {
      console.warn("[modelsCache] Tmp dosya çok küçük (<1KB) - şüpheli!", {
        size,
        uri: uri.substring(0, 80),
        modelId: params?.modelId,
      });
    } else if (size < 100 * 1024) {
      console.warn("[modelsCache] Tmp dosya küçük (<100KB) - GLB için şüpheli!", {
        size,
        uri: uri.substring(0, 80),
        modelId: params?.modelId,
      });
    }

    // expected size biliyorsak eşleşsin (yarım dosyayı yakalar)
    if (typeof lastTotalBytesExpected === "number" && lastTotalBytesExpected > 0) {
      if (size !== lastTotalBytesExpected) {
        throw new Error(
          `İndirilen dosya boyutu beklenenden farklı (expected=${lastTotalBytesExpected}, got=${size}, diff=${size - lastTotalBytesExpected})`
        );
      }
      console.log("[modelsCache] ✅ Tmp dosya boyutu beklenenle eşleşiyor", {
        size,
        expected: lastTotalBytesExpected,
      });
    }

    // GLB header kontrolü (remote URL için)
    if (isRemoteHttpUrl(url)) {
      const headerCheck = await validateGlbHeader(url);
      if (!headerCheck.isValid && !headerCheck.error) {
        console.warn("[modelsCache] ⚠️ GLB header kontrolü başarısız (ama devam ediyoruz)", {
          url: url.substring(0, 60),
          header: headerCheck.header,
        });
      }
    }
  } catch (e) {
    const errMsg = String((e as any)?.message || e);
    console.error("[modelsCache] Tmp dosya doğrulama hatası:", {
      uri: uri.substring(0, 80),
      modelId: params?.modelId,
      error: errMsg,
    });
    // Yarım dosyayı temizle
    try {
      const path = uri.replace("file://", "");
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
      }
    } catch {
      // ignore
    }
    throw new Error(`Model indirildi ama doğrulanamadı: ${errMsg}`);
  }

  console.log("[modelsCache] ✅ Tmp dosya doğrulama başarılı, atomic write yapılıyor...");

  // DETAYLI KONTROL 2: Atomik geçiş (tmp -> final)
  console.log("[modelsCache] Atomic write başlıyor (tmp -> final)...", {
    from: uri.substring(0, 80),
    to: localUri.substring(0, 80),
    modelId: params?.modelId,
  });

  // Eski final dosyayı sil (varsa)
  try {
    const localPath = localUri.replace("file://", "");
    const exists = await RNFS.exists(localPath);
    if (exists) {
      const stat = await RNFS.stat(localPath);
      console.log("[modelsCache] Eski final dosya siliniyor...", {
        uri: localUri.substring(0, 80),
        oldSize: stat && typeof stat.size === "number" ? stat.size : null,
      });
      await RNFS.unlink(localPath);
    }
  } catch (e) {
    console.warn("[modelsCache] Eski final dosya silinirken hata (devam ediyoruz):", {
      uri: localUri.substring(0, 80),
      error: String((e as any)?.message || e),
    });
  }

  // Atomic move: tmp -> final
  try {
    const fromPath = uri.replace("file://", "");
    const toPath = localUri.replace("file://", "");
    await RNFS.moveFile(fromPath, toPath);
    console.log("[modelsCache] ✅ Atomic move başarılı");
  } catch (e) {
    const errMsg = String((e as any)?.message || e);
    console.error("[modelsCache] Atomic move başarısız:", {
      from: uri.substring(0, 80),
      to: localUri.substring(0, 80),
      error: errMsg,
    });
    // move başarısızsa tmp'yi olduğu gibi kullan (en azından çalışsın)
    if (__DEV__) {
      console.warn("[modelsCache] move tmp->final failed (using tmp)", {
        from: uri,
        to: localUri,
        err: errMsg,
      });
    }
    return uri;
  }

  // DETAYLI KONTROL 3: Final dosya doğrulama (atomic write sonrası)
  console.log("[modelsCache] ⚠️ Atomic write sonrası final dosya doğrulanıyor...", {
    modelId: params?.modelId,
    finalUri: localUri.substring(0, 80),
  });

  try {
    await logFileInfo(localUri, "Atomic write sonrası final dosya");
    const localPath = localUri.replace("file://", "");
    const exists = await RNFS.exists(localPath);

    if (!exists) {
      throw new Error("Final dosya atomic write sonrası mevcut değil (exists=false)");
    }

    const finalStat = await RNFS.stat(localPath);
    const finalSize = finalStat && typeof finalStat.size === "number" ? finalStat.size : 0;
    if (finalSize <= 0) {
      throw new Error(`Final dosya boş görünüyor (size=${finalSize})`);
    }

    // Tmp dosya boyutu ile karşılaştır (artık tmp dosya yok, move edildi)
    // Bu kontrolü atlayabiliriz çünkü move işlemi başarılı oldu

    // Expected size kontrolü
    if (typeof lastTotalBytesExpected === "number" && lastTotalBytesExpected > 0) {
      if (finalSize !== lastTotalBytesExpected) {
        console.warn("[modelsCache] ⚠️ Final dosya boyutu beklenenden farklı!", {
          expected: lastTotalBytesExpected,
          got: finalSize,
          diff: finalSize - lastTotalBytesExpected,
        });
      } else {
        console.log("[modelsCache] ✅ Final dosya boyutu beklenenle eşleşiyor", {
          size: finalSize,
        });
      }
    }

    // GLB dosya boyutu uyarısı
    if (finalSize < 1024) {
      console.warn("[modelsCache] ⚠️ Final dosya çok küçük (<1KB) - şüpheli!", {
        size: finalSize,
        uri: localUri.substring(0, 80),
        modelId: params?.modelId,
      });
    } else if (finalSize < 100 * 1024) {
      console.warn("[modelsCache] ⚠️ Final dosya küçük (<100KB) - GLB için şüpheli!", {
        size: finalSize,
        uri: localUri.substring(0, 80),
        modelId: params?.modelId,
      });
    }

    console.log("[modelsCache] ✅ Final dosya doğrulama başarılı", {
      uri: localUri.substring(0, 80),
      size: finalSize,
      modelId: params?.modelId,
    });
  } catch (e) {
    const errMsg = String((e as any)?.message || e);
    console.error("[modelsCache] ❌ Final dosya doğrulama hatası:", {
      uri: localUri.substring(0, 80),
      modelId: params?.modelId,
      error: errMsg,
    });
    // Hata olsa bile dosyayı kullanmaya devam et (belki sadece log hatasıdır)
  }

  // Manifest güncelle (URL değiştiyse tekrar indirme tetiklesin, yarım dosyayı yakalasın)
  try {
    const localPath = localUri.replace("file://", "");
    const finalStat = await RNFS.stat(localPath);
    const next = { ...(manifest || {}) };
    next[manifestKey] = {
      urlHash,
      expectedSize: finalStat && typeof finalStat.size === "number" ? finalStat.size : undefined,
      ext: getExtensionFromUrl(url),
      updatedAt: Date.now(),
    };
    await writeManifest(next);
    console.log("[modelsCache] ✅ Manifest güncellendi", {
      modelId: params?.modelId,
      manifestKey,
      expectedSize: next[manifestKey].expectedSize,
    });
  } catch (e) {
    console.warn("[modelsCache] Manifest güncelleme hatası (devam ediyoruz):", {
      error: String((e as any)?.message || e),
    });
  }

  console.log("[modelsCache] Model cache işlemi tamamlandı", {
    modelId: params?.modelId,
    finalUri: localUri.substring(0, 80),
    url: url.substring(0, 60),
  });

  return localUri;
}

export async function isCachedModelUri(uri: string): Promise<boolean> {
  const u = String(uri || "").trim();
  if (!u.startsWith("file://")) return false;
  try {
    const path = u.replace("file://", "");
    const exists = await RNFS.exists(path);
    return exists;
  } catch {
    return false;
  }
}

/**
 * Cache'te model var mı kontrol eder.
 * Önce model_id (DB unique ID) ile, yoksa modelId (string) ile arar.
 */
export async function getCachedModelUriIfExists(
  remoteUrl: string, 
  modelId?: string, 
  modelIdDb?: number
): Promise<string | null> {
  // Önce model_id (DB unique ID) ile dene
  if (typeof modelIdDb === "number" && modelIdDb > 0) {
    const localUri = getLocalUriForRemoteUrl(remoteUrl, undefined, modelIdDb);
    if (localUri) {
      try {
        const urlHash = hash32(remoteUrl);
        const manifestKey = `model_${modelIdDb}`;
        const manifest = await readManifest();
        const expectedSize = manifest?.[manifestKey]?.expectedSize ?? null;
        const ok = await isValidCachedFile({ uri: localUri, expectedSize });
        if (ok && manifest?.[manifestKey]?.urlHash === urlHash) {
          if (__DEV__) {
            console.log("[modelsCache] ✅ Cache'te model_id ile bulundu:", { modelIdDb, manifestKey, localUri: localUri.substring(0, 80) });
          }
          return localUri;
        }
      } catch {
        // ignore
      }
    }
  }
  
  // Fallback: modelId (string) ile dene - legacy support
  if (modelId) {
    const localUri = getLocalUriForRemoteUrl(remoteUrl, modelId);
    if (localUri) {
      try {
        const urlHash = hash32(remoteUrl);
        const manifestKey = sanitizeAsciiFileStem(modelId) || basename(localUri);
        const manifest = await readManifest();
        const expectedSize = manifest?.[manifestKey]?.expectedSize ?? null;
        const ok = await isValidCachedFile({ uri: localUri, expectedSize });
        if (ok && manifest?.[manifestKey]?.urlHash === urlHash) {
          if (__DEV__) {
            console.log("[modelsCache] ✅ Cache'te modelId (string) ile bulundu:", { modelId, manifestKey, localUri: localUri.substring(0, 80) });
          }
          return localUri;
        }
      } catch {
        // ignore
      }
    }
  }
  
  return null;
}

export async function deleteCachedModelForRemoteUrl(
  remoteUrl: string, 
  modelId?: string, 
  modelIdDb?: number
): Promise<boolean> {
  // Önce model_id (DB unique ID) ile dene
  if (typeof modelIdDb === "number" && modelIdDb > 0) {
    const localUri = getLocalUriForRemoteUrl(remoteUrl, undefined, modelIdDb);
    if (localUri) {
      try {
        const localPath = localUri.replace("file://", "");
        const exists = await RNFS.exists(localPath);
        if (exists) {
          await RNFS.unlink(localPath);
        }
        // manifest cleanup best-effort
        try {
          const manifestKey = `model_${modelIdDb}`;
          const manifest = await readManifest();
          if (manifest && manifest[manifestKey]) {
            const next = { ...(manifest || {}) };
            delete next[manifestKey];
            await writeManifest(next);
          }
        } catch {
          // ignore
        }
        return true;
      } catch {
        // ignore
      }
    }
  }
  
  // Fallback: modelId (string) ile dene
  const localUri = getLocalUriForRemoteUrl(remoteUrl, modelId);
  if (!localUri) return false;
  try {
    const localPath = localUri.replace("file://", "");
    const exists = await RNFS.exists(localPath);
    if (exists) {
      await RNFS.unlink(localPath);
    }
    // manifest cleanup best-effort
    try {
      const manifestKey = sanitizeAsciiFileStem(modelId || "") || basename(localUri);
      const manifest = await readManifest();
      if (manifest && manifest[manifestKey]) {
        const next = { ...(manifest || {}) };
        delete next[manifestKey];
        await writeManifest(next);
      }
    } catch {
      // ignore
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Telefonda cache'te yüklü modelleri listeler (API çağrısı yok).
 * Test sayfası gibi "sadece local modeller" kullanacak yerler için.
 */
export async function listCachedModels(): Promise<{ modelId: string; localUri: string }[]> {
  const dir = getModelsCacheDir();
  if (!dir) return [];
  const manifest = await readManifest();
  const out: { modelId: string; localUri: string }[] = [];
  for (const [key, entry] of Object.entries(manifest)) {
    const ext = (entry?.ext && /^\.[a-z0-9]+$/i.test(entry.ext)) ? entry.ext : ".glb";
    const path = `${dir}${key}${ext}`;
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        const localUri = path.startsWith("/") ? `file://${path}` : path;
        out.push({ modelId: key, localUri });
      }
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Tüm model cache'ini temizler (dosyalar + manifest).
 * ID sorunları veya çakışmaları gidermek için kullanılabilir.
 */
export async function clearAllCachedModels(): Promise<{ success: boolean; deletedFiles: number; errors: string[] }> {
  const dir = getModelsCacheDir();
  const manifestPath = getModelsManifestPath();
  const errors: string[] = [];
  let deletedFiles = 0;

  if (!dir) {
    return { success: false, deletedFiles: 0, errors: ["Cache directory not available"] };
  }

  try {
    // 1. Manifest'ten tüm dosyaları sil
    const manifest = await readManifest();
    for (const [key, entry] of Object.entries(manifest)) {
      try {
        const ext = (entry?.ext && /^\.[a-z0-9]+$/i.test(entry.ext)) ? entry.ext : ".glb";
        const path = `${dir}${key}${ext}`;
        const exists = await RNFS.exists(path);
        if (exists) {
          await RNFS.unlink(path);
          deletedFiles++;
          if (__DEV__) {
            console.log(`[modelsCache] ✅ Cache dosya silindi: ${key}${ext}`);
          }
        }
        // .tmp dosyaları da temizle (varsa)
        const tmpPath = `${path}.tmp`;
        const tmpExists = await RNFS.exists(tmpPath);
        if (tmpExists) {
          await RNFS.unlink(tmpPath);
          deletedFiles++;
        }
      } catch (e) {
        const errMsg = String((e as any)?.message || e);
        errors.push(`Failed to delete ${key}: ${errMsg}`);
        if (__DEV__) {
          console.warn(`[modelsCache] ⚠️ Cache dosya silinemedi: ${key}`, errMsg);
        }
      }
    }

    // 2. Manifest dosyasını sil
    if (manifestPath) {
      try {
        const manifestExists = await RNFS.exists(manifestPath);
        if (manifestExists) {
          await RNFS.unlink(manifestPath);
          if (__DEV__) {
            console.log("[modelsCache] ✅ Manifest dosyası silindi");
          }
        }
      } catch (e) {
        const errMsg = String((e as any)?.message || e);
        errors.push(`Failed to delete manifest: ${errMsg}`);
        if (__DEV__) {
          console.warn("[modelsCache] ⚠️ Manifest silinemedi:", errMsg);
        }
      }
    }

    // 3. Cache klasöründeki diğer dosyaları da temizle (manifest'te olmayan dosyalar)
    try {
      const files = await RNFS.readdir(dir);
      for (const file of files) {
        // Manifest dosyasını atla (zaten silindi)
        if (file === "pp_models_manifest_v1.json") continue;
        
        try {
          const filePath = `${dir}${file}`;
          const stat = await RNFS.stat(filePath);
          // Sadece dosyaları sil (klasörleri değil)
          if (stat && stat.isFile && stat.isFile()) {
            await RNFS.unlink(filePath);
            deletedFiles++;
            if (__DEV__) {
              console.log(`[modelsCache] ✅ Ekstra cache dosya silindi: ${file}`);
            }
          }
        } catch (e) {
          const errMsg = String((e as any)?.message || e);
          errors.push(`Failed to delete extra file ${file}: ${errMsg}`);
        }
      }
    } catch (e) {
      // readdir başarısız olabilir (klasör yok vs.), bu normal
      if (__DEV__) {
        console.warn("[modelsCache] readdir failed (cache dir may be empty):", String((e as any)?.message || e));
      }
    }

    const success = errors.length === 0;
    if (__DEV__) {
      console.log(`[modelsCache] ${success ? "✅" : "⚠️"} Cache temizleme tamamlandı:`, {
        deletedFiles,
        errors: errors.length,
        success,
      });
    }

    return { success, deletedFiles, errors };
  } catch (e) {
    const errMsg = String((e as any)?.message || e);
    errors.push(`Clear cache failed: ${errMsg}`);
    if (__DEV__) {
      console.error("[modelsCache] ❌ Cache temizleme hatası:", errMsg);
    }
    return { success: false, deletedFiles, errors };
  }
}

