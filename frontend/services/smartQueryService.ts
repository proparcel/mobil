import { authJsonFetch, type ApiResult } from "./apiClient";

export interface SmartQueryExtractResponse {
  ok: boolean;
  engine?: string;
  error?: string;
  il?: string;
  ilce?: string;
  mahalle?: string;
  ada_no?: string;
  parsel_no?: string;
  raw_hints?: string[];
  city_id?: number | null;
  town_id?: number | null;
  quarter_id?: number | null;
  extracted_text?: string;
  process_time?: string;
}

export async function extractSmartQueryFromText(
  text: string
): Promise<ApiResult<SmartQueryExtractResponse>> {
  return authJsonFetch<SmartQueryExtractResponse>("/api/text-query-extract", {
    method: "POST",
    json: { text },
  });
}

export async function extractSmartQueryFromImage(
  image: string
): Promise<ApiResult<SmartQueryExtractResponse>> {
  return authJsonFetch<SmartQueryExtractResponse>("/api/image-query-extract", {
    method: "POST",
    json: { image },
  });
}
