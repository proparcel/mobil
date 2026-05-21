/**
 * AI Drone ProParcel — talep oluşturma, İşlerim, teslim alma, geri bildirim.
 */

import { authJsonFetch, type ApiResult } from "./apiClient";
import type { AiDroneJobStatus } from "../src/utils/aiDroneJobStatus";

// —— Talep oluşturma ——
export type AiDroneParcelPayload = {
  mahalleTkgmValue: number | string;
  mahalle: string;
  ada: string;
  parsel: string;
  city?: string;
  town?: string;
  proparcelValue?: number | string | null;
};

export type CreateAiDroneRequestBody = {
  parcel: AiDroneParcelPayload;
  tkgmSummary: string;
  userNote: string;
  showUserCard: boolean;
  idempotencyKey: string;
};

export type CreateAiDroneRequestResult = {
  success: boolean;
  requestId?: number;
  status?: string;
  creditsUsed?: number;
  newBalance?: number;
  showUserCard?: boolean;
  error?: string;
  required?: number;
  balance?: number;
};

// —— İşlerim ——
export const AI_DRONE_API = {
  createRequest: "/api/ai-drone-proparcel/requests/",
  myRequests: "/api/ai-drone-proparcel/my-requests/",
  myRequestDetail: (id: number | string) => `/api/ai-drone-proparcel/my-requests/${id}/`,
  acceptDelivery: (id: number | string) => `/api/ai-drone-proparcel/requests/${id}/accept-delivery/`,
  feedback: (id: number | string) => `/api/ai-drone-proparcel/requests/${id}/feedback/`,
} as const;

export type AiDroneEditorProfile = {
  userId?: number;
  displayName: string;
  avatarUrl?: string | null;
};

export type AiDroneJobRating = {
  stars: number;
  submittedAt?: string | null;
};

export type AiDroneTimelineEntry = {
  key: string;
  label: string;
  at?: string | null;
  done?: boolean;
};

export type AiDroneJobListItem = {
  id: number;
  status: AiDroneJobStatus;
  statusLabel?: string | null;
  parcelSummary: string;
  userNote?: string | null;
  showUserCard?: boolean;
  deliveryUrl?: string | null;
  editorDeliveredAt?: string | null;
  userAcceptedAt?: string | null;
  userRating?: AiDroneJobRating | null;
  canAcceptDelivery: boolean;
  canSubmitFeedback: boolean;
  canMessageEditor: boolean;
  editor?: AiDroneEditorProfile | null;
  createdAt: string;
};

export type AiDroneJobDetail = AiDroneJobListItem & {
  timeline?: AiDroneTimelineEntry[];
};

export type ListMyRequestsParams = {
  status?: string;
  limit?: number;
  offset?: number;
};

function normalizeRating(raw: unknown): AiDroneJobRating | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    const n = Math.round(raw);
    return n >= 1 && n <= 5 ? { stars: n } : null;
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stars = Number(o.stars ?? o.rating ?? o.score);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return null;
  return {
    stars: Math.round(stars),
    submittedAt: (o.submitted_at ?? o.submittedAt ?? null) as string | null,
  };
}

function normalizeEditor(raw: unknown): AiDroneEditorProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const displayName = String(o.display_name ?? o.displayName ?? o.name ?? "").trim();
  if (!displayName && o.userId == null && o.user_id == null) return null;
  return {
    userId: o.user_id != null ? Number(o.user_id) : o.userId != null ? Number(o.userId) : undefined,
    displayName: displayName || "Editör",
    avatarUrl: (o.avatar_url ?? o.avatarUrl ?? null) as string | null,
  };
}

function normalizeTimeline(raw: unknown): AiDroneTimelineEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x, i) => {
      const o = x as Record<string, unknown>;
      return {
        key: String(o.key ?? o.id ?? i),
        label: String(o.label ?? o.title ?? "").trim() || "—",
        at: (o.at ?? o.timestamp ?? o.date ?? null) as string | null,
        done: o.done != null ? Boolean(o.done) : o.completed != null ? Boolean(o.completed) : undefined,
      };
    });
}

export function normalizeAiDroneJobListItem(raw: Record<string, unknown>): AiDroneJobListItem {
  const userRating = normalizeRating(raw.user_rating ?? raw.userRating ?? raw.rating);
  const status = String(raw.status ?? "pending_routing");
  const editor = normalizeEditor(raw.editor);
  return {
    id: Number(raw.id ?? 0),
    status,
    statusLabel: (raw.status_label ?? raw.statusLabel ?? null) as string | null,
    parcelSummary: String(raw.parcel_summary ?? raw.parcelSummary ?? raw.tkgm_summary ?? raw.tkgmSummary ?? "").trim(),
    userNote: String(raw.user_note ?? raw.userNote ?? "").trim() || null,
    showUserCard: Boolean(raw.show_user_card ?? raw.showUserCard),
    deliveryUrl: (raw.delivery_url ?? raw.deliveryUrl ?? null) as string | null,
    editorDeliveredAt: (raw.editor_delivered_at ?? raw.editorDeliveredAt ?? null) as string | null,
    userAcceptedAt: (raw.user_accepted_at ?? raw.userAcceptedAt ?? null) as string | null,
    userRating,
    canAcceptDelivery: Boolean(raw.can_accept_delivery ?? raw.canAcceptDelivery),
    canSubmitFeedback: Boolean(raw.can_submit_feedback ?? raw.canSubmitFeedback),
    canMessageEditor: Boolean(raw.can_message_editor ?? raw.canMessageEditor),
    editor,
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
  };
}

