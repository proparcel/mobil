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

export async function deleteNotification(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success: boolean }>(`/api/notifications/${id}/delete/`, {
    method: "DELETE",
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<
  { ok: true; updated: number } | { ok: false; error: string }
> {
  const res = await authJsonFetch<{ success: boolean; updated?: number }>(
    `/api/notifications/read-all/`,
    { method: "POST", json: {} },
  );
  if (res.ok) return { ok: true, updated: res.data.updated ?? 0 };

  // Eski sunucu: tek tek okundu işaretle
  const list = await listNotifications(100, 0);
  if (!list.ok) return { ok: false, error: res.error || list.error };
  const unreadItems = list.items.filter((i) => !i.is_read);
  for (const item of unreadItems) {
    const one = await markNotificationRead(item.id);
    if (!one.ok) return { ok: false, error: one.error };
  }
  return { ok: true, updated: unreadItems.length };
}

export async function bulkDeleteNotifications(
  ids: number[],
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const res = await authJsonFetch<{ success: boolean; deleted?: number }>(
    `/api/notifications/bulk-delete/`,
    { method: "POST", json: { ids } },
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, deleted: res.data.deleted ?? 0 };
}

