/**
 * 3D editörde eklenen modellerin toplam boyut limiti (500 KB)
 */
export const MAX_TOTAL_MODEL_SIZE_BYTES = 500 * 1024;

/** Boyut alınamadığında varsayılan (100 KB) - güvenli tarafta kalmak için */
const DEFAULT_UNKNOWN_SIZE_BYTES = 100 * 1024;

const sizeCache: Record<string, number | null> = {};

/**
 * Model URL'sine HEAD isteği atarak Content-Length değerini alır.
 * Hata durumunda null döner (caller varsayılan kullanabilir).
 */
export async function fetchModelSize(url: string): Promise<number | null> {
  if (!url || typeof url !== "string") return null;
  const key = url;
  if (key in sizeCache) return sizeCache[key];

  try {
    const res = await fetch(url, { method: "HEAD" });
    const contentLength = res.headers.get("Content-Length");
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (Number.isFinite(bytes) && bytes >= 0) {
        sizeCache[key] = bytes;
        return bytes;
      }
    }
    sizeCache[key] = null;
    return null;
  } catch {
    sizeCache[key] = null;
    return null;
  }
}

export type ModelInstanceLike = { modelId: string };
export type ModelCatalogItemLike = { id?: number; modelId: string; source: string };

/**
 * Mevcut instance'ların ve eklenmek istenen modelin toplam boyutunu kontrol eder.
 * @returns allowed: true ise ekleme yapılabilir; false ise limit aşılmış
 */
export async function checkTotalModelSize(
  instances: ModelInstanceLike[],
  modelCatalogFlat: ModelCatalogItemLike[],
  newModelId: string,
  getModelSource: (modelId: string) => string | undefined
): Promise<{ allowed: boolean; totalBytes: number; newModelBytes: number; limitBytes: number; message?: string }> {
  const limitBytes = MAX_TOTAL_MODEL_SIZE_BYTES;

  // Benzersiz model ID'leri (her model tipi sadece bir kez sayılır - aynı model birden fazla instance'ta kullanılabilir)
  const uniqueModelIds = new Set<string>(instances.map((i) => i.modelId));
  uniqueModelIds.add(newModelId);

  let totalBytes = 0;
  const sizes: { modelId: string; bytes: number }[] = [];

  for (const modelId of uniqueModelIds) {
    const source = getModelSource(modelId);
    if (!source) continue;
    const bytes = await fetchModelSize(source);
    const effectiveBytes = bytes != null && bytes > 0 ? bytes : DEFAULT_UNKNOWN_SIZE_BYTES;
    totalBytes += effectiveBytes;
    sizes.push({ modelId, bytes: effectiveBytes });
  }

  const newModelSource = getModelSource(newModelId);
  let newModelBytes = 0;
  if (newModelSource) {
    const b = await fetchModelSize(newModelSource);
    newModelBytes = b != null && b > 0 ? b : DEFAULT_UNKNOWN_SIZE_BYTES;
  }

  const allowed = totalBytes <= limitBytes;
  let message: string | undefined;
  if (!allowed) {
    const totalKb = Math.round(totalBytes / 1024);
    const limitKb = Math.round(limitBytes / 1024);
    message = `Modellerin toplam boyutu ${totalKb} KB. Maksimum ${limitKb} KB olabilir. Lütfen bazı modelleri kaldırın.`;
  }

  return { allowed, totalBytes, newModelBytes, limitBytes, message };
}

/**
 * Eklenen modellerin toplam boyutunu hesaplar (gösterim için).
 * @param additionalModelId Yerleştirme modunda eklenecek model (opsiyonel)
 */
export async function getTotalModelSizeForDisplay(
  instances: ModelInstanceLike[],
  modelCatalogFlat: ModelCatalogItemLike[],
  getModelSource: (modelId: string) => string | undefined,
  additionalModelId?: string | null
): Promise<{ totalBytes: number; limitBytes: number }> {
  const uniqueModelIds = new Set<string>(instances.map((i) => i.modelId));
  if (additionalModelId) uniqueModelIds.add(additionalModelId);

  let totalBytes = 0;
  for (const modelId of uniqueModelIds) {
    const source = getModelSource(modelId);
    if (!source) continue;
    const bytes = await fetchModelSize(source);
    const effectiveBytes = bytes != null && bytes > 0 ? bytes : DEFAULT_UNKNOWN_SIZE_BYTES;
    totalBytes += effectiveBytes;
  }

  return { totalBytes, limitBytes: MAX_TOTAL_MODEL_SIZE_BYTES };
}
