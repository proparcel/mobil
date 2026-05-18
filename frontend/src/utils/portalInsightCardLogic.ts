/** Villa / bina / müstakil / fabrika / konut / ticari: arazi ve meyve skoru sekmeleri yok (backend ile aynı küme). */
const STRUCTURE_PORTAL_QUERY_TYPES = new Set([
  "bina",
  "villa",
  "mustakil_ev",
  "ciftlik_ev",
  "fabrika",
  "konut",
  "konut_daire",
  "ticari",
  "commercial",
]);

export function isStructurePortalQueryType(queryType: unknown): boolean {
  return STRUCTURE_PORTAL_QUERY_TYPES.has(String(queryType ?? "").trim().toLowerCase());
}
