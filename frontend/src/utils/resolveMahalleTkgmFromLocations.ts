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

type City = { Proparcel_text?: string; Towns?: { Proparcel_text?: string; Quarters?: Quarter[] }[] };

function scoreNameMatch(target: string, candidate: string): number {
  const t = normalizeTr(target);
  const c = normalizeTr(candidate);
  if (!t || !c) return 0;
  if (t === c) return 100;
  if (t.includes(c) || c.includes(t)) return 70;
  return 0;
}

/**
 * il + ilçe + mahalle ile locations.json'dan TKGM mahalle kodu.
 */
export function resolveMahalleTkgmFromLocationsParts(
  ilAd?: string | null,
  ilceAd?: string | null,
  mahalleAd?: string | null
): number | null {
  const mahalle = String(mahalleAd ?? "").trim();
  if (mahalle.length < 2) return resolveMahalleTkgmFromLocationsLabel(mahalle);

  const ilTarget = String(ilAd ?? "").trim();
  const ilceTarget = String(ilceAd ?? "").trim();
  const mahalleTarget = normalizeTr(mahalle.split("(")[0]?.trim() || mahalle);
  const cities = (locationsJson as { cities?: City[] }).cities || [];

  let best: { score: number; value: number } | null = null;

  for (const city of cities) {
    const ilScore = ilTarget ? scoreNameMatch(ilTarget, city.Proparcel_text || "") : 50;
    if (ilTarget && ilScore < 50) continue;

    for (const town of city.Towns || []) {
      const ilceScore = ilceTarget ? scoreNameMatch(ilceTarget, town.Proparcel_text || "") : 50;
      if (ilceTarget && ilceScore < 50) continue;

      for (const q of town.Quarters || []) {
        const tv = typeof q.Tkgm_value === "number" ? q.Tkgm_value : Number(q.Tkgm_value);
        if (!Number.isFinite(tv)) continue;
        const tt = normalizeTr(String(q.Tkgm_text || ""));
        const pt = normalizeTr(String(q.Proparcel_text || ""));
        let mScore = 0;
        if (tt && (mahalleTarget === tt || mahalleTarget.includes(tt) || tt.includes(mahalleTarget))) {
          mScore = 85;
        }
        if (pt && (mahalleTarget === pt || mahalleTarget.includes(pt) || pt.includes(mahalleTarget))) {
          mScore = Math.max(mScore, 75);
        }
        if (mScore < 45) continue;
        const total = mScore + ilScore * 0.1 + ilceScore * 0.1;
        if (!best || total > best.score) best = { score: total, value: tv };
      }
    }
  }

  if (best) return best.value;
  return resolveMahalleTkgmFromLocationsLabel(mahalle);
}
