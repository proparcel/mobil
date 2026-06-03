/** Django /api/*_query_extract/ yanıt şeması */
export interface SmartQueryExtractResult {
  ok: boolean;
  error?: string;
  engine?: string;
  process_time?: string;
  il?: string;
  ilce?: string;
  mahalle?: string;
  city_id?: number | null;
  town_id?: number | null;
  quarter_id?: number | null;
  tkgm_value?: number | null;
  proparcel_value?: number | null;
  city_tkgm_value?: number | null;
  town_tkgm_value?: number | null;
  ada_no?: string;
  parsel_no?: string;
  transcribed_text?: string;
  refined_text?: string;
  raw_hints?: string[];
  confidence_score?: number;
  analysis_notes?: string;
}
