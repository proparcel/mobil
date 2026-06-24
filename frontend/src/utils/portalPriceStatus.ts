/**
 * Portal detay — fiyat durumu yardımcıları (web portal-price-status.js portu).
 */

import type { PortalDfaStep, PortalQueryDetail, ProQueryCreditNotice } from '../types/portal';
import { isStructurePortalQueryType } from './portalDetailCardContract';

function positiveTotal(value: unknown): number | null {
  if (value == null || value === '' || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

function firstPositiveTotal(...values: unknown[]): number | null {
  for (const value of values) {
    const n = positiveTotal(value);
    if (n != null) return n;
  }
  return null;
}

function dfaStepsEndTotal(steps: PortalDfaStep[] | null | undefined): number | null {
  if (!Array.isArray(steps) || !steps.length) return null;
  const last = steps[steps.length - 1];
  return firstPositiveTotal(last?.new_total, last?.final_total, last?.prev_total);
}

/** summary / enrichment birleşiminden toplam fiyat (TL). */
export function resolvePortalTotalPrice(
  summary: PortalQueryDetail | null | undefined,
): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const structureQuery = isStructurePortalQueryType(summary.query_type);
  const vc = summary.valuation_canonical;
  const steps = Array.isArray(summary.dfa_json) ? summary.dfa_json : [];
  const sp = summary.portal_summary_prices;
  const lps = summary.land_price_summary;
  const sps = summary.structure_price_summary;

  if (structureQuery) {
    return firstPositiveTotal(
      sps?.delivery_total_tl,
      summary.total_price,
      sp?.total_price,
      summary.arsa_fiyati,
      lps?.total_tl,
      vc?.final_total_tl,
      dfaStepsEndTotal(steps),
    );
  }

  return firstPositiveTotal(
    summary.total_price,
    sp?.total_price,
    vc?.final_total_tl,
    dfaStepsEndTotal(steps),
  );
}

export const PORTAL_PRICE_STATUS_LABELS = {
  verified: 'Doğrulandı',
  km_estimated: 'Komşu Mahalle Analizi',
  unknown: 'Bilinmiyor',
} as const;

export type PortalPriceStatusResult = {
  status: 'verified' | 'km_estimated' | 'unknown';
  label: string;
  totalPrice: number | null;
  isWarning: boolean;
  clickable: boolean;
};

export function resolvePortalPriceStatus(
  summary: PortalQueryDetail | null | undefined,
): PortalPriceStatusResult {
  const warning = summary?.price_estimation_warning;
  const totalPrice = resolvePortalTotalPrice(summary);

  if (warning?.show) {
    return {
      status: 'km_estimated',
      label: PORTAL_PRICE_STATUS_LABELS.km_estimated,
      totalPrice,
      isWarning: true,
      clickable: true,
    };
  }

  if (totalPrice != null && totalPrice > 0) {
    return {
      status: 'verified',
      label: PORTAL_PRICE_STATUS_LABELS.verified,
      totalPrice,
      isWarning: false,
      clickable: false,
    };
  }

  return {
    status: 'unknown',
    label: PORTAL_PRICE_STATUS_LABELS.unknown,
    totalPrice,
    isWarning: true,
    clickable: true,
  };
}

/** Proparcel'e Sor — fiyat durumuna göre ek kredi (+0 | +5 | +10). */
export function resolveProparcelAskCreditSurcharge(
  summary: PortalQueryDetail | null | undefined,
): number {
  const status = resolvePortalPriceStatus(summary).status;
  if (status === 'verified') return 0;
  if (status === 'km_estimated') return 5;
  return 10;
}

export function resolveProparcelAskPriceTierLabel(priceTier: string): string {
  if (priceTier === 'verified') return 'Doğrulanmış mahalle fiyatı';
  if (priceTier === 'km_estimated') return 'Doğrulanmamış / tahmini fiyat';
  return 'Fiyat bilgisi yok';
}

export function isDbDrivenPriceSelection(selection: Record<string, unknown> | null | undefined): boolean {
  if (!selection || typeof selection !== 'object') return false;
  const reason = String(selection.reason || '').trim().toUpperCase();
  const model = String(selection.model || '').trim().toUpperCase();
  return model === 'DB' || reason.startsWith('DB_') || reason.startsWith('VILLAGE_DB_');
}

export type KmTabDisplayMode = 'neighbors_only' | 'neighbors_only_warning' | 'km_analysis_full';

/**
 * KM sekmesi görünüm modu.
 */
export function resolveKmTabDisplayMode({
  kmData,
  summary,
  selection,
}: {
  kmData: { km_analysis_invoked?: boolean; km_live_db_verified?: boolean } | null | undefined;
  summary: PortalQueryDetail | null | undefined;
  selection: Record<string, unknown> | null | undefined;
}): KmTabDisplayMode {
  const kmInvoked = Boolean(kmData?.km_analysis_invoked);
  const kmLiveVerified = Boolean(kmData?.km_live_db_verified);
  const details = selection?.details as { db_source?: { verified?: boolean } } | undefined;
  const dbVerified = Boolean(details?.db_source?.verified);
  const isDbSelection = isDbDrivenPriceSelection(selection);
  const priceStatus = resolvePortalPriceStatus(summary);

  if (kmLiveVerified || (isDbSelection && dbVerified) || priceStatus.status === 'verified') {
    return 'neighbors_only';
  }

  if (kmInvoked && priceStatus.status === 'km_estimated') {
    return 'km_analysis_full';
  }

  return 'neighbors_only_warning';
}

export const PORTAL_UNVERIFIED_PRICE_WARNING_TEXT =
  'Veritabanımızda doğrulanmış mahalle birim fiyatı bulunmamaktadır. Bölge analizlerimiz devam etmektedir. '
  + 'Bu süreçte elimizdeki veri kullanılmamıştır ve analiz edilen bölgenin komşu mahalleleri tekrar analiz edilerek '
  + 'ProParcel tarafından tahmini bir mahalle birim fiyatı üretilmiştir. Sistem çalışmalarımız güvenilir seviyeye '
  + 'gelene kadar tahmini üretimlerden kredi alınmamaktadır. Bu rapor size fikir vermek içindir. Mahalle ilanları '
  + 've bölge uzmanlarından fikir isteyebilirsiniz.';

export function resolveProQueryCreditNoticeTitle(
  notice: ProQueryCreditNotice | null | undefined,
): string {
  const variant = String(notice?.variant || '').trim();
  if (variant === 'zero_price_no_charge') {
    return 'Fiyat üretilemedi';
  }
  if (variant === 'km_estimated_no_charge') {
    return 'Tahmini fiyat';
  }
  return 'Bilgilendirme';
}
