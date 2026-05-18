/**
 * Mobil rapor ekranı için minimal payload tipleri.
 * Backend /api/mobile/report_payload/ yanıtı ve report memory / SavedQuery ile uyumludur.
 */

export type DfaRowKind = 'initial' | 'inc' | 'dec' | 'warn' | 'neutral';

export interface DfaRow {
  desc: string;
  kind: DfaRowKind;
  details: string[] | null;
}

export interface ReportLocationHeader {
  ilAd?: string | null;
  ilceAd?: string | null;
  mahalleAd?: string | null;
  adaNo?: string | null;
  parselNo?: string | null;
}

/** Backend report_payload yanıtı veya report memory'de tutulan minimal rapor verisi */
export interface ReportPayload {
  properties: ReportLocationHeader;
  valuation_steps?: unknown[];
  parameters_graphics?: {
    parcel_slope_graphics?: unknown;
    slope_surface?: unknown;
  };
  /** Mobil tarafta valuation_steps'ten türetilen DFA tablo satırları (kayıt için) */
  dfaRows?: DfaRow[];
}
