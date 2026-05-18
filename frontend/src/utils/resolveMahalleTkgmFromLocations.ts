/**
 * Kayıtlı mahalle adından (mahalleAd / form metni) TKGM mahalle Tkgm_value bulmaya çalışır.
 * 3D Tasarımlarım listesinde mahalleTkgmValue yoksa yedek yol.
 */

import locationsJson from "../data/locations.json";

const normalizeTr = (s: string): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .replace(/\b(mh\.?|mah\.?|mahallesi)\b/gi, "")
    .trim();

type Quarter = {
  Tkgm_text?: string;
  Tkgm_value: number;
  Proparcel_text?: string;
};

/**
 * @returns TKGM mahalle kodu veya bulunamazsa null
 */
export function resolveMahalleTkgmFromLocationsLabel(mahalleLabel: string): number | null {
  const raw = String(mahalleLabel ?? "").trim();
  if (raw.length < 2) return null;
  /** "Mahalle Adı (Not)" → önce parantez öncesi */
  const primary = raw.split("(")[0]?.trim() || raw;
  const target = normalizeTr(primary);
  if (target.length < 2) return null;

  const cities = (locationsJson as { cities?: { Towns?: { Quarters?: Quarter[] }[] }[] }).cities || [];
  let best: { score: number; value: number } | null = null;

  for (const city of cities) {
    for (const town of city.Towns || []) {
      for (const q of town.Quarters || []) {
        const tv = typeof q.Tkgm_value === "number" ? q.Tkgm_value : Number(q.Tkgm_value);
        if (!Number.isFinite(tv)) continue;

        const tt = normalizeTr(String(q.Tkgm_text || ""));
        const pt = normalizeTr(String(q.Proparcel_text || ""));
        const combined = normalizeTr(`${q.Tkgm_text || ""} (${q.Proparcel_text || ""})`);

        let score = 0;
        if (tt && (target === tt || target.includes(tt) || tt.includes(target))) score = Math.max(score, 80);
        if (pt && (target === pt || target.includes(pt) || pt.includes(target))) score = Math.max(score, 70);
        if (combined.length > 4 && (target.includes(combined) || combined.includes(target))) {
          score = Math.max(score, 50);
        }
        if (score > 0 && (!best || score > best.score)) {
          best = { score, value: tv };
        }
      }
    }
  }

  return best && best.score >= 45 ? best.value : null;
}
