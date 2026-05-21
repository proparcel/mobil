/**
 * AI Drone iş durumu — mobil UI etiketleri (API statusLabel öncelikli).
 */

export type AiDroneJobStatus =
  | "pending_routing"
  | "assigned"
  | "editor_delivered"
  | "payment_pending"
  | "closed"
  | string;

const STATUS_LABELS: Record<string, string> = {
  pending_routing: "Editör atanıyor",
  assigned: "Üretimde",
  editor_delivered: "Video hazır",
  payment_pending: "Tamamlandı",
  closed: "Tamamlandı",
  // Eski / admin uyumluluk
  PENDING: "Beklemede",
  IN_PROGRESS: "İşlemde",
  DELIVERED: "Teslim edildi",
  CANCELLED: "İptal",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending_routing: { bg: "rgba(245, 158, 11, 0.15)", text: "#b45309" },
  assigned: { bg: "rgba(59, 130, 246, 0.15)", text: "#1d4ed8" },
  editor_delivered: { bg: "rgba(34, 197, 94, 0.15)", text: "#15803d" },
  payment_pending: { bg: "rgba(148, 163, 184, 0.2)", text: "#475569" },
  closed: { bg: "rgba(148, 163, 184, 0.2)", text: "#475569" },
};

function normKey(status: string | undefined): string {
  return String(status || "").trim().toLowerCase();
}

export function aiDroneJobStatusLabel(status: string | undefined, serverLabel?: string | null): string {
  const fromServer = String(serverLabel || "").trim();
  if (fromServer) return fromServer;
  const key = normKey(status);
  return STATUS_LABELS[key] || STATUS_LABELS[String(status || "").toUpperCase()] || key || "—";
}

export function aiDroneJobStatusColors(status: string | undefined): { bg: string; text: string } {
  const key = normKey(status);
  return STATUS_COLORS[key] || { bg: "rgba(148, 163, 184, 0.15)", text: "#475569" };
}

/** Teslim linki gösterilebilir durumlar */
export function canDownloadDroneJob(status: string | undefined, deliveryUrl?: string | null): boolean {
  const key = normKey(status);
  const hasUrl = Boolean(String(deliveryUrl || "").trim());
  if (!hasUrl) return false;
  return ["editor_delivered", "payment_pending", "closed"].includes(key);
}

export function isEditorDeliveredStatus(status: string | undefined): boolean {
  return normKey(status) === "editor_delivered";
}