export function normalizeAiDroneJobDetail(raw: Record<string, unknown>): AiDroneJobDetail {
  return {
    ...normalizeAiDroneJobListItem(raw),
    timeline: normalizeTimeline(raw.timeline),
  };
}

function pickItems(body: Record<string, unknown>): Record<string, unknown>[] {
  const arr = body.items ?? body.results ?? body.requests;
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}

export const aiDroneProparcelService = {
  async createRequest(body: CreateAiDroneRequestBody): Promise<CreateAiDroneRequestResult> {
    const res = await authJsonFetch<CreateAiDroneRequestResult & Record<string, unknown>>(AI_DRONE_API.createRequest, {
      method: "POST",
      json: body,
    });
    if (!res.ok) {
      const d = res as { error: string; status?: number };
      return {
        success: false,
        error: d.error,
        ...(typeof (res as ApiResult<unknown>).status === "number" ? {} : {}),
      };
    }
    const data = res.data;
    if (data.success === false) {
      return {
        success: false,
        error: String(data.error || "Talep oluşturulamadı"),
        required: data.required as number | undefined,
        balance: data.balance as number | undefined,
      };
    }
    const requestId = data.requestId ?? (data.request_id != null ? Number(data.request_id) : undefined);
    return {
      success: true,
      requestId,
      status: data.status as string | undefined,
      creditsUsed: data.creditsUsed ?? (data.credits_used != null ? Number(data.credits_used) : undefined),
      newBalance: data.newBalance ?? (data.new_balance != null ? Number(data.new_balance) : undefined),
      showUserCard: data.showUserCard ?? data.show_user_card as boolean | undefined,
    };
  },

  async listMyRequests(params: ListMyRequestsParams = {}): Promise<ApiResult<AiDroneJobListItem[]>> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString() ? `?${q}` : "";
    const res = await authJsonFetch<Record<string, unknown>>(`${AI_DRONE_API.myRequests}${qs}`, { method: "GET" });
    if (!res.ok) return res;
    const rows = pickItems(res.data);
    return { ok: true, data: rows.map(normalizeAiDroneJobListItem).filter((j) => j.id > 0) };
  },

  async getMyRequestDetail(requestId: number): Promise<ApiResult<AiDroneJobDetail>> {
    const res = await authJsonFetch<Record<string, unknown>>(AI_DRONE_API.myRequestDetail(requestId), { method: "GET" });
    if (!res.ok) return res;
    const raw = (res.data.item ?? res.data.request ?? res.data) as Record<string, unknown>;
    const timeline = normalizeTimeline(res.data.timeline ?? raw.timeline);
    const detail = normalizeAiDroneJobDetail(raw);
    if (timeline?.length) detail.timeline = timeline;
    return { ok: true, data: detail };
  },

  async acceptDelivery(requestId: number): Promise<ApiResult<{ status?: string; userAcceptedAt?: string }>> {
    const res = await authJsonFetch<Record<string, unknown>>(AI_DRONE_API.acceptDelivery(requestId), {
      method: "POST",
      json: {},
    });
    if (!res.ok) return res;
    const item = (res.data.item ?? res.data) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        status: String(item?.status ?? res.data.status ?? "payment_pending"),
        userAcceptedAt: String(item?.user_accepted_at ?? item?.userAcceptedAt ?? res.data.userAcceptedAt ?? ""),
      },
    };
  },

  async submitFeedback(requestId: number, rating: number): Promise<ApiResult<{ rating: number }>> {
    const value = Math.min(5, Math.max(1, Math.round(rating)));
    const res = await authJsonFetch<Record<string, unknown>>(AI_DRONE_API.feedback(requestId), {
      method: "POST",
      json: { rating: value },
    });
    if (!res.ok) {
      if (res.status === 409) {
        return { ok: false, error: "Bu iş için zaten puan verdiniz.", status: 409 };
      }
      return res;
    }
    return { ok: true, data: { rating: value } };
  },
};

/** @deprecated Import from aiDroneProparcelService — geriye uyumluluk */
export const aiDroneJobsService = {
  listMyJobs: (params?: ListMyRequestsParams) => aiDroneProparcelService.listMyRequests(params),
  getJobDetail: (id: number) => aiDroneProparcelService.getMyRequestDetail(id),
  acceptDelivery: (id: number) => aiDroneProparcelService.acceptDelivery(id),
  submitRating: (id: number, stars: number) => aiDroneProparcelService.submitFeedback(id, stars),
  submitFeedback: (id: number, rating: number) => aiDroneProparcelService.submitFeedback(id, rating),
};

export type { ApiResult };
