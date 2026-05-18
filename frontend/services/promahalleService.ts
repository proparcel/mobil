/**
 * ProMahalle — quarter social + emlak danışman API (Django).
 */
import { DJANGO_API_URL } from "../config/api";
import { storageService } from "./storageService";
import { authService } from "./authService";
import type { ApiResult } from "./apiClient";

async function djangoHeaders(): Promise<Record<string, string>> {
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function djangoFetch<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  const url = `${DJANGO_API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = await djangoHeaders();
  let res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  if (res.status === 401 && !path.includes("token/refresh")) {
    const refreshed = await authService.refreshToken();
    const token = refreshed ? await storageService.getAccessToken() : null;
    if (token) {
      const h2 = { ...headers, Authorization: `Bearer ${token}` };
      res = await fetch(url, { ...init, headers: { ...h2, ...(init?.headers as any) } });
    }
  }
  const status = res.status;
  const text = await res.text();
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        status,
        error:
          (parsed as any)?.error ||
          (parsed as any)?.detail ||
          (parsed as any)?.message ||
          `HTTP ${status}`,
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    if (!res.ok) return { ok: false, status, error: `HTTP ${status}` };
    return { ok: true, data: text as any as T };
  }
}

async function djangoFormFetch<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  const url = `${DJANGO_API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  let accessToken = await storageService.getAccessToken();
  if (!accessToken) {
    const refreshed = await authService.refreshToken();
    accessToken = refreshed ? await storageService.getAccessToken() : null;
  }
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res = await fetch(url, { method: "POST", headers, body: form });
  if (res.status === 401) {
    const refreshed = await authService.refreshToken();
    const token = refreshed ? await storageService.getAccessToken() : null;
    if (token) {
      const h2 = { ...headers, Authorization: `Bearer ${token}` };
      res = await fetch(url, { method: "POST", headers: h2, body: form });
    }
  }
  const status = res.status;
  const text = await res.text();
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        status,
        error:
          (parsed as any)?.error ||
          (parsed as any)?.detail ||
          (parsed as any)?.message ||
          `HTTP ${status}`,
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    if (!res.ok) return { ok: false, status, error: `HTTP ${status}` };
    return { ok: true, data: text as any as T };
  }
}

async function djangoJsonPost<T>(path: string, json: Record<string, unknown>): Promise<ApiResult<T>> {
  return djangoFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(json),
  });
}

export type QuarterSocialScope = "global" | "city" | "district" | "quarter";

export type QuarterSocialPost = {
  post_id?: string;
  post_type?: string;
  username?: string;
  avatar_url?: string | null;
  text?: string;
  created_at?: string;
  like_count?: number;
  comment_count?: number;
  images?: Array<{ thumb?: string; large?: string; original?: string }>;
  meta?: {
    detail_url?: string;
    /** Pro sorgu / ilan — mobil `son-30-gun-detay` için */
    snapshot_id?: number | null;
    listing_id?: string;
    source_listing_id?: string;
  } & Record<string, unknown>;
  can_manage?: boolean;
  user_id?: string | number;
};

export async function fetchQuarterSocialPosts(params: {
  scope: QuarterSocialScope;
  city_id?: string;
  district_id?: string;
  quarter_id?: string;
  /** Web `getUserSocialPosts` — kullanıcı profili genel akışı */
  user_id?: string;
  cursor?: string | null;
  /** Varsayılan: akış tipine göre; profilde 10 (web ile aynı) */
  page_size?: number;
}): Promise<
  ApiResult<{
    success?: boolean;
    items?: QuarterSocialPost[];
    next_cursor?: string | null;
  }>
> {
  const sp = new URLSearchParams();
  sp.set("scope", params.scope);
  const uid = String(params.user_id || "").trim();
  const defaultPageSize = params.cursor ? 10 : uid ? 10 : params.scope === "global" ? 5 : 10;
  const pageSize = params.page_size != null ? Number(params.page_size) || defaultPageSize : defaultPageSize;
  sp.set("page_size", String(pageSize));
  if (params.city_id) sp.set("city_id", params.city_id);
  if (params.district_id) sp.set("district_id", params.district_id);
  if (params.quarter_id) sp.set("quarter_id", params.quarter_id);
  if (uid) sp.set("user_id", uid);
  if (params.cursor) sp.set("cursor", params.cursor);
  return djangoFetch(`/api/quarter-social/posts/?${sp.toString()}`);
}

export async function fetchQuarterSocialScore(
  quarterId: string
): Promise<ApiResult<{ success?: boolean; final_score?: number; social_score?: number; quarter_system_score?: number }>> {
  return djangoFetch(`/api/quarter-social/score/?quarter_id=${encodeURIComponent(quarterId)}`);
}

export async function toggleQuarterSocialLike(
  targetType: "post" | "comment",
  targetId: string
): Promise<ApiResult<{ success?: boolean; liked?: boolean; like_count?: number }>> {
  return djangoJsonPost("/api/quarter-social/likes/toggle/", {
    target_type: targetType,
    target_id: targetId,
  });
}

export async function createQuarterSocialPost(form: FormData): Promise<
  ApiResult<{ success?: boolean; post?: QuarterSocialPost; error?: string }>
> {
  return djangoFormFetch("/api/quarter-social/posts/create/", form);
}

export async function deleteQuarterSocialPost(postId: string): Promise<ApiResult<{ success?: boolean }>> {
  return djangoJsonPost("/api/quarter-social/posts/delete/", { post_id: postId });
}

