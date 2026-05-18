/**
 * Web `quarter_info_v2.html` → `renderQuarterInfo` ile aynı anlamda satırlar:
 * Türkçe etiketler, boolean → Evet/Hayır, sayılar tr-TR.
 */

export type MorphRow = { label: string; value: string };
export type MorphSection = { title: string; rows: MorphRow[] };

function pickValue(obj: Record<string, unknown> | undefined, keys: string[], fallback: string): string {
  if (!obj) return fallback;
  for (const k of keys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return fallback;
}

function formatMaybeNumber(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (Number.isFinite(n)) return n.toLocaleString("tr-TR");
  const s = String(v).trim();
  return s || "—";
}

/** Ham API / metin için Evet–Hayır; kullanıcıya "true"/"false" gösterme */
function formatYesNoTr(v: unknown): string {
  if (v === true || v === "true" || v === 1 || v === "1") return "Evet";
  if (v === false || v === "false" || v === 0 || v === "0") return "Hayır";
  if (v === undefined || v === null || v === "") return "—";
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "evet") return "Evet";
  if (s === "false" || s === "no" || s === "hayır" || s === "hayir") return "Hayır";
  return String(v);
}

function withUnit(value: unknown, unit: string): string {
  const normalized = formatMaybeNumber(value);
  if (normalized === "—") return "—";
  return `${normalized} ${unit}`;
}

function formatPercentSmart(value: unknown): string {
  const normalized = formatMaybeNumber(value);
  if (normalized === "—") return "—";
  return `${normalized} %`;
}

type MorphologyBundle = {
  morphology_info?: Record<string, unknown>;
  combined_features?: Record<string, unknown>;
  boundary_features?: Record<string, unknown>;
  slope_values?: Record<string, unknown>;
};

/**
 * Konum satırı: "İl / İlçe / Mahalle" biçiminde veya tek satır özet.
 */
export function buildQuarterMorphologySections(
  morphology: MorphologyBundle | undefined,
  opts: { locationLine: string }
): MorphSection[] {
  const sections: MorphSection[] = [];
  const m = morphology || {};
  const mInfo = (m.morphology_info || {}) as Record<string, unknown>;
  const combined = (m.combined_features || {}) as Record<string, unknown>;
  const boundary = (m.boundary_features || {}) as Record<string, unknown>;
  const slope = (m.slope_values || {}) as Record<string, unknown>;

  const locRows: MorphRow[] = [
    { label: "İl / İlçe / Mahalle", value: opts.locationLine.trim() || "—" },
    {
      label: "Morfolojik tip",
      value: pickValue(mInfo, ["MorphologyTypeName", "morphology_type_name", "MorfolojiTipi"], "—"),
    },
    {
      label: "Baskın yön",
      value: pickValue(mInfo, ["AspectTR", "aspect_tr", "Aspect"], "—"),
    },
  ];
  const proparcelVal = pickValue(mInfo, ["Proparcel_value", "proparcel_value"], "");
  if (proparcelVal && proparcelVal !== "—") {
    locRows.push({ label: "Proparcel değeri", value: proparcelVal });
  }
  sections.push({ title: "Konum ve genel", rows: locRows });

  const popRows: MorphRow[] = [
    { label: "Nüfus", value: formatMaybeNumber(pickValue(combined, ["Population", "population", "Nufus"], "")) },
    {
      label: "Şehir merkezine mesafe",
      value: withUnit(pickValue(combined, ["CityCenterDist", "city_center_dist", "SehirMerkeziMesafe"], ""), "km"),
    },
    {
      label: "İlçe merkezine mesafe",
      value: withUnit(pickValue(combined, ["TownCenterDist", "town_center_dist", "IlceMerkeziMesafe"], ""), "km"),
    },
  ];
  sections.push({ title: "Nüfus ve mesafe", rows: popRows });

  const slopeRows: MorphRow[] = [
    { label: "Ortalama eğim", value: withUnit(pickValue(slope, ["quarter_slope_avg", "QuarterSlopeAvg"], ""), "%") },
    {
      label: "0–20% eğim",
      value: withUnit(pickValue(slope, ["quarter_slope_percent_0_20", "QuarterSlopePercent020"], ""), "%"),
    },
    {
      label: "20–30% eğim",
      value: withUnit(pickValue(slope, ["quarter_slope_percent_20_30", "QuarterSlopePercent2030"], ""), "%"),
    },
    {
      label: "%30+ eğim",
      value: withUnit(pickValue(slope, ["quarter_slope_percent_over_30", "QuarterSlopePercentOver30"], ""), "%"),
    },
  ];
  const hasSlope = slopeRows.some((r) => r.value !== "—");
  if (hasSlope) {
    sections.push({ title: "Eğim bilgileri", rows: slopeRows });
  }

  const elevMin = formatMaybeNumber(pickValue(boundary, ["Boundary_elev_min_value"], ""));
  const elevMax = formatMaybeNumber(pickValue(boundary, ["Boundary_elev_max_value"], ""));
  const elevAvg = formatMaybeNumber(pickValue(boundary, ["Boundary_elev_avg"], ""));
  /** Web ile aynı sıra: min / max / ortalama */
  const kotCombined =
    elevMin === "—" && elevMax === "—" && elevAvg === "—"
      ? "—"
      : `${elevMin} / ${elevMax} / ${elevAvg} m`;

  const featureRows: MorphRow[] = [
    {
      label: "Yapı alanı kapsama",
      value: formatPercentSmart(pickValue(boundary, ["BoundaryPercentage", "boundaryPercentage"], "")),
    },
    { label: "Mahalle alanı", value: withUnit(pickValue(boundary, ["QuarterArea", "quarterArea"], ""), "m²") },
    { label: "Yapı alanı", value: withUnit(pickValue(boundary, ["BoundaryArea", "boundaryArea"], ""), "m²") },
    {
      label: "Yapı alanı ortalama eğim",
      value: withUnit(pickValue(boundary, ["BoundarySlopeAvg", "boundarySlopeAvg"], ""), "%"),
    },
    {
      label: "Kişi başına alan",
      value: withUnit(pickValue(boundary, ["SquareMetersPerPerson", "squareMetersPerPerson"], ""), "m²"),
    },
    {
      label: "Yapı alanı mahalle kapsama oranı (ızgara)",
      value: formatPercentSmart(pickValue(boundary, ["OutBoundaryGridCoverageRatio"], "")),
    },
    {
      label: "Yapı alanı tüm mahalleyi kapsıyor mu?",
      value: formatYesNoTr(boundary["Up80"]),
    },
    { label: "Kot (min / max / ort.)", value: kotCombined },
  ];
  sections.push({ title: "Mahalle özellikleri (yapı alanı)", rows: featureRows });

  return sections;
}
