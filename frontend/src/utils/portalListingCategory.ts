type LandCtx = {
  query_type?: string;
  category_main?: string;
  category_type?: string;
  category_leaf_id?: string;
};

export function mapPortalQueryTypeToListingCategory(qt: string): {
  category_main?: string;
  category_type?: string;
} {
  const m: Record<string, { category_main?: string; category_type?: string }> = {
    arsa: { category_main: 'imarli_arsa' },
    tarla: { category_main: 'arazi', category_type: 'tarla' },
    villa: { category_main: 'yapi', category_type: 'villa' },
    mustakil_ev: { category_main: 'yapi', category_type: 'mustakil_ev' },
    bina: { category_main: 'yapi', category_type: 'komple_bina' },
    ciftlik_ev: { category_main: 'yapi', category_type: 'ciftlik_evi' },
    fabrika: { category_main: 'ticari', category_type: 'fabrika_uretim_tesisi' },
  };
  return m[String(qt || '').trim().toLowerCase()] || {};
}

export function isLandCategoryFiltersForListing(ctx: LandCtx): boolean {
  const qt = String(ctx?.query_type || '').trim().toLowerCase();
  if (qt === 'tarla') return true;
  const main = String(ctx?.category_main || '').trim().toLowerCase();
  const type = String(ctx?.category_type || '').trim().toLowerCase();
  const leaf = String(ctx?.category_leaf_id || '').trim().toLowerCase();
  if (main === 'arazi') return true;
  if (type.includes('tarla') || leaf.includes('tarla')) return true;
  return false;
}
