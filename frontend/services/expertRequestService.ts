import { authJsonFetch } from "./apiClient";
import type { ExpertBadgeCounts, ExpertRequestDetail, ExpertRequestListItem } from "../src/types/expertRequests";

export async function getExpertBadgeCounts(): Promise<
  | { ok: true; data: ExpertBadgeCounts }
  | { ok: false; error: string; status?: number }
> {
  const res = await authJsonFetch<ExpertBadgeCounts>(`/api/notifications/badge-counts/`, { method: "GET" });
  if (!res.ok) return res;
  return { ok: true, data: res.data };
}

export async function getExpertRequestsMine(): Promise<
  | { ok: true; items: ExpertRequestListItem[] }
  | { ok: false; error: string; status?: number }
> {
  const res = await authJsonFetch<{ success: boolean; items: ExpertRequestListItem[] }>(`/api/expert-requests/?mine=1`, {
    method: "GET",
  });
  if (!res.ok) return res;
  return { ok: true, items: (res.data as any)?.items || [] };
}

export async function getExpertRequestsIncoming(
  tab: "pending" | "closed" = "pending"
): Promise<
  | { ok: true; items: ExpertRequestListItem[] }
  | { ok: false; error: string; status?: number }
> {
  const res = await authJsonFetch<{ success: boolean; items: ExpertRequestListItem[] }>(
    `/api/expert-requests/?incoming=1&tab=${encodeURIComponent(tab)}`,
    { method: "GET" }
  );
  if (!res.ok) return res;
  return { ok: true, items: (res.data as any)?.items || [] };
}

export async function getExpertRequestDetail(
  id: number
): Promise<{ ok: true; data: ExpertRequestDetail } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ success: boolean; data: ExpertRequestDetail }>(`/api/expert-requests/${id}/`, {
    method: "GET",
  });
  if (!res.ok) return res;
  return { ok: true, data: (res.data as any).data };
}

export async function markExpertRequestSeen(
  id: number
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ success: boolean }>(`/api/expert-requests/${id}/mark-seen/`, {
    method: "POST",
    json: {},
  });
  if (!res.ok) return res;
  return { ok: true };
}

export async function claimExpertRequest(
  id: number
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ success: boolean }>(`/api/expert-requests/${id}/claim/`, { method: "POST", json: {} });
  if (!res.ok) return res;
  return { ok: true };
}

export async function respondExpertRequest(
  id: number,
  responseText: string
): Promise<{ ok: true; pdfUrl?: string } | { ok: false; error: string; status?: number }> {
  const res = await authJsonFetch<{ success: boolean; pdfUrl?: string }>(`/api/expert-requests/${id}/respond/`, {
    method: "POST",
    json: { responseText },
  });
  if (!res.ok) return res;
  return { ok: true, pdfUrl: (res.data as any)?.pdfUrl };
}

export async function purchaseAndCreateExpertRequest(payload: {
  neighborhoodId: number;
  parcelRef: any;
  sourceReportId?: string;
  note?: string;
  idempotencyKey: string;
}): Promise<
  | { ok: true; requestId: number; status: string; refundEligibleAt: string }
  | { ok: false; error: string; status?: number }
> {
  const res = await authJsonFetch<any>(`/api/expert-requests/purchase-and-create/`, {
    method: "POST",
    json: payload,
  });
  if (!res.ok) return res;
  return {
    ok: true,
    requestId: Number((res.data as any)?.requestId),
    status: String((res.data as any)?.status || ""),
    refundEligibleAt: String((res.data as any)?.refundEligibleAt || ""),
  };
}

export async function checkExpertRequestAvailability(neighborhoodId: number): Promise<
  | { ok: true; available: boolean; priceCoin: number; eligibleExpertCount: number; reason?: string }
  | { ok: false; error: string; status?: number }
> {
  const res = await authJsonFetch<any>(`/api/expert-requests/availability/?neighborhoodId=${encodeURIComponent(String(neighborhoodId))}`, {
    method: "GET",
  });
  if (!res.ok) return res;
  return {
    ok: true,
    available: !!(res.data as any)?.available,
    priceCoin: Number((res.data as any)?.priceCoin ?? 10),
    eligibleExpertCount: Number((res.data as any)?.eligibleExpertCount ?? 0),
    reason: (res.data as any)?.reason,
  };
}

