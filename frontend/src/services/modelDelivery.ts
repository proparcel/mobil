import { NativeModules, Platform } from "react-native";
import { ensureCachedModelUri } from "@/src/utils/modelsCache";

type PackState = {
  known: boolean;
  packName: string;
  status?: number;
  statusName?: string;
  errorCode?: number;
  bytesDownloaded?: number;
  totalBytesToDownload?: number;
  percent?: number;
};

export type EnsureAvailableResult = {
  ok: boolean;
  packName: string;
  /**
   * Mapbox.Models ile uyumlu URI — daima `https://pp-local/...`.
   * Not: Native `file://` buraya verilmez; @rnmapbox/maps Android'de RNMBXModels.kt URI'yi
   * yeniden kurarken `file` şemasını bozup mesh yüklemesini sessizce düşürebiliyor (pick çalışır, model görünmez).
   */
  mapUri: string;
  /** Sabit pp-local URL (log / HEAD boyut kontrolü için) */
  fileUrl: string;
  lastState?: PackState;
};

const ANDROID_MODULE = (NativeModules as any)?.ModelPacksModule;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ppLocalModelUrl(modelId: number): string {
  return `https://pp-local/models/model_${modelId}.glb`;
}

function mapboxRegistryUri(modelId: number): string {
  return ppLocalModelUrl(modelId);
}

export type EnsureModelAvailableOptions = {
  timeoutMs?: number;
  onProgress?: (s: PackState) => void;
  /** iOS: katalog `source` (HTTPS static GLB). Android'de yok sayılır. */
  remoteUrl?: string;
};

async function ensureModelAvailableIos(
  modelId: number,
  packName: string,
  remoteUrl: string,
  opts?: EnsureModelAvailableOptions
): Promise<EnsureAvailableResult> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  try {
    const mapUri = await ensureCachedModelUri({
      url: remoteUrl,
      modelIdDb: modelId,
      timeoutMs,
      onProgress: (p) => {
        opts?.onProgress?.({
          known: true,
          packName,
          percent: p.percent ?? undefined,
          bytesDownloaded: p.written,
          totalBytesToDownload: p.total > 0 ? p.total : undefined,
          statusName: p.percent != null ? "DOWNLOADING" : "FETCHING",
        });
      },
    });
    if (__DEV__) {
      console.log(`[ModelDelivery] model_${modelId}: iOS hazır mapUri=${mapUri.substring(0, 80)}`);
    }
    return { ok: true, packName, mapUri, fileUrl: remoteUrl };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    if (__DEV__) console.warn(`[ModelDelivery] model_${modelId}: iOS indirme hatası:`, msg);
    return {
      ok: false,
      packName,
      mapUri: remoteUrl,
      fileUrl: remoteUrl,
      lastState: { known: true, packName, statusName: "FAILED" },
    };
  }
}

export async function ensureModelAvailable(
  modelId: number,
  opts?: EnsureModelAvailableOptions
): Promise<EnsureAvailableResult> {
  const packName = `pp_model_${modelId}`;
  const fileUrl = ppLocalModelUrl(modelId);

  if (Platform.OS === "ios") {
    const remoteUrl = String(opts?.remoteUrl || "").trim();
    if (__DEV__) {
      console.log(`[ModelDelivery] model_${modelId}: iOS remote=${remoteUrl ? remoteUrl.substring(0, 80) : "(yok)"}`);
    }
    if (!remoteUrl) {
      if (__DEV__) console.warn(`[ModelDelivery] model_${modelId}: iOS için remoteUrl gerekli`);
      return { ok: false, packName, mapUri: fileUrl, fileUrl, lastState: { known: false, packName } };
    }
    return ensureModelAvailableIos(modelId, packName, remoteUrl, opts);
  }

  if (__DEV__) {
    console.log(`[ModelDelivery] model_${modelId}: başlatılıyor pack=${packName} url=${fileUrl}`);
  }

  if (!ANDROID_MODULE) {
    if (__DEV__) console.warn(`[ModelDelivery] model_${modelId}: ModelPacksModule yok (native), available=false`);
    return { ok: false, packName, mapUri: fileUrl, fileUrl, lastState: { known: false, packName } };
  }

  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;

  // Quick success path: already available (gömülü pack veya debug assets)
  try {
    const p = await ANDROID_MODULE.getModelFilePath(modelId);
    if (p?.available) {
      const mapUri = mapboxRegistryUri(modelId);
      if (__DEV__) {
        const onDisk = p?.filePath ? "evet" : "hayır";
        console.log(`[ModelDelivery] model_${modelId}: VAR – pack/asset hazır (disk=${onDisk}), registry URI=pp-local`);
      }
      return { ok: true, packName, mapUri, fileUrl };
    }
    if (__DEV__) console.log(`[ModelDelivery] model_${modelId}: YOK – pack/assets'ta dosya yok, requestPack çağrılıyor`);
  } catch (e) {
    if (__DEV__) console.warn(`[ModelDelivery] model_${modelId}: getModelFilePath hata:`, (e as Error)?.message ?? e);
  }

  await ANDROID_MODULE.requestPack(packName);

  let waitMs = 400;
  let lastState: PackState | undefined;

  while (Date.now() < deadline) {
    try {
      const p = await ANDROID_MODULE.getModelFilePath(modelId);
      if (p?.available) {
        const mapUri = mapboxRegistryUri(modelId);
        if (__DEV__) console.log(`[ModelDelivery] model_${modelId}: VAR – pack indirildi/hazır, registry=pp-local`);
        return { ok: true, packName, mapUri, fileUrl, lastState };
      }
    } catch {
      // ignore
    }

    try {
      const s: PackState = await ANDROID_MODULE.getPackState(packName);
      lastState = s;
      opts?.onProgress?.(s);
      if (s?.statusName === "FAILED" || s?.statusName === "CANCELED") {
        if (__DEV__) console.warn(`[ModelDelivery] model_${modelId}: HATA – pack durumu=${s?.statusName} errorCode=${s?.errorCode ?? "?"}`);
        break;
      }
    } catch {
      // ignore
    }

    await sleep(waitMs);
    waitMs = Math.min(waitMs * 1.5, 2500);
  }

  if (__DEV__) {
    const reason = lastState?.statusName ? `durum=${lastState.statusName}` : "zaman aşımı veya dosya yok";
    console.warn(`[ModelDelivery] model_${modelId}: YOK – kullanılamıyor (${reason}). Build'de gömülü değilse gen:android-asset-packs + copy-models çalıştırın. Boyut hatası için logcat'te PpLocalModelInterceptor bakın.`);
  }
  return { ok: false, packName, mapUri: fileUrl, fileUrl, lastState };
}