/** Web `quarterSocialShared.updateQuarterSocialPost` — POST multipart */
export async function updateQuarterSocialPost(
  postId: string,
  payload: {
    text: string;
    keepImageIndexes: number[];
    newImages: Array<{ uri: string; type?: string; name?: string }>;
  }
): Promise<ApiResult<{ success?: boolean; post?: QuarterSocialPost; error?: string }>> {
  const form = new FormData();
  form.set("post_id", postId);
  form.set("text", payload.text);
  form.set("keep_image_indexes", JSON.stringify(payload.keepImageIndexes));
  payload.newImages.forEach((img, idx) => {
    form.append("images", {
      uri: img.uri,
      type: img.type || "image/jpeg",
      name: img.name || `photo_${idx}.jpg`,
    } as any);
  });
  return djangoFormFetch("/api/quarter-social/posts/update/", form);
}

export async function fetchQuarterSocialComments(postId: string): Promise<
  ApiResult<{ success?: boolean; items?: Array<Record<string, unknown>> }>
> {
  return djangoFetch(`/api/quarter-social/comments/?post_id=${encodeURIComponent(postId)}&page_size=200`);
}

export async function createQuarterSocialComment(payload: {
  post_id: string;
  parent_comment_id?: string;
  text: string;
}): Promise<ApiResult<{ success?: boolean; comment?: Record<string, unknown> }>> {
  return djangoJsonPost("/api/quarter-social/comments/create/", payload as Record<string, unknown>);
}

export type EmlakConsultantRow = {
  user_id?: number;
  full_name?: string;
  company_name?: string;
  avatar_url?: string | null;
  badge_url?: string;
  badges_url?: string;
  badges_svg_url?: string;
  member_label?: string;
  expert_level?: string;
  agent_rating_avg_overall?: number | null;
  agent_rating_count?: number;
};

export async function fetchEmlakConsultantsForQuarter(params: {
  city_id: number;
  town_id: number;
  quarter_value: number;
  page_size?: number;
}): Promise<ApiResult<{ ok?: boolean; results?: EmlakConsultantRow[]; total?: number }>> {
  const sp = new URLSearchParams();
  sp.set("city_id", String(params.city_id));
  sp.set("town_id", String(params.town_id));
  sp.set("quarter_value", String(params.quarter_value));
  sp.set("page_size", String(params.page_size ?? 24));
  sp.set("page", "1");
  return djangoFetch(`/accounts/emlak-danismanlari/api/?${sp.toString()}`);
}

export function resolveDjangoUrl(pathOrUrl: string): string {
  const base = DJANGO_API_URL.replace(/\/$/, "");
  const p = String(pathOrUrl || "").trim();
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return `${base}${p}`;
  return `${base}/${p}`;
}

/** Web `quarter_info_v2` / `QUARTER_RATING_QUESTIONS` ile aynı anahtarlar */
export const QUARTER_RATING_QUESTIONS: ReadonlyArray<readonly [string, string]> = [
  ["life_quality", "Bu mahallede yaşam kalitesini nasıl değerlendirirsiniz?"],
  ["safety", "Bu mahallede kendinizi ne kadar güvende hissediyorsunuz?"],
  ["transport", "Toplu taşıma ve ulaşım imkanlarını nasıl değerlendirirsiniz?"],
  ["quietness", "Mahalle gürültü ve kalabalık açısından ne kadar sakin?"],
  ["green_areas", "Park ve yeşil alan imkanlarını nasıl değerlendirirsiniz?"],
  ["investment", "Bu mahalleyi yatırım açısından nasıl değerlendirirsiniz?"],
  ["recommend", "Bu mahalleyi yaşamak için başkalarına önerir misiniz?"],
];

export type QuarterRatingSummary = {
  success?: boolean;
  response_count?: number;
  overall_avg?: number;
  overall_score_pct?: number;
  questions?: Array<{ key: string; label?: string; avg?: number; count?: number }>;
  my_rating?: { answers?: Record<string, number>; avg_rating?: number; updated_at?: string } | null;
};

export async function fetchQuarterRatingSummary(
  quarterId: string
): Promise<ApiResult<QuarterRatingSummary>> {
  return djangoFetch(
    `/api/quarter-social/ratings/?quarter_id=${encodeURIComponent(quarterId)}`
  );
}

export async function saveQuarterRating(payload: {
  quarter_id: string;
  city_id?: string;
  district_id?: string;
  answers: Record<string, number>;
}): Promise<ApiResult<{ success?: boolean; summary?: QuarterRatingSummary; error?: string }>> {
  return djangoJsonPost("/api/quarter-social/ratings/save/", payload as Record<string, unknown>);
}

/** Web `quarter_info_v2` / `QuarterInfoAPI.fetchQuarterLayers` ile aynı uç nokta (POST JSON) */
export type QuarterLayersPayload = {
  success?: boolean;
  layers?: Record<string, unknown>;
  features?: Record<string, boolean>;
  morphology?: {
    boundary_features?: Record<string, unknown>;
    morphology_info?: Record<string, unknown>;
    combined_features?: Record<string, unknown>;
    slope_values?: unknown;
  };
  grid_values?: unknown;
  quarter_id?: string | number;
  proparcel_value?: number;
  city_name?: string;
  error?: string;
};

export async function fetchQuarterLayers(params: {
  quarterId: string | number;
  proparcelValue: number;
  cityName: string;
}): Promise<ApiResult<QuarterLayersPayload>> {
  return djangoJsonPost<QuarterLayersPayload>("/api/get_quarter_layers/", {
    quarter_id: params.quarterId,
    proparcel_value: params.proparcelValue,
    city_name: params.cityName.trim(),
  });
}
