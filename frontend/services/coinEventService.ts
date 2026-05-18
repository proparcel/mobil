import { authJsonFetch } from "./apiClient";

export async function screenshotShareCompleted(payload: {
  share_hash: string;
  parcel_id?: string;
  price_text?: string;
}): Promise<{ ok: true; credits_awarded: number } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ success: boolean; credits_awarded?: number; error?: string }>(
    "/api/coin-events/screenshot-share-completed/",
    { method: "POST", json: payload }
  );
  if (!res.ok) return { ok: false, error: res.error, status: res.status };
  if (res.data?.success) return { ok: true, credits_awarded: res.data.credits_awarded || 0 };
  return { ok: false, error: res.data?.error || "İşlem başarısız" };
}

