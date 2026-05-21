/**
 * /api/v1/self/message-threads — ilan gerektirmeyen direct mesaj (AI Drone editör vb.)
 */

import { authJsonFetch, type ApiResult } from "./apiClient";

const BASE = "/api/v1/self";

export type SelfMessageThreadSummary = {
  threadId: string;
  counterpartyDisplayName?: string;
  counterpartyUserId?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

export type SelfMessageItem = {
  id: string;
  bodyText: string;
  sentAt: string;
  isMine: boolean;
  senderDisplayName?: string;
};

function unwrapData<T>(raw: Record<string, unknown> | null): T | null {
  if (!raw) return null;
  if (raw.data && typeof raw.data === "object") return raw.data as T;
  return raw as T;
}

function normalizeThread(raw: Record<string, unknown>): SelfMessageThreadSummary {
  return {
    threadId: String(raw.thread_id ?? raw.threadId ?? raw.id ?? ""),
    counterpartyDisplayName: String(raw.counterparty_display_name ?? raw.counterpartyDisplayName ?? "").trim() || undefined,
    counterpartyUserId:
      raw.counterparty_user_id != null
        ? Number(raw.counterparty_user_id)
        : raw.counterpartyUserId != null
          ? Number(raw.counterpartyUserId)
          : undefined,
    lastMessagePreview: String(raw.last_message_preview ?? raw.lastMessagePreview ?? "").trim() || undefined,
    lastMessageAt: (raw.last_message_at ?? raw.lastMessageAt ?? null) as string | undefined,
    unreadCount: raw.unread_count != null ? Number(raw.unread_count) : raw.unreadCount != null ? Number(raw.unreadCount) : undefined,
  };
}

function normalizeMessage(raw: Record<string, unknown>, myUserId?: number): SelfMessageItem {
  const senderId = raw.sender_user_id != null ? Number(raw.sender_user_id) : raw.senderUserId != null ? Number(raw.senderUserId) : undefined;
  const isMine = raw.is_mine != null ? Boolean(raw.is_mine) : raw.isMine != null ? Boolean(raw.isMine) : myUserId != null && senderId === myUserId;
  return {
    id: String(raw.id ?? raw.message_id ?? ""),
    bodyText: String(raw.body_text ?? raw.bodyText ?? raw.text ?? "").trim(),
    sentAt: String(raw.sent_at ?? raw.sentAt ?? raw.created_at ?? ""),
    isMine,
    senderDisplayName: String(raw.sender_display_name ?? raw.senderDisplayName ?? "").trim() || undefined,
  };
}

export const selfMessageService = {
  async openDirectThread(
    recipientUserId: number,
    initialMessage?: string,
  ): Promise<ApiResult<SelfMessageThreadSummary>> {
    const res = await authJsonFetch<Record<string, unknown>>(`${BASE}/message-threads`, {
      method: "POST",
      json: {
        recipient_user_id: recipientUserId,
        ...(initialMessage?.trim() ? { initial_message: initialMessage.trim() } : {}),
      },
    });
    if (!res.ok) return res;
    const data = unwrapData<Record<string, unknown>>(res.data) ?? res.data;
    const thread = normalizeThread(data);
    if (!thread.threadId) return { ok: false, error: "Thread oluşturulamadı" };
    return { ok: true, data: thread };
  },

  async listThreads(page = 1, pageSize = 30): Promise<ApiResult<SelfMessageThreadSummary[]>> {
    const res = await authJsonFetch<Record<string, unknown>>(
      `${BASE}/message-threads?page=${page}&page_size=${pageSize}`,
      { method: "GET" },
    );
    if (!res.ok) return res;
    const data = unwrapData<Record<string, unknown>>(res.data) ?? res.data;
    const rows = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.threads)
        ? data.threads
        : Array.isArray(res.data.items)
          ? res.data.items
          : [];
    return {
      ok: true,
      data: (rows as Record<string, unknown>[]).map(normalizeThread).filter((t) => t.threadId),
    };
  },

  async getThread(threadId: string): Promise<ApiResult<SelfMessageThreadSummary>> {
    const res = await authJsonFetch<Record<string, unknown>>(`${BASE}/message-threads/${encodeURIComponent(threadId)}`, {
      method: "GET",
    });
    if (!res.ok) return res;
    const data = unwrapData<Record<string, unknown>>(res.data) ?? res.data;
    return { ok: true, data: normalizeThread(data) };
  },

  async listMessages(
    threadId: string,
    opts: { limit?: number; before?: string } = {},
  ): Promise<ApiResult<SelfMessageItem[]>> {
    const q = new URLSearchParams();
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.before) q.set("before", opts.before);
    const qs = q.toString() ? `?${q}` : "";
    const res = await authJsonFetch<Record<string, unknown>>(
      `${BASE}/message-threads/${encodeURIComponent(threadId)}/messages${qs}`,
      { method: "GET" },
    );
    if (!res.ok) return res;
    const data = unwrapData<Record<string, unknown>>(res.data) ?? res.data;
    const rows = Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(res.data.messages)
          ? res.data.messages
          : [];
    return { ok: true, data: (rows as Record<string, unknown>[]).map((r) => normalizeMessage(r)) };
  },

  async sendMessage(threadId: string, bodyText: string): Promise<ApiResult<SelfMessageItem>> {
    const text = bodyText.trim();
    if (!text) return { ok: false, error: "Mesaj boş olamaz." };
    const res = await authJsonFetch<Record<string, unknown>>(
      `${BASE}/message-threads/${encodeURIComponent(threadId)}/messages`,
      { method: "POST", json: { body_text: text } },
    );
    if (!res.ok) return res;
    const data = unwrapData<Record<string, unknown>>(res.data) ?? res.data;
    return { ok: true, data: normalizeMessage(data) };
  },

  async markThreadRead(threadId: string): Promise<ApiResult<{ success: boolean }>> {
    const res = await authJsonFetch<Record<string, unknown>>(
      `${BASE}/message-threads/${encodeURIComponent(threadId)}/read`,
      { method: "POST", json: {} },
    );
    if (!res.ok) return res;
    return { ok: true, data: { success: true } };
  },

  async getMessageSummary(): Promise<ApiResult<{ unreadTotal?: number }>> {
    const res = await authJsonFetch<Record<string, unknown>>(`${BASE}/message-summary`, { method: "GET" });
    if (!res.ok) return res;
    const data = unwrapData<Record<string, unknown>>(res.data) ?? res.data;
    return {
      ok: true,
      data: {
        unreadTotal: Number(data.unread_total ?? data.unreadTotal ?? 0) || undefined,
      },
    };
  },
};
