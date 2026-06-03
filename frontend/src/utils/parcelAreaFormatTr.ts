export function parseParcelAreaM2Number(raw: string): number | null {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!t) return null;
  const commaIdx = t.indexOf(",");
  if (t.includes(",")) {
    const left = commaIdx >= 0 ? t.slice(0, commaIdx) : t;
    const intP = (left || "").replace(/[^\d]/g, "");
    const n = parseInt(intP, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+([.]\d+)?$/.test(t)) {
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  const intOnly = t.replace(/[^\d]/g, "");
  const n = parseInt(intOnly, 10);
  return Number.isFinite(n) ? n : null;
}

export function formatParcelAreaM2Tr(raw: string | number | null | undefined): string {
  const n = typeof raw === "number" ? raw : parseParcelAreaM2Number(String(raw ?? ""));
  if (n == null || !Number.isFinite(n) || n < 0 || n === 0) return "";
  const s = n.toLocaleString("tr-TR", { maximumFractionDigits: 0, useGrouping: true });
  return `${s} m²`;
}
