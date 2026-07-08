/** Portal Pro sorgu query_type → ilan yaprak id (web queryTypeToListingLeaf.js ile aynı) */

const DEFAULT_MAP: Record<string, string> = {
  tarla: "arazi_tarla",
  arsa: "imarli_arsa_konut_imarli",
  arazi: "arazi_tarla",
  villa: "yapi_villa",
  bina: "yapi_bina",
  mustakil_ev: "yapi_mustakil_ev",
  ciftlik_ev: "yapi_ciftlik_evi",
  fabrika: "ticari_fabrika_uretim_tesisi",
  konut: "yapi_daire",
  konut_daire: "yapi_daire",
  ticari: "ticari_dukkan_magaza",
  commercial: "ticari_dukkan_magaza",
  yapi: "yapi_daire",
  imarli_arsa: "imarli_arsa_konut_imarli",
};

export function queryTypeToDefaultListingLeafId(queryType?: string | null): string {
  const q = String(queryType ?? "")
    .trim()
    .toLowerCase();
  if (!q) return "";
  return DEFAULT_MAP[q] || "";
}
