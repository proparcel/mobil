import type { SavedQueryItem } from "../../components/app/MyQueriesModal";
import { makeSavedQueryKey, type SavedQuery } from "./savedQueries";

export type SavedQueryDisplayRow = {
  id: string;
  il: string;
  ilce: string;
  mahalle: string;
  ada: string;
  parsel: string;
  alan: string;
  modeLabel: "Basit" | "Pro";
};

/** Web `formatArea` — sidebar Sorgularım */
export function formatQueryArea(area: unknown): string {
  if (area == null || area === "") return "";
  const raw = String(area).trim();
  const numeric = Number(raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m²`;
  }
  return raw;
}

export function getSavedQueryItemId(q: SavedQueryItem): string {
  if ("_fromApi" in q && q._fromApi && typeof q.id === "number") {
    return `api-${q.id}`;
  }
  return String((q as SavedQuery).id || makeSavedQueryKey(q));
}

function pickLocal(q: SavedQueryItem): SavedQuery | null | undefined {
  if ("_fromApi" in q && q._fromApi) return q.local ?? null;
  return q as SavedQuery;
}

function extractRawArea(q: SavedQueryItem): unknown {
  const local = pickLocal(q);
  const areaFromPrice = local?.price_snapshot?.area_m2;
  if (areaFromPrice != null && areaFromPrice !== "") return areaFromPrice;
  const sq = local ?? (q as SavedQuery);
  const rows = sq?.dfaRows;
  if (Array.isArray(rows) && rows.length > 0) {
    const first = rows[0] as Record<string, unknown>;
    return first?.arazi_m2 ?? first?.area_m2 ?? first?.alan ?? first?.value;
  }
  return null;
}

/** Web sidebar kartı: il/ilçe, mahalle, ada/parsel, alan */
export function getSavedQueryDisplayRow(q: SavedQueryItem): SavedQueryDisplayRow {
  const local = pickLocal(q);
  const lh = local?.location_header;
  const apiTitle = "title" in q && q.title ? String(q.title).trim() : "";
  let mahalle = lh?.mahalleAd?.trim() || "";
  if (!mahalle && apiTitle.includes(" - ")) {
    mahalle = apiTitle.split(" - ")[0]?.trim() || "";
  }
  if (!mahalle && apiTitle) mahalle = apiTitle;

  const il = lh?.ilAd?.trim() || "-";
  const ilce = lh?.ilceAd?.trim() || "-";
  const ada = String(q.ada || lh?.adaNo || "-").trim() || "-";
  const parsel = String(q.parsel || lh?.parselNo || "-").trim() || "-";
  const alan = formatQueryArea(extractRawArea(q));
  const localSq = pickLocal(q) ?? (("_fromApi" in q && q._fromApi ? null : q) as SavedQuery | null);
  const modeLabel: "Basit" | "Pro" = localSq?.mode === "pro" ? "Pro" : "Basit";

  return {
    id: getSavedQueryItemId(q),
    il,
    ilce,
    mahalle: mahalle || "Mahalle bilgisi yok",
    ada,
    parsel,
    alan,
    modeLabel,
  };
}
