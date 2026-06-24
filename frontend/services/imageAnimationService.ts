import { API_URL } from "../config/api";
import { authFormFetch, authJsonFetch } from "./apiClient";
import { authService } from "./authService";
import { storageService } from "./storageService";
import RNFS from "react-native-fs";

export type MobileUploadImage = {
  uri: string;
  name: string;
  type: string;
};

export type ImageAnimationLicenseRow = {
  reference_id: string;
  label: string;
  image_animation_title?: string;
  created_at?: string | null;
};

export type ImageAnimationPackageRow = ImageAnimationLicenseRow & {
  remainingUses: number;
  packageUnitsTotal: number;
};

export type ImageAnimationCreditCosts = {
  image_animation: number;
  frame: number;
};

export type ImageAnimationPackageStatus = {
  licenseRef: string | null;
  packageUnitsTotal: number;
  packageUnitsUsed: number;
  remainingUses: number;
  unitsPerCredit: number;
};

/** 1 Tepe Coin paketinde verilen canlandırma hakkı */
export const IMAGE_ANIMATION_PACKAGE_UNITS = 3;

/** İlk paket lisansı — purchasing_kredits ai_img */
export const IMAGE_ANIMATION_PACKAGE_ACTION = "ai_img";

/** Tekrar canlandırma / frame preflight — purchasing_kredits ia_drone_realimg */
export const IMAGE_ANIMATION_EXTRA_ACTION = "ia_drone_realimg";

export const DEFAULT_IMAGE_ANIMATION_TITLE = "AI Resim Canlandırma";

export function createImageAnimationLicenseRef(): string {
  return `ai_img:${Date.now()}`;
}

export type DroneMyVideoRow = {
  job_id: string;
  reference_id?: string;
  status?: string;
  label?: string;
  is_license_placeholder?: boolean;
  meta?: {
    editor_mode?: string;
    image_animation_title?: string;
    reference_id?: string;
    action_type?: string;
  };
};

function errMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const maybe = error as { error?: unknown; message?: unknown; detail?: unknown };
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.detail === "string") return maybe.detail;
    if (typeof maybe.error === "string") return maybe.error;
  }
  return fallback;
}

