/**
 * Aranacaklar API — /api/aranacaklar/
 */
import { authJsonFetch, type ApiResult } from './apiClient';

export type AranacaklarListRow = {
  contact: {
    contact_id: string;
    full_name: string;
    phone_raw: string;
    phone_e164: string;
    source?: string;
    last_phone_call_at?: string;
  };
  intent?: Record<string, unknown> | null;
  followup?: Record<string, unknown> | null;
};

export type AranacaklarDetail = {
  contact: Record<string, unknown>;
  intent?: Record<string, unknown> | null;
  notes?: Array<{ note_id: string; text: string; created_at: string }>;
  followup?: Record<string, unknown> | null;
};

export async function fetchAranacaklarList(params: Record<string, string> = {}): Promise<ApiResult<{ results: AranacaklarListRow[] }>> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return authJsonFetch<{ results: AranacaklarListRow[] }>(`/api/aranacaklar${suffix}`);
}

export async function createAranacaklarContact(body: {
  full_name: string;
  phone_raw: string;
  phone_e164: string;
  source: 'manual' | 'phonebook';
}): Promise<ApiResult<Record<string, unknown>>> {
  return authJsonFetch<Record<string, unknown>>('/api/aranacaklar/', { method: 'POST', json: body });
}

export async function fetchAranacaklarDetail(contactId: string): Promise<ApiResult<AranacaklarDetail>> {
  return authJsonFetch<AranacaklarDetail>(`/api/aranacaklar/${encodeURIComponent(contactId)}/`);
}

export async function deleteAranacaklarContact(contactId: string): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/`, { method: 'DELETE' });
}

export async function postAranacaklarIntent(contactId: string, payload: Record<string, unknown>): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/intent/`, { method: 'POST', json: payload });
}

export async function postAranacaklarNote(contactId: string, text: string): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/notes/`, { method: 'POST', json: { text } });
}

export async function postAranacaklarFollowup(contactId: string, intervalMonths: 1 | 3 | 6 | 12): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/followup/`, {
    method: 'POST',
    json: { interval_months: intervalMonths },
  });
}

export async function postAranacaklarFollowupCalled(contactId: string): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/followup/called/`, { method: 'POST', json: {} });
}

export async function postAranacaklarPhoneCall(contactId: string): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/phone-call/`, { method: 'POST', json: {} });
}

export type AranacaklarStats = {
  contacts_total: number;
  followups_active: number;
  followups_overdue: number;
  followups_due_soon: number;
  calls_total: number;
  contacts_called_recent: number;
};

export async function fetchAranacaklarStats(): Promise<ApiResult<AranacaklarStats>> {
  return authJsonFetch<AranacaklarStats>('/api/aranacaklar/stats/');
}

export async function patchAranacaklarNote(contactId: string, noteId: string, text: string): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/notes/${encodeURIComponent(noteId)}/`, {
    method: 'PATCH',
    json: { text },
  });
}

export async function deleteAranacaklarNote(contactId: string, noteId: string): Promise<ApiResult<unknown>> {
  return authJsonFetch(`/api/aranacaklar/${encodeURIComponent(contactId)}/notes/${encodeURIComponent(noteId)}/`, {
    method: 'DELETE',
  });
}
