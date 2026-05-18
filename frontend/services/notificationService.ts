import { authJsonFetch } from "./apiClient";

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  data_json: any;
  is_read: boolean;
  created_at: string;
};

export async function listNotifications(limit = 50, offset = 0): Promise<
  | { ok: true; items: NotificationItem[]; unread_count: number }
  | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ items: NotificationItem[]; unread_count: number }>(
    `/api/notifications/?limit=${limit}&offset=${offset}`,
    { method: "GET" }
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, items: res.data.items || [], unread_count: res.data.unread_count ?? 0 };
}

export async function markNotificationRead(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success: boolean }>(`/api/notifications/${id}/read/`, {
    method: "POST",
    json: {},
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

