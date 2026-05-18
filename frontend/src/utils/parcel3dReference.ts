/**
 * Sunucu: accounts.views.credit_views._3d_design_reference_id ile aynı biçim.
 * 3D tasarım lisansı reference_id (kredi kaydı) — mahalle metninde alt çizgi olabilir; birleştirme tek yönlüdür.
 */
export function parcel3dReferenceId(mahalle?: string, ada?: string, parsel?: string): string {
  const m = String(mahalle ?? "").trim() || "_";
  const a = String(ada ?? "").trim() || "_";
  const p = String(parsel ?? "").trim() || "_";
  return `${m}_${a}_${p}`;
}
