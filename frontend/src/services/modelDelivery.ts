import { NativeModules, Platform } from "react-native";
import { ensureCachedModelUri } from "@/src/utils/modelsCache";

type PackState = {
  known: boolean;
  packName: string;
  status?: number;
  statusName?: string;
  errorCode?: number;
  errorMessage?: string;
  bytesDownloaded?: number;
  totalBytesToDownload?: number;
  percent?: number;
};

export type EnsureAvailableResult = {
  ok: boolean;
  packName: string;
  /** Mapbox registry URI (HTTPS source; cache doğrulandıysa file:// da olabilir). */
  mapUri: string;
  fileUrl: string;
  lastState?: PackState;
};

const ANDROID_MODULE = (NativeModules as any)?.ModelPacksModule;
const DEFAULT_TIMEOUT_MS = 300_000;

function ppLocalModelUrl(modelId: number): string {
  return `https://pp-local/models/model_${modelId}.glb`;
}

export type EnsureModelAvailableOptions = {
  timeoutMs?: number;
  onProgress?: (s: PackState) => void;
  /** Katalog `source` (HTTPS static GLB). */
  remoteUrl?: string;
};

async function verifyRemoteModelReachable(remoteUrl: string, timeoutMs: number): Promise<boolean> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), Math.min(timeoutMs, 30_000));
  const headers = { "ngrok-skip-browser-warning": "true" };
  try {
    // Bazı sunucular HEAD desteklemez; önce Range GET dene.
    const attempts: Array<{ method: "GET" | "HEAD"; extra?: Record<string, string> }> = [
      { method: "GET", extra: { Range: "bytes=0-0" } },
      { method: "HEAD" },
    ];
    for (const { method, extra } of attempts) {
      try {
        const res = await fetch(remoteUrl, {
          method,
          headers: { ...headers, ...extra },
          signal: ac.signal as any,
        });
        if (res.ok) return true;
      } catch {
        // sonraki yöntemi dene
      }
    }
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Yerel debug: gömülü PAD/asset (ModelPacksModule). */
async function tryAndroidPadFastPath(
  modelId: number,
  packName: string
): Promise<EnsureAvailableResult | null> {
  if (Platform.OS !== "android" || !ANDROID_MODULE) return null;
  try {
    const p = await ANDROID_MODULE.getModelFilePath(modelId);
    if (p?.available) {
      const mapUri = ppLocalModelUrl(modelId);
      if (__DEV__) {
        console.log(`[ModelDelivery] model_${modelId}: PAD/asset hazır (pp-local)`);
      }
      return { ok: true, packName, mapUri, fileUrl: mapUri };
    }
  } catch {
    // ignore
  }
  return null;
}

async function ensureModelAvailableViaHttps(
  modelId: number,
  packName: string,
  remoteUrl: string,
  opts?: EnsureModelAvailableOptions
): Promise<EnsureAvailableResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Android: Mapbox doğrudan HTTPS kullanır; önce erişilebilirlik yeterli (RNFS bazen hata verir).
  if (Platform.OS === "android") {
    const reachable = await verifyRemoteModelReachable(remoteUrl, timeoutMs);
    if (reachable) {
      opts?.onProgress?.({
        known: true,
        packName,
        statusName: "READY",
        percent: 5,
      });
      void ensureCachedModelUri({
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
      }).catch(() => {});
      return { ok: true, packName, mapUri: remoteUrl, fileUrl: remoteUrl };
    }
  }

  try {
    await ensureCachedModelUri({
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
      console.log(`[ModelDelivery] model_${modelId}: cache hazır (${Platform.OS})`);
    }
    return { ok: true, packName, mapUri: remoteUrl, fileUrl: remoteUrl };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    if (__DEV__) {
      console.warn(`[ModelDelivery] model_${modelId}: cache indirme hatası:`, msg);
    }

    // Cache indirmesi başarısız olsa bile Mapbox doğrudan HTTPS ile yükleyebilir.
    const reachable = await verifyRemoteModelReachable(remoteUrl, timeoutMs);
    if (reachable) {
      if (__DEV__) {
        console.warn(
          `[ModelDelivery] model_${modelId}: cache başarısız, Mapbox için doğrudan HTTPS kullanılacak`
        );
      }
      return {
        ok: true,
        packName,
        mapUri: remoteUrl,
        fileUrl: remoteUrl,
        lastState: { known: true, packName, statusName: "REMOTE_ONLY", errorMessage: msg },
      };
    }

    return {
      ok: false,
      packName,
      mapUri: remoteUrl,
      fileUrl: remoteUrl,
      lastState: { known: true, packName, statusName: "FAILED", errorMessage: msg },
    };
  }
}

export async function ensureModelAvailable(
  modelId: number,
  opts?: EnsureModelAvailableOptions
): Promise<EnsureAvailableResult> {
  const packName = `pp_model_${modelId}`;
  const fileUrl = ppLocalModelUrl(modelId);
  const remoteUrl = String(opts?.remoteUrl || "").trim();

  const padHit = await tryAndroidPadFastPath(modelId, packName);
  if (padHit) return padHit;

  if (!remoteUrl) {
    const err = "Model dosya adresi (source) bulunamadı. Uygulamayı güncelleyin veya katalogu yenileyin.";
    if (__DEV__) console.warn(`[ModelDelivery] model_${modelId}: ${err}`);
    return {
      ok: false,
      packName,
      mapUri: fileUrl,
      fileUrl,
      lastState: { known: false, packName, statusName: "NO_URL", errorMessage: err },
    };
  }

  if (__DEV__) {
    console.log(
      `[ModelDelivery] model_${modelId}: sunucudan (${Platform.OS}) ${remoteUrl.substring(0, 90)}`
    );
  }

  return ensureModelAvailableViaHttps(modelId, packName, remoteUrl, opts);
}
