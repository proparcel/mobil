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
  | "production"
  | "polling"
  | "ready";

export type DroneProductionStepDef = {
  id: DroneProductionStepId;
  title: string;
  /** Boş = yalnızca cihazda (Mapbox snapshot) */
  api: string;
  method?: "GET" | "POST";
};

/** Video Oluştur akışı (sıralı) */
export const DRONE_VIDEO_PRODUCTION_STEPS: DroneProductionStepDef[] = [
  {
    id: "tkgm",
    title: "Parsel sorgusu (TKGM)",
    api: "cbsapi.tkgm.gov.tr (doğrudan)",
    method: "GET",
  },
  {
    id: "context",
    title: "İl / ilçe / nüfus / mesafe",
    api: "/api/drone-video-context/",
    method: "GET",
  },
  {
    id: "map_capture",
    title: "Haritadan referans kareleri",
    api: "",
  },
  {
    id: "narration",
    title: "Anlatım metni",
    api: "/api/drone-runway-narration/",
    method: "POST",
  },
  {
    id: "prep",
    title: "Runway hazırlık (job)",
    api: "/api/drone-recording-runway/prep/",
    method: "POST",
  },
  {
    id: "ref_upload",
    title: "Referans görselleri yükleme",
    api: "/api/drone-recording-runway/prep/{job_id}/ref/{slot}/",
    method: "POST",
  },
  {
    id: "production",
    title: "AI video üretimi başlat",
    api: "/api/drone-recording-runway/",
    method: "POST",
  },
  {
    id: "polling",
    title: "Üretim durumu",
    api: "/api/drone-recording-runway/status/?job_id=…",
    method: "GET",
  },
  {
    id: "ready",
    title: "Önizleme videosu",
    api: "/api/drone-recording-runway/file/{job_id}/",
    method: "GET",
  },
];

/** Dışa aktar (header indirme) — isteğe bağlı ikinci akış */
export const DRONE_PORTRAIT_EXPORT_STEPS: DroneProductionStepDef[] = [
  {
    id: "context",
    title: "Altyazı ayarları",
    api: "/api/drone-editor/subtitle-settings/",
    method: "POST",
  },
  {
    id: "tkgm",
    title: "Kullanıcı kartı (profil)",
    api: "/api/profile/context/?sections=base",
    method: "GET",
  },
  {
    id: "narration",
    title: "Kart annotasyonu",
    api: "/api/drone-editor/annotations/create/",
    method: "POST",
  },
  {
    id: "prep",
    title: "Dikey dışa aktar",
    api: "/api/drone-editor/export/",
    method: "POST",
  },
  {
    id: "polling",
    title: "Dışa aktarma durumu",
    api: "/api/drone-editor/export/status/?job_id=…&orientation=portrait",
    method: "GET",
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
