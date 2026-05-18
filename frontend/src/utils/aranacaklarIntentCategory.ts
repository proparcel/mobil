/**
 * Aranacaklar intent ana kategori (UI) → ilan kategori ağacı kök id (GET listing-categories parent).
 * @see ilan_portal/listing/category_taxonomy_seed.py kökler
 */
export const INTENT_MAIN_TO_ROOT_ID: Record<string, string> = {
  arsa: 'imarli_arsa',
  tarla: 'arazi',
  yapi: 'yapi',
  ticari: 'ticari',
};

/** Eski mobil kısa slug (konut, daire) → kanonik yaprak id — backend filtre ile uyumlu */
const LEGACY_SUB_TO_LEAF: Record<string, string> = {
  'arsa|konut': 'imarli_arsa_konut_imarli',
  'arsa|villa': 'imarli_arsa_villa_imarli',
  'arsa|ticari': 'imarli_arsa_ticari_imarli',
  'arsa|sanayi': 'imarli_arsa_sanayi_imarli',
  'arsa|turizm': 'imarli_arsa_turizm_imarli',
  'arsa|karma': 'imarli_arsa_konut_imarli',
  'tarla|tarla': 'arazi_tarla',
  'tarla|bag': 'arazi_bag',
  'tarla|bahce': 'arazi_bahce',
  'tarla|zeytinlik': 'arazi_zeytinlik',
  'tarla|ciftlik': 'arazi_ciftlik',
  'tarla|hobi_bahcesi': 'arazi_hobi_bahcesi',
  'yapi|daire': 'yapi_daire',
  'yapi|villa': 'yapi_villa',
  'yapi|mustakil_ev': 'yapi_mustakil_ev',
  'yapi|bina': 'yapi_bina',
  'ticari|ofis': 'ticari_buro_ofis',
  'ticari|dukkan': 'ticari_dukkan_magaza',
  'ticari|depo': 'ticari_depo_antrepo',
  'ticari|fabrika': 'ticari_fabrika_uretim_tesisi',
};

/** API’den gelen sub_category’yi yaprak id’ye çevir (legacy kısa veya zaten kanonik). */
export function normalizeIntentLeafId(main: string, sub: string): string {
  const m = (main || 'arsa').toLowerCase();
  const s = (sub || '').trim();
  if (!s) return '';
  if (s.includes('_')) return s.toLowerCase();
  const key = `${m}|${s.toLowerCase()}`;
  return LEGACY_SUB_TO_LEAF[key] || '';
}

const MAIN_LABELS: Record<string, string> = {
  arsa: 'Arsa',
  tarla: 'Tarla',
  yapi: 'Yapı',
  ticari: 'Ticari',
};

export type IntentCardParts = {
  headline: string;
  listingType: 'Satılık' | 'Kiralık';
  m2Line: string | null;
  priceLine: string | null;
};

function subCategoryDisplay(subRaw: string): string {
  const s = subRaw.trim();
  if (!s) return '—';
  return s.includes('_') ? s.replace(/_/g, ' ') : s;
}

/** Liste kartı: sol sütun + sağ rozet için ayrıştırılmış alanlar */
export function formatIntentCardParts(intent: Record<string, unknown> | null | undefined): IntentCardParts | null {
  if (!intent || typeof intent !== 'object') return null;
  const main = String((intent as any).main_category || '').toLowerCase();
  const mainL = MAIN_LABELS[main] || main || '—';
  const subL = subCategoryDisplay(String((intent as any).sub_category || ''));
  const ltRaw = String((intent as any).listing_type || '').toLowerCase();
  const listingType: 'Satılık' | 'Kiralık' = ltRaw === 'kiralik' ? 'Kiralık' : 'Satılık';

  const minM = (intent as any).min_m2;
  const maxM = (intent as any).max_m2;
  let m2Line: string | null = null;
  if (minM != null || maxM != null) {
    const a = minM != null ? String(minM) : '…';
    const b = maxM != null ? String(maxM) : '…';
    m2Line = `m² ${a} – ${b}`;
  }

  const pmin = (intent as any).price_min;
  const pmax = (intent as any).price_max;
  let priceLine: string | null = null;
  if (pmin != null || pmax != null) {
    const a = pmin != null ? Number(pmin).toLocaleString('tr-TR') : '…';
    const b = pmax != null ? Number(pmax).toLocaleString('tr-TR') : '…';
    priceLine = `${a} – ${b} ₺`;
  }

  return {
    headline: `${mainL} · ${subL}`,
    listingType,
    m2Line,
    priceLine,
  };
}

/** @deprecated tek metin satırları — formatIntentCardParts kullanın */
export function formatIntentCardLines(intent: Record<string, unknown> | null | undefined): string[] {
  const p = formatIntentCardParts(intent);
  if (!p) return [];
  const lines = [`${p.headline} · ${p.listingType}`];
  if (p.m2Line) lines.push(p.m2Line);
  if (p.priceLine) lines.push(`Fiyat: ${p.priceLine}`);
  return lines;
}