export function absoluteDroneApiUrl(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = API_URL.replace(/\/$/, "");
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

export function imageAnimationResultUrl(jobId: string, slot: number): string {
  return absoluteDroneApiUrl(
    `/api/drone-recording-runway/segment-preflight-file/${encodeURIComponent(jobId)}/${slot}/?t=${Date.now()}`,
  );
}

/** Web `waitForSegmentPreflightReady` — PNG hazır mı (status API gecikse bile) */
export async function probeImageAnimationResultReady(jobId: string, slot: number): Promise<boolean> {
  const url = imageAnimationResultUrl(jobId, slot);
  let token = await storageService.getAccessToken();
  if (!token) {
    const refreshed = await authService.refreshToken();
    if (refreshed) token = await storageService.getAccessToken();
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401 && token) {
      const refreshed = await authService.refreshToken();
      const retryToken = refreshed ? await storageService.getAccessToken() : null;
      if (retryToken) {
        const retry = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${retryToken}` },
        });
        return retry.ok;
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function getImageAnimationCreditCosts(): Promise<
  { ok: true; costs: ImageAnimationCreditCosts } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ costs?: ImageAnimationCreditCosts }>(
    "/api/drone-recording-runway/credit-costs/",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Maliyet alınamadı.") };
  const costs = (res.data as any)?.costs || {};
  return {
    ok: true,
    costs: {
      image_animation:
        Number(costs.image_animation ?? costs.realimg ?? 0) > 0
          ? Number(costs.image_animation ?? costs.realimg)
          : 1,
      frame: Number(costs.frame ?? 2) > 0 ? Number(costs.frame ?? 2) : 2,
    },
  };
}

export async function getImageAnimationPackageStatus(
  licenseRef?: string,
): Promise<{ ok: true; status: ImageAnimationPackageStatus } | { ok: false; error: string }> {
  const query = licenseRef
    ? `/api/drone-recording-runway/credit-costs/?license_ref=${encodeURIComponent(licenseRef)}`
    : "/api/drone-recording-runway/credit-costs/";
  const res = await authJsonFetch<{ image_animation_package?: Record<string, unknown> }>(query, {
    method: "GET",
  });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Paket durumu alınamadı.") };
  const pkg = ((res.data as any)?.image_animation_package || {}) as Record<string, unknown>;
  const unitsPerCredit = Number(
    pkg.units_per_credit ?? pkg.unitsPerCredit ?? IMAGE_ANIMATION_PACKAGE_UNITS,
  );
  const packageUnitsTotal = Number(
    pkg.package_units_total ??
      pkg.packageUnitsTotal ??
      (unitsPerCredit > 0 ? unitsPerCredit : IMAGE_ANIMATION_PACKAGE_UNITS),
  );
  const packageUnitsUsed = Number(pkg.package_units_used ?? pkg.packageUnitsUsed ?? 0);
  const remainingUses = Number(
    pkg.remaining_uses ?? pkg.remainingUses ?? Math.max(0, packageUnitsTotal - packageUnitsUsed),
  );
  const ref = String(pkg.license_ref ?? pkg.licenseRef ?? "").trim();
  return {
    ok: true,
    status: {
      licenseRef: ref || null,
      packageUnitsTotal: Math.max(1, packageUnitsTotal),
      packageUnitsUsed: Math.max(0, packageUnitsUsed),
      remainingUses: Math.max(0, remainingUses),
      unitsPerCredit: Math.max(1, unitsPerCredit),
    },
  };
}

export async function listImageAnimationLicenses(): Promise<
  { ok: true; items: ImageAnimationLicenseRow[] } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ videos?: DroneMyVideoRow[] }>(
    "/api/drone-recording-runway/my-videos/",
    { method: "GET" },
  );
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Lisanslar yüklenemedi.") };
  const videos = Array.isArray((res.data as any)?.videos) ? (res.data as any).videos : [];
  const items: ImageAnimationLicenseRow[] = videos
    .filter(
      (row: DroneMyVideoRow) =>
        row.is_license_placeholder &&
        (row.meta?.editor_mode === "image_animation" || row.meta?.action_type === "ai_img"),
    )
    .map((row: DroneMyVideoRow) => ({
      reference_id: String(row.reference_id || row.meta?.reference_id || "").trim(),
      label: String(row.label || row.meta?.image_animation_title || "AI Resim Canlandırma").trim(),
      image_animation_title: row.meta?.image_animation_title,
      created_at: (row as any).created_at ?? null,
    }))
    .filter((row) => row.reference_id);
  return { ok: true, items };
}

export async function listImageAnimationPackages(): Promise<
  { ok: true; items: ImageAnimationPackageRow[] } | { ok: false; error: string }
> {
  const licenses = await listImageAnimationLicenses();
  if (!licenses.ok) return licenses;
  const enriched = await Promise.all(
    licenses.items.map(async (item) => {
      const status = await getImageAnimationPackageStatus(item.reference_id);
      const remainingUses = status.ok ? status.status.remainingUses : 0;
      const packageUnitsTotal = status.ok
        ? status.status.packageUnitsTotal
        : IMAGE_ANIMATION_PACKAGE_UNITS;
      return {
        ...item,
        remainingUses,
        packageUnitsTotal,
      };
    }),
  );
  return {
    ok: true,
    items: enriched
      .filter((row) => row.remainingUses > 0)
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
  };
}

export async function runwayPrepStart(payload: {
  refFrameCount: number;
  title: string;
  licenseRef?: string;
  promptText?: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ job_id?: string; success?: boolean }>("/api/drone-recording-runway/prep/", {
    method: "POST",
    json: {
      ref_frame_count: Math.max(1, Math.min(32, payload.refFrameCount || 1)),
      editor_mode: "image_animation",
      ai_video_title: payload.title.slice(0, 120),
      license_ref: payload.licenseRef || "",
      prompt_text: payload.promptText || "",
    },
  });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Hazırlık başlatılamadı.") };
  const jobId = String((res.data as any)?.job_id || "").trim();
  if (!jobId || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage((res.data as any)?.error, "Job oluşturulamadı.") };
  }
  return { ok: true, jobId };
}

export async function runwayPrepPushRef(
  jobId: string,
  slot: number,
  image: MobileUploadImage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("image", {
    uri: image.uri,
    name: image.name || `reference_${String(slot).padStart(2, "0")}.jpg`,
    type: image.type || "image/jpeg",
  } as any);
  const res = await authFormFetch<{ success?: boolean }>(
    `/api/drone-recording-runway/prep/${encodeURIComponent(jobId)}/ref/${slot}/`,
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Görsel yüklenemedi.") };
  }
  return { ok: true };
}

export async function startImageAnimationAnimate(payload: {
  jobId: string;
  slot: number;
  promptText: string;
  image?: MobileUploadImage | null;
}): Promise<
  | { ok: true; async: boolean; pollMs: number }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.append("job_id", payload.jobId);
  form.append("slot", String(payload.slot));
  form.append("prompt_text", payload.promptText.slice(0, 2000));
  if (payload.image?.uri) {
    form.append("image", {
      uri: payload.image.uri,
      name: payload.image.name || `segment_${payload.slot}.jpg`,
      type: payload.image.type || "image/jpeg",
    } as any);
  }
  const res = await authFormFetch<{ async?: boolean; poll_ms?: number; success?: boolean }>(
    "/api/drone-recording-runway/segments/preflight/",
    form,
  );
  if (!res.ok || (res.data as any)?.success === false) {
    return { ok: false, error: errMessage(res.error || (res.data as any)?.error, "Canlandırma başlatılamadı.") };
  }
  return {
    ok: true,
    async: Boolean((res.data as any)?.async),
    pollMs: Number((res.data as any)?.poll_ms || 1500),
  };
}

export async function getRunwayJobStatus(jobId: string): Promise<
  | {
      ok: true;
      state: string;
      ready: boolean;
      progress?: { step?: string; label?: string; segment_slot?: number };
      error?: string;
    }
  | { ok: false; error: string }
> {
  const res = await authJsonFetch<{
    state?: string;
    ready?: boolean;
    progress?: { step?: string; label?: string; segment_slot?: number };
    error?: string;
  }>(`/api/drone-recording-runway/status/?job_id=${encodeURIComponent(jobId)}`, { method: "GET" });
  if (!res.ok) return { ok: false, error: errMessage(res.error, "Durum alınamadı.") };
  return {
    ok: true,
    state: String((res.data as any)?.state || ""),
    ready: Boolean((res.data as any)?.ready),
    progress: (res.data as any)?.progress,
    error: (res.data as any)?.error,
  };
}

export async function waitForImageAnimationReady(
  jobId: string,
  slot: number,
  pollMs = 1500,
  maxAttempts = 240,
  onProgress?: (info: { step?: string; label?: string; state?: string }) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const interval = Math.max(600, Math.min(5000, pollMs));
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((r) => setTimeout(r, interval));

    if (await probeImageAnimationResultReady(jobId, slot)) {
      return { ok: true };
    }

    const status = await getRunwayJobStatus(jobId);
    if (!status.ok) return status;
    const step = String(status.progress?.step || "");
    const progressSlot = Number(status.progress?.segment_slot || slot);
    onProgress?.({
      step,
      label: status.progress?.label,
      state: status.state,
    });
    if (status.state === "FAILURE" || step === "failed") {
      return { ok: false, error: status.error || status.progress?.label || "Resim canlandırılamadı." };
    }
    if (step === "openai_ready" && (!slot || progressSlot === slot)) {
      return { ok: true };
    }
    if (status.ready && status.state === "SUCCESS" && step === "openai_ready") {
      return { ok: true };
    }
  }
  if (await probeImageAnimationResultReady(jobId, slot)) {
    return { ok: true };
  }
  return { ok: false, error: "Resim canlandırma zaman aşımına uğradı." };
}

export async function downloadImageAnimationResults(
  urls: string[],
): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const unique = urls.map((u) => String(u || "").trim()).filter(Boolean);
  if (!unique.length) {
    return { ok: false, error: "İndirilecek görsel yok." };
  }

  let token = await storageService.getAccessToken();
  if (!token) {
    const refreshed = await authService.refreshToken();
    if (refreshed) token = await storageService.getAccessToken();
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const paths: string[] = [];

  try {
    for (let i = 0; i < unique.length; i += 1) {
      const url = unique[i]!;
      const ext = url.includes(".png") ? "png" : "jpg";
      const path = `${RNFS.CachesDirectoryPath}/img_anim_${Date.now()}_${i}.${ext}`;
      const dl = await RNFS.downloadFile({
        fromUrl: url,
        toFile: path,
        headers,
      }).promise;
      if (dl.statusCode && dl.statusCode >= 400) {
        return { ok: false, error: `İndirme başarısız (HTTP ${dl.statusCode})` };
      }
      paths.push(path.startsWith("file://") ? path : `file://${path}`);
    }
    return { ok: true, paths };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Görseller indirilemedi." };
  }
}
