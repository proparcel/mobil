/** Portal detay — fiyat doğrulama durumu ve KM sekmesi görünüm modu (web parity). */

import type { PortalQueryDetail } from '../types/portal';

export type PortalPriceStatusKey = 'verified' | 'km_estimated' | 'unknown';

export type PortalKmTabDisplayMode =
  | 'neighbors_only'
  | 'neighbors_only_warning'
  | 'km_analysis_full';

export type PortalPriceStatusSummary = Pick<
  PortalQueryDetail,
  | 'query_type'
  | 'total_price'
  | 'valuation_canonical'
  | 'portal_summary_prices'
  | 'land_price_summary'
  | 'arsa_fiyati'
  | 'dfa_json'
  | 'price_estimation_warning'
>;

export type PortalPriceStatusResult = {
  status: PortalPriceStatusKey;
  label: string;
  totalPrice: number | null;
  isWarning: boolean;
  clickable: boolean;
};

function isStructurePortalQueryType(queryType: string | null | undefined): boolean {
  const q = String(queryType || '').trim().toLowerCase();
  return ['villa', 'bina', 'fabrika', 'fabrika_arsasi', 'mustakil_ev', 'konut'].includes(q);
}

/** summary / enrichment birleşiminden toplam fiyat (TL). */
export function resolvePortalTotalPrice(summary: PortalPriceStatusSummary | null | undefined): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const structureQuery = isStructurePortalQueryType(summary.query_type);
  const vc = summary.valuation_canonical;
  const sp = summary.portal_summary_prices;
  const lps = summary.land_price_summary;
  let tp: number | null | undefined = null;

  if (structureQuery) {
    if (lps?.total_tl != null && !Number.isNaN(Number(lps.total_tl))) {
      tp = Number(lps.total_tl);
    } else if (summary.arsa_fiyati != null && !Number.isNaN(Number(summary.arsa_fiyati))) {
      tp = Number(summary.arsa_fiyati);
    } else if (vc?.final_total_tl != null && !Number.isNaN(Number(vc.final_total_tl))) {
      tp = Number(vc.final_total_tl);
    }
  } else {
    tp = summary.total_price;
    if (vc?.final_total_tl != null && !Number.isNaN(Number(vc.final_total_tl))) {
      tp = Number(vc.final_total_tl);
    }
    if (sp && typeof sp === 'object' && (tp == null || tp === '' || Number.isNaN(Number(tp)))) {
      if (sp.total_price != null && sp.total_price !== '' && !Number.isNaN(Number(sp.total_price))) {
        tp = Number(sp.total_price);
      }
    }
  }

  if (tp == null || tp === '' || Number.isNaN(Number(tp))) return null;
  const n = Number(tp);
  return n > 0 ? n : null;
}

export const PORTAL_PRICE_STATUS_LABELS: Record<PortalPriceStatusKey, string> = {
  verified: 'Doğrulandı',
  km_estimated: 'Komşu Mahalle Analizi',
  unknown: 'Bilinmiyor',
};

export function resolvePortalPriceStatus(summary: PortalPriceStatusSummary | null | undefined): PortalPriceStatusResult {
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

export function isDbDrivenPriceSelection(selection: Record<string, unknown> | null | undefined): boolean {
  if (!selection || typeof selection !== 'object') return false;
  const reason = String(selection.reason || '').trim().toUpperCase();
  const model = String(selection.model || '').trim().toUpperCase();
  return model === 'DB' || reason.startsWith('DB_') || reason.startsWith('VILLAGE_DB_');
}

export function resolveKmTabDisplayMode({
  kmData,
  summary,
  selection,
}: {
  kmData?: {
    km_analysis_invoked?: boolean;
    km_live_db_verified?: boolean;
  } | null;
  summary: PortalPriceStatusSummary | null | undefined;
  selection?: Record<string, unknown> | null;
}): PortalKmTabDisplayMode {
  const kmInvoked = Boolean(kmData?.km_analysis_invoked);
  const kmLiveVerified = Boolean(kmData?.km_live_db_verified);
  const details = (selection?.details || {}) as Record<string, unknown>;
  const dbSource = (details.db_source || {}) as Record<string, unknown>;
  const dbVerified = Boolean(dbSource.verified);
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
