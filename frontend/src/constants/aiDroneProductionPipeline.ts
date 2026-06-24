/**
 * Basit Video editörü — üretim adımları ve backend endpoint'leri.
 */

export type DroneProductionStepId =
  | "tkgm"
  | "context"
  | "map_capture"
  | "narration"
  | "prep"
  | "ref_upload"
  | "payment"
  | "production"
  | "polling"
  | "ready";

/** Mobil basit drone editör — backend OpenAI preflight atlar, doğrudan Runway */
export const MOBILE_DRONE_RUNWAY_CLIENT_SOURCE = "mobile_drone_simple_editor";

export type DroneProductionStepDef = {
  id: DroneProductionStepId;
  title: string;
  /** Boş = yalnızca cihazda (Mapbox snapshot) */
  api: string;
  method?: "GET" | "POST";
};

/** Video Oluştur akışı (sıralı) — yalnızca kullanıcıya gösterilen başlıklar */
export const DRONE_VIDEO_PRODUCTION_STEPS: DroneProductionStepDef[] = [
  {
    id: "tkgm",
    title: "Parsel sorgusu",
    api: "",
  },
  {
    id: "context",
    title: "Konum bilgileri",
    api: "",
  },
  {
    id: "map_capture",
    title: "Referans görselleri",
    api: "",
  },
  {
    id: "narration",
    title: "Anlatım metni",
    api: "",
  },
  {
    id: "prep",
    title: "Video hazırlığı",
    api: "",
  },
  {
    id: "ref_upload",
    title: "Görseller yükleniyor",
    api: "",
  },
  {
    id: "payment",
    title: "Ödeme",
    api: "",
  },
  {
    id: "production",
    title: "Video üretimi",
    api: "",
  },
  {
    id: "polling",
    title: "Video oluşturuluyor",
    api: "",
  },
  {
    id: "ready",
    title: "Önizleme hazır",
    api: "",
  },
];

/** Sunucu / geliştirici metinlerini kullanıcıya göstermeden süzgeç */
const TECH_DETAIL_PATTERN =
  /runway|openai|opencv|gpt|\/api\/|mapbox|tkgm|megsis|cbsapi|job_id|webhook|ffmpeg|remotion|frame\s*öncesi|resim\s*canlandırma/i;

const FRAME_PROGRESS_PATTERN = /frame\s*hazır[^\d]*(\d+)\s*\/\s*(\d+)/i;

export function userFacingPipelineDetail(
  raw: string | undefined | null,
  fallback = "İşleniyor…",
): string {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  const frameMatch = s.match(FRAME_PROGRESS_PATTERN);
  if (frameMatch) {
    return `Video karesi hazırlanıyor (${frameMatch[1]}/${frameMatch[2]})…`;
  }
  if (TECH_DETAIL_PATTERN.test(s)) {
    if (/frame\s*hazır|video\s*kare/i.test(s)) return "Video karesi hazırlanıyor…";
    return fallback;
  }
  return s;
}

/** Poll yanıtındaki step + label → kullanıcı metni (eski backend openai_refs dahil) */
export function userFacingRunwayProgressMessage(
  progress: { step?: string; label?: string } | null | undefined,
  fallback = "Video oluşturuluyor…",
): string {
  const step = String(progress?.step || "").trim().toLowerCase();
  if (step === "openai_refs" || step === "openai_ready") {
    return "Video karesi hazırlanıyor…";
  }
  if (step === "runway") {
    return userFacingPipelineDetail(progress?.label, "Video karesi hazırlanıyor…");
  }
  if (step === "merge" || step === "voice") {
    return userFacingPipelineDetail(progress?.label, "Video birleştiriliyor…");
  }
  if (step === "done" || step === "ready") {
    return "Video hazır";
  }
  return userFacingPipelineDetail(progress?.label, fallback);
}

/** Dışa aktar — kullanıcıya gösterilen adımlar */
export const DRONE_PORTRAIT_EXPORT_STEPS: DroneProductionStepDef[] = [
  {
    id: "context",
    title: "Altyazı ayarları",
    api: "",
  },
  {
    id: "tkgm",
    title: "Profil bilgileri",
    api: "",
  },
  {
    id: "narration",
    title: "Kart bilgileri",
    api: "",
  },
  {
    id: "prep",
    title: "Dışa aktarma",
    api: "",
  },
  {
    id: "polling",
    title: "Dışa aktarma durumu",
    api: "",
  },
];

export function nextProductionStepId(
  current: DroneProductionStepId | null,
): DroneProductionStepId | null {
  if (!current) return DRONE_VIDEO_PRODUCTION_STEPS[0]?.id ?? null;
  const idx = DRONE_VIDEO_PRODUCTION_STEPS.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= DRONE_VIDEO_PRODUCTION_STEPS.length - 1) return null;
  return DRONE_VIDEO_PRODUCTION_STEPS[idx + 1]!.id;
}
