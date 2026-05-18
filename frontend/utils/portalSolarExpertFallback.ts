/** Portal `solar.expert` yoksa teknik özeti türetir (web `solar-expert-fallback.js` ile aynı mantık). */

function n(x: unknown): number | null {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

export function buildPortalExpertFallback(
  solar: Record<string, any> | null | undefined,
  derived: Record<string, any> | null | undefined,
): Record<string, any> | null {
  if (!solar || typeof solar !== "object") return null;

  const ext =
    solar.external_data && typeof solar.external_data === "object"
      ? (solar.external_data as Record<string, any>)
      : {};
  const gs =
    ext.google_summary && typeof ext.google_summary === "object"
      ? (ext.google_summary as Record<string, any>)
      : {};
  const src =
    solar.sources && typeof solar.sources === "object" ? (solar.sources as Record<string, any>) : {};

  const lat = n(derived?.latitude);
  const lon = n(derived?.longitude);
  if (lat == null || lon == null) return null;

  const slope = n(derived?.slope_deg);
  const aspect = n(derived?.aspect_deg);
  const parcel = n(derived?.parcel_area_m2);
  const grid = n(derived?.distance_to_grid_m);

  const annualNasa = n(ext.annual_irradiance_est);
  const annualGoogle = n(gs.estimated_annual_irradiance_kwh_m2);

  let annualGhi: number | null = null;
  let dailyGhi: number | null = null;
  let lineage = "unavailable";
  let lineageLabelTr =
    "Yıllık GHI bu yanıtta sayısal olarak yok; güneşlenme skoru varsayılan veya kısıtlı veriyle hesaplanmış olabilir.";
  let nasaParam: string | null = null;

  if (src.nasa_power_used === true && annualNasa != null) {
    annualGhi = annualNasa;
    dailyGhi = Math.round((annualNasa / 365) * 10000) / 10000;
    lineage = "nasa_power_climatology";
    lineageLabelTr =
      "NASA POWER — ALLSKY_SFC_SW_DWN uzun dönem iklim ortalaması (yatay düzlem).";
    nasaParam = "ALLSKY_SFC_SW_DWN";
  } else if (annualGoogle != null) {
    annualGhi = annualGoogle;
    lineage = "google_sunshine_hours_proxy";
    lineageLabelTr =
      "Google Solar — maxSunshineHoursPerYear üzerinden kaba yıllık GHI tahmini (ön sıralama).";
  } else if (annualNasa != null) {
    annualGhi = annualNasa;
    dailyGhi = Math.round((annualNasa / 365) * 10000) / 10000;
    lineage = "nasa_power_climatology";
    lineageLabelTr = "NASA POWER tabanlı yıllık GHI (yatay).";
    nasaParam = "ALLSKY_SFC_SW_DWN";
  }

  const googleExpert: Record<string, number> = {};
  const h = n(gs.max_sunshine_hours_per_year);
  const ra = n(gs.roof_area_m2);
  const est = n(gs.estimated_annual_irradiance_kwh_m2);
  if (h != null) googleExpert.max_sunshine_hours_per_year = h;
  if (ra != null) googleExpert.roof_area_m2 = ra;
  if (est != null) googleExpert.estimated_annual_irradiance_kwh_m2 = est;

  const disclaimersTr = [
    "Bu blok, sunucudaki tam `expert` alanı olmadan (önbellek veya eski sürüm) otomatik türetilmiştir; mümkünse sayfayı daha sonra yenileyin.",
    "GHI yatay düzlemdir; modül eğimi (POA) ve gölge kayıpları için ayrıca saha / 3B model gerekir.",
    "Şebeke mesafesi portal proxy değeridir; bağlantı için dağıtıcı ön görüşmesi gerekir.",
  ];

  return {
    coordinates: { latitude: lat, longitude: lon },
    site_geometry:
      slope != null && aspect != null ? { slope_deg: slope, aspect_deg: aspect } : null,
    parcel_area_m2: parcel,
    grid_distance_proxy_m: grid,
    property_type: derived?.property_type ?? solar.property_type,
    solar_resource: {
      annual_ghi_horiz_kwh_m2: annualGhi != null ? Math.round(annualGhi * 100) / 100 : null,
      daily_ghi_horiz_kwh_m2: dailyGhi,
      lineage,
      lineage_label_tr: lineageLabelTr,
      nasa_parameter: nasaParam,
    },
    google_building: Object.keys(googleExpert).length > 0 ? googleExpert : null,
    disclaimers_tr: disclaimersTr,
    _client_synthesized: true,
  };
}
